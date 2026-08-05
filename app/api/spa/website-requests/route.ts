import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { badRequest, err, ok, withAuth } from "@/lib/api-utils";
import { can, requirePermission } from "@/lib/permissions";
import { approveBookingRequest } from "@/lib/booking-approval";

const STATUSES = ["new", "contacted", "confirmed", "declined", "archived"];

type JsonObject = Record<string, unknown>;
function isObject(value: unknown): value is JsonObject { return typeof value === "object" && value !== null && !Array.isArray(value); }
function text(value: unknown, max = 1000): string { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function validDate(value: unknown): value is string { return typeof value === "string" && !Number.isNaN(Date.parse(value)); }

function tableError(error: unknown) {
  const code = isObject(error) && typeof error.code === "string" ? error.code : "";
  if (code === "42P01" || code === "42703") return NextResponse.json({ error: "Apply db-migration-v38.sql and db-migration-v39.sql before using Website Requests." }, { status: 503 });
  return err(error instanceof Error ? error.message : "Unable to manage website requests");
}

export async function GET(req: Request) {
  return withAuth(req, async (user) => {
    const permission = await requirePermission(user, "view", "website_requests");
    if (!permission.allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    try {
      const url = new URL(req.url);
      const status = url.searchParams.get("status") || "";
      const q = (url.searchParams.get("q") || "").trim();
      const values: unknown[] = [];
      const where: string[] = [];
      if (user.role !== "super_admin") { values.push(user.company_id); where.push(`company_id=$${values.length}`); }
      if (status && STATUSES.includes(status)) { values.push(status); where.push(`status=$${values.length}`); }
      if (q) { values.push(`%${q}%`); where.push(`(full_name ILIKE $${values.length} OR phone ILIKE $${values.length} OR email ILIKE $${values.length} OR treatment ILIKE $${values.length})`); }
      const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const result = await pool.query(`SELECT * FROM website_booking_requests ${clause} ORDER BY created_at DESC LIMIT 300`, values);
      const summaryResult = await pool.query(
        `SELECT status, COUNT(*)::int AS count FROM website_booking_requests ${user.role !== "super_admin" ? "WHERE company_id=$1" : ""} GROUP BY status`,
        user.role !== "super_admin" ? [user.company_id] : []
      );
      const summary = Object.fromEntries(summaryResult.rows.map((row) => [row.status, row.count]));
      const [canEdit, canDelete, canApprove] = await Promise.all([
        can(user, "edit", "website_requests"), can(user, "delete", "website_requests"), can(user, "approve", "website_requests"),
      ]);
      return ok({ requests: result.rows, summary, capabilities: { edit: canEdit, delete: canDelete, approve: canApprove } });
    } catch (error) { return tableError(error); }
  });
}

export async function PUT(req: Request) {
  return withAuth(req, async (user) => {
    const permission = await requirePermission(user, "edit", "website_requests");
    if (!permission.allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    try {
      const body: unknown = await req.json();
      if (!isObject(body)) return badRequest("Invalid website request");
      const id = Number(body.id);
      const status = text(body.status, 40);
      const staffNotes = text(body.staff_notes, 2000);
      if (!id) return badRequest("Request ID is required");
      if (!STATUSES.includes(status)) return badRequest("Invalid status");

      const existingValues: unknown[] = [id];
      let ownership = "id=$1";
      if (user.role !== "super_admin") { existingValues.push(user.company_id); ownership += ` AND company_id=$${existingValues.length}`; }
      const existingResult = await pool.query(`SELECT * FROM website_booking_requests WHERE ${ownership}`, existingValues);
      const request = existingResult.rows[0];
      if (!request) return NextResponse.json({ error: "Website request not found" }, { status: 404 });

      if (status === "confirmed") {
        const approvePermission = await requirePermission(user, "approve", "website_requests");
        if (!approvePermission.allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
        const therapistId = Number(body.therapist_record_id || body.assigned_therapist_record_id || request.assigned_therapist_record_id);
        const offeringId = Number(body.offering_id || body.assigned_offering_id || request.assigned_offering_id);
        const facilityId = Number(body.facility_id || body.assigned_facility_id) || null;
        const startsAt = validDate(body.starts_at) ? body.starts_at : undefined;
        const endsAt = validDate(body.ends_at) ? body.ends_at : undefined;
        if (!therapistId || !offeringId) return badRequest("Approve requires therapist and service assignment");

        const approval = await approveBookingRequest({
          requestId: id,
          companyId: request.company_id,
          therapistRecordId: therapistId,
          offeringId,
          facilityId,
          startsAt,
          endsAt,
          staffNotes,
          requestedBy: user.id,
        });
        if (!approval.ok) return badRequest(approval.error);
        return ok(approval.request);
      }

      const values: unknown[] = [status, staffNotes || null, user.id, id];
      let updateOwnership = "id=$4";
      if (user.role !== "super_admin") { values.push(user.company_id); updateOwnership += ` AND company_id=$${values.length}`; }
      const result = await pool.query(
        `UPDATE website_booking_requests
         SET status=$1, staff_notes=$2, confirmed_by=CASE WHEN $1='declined' THEN $3 ELSE confirmed_by END, updated_at=CURRENT_TIMESTAMP
         WHERE ${updateOwnership} RETURNING *`,
        values
      );
      if (!result.rows[0]) return NextResponse.json({ error: "Website request not found" }, { status: 404 });
      return ok(result.rows[0]);
    } catch (error) { return tableError(error); }
  });
}

export async function DELETE(req: Request) {
  return withAuth(req, async (user) => {
    const permission = await requirePermission(user, "delete", "website_requests");
    if (!permission.allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    try {
      const body: unknown = await req.json();
      if (!isObject(body)) return badRequest("Invalid website request");
      const id = Number(body.id); if (!id) return badRequest("Request ID is required");
      const values: unknown[] = [id]; let ownership = "id=$1";
      if (user.role !== "super_admin") { values.push(user.company_id); ownership += ` AND company_id=$${values.length}`; }
      const result = await pool.query(`UPDATE website_booking_requests SET status='archived', updated_at=CURRENT_TIMESTAMP WHERE ${ownership} RETURNING *`, values);
      if (!result.rows[0]) return NextResponse.json({ error: "Website request not found" }, { status: 404 });
      return ok(result.rows[0]);
    } catch (error) { return tableError(error); }
  });
}
