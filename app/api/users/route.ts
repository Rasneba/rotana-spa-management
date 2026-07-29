import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { withAuth, ok, created, err } from "@/lib/api-utils";
import { requirePermission } from "@/lib/permissions";
import bcrypt from "bcryptjs";

export async function GET(req: Request) {
  return withAuth(req, async (user) => {
    const { allowed } = await requirePermission(user, "view", "users");
    if (!allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });

    try {
      const isSuper = user.role === "super_admin";
      let query = `
        SELECT u.id, u.name, u.email, u.company_id, c.name as company_name,
          r.name as role_name, u.phone, u.is_active, u.created_at
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        LEFT JOIN companies c ON u.company_id = c.id
      `;
      const params: any[] = [];
      if (!isSuper && user.company_id) {
        query += ` WHERE u.company_id = $1`;
        params.push(user.company_id);
      }
      query += ` ORDER BY u.id DESC`;
      const result = await pool.query(query, params);
      return ok(result.rows);
    } catch (e: any) {
      return err(e.message);
    }
  });
}

export async function POST(req: Request) {
  return withAuth(req, async (user) => {
    const { allowed } = await requirePermission(user, "create", "users");
    if (!allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });

    try {
      const { name, email, password, role_id, phone, company_id } = await req.json();
      const hashedPassword = await bcrypt.hash(password, 10);

      const result = await pool.query(
        `INSERT INTO users (name, email, password, role_id, phone, company_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, name, email, role_id, phone, company_id, is_active, created_at`,
        [name, email, hashedPassword, role_id, phone, company_id || user.company_id]
      );

      return created(result.rows[0]);
    } catch (e: any) {
      return err(e.message);
    }
  });
}
