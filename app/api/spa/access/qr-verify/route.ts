import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { badRequest, err, ok, withAuth } from "@/lib/api-utils";
import { requirePermission } from "@/lib/permissions";

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractToken(value: unknown): string {
  if (typeof value !== "string") return "";
  const text = value.trim();
  if (!text) return "";
  try {
    const parsed = JSON.parse(text) as unknown;
    if (isObject(parsed) && typeof parsed.token === "string") return parsed.token;
  } catch {
    // Plain pass tokens are also accepted for scanners without JSON support.
  }
  return text;
}

function errorResponse(error: unknown) {
  const code = isObject(error) && typeof error.code === "string" ? error.code : "";
  if (code === "42P01" || code === "42703") return NextResponse.json({ error: "Apply db-migration-v35.sql before verifying QR access." }, { status: 503 });
  return err(error instanceof Error ? error.message : "Unable to verify QR pass");
}

export async function POST(req: Request) {
  return withAuth(req, async (user) => {
    const permission = await requirePermission(user, "create", "access_control");
    if (!permission.allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    const client = await pool.connect();
    try {
      const rawBody: unknown = await req.json();
      if (!isObject(rawBody)) return badRequest("Invalid request body");
      const token = extractToken(rawBody.code || rawBody.token);
      if (!token) return badRequest("QR token is required");
      await client.query("BEGIN");
      const values: unknown[] = [token];
      let ownership = "p.token=$1";
      if (user.role !== "super_admin") {
        values.push(user.company_id);
        ownership += ` AND p.company_id=$${values.length}`;
      }
      const passResult = await client.query(
        `SELECT p.*, COALESCE(m.full_name,p.guest_name,'Guest') AS customer_name,
                m.customer_id AS member_code, m.status AS member_status
         FROM qr_passes p
         LEFT JOIN membership_members m ON m.id=p.member_id
         WHERE ${ownership} FOR UPDATE OF p`,
        values
      );
      if (passResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "QR pass not found", granted: false }, { status: 404 });
      }
      const pass = passResult.rows[0];
      const gateId = Number(rawBody.gate_id) || pass.gate_id || null;
      if (gateId) {
        const gate = await client.query(`SELECT id FROM entry_gates WHERE id=$1 AND company_id=$2 AND status='active'`, [gateId, pass.company_id]);
        if (gate.rows.length === 0) {
          await client.query("ROLLBACK");
          return badRequest("Active gate not found");
        }
      }
      let granted = true;
      let reason = "ACCESS_GRANTED";
      if (pass.status !== "active") {
        granted = false;
        reason = `PASS_${String(pass.status).toUpperCase()}`;
      } else if (new Date(pass.expiry_date).getTime() < new Date(new Date().toISOString().slice(0, 10)).getTime()) {
        granted = false;
        reason = "PASS_EXPIRED";
      } else if (Number(pass.current_uses) >= Number(pass.max_uses)) {
        granted = false;
        reason = "USE_LIMIT_REACHED";
      } else if (pass.member_id && pass.member_status && pass.member_status !== "active") {
        granted = false;
        reason = "MEMBER_INACTIVE";
      }

      if (granted) {
        const nextUses = Number(pass.current_uses) + 1;
        await client.query(
          `UPDATE qr_passes
           SET current_uses=$1, used_at=CURRENT_TIMESTAMP,
               status=CASE WHEN $1>=max_uses THEN 'used' ELSE status END,
               gate_id=COALESCE($2,gate_id)
           WHERE id=$3`,
          [nextUses, gateId, pass.id]
        );
      }
      const accessType = rawBody.access_type === "exit" ? "exit" : "entry";
      const logResult = await client.query(
        `INSERT INTO access_logs
          (company_id, gate_id, member_id, visit_id, qr_pass_id,
           access_type, method, status, reason, details)
         VALUES ($1,$2,$3,$4,$5,$6,'qr',$7,$8,$9::jsonb)
         RETURNING *`,
        [
          pass.company_id,
          gateId,
          pass.member_id,
          pass.visit_id,
          pass.id,
          accessType,
          granted ? "granted" : "denied",
          reason,
          JSON.stringify({ verified_by: user.id, pass_type: pass.pass_type }),
        ]
      );
      await client.query("COMMIT");
      return ok({
        granted,
        reason,
        customer: { name: pass.customer_name, member_code: pass.member_code },
        pass: { id: pass.id, type: pass.pass_type, current_uses: Number(pass.current_uses) + (granted ? 1 : 0), max_uses: pass.max_uses, expiry_date: pass.expiry_date },
        access_log: logResult.rows[0],
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      return errorResponse(error);
    } finally {
      client.release();
    }
  });
}
