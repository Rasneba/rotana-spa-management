import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { badRequest, err, ok, withAuth } from "@/lib/api-utils";
import { requirePermission } from "@/lib/permissions";
import { getSpaReport } from "@/lib/spa-modules";

type RouteParams = { params: Promise<{ report: string }> };
type ReportRow = Record<string, string | number | null>;
type SummaryItem = { label: string; value: string | number; format?: "number" | "currency" | "minutes" };

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to generate report";
}

function dateRange(req: Request): { from: string; to: string } {
  const url = new URL(req.url);
  const to = url.searchParams.get("to") || new Date().toISOString().slice(0, 10);
  const start = new Date();
  start.setDate(start.getDate() - 29);
  const from = url.searchParams.get("from") || start.toISOString().slice(0, 10);
  return {
    from: /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : start.toISOString().slice(0, 10),
    to: /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : new Date().toISOString().slice(0, 10),
  };
}

function reportResponse(
  summary: SummaryItem[],
  columns: { key: string; label: string; format?: "number" | "currency" | "minutes" }[],
  rows: ReportRow[],
  from: string,
  to: string
) {
  return ok({ summary, columns, rows, range: { from, to } });
}

export async function GET(req: Request, { params }: RouteParams) {
  const { report: reportSlug } = await params;
  const definition = getSpaReport(reportSlug);
  if (!definition) return NextResponse.json({ error: "Report not found" }, { status: 404 });

  return withAuth(req, async (user) => {
    const permission = await requirePermission(user, "view", definition.resource);
    if (!permission.allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });

    const url = new URL(req.url);
    const requestedCompany = Number(url.searchParams.get("company_id"));
    const companyId = user.role === "super_admin" && Number.isInteger(requestedCompany) && requestedCompany > 0
      ? requestedCompany
      : user.company_id;
    if (!companyId) return badRequest("A company is required to generate reports");
    const { from, to } = dateRange(req);

    try {
      if (reportSlug === "access") {
        const [summaryResult, detailResult] = await Promise.all([
          pool.query(
            `SELECT COUNT(*)::int AS events,
                    COUNT(*) FILTER (WHERE status='granted')::int AS granted,
                    COUNT(*) FILTER (WHERE status='denied')::int AS denied,
                    COUNT(DISTINCT member_id) FILTER (WHERE member_id IS NOT NULL)::int AS unique_members
             FROM access_logs
             WHERE company_id=$1 AND created_at::date BETWEEN $2::date AND $3::date`,
            [companyId, from, to]
          ),
          pool.query(
            `SELECT l.created_at::date::text AS date,
                    COALESCE(g.name,'Unassigned') AS gate,
                    l.method,
                    COUNT(*) FILTER (WHERE l.access_type='entry')::int AS entries,
                    COUNT(*) FILTER (WHERE l.access_type='exit')::int AS exits,
                    COUNT(*) FILTER (WHERE l.status='granted')::int AS granted,
                    COUNT(*) FILTER (WHERE l.status='denied')::int AS denied
             FROM access_logs l
             LEFT JOIN entry_gates g ON g.id=l.gate_id
             WHERE l.company_id=$1 AND l.created_at::date BETWEEN $2::date AND $3::date
             GROUP BY l.created_at::date, COALESCE(g.name,'Unassigned'), l.method
             ORDER BY l.created_at::date DESC, gate, l.method`,
            [companyId, from, to]
          ),
        ]);
        const item = summaryResult.rows[0];
        return reportResponse(
          [
            { label: "Access Events", value: item.events, format: "number" },
            { label: "Granted", value: item.granted, format: "number" },
            { label: "Denied", value: item.denied, format: "number" },
            { label: "Unique Members", value: item.unique_members, format: "number" },
          ],
          [
            { key: "date", label: "Date" },
            { key: "gate", label: "Gate" },
            { key: "method", label: "Method" },
            { key: "entries", label: "Entries", format: "number" },
            { key: "exits", label: "Exits", format: "number" },
            { key: "granted", label: "Granted", format: "number" },
            { key: "denied", label: "Denied", format: "number" },
          ],
          detailResult.rows,
          from,
          to
        );
      }

      if (reportSlug === "membership") {
        const [summaryResult, planResult] = await Promise.all([
          pool.query(
            `SELECT COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE status = 'active')::int AS active,
                    COUNT(*) FILTER (WHERE status = 'expired')::int AS expired,
                    COUNT(*) FILTER (WHERE created_at::date BETWEEN $2::date AND $3::date)::int AS new_members
             FROM membership_members WHERE company_id = $1`,
            [companyId, from, to]
          ),
          pool.query(
            `SELECT p.name AS plan,
                    p.type,
                    COUNT(m.id)::int AS members,
                    COUNT(m.id) FILTER (WHERE m.status = 'active')::int AS active_members,
                    COUNT(m.id) FILTER (WHERE m.status = 'expired')::int AS expired_members
             FROM membership_plans p
             LEFT JOIN membership_members m ON m.plan_id = p.id AND m.company_id = p.company_id
             WHERE p.company_id = $1
             GROUP BY p.id, p.name, p.type
             ORDER BY members DESC, p.name`,
            [companyId]
          ),
        ]);
        const item = summaryResult.rows[0];
        return reportResponse(
          [
            { label: "Total Members", value: item.total, format: "number" },
            { label: "Active Members", value: item.active, format: "number" },
            { label: "Expired", value: item.expired, format: "number" },
            { label: "New in Period", value: item.new_members, format: "number" },
          ],
          [
            { key: "plan", label: "Plan" },
            { key: "type", label: "Type" },
            { key: "members", label: "Members", format: "number" },
            { key: "active_members", label: "Active", format: "number" },
            { key: "expired_members", label: "Expired", format: "number" },
          ],
          planResult.rows,
          from,
          to
        );
      }

      if (reportSlug === "attendance") {
        const [summaryResult, dailyResult] = await Promise.all([
          pool.query(
            `SELECT COUNT(*)::int AS visits,
                    COUNT(DISTINCT member_id)::int AS unique_members,
                    COUNT(*) FILTER (WHERE check_out_at IS NULL)::int AS currently_inside,
                    COALESCE(AVG(EXTRACT(EPOCH FROM (COALESCE(check_out_at, CURRENT_TIMESTAMP) - check_in_at)) / 60), 0)::numeric AS average_minutes
             FROM gym_checkins
             WHERE company_id = $1 AND check_in_at::date BETWEEN $2::date AND $3::date`,
            [companyId, from, to]
          ),
          pool.query(
            `SELECT check_in_at::date::text AS date,
                    COUNT(*)::int AS visits,
                    COUNT(DISTINCT member_id)::int AS unique_members,
                    COUNT(*) FILTER (WHERE check_out_at IS NOT NULL)::int AS completed,
                    COALESCE(AVG(EXTRACT(EPOCH FROM (check_out_at - check_in_at)) / 60)
                      FILTER (WHERE check_out_at IS NOT NULL), 0)::numeric AS average_minutes
             FROM gym_checkins
             WHERE company_id = $1 AND check_in_at::date BETWEEN $2::date AND $3::date
             GROUP BY check_in_at::date ORDER BY check_in_at::date DESC`,
            [companyId, from, to]
          ),
        ]);
        const item = summaryResult.rows[0];
        return reportResponse(
          [
            { label: "Visits", value: item.visits, format: "number" },
            { label: "Unique Members", value: item.unique_members, format: "number" },
            { label: "Currently Inside", value: item.currently_inside, format: "number" },
            { label: "Average Visit", value: item.average_minutes, format: "minutes" },
          ],
          [
            { key: "date", label: "Date" },
            { key: "visits", label: "Visits", format: "number" },
            { key: "unique_members", label: "Unique Members", format: "number" },
            { key: "completed", label: "Completed", format: "number" },
            { key: "average_minutes", label: "Average Visit", format: "minutes" },
          ],
          dailyResult.rows,
          from,
          to
        );
      }

      if (reportSlug === "service-orders") {
        const [summaryResult, dailyResult] = await Promise.all([
          pool.query(
            `SELECT COUNT(*)::int AS orders,
                    COUNT(*) FILTER (WHERE status='draft')::int AS drafts,
                    COUNT(*) FILTER (WHERE status='printed')::int AS printed,
                    COUNT(*) FILTER (WHERE status='handed_to_cashier')::int AS handed_to_cashier,
                    COALESCE(SUM(total_items), 0)::int AS total_items
             FROM spa_service_orders
             WHERE company_id=$1 AND generated_at::date BETWEEN $2::date AND $3::date`,
            [companyId, from, to]
          ),
          pool.query(
            `SELECT so.generated_at::date::text AS date,
                    COUNT(*)::int AS orders,
                    COALESCE(SUM(so.total_items), 0)::int AS service_items,
                    COUNT(*) FILTER (WHERE so.print_count > 0)::int AS printed,
                    COUNT(*) FILTER (WHERE so.status='handed_to_cashier')::int AS handed_to_cashier,
                    COUNT(DISTINCT v.therapist_record_id)::int AS therapists
             FROM spa_service_orders so
             JOIN spa_visits v ON v.id=so.visit_id
             WHERE so.company_id=$1 AND so.generated_at::date BETWEEN $2::date AND $3::date
             GROUP BY so.generated_at::date
             ORDER BY so.generated_at::date DESC`,
            [companyId, from, to]
          ),
        ]);
        const item = summaryResult.rows[0];
        return reportResponse(
          [
            { label: "Service Orders", value: item.orders, format: "number" },
            { label: "Service Items", value: item.total_items, format: "number" },
            { label: "Printed", value: item.printed, format: "number" },
            { label: "At Cashier", value: item.handed_to_cashier, format: "number" },
          ],
          [
            { key: "date", label: "Date" },
            { key: "orders", label: "Orders", format: "number" },
            { key: "service_items", label: "Service Items", format: "number" },
            { key: "printed", label: "Printed", format: "number" },
            { key: "handed_to_cashier", label: "At Cashier", format: "number" },
            { key: "therapists", label: "Therapists", format: "number" },
          ],
          dailyResult.rows,
          from,
          to
        );
      }

      if (reportSlug === "therapist") {
        const [summaryResult, therapistResult] = await Promise.all([
          pool.query(
            `SELECT COUNT(DISTINCT v.therapist_record_id)::int AS therapists,
                    COUNT(DISTINCT v.id)::int AS visits,
                    COUNT(DISTINCT v.id) FILTER (WHERE v.finished_at IS NOT NULL)::int AS completed,
                    COALESCE(SUM(vs.quantity), 0)::int AS service_items
             FROM spa_visits v
             LEFT JOIN spa_visit_services vs ON vs.visit_id=v.id
             WHERE v.company_id=$1 AND v.therapist_record_id IS NOT NULL
               AND v.checked_in_at::date BETWEEN $2::date AND $3::date`,
            [companyId, from, to]
          ),
          pool.query(
            `SELECT COALESCE(v.therapist_name, 'Unassigned') AS therapist,
                    COUNT(DISTINCT v.id)::int AS visits,
                    COUNT(DISTINCT v.id) FILTER (WHERE v.finished_at IS NOT NULL)::int AS completed,
                    COALESCE(SUM(vs.quantity), 0)::int AS service_items,
                    COALESCE(AVG(EXTRACT(EPOCH FROM (v.finished_at-v.treatment_started_at))/60)
                      FILTER (WHERE v.finished_at IS NOT NULL AND v.treatment_started_at IS NOT NULL), 0)::numeric AS average_minutes
             FROM spa_visits v
             LEFT JOIN spa_visit_services vs ON vs.visit_id=v.id
             WHERE v.company_id=$1 AND v.therapist_record_id IS NOT NULL
               AND v.checked_in_at::date BETWEEN $2::date AND $3::date
             GROUP BY v.therapist_record_id, v.therapist_name
             ORDER BY completed DESC, therapist`,
            [companyId, from, to]
          ),
        ]);
        const item = summaryResult.rows[0];
        return reportResponse(
          [
            { label: "Therapists", value: item.therapists, format: "number" },
            { label: "Assigned Visits", value: item.visits, format: "number" },
            { label: "Completed", value: item.completed, format: "number" },
            { label: "Service Items", value: item.service_items, format: "number" },
          ],
          [
            { key: "therapist", label: "Therapist" },
            { key: "visits", label: "Visits", format: "number" },
            { key: "completed", label: "Completed", format: "number" },
            { key: "service_items", label: "Service Items", format: "number" },
            { key: "average_minutes", label: "Average Treatment", format: "minutes" },
          ],
          therapistResult.rows,
          from,
          to
        );
      }

      if (reportSlug === "trainer") {
        const [summaryResult, trainerResult] = await Promise.all([
          pool.query(
            `SELECT
               (SELECT COUNT(*) FROM spa_management_records WHERE company_id=$1 AND module_key='gym/trainers' AND deleted_at IS NULL AND status='active')::int AS active_trainers,
               COUNT(*) FILTER (WHERE module_key='gym/classes')::int AS classes,
               COUNT(*) FILTER (WHERE module_key='gym/workout-plans')::int AS workout_plans,
               COUNT(*) FILTER (WHERE module_key='gym/fitness-assessments')::int AS assessments
             FROM spa_management_records
             WHERE company_id=$1 AND deleted_at IS NULL
               AND module_key IN ('gym/classes','gym/workout-plans','gym/fitness-assessments')
               AND (record_date IS NULL OR record_date::date BETWEEN $2::date AND $3::date)`,
            [companyId, from, to]
          ),
          pool.query(
            `WITH activity AS (
               SELECT COALESCE(NULLIF(details->>'trainer',''), 'Unassigned') AS trainer,
                      module_key, status
               FROM spa_management_records
               WHERE company_id=$1 AND deleted_at IS NULL
                 AND module_key IN ('gym/classes','gym/workout-plans','gym/fitness-assessments')
                 AND (record_date IS NULL OR record_date::date BETWEEN $2::date AND $3::date)
             )
             SELECT trainer,
                    COUNT(*) FILTER (WHERE module_key='gym/classes')::int AS classes,
                    COUNT(*) FILTER (WHERE module_key='gym/workout-plans')::int AS workout_plans,
                    COUNT(*) FILTER (WHERE module_key='gym/fitness-assessments')::int AS assessments,
                    COUNT(*) FILTER (WHERE status IN ('completed','active'))::int AS active_or_completed
             FROM activity GROUP BY trainer ORDER BY active_or_completed DESC, trainer`,
            [companyId, from, to]
          ),
        ]);
        const item = summaryResult.rows[0];
        return reportResponse(
          [
            { label: "Active Trainers", value: item.active_trainers, format: "number" },
            { label: "Classes", value: item.classes, format: "number" },
            { label: "Workout Plans", value: item.workout_plans, format: "number" },
            { label: "Assessments", value: item.assessments, format: "number" },
          ],
          [
            { key: "trainer", label: "Trainer" },
            { key: "classes", label: "Classes", format: "number" },
            { key: "workout_plans", label: "Workout Plans", format: "number" },
            { key: "assessments", label: "Assessments", format: "number" },
            { key: "active_or_completed", label: "Active / Completed", format: "number" },
          ],
          trainerResult.rows,
          from,
          to
        );
      }

      if (reportSlug === "inventory") {
        const [summaryResult, inventoryResult] = await Promise.all([
          pool.query(
            `SELECT COUNT(*) FILTER (WHERE module_key IN ('inventory/products','inventory/consumables'))::int AS items,
                    COUNT(*) FILTER (WHERE status IN ('low-stock','out-of-stock'))::int AS attention,
                    COALESCE(SUM(NULLIF(details->>'quantity','')::numeric)
                      FILTER (WHERE module_key IN ('inventory/products','inventory/consumables')), 0)::numeric AS on_hand,
                    COUNT(*) FILTER (WHERE module_key='inventory/stock-usage' AND record_date::date BETWEEN $2::date AND $3::date)::int AS usage_entries
             FROM spa_management_records
             WHERE company_id=$1 AND deleted_at IS NULL
               AND module_key IN ('inventory/products','inventory/consumables','inventory/stock-usage')`,
            [companyId, from, to]
          ),
          pool.query(
            `SELECT title AS item,
                    CASE module_key WHEN 'inventory/products' THEN 'Product' ELSE 'Consumable' END AS type,
                    details->>'sku' AS sku,
                    COALESCE(NULLIF(details->>'quantity','')::numeric, 0) AS quantity,
                    COALESCE(NULLIF(details->>'reorder_level','')::numeric, 0) AS reorder_level,
                    status
             FROM spa_management_records
             WHERE company_id=$1 AND deleted_at IS NULL
               AND module_key IN ('inventory/products','inventory/consumables')
             ORDER BY CASE WHEN status IN ('out-of-stock','low-stock') THEN 0 ELSE 1 END, title`,
            [companyId]
          ),
        ]);
        const item = summaryResult.rows[0];
        return reportResponse(
          [
            { label: "Stock Items", value: item.items, format: "number" },
            { label: "Need Attention", value: item.attention, format: "number" },
            { label: "Units On Hand", value: item.on_hand, format: "number" },
            { label: "Usage Entries", value: item.usage_entries, format: "number" },
          ],
          [
            { key: "item", label: "Item" },
            { key: "type", label: "Type" },
            { key: "sku", label: "SKU" },
            { key: "quantity", label: "Quantity", format: "number" },
            { key: "reorder_level", label: "Reorder Level", format: "number" },
            { key: "status", label: "Status" },
          ],
          inventoryResult.rows,
          from,
          to
        );
      }

      return NextResponse.json({ error: "Report not implemented" }, { status: 404 });
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
      if (code === "42P01") {
        return NextResponse.json(
          { error: "Required report tables are not installed. Apply the latest database migrations, including db-migration-v33.sql through db-migration-v35.sql." },
          { status: 503 }
        );
      }
      return err(message(error));
    }
  });
}
