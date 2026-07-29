import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { withAuth, ok, created, err, badRequest } from "@/lib/api-utils";
import crypto from "crypto";

export async function GET(req: Request) {
  return withAuth(req, async (user) => {
    const admin = user.role === "super_admin";
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    try {
      let where = admin ? "TRUE" : "p.company_id = $1";
      const params: any[] = admin ? [] : [user.company_id];
      let idx = admin ? 1 : 2;
      if (status) { where += ` AND p.status = $${idx}`; params.push(status); idx++; }
      const result = await pool.query(
        `SELECT p.*, m.full_name as member_name, m.customer_id as member_code
         FROM qr_passes p
         LEFT JOIN membership_members m ON p.member_id = m.id
         WHERE ${where}
         ORDER BY p.created_at DESC`,
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
      const { member_id, pass_type, expiry_date, max_uses } = body;
      if (!expiry_date) return badRequest("Expiry date is required");
      const company_id = admin && body.company_id ? Number(body.company_id) : user.company_id;
      const token = crypto.randomBytes(16).toString('hex');
      const result = await pool.query(
        `INSERT INTO qr_passes (company_id, member_id, pass_type, token, expiry_date, max_uses)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [company_id, member_id || null, pass_type || 'day_pass', token, expiry_date, max_uses || 1]
      );
      return created(result.rows[0]);
    } catch (e: any) { return err(e.message); }
  });
}

export async function PUT(req: Request) {
  return withAuth(req, async (user) => {
    try {
      const body = await req.json();
      const { id, status } = body;
      if (!id) return badRequest("Pass ID is required");
      const admin = user.role === "super_admin";
      const result = await pool.query(
        `UPDATE qr_passes SET status=$1 WHERE id=$2 AND ($3=true OR company_id=$4) RETURNING *`,
        [status, id, admin, user.company_id]
      );
      if (result.rows.length === 0) return badRequest("Pass not found");
      return ok(result.rows[0]);
    } catch (e: any) { return err(e.message); }
  });
}
