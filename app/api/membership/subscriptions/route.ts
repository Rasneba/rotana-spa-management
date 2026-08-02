import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { withAuth, ok, created, err, badRequest } from "@/lib/api-utils";

export async function GET(req: Request) {
  return withAuth(req, async (user) => {
    const admin = user.role === "super_admin";
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const memberId = url.searchParams.get("member_id");
    try {
      let where = admin ? "TRUE" : "s.company_id = $1";
      const params: any[] = admin ? [] : [user.company_id];
      let idx = admin ? 1 : 2;
      if (status) { where += ` AND s.status = $${idx}`; params.push(status); idx++; }
      if (memberId) { where += ` AND s.member_id = $${idx}`; params.push(parseInt(memberId)); idx++; }
      const result = await pool.query(
        `SELECT s.*, m.full_name as member_name, m.customer_id as member_code,
                p.name as plan_name, p.type as plan_type
         FROM subscriptions s
         LEFT JOIN membership_members m ON s.member_id = m.id
         LEFT JOIN membership_plans p ON s.plan_id = p.id
         WHERE ${where}
         ORDER BY s.created_at DESC`,
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
      const { member_id, plan_id, start_date, end_date, billing_cycle, auto_renew } = body;
      if (!member_id || !end_date) return badRequest("Member and end date are required");
      const company_id = admin && body.company_id ? Number(body.company_id) : user.company_id;
      const sd = start_date || new Date().toISOString().split('T')[0];
      const result = await pool.query(
        `INSERT INTO subscriptions (company_id, member_id, plan_id, start_date, end_date, billing_cycle, amount, auto_renew)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [company_id, member_id, plan_id || null, sd, end_date, billing_cycle || 'monthly', 0, auto_renew || false]
      );
      return created(result.rows[0]);
    } catch (e: any) { return err(e.message); }
  });
}

export async function PUT(req: Request) {
  return withAuth(req, async (user) => {
    try {
      const body = await req.json();
      const { id, plan_id, end_date, billing_cycle, status, auto_renew } = body;
      if (!id) return badRequest("Subscription ID is required");
      const admin = user.role === "super_admin";
      const result = await pool.query(
        `UPDATE subscriptions SET plan_id=$1, end_date=$2, billing_cycle=$3, status=$4, auto_renew=$5
         WHERE id=$6 AND ($7=true OR company_id=$8) RETURNING *`,
        [plan_id, end_date, billing_cycle, status, auto_renew, id, admin, user.company_id]
      );
      if (result.rows.length === 0) return badRequest("Subscription not found");
      return ok(result.rows[0]);
    } catch (e: any) { return err(e.message); }
  });
}
