import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { badRequest, created, err, ok, withAuth, type AuthUser } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { can, requirePermission } from "@/lib/permissions";

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function companyIdFor(user: AuthUser, requested?: unknown): number | null {
  if (user.role === "super_admin") {
    const companyId = Number(requested);
    return Number.isInteger(companyId) && companyId > 0 ? companyId : null;
  }
  return typeof user.company_id === "number" ? user.company_id : null;
}

function apiError(error: unknown) {
  const code = isObject(error) && typeof error.code === "string" ? error.code : "";
  if (code === "42P01") {
    return NextResponse.json(
      { error: "Visit and service-order tables are not installed. Apply db-migration-v34.sql." },
      { status: 503 }
    );
  }
  return err(error instanceof Error ? error.message : "Unable to process visit");
}

export async function GET(req: Request) {
  return withAuth(req, async (user) => {
    const permission = await requirePermission(user, "view", "spa_visits");
    if (!permission.allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });

    try {
      const url = new URL(req.url);
      const id = Number(url.searchParams.get("id"));
      const requestedCompany = url.searchParams.get("company_id");
      const companyId = companyIdFor(user, requestedCompany);
      if (!companyId && user.role !== "super_admin") return badRequest("A company is required");

      const values: unknown[] = [];
      const clauses = ["TRUE"];
      if (companyId) {
        values.push(companyId);
        clauses.push(`v.company_id = $${values.length}`);
      }
      if (Number.isInteger(id) && id > 0) {
        values.push(id);
        clauses.push(`v.id = $${values.length}`);
      }
      const status = url.searchParams.get("status");
      if (status) {
        values.push(status);
        clauses.push(`v.status = $${values.length}`);
      }
      const query = (url.searchParams.get("q") || "").trim().slice(0, 120);
      if (query) {
        values.push(`%${query}%`);
        clauses.push(`(v.visit_no ILIKE $${values.length} OR v.customer_name ILIKE $${values.length} OR v.therapist_name ILIKE $${values.length})`);
      }
      const date = url.searchParams.get("date");
      if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        values.push(date);
        clauses.push(`v.checked_in_at::date = $${values.length}::date`);
      }

      const result = await pool.query(
        `SELECT v.*,
                COUNT(vs.id)::int AS service_count,
                COALESCE(SUM(vs.quantity), 0)::int AS total_items,
                so.id AS order_id, so.status AS order_status, so.print_count
         FROM spa_visits v
         LEFT JOIN spa_visit_services vs ON vs.visit_id = v.id
         LEFT JOIN spa_service_orders so ON so.visit_id = v.id
         WHERE ${clauses.join(" AND ")}
         GROUP BY v.id, so.id
         ORDER BY v.checked_in_at DESC
         LIMIT 250`,
        values
      );

      const [canCreate, canEdit, canManageServices, canManageOrders] = await Promise.all([
        can(user, "create", "spa_visits"),
        can(user, "edit", "spa_visits"),
        can(user, "create", "spa_visit_services"),
        can(user, "create", "spa_service_orders"),
      ]);

      if (Number.isInteger(id) && id > 0) {
        if (result.rows.length === 0) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
        const services = await pool.query(
          `SELECT id, visit_id, service_record_id, service_code, service_name,
                  quantity, unit_price, notes, created_at, updated_at
           FROM spa_visit_services
           WHERE visit_id = $1
           ORDER BY created_at, id`,
          [id]
        );
        return ok({
          visit: { ...result.rows[0], services: services.rows },
          capabilities: { create: canCreate, edit: canEdit, services: canManageServices, orders: canManageOrders },
        });
      }

      return ok({
        visits: result.rows,
        capabilities: { create: canCreate, edit: canEdit, services: canManageServices, orders: canManageOrders },
      });
    } catch (error) {
      return apiError(error);
    }
  });
}

export async function POST(req: Request) {
  return withAuth(req, async (user) => {
    const permission = await requirePermission(user, "create", "spa_visits");
    if (!permission.allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });

    const client = await pool.connect();
    try {
      const rawBody: unknown = await req.json();
      if (!isObject(rawBody)) return badRequest("Invalid request body");
      const companyId = companyIdFor(user, rawBody.company_id);
      if (!companyId) return badRequest("A company is required");

      const memberId = Number(rawBody.member_id);
      let customerName = typeof rawBody.customer_name === "string" ? rawBody.customer_name.trim() : "";
      let customerPhone = typeof rawBody.customer_phone === "string" ? rawBody.customer_phone.trim() : "";

      if (Number.isInteger(memberId) && memberId > 0) {
        const member = await client.query(
          `SELECT id, full_name, phone FROM membership_members WHERE id=$1 AND company_id=$2`,
          [memberId, companyId]
        );
        if (member.rows.length === 0) return badRequest("Member not found");
        customerName = member.rows[0].full_name;
        customerPhone = customerPhone || member.rows[0].phone || "";
      }
      if (!customerName) return badRequest("Customer name is required");

      const appointmentId = Number(rawBody.appointment_id);
      if (Number.isInteger(appointmentId) && appointmentId > 0) {
        const appointment = await client.query(
          `SELECT id FROM spa_appointments WHERE id=$1 AND company_id=$2`,
          [appointmentId, companyId]
        );
        if (appointment.rows.length === 0) return badRequest("Appointment not found");
        const existingVisit = await client.query(
          `SELECT * FROM spa_visits WHERE company_id=$1 AND appointment_id=$2 LIMIT 1`,
          [companyId, appointmentId]
        );
        if (existingVisit.rows.length > 0) return ok(existingVisit.rows[0]);
      }
      await client.query("BEGIN");
      const counter = await client.query(
        `INSERT INTO spa_visit_counters (company_id, current_value)
         VALUES ($1, 1)
         ON CONFLICT (company_id)
         DO UPDATE SET current_value = spa_visit_counters.current_value + 1,
                       updated_at = CURRENT_TIMESTAMP
         RETURNING current_value`,
        [companyId]
      );
      const visitNo = `SPA-${String(counter.rows[0].current_value).padStart(6, "0")}`;
      const result = await client.query(
        `INSERT INTO spa_visits
          (company_id, visit_no, member_id, appointment_id, customer_name,
           customer_phone, notes, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)
         RETURNING *`,
        [
          companyId,
          visitNo,
          Number.isInteger(memberId) && memberId > 0 ? memberId : null,
          Number.isInteger(appointmentId) && appointmentId > 0 ? appointmentId : null,
          customerName.slice(0, 200),
          customerPhone.slice(0, 50) || null,
          typeof rawBody.notes === "string" ? rawBody.notes.slice(0, 10_000) : null,
          user.id,
        ]
      );
      await client.query("COMMIT");
      const visit = result.rows[0];
      await logAudit({
        company_id: companyId,
        user_id: user.id,
        action: "CREATE",
        table_name: "spa_visits",
        record_id: visit.id,
        new_values: visit,
      });
      return created(visit);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      return apiError(error);
    } finally {
      client.release();
    }
  });
}

