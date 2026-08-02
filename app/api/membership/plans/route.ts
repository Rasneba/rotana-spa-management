import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { err, ok, withAuth } from "@/lib/api-utils";
import { requirePermission } from "@/lib/permissions";

export async function GET(req: Request) {
  return withAuth(req, async (user) => {
    const { allowed } = await requirePermission(user, "view", "catalog_offerings");
    if (!allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    try {
      const result = await pool.query(
        `SELECT id, title AS name,
                details->>'offering_code' AS code,
                details->>'category' AS type,
                NULLIF(details->>'validity_days','')::int AS duration_days,
                NULLIF(details->>'usage_limit','')::int AS max_members,
                details->>'description' AS description,
                status='active' AS is_active,
                0::numeric AS price,
                created_at, updated_at
         FROM spa_management_records
         WHERE company_id=$1 AND module_key='catalog/offerings'
           AND details->>'classification'='membership_plan'
           AND deleted_at IS NULL
         ORDER BY title`,
        [user.company_id]
      );
      return ok(result.rows);
    } catch (error) {
      return err(error instanceof Error ? error.message : "Unable to load membership offerings");
    }
  });
}

export async function POST() {
  return NextResponse.json(
    { error: "Membership plans are managed in the classified Offering Master. Use /api/spa/catalog/offerings." },
    { status: 410 }
  );
}
