import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { checkStatus } from "@/lib/addispay";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const txRef = url.searchParams.get("tx_ref") || "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || url.origin;
  if (!txRef) return NextResponse.redirect(`${appUrl}/dashboard/spa/sales?payment=missing`);
  const saleResult = await pool.query(`SELECT * FROM spa_sales_orders WHERE tx_ref=$1`, [txRef]);
  const sale = saleResult.rows[0];
  if (!sale?.addispay_uuid) return NextResponse.redirect(`${appUrl}/dashboard/spa/sales?payment=not-found`);
  const status = await checkStatus(sale.addispay_uuid);
  if (status.status === "success") {
    await pool.query(
      `UPDATE spa_sales_orders SET payment_status='paid', order_status='completed', paid_at=CURRENT_TIMESTAMP,
         payment_reference=COALESCE(payment_reference,$1)
       WHERE id=$2`,
      [sale.addispay_uuid, sale.id]
    );
    await pool.query(
      `UPDATE spa_sales_payments SET status='paid', provider_response=$1::jsonb, paid_at=CURRENT_TIMESTAMP
       WHERE sale_order_id=$2 AND method='addispay' AND reference=$3`,
      [JSON.stringify(status.data || {}), sale.id, sale.addispay_uuid]
    );
    return NextResponse.redirect(`${appUrl}/dashboard/spa/sales?sale=${sale.id}&payment=success`);
  }
  await pool.query(`UPDATE spa_sales_orders SET payment_status='failed' WHERE id=$1 AND payment_status='pending'`, [sale.id]);
  return NextResponse.redirect(`${appUrl}/dashboard/spa/sales?sale=${sale.id}&payment=${encodeURIComponent(status.status)}`);
}
