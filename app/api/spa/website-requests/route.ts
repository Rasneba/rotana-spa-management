import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { badRequest, err, ok, withAuth } from "@/lib/api-utils";
import { can, requirePermission } from "@/lib/permissions";
import { dispatchCustomerNotification, type NotificationChannel } from "@/lib/notification-dispatch";

const STATUSES = ["new", "contacted", "confirmed", "declined", "archived"];
const ACTIVE_BOOKING_STATUSES = ["confirmed", "checked_in"];

type JsonObject = Record<string, unknown>;
function isObject(value: unknown): value is JsonObject { return typeof value === "object" && value !== null && !Array.isArray(value); }
function text(value: unknown, max = 1000): string { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function validDate(value: unknown): value is string { return typeof value === "string" && !Number.isNaN(Date.parse(value)); }

function tableError(error: unknown) {
  const code = isObject(error) && typeof error.code === "string" ? error.code : "";
  if (code === "42P01" || code === "42703") return NextResponse.json({ error: "Apply db-migration-v38.sql and db-migration-v39.sql before using Website Requests." }, { status: 503 });
  return err(error instanceof Error ? error.message : "Unable to manage website requests");
}

function buildConfirmationMessage(request: JsonObject, startsAt: string, therapistName: string, serviceName: string) {
  const when = new Date(startsAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  return `Dagi Spa booking approved: ${serviceName} at ${request.branch} on ${when}. Therapist: ${therapistName}. Thank you, ${request.full_name}.`;
}

async function validateResources(companyId: number, therapistId: number, offeringId: number) {
  const [therapistResult, offeringResult] = await Promise.all([
    pool.query(
      `SELECT id, title FROM spa_management_records
       WHERE id=$1 AND company_id=$2 AND module_key='spa/therapists'
         AND status='active' AND deleted_at IS NULL`,
      [therapistId, companyId]
    ),
    pool.query(
      `SELECT id, title, COALESCE(NULLIF(details->>'duration_minutes','')::int,60) AS duration_minutes
       FROM spa_management_records
       WHERE id=$1 AND company_id=$2 AND module_key='catalog/offerings'
         AND details->>'classification' IN ('spa_service','package')
         AND status='active' AND deleted_at IS NULL`,
      [offeringId, companyId]
    ),
  ]);
  if (!therapistResult.rows[0] || !offeringResult.rows[0]) return null;
  return { therapist: therapistResult.rows[0], offering: offeringResult.rows[0] };
}

async function hasConflict(params: { companyId: number; therapistId: number; facilityId: number | null; startsAt: string; endsAt: string; excludeId?: number | null }) {
  const therapistConflict = await pool.query(
    `SELECT id FROM spa_appointments
     WHERE company_id=$1 AND booking_kind='spa_booking'
       AND therapist_record_id=$2 AND status=ANY($3::varchar[])
       AND starts_at<$4::timestamp AND ends_at>$5::timestamp
       AND ($6::int IS NULL OR id<>$6)
     LIMIT 1`,
    [params.companyId, params.therapistId, ACTIVE_BOOKING_STATUSES, params.endsAt, params.startsAt, params.excludeId || null]
  );
  if (therapistConflict.rows.length > 0) return "This therapist already has a booking during the selected time";

  if (params.facilityId) {
    const facility = await pool.query(`SELECT capacity FROM spa_facilities WHERE id=$1 AND company_id=$2 AND is_active=true`, [params.facilityId, params.companyId]);
    if (!facility.rows[0]) return "Active treatment room not found";
    const capacity = Number(facility.rows[0].capacity) || 1;
    const roomConflict = await pool.query(
      `SELECT COUNT(*)::int AS count FROM spa_appointments
       WHERE company_id=$1 AND facility_id=$2 AND status=ANY($3::varchar[])
         AND starts_at<$4::timestamp AND ends_at>$5::timestamp
         AND ($6::int IS NULL OR id<>$6)`,
      [params.companyId, params.facilityId, ACTIVE_BOOKING_STATUSES, params.endsAt, params.startsAt, params.excludeId || null]
    );
    if (Number(roomConflict.rows[0].count) >= capacity) return "This treatment room is fully booked during the selected time";
  }
  return null;
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
        const startsAt = validDate(body.starts_at) ? body.starts_at : new Date(request.preferred_at).toISOString();
        if (!therapistId || !offeringId) return badRequest("Approve requires therapist and service assignment");
        const resources = await validateResources(request.company_id, therapistId, offeringId);
        if (!resources) return badRequest("Active therapist or Spa service not found");
        const endsAt = validDate(body.ends_at) ? body.ends_at : new Date(new Date(startsAt).getTime() + resources.offering.duration_minutes * 60_000).toISOString();
        const conflict = await hasConflict({ companyId: request.company_id, therapistId, facilityId, startsAt, endsAt, excludeId: request.appointment_id || null });
        if (conflict) return badRequest(conflict);

        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const appointmentResult = request.appointment_id
            ? await client.query(
                `UPDATE spa_appointments SET facility_id=$1, offering_id=$2, therapist_record_id=$3, therapist_name=$4,
                   guest_name=$5, guest_phone=$6, service_name=$7, starts_at=$8, ends_at=$9, status='confirmed', notes=$10, website_request_id=$11
                 WHERE id=$12 AND company_id=$13 RETURNING *`,
                [facilityId, offeringId, therapistId, resources.therapist.title, request.full_name, request.phone, resources.offering.title, startsAt, endsAt, staffNotes || request.notes || null, id, request.appointment_id, request.company_id]
              )
            : await client.query(
                `INSERT INTO spa_appointments
                  (company_id, booking_kind, facility_id, offering_id, therapist_record_id, therapist_name,
                   guest_name, guest_phone, service_name, starts_at, ends_at, status, notes, created_by, website_request_id)
                 VALUES ($1,'spa_booking',$2,$3,$4,$5,$6,$7,$8,$9,$10,'confirmed',$11,$12,$13)
                 RETURNING *`,
                [request.company_id, facilityId, offeringId, therapistId, resources.therapist.title, request.full_name, request.phone, resources.offering.title, startsAt, endsAt, staffNotes || request.notes || null, user.id, id]
              );
          const appointment = appointmentResult.rows[0];
          const notificationMessage = buildConfirmationMessage(request, startsAt, resources.therapist.title, resources.offering.title);
          const channel = (request.notification_channel || "phone") as NotificationChannel;
          const recipient = request.notification_contact || (channel === "email" ? request.email : request.phone);
          const delivery = await dispatchCustomerNotification({ channel, recipient, subject: "Dagi Spa booking approved", message: notificationMessage });
          await client.query(
            `INSERT INTO notification_outbox (company_id, website_request_id, appointment_id, channel, recipient, subject, message, status, provider_response, sent_at)
             VALUES ($1,$2,$3,$4,$5,'Dagi Spa booking approved',$6,$7,$8,CASE WHEN $7='sent' THEN CURRENT_TIMESTAMP ELSE NULL END)`,
            [request.company_id, id, appointment.id, channel, recipient, notificationMessage, delivery.status, delivery.providerResponse || null]
          );
          const updated = await client.query(
            `UPDATE website_booking_requests SET status='confirmed', staff_notes=$1, confirmed_by=$2, confirmed_at=CURRENT_TIMESTAMP,
               assigned_therapist_record_id=$3, assigned_offering_id=$4, assigned_facility_id=$5, appointment_id=$6,
               notification_status=$7, notification_message=$8, updated_at=CURRENT_TIMESTAMP
             WHERE id=$9 RETURNING *`,
            [staffNotes || null, user.id, therapistId, offeringId, facilityId, appointment.id, delivery.status, notificationMessage, id]
          );
          await client.query(
            `INSERT INTO notifications (company_id, title, message, type)
             VALUES ($1,'Website request approved',$2,'success')`,
            [request.company_id, `${request.full_name} was assigned to ${resources.therapist.title}. Booking now appears on Bookings by Therapist.`]
          ).catch(() => undefined);
          await client.query("COMMIT");
          return ok(updated.rows[0]);
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
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
