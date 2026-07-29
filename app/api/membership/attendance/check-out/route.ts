import pool from "@/lib/db";
import { withAuth, ok, err, badRequest } from "@/lib/api-utils";

export async function POST(req: Request) {
  return withAuth(req, async (user) => {
    try {
      const body = await req.json();
      const { member_id, checkin_id } = body;

      if (!member_id && !checkin_id) {
        return badRequest("Provide member_id or checkin_id");
      }

      let whereClause = "";
      let params: any[] = [];
      if (checkin_id) {
        whereClause = "id = $1 AND company_id = $2";
        params = [checkin_id, user.company_id];
      } else {
        whereClause = "member_id = $1 AND status = 'checked_in' AND company_id = $2";
        params = [member_id, user.company_id];
      }

      const result = await pool.query(
        `UPDATE gym_checkins SET status = 'checked_out', check_out_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE ${whereClause} RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        return ok({ checked_out: false, reason: "No active check-in found" });
      }

      return ok({ checked_out: true, checkin: result.rows[0] });
    } catch (e: any) { return err(e.message); }
  });
}
