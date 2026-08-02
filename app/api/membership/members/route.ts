import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { withAuth, ok, created, err, badRequest } from "@/lib/api-utils";
import { requirePermission } from "@/lib/permissions";
import { generateSequentialId } from "@/lib/id-generator";

const CUSTOMER_CLASSIFICATIONS = ["customer", "member", "vip", "corporate", "guest"];

export async function GET(req: Request) {
  return withAuth(req, async (user) => {
    const { allowed } = await requirePermission(user, "view", "membership_members");
    if (!allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    try {
      const result = await pool.query(
        `SELECT mm.*,
                COALESCE(o.title,mp.name) AS plan_name,
                COALESCE(o.details->>'classification',mp.type) AS plan_type,
                COALESCE(NULLIF(o.details->>'validity_days','')::int,mp.duration_days) AS plan_duration,
                o.details->>'offering_code' AS offering_code
         FROM membership_members mm
         LEFT JOIN spa_management_records o
           ON o.id=mm.offering_id AND o.module_key='catalog/offerings' AND o.deleted_at IS NULL
         LEFT JOIN membership_plans mp ON mm.plan_id=mp.id
         WHERE mm.company_id=$1
         ORDER BY mm.created_at DESC`,
        [user.company_id]
      );
      return ok(result.rows);
    } catch (error) {
      return err(error instanceof Error ? error.message : "Unable to load customers");
    }
  });
}

export async function POST(req: Request) {
  return withAuth(req, async (user) => {
    const { allowed } = await requirePermission(user, "create", "membership_members");
    if (!allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    try {
      const body = await req.json();
      const {
        customer_id,
        offering_id,
        full_name,
        phone,
        email,
        id_number,
        address,
        photo_url,
        start_date,
        end_date,
        notes,
      } = body;
      if (!full_name?.trim()) return badRequest("Customer name is required");
      if (!user.company_id) return badRequest("A company is required");

      // A member is a classified customer. Reuse the existing customer rather
      // than creating duplicate records from different registration screens.
      const duplicate = await pool.query(
        `SELECT id, customer_id, full_name, phone, email
         FROM membership_members
         WHERE company_id=$1 AND (
           ($2::text IS NOT NULL AND $2<>'' AND LOWER(email)=LOWER($2)) OR
           ($3::text IS NOT NULL AND $3<>'' AND phone=$3) OR
           ($4::text IS NOT NULL AND $4<>'' AND id_number=$4)
         )
         ORDER BY id LIMIT 1`,
        [user.company_id, email?.trim() || null, phone?.trim() || null, id_number?.trim() || null]
      );
      if (duplicate.rows.length > 0) {
        return NextResponse.json(
          { error: "This customer already exists. Open the existing customer record instead of registering again.", existing_customer: duplicate.rows[0] },
          { status: 409 }
        );
      }

      let offering: { id: number; validity_days: number } | null = null;
      if (offering_id) {
        const offeringResult = await pool.query(
          `SELECT id, COALESCE(NULLIF(details->>'validity_days','')::int,30) AS validity_days
           FROM spa_management_records
           WHERE id=$1 AND company_id=$2 AND module_key='catalog/offerings'
             AND details->>'classification' IN ('membership_plan','package','access_pass')
             AND status='active' AND deleted_at IS NULL`,
          [offering_id, user.company_id]
        );
        if (offeringResult.rows.length === 0) return badRequest("Active membership/package offering not found");
        offering = offeringResult.rows[0];
      }

      const classification = CUSTOMER_CLASSIFICATIONS.includes(body.classification)
        ? body.classification
        : offering ? "member" : "customer";
      const cid = customer_id || await generateSequentialId("membership_members", "customer_id", "CUS");
      const start = start_date || new Date().toISOString().slice(0, 10);
      const duration = offering?.validity_days || 36_500;

      const result = await pool.query(
        `INSERT INTO membership_members
          (company_id, customer_id, offering_id, full_name, phone, email,
           id_number, address, photo_url, classification, start_date, end_date, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
                 COALESCE($12::date,$11::date+$13::int),$14)
         RETURNING *`,
        [
          user.company_id,
          cid,
          offering?.id || null,
          full_name.trim(),
          phone?.trim() || null,
          email?.trim() || null,
          id_number?.trim() || null,
          address?.trim() || null,
          photo_url || null,
          classification,
          start,
          end_date || null,
          duration,
          notes?.trim() || null,
        ]
      );
      return created(result.rows[0]);
    } catch (error) {
      return err(error instanceof Error ? error.message : "Unable to register customer");
    }
  });
}
