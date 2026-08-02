import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { withAuth, ok, created, err, badRequest, notFound } from "@/lib/api-utils";
import { requirePermission } from "@/lib/permissions";

const ACTIVE_STATUSES = ["confirmed", "checked_in"];
const APPOINTMENT_STATUSES = ["confirmed", "checked_in", "completed", "no_show", "cancelled"];

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected server error";
}

function dateRange(req: Request) {
  const params = new URL(req.url).searchParams;
  const from = params.get("from");
  const to = params.get("to");

  if (!from || !to || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) {
    return null;
  }

  return { from, to };
}

export async function GET(req: Request) {
  return withAuth(req, async (user) => {
    const { allowed } = await requirePermission(user, "view", "membership_appointments");
    if (!allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });

    const range = dateRange(req);
    if (!range) return badRequest("A valid from and to date are required");

    try {
      const isSuperAdmin = user.role === "super_admin";
      const result = await pool.query(
        `SELECT a.*, m.full_name AS member_name, m.customer_id AS member_code,
                f.name AS facility_name, f.type AS facility_type,
                COALESCE(o.title,r.name) AS offering_name,
                COALESCE(NULLIF(o.details->>'duration_minutes','')::int,r.duration_minutes) AS offering_duration_minutes
         FROM spa_appointments a
         LEFT JOIN membership_members m ON m.id=a.member_id
         LEFT JOIN spa_facilities f ON f.id=a.facility_id
         LEFT JOIN spa_management_records o
           ON o.id=a.offering_id AND o.module_key='catalog/offerings' AND o.deleted_at IS NULL
         LEFT JOIN rate_cards r ON r.id=a.rate_card_id
         WHERE a.starts_at < $1::timestamp
           AND a.ends_at > $2::timestamp
           AND ($3 = true OR a.company_id = $4)
         ORDER BY a.starts_at ASC, a.created_at ASC`,
        [`${range.to}T23:59:59.999`, `${range.from}T00:00:00`, isSuperAdmin, user.company_id]
      );
      return ok(result.rows);
    } catch (e: unknown) {
      return err(errorMessage(e));
    }
  });
}

export async function POST(req: Request) {
  return withAuth(req, async (user) => {
    const { allowed } = await requirePermission(user, "create", "membership_appointments");
    if (!allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });

    try {
      const body = await req.json();
      const {
        member_id,
        facility_id,
        rate_card_id,
        offering_id,
        guest_name,
        guest_phone,
        service_name,
        starts_at,
        ends_at,
        notes,
      } = body;

      if (!service_name?.trim()) return badRequest("Service is required");
      if (!facility_id) return badRequest("A facility is required");
      if (!member_id && !guest_name?.trim()) return badRequest("Select a member or enter a guest name");
      if (!starts_at || !ends_at || Number.isNaN(Date.parse(starts_at)) || Number.isNaN(Date.parse(ends_at))) {
        return badRequest("A valid start and end time are required");
      }
      if (new Date(ends_at) <= new Date(starts_at)) return badRequest("End time must be after the start time");

      const isSuperAdmin = user.role === "super_admin";
      const companyId = isSuperAdmin && body.company_id ? Number(body.company_id) : user.company_id;
      if (!companyId) return badRequest("Company is required");

      const facility = await pool.query(
        `SELECT id, capacity FROM spa_facilities
         WHERE id = $1 AND company_id = $2 AND is_active = true`,
        [facility_id, companyId]
      );
      if (facility.rows.length === 0) return notFound("Facility");

      if (member_id) {
        const member = await pool.query(
          "SELECT id FROM membership_members WHERE id = $1 AND company_id = $2",
          [member_id, companyId]
        );
        if (member.rows.length === 0) return notFound("Member");
      }

      if (offering_id) {
        const offering = await pool.query(
          `SELECT id FROM spa_management_records
           WHERE id=$1 AND company_id=$2 AND module_key='catalog/offerings'
             AND details->>'classification' IN ('spa_service','gym_service','package')
             AND status='active' AND deleted_at IS NULL`,
          [offering_id, companyId]
        );
        if (offering.rows.length === 0) return notFound("Offering");
      }

      if (rate_card_id) {
        const rate = await pool.query(
          "SELECT id FROM rate_cards WHERE id = $1 AND company_id = $2 AND is_active = true",
          [rate_card_id, companyId]
        );
        if (rate.rows.length === 0) return notFound("Rate card");
      }

      // Facilities with a defined capacity can accept that many concurrent bookings.
      // A room without a capacity is treated as a single-booking space.
      const capacity = Number(facility.rows[0].capacity) || 1;
      const overlapping = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM spa_appointments
         WHERE company_id = $1 AND facility_id = $2
           AND status = ANY($3::varchar[])
           AND starts_at < $4::timestamp AND ends_at > $5::timestamp`,
        [companyId, facility_id, ACTIVE_STATUSES, ends_at, starts_at]
      );
      if (overlapping.rows[0].count >= capacity) {
        return badRequest("This facility is fully booked for the selected time");
      }

      const result = await pool.query(
        `INSERT INTO spa_appointments
          (company_id, member_id, facility_id, rate_card_id, offering_id,
           guest_name, guest_phone, service_name, starts_at, ends_at, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING *`,
        [
          companyId,
          member_id || null,
          facility_id,
          rate_card_id || null,
          offering_id || null,
          guest_name?.trim() || null,
          guest_phone?.trim() || null,
          service_name.trim(),
          starts_at,
          ends_at,
          notes?.trim() || null,
          user.id,
        ]
      );
      return created(result.rows[0]);
    } catch (e: unknown) {
      return err(errorMessage(e));
    }
  });
}

export async function PUT(req: Request) {
  return withAuth(req, async (user) => {
    const { allowed } = await requirePermission(user, "edit", "membership_appointments");
    if (!allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });

    try {
      const { id, status, notes } = await req.json();
      if (!id) return badRequest("Appointment ID is required");
      if (status && !APPOINTMENT_STATUSES.includes(status)) return badRequest("Invalid appointment status");

      const isSuperAdmin = user.role === "super_admin";
      const result = await pool.query(
        `UPDATE spa_appointments
         SET status = COALESCE($1, status), notes = COALESCE($2, notes)
         WHERE id = $3 AND ($4 = true OR company_id = $5)
         RETURNING *`,
        [status || null, typeof notes === "string" ? notes.trim() || null : null, id, isSuperAdmin, user.company_id]
      );
      if (result.rows.length === 0) return notFound("Appointment");
      return ok(result.rows[0]);
    } catch (e: unknown) {
      return err(errorMessage(e));
    }
  });
}
