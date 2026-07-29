import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { withAuth, ok, created, err, badRequest } from "@/lib/api-utils";

export async function GET(req: Request) {
  return withAuth(req, async (user) => {
    const admin = user.role === "super_admin";
    try {
      const result = await pool.query(
        `SELECT c.*, m.full_name as member_name, m.customer_id as member_code
         FROM rfid_cards c
         LEFT JOIN membership_members m ON c.member_id = m.id
         WHERE $1 = true OR c.company_id = $2
         ORDER BY c.created_at DESC`,
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
      const { card_uid, member_id, type, status, expiry_date } = body;
      if (!card_uid) return badRequest("Card UID is required");
      const company_id = admin && body.company_id ? Number(body.company_id) : user.company_id;
      const result = await pool.query(
        `INSERT INTO rfid_cards (company_id, card_uid, member_id, type, status, expiry_date)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [company_id, card_uid, member_id || null, type || 'membership', status || 'active', expiry_date || null]
      );
      return created(result.rows[0]);
    } catch (e: any) { return err(e.message); }
  });
}

export async function PUT(req: Request) {
  return withAuth(req, async (user) => {
    try {
      const body = await req.json();
      const { id, member_id, type, status, expiry_date } = body;
      if (!id) return badRequest("Card ID is required");
      const admin = user.role === "super_admin";
      const result = await pool.query(
        `UPDATE rfid_cards SET member_id=$1, type=$2, status=$3, expiry_date=$4
         WHERE id=$5 AND ($6=true OR company_id=$7) RETURNING *`,
        [member_id, type, status, expiry_date, id, admin, user.company_id]
      );
      if (result.rows.length === 0) return badRequest("Card not found");
      return ok(result.rows[0]);
    } catch (e: any) { return err(e.message); }
  });
}

export async function DELETE(req: Request) {
  return withAuth(req, async (user) => {
    try {
      const { id } = await req.json();
      if (!id) return badRequest("Card ID is required");
      const admin = user.role === "super_admin";
      const result = await pool.query(
        `DELETE FROM rfid_cards WHERE id=$1 AND ($2=true OR company_id=$3) RETURNING id`,
        [id, admin, user.company_id]
      );
      if (result.rows.length === 0) return badRequest("Card not found");
      return ok({ deleted: true });
    } catch (e: any) { return err(e.message); }
  });
}
