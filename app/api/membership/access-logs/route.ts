import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { withAuth, ok, err } from "@/lib/api-utils";

export async function GET(req: Request) {
  return withAuth(req, async (user) => {
    const admin = user.role === "super_admin";
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 500);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const date = url.searchParams.get("date");
    const memberId = url.searchParams.get("member_id");
    try {
      let where = admin ? "TRUE" : "l.company_id = $2";
      const params: any[] = [];
      let idx = 1;
      if (!admin) { params.push(user.company_id); idx++; }
      if (date) { where += ` AND l.created_at::date = $${idx}`; params.push(date); idx++; }
      if (memberId) { where += ` AND l.member_id = $${idx}`; params.push(parseInt(memberId)); idx++; }
      params.push(limit);
      params.push(offset);
      const result = await pool.query(
        `SELECT l.*, g.name as gate_name, m.full_name as member_name, m.customer_id as member_code
         FROM access_logs l
         LEFT JOIN entry_gates g ON l.gate_id = g.id
         LEFT JOIN membership_members m ON l.member_id = m.id
         WHERE ${where}
         ORDER BY l.created_at DESC LIMIT $${idx} OFFSET $${idx+1}`,
        params
      );
      const countResult = await pool.query(
        `SELECT COUNT(*) FROM access_logs l WHERE ${where.replace(/l\./g, '')}`,
        params.slice(0, -2)
      );
      return ok({ rows: result.rows, total: parseInt(countResult.rows[0].count) });
    } catch (e: any) { return err(e.message); }
  });
}
