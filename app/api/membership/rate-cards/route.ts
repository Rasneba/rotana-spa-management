import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { withAuth, ok, created, err, badRequest } from "@/lib/api-utils";

export async function GET(req: Request) {
  return withAuth(req, async (user) => {
    const admin = user.role === "super_admin";
    const url = new URL(req.url);
    const serviceType = url.searchParams.get("service_type");
    try {
      let where = admin ? "TRUE" : "r.company_id = $1";
      const params: any[] = admin ? [] : [user.company_id];
      let idx = admin ? 1 : 2;
      if (serviceType) { where += ` AND r.service_type = $${idx}`; params.push(serviceType); idx++; }
      const result = await pool.query(
        `SELECT r.*, f.name as facility_name
         FROM rate_cards r
         LEFT JOIN spa_facilities f ON r.facility_id = f.id
         WHERE ${where}
         ORDER BY r.service_type, r.name`,
        params
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
      const { name, facility_id, service_type, price, currency, duration_minutes } = body;
      if (!name || !service_type) return badRequest("Name and service type are required");
      const company_id = admin && body.company_id ? Number(body.company_id) : user.company_id;
      const result = await pool.query(
        `INSERT INTO rate_cards (company_id, name, facility_id, service_type, price, currency, duration_minutes)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [company_id, name, facility_id || null, service_type, price || 0, currency || 'ETB', duration_minutes || null]
      );
      return created(result.rows[0]);
    } catch (e: any) { return err(e.message); }
  });
}

export async function PUT(req: Request) {
  return withAuth(req, async (user) => {
    try {
      const body = await req.json();
      const { id, name, facility_id, service_type, price, currency, duration_minutes, is_active } = body;
      if (!id) return badRequest("Rate card ID is required");
      const admin = user.role === "super_admin";
      const result = await pool.query(
        `UPDATE rate_cards SET name=$1, facility_id=$2, service_type=$3, price=$4, currency=$5, duration_minutes=$6, is_active=$7
         WHERE id=$8 AND ($9=true OR company_id=$10) RETURNING *`,
        [name, facility_id, service_type, price, currency, duration_minutes, is_active, id, admin, user.company_id]
      );
      if (result.rows.length === 0) return badRequest("Rate card not found");
      return ok(result.rows[0]);
    } catch (e: any) { return err(e.message); }
  });
}

export async function DELETE(req: Request) {
  return withAuth(req, async (user) => {
    try {
      const { id } = await req.json();
      if (!id) return badRequest("Rate card ID is required");
      const admin = user.role === "super_admin";
      const result = await pool.query(
        `DELETE FROM rate_cards WHERE id=$1 AND ($2=true OR company_id=$3) RETURNING id`,
        [id, admin, user.company_id]
      );
      if (result.rows.length === 0) return badRequest("Rate card not found");
      return ok({ deleted: true });
    } catch (e: any) { return err(e.message); }
  });
}
