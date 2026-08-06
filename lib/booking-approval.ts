import pool from "@/lib/db";
import { dispatchCustomerNotification, type NotificationChannel } from "@/lib/notification-dispatch";

export const ACTIVE_BOOKING_STATUSES = ["confirmed", "checked_in"];

type JsonObject = Record<string, unknown>;

function validDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function text(value: unknown, max = 1000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function buildConfirmationMessage(request: JsonObject, startsAt: string, therapistName: string, serviceName: string) {
  const when = new Date(startsAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  return `Dagi Spa booking approved: ${serviceName} at ${request.branch} on ${when}. Therapist: ${therapistName}. Thank you, ${request.full_name}.`;
}

export async function validateResources(companyId: number, therapistId: number, offeringId: number) {
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

export type SpaListRecord = { id: number; title: string; duration_minutes?: number };

export async function listActiveTherapists(companyId: number): Promise<SpaListRecord[]> {
  const result = await pool.query(
    `SELECT id, title FROM spa_management_records
     WHERE company_id=$1 AND module_key='spa/therapists' AND status='active' AND deleted_at IS NULL
     ORDER BY title`,
    [companyId]
  );
  return result.rows;
}

export async function listActiveOfferings(companyId: number, treatment?: string): Promise<SpaListRecord[]> {
  const result = await pool.query(
    `SELECT id, title, COALESCE(NULLIF(details->>'duration_minutes','')::int,60) AS duration_minutes
     FROM spa_management_records
     WHERE company_id=$1 AND module_key='catalog/offerings' AND status='active' AND deleted_at IS NULL
       AND details->>'classification' IN ('spa_service','package')
     ORDER BY title`,
    [companyId]
  );
  const rows: SpaListRecord[] = result.rows;
  if (!treatment) return rows;
  const needle = treatment.trim().toLowerCase();
  if (!needle) return rows;
  const exact = rows.filter((row) => row.title.trim().toLowerCase() === needle);
  if (exact.length > 0) return exact;
  const partial = rows.filter((row) => row.title.toLowerCase().includes(needle));
  return partial.length > 0 ? partial : rows;
}

export async function getActiveTherapist(companyId: number, recordId: number): Promise<SpaListRecord | null> {
  const result = await pool.query(
    `SELECT id, title FROM spa_management_records
     WHERE id=$1 AND company_id=$2 AND module_key='spa/therapists' AND status='active' AND deleted_at IS NULL`,
    [recordId, companyId]
  );
  return result.rows[0] || null;
}

export async function getActiveOffering(companyId: number, recordId: number): Promise<SpaListRecord | null> {
  const result = await pool.query(
    `SELECT id, title, COALESCE(NULLIF(details->>'duration_minutes','')::int,60) AS duration_minutes
     FROM spa_management_records
     WHERE id=$1 AND company_id=$2 AND module_key='catalog/offerings'
       AND details->>'classification' IN ('spa_service','package')
       AND status='active' AND deleted_at IS NULL`,
    [recordId, companyId]
  );
  return result.rows[0] || null;
}

export async function hasConflict(params: { companyId: number; therapistId: number; facilityId: number | null; startsAt: string; endsAt: string; excludeId?: number | null }) {
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

export type ApproveBookingInput = {
  requestId: number;
  companyId: number;
  therapistRecordId: number;
  offeringId: number;
  facilityId?: number | null;
  startsAt?: string;
  endsAt?: string;
  staffNotes?: string | null;
  requestedBy?: number | null;
};

export async function approveBookingRequest(
  input: ApproveBookingInput
): Promise<{ ok: true; request: JsonObject } | { ok: false; error: string }> {
  const requestResult = await pool.query(
    `SELECT * FROM website_booking_requests WHERE id=$1 AND company_id=$2`,
    [input.requestId, input.companyId]
  );
  const request = requestResult.rows[0];
  if (!request) return { ok: false, error: "Website request not found" };
  if (request.status === "confirmed") return { ok: false, error: "Website request is already confirmed" };

  const startsAt = validDate(input.startsAt) ? input.startsAt : new Date(request.preferred_at).toISOString();
  const resources = await validateResources(input.companyId, input.therapistRecordId, input.offeringId);
  if (!resources) return { ok: false, error: "Active therapist or Spa service not found" };

  const endsAt = validDate(input.endsAt)
    ? input.endsAt
    : new Date(new Date(startsAt).getTime() + resources.offering.duration_minutes * 60_000).toISOString();

  const conflict = await hasConflict({
    companyId: input.companyId,
    therapistId: input.therapistRecordId,
    facilityId: input.facilityId || null,
    startsAt,
    endsAt,
    excludeId: request.appointment_id || null,
  });
  if (conflict) return { ok: false, error: conflict };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const staffNotes = text(input.staffNotes, 2000) || request.notes || null;
    const appointmentResult = request.appointment_id
      ? await client.query(
          `UPDATE spa_appointments SET facility_id=$1, offering_id=$2, therapist_record_id=$3, therapist_name=$4,
             guest_name=$5, guest_phone=$6, service_name=$7, starts_at=$8, ends_at=$9, status='confirmed', notes=$10, website_request_id=$11
           WHERE id=$12 AND company_id=$13 RETURNING *`,
          [input.facilityId || null, input.offeringId, input.therapistRecordId, resources.therapist.title, request.full_name, request.phone, resources.offering.title, startsAt, endsAt, staffNotes, input.requestId, request.appointment_id, input.companyId]
        )
      : await client.query(
          `INSERT INTO spa_appointments
            (company_id, booking_kind, facility_id, offering_id, therapist_record_id, therapist_name,
             guest_name, guest_phone, service_name, starts_at, ends_at, status, notes, created_by, website_request_id)
           VALUES ($1,'spa_booking',$2,$3,$4,$5,$6,$7,$8,$9,$10,'confirmed',$11,$12,$13)
           RETURNING *`,
          [input.companyId, input.facilityId || null, input.offeringId, input.therapistRecordId, resources.therapist.title, request.full_name, request.phone, resources.offering.title, startsAt, endsAt, staffNotes, input.requestedBy || null, input.requestId]
        );
    const appointment = appointmentResult.rows[0];
    const notificationMessage = buildConfirmationMessage(request, startsAt, resources.therapist.title, resources.offering.title);
    const channel = (request.notification_channel || "phone") as NotificationChannel;
    const recipient = request.notification_contact || (channel === "email" ? request.email : request.phone);
    const delivery = await dispatchCustomerNotification({ channel, recipient, subject: "Dagi Spa booking approved", message: notificationMessage });
    await client.query(
      `INSERT INTO notification_outbox (company_id, website_request_id, appointment_id, channel, recipient, subject, message, status, provider_response, sent_at)
       VALUES ($1,$2,$3,$4,$5,'Dagi Spa booking approved',$6,$7::text,$8,CASE WHEN $7::text='sent' THEN CURRENT_TIMESTAMP ELSE NULL END)`,
      [input.companyId, input.requestId, appointment.id, channel, recipient, notificationMessage, delivery.status, delivery.providerResponse || null]
    );
    const updated = await client.query(
      `UPDATE website_booking_requests SET status='confirmed', staff_notes=$1, confirmed_by=$2, confirmed_at=CURRENT_TIMESTAMP,
         assigned_therapist_record_id=$3, assigned_offering_id=$4, assigned_facility_id=$5, appointment_id=$6,
         notification_status=$7, notification_message=$8, updated_at=CURRENT_TIMESTAMP
       WHERE id=$9 RETURNING *`,
      [staffNotes || null, input.requestedBy || null, input.therapistRecordId, input.offeringId, input.facilityId || null, appointment.id, delivery.status, notificationMessage, input.requestId]
    );
    await client.query(
      `INSERT INTO notifications (company_id, title, message, type)
       VALUES ($1,'Website request approved',$2,'success')`,
      [input.companyId, `${request.full_name} was assigned to ${resources.therapist.title}. Booking now appears on Bookings by Therapist.`]
    ).catch(() => undefined);
    await client.query("COMMIT");
    return { ok: true, request: updated.rows[0] };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    const message = error instanceof Error ? error.message : "Unable to approve website request";
    return { ok: false, error: message };
  } finally {
    client.release();
  }
}

export async function declineBookingRequest(requestId: number, companyId: number, staffNotes?: string | null, requestedBy?: number | null): Promise<{ ok: true; request: JsonObject } | { ok: false; error: string }> {
  const result = await pool.query(
    `UPDATE website_booking_requests
     SET status='declined', staff_notes=COALESCE($1, staff_notes), confirmed_by=COALESCE($2, confirmed_by), updated_at=CURRENT_TIMESTAMP
     WHERE id=$3 AND company_id=$4 AND status IN ('new','contacted') RETURNING *`,
    [staffNotes || null, requestedBy || null, requestId, companyId]
  );
  if (!result.rows[0]) return { ok: false, error: "Website request not found or already resolved" };
  return { ok: true, request: result.rows[0] };
}

export async function resolveSpaRecord(companyId: number, moduleKey: string, ref: string): Promise<{ id: number; title: string } | { error: string }> {
  const trimmed = ref.trim();
  if (!trimmed) return { error: "Missing reference" };
  if (/^\d+$/.test(trimmed)) {
    const byId = await pool.query(
      `SELECT id, title FROM spa_management_records
       WHERE id=$1 AND company_id=$2 AND module_key=$3 AND status='active' AND deleted_at IS NULL`,
      [Number(trimmed), companyId, moduleKey]
    );
    if (byId.rows[0]) return byId.rows[0];
  }
  const byCode = await pool.query(
    `SELECT id, title FROM spa_management_records
     WHERE company_id=$1 AND module_key=$2 AND status='active' AND deleted_at IS NULL
       AND LOWER(details->>'offering_code')=LOWER($3)`,
    [companyId, moduleKey, trimmed]
  );
  if (byCode.rows.length === 1) return byCode.rows[0];
  const byName = await pool.query(
    `SELECT id, title FROM spa_management_records
     WHERE company_id=$1 AND module_key=$2 AND status='active' AND deleted_at IS NULL
       AND title ILIKE $3`,
    [companyId, moduleKey, `%${trimmed}%`]
  );
  if (byName.rows.length === 1) return byName.rows[0];
  if (byName.rows.length > 1) return { error: `Multiple matches for "${trimmed}": ${byName.rows.map((row) => row.title).join(", ")}. Use the record ID or code.` };
  return { error: `No active record found for "${trimmed}"` };
}
