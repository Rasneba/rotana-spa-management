import pool from "@/lib/db";
import { badRequest, created, err, ok, withAuth } from "@/lib/api-utils";
import QRCode from "qrcode";

type JsonObject = Record<string, unknown>;
function isObject(value: unknown): value is JsonObject { return typeof value === "object" && value !== null && !Array.isArray(value); }
function text(value: unknown, max = 500) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function asDate(value: unknown) { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ""; }
function money(value: unknown) { return Math.max(0, Number(value) || 0); }
function apiError(error: unknown) {
  const code = isObject(error) && typeof error.code === "string" ? error.code : "";
  if (code === "42P01" || code === "42703") return err("Apply db-spa-features.sql, db-migration-v36.sql and db-migration-v42.sql before using membership subscriptions", 503);
  return err(error instanceof Error ? error.message : "Unable to manage memberships");
}
function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
async function makeSubscriptionQr(sub: { id: number; company_id: number; member_id: number; end_date: string; status: string }) {
  const payload = JSON.stringify({ t: "membership_subscription", sid: sub.id, cid: sub.company_id, mid: sub.member_id, exp: sub.end_date, status: sub.status });
  return { qr_code: Buffer.from(payload).toString("base64"), qr_image: await QRCode.toDataURL(payload, { width: 300, margin: 2 }) };
}
async function qrForSubscription(sub: { id: number; company_id: number; member_id: number; end_date: string; status: string }) {
  const qr = await makeSubscriptionQr(sub);
  await pool.query("UPDATE subscriptions SET qr_code=$1, qr_image=$2 WHERE id=$3", [qr.qr_code, qr.qr_image, sub.id]);
  return qr;
}

export async function GET(req: Request) {
  return withAuth(req, async (user) => {
    const admin = user.role === "super_admin";
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const memberId = url.searchParams.get("member_id");
    try {
      let where = admin ? "TRUE" : "s.company_id=$1";
      const params: unknown[] = admin ? [] : [user.company_id];
      let index = admin ? 1 : 2;
      if (status) { where += ` AND s.status=$${index}`; params.push(status); index++; }
      if (memberId) { where += ` AND s.member_id=$${index}`; params.push(Number(memberId)); index++; }
      const result = await pool.query(
        `SELECT s.*, m.full_name AS member_name, m.customer_id AS member_code, m.phone AS member_phone,
                COALESCE(o.title,p.name) AS plan_name,
                COALESCE(o.details->>'classification',p.type) AS plan_type,
                o.details->>'offering_code' AS offering_code,
                COALESCE(NULLIF(o.details->>'duration_days','')::int,p.duration_days,30) AS duration_days,
                COALESCE(s.amount,o.amount,p.price,0) AS display_amount,
                u.name AS created_by_name
         FROM subscriptions s
         LEFT JOIN membership_members m ON m.id=s.member_id
         LEFT JOIN spa_management_records o
           ON o.id=s.offering_id AND o.module_key='catalog/offerings' AND o.deleted_at IS NULL
         LEFT JOIN membership_plans p ON p.id=s.plan_id
         LEFT JOIN users u ON u.id=s.created_by
         WHERE ${where}
         ORDER BY s.created_at DESC`,
        params
      );
      return ok(result.rows);
    } catch (error) { return apiError(error); }
  });
}

export async function POST(req: Request) {
  return withAuth(req, async (user) => {
    try {
      const body: unknown = await req.json();
      if (!isObject(body)) return badRequest("Invalid membership request");
      const memberId = Number(body.member_id);
      const offeringId = Number(body.offering_id);
      if (!memberId || !offeringId) return badRequest("Customer and offering are required");
      const companyId = user.role === "super_admin" && Number(body.company_id) ? Number(body.company_id) : user.company_id;
      if (!companyId) return badRequest("A company is required");
      const [customer, offeringResult] = await Promise.all([
        pool.query(`SELECT id FROM membership_members WHERE id=$1 AND company_id=$2`, [memberId, companyId]),
        pool.query(
          `SELECT id, title, amount, details,
                  COALESCE(NULLIF(details->>'duration_days','')::int,30) AS duration_days
           FROM spa_management_records
           WHERE id=$1 AND company_id=$2 AND module_key='catalog/offerings'
             AND details->>'classification' IN ('membership_plan','package','access_pass')
             AND status='active' AND deleted_at IS NULL`,
          [offeringId, companyId]
        ),
      ]);
      if (customer.rows.length === 0) return badRequest("Customer not found");
      const offering = offeringResult.rows[0];
      if (!offering) return badRequest("Active membership/package offering not found");
      const start = asDate(body.start_date) || new Date().toISOString().slice(0, 10);
      const end = asDate(body.end_date) || addDays(start, Number(offering.duration_days) || 30);
      const amount = body.amount === undefined || body.amount === "" ? money(offering.amount || offering.details?.price) : money(body.amount);
      const result = await pool.query(
        `INSERT INTO subscriptions
          (company_id, member_id, offering_id, start_date, end_date, billing_cycle, amount,
           payment_method, payment_reference, auto_renew, notes, created_by, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'active') RETURNING *`,
        [companyId, memberId, offeringId, start, end, text(body.billing_cycle, 20) || "monthly", amount,
          text(body.payment_method, 40) || "cash", text(body.payment_reference, 200) || null,
          Boolean(body.auto_renew), text(body.notes, 2000) || null, user.id]
      );
      const subscription = result.rows[0];
      const qr = await qrForSubscription(subscription);
      await pool.query(
        `UPDATE membership_members
         SET offering_id=$1, classification='member', start_date=$2,
             end_date=$3, status='active', updated_at=CURRENT_TIMESTAMP
         WHERE id=$4 AND company_id=$5`,
        [offeringId, start, end, memberId, companyId]
      );
      return created({ ...subscription, ...qr });
    } catch (error) { return apiError(error); }
  });
}

