import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { err, ok, withAuth } from "@/lib/api-utils";
import { requirePermission } from "@/lib/permissions";

type ErrorWithCode = { code?: string; message?: string };

export async function GET(req: Request) {
  return withAuth(req, async (user) => {
    const permission = await requirePermission(user, "view", "access_dashboard");
    if (!permission.allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    const isSuper = user.role === "super_admin";
    const companyId = user.company_id || null;
    try {
      const [
        areas,
        visits,
        sessions,
        entries,
        exits,
        members,
        subscriptions,
        cards,
        passes,
        gates,
        cameras,
        commands,
        recentAccess,
        occupancy,
      ] = await Promise.all([
        pool.query(`SELECT COUNT(*)::int AS count, COALESCE(SUM(capacity),0)::int AS capacity FROM spa_facilities WHERE ($1=true OR company_id=$2) AND is_active=true`, [isSuper, companyId]),
        pool.query(`SELECT COUNT(*)::int AS count FROM spa_visits WHERE ($1=true OR company_id=$2) AND status IN ('checked_in','assigned','in_treatment')`, [isSuper, companyId]),
        pool.query(`SELECT COUNT(*)::int AS count FROM visit_sessions WHERE ($1=true OR company_id=$2) AND check_out_at IS NULL`, [isSuper, companyId]),
        pool.query(`SELECT COUNT(*)::int AS count FROM access_logs WHERE ($1=true OR company_id=$2) AND access_type='entry' AND status='granted' AND created_at::date=CURRENT_DATE`, [isSuper, companyId]),
        pool.query(`SELECT COUNT(*)::int AS count FROM access_logs WHERE ($1=true OR company_id=$2) AND access_type='exit' AND status='granted' AND created_at::date=CURRENT_DATE`, [isSuper, companyId]),
        pool.query(`SELECT COUNT(*)::int AS count FROM membership_members WHERE ($1=true OR company_id=$2)`, [isSuper, companyId]),
        pool.query(`SELECT COUNT(*)::int AS count FROM subscriptions WHERE ($1=true OR company_id=$2) AND status='active' AND end_date>=CURRENT_DATE`, [isSuper, companyId]),
        pool.query(`SELECT COUNT(*)::int AS count FROM rfid_cards WHERE ($1=true OR company_id=$2) AND status='active'`, [isSuper, companyId]),
        pool.query(`SELECT COUNT(*)::int AS count FROM qr_passes WHERE ($1=true OR company_id=$2) AND status='active' AND expiry_date>=CURRENT_DATE`, [isSuper, companyId]),
        pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='active')::int AS active FROM entry_gates WHERE ($1=true OR company_id=$2)`, [isSuper, companyId]),
        pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='active')::int AS active FROM access_cameras WHERE ($1=true OR company_id=$2)`, [isSuper, companyId]),
        pool.query(`SELECT COUNT(*)::int AS count FROM access_device_commands WHERE ($1=true OR company_id=$2) AND status IN ('pending','processing')`, [isSuper, companyId]),
        pool.query(
          `SELECT l.id, l.access_type, l.method, l.status, l.reason, l.created_at,
                  g.name AS gate_name, m.full_name AS member_name,
                  m.customer_id AS member_code
           FROM access_logs l
           LEFT JOIN entry_gates g ON g.id=l.gate_id
           LEFT JOIN membership_members m ON m.id=l.member_id
           WHERE ($1=true OR l.company_id=$2)
           ORDER BY l.created_at DESC LIMIT 10`,
          [isSuper, companyId]
        ),
        pool.query(
          `SELECT f.id, f.name, f.type, COALESCE(f.capacity,0)::int AS capacity,
                  (
                    (SELECT COUNT(*) FROM visit_sessions s WHERE s.facility_id=f.id AND s.check_out_at IS NULL) +
                    (SELECT COUNT(*) FROM spa_visits v WHERE v.facility_id=f.id AND v.status IN ('checked_in','assigned','in_treatment'))
                  )::int AS occupied
           FROM spa_facilities f
           WHERE ($1=true OR f.company_id=$2) AND f.is_active=true
           ORDER BY f.type, f.name`,
          [isSuper, companyId]
        ),
      ]);

      return ok({
        totalAreas: areas.rows[0].count,
        totalCapacity: areas.rows[0].capacity,
        activeVisits: visits.rows[0].count,
        activeSessions: sessions.rows[0].count,
        todayEntries: entries.rows[0].count,
        todayExits: exits.rows[0].count,
        totalCustomers: members.rows[0].count,
        activeSubscriptions: subscriptions.rows[0].count,
        activeCards: cards.rows[0].count,
        activePasses: passes.rows[0].count,
        gates: gates.rows[0],
        cameras: cameras.rows[0],
        pendingCommands: commands.rows[0].count,
        recentAccess: recentAccess.rows,
        occupancy: occupancy.rows,
      });
    } catch (error) {
      const dbError = error as ErrorWithCode;
      if (dbError.code === "42P01" || dbError.code === "42703") {
        return NextResponse.json({ error: "Apply db-migration-v35.sql before opening the adapted access dashboard." }, { status: 503 });
      }
      return err(dbError.message || "Unable to load access dashboard");
    }
  });
}
