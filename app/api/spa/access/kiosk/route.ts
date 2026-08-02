import crypto from "node:crypto";
import { NextResponse } from "next/server";
import QRCode from "qrcode";
import pool from "@/lib/db";
import { badRequest, created, err, withAuth } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorResponse(error: unknown) {
  const code = isObject(error) && typeof error.code === "string" ? error.code : "";
  if (code === "42P01" || code === "42703") return NextResponse.json({ error: "Apply db-migration-v35.sql before using the check-in kiosk." }, { status: 503 });
  return err(error instanceof Error ? error.message : "Unable to complete kiosk check-in");
}

export async function POST(req: Request) {
  return withAuth(req, async (user) => {
    const permission = await requirePermission(user, "create", "access_kiosk");
    if (!permission.allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    if (!user.company_id && user.role !== "super_admin") return badRequest("A company is required");

    const client = await pool.connect();
    try {
      const rawBody: unknown = await req.json();
      if (!isObject(rawBody)) return badRequest("Invalid request body");
      const companyId = user.role === "super_admin" && Number(rawBody.company_id) > 0 ? Number(rawBody.company_id) : user.company_id;
      if (!companyId) return badRequest("A company is required");
      const memberId = Number(rawBody.member_id);
      let customerName = typeof rawBody.customer_name === "string" ? rawBody.customer_name.trim() : "";
      let customerPhone = typeof rawBody.customer_phone === "string" ? rawBody.customer_phone.trim() : "";
      if (Number.isInteger(memberId) && memberId > 0) {
        const member = await client.query(`SELECT id, full_name, phone FROM membership_members WHERE id=$1 AND company_id=$2`, [memberId, companyId]);
        if (member.rows.length === 0) return badRequest("Member not found");
        customerName = member.rows[0].full_name;
        customerPhone = member.rows[0].phone || customerPhone;
      }
      if (!customerName) return badRequest("Select a member or enter a walk-in customer name");

      const facilityId = Number(rawBody.facility_id);
      if (Number.isInteger(facilityId) && facilityId > 0) {
        const facility = await client.query(`SELECT id FROM spa_facilities WHERE id=$1 AND company_id=$2 AND is_active=true`, [facilityId, companyId]);
        if (facility.rows.length === 0) return badRequest("Active Spa/Gym area not found");
      }
      const gateId = Number(rawBody.gate_id);
      if (Number.isInteger(gateId) && gateId > 0) {
        const gate = await client.query(`SELECT id FROM entry_gates WHERE id=$1 AND company_id=$2 AND status='active'`, [gateId, companyId]);
        if (gate.rows.length === 0) return badRequest("Active gate not found");
      }

      await client.query("BEGIN");
      const counter = await client.query(
        `INSERT INTO spa_visit_counters (company_id, current_value)
         VALUES ($1,1)
         ON CONFLICT (company_id)
         DO UPDATE SET current_value=spa_visit_counters.current_value+1,
                       updated_at=CURRENT_TIMESTAMP
         RETURNING current_value`,
        [companyId]
      );
      const visitNo = `SPA-${String(counter.rows[0].current_value).padStart(6, "0")}`;
      const visitResult = await client.query(
        `INSERT INTO spa_visits
          (company_id, visit_no, member_id, customer_name, customer_phone,
           facility_id, notes, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING *`,
        [
          companyId,
          visitNo,
          Number.isInteger(memberId) && memberId > 0 ? memberId : null,
          customerName.slice(0, 200),
          customerPhone.slice(0, 50) || null,
          Number.isInteger(facilityId) && facilityId > 0 ? facilityId : null,
          `Check-In Kiosk${Number.isInteger(facilityId) && facilityId > 0 ? ` · Area ${facilityId}` : ""}`,
          user.id,
        ]
      );
      const visit = visitResult.rows[0];
      const token = crypto.randomBytes(16).toString("hex");
      const issuedAt = new Date();
      const expiry = new Date(issuedAt.getTime() + 24 * 60 * 60 * 1_000);
      const payload = { type: "spa_access", visit: visitNo, token, company: companyId };
      const qrDataUrl = await QRCode.toDataURL(JSON.stringify(payload), { width: 320, margin: 2 });
      const passResult = await client.query(
        `INSERT INTO qr_passes
          (company_id, member_id, pass_type, token, expiry_date, max_uses,
           guest_name, guest_phone, purpose, visit_id, gate_id, issued_by,
           qr_payload, qr_code)
         VALUES ($1,$2,'guest',$3,$4,2,$5,$6,$7,$8,$9,$10,$11::jsonb,$12)
         RETURNING *`,
        [
          companyId,
          Number.isInteger(memberId) && memberId > 0 ? memberId : null,
          token,
          expiry.toISOString().slice(0, 10),
          Number.isInteger(memberId) && memberId > 0 ? null : customerName.slice(0, 200),
          customerPhone.slice(0, 50) || null,
          typeof rawBody.purpose === "string" ? rawBody.purpose.slice(0, 200) : "Spa/Gym visit",
          visit.id,
          Number.isInteger(gateId) && gateId > 0 ? gateId : null,
          user.id,
          JSON.stringify(payload),
          Buffer.from(JSON.stringify(payload)).toString("base64"),
        ]
      );
      await client.query("COMMIT");
      await logAudit({ company_id: companyId, user_id: user.id, action: "CREATE", table_name: "spa_kiosk_checkin", record_id: visit.id, new_values: { visit_no: visitNo, qr_pass_id: passResult.rows[0].id } });
      return created({
        visit,
        pass: { ...passResult.rows[0], qr_data_url: qrDataUrl },
        customer: { full_name: customerName, phone: customerPhone },
        area_id: Number.isInteger(facilityId) && facilityId > 0 ? facilityId : null,
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      return errorResponse(error);
    } finally {
      client.release();
    }
  });
}
