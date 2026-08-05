import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { badRequest, err, ok, withAuth } from "@/lib/api-utils";
import { requirePermission } from "@/lib/permissions";
import { checkStatus } from "@/lib/addispay";

type JsonObject = Record<string, unknown>;
function isObject(value: unknown): value is JsonObject { return typeof value === "object" && value !== null && !Array.isArray(value); }
function apiError(error: unknown) {
  const code = isObject(error) && typeof error.code === "string" ? error.code : "";
  if (code === "42P01" || code === "42703") return NextResponse.json({ error: "Apply db-migration-v41.sql before verifying AddisPay." }, { status: 503 });
  return err(error instanceof Error ? error.message : "Unable to verify AddisPay");
}

async function markPaid(uuid: string) {
  const status = await checkStatus(uuid);
  if (status.status !== "success") return { status, sale: null };
  const result = await pool.query(
    `UPDATE spa_sales_orders SET payment_status='paid', order_status='completed', paid_at=CURRENT_TIMESTAMP,
       payment_reference=COALESCE(payment_reference,$1)
     WHERE addispay_uuid=$1 RETURNING *`,
    [uuid]
  );
  const sale = result.rows[0] || null;
  if (sale) {
    await pool.query(
      `UPDATE spa_sales_payments SET status='paid', provider_response=$1::jsonb, paid_at=CURRENT_TIMESTAMP
       WHERE sale_order_id=$2 AND method='addispay' AND reference=$3`,
      [JSON.stringify(status.data || {}), sale.id, uuid]
    );
  }
  return { status, sale };
}

export async function POST(req: Request) {
  return withAuth(req, async (user) => {
    const permission = await requirePermission(user, "edit", "spa_sales");
    if (!permission.allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    try {
      const body: unknown = await req.json();
      if (!isObject(body)) return badRequest("Invalid verify request");
      const saleId = Number(body.sale_order_id || body.id);
      const uuid = typeof body.uuid === "string" ? body.uuid : "";
      if (!saleId && !uuid) return badRequest("Sale or AddisPay UUID is required");
      let resolvedUuid = uuid;
      if (!resolvedUuid) {
        const values: unknown[] = [saleId];
        let ownership = "id=$1";
        if (user.role !== "super_admin") { values.push(user.company_id); ownership += ` AND company_id=$${values.length}`; }
        const sale = await pool.query(`SELECT addispay_uuid FROM spa_sales_orders WHERE ${ownership}`, values);
        resolvedUuid = sale.rows[0]?.addispay_uuid || "";
      }
      if (!resolvedUuid) return badRequest("This sale has no AddisPay checkout");
      const result = await markPaid(resolvedUuid);
      return ok(result);
    } catch (error) { return apiError(error); }
  });
}