export async function PUT(req: Request) {
  return withAuth(req, async (user) => {
    const client = await pool.connect();
    try {
      const body: unknown = await req.json();
      if (!isObject(body)) return badRequest("Invalid membership request");
      const id = Number(body.id);
      if (!id) return badRequest("Membership ID is required");
      const admin = user.role === "super_admin";
      const existing = await client.query(`SELECT * FROM subscriptions WHERE id=$1 AND ($2=true OR company_id=$3)`, [id, admin, user.company_id]);
      if (!existing.rows[0]) return badRequest("Membership not found");
      let current = existing.rows[0];
      const action = text(body.action, 40);
      await client.query("BEGIN");
      if (action === "renew") {
        const newEnd = asDate(body.end_date);
        if (!newEnd) { await client.query("ROLLBACK"); return badRequest("Renewal end date is required"); }
        const result = await client.query(
          `UPDATE subscriptions SET end_date=$1, status='active', amount=COALESCE($2,amount), payment_method=COALESCE($3,payment_method),
             payment_reference=COALESCE($4,payment_reference), notes=COALESCE($5,notes), updated_at=CURRENT_TIMESTAMP
           WHERE id=$6 RETURNING *`,
          [newEnd, body.amount === undefined || body.amount === "" ? null : money(body.amount), text(body.payment_method, 40) || null, text(body.payment_reference, 200) || null, text(body.notes, 2000) || null, id]
        );
        current = result.rows[0];
      } else if (action === "freeze") {
        const freezeStart = asDate(body.freeze_start) || new Date().toISOString().slice(0, 10);
        const freezeEnd = asDate(body.freeze_end);
        if (!freezeEnd) { await client.query("ROLLBACK"); return badRequest("Freeze end date is required"); }
        const result = await client.query(
          `UPDATE subscriptions SET status='frozen', freeze_start=$1, freeze_end=$2, notes=COALESCE($3,notes), updated_at=CURRENT_TIMESTAMP
           WHERE id=$4 RETURNING *`,
          [freezeStart, freezeEnd, text(body.notes, 2000) || null, id]
        );
        current = result.rows[0];
      } else if (action === "unfreeze") {
        const start = current.freeze_start ? new Date(current.freeze_start) : null;
        const end = current.freeze_end ? new Date(current.freeze_end) : null;
        const endDate = new Date(current.end_date);
        if (start && end) {
          const days = Math.ceil((end.getTime() - start.getTime()) / 86_400_000);
          if (days > 0) endDate.setDate(endDate.getDate() + days);
        }
        const result = await client.query(
          `UPDATE subscriptions SET status='active', end_date=$1, freeze_start=NULL, freeze_end=NULL, updated_at=CURRENT_TIMESTAMP
           WHERE id=$2 RETURNING *`,
          [endDate.toISOString().slice(0, 10), id]
        );
        current = result.rows[0];
      } else {
        const result = await client.query(
          `UPDATE subscriptions
           SET offering_id=COALESCE($1,offering_id), end_date=COALESCE($2,end_date), billing_cycle=COALESCE($3,billing_cycle),
               status=COALESCE($4,status), auto_renew=COALESCE($5,auto_renew), amount=COALESCE($6,amount),
               payment_method=COALESCE($7,payment_method), payment_reference=COALESCE($8,payment_reference), notes=COALESCE($9,notes),
               updated_at=CURRENT_TIMESTAMP
           WHERE id=$10 RETURNING *`,
          [Number(body.offering_id) || null, asDate(body.end_date) || null, text(body.billing_cycle, 20) || null, text(body.status, 30) || null,
            body.auto_renew === undefined ? null : Boolean(body.auto_renew), body.amount === undefined || body.amount === "" ? null : money(body.amount),
            text(body.payment_method, 40) || null, text(body.payment_reference, 200) || null, text(body.notes, 2000) || null, id]
        );
        current = result.rows[0];
      }
      const qr = await makeSubscriptionQr(current);
      await client.query("UPDATE subscriptions SET qr_code=$1, qr_image=$2 WHERE id=$3", [qr.qr_code, qr.qr_image, current.id]);
      await client.query(
        `UPDATE membership_members
         SET offering_id=COALESCE($1,offering_id), classification='member', end_date=COALESCE($2,end_date),
             status=CASE WHEN $3='active' THEN 'active' WHEN $3='frozen' THEN 'suspended' WHEN $3 IN ('cancelled','expired','suspended') THEN $3 ELSE status END,
             updated_at=CURRENT_TIMESTAMP
         WHERE id=$4 AND company_id=$5`,
        [current.offering_id || null, current.end_date || null, current.status, current.member_id, current.company_id]
      );
      await client.query("COMMIT");
      return ok({ ...current, ...qr });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      return apiError(error);
    } finally { client.release(); }
  });
}
