import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { badRequest, created, err, ok, withAuth } from "@/lib/api-utils";
import { can, requirePermission } from "@/lib/permissions";

const ACTIVE_STATUSES = ["confirmed", "checked_in"];
const BOOKING_STATUSES = ["confirmed", "checked_in", "completed", "no_show", "cancelled"];
type JsonObject = Record<string, unknown>;

type ValidatedResources = {
  therapist: { id: number; title: string };
  offering: { id: number; title: string; duration_minutes: number };
};

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorResponse(error: unknown) {
  const code = isObject(error) && typeof error.code === "string" ? error.code : "";
  if (code === "42703" || code === "42P01") {
    return NextResponse.json({ error: "Apply db-migration-v37.sql before using the therapist booking board." }, { status: 503 });
  }
  return err(error instanceof Error ? error.message : "Unable to manage Spa bookings");
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

async function validateResources(companyId: number, therapistId: number, offeringId: number): Promise<ValidatedResources | null> {
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

async function hasConflict(params: {
  companyId: number;
  therapistId: number;
  facilityId: number | null;
  startsAt: string;
  endsAt: string;
  excludeId?: number;
}): Promise<string | null> {
  const therapistConflict = await pool.query(
    `SELECT id FROM spa_appointments
     WHERE company_id=$1 AND booking_kind='spa_booking'
       AND therapist_record_id=$2 AND status=ANY($3::varchar[])
       AND starts_at<$4::timestamp AND ends_at>$5::timestamp
       AND ($6::int IS NULL OR id<>$6)
     LIMIT 1`,
    [params.companyId, params.therapistId, ACTIVE_STATUSES, params.endsAt, params.startsAt, params.excludeId || null]
  );
  if (therapistConflict.rows.length > 0) return "This therapist already has a booking during the selected time";

  if (params.facilityId) {
    const facility = await pool.query(
      `SELECT capacity FROM spa_facilities WHERE id=$1 AND company_id=$2 AND is_active=true`,
      [params.facilityId, params.companyId]
    );
    if (!facility.rows[0]) return "Active treatment room not found";
    const capacity = Number(facility.rows[0].capacity) || 1;
    const roomConflict = await pool.query(
      `SELECT COUNT(*)::int AS count FROM spa_appointments
       WHERE company_id=$1 AND facility_id=$2 AND status=ANY($3::varchar[])
         AND starts_at<$4::timestamp AND ends_at>$5::timestamp
         AND ($6::int IS NULL OR id<>$6)`,
      [params.companyId, params.facilityId, ACTIVE_STATUSES, params.endsAt, params.startsAt, params.excludeId || null]
    );
    if (Number(roomConflict.rows[0].count) >= capacity) return "This treatment room is fully booked during the selected time";
  }
  return null;
}

export async function GET(req: Request) {
  return withAuth(req, async (user) => {
    const permission = await requirePermission(user, "view", "spa_bookings");
    if (!permission.allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    try {
      const url = new URL(req.url);
      const date = url.searchParams.get("date");
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return badRequest("A valid booking date is required");
      const values: unknown[] = [date];
      let ownership = "a.starts_at::date=$1::date AND a.booking_kind='spa_booking'";
      if (user.role !== "super_admin") {
        values.push(user.company_id);
        ownership += ` AND a.company_id=$${values.length}`;
      }
      const result = await pool.query(
        `SELECT a.*, m.full_name AS member_name, m.customer_id AS member_code,
                f.name AS facility_name, o.title AS offering_name,
                o.details->>'offering_code' AS offering_code,
                COALESCE(NULLIF(o.details->>'duration_minutes','')::int,
                         EXTRACT(EPOCH FROM (a.ends_at-a.starts_at))/60)::int AS duration_minutes
         FROM spa_appointments a
         LEFT JOIN membership_members m ON m.id=a.member_id
         LEFT JOIN spa_facilities f ON f.id=a.facility_id
         LEFT JOIN spa_management_records o ON o.id=a.offering_id
         WHERE ${ownership}
         ORDER BY a.therapist_name,a.starts_at`,
        values
      );
      const [canCreate, canEdit, canDelete] = await Promise.all([
        can(user, "create", "spa_bookings"),
        can(user, "edit", "spa_bookings"),
        can(user, "delete", "spa_bookings"),
      ]);
      return ok({ bookings: result.rows, capabilities: { create: canCreate, edit: canEdit, delete: canDelete } });
    } catch (error) {
      return errorResponse(error);
    }
  });
}

export async function POST(req: Request) {
  return withAuth(req, async (user) => {
    const permission = await requirePermission(user, "create", "spa_bookings");
    if (!permission.allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    try {
      const body: unknown = await req.json();
      if (!isObject(body)) return badRequest("Invalid booking request");
      const companyId = user.role === "super_admin" && Number(body.company_id)>0 ? Number(body.company_id) : user.company_id;
      if (!companyId) return badRequest("A company is required");
      const therapistId = Number(body.therapist_record_id);
      const offeringId = Number(body.offering_id);
      if (!therapistId || !offeringId) return badRequest("Therapist and service are required");
      const resources = await validateResources(companyId, therapistId, offeringId);
      if (!resources) return badRequest("Active therapist or Spa service not found");
      if (!validDate(body.starts_at)) return badRequest("A valid start time is required");
      const startsAt = body.starts_at;
      const endsAt = validDate(body.ends_at)
        ? body.ends_at
        : new Date(new Date(startsAt).getTime()+resources.offering.duration_minutes*60_000).toISOString();
      if (new Date(endsAt)<=new Date(startsAt)) return badRequest("End time must be after start time");
      const memberId = Number(body.member_id) || null;
      const guestName = typeof body.guest_name==="string" ? body.guest_name.trim() : "";
      if (!memberId && !guestName) return badRequest("Select a customer or enter a walk-in name");
      if (memberId) {
        const member = await pool.query(`SELECT id FROM membership_members WHERE id=$1 AND company_id=$2`,[memberId,companyId]);
        if (!member.rows[0]) return badRequest("Customer not found");
      }
      const facilityId = Number(body.facility_id)||null;
      const conflict = await hasConflict({ companyId,therapistId,facilityId,startsAt,endsAt });
      if (conflict) return badRequest(conflict);

      const result = await pool.query(
        `INSERT INTO spa_appointments
          (company_id,booking_kind,member_id,facility_id,offering_id,
           therapist_record_id,therapist_name,guest_name,guest_phone,
           service_name,starts_at,ends_at,status,notes,created_by)
         VALUES ($1,'spa_booking',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'confirmed',$12,$13)
         RETURNING *`,
        [companyId,memberId,facilityId,offeringId,therapistId,resources.therapist.title,
          guestName||null,typeof body.guest_phone==="string"?body.guest_phone.trim()||null:null,
          resources.offering.title,startsAt,endsAt,typeof body.notes==="string"?body.notes.trim()||null:null,user.id]
      );
      return created(result.rows[0]);
    } catch (error) {
      return errorResponse(error);
    }
  });
}

export async function PUT(req: Request) {
  return withAuth(req, async (user) => {
    const permission = await requirePermission(user, "edit", "spa_bookings");
    if (!permission.allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    try {
      const body: unknown = await req.json();
      if (!isObject(body)) return badRequest("Invalid booking request");
      const id = Number(body.id);
      if (!id) return badRequest("Booking ID is required");
      const existingValues: unknown[]=[id];
      let ownership="id=$1 AND booking_kind='spa_booking'";
      if(user.role!=="super_admin"){existingValues.push(user.company_id);ownership+=` AND company_id=$${existingValues.length}`;}
      const existingResult=await pool.query(`SELECT * FROM spa_appointments WHERE ${ownership}`,existingValues);
      if(!existingResult.rows[0]) return NextResponse.json({error:"Spa booking not found"},{status:404});
      const existing=existingResult.rows[0];
      const companyId=existing.company_id;
      const therapistId=Number(body.therapist_record_id||existing.therapist_record_id);
      const offeringId=Number(body.offering_id||existing.offering_id);
      const resources=await validateResources(companyId,therapistId,offeringId);
      if(!resources) return badRequest("Active therapist or Spa service not found");
      const startsAt=validDate(body.starts_at)?body.starts_at:new Date(existing.starts_at).toISOString();
      const endsAt=validDate(body.ends_at)?body.ends_at:new Date(new Date(startsAt).getTime()+resources.offering.duration_minutes*60_000).toISOString();
      if(new Date(endsAt)<=new Date(startsAt)) return badRequest("End time must be after start time");
      const status=typeof body.status==="string"&&BOOKING_STATUSES.includes(body.status)?body.status:existing.status;
      const memberId=body.member_id===null?null:Number(body.member_id||existing.member_id)||null;
      const guestName=typeof body.guest_name==="string"?body.guest_name.trim():existing.guest_name;
      if(!memberId&&!guestName) return badRequest("Select a customer or enter a walk-in name");
      const facilityId=body.facility_id===null?null:Number(body.facility_id||existing.facility_id)||null;
      if(ACTIVE_STATUSES.includes(status)){
        const conflict=await hasConflict({companyId,therapistId,facilityId,startsAt,endsAt,excludeId:id});
        if(conflict) return badRequest(conflict);
      }
      const result=await pool.query(
        `UPDATE spa_appointments SET member_id=$1,facility_id=$2,offering_id=$3,
          therapist_record_id=$4,therapist_name=$5,guest_name=$6,guest_phone=$7,
          service_name=$8,starts_at=$9,ends_at=$10,status=$11,notes=$12
         WHERE id=$13 RETURNING *`,
        [memberId,facilityId,offeringId,therapistId,resources.therapist.title,guestName||null,
          typeof body.guest_phone==="string"?body.guest_phone.trim()||null:existing.guest_phone,
          resources.offering.title,startsAt,endsAt,status,
          typeof body.notes==="string"?body.notes.trim()||null:existing.notes,id]
      );
      return ok(result.rows[0]);
    } catch(error){return errorResponse(error);}
  });
}

export async function DELETE(req: Request) {
  return withAuth(req, async (user) => {
    const permission=await requirePermission(user,"delete","spa_bookings");
    if(!permission.allowed)return NextResponse.json({error:"Permission denied"},{status:403});
    try{
      const body:unknown=await req.json();
      if(!isObject(body))return badRequest("Invalid booking request");
      const id=Number(body.id);if(!id)return badRequest("Booking ID is required");
      const values:unknown[]=[id];let ownership="id=$1 AND booking_kind='spa_booking'";
      if(user.role!=="super_admin"){values.push(user.company_id);ownership+=` AND company_id=$${values.length}`;}
      const result=await pool.query(`UPDATE spa_appointments SET status='cancelled' WHERE ${ownership} RETURNING *`,values);
      if(!result.rows[0])return NextResponse.json({error:"Spa booking not found"},{status:404});
      return ok(result.rows[0]);
    }catch(error){return errorResponse(error);}
  });
}
