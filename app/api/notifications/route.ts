import { NextResponse } from "next/server";
import { withAuth, ok, created, err } from "@/lib/api-utils";
import { requirePermission } from "@/lib/permissions";
import pool from "@/lib/db";

export async function GET(req: Request) {
  return withAuth(req, async (user) => {
    const { allowed } = await requirePermission(user, "view", "notifications");
    if (!allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    const isAdmin = user.role === "super_admin";
    const url = new URL(req.url);
    const is_read = url.searchParams.get("is_read");
    try {
      let query = `SELECT n.* FROM notifications n WHERE 1=1`;
      const params: any[] = [];
      let idx = 1;
      if (!isAdmin) {
        query += ` AND n.company_id = $${idx}`;
        params.push(user.company_id);
        idx++;
      }
      if (is_read !== null) {
        query += ` AND n.is_read = $${idx}`;
        params.push(is_read === "true");
        idx++;
      }
      query += ` ORDER BY n.created_at DESC`;
      const result = await pool.query(query, params);
      return ok(result.rows);
    } catch (e: any) { return err(e.message); }
  });
}

export async function POST(req: Request) {
  return withAuth(req, async (user) => {
    const { allowed } = await requirePermission(user, "create", "notifications");
    if (!allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    try {
      const { employee_id, title, message, type } = await req.json();
      const result = await pool.query(
        `INSERT INTO notifications (employee_id, title, message, type)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [employee_id, title, message, type || "info"]
      );
      return created(result.rows[0]);
    } catch (e: any) { return err(e.message); }
  });
}
