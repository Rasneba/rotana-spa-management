import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { badRequest, created, err, ok, withAuth } from "@/lib/api-utils";
import { can, requirePermission } from "@/lib/permissions";

type JsonObject = Record<string, unknown>;
type LineItem = { code: string | null; name: string; quantity: number; unit_price: number; total: number };
function isObject(value: unknown): value is JsonObject { return typeof value === "object" && value !== null && !Array.isArray(value); }
function money(value: unknown) { return Math.max(0, Number(value) || 0); }
function salesError(error: unknown) {
  const code = isObject(error) && typeof error.code === "string" ? error.code : "";
  if (code === "42P01" || code === "42703") return NextResponse.json({ error: "Apply db-migration-v41.sql before using Spa Sales." }, { status: 503 });
  return err(error instanceof Error ? error.message : "Unable to manage Spa Sales");
}
function totals(items: LineItem[], discount = 0, tax = 0) {
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const total = Math.max(0, subtotal - discount + tax);
  return { subtotal, discount, tax, total };
}

async function defaultPriceMap(companyId: number, services: { code: string | null; name: string; quantity: number }[]) {
  const result = await pool.query(
    `SELECT title, details->>'offering_code' AS code, amount, details->>'price' AS price
     FROM spa_management_records
     WHERE company_id=$1 AND module_key='catalog/offerings' AND deleted_at IS NULL`,
    [companyId]
  );
  return services.map((service) => {
    const match = result.rows.find((row) =>
      (service.code && row.code === service.code) || String(row.title).toLowerCase() === service.name.toLowerCase()
    );
    const unit = Number(match?.amount || match?.price || 0);
    return { code: service.code, name: service.name, quantity: Number(service.quantity) || 1, unit_price: unit, total: unit * (Number(service.quantity) || 1) };
  });
}

