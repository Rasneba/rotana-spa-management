import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { withAuth, ok, created, err, badRequest } from "@/lib/api-utils";
import { requirePermission } from "@/lib/permissions";

export async function GET(req: Request) {
  return withAuth(req, async (user) => {
    const { allowed } = await requirePermission(user, "view", "membership_plans");
    if (!allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    try {
      const result = await pool.query(
        `SELECT mp.*,
          (SELECT COUNT(*) FROM membership_members WHERE plan_id = mp.id) as member_count
         FROM membership_plans mp
         WHERE mp.company_id = $1
         ORDER BY mp.type, mp.name`,
        [user.company_id]
      );
      return ok(result.rows);
    } catch (e: any) {
      return err(e.message);
    }
  });
}

export async function POST(req: Request) {
  return withAuth(req, async (user) => {
    const { allowed } = await requirePermission(user, "create", "membership_plans");
    if (!allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    try {
      const body = await req.json();
      const { name, type, description, duration_days, max_members } = body;
      if (!name) return badRequest("Plan name is required");
      const result = await pool.query(
        `INSERT INTO membership_plans (company_id, name, type, description, duration_days, price, max_members)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [user.company_id, name, type || "general", description, duration_days || 30, 0, max_members || null]
      );
      return created(result.rows[0]);
    } catch (e: any) {
      return err(e.message);
    }
  });
}
