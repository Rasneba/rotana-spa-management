import pool from "@/lib/db";
import { withAuth, ok, err, badRequest } from "@/lib/api-utils";

export async function POST(req: Request) {
  return withAuth(req, async (user) => {
    try {
      const body = await req.json();
      const { member_id } = body;

      if (!member_id) return badRequest("member_id is required");

      const existing = await pool.query(
        `SELECT id FROM gym_checkins WHERE member_id = $1 AND status = 'checked_in' AND company_id = $2 LIMIT 1`,
        [member_id, user.company_id]
      );
      if (existing.rows.length > 0) {
        return ok({ checked_in: true, already_checked_in: true, checkin_id: existing.rows[0].id });
      }

      const checkin = await pool.query(
        `INSERT INTO gym_checkins (company_id, member_id, card_uid, status, source)
         VALUES ($1,$2,$3,'checked_in',$4) RETURNING *`,
        [user.company_id, member_id, null, "manual"]
      );

      const memberRes = await pool.query("SELECT first_name, last_name, code FROM membership_members WHERE id = $1", [member_id]);
      const member = memberRes.rows[0];

      return ok({
        checked_in: true,
        checkin: checkin.rows[0],
        member: member ? { id: member_id, name: `${member.first_name} ${member.last_name}`, code: member.code } : null,
      });
    } catch (e: any) { return err(e.message); }
  });
}
