import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { withAuth, ok, created, err, badRequest } from "@/lib/api-utils";

export async function GET(req: Request) {
  return withAuth(req, async (user) => {
    const admin = user.role === "super_admin";
    try {
      const result = await pool.query(
        `SELECT f.* FROM spa_facilities f
         WHERE $1 = true OR f.company_id = $2
         ORDER BY f.type, f.name`,
        [admin, user.company_id]
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
      const { name, type, capacity, description } = body;
      if (!name) return badRequest("Facility name is required");
      const company_id = admin && body.company_id ? Number(body.company_id) : user.company_id;
      const result = await pool.query(
        `INSERT INTO spa_facilities (company_id, name, type, capacity, description)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [company_id, name, type || 'other', capacity || null, description || null]
      );
      return created(result.rows[0]);
    } catch (e: any) { return err(e.message); }
  });
}

export async function PUT(req: Request) {
  return withAuth(req, async (user) => {
    try {
      const body = await req.json();
      const { id, name, type, capacity, description, is_active } = body;
      if (!id) return badRequest("Facility ID is required");
      const admin = user.role === "super_admin";
      const result = await pool.query(
        `UPDATE spa_facilities SET name=$1, type=$2, capacity=$3, description=$4, is_active=$5
         WHERE id=$6 AND ($7=true OR company_id=$8) RETURNING *`,
        [name, type, capacity, description, is_active, id, admin, user.company_id]
      );
      if (result.rows.length === 0) return badRequest("Facility not found");
      return ok(result.rows[0]);
    } catch (e: any) { return err(e.message); }
  });
}

export async function DELETE(req: Request) {
  return withAuth(req, async (user) => {
    try {
      const { id } = await req.json();
      if (!id) return badRequest("Facility ID is required");
      const admin = user.role === "super_admin";
      const result = await pool.query(
        `DELETE FROM spa_facilities WHERE id=$1 AND ($2=true OR company_id=$3) RETURNING id`,
        [id, admin, user.company_id]
      );
      if (result.rows.length === 0) return badRequest("Facility not found");
      return ok({ deleted: true });
    } catch (e: any) { return err(e.message); }
  });
}
