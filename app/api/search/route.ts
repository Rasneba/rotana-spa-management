import pool from "@/lib/db";
import { withAuth, ok, badRequest } from "@/lib/api-utils";

export async function GET(req: Request) {
  return withAuth(req, async (user) => {
    const url = new URL(req.url);
    const q = url.searchParams.get("q");

    if (!q || q.trim().length === 0) {
      return badRequest("Query parameter q is required");
    }

    const query = `%${q}%`;

    try {
      const [members] = await Promise.all([
        pool.query(`
          SELECT m.id, m.code, m.first_name, m.last_name, m.phone, mp.name as plan_name
          FROM membership_members m
          LEFT JOIN membership_plans mp ON m.plan_id = mp.id
          WHERE m.first_name ILIKE $1 OR m.last_name ILIKE $1 OR m.code ILIKE $1 OR m.phone ILIKE $1
          LIMIT 10
        `, [query]),
      ]);

      return ok({
        members: members.rows,
      });
    } catch (e: any) {
      return ok({ members: [] });
    }
  });
}
