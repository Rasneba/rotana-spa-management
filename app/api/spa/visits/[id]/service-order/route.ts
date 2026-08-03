import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { badRequest, err, ok, withAuth } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import type { ServiceOrderSnapshot } from "@/lib/spa-service-orders";

type RouteParams = { params: Promise<{ id: string }> };
type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function apiError(error: unknown) {
  const code = isObject(error) && typeof error.code === "string" ? error.code : "";
  if (code === "42P01") {
    return NextResponse.json({ error: "Apply db-migration-v34.sql before generating service orders." }, { status: 503 });
  }
  return err(error instanceof Error ? error.message : "Unable to generate service order");
}

export async function GET(req: Request, { params }: RouteParams) {
  const { id } = await params;
  return withAuth(req, async (user) => {
    const permission = await requirePermission(user, "view", "spa_service_orders");
    if (!permission.allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    try {
      const values: unknown[] = [id];
      let ownership = "so.visit_id=$1";
      if (user.role !== "super_admin") {
        values.push(user.company_id);
        ownership += ` AND so.company_id=$${values.length}`;
      }
      const result = await pool.query(
        `SELECT so.* FROM spa_service_orders so WHERE ${ownership}`,
        values
      );
      if (result.rows.length === 0) return NextResponse.json({ error: "Service order not found" }, { status: 404 });
      return ok(result.rows[0]);
    } catch (error) {
      return apiError(error);
    }
  });
}

export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params;
  return withAuth(req, async (user) => {
    const permission = await requirePermission(user, "create", "spa_service_orders");
    if (!permission.allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });

    const client = await pool.connect();
    try {
      const visitId = Number(id);
      const rawBody: unknown = await req.json().catch(() => ({}));
      if (!Number.isInteger(visitId) || visitId < 1 || !isObject(rawBody)) return badRequest("Invalid visit");
      const action = typeof rawBody.action === "string" ? rawBody.action : "finish";
      if (!["finish", "refresh", "print", "handoff"].includes(action)) return badRequest("Invalid service-order action");

      await client.query("BEGIN");
      const values: unknown[] = [visitId];
      let ownership = "id=$1";
      if (user.role !== "super_admin") {
        values.push(user.company_id);
        ownership += ` AND company_id=$${values.length}`;
      }
      const visitResult = await client.query(
        `SELECT * FROM spa_visits WHERE ${ownership} FOR UPDATE`,
        values
      );
      if (visitResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Visit not found" }, { status: 404 });
      }
      const visit = visitResult.rows[0];
      if (visit.status === "cancelled") {
        await client.query("ROLLBACK");
        return badRequest("A cancelled visit cannot produce a service order");
      }
      if (!visit.therapist_record_id || !visit.therapist_name) {
        await client.query("ROLLBACK");
        return badRequest("Assign a therapist before finishing treatment");
      }
      if (action === "finish" && !visit.treatment_started_at) {
        await client.query("ROLLBACK");
        return badRequest("Start the treatment before finishing it");
      }

      const servicesResult = await client.query(
        `SELECT service_code, service_name, quantity
         FROM spa_visit_services WHERE visit_id=$1 ORDER BY created_at, id`,
        [visitId]
      );
      if (servicesResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return badRequest("Add at least one service before generating the draft");
      }

      const now = new Date().toISOString();
      const snapshot: ServiceOrderSnapshot = {
        visit_no: visit.visit_no,
        customer_name: visit.customer_name,
        therapist_name: visit.therapist_name,
        generated_at: now,
        notes: visit.notes || "",
        services: servicesResult.rows.map((service) => ({
          code: service.service_code || null,
          name: service.service_name,
          quantity: Number(service.quantity),
        })),
      };
      const totalItems = snapshot.services.reduce((total, service) => total + service.quantity, 0);

      const existingOrder = await client.query(
        `SELECT * FROM spa_service_orders WHERE visit_id=$1 FOR UPDATE`,
        [visitId]
      );
      let order;
      if (existingOrder.rows.length === 0) {
        const inserted = await client.query(
          `INSERT INTO spa_service_orders
            (company_id, visit_id, order_no, status, total_items,
             service_snapshot, generated_by)
           VALUES ($1,$2,$3,'draft',$4,$5::jsonb,$6)
           RETURNING *`,
          [visit.company_id, visitId, `SO-${visit.visit_no}`, totalItems, JSON.stringify(snapshot), user.id]
        );
        order = inserted.rows[0];
      } else {
        const updated = await client.query(
          `UPDATE spa_service_orders
           SET total_items=$1, service_snapshot=$2::jsonb,
               generated_at=CURRENT_TIMESTAMP, generated_by=$3,
               status=CASE WHEN status='handed_to_cashier' THEN status ELSE 'draft' END
           WHERE visit_id=$4 RETURNING *`,
          [totalItems, JSON.stringify(snapshot), user.id, visitId]
        );
        order = updated.rows[0];
      }

      if (action === "finish") {
        const finished = await client.query(
          `UPDATE spa_visits
           SET status='finished', finished_at=COALESCE(finished_at, CURRENT_TIMESTAMP), updated_by=$1
           WHERE id=$2 RETURNING *`,
          [user.id, visitId]
        );
        visit.status = finished.rows[0].status;
        visit.finished_at = finished.rows[0].finished_at;
        if (visit.appointment_id) {
          await client.query(
            `UPDATE spa_appointments SET status='completed', updated_at=CURRENT_TIMESTAMP
             WHERE id=$1 AND company_id=$2`,
            [visit.appointment_id, visit.company_id]
          );
        }
      } else if (action === "print") {
        if (!visit.finished_at) {
          await client.query("ROLLBACK");
          return badRequest("Finish the treatment before printing the cashier handoff draft");
        }
        const printed = await client.query(
          `UPDATE spa_service_orders
           SET status=CASE WHEN status='handed_to_cashier' THEN status ELSE 'printed' END,
               printed_at=CURRENT_TIMESTAMP, printed_by=$1, print_count=print_count+1
           WHERE visit_id=$2 RETURNING *`,
          [user.id, visitId]
        );
        order = printed.rows[0];
        const printedVisit = await client.query(
          `UPDATE spa_visits
           SET status=CASE WHEN status='handed_to_cashier' THEN status ELSE 'order_printed' END,
               updated_by=$1 WHERE id=$2 RETURNING status`,
          [user.id, visitId]
        );
        visit.status = printedVisit.rows[0].status;
      } else if (action === "handoff") {
        if (!visit.finished_at) {
          await client.query("ROLLBACK");
          return badRequest("Finish the treatment before cashier handoff");
        }
        if (Number(order.print_count || 0) < 1) {
          await client.query("ROLLBACK");
          return badRequest("Print the draft service order before handing it to the cashier");
        }
        const handedOff = await client.query(
          `UPDATE spa_service_orders
           SET status='handed_to_cashier', handed_to_cashier_at=COALESCE(handed_to_cashier_at, CURRENT_TIMESTAMP)
           WHERE visit_id=$1 RETURNING *`,
          [visitId]
        );
        order = handedOff.rows[0];
        await client.query(
          `UPDATE spa_visits SET status='handed_to_cashier', updated_by=$1 WHERE id=$2`,
          [user.id, visitId]
        );
        visit.status = "handed_to_cashier";
      }

      await client.query("COMMIT");
      await logAudit({
        company_id: visit.company_id,
        user_id: user.id,
        action: action === "print" ? "PRINT" : "UPDATE",
        table_name: "spa_service_orders",
        record_id: order.id,
        old_values: existingOrder.rows[0],
        new_values: order,
      });
      return ok({ order, visit });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      return apiError(error);
    } finally {
      client.release();
    }
  });
}
