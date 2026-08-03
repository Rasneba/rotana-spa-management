import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { badRequest, created, err, ok, withAuth } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorResponse(error: unknown) {
  const code = isObject(error) && typeof error.code === "string" ? error.code : "";
  if (code === "42703" || code === "42P01") {
    return NextResponse.json({ error: "Apply db-migration-v35.sql before using enhanced access gates." }, { status: 503 });
  }
  return err(error instanceof Error ? error.message : "Unable to manage access gates");
}

export async function GET(req: Request) {
  return withAuth(req, async (user) => {
    const permission = await requirePermission(user, "view", "membership_gates");
    if (!permission.allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    try {
      const url = new URL(req.url);
      const status = url.searchParams.get("status");
      const values: unknown[] = [];
      const clauses = ["TRUE"];
      if (user.role !== "super_admin") {
        values.push(user.company_id);
        clauses.push(`g.company_id=$${values.length}`);
      }
      if (status) {
        values.push(status);
        clauses.push(`g.status=$${values.length}`);
      }
      const result = await pool.query(
        `SELECT g.*,
                (SELECT COUNT(*)::int FROM access_cameras c WHERE c.gate_id=g.id) AS camera_count,
                (SELECT COUNT(*)::int FROM access_device_commands cmd
                 WHERE cmd.gate_id=g.id AND cmd.status IN ('pending','processing')) AS pending_commands
         FROM entry_gates g
         WHERE ${clauses.join(" AND ")}
         ORDER BY g.name`,
        values
      );
      return ok(result.rows);
    } catch (error) {
      return errorResponse(error);
    }
  });
}

export async function POST(req: Request) {
  return withAuth(req, async (user) => {
    const permission = await requirePermission(user, "create", "membership_gates");
    if (!permission.allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    try {
      const rawBody: unknown = await req.json();
      if (!isObject(rawBody)) return badRequest("Invalid request body");
      const name = typeof rawBody.name === "string" ? rawBody.name.trim() : "";
      const suppliedCode = typeof rawBody.code === "string" ? rawBody.code.trim().toUpperCase() : "";
      const code = suppliedCode || `GATE-${Date.now().toString(36).toUpperCase()}`;
      if (!name) return badRequest("Gate name is required");
      const companyId = user.role === "super_admin" && Number(rawBody.company_id) > 0
        ? Number(rawBody.company_id)
        : user.company_id;
      if (!companyId) return badRequest("A company is required");

      const gateType = ["entry", "exit", "both"].includes(String(rawBody.gate_type)) ? String(rawBody.gate_type) : "entry";
      const direction = ["in", "out", "both"].includes(String(rawBody.direction))
        ? String(rawBody.direction)
        : gateType === "entry" ? "in" : gateType === "exit" ? "out" : "both";
      const readerHint = typeof rawBody.reader_type === "string" ? rawBody.reader_type : "both";
      const qrEnabled = rawBody.is_qr_enabled === undefined ? ["qr", "both"].includes(readerHint) : rawBody.is_qr_enabled !== false;
      const rfidEnabled = rawBody.is_rfid_enabled === undefined ? ["rfid", "both"].includes(readerHint) : rawBody.is_rfid_enabled !== false;
      const nfcEnabled = rawBody.is_nfc_enabled === true;
      const readerType = qrEnabled && rfidEnabled ? "both" : qrEnabled ? "qr" : rfidEnabled ? "rfid" : "manual";

      const result = await pool.query(
        `INSERT INTO entry_gates
          (company_id, name, code, location, gate_type, direction, reader_type,
           status, ip_address, port, door_open_delay, is_qr_enabled,
           is_nfc_enabled, is_rfid_enabled, controller_model, notes, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8,$9,$10,$11,$12,$13,$14,$15,true)
         RETURNING *`,
        [
          companyId,
          name.slice(0, 200),
          code.slice(0, 40),
          typeof rawBody.location === "string" ? rawBody.location.slice(0, 200) : null,
          gateType,
          direction,
          readerType,
          typeof rawBody.ip_address === "string" ? rawBody.ip_address.slice(0, 45) : null,
          Number(rawBody.port) || null,
          Math.max(1, Number(rawBody.door_open_delay) || 2),
          qrEnabled,
          nfcEnabled,
          rfidEnabled,
          typeof rawBody.controller_model === "string" ? rawBody.controller_model.slice(0, 100) : null,
          typeof rawBody.notes === "string" ? rawBody.notes.slice(0, 5_000) : null,
        ]
      );
      const gate = result.rows[0];
      await logAudit({ company_id: companyId, user_id: user.id, action: "CREATE", table_name: "entry_gates", record_id: gate.id, new_values: gate });
      return created(gate);
    } catch (error) {
      return errorResponse(error);
    }
  });
}

export async function PUT(req: Request) {
  return withAuth(req, async (user) => {
    const permission = await requirePermission(user, "edit", "membership_gates");
    if (!permission.allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    try {
      const rawBody: unknown = await req.json();
      if (!isObject(rawBody)) return badRequest("Invalid request body");
      const id = Number(rawBody.id);
      if (!Number.isInteger(id) || id < 1) return badRequest("Gate ID is required");
      const oldValues: unknown[] = [id];
      let ownership = "id=$1";
      if (user.role !== "super_admin") {
        oldValues.push(user.company_id);
        ownership += ` AND company_id=$${oldValues.length}`;
      }
      const oldResult = await pool.query(`SELECT * FROM entry_gates WHERE ${ownership}`, oldValues);
      if (oldResult.rows.length === 0) return NextResponse.json({ error: "Gate not found" }, { status: 404 });
      const old = oldResult.rows[0];

      const status = ["active", "inactive", "maintenance"].includes(String(rawBody.status)) ? String(rawBody.status) : old.status;
      const gateType = ["entry", "exit", "both"].includes(String(rawBody.gate_type)) ? String(rawBody.gate_type) : old.gate_type;
      const direction = ["in", "out", "both"].includes(String(rawBody.direction)) ? String(rawBody.direction) : old.direction;
      const qrEnabled = rawBody.is_qr_enabled === undefined ? old.is_qr_enabled : rawBody.is_qr_enabled === true;
      const rfidEnabled = rawBody.is_rfid_enabled === undefined ? old.is_rfid_enabled : rawBody.is_rfid_enabled === true;
      const nfcEnabled = rawBody.is_nfc_enabled === undefined ? old.is_nfc_enabled : rawBody.is_nfc_enabled === true;
      const readerType = qrEnabled && rfidEnabled ? "both" : qrEnabled ? "qr" : rfidEnabled ? "rfid" : "manual";

      const result = await pool.query(
        `UPDATE entry_gates
         SET name=$1, code=$2, location=$3, gate_type=$4, direction=$5,
             reader_type=$6, status=$7, is_active=($7='active'), ip_address=$8,
             port=$9, door_open_delay=$10, is_qr_enabled=$11,
             is_nfc_enabled=$12, is_rfid_enabled=$13,
             controller_model=$14, notes=$15
         WHERE id=$16 RETURNING *`,
        [
          typeof rawBody.name === "string" ? rawBody.name.slice(0, 200) : old.name,
          typeof rawBody.code === "string" ? rawBody.code.trim().toUpperCase().slice(0, 40) : old.code,
          typeof rawBody.location === "string" ? rawBody.location.slice(0, 200) : old.location,
          gateType,
          direction,
          readerType,
          status,
          typeof rawBody.ip_address === "string" ? rawBody.ip_address.slice(0, 45) : old.ip_address,
          rawBody.port === null || rawBody.port === "" ? null : Number(rawBody.port) || old.port,
          Math.max(1, Number(rawBody.door_open_delay) || old.door_open_delay || 2),
          qrEnabled,
          nfcEnabled,
          rfidEnabled,
          typeof rawBody.controller_model === "string" ? rawBody.controller_model.slice(0, 100) : old.controller_model,
          typeof rawBody.notes === "string" ? rawBody.notes.slice(0, 5_000) : old.notes,
          id,
        ]
      );
      const gate = result.rows[0];
      await logAudit({ company_id: gate.company_id, user_id: user.id, action: "UPDATE", table_name: "entry_gates", record_id: gate.id, old_values: old, new_values: gate });
      return ok(gate);
    } catch (error) {
      return errorResponse(error);
    }
  });
}

export async function DELETE(req: Request) {
  return withAuth(req, async (user) => {
    const permission = await requirePermission(user, "delete", "membership_gates");
    if (!permission.allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    try {
      const rawBody: unknown = await req.json();
      if (!isObject(rawBody)) return badRequest("Invalid request body");
      const id = Number(rawBody.id);
      if (!Number.isInteger(id) || id < 1) return badRequest("Gate ID is required");
      const values: unknown[] = [id];
      let ownership = "id=$1";
      if (user.role !== "super_admin") {
        values.push(user.company_id);
        ownership += ` AND company_id=$${values.length}`;
      }
      const result = await pool.query(`DELETE FROM entry_gates WHERE ${ownership} RETURNING *`, values);
      if (result.rows.length === 0) return NextResponse.json({ error: "Gate not found" }, { status: 404 });
      const gate = result.rows[0];
      await logAudit({ company_id: gate.company_id, user_id: user.id, action: "DELETE", table_name: "entry_gates", record_id: gate.id, old_values: gate });
      return ok({ deleted: true });
    } catch (error) {
      return errorResponse(error);
    }
  });
}
