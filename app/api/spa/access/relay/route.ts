import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { badRequest, err, ok } from "@/lib/api-utils";

type JsonObject = Record<string, unknown>;
function isObject(value: unknown): value is JsonObject { return typeof value === "object" && value !== null && !Array.isArray(value); }
function text(value: unknown, max = 500) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function authorized(req: Request) {
  const configured = process.env.ACCESS_RELAY_TOKEN || process.env.RELAY_API_KEY || "";
  if (!configured) return true;
  const header = req.headers.get("authorization") || req.headers.get("x-relay-token") || "";
  return header === configured || header === `Bearer ${configured}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized relay" }, { status: 401 });
  try {
    const url = new URL(req.url);
    const companyId = Number(url.searchParams.get("company_id")) || null;
    const gateId = Number(url.searchParams.get("gate_id")) || null;
    const gateCode = url.searchParams.get("gate_code") || "";
    const values: unknown[] = [];
    const clauses = ["cmd.status='pending'"];
    if (companyId) { values.push(companyId); clauses.push(`cmd.company_id=$${values.length}`); }
    if (gateId) { values.push(gateId); clauses.push(`cmd.gate_id=$${values.length}`); }
    if (gateCode) { values.push(gateCode); clauses.push(`g.code=$${values.length}`); }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `UPDATE access_device_commands cmd
         SET status='processing'
         FROM entry_gates g
         WHERE cmd.id IN (
           SELECT cmd2.id FROM access_device_commands cmd2
           JOIN entry_gates g2 ON g2.id=cmd2.gate_id
           WHERE ${clauses.join(" AND ").replaceAll("cmd.", "cmd2.").replaceAll("g.", "g2.")}
           ORDER BY cmd2.requested_at ASC LIMIT 10 FOR UPDATE SKIP LOCKED
         ) AND g.id=cmd.gate_id
         RETURNING cmd.*, g.name AS gate_name, g.code AS gate_code, g.ip_address, g.port, g.door_open_delay`,
        values
      );
      await client.query("COMMIT");
      return ok({ ok: true, commands: result.rows });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return err(error instanceof Error ? error.message : "Unable to poll relay commands");
  }
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized relay" }, { status: 401 });
  try {
    const body: unknown = await req.json();
    if (!isObject(body)) return badRequest("Invalid relay update");
    const gateId = Number(body.gate_id) || null;
    const gateCode = text(body.gate_code, 80);
    const deviceId = text(body.device_id, 120);
    const commandId = Number(body.command_id || body.id) || null;
    if (gateId || gateCode) {
      const values: unknown[] = [deviceId || null];
      let where = "";
      if (gateId) { values.push(gateId); where = `id=$${values.length}`; }
      else { values.push(gateCode); where = `code=$${values.length}`; }
      await pool.query(`UPDATE entry_gates SET last_seen_at=CURRENT_TIMESTAMP, relay_device_id=COALESCE($1,relay_device_id) WHERE ${where}`, values).catch(() => undefined);
    }
    if (commandId) {
      const status = ["completed", "failed", "cancelled"].includes(text(body.status, 30)) ? text(body.status, 30) : "completed";
      const result = await pool.query(
        `UPDATE access_device_commands
         SET status=$1, response=$2, completed_at=CURRENT_TIMESTAMP
         WHERE id=$3 RETURNING *`,
        [status, text(body.response, 2000) || null, commandId]
      );
      return ok({ ok: true, command: result.rows[0] || null });
    }
    return ok({ ok: true, heartbeat: true });
  } catch (error) {
    return err(error instanceof Error ? error.message : "Unable to update relay status");
  }
}
