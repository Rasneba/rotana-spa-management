import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { withAuth, ok, created, err, badRequest } from "@/lib/api-utils";

export async function GET(req: Request) {
  return withAuth(req, async (user) => {
    const admin = user.role === "super_admin";
    try {
      const result = await pool.query(
        `SELECT g.* FROM entry_gates g
         WHERE $1 = true OR g.company_id = $2
         ORDER BY g.name`,
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
      const { name, location, gate_type, reader_type } = body;
      if (!name) return badRequest("Gate name is required");
      const company_id = admin && body.company_id ? Number(body.company_id) : user.company_id;
      const result = await pool.query(
        `INSERT INTO entry_gates (company_id, name, location, gate_type, reader_type)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [company_id, name, location || null, gate_type || 'entry', reader_type || 'rfid']
      );
      return created(result.rows[0]);
    } catch (e: any) { return err(e.message); }
  });
}

export async function PUT(req: Request) {
  return withAuth(req, async (user) => {
    try {
      const body = await req.json();
      const { id, name, location, gate_type, reader_type, is_active } = body;
      if (!id) return badRequest("Gate ID is required");
      const admin = user.role === "super_admin";
      const result = await pool.query(
        `UPDATE entry_gates SET name=$1, location=$2, gate_type=$3, reader_type=$4, is_active=$5
         WHERE id=$6 AND ($7=true OR company_id=$8) RETURNING *`,
        [name, location, gate_type, reader_type, is_active, id, admin, user.company_id]
      );
      if (result.rows.length === 0) return badRequest("Gate not found");
      return ok(result.rows[0]);
    } catch (e: any) { return err(e.message); }
  });
}

export async function DELETE(req: Request) {
  return withAuth(req, async (user) => {
    try {
      const { id } = await req.json();
      if (!id) return badRequest("Gate ID is required");
      const admin = user.role === "super_admin";
      const result = await pool.query(
        `DELETE FROM entry_gates WHERE id=$1 AND ($2=true OR company_id=$3) RETURNING id`,
        [id, admin, user.company_id]
      );
      if (result.rows.length === 0) return badRequest("Gate not found");
      return ok({ deleted: true });
    } catch (e: any) { return err(e.message); }
  });
}
