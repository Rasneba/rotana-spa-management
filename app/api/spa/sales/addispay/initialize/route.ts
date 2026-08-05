import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { badRequest, err, ok, withAuth } from "@/lib/api-utils";
import { requirePermission } from "@/lib/permissions";
import { createOrder } from "@/lib/addispay";

type JsonObject = Record<string, unknown>;
function isObject(value: unknown): value is JsonObject { return typeof value === "object" && value !== null && !Array.isArray(value); }
function apiError(error: unknown) {
  const code = isObject(error) && typeof error.code === "string" ? error.code : "";
  if (code === "42P01" || code === "42703") return NextResponse.json({ error: "Apply db-migration-v41.sql before using Spa Sales AddisPay." }, { status: 503 });
  return err(error instanceof Error ? error.message : "Unable to initialize AddisPay");
}

export async function POST(req: Request) {
  return withAuth(req, async (user) => {
    const permission = await requirePermission(user, "edit", "spa_sales");
    if (!permission.allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    try {
      const body: unknown = await req.json();
      if (!isObject(body)) return badRequest("Invalid AddisPay request");
      const saleId = Number(body.sale_order_id || body.id);
      const phone = typeof body.phone_number === "string" ? body.phone_number.trim() : "";
      const email = typeof body.email === "string" ? body.email.trim() : "customer@dagispa.com";
      if (!saleId) return badRequest("Sale order is required");
      if (!phone) return badRequest("Phone number is required for AddisPay");
      const values: unknown[] = [saleId];
      let ownership = "id=$1";
      if (user.role !== "super_admin") { values.push(user.company_id); ownership += ` AND company_id=$${values.length}`; }
      const saleResult = await pool.query(`SELECT * FROM spa_sales_orders WHERE ${ownership}`, values);
      const sale = saleResult.rows[0];
      if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });
      if (sale.payment_status === "paid") return badRequest("Sale is already paid");
      if (Number(sale.total) <= 0) return badRequest("Set sale prices before AddisPay checkout");
      const txRef = `SPA-${sale.company_id}-${sale.id}-${Date.now()}`;
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
      const nameParts = String(sale.customer_name || "Dagi Customer").split(/\s+/);
      const result = await createOrder({
        amount: Number(sale.total),
        first_name: nameParts[0] || "Dagi",
        last_name: nameParts.slice(1).join(" "),
        email,
        phone_number: phone,
        tx_ref: txRef,
        nonce: `${sale.id}-${Date.now()}`,
        redirect_url: `${appUrl}/dashboard/spa/sales?sale=${sale.id}`,
        success_url: `${appUrl}/api/spa/sales/addispay/callback?tx_ref=${txRef}`,
        cancel_url: `${appUrl}/dashboard/spa/sales?sale=${sale.id}`,
        error_url: `${appUrl}/dashboard/spa/sales?sale=${sale.id}`,
        order_reason: `Dagi Spa invoice ${sale.invoice_no}`,
        order_detail: { invoice_no: sale.invoice_no, sale_order_id: sale.id, items: sale.line_items },
      });
      if (result.status !== "success" || !result.data) return NextResponse.json(result, { status: 502 });
      const updated = await pool.query(
        `UPDATE spa_sales_orders SET payment_method='addispay', payment_status='pending', tx_ref=$1,
           addispay_uuid=$2, addispay_checkout_url=$3
         WHERE id=$4 RETURNING *`,
        [txRef, result.data.uuid, result.data.checkout_url, sale.id]
      );
      await pool.query(
        `INSERT INTO spa_sales_payments (company_id, sale_order_id, amount, method, reference, status, paid_by, created_by)
         VALUES ($1,$2,$3,'addispay',$4,'pending',$5,$6)`,
        [sale.company_id, sale.id, Number(sale.total), result.data.uuid, sale.customer_name, user.id]
      );
      return ok({ status: "success", data: result.data, sale: updated.rows[0] });
    } catch (error) { return apiError(error); }
  });
}
