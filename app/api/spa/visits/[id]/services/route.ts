import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { badRequest, created, err, ok, withAuth } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";

type RouteParams = { params: Promise<{ id: string }> };
type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function apiError(error: unknown) {
  const code = isObject(error) && typeof error.code === "string" ? error.code : "";
  if (code === "42P01") {
    return NextResponse.json({ error: "Apply db-migration-v34.sql and db-migration-v40.sql before managing visit services." }, { status: 503 });
  }
  return err(error instanceof Error ? error.message : "Unable to update visit services");
}

export async function GET(req: Request, { params }: RouteParams) {
  const { id } = await params;
  return withAuth(req, async (user) => {
    const permission = await requirePermission(user, "view", "spa_visit_services");
    if (!permission.allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    try {
      const values: unknown[] = [id];
      let ownership = "vs.visit_id=$1";
      if (user.role !== "super_admin") {
        values.push(user.company_id);
        ownership += ` AND vs.company_id=$${values.length}`;
      }
      const result = await pool.query(
        `SELECT vs.* FROM spa_visit_services vs
         WHERE ${ownership} ORDER BY vs.created_at, vs.id`,
        values
      );
      return ok(result.rows);
    } catch (error) {
      return apiError(error);
    }
  });
}

export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params;
  return withAuth(req, async (user) => {
    const permission = await requirePermission(user, "create", "spa_visit_services");
    if (!permission.allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });

    try {
      const visitId = Number(id);
      const rawBody: unknown = await req.json();
      if (!Number.isInteger(visitId) || visitId < 1 || !isObject(rawBody)) return badRequest("Invalid service request");
      const serviceId = Number(rawBody.offering_id || rawBody.service_record_id);
      const quantity = Math.min(Math.max(Number(rawBody.quantity) || 1, 1), 99);
      if (!Number.isInteger(serviceId) || serviceId < 1) return badRequest("Service is required");

      const visitValues: unknown[] = [visitId];
      let visitOwnership = "id=$1";
      if (user.role !== "super_admin") {
        visitValues.push(user.company_id);
        visitOwnership += ` AND company_id=$${visitValues.length}`;
      }
      const visitResult = await pool.query(`SELECT * FROM spa_visits WHERE ${visitOwnership}`, visitValues);
      if (visitResult.rows.length === 0) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
      const visit = visitResult.rows[0];
      if (!visit.therapist_record_id) return badRequest("Assign a therapist before adding treatment services");
      if (visit.status !== "in_treatment") {
        return badRequest("Start the treatment before recording services used");
      }

      const serviceResult = await pool.query(
        `SELECT id, title, amount AS unit_price, details->>'offering_code' AS service_code
         FROM spa_management_records
         WHERE id=$1 AND company_id=$2 AND module_key='catalog/offerings'
           AND details->>'classification' IN ('spa_service','gym_service','package')
           AND status='active' AND deleted_at IS NULL`,
        [serviceId, visit.company_id]
      );
      if (serviceResult.rows.length === 0) return badRequest("Active spa service not found");
      const service = serviceResult.rows[0];

      const result = await pool.query(
        `INSERT INTO spa_visit_services
          (visit_id, company_id, service_record_id, offering_id, service_code,
           service_name, quantity, unit_price, notes, added_by)
         VALUES ($1,$2,$3,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (visit_id, service_record_id)
         DO UPDATE SET quantity=EXCLUDED.quantity,
                       offering_id=EXCLUDED.offering_id,
                       unit_price=EXCLUDED.unit_price,
                       notes=EXCLUDED.notes,
                       service_code=EXCLUDED.service_code,
                       service_name=EXCLUDED.service_name,
                       added_by=EXCLUDED.added_by
         RETURNING *`,
        [
          visitId,
          visit.company_id,
          serviceId,
          service.service_code || null,
          service.title,
          quantity,
          service.unit_price === null || service.unit_price === undefined ? null : Number(service.unit_price),
          typeof rawBody.notes === "string" ? rawBody.notes.slice(0, 2_000) : null,
          user.id,
        ]
      );
      const line = result.rows[0];
      await logAudit({
        company_id: visit.company_id,
        user_id: user.id,
        action: "CREATE",
        table_name: "spa_visit_services",
        record_id: line.id,
        new_values: line,
      });
      return created(line);
    } catch (error) {
      return apiError(error);
    }
  });
}

export async function DELETE(req: Request, { params }: RouteParams) {
  const { id } = await params;
  return withAuth(req, async (user) => {
    const permission = await requirePermission(user, "edit", "spa_visit_services");
    if (!permission.allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });

    try {
      const visitId = Number(id);
      const rawBody: unknown = await req.json();
      if (!Number.isInteger(visitId) || visitId < 1 || !isObject(rawBody)) return badRequest("Invalid service request");
      const lineId = Number(rawBody.id);
      if (!Number.isInteger(lineId) || lineId < 1) return badRequest("Service line ID is required");

      const values: unknown[] = [lineId, visitId];
      let ownership = "vs.id=$1 AND vs.visit_id=$2";
      if (user.role !== "super_admin") {
        values.push(user.company_id);
        ownership += ` AND vs.company_id=$${values.length}`;
      }
      const result = await pool.query(
        `DELETE FROM spa_visit_services vs
         USING spa_visits v
         WHERE ${ownership} AND v.id=vs.visit_id
           AND v.status='in_treatment'
         RETURNING vs.*`,
        values
      );
      if (result.rows.length === 0) return badRequest("Service line not found or treatment is already finished");
      const line = result.rows[0];
      await logAudit({
        company_id: line.company_id,
        user_id: user.id,
        action: "DELETE",
        table_name: "spa_visit_services",
        record_id: line.id,
        old_values: line,
      });
      return ok({ deleted: true });
    } catch (error) {
      return apiError(error);
    }
  });
}