export async function GET(req: Request) {
  return withAuth(req, async (user) => {
    const permission = await requirePermission(user, "view", "spa_sales");
    if (!permission.allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    try {
      const url = new URL(req.url);
      const values: unknown[] = [];
      const orderClauses = ["TRUE"];
      const readyClauses = ["so.status='handed_to_cashier'", "sale.id IS NULL"];
      if (user.role !== "super_admin") {
        values.push(user.company_id);
        orderClauses.push(`sale.company_id=$${values.length}`);
        readyClauses.push(`so.company_id=$${values.length}`);
      }
      const status = url.searchParams.get("status") || "";
      if (status) { values.push(status); orderClauses.push(`sale.payment_status=$${values.length}`); }
      const q = (url.searchParams.get("q") || "").trim();
      if (q) { values.push(`%${q}%`); orderClauses.push(`(sale.invoice_no ILIKE $${values.length} OR sale.customer_name ILIKE $${values.length} OR sale.customer_phone ILIKE $${values.length})`); }

      const [sales, ready, summary] = await Promise.all([
        pool.query(
          `SELECT sale.*, so.order_no AS service_order_no, v.visit_no, v.therapist_name
           FROM spa_sales_orders sale
           LEFT JOIN spa_service_orders so ON so.id=sale.service_order_id
           LEFT JOIN spa_visits v ON v.id=sale.visit_id
           WHERE ${orderClauses.join(" AND ")}
           ORDER BY sale.created_at DESC LIMIT 250`,
          values
        ),
        pool.query(
          `SELECT so.*, v.visit_no, v.customer_name, v.customer_phone, v.therapist_name
           FROM spa_service_orders so
           JOIN spa_visits v ON v.id=so.visit_id
           LEFT JOIN spa_sales_orders sale ON sale.service_order_id=so.id
           WHERE ${readyClauses.join(" AND ")}
           ORDER BY so.handed_to_cashier_at DESC NULLS LAST, so.generated_at DESC LIMIT 100`,
          user.role !== "super_admin" ? [user.company_id] : []
        ),
        pool.query(
          `SELECT COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE payment_status='unpaid')::int AS unpaid,
                  COUNT(*) FILTER (WHERE payment_status='pending')::int AS pending,
                  COUNT(*) FILTER (WHERE payment_status='paid')::int AS paid,
                  COALESCE(SUM(total) FILTER (WHERE payment_status='paid'),0)::numeric AS paid_total
           FROM spa_sales_orders sale WHERE ${user.role === "super_admin" ? "TRUE" : "sale.company_id=$1"}`,
          user.role === "super_admin" ? [] : [user.company_id]
        ),
      ]);
      const [canCreate, canEdit] = await Promise.all([can(user, "create", "spa_sales"), can(user, "edit", "spa_sales")]);
      return ok({ sales: sales.rows, readyOrders: ready.rows, summary: summary.rows[0], capabilities: { create: canCreate, edit: canEdit } });
    } catch (error) { return salesError(error); }
  });
}

export async function POST(req: Request) {
  return withAuth(req, async (user) => {
    const permission = await requirePermission(user, "create", "spa_sales");
    if (!permission.allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    try {
      const body: unknown = await req.json();
      if (!isObject(body)) return badRequest("Invalid Spa sale request");
      const serviceOrderId = Number(body.service_order_id);
      if (!serviceOrderId) return badRequest("Service order is required");
      const values: unknown[] = [serviceOrderId];
      let ownership = "so.id=$1";
      if (user.role !== "super_admin") { values.push(user.company_id); ownership += ` AND so.company_id=$${values.length}`; }
      const orderResult = await pool.query(
        `SELECT so.*, v.customer_name, v.customer_phone, v.visit_no
         FROM spa_service_orders so JOIN spa_visits v ON v.id=so.visit_id
         WHERE ${ownership}`,
        values
      );
      const serviceOrder = orderResult.rows[0];
      if (!serviceOrder) return NextResponse.json({ error: "Service order not found" }, { status: 404 });
      if (serviceOrder.status !== "handed_to_cashier") return badRequest("Only orders handed to cashier can become Spa Sales");
      const snapshot = serviceOrder.service_snapshot || {};
      const services = Array.isArray(snapshot.services) ? snapshot.services : [];
      const lineItems = await defaultPriceMap(serviceOrder.company_id, services);
      const calculated = totals(lineItems);
      const result = await pool.query(
        `INSERT INTO spa_sales_orders
          (company_id, service_order_id, visit_id, invoice_no, customer_name, customer_phone, cashier_id, line_items, subtotal, discount, tax, total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12)
         RETURNING *`,
        [serviceOrder.company_id, serviceOrder.id, serviceOrder.visit_id, `INV-${serviceOrder.order_no}`, serviceOrder.customer_name,
          serviceOrder.customer_phone || null, user.id, JSON.stringify(lineItems), calculated.subtotal, calculated.discount, calculated.tax, calculated.total]
      );
      return created(result.rows[0]);
    } catch (error) { return salesError(error); }
  });
}

export async function PUT(req: Request) {
  return withAuth(req, async (user) => {
    const permission = await requirePermission(user, "edit", "spa_sales");
    if (!permission.allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    try {
      const body: unknown = await req.json();
      if (!isObject(body)) return badRequest("Invalid Spa sale request");
      const id = Number(body.id);
      if (!id) return badRequest("Sale ID is required");
      const rawItems = Array.isArray(body.line_items) ? body.line_items : [];
      const items: LineItem[] = rawItems.map((item) => {
        const row = isObject(item) ? item : {};
        const qty = Math.max(1, Number(row.quantity) || 1);
        const unit = money(row.unit_price);
        return { code: typeof row.code === "string" ? row.code : null, name: String(row.name || "Service"), quantity: qty, unit_price: unit, total: qty * unit };
      });
      const calculated = totals(items, money(body.discount), money(body.tax));
      const markPaid = body.action === "cash_payment";
      const action = markPaid ? "cash_payment" : "update";
      const reference = typeof body.payment_reference === "string" ? body.payment_reference : null;
      const values: unknown[] = [JSON.stringify(items), calculated.subtotal, calculated.discount, calculated.tax, calculated.total, action, reference, id];
      let ownership = "id=$8";
      if (user.role !== "super_admin") { values.push(user.company_id); ownership += ` AND company_id=$${values.length}`; }
      const result = await pool.query(
        `UPDATE spa_sales_orders SET line_items=$1::jsonb, subtotal=$2, discount=$3, tax=$4, total=$5,
           payment_method=CASE WHEN $6::text='cash_payment' THEN 'cash' ELSE payment_method END,
           payment_status=CASE WHEN $6::text='cash_payment' THEN 'paid' ELSE payment_status END,
           order_status=CASE WHEN $6::text='cash_payment' THEN 'completed' ELSE order_status END,
           paid_at=CASE WHEN $6::text='cash_payment' THEN CURRENT_TIMESTAMP ELSE paid_at END,
           payment_reference=COALESCE($7,payment_reference)
         WHERE ${ownership} RETURNING *`,
        values
      );
      if (!result.rows[0]) return NextResponse.json({ error: "Sale not found" }, { status: 404 });
      if (markPaid) {
        await pool.query(
          `INSERT INTO spa_sales_payments (company_id, sale_order_id, amount, method, reference, status, paid_by, created_by)
           VALUES ($1,$2,$3,'cash',$4,'paid',$5,$6)`,
          [result.rows[0].company_id, id, calculated.total, typeof body.payment_reference === "string" ? body.payment_reference : null, result.rows[0].customer_name, user.id]
        );
      }
      return ok(result.rows[0]);
    } catch (error) { return salesError(error); }
  });
}
