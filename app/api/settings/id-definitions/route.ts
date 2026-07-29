import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { withAuth, ok, created, err, notFound, badRequest, deleted, isAdmin } from "@/lib/api-utils";
import { requirePermission } from "@/lib/permissions";

export async function GET(req: Request) {
  return withAuth(req, async (user) => {
    const { allowed, error } = await requirePermission(user, "view", "id_definitions");
    if (!allowed) return NextResponse.json(error, { status: 403 });
    const admin = user.role === "super_admin";
    try {
      const result = await pool.query(
        `SELECT d.*
         FROM id_definitions d
         WHERE $1 = true OR d.company_id = $2
         ORDER BY d.entity_type`,
        [admin, user.company_id]
      );
      return ok(result.rows);
    } catch (e: any) { return err(e.message); }
  });
}

export async function POST(req: Request) {
  return withAuth(req, async (user) => {
    const { allowed, error } = await requirePermission(user, "create", "id_definitions");
    if (!allowed) return NextResponse.json(error, { status: 403 });
    const admin = user.role === "super_admin";
    try {
      const body = await req.json();
      const { entity_type, prefix, suffix, separator, pad_length, start_from, reset_type, pattern, description } = body;
      if (!entity_type || !prefix) return badRequest("Entity type and prefix are required");
      const company_id = admin && body.company_id ? Number(body.company_id) : user.company_id;
      const result = await pool.query(
        `INSERT INTO id_definitions (company_id, entity_type, prefix, suffix, separator, pad_length, start_from, reset_type, pattern, description)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [company_id, entity_type, prefix, suffix || '', separator || '-', pad_length || 5, start_from || 1, reset_type || 'never', pattern || '{PREFIX}{SEP}{SEQ}', description || null]
      );
      return created(result.rows[0]);
    } catch (e: any) { return err(e.message); }
  });
}
