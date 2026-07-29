import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { withAuth, ok, created, err, badRequest } from "@/lib/api-utils";

export async function GET(req: Request) {
  return withAuth(req, async (user) => {
    const admin = user.role === "super_admin";
    const url = new URL(req.url);
    const date = url.searchParams.get("date");
    const memberId = url.searchParams.get("member_id");
    const active = url.searchParams.get("active");
    try {
      let where = admin ? "TRUE" : "s.company_id = $1";
      const params: any[] = admin ? [] : [user.company_id];
      let idx = admin ? 1 : 2;
      if (date) { where += ` AND s.check_in_at::date = $${idx}`; params.push(date); idx++; }
      if (memberId) { where += ` AND s.member_id = $${idx}`; params.push(parseInt(memberId)); idx++; }
      if (active === 'true') { where += ` AND s.check_out_at IS NULL`; }
      const result = await pool.query(
        `SELECT s.*, m.full_name as member_name, m.customer_id as member_code,
                f.name as facility_name
         FROM visit_sessions s
         LEFT JOIN membership_members m ON s.member_id = m.id
         LEFT JOIN spa_facilities f ON s.facility_id = f.id
         WHERE ${where}
         ORDER BY s.check_in_at DESC`,
        params
      );
      return ok(result.rows);
    } catch (e: any) { return err(e.message); }
  });
}

export async function POST(req: Request) {
  return withAuth(req, async (user) => {
    const admin = user.role === "super_admin";
    try {
      const body = await req.json();
      const { member_id, card_uid, facility_id, source, subscription_id } = body;
      if (!member_id && !card_uid) return badRequest("Member ID or card UID is required");
      const company_id = admin && body.company_id ? Number(body.company_id) : user.company_id;
      const result = await pool.query(
        `INSERT INTO visit_sessions (company_id, member_id, card_uid, facility_id, source, subscription_id)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [company_id, member_id || null, card_uid || null, facility_id || null, source || 'manual', subscription_id || null]
      );
      return created(result.rows[0]);
    } catch (e: any) { return err(e.message); }
  });
}

export async function PUT(req: Request) {
  return withAuth(req, async (user) => {
    try {
      const body = await req.json();
      const { id, check_out_at } = body;
      if (!id) return badRequest("Session ID is required");
      const admin = user.role === "super_admin";
      const checkoutTime = check_out_at || new Date().toISOString();
      const result = await pool.query(
        `UPDATE visit_sessions SET check_out_at=$1,
          duration_minutes = EXTRACT(EPOCH FROM ($1::timestamp - check_in_at)) / 60
         WHERE id=$2 AND check_out_at IS NULL AND ($3=true OR company_id=$4) RETURNING *`,
        [checkoutTime, id, admin, user.company_id]
      );
      if (result.rows.length === 0) return badRequest("Session not found or already checked out");
      return ok(result.rows[0]);
    } catch (e: any) { return err(e.message); }
  });
}
