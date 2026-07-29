import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthUser, unauthorized } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { id } = await params;

  try {
    const isSuper = user.role === "super_admin";
    let query = `
      SELECT u.id, u.name, u.email, u.role_id, u.company_id, c.name as company_name, r.name as role_name,
        u.phone, u.is_active, u.created_at
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN companies c ON u.company_id = c.id
      WHERE u.id = $1
    `;
    const values: any[] = [id];
    if (!isSuper && user.company_id) {
      query += ` AND u.company_id = $2`;
      values.push(user.company_id);
    }
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { id } = await params;

  // Company admins can only update users in their company
  const isSuper = user.role === "super_admin";
  if (!isSuper && user.company_id) {
    const check = await pool.query("SELECT id FROM users WHERE id = $1 AND company_id = $2", [id, user.company_id]);
    if (check.rows.length === 0) {
      return NextResponse.json({ error: "User not found in your company" }, { status: 404 });
    }
  }

  const body = await req.json();

  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  const allowedFields = ["name", "email", "role_id", "phone", "company_id", "is_active"];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      fields.push(`${field} = $${idx}`);
      values.push(body[field]);
      idx++;
    }
  }

  if (body.password) {
    const hashedPassword = await bcrypt.hash(body.password, 10);
    fields.push(`password = $${idx}`);
    values.push(hashedPassword);
    idx++;
  }

  if (fields.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id);

  try {
    const result = await pool.query(
      `UPDATE users SET ${fields.join(", ")} WHERE id = $${idx}
       RETURNING id, name, email, role_id, phone, is_active, created_at`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { id } = await params;

  // Company admins can only deactivate users in their company
  const isSuper = user.role === "super_admin";
  if (!isSuper && user.company_id) {
    const check = await pool.query("SELECT id FROM users WHERE id = $1 AND company_id = $2", [id, user.company_id]);
    if (check.rows.length === 0) {
      return NextResponse.json({ error: "User not found in your company" }, { status: 404 });
    }
  }

  try {
    const result = await pool.query(
      `UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1
       RETURNING id, name, email, is_active`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "User deactivated", user: result.rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
