import pool from "@/lib/db";
import { withAuth, ok, err } from "@/lib/api-utils";

export async function GET(req: Request) {
  return withAuth(req, async (user) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const isSuper = user.role === "super_admin";
      const cid = user.company_id;

      const filter = isSuper ? "" : cid ? `WHERE company_id = ${cid}` : "WHERE 1=0";
      const memberFilter = isSuper ? "" : cid ? `AND m.company_id = ${cid}` : "AND 1=0";

      const [totalMembers, activeMembers, todayCheckIns, recentMembers, websiteRequests] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM membership_members m ${filter.replace("WHERE", "WHERE m.")}`),
        pool.query(`SELECT COUNT(*) FROM membership_members m WHERE m.status = 'active' ${memberFilter}`),
        pool.query(`SELECT COUNT(*) FROM membership_attendance WHERE date = $1 AND check_out IS NULL`, [today]),
        pool.query(`SELECT m.*, mp.name as plan_name FROM membership_members m LEFT JOIN membership_plans mp ON m.plan_id = mp.id ${filter.replace("WHERE", "WHERE m.")} ORDER BY m.created_at DESC LIMIT 5`),
        pool.query(`SELECT COUNT(*) FROM website_booking_requests ${isSuper ? "WHERE status='new'" : cid ? "WHERE company_id = $1 AND status='new'" : "WHERE 1=0"}`, isSuper ? [] : cid ? [cid] : []).catch(() => ({ rows: [{ count: 0 }] })),
      ]);

      return ok({
        totalMembers: parseInt(totalMembers.rows[0].count),
        activeMembers: parseInt(activeMembers.rows[0].count),
        todayCheckIns: parseInt(todayCheckIns.rows[0].count),
        websiteRequests: parseInt(websiteRequests.rows[0].count),
        recentMembers: recentMembers.rows,
      });
    } catch (e: any) {
      console.error("Dashboard stats error:", e);
      return err(e.message);
    }
  });
}
