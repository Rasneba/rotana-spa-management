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
                    p.price,
                    COUNT(m.id)::int AS members,
                    COUNT(m.id) FILTER (WHERE m.status = 'active')::int AS active_members,
                    COALESCE(SUM(p.price) FILTER (WHERE m.status = 'active'), 0)::numeric AS active_value
             FROM membership_plans p
             LEFT JOIN membership_members m ON m.plan_id = p.id AND m.company_id = p.company_id
             WHERE p.company_id = $1
             GROUP BY p.id, p.name, p.type, p.price
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
            { key: "price", label: "Price", format: "currency" },
            { key: "members", label: "Members", format: "number" },
            { key: "active_members", label: "Active", format: "number" },
            { key: "active_value", label: "Active Value", format: "currency" },
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

      if (reportSlug === "revenue") {
        const [summaryResult, dailyResult] = await Promise.all([
          pool.query(
            `WITH revenue_entries AS (
               SELECT amount::numeric AS amount, payment_date::date AS paid_on
               FROM membership_payments
               WHERE company_id = $1 AND payment_date BETWEEN $2::date AND $3::date
               UNION ALL
               SELECT amount::numeric, record_date::date
               FROM spa_management_records
               WHERE company_id = $1 AND deleted_at IS NULL AND amount IS NOT NULL
                 AND module_key IN ('charges/send-to-cashier','charges/external-receipts')
                 AND status IN ('paid','verified','reconciled')
                 AND record_date::date BETWEEN $2::date AND $3::date
             )
             SELECT COALESCE(SUM(amount), 0)::numeric AS revenue,
                    COUNT(*)::int AS payments,
                    COALESCE(AVG(amount), 0)::numeric AS average_payment,
                    COALESCE(SUM(amount) FILTER (WHERE paid_on = CURRENT_DATE), 0)::numeric AS today
             FROM revenue_entries`,
            [companyId, from, to]
          ),
          pool.query(
            `WITH revenue_entries AS (
               SELECT amount::numeric AS amount, payment_date::date AS paid_on,
                      COALESCE(payment_method, 'membership') AS method
               FROM membership_payments
               WHERE company_id = $1 AND payment_date BETWEEN $2::date AND $3::date
               UNION ALL
               SELECT amount::numeric, record_date::date,
                      COALESCE(NULLIF(details->>'payment_method',''), NULLIF(details->>'provider',''), 'external')
               FROM spa_management_records
               WHERE company_id = $1 AND deleted_at IS NULL AND amount IS NOT NULL
                 AND module_key IN ('charges/send-to-cashier','charges/external-receipts')
                 AND status IN ('paid','verified','reconciled')
                 AND record_date::date BETWEEN $2::date AND $3::date
             )
             SELECT paid_on::text AS date,
                    method,
                    COUNT(*)::int AS payments,
                    COALESCE(SUM(amount), 0)::numeric AS revenue,
                    COALESCE(AVG(amount), 0)::numeric AS average_payment
             FROM revenue_entries
             GROUP BY paid_on, method
             ORDER BY paid_on DESC, revenue DESC`,
            [companyId, from, to]
          ),
        ]);
        const item = summaryResult.rows[0];
        return reportResponse(
          [
            { label: "Revenue", value: item.revenue, format: "currency" },
            { label: "Payments", value: item.payments, format: "number" },
            { label: "Average Payment", value: item.average_payment, format: "currency" },
            { label: "Today", value: item.today, format: "currency" },
          ],
          [
            { key: "date", label: "Date" },
            { key: "method", label: "Method" },
            { key: "payments", label: "Payments", format: "number" },
            { key: "revenue", label: "Revenue", format: "currency" },
            { key: "average_payment", label: "Average", format: "currency" },
          ],
          dailyResult.rows,
          from,
          to
        );
      }

      if (reportSlug === "therapist") {
        const [summaryResult, therapistResult] = await Promise.all([
          pool.query(
            `SELECT COUNT(*)::int AS services,
                    COUNT(DISTINCT details->>'therapist')::int AS therapists,
                    COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
                    COALESCE(SUM(amount), 0)::numeric AS generated_charges
             FROM spa_management_records
             WHERE company_id = $1 AND module_key = 'spa/service-usage' AND deleted_at IS NULL
               AND record_date::date BETWEEN $2::date AND $3::date`,
            [companyId, from, to]
          ),
          pool.query(
            `SELECT COALESCE(NULLIF(details->>'therapist', ''), 'Unassigned') AS therapist,
                    COUNT(*)::int AS services,
                    COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
                    COUNT(DISTINCT details->>'customer_name')::int AS customers,
                    COALESCE(SUM(amount), 0)::numeric AS generated_charges
             FROM spa_management_records
             WHERE company_id = $1 AND module_key = 'spa/service-usage' AND deleted_at IS NULL
               AND record_date::date BETWEEN $2::date AND $3::date
             GROUP BY COALESCE(NULLIF(details->>'therapist', ''), 'Unassigned')
             ORDER BY services DESC, therapist`,
            [companyId, from, to]
          ),
        ]);
        const item = summaryResult.rows[0];
        return reportResponse(
          [
            { label: "Services", value: item.services, format: "number" },
            { label: "Therapists", value: item.therapists, format: "number" },
            { label: "Completed", value: item.completed, format: "number" },
            { label: "Generated Charges", value: item.generated_charges, format: "currency" },
          ],
          [
            { key: "therapist", label: "Therapist" },
            { key: "services", label: "Services", format: "number" },
            { key: "completed", label: "Completed", format: "number" },
            { key: "customers", label: "Customers", format: "number" },
            { key: "generated_charges", label: "Generated Charges", format: "currency" },
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
          { error: "Required report tables are not installed. Apply the latest database migrations, including db-migration-v33.sql." },
          { status: 503 }
        );
      }
      return err(message(error));
    }
  });
}