export async function PUT(req: Request) {
  return withAuth(req, async (user) => {
    const permission = await requirePermission(user, "edit", "spa_visits");
    if (!permission.allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });

    try {
      const rawBody: unknown = await req.json();
      if (!isObject(rawBody)) return badRequest("Invalid request body");
      const id = Number(rawBody.id);
      if (!Number.isInteger(id) || id < 1) return badRequest("Visit ID is required");

      const values: unknown[] = [id];
      let ownership = "id=$1";
      if (user.role !== "super_admin") {
        values.push(user.company_id);
        ownership += ` AND company_id=$${values.length}`;
      }
      const oldResult = await pool.query(`SELECT * FROM spa_visits WHERE ${ownership}`, values);
      if (oldResult.rows.length === 0) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
      const oldVisit = oldResult.rows[0];
      if (["finished", "order_printed", "handed_to_cashier", "cancelled"].includes(oldVisit.status)
          && rawBody.action !== "handoff") {
        return badRequest("This visit is already closed for treatment changes");
      }

      const action = typeof rawBody.action === "string" ? rawBody.action : "update";
      let result;
      if (action === "assign") {
        const therapistId = Number(rawBody.therapist_record_id);
        if (!Number.isInteger(therapistId) || therapistId < 1) return badRequest("Therapist is required");
        const therapist = await pool.query(
          `SELECT id, title FROM spa_management_records
           WHERE id=$1 AND company_id=$2 AND module_key='spa/therapists'
             AND status='active' AND deleted_at IS NULL`,
          [therapistId, oldVisit.company_id]
        );
        if (therapist.rows.length === 0) return badRequest("Active therapist not found");
        result = await pool.query(
          `UPDATE spa_visits
           SET therapist_record_id=$1, therapist_name=$2,
               status=CASE WHEN status='checked_in' THEN 'assigned' ELSE status END,
               updated_by=$3
           WHERE id=$4 RETURNING *`,
          [therapistId, therapist.rows[0].title, user.id, id]
        );
      } else if (action === "start") {
        if (!oldVisit.therapist_record_id) return badRequest("Assign a therapist before starting treatment");
        result = await pool.query(
          `UPDATE spa_visits
           SET status='in_treatment', treatment_started_at=COALESCE(treatment_started_at, CURRENT_TIMESTAMP), updated_by=$1
           WHERE id=$2 RETURNING *`,
          [user.id, id]
        );
      } else if (action === "cancel") {
        result = await pool.query(
          `UPDATE spa_visits SET status='cancelled', updated_by=$1 WHERE id=$2 RETURNING *`,
          [user.id, id]
        );
      } else if (action === "handoff") {
        if (!oldVisit.finished_at) return badRequest("Finish the treatment before cashier handoff");
        result = await pool.query(
          `UPDATE spa_visits SET status='handed_to_cashier', updated_by=$1 WHERE id=$2 RETURNING *`,
          [user.id, id]
        );
        await pool.query(
          `UPDATE spa_service_orders
           SET status='handed_to_cashier', handed_to_cashier_at=COALESCE(handed_to_cashier_at, CURRENT_TIMESTAMP)
           WHERE visit_id=$1`,
          [id]
        );
      } else {
        result = await pool.query(
          `UPDATE spa_visits
           SET notes=$1, customer_phone=$2, updated_by=$3
           WHERE id=$4 RETURNING *`,
          [
            typeof rawBody.notes === "string" ? rawBody.notes.slice(0, 10_000) : oldVisit.notes,
            typeof rawBody.customer_phone === "string" ? rawBody.customer_phone.slice(0, 50) : oldVisit.customer_phone,
            user.id,
            id,
          ]
        );
      }

      const visit = result.rows[0];
      await logAudit({
        company_id: visit.company_id,
        user_id: user.id,
        action: "UPDATE",
        table_name: "spa_visits",
        record_id: visit.id,
        old_values: oldVisit,
        new_values: visit,
      });
      return ok(visit);
    } catch (error) {
      return apiError(error);
    }
  });
}
