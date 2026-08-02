import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { withAuth, ok, err } from "@/lib/api-utils";
import { requirePermission } from "@/lib/permissions";

export async function GET(req: Request) {
  return withAuth(req, async (user) => {
    const { allowed } = await requirePermission(user, "view", "membership_payments");
    if (!allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    try {
      const result = await pool.query(
        `SELECT mpay.*, mm.full_name as member_name, mp.name as plan_name, mp.type as plan_type
         FROM membership_payments mpay
         JOIN membership_members mm ON mpay.member_id = mm.id
         JOIN membership_plans mp ON mm.plan_id = mp.id
         WHERE mpay.company_id = $1
         ORDER BY mpay.created_at DESC`,
        [user.company_id]
      );
      return ok(result.rows);
    } catch (e: any) {
      return err(e.message);
    }
  });
}

export async function POST() {
  return NextResponse.json(
    {
      error: "Payments are handled by the separate Sales/POS application. Use a draft Spa Service Order for cashier handoff.",
    },
    { status: 410 }
  );
}
