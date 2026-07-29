import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { withAuth, ok, created, err, badRequest } from "@/lib/api-utils";
import crypto from "crypto";

export async function GET(req: Request) {
  return withAuth(req, async (user) => {
    const admin = user.role === "super_admin";
    const url = new URL(req.url);
    const isUsed = url.searchParams.get("is_used");
    try {
      let where = admin ? "TRUE" : "t.company_id = $1";
      const params: any[] = admin ? [] : [user.company_id];
      let idx = admin ? 1 : 2;
      if (isUsed !== null) { where += ` AND t.is_used = $${idx}`; params.push(isUsed === 'true'); idx++; }
      const result = await pool.query(
        `SELECT t.*, f.name as facility_name, r.name as rate_name, u.name as issued_by_name
         FROM day_tickets t
         LEFT JOIN spa_facilities f ON t.facility_id = f.id
         LEFT JOIN rate_cards r ON t.rate_id = r.id
         LEFT JOIN users u ON t.issued_by = u.id
         WHERE ${where}
         ORDER BY t.created_at DESC`,
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
      const { guest_name, facility_id, rate_id, price, currency } = body;
      const company_id = admin && body.company_id ? Number(body.company_id) : user.company_id;
      const ticketNumber = `TKT-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const result = await pool.query(
        `INSERT INTO day_tickets (company_id, ticket_number, guest_name, facility_id, rate_id, price, currency, issued_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [company_id, ticketNumber, guest_name || null, facility_id || null, rate_id || null, price || 0, currency || 'ETB', user.id]
      );
      return created(result.rows[0]);
    } catch (e: any) { return err(e.message); }
  });
}

export async function PUT(req: Request) {
  return withAuth(req, async (user) => {
    try {
      const body = await req.json();
      const { id, is_used } = body;
      if (!id) return badRequest("Ticket ID is required");
      const admin = user.role === "super_admin";
      const usedAt = is_used ? new Date().toISOString() : null;
      const result = await pool.query(
        `UPDATE day_tickets SET is_used=$1, used_at=$2 WHERE id=$3 AND ($4=true OR company_id=$5) RETURNING *`,
        [is_used, usedAt, id, admin, user.company_id]
      );
      if (result.rows.length === 0) return badRequest("Ticket not found");
      return ok(result.rows[0]);
    } catch (e: any) { return err(e.message); }
  });
}
