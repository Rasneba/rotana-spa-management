import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { badRequest, created, err, ok, withAuth } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { can, requirePermission } from "@/lib/permissions";

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorResponse(error: unknown) {
  const code = isObject(error) && typeof error.code === "string" ? error.code : "";
  if (code === "42P01") return NextResponse.json({ error: "Apply db-migration-v35.sql before managing access cameras." }, { status: 503 });
  return err(error instanceof Error ? error.message : "Unable to manage cameras");
}

export async function GET(req: Request) {
  return withAuth(req, async (user) => {
    const permission = await requirePermission(user, "view", "access_cameras");
    if (!permission.allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    try {
      const values: unknown[] = [];
      const clauses = ["TRUE"];
      if (user.role !== "super_admin") {
        values.push(user.company_id);
        clauses.push(`c.company_id=$${values.length}`);
      }
      const result = await pool.query(
        `SELECT c.*, g.name AS gate_name, g.code AS gate_code,
                f.name AS facility_name
         FROM access_cameras c
         LEFT JOIN entry_gates g ON g.id=c.gate_id
         LEFT JOIN spa_facilities f ON f.id=c.facility_id
         WHERE ${clauses.join(" AND ")}
         ORDER BY c.name`,
        values
      );
      const [canCreate, canEdit, canDelete] = await Promise.all([
        can(user, "create", "access_cameras"),
        can(user, "edit", "access_cameras"),
        can(user, "delete", "access_cameras"),
      ]);
      return ok({ cameras: result.rows, capabilities: { create: canCreate, edit: canEdit, delete: canDelete } });
    } catch (error) {
      return errorResponse(error);
    }
  });
}

export async function POST(req: Request) {
  return withAuth(req, async (user) => {
    const permission = await requirePermission(user, "create", "access_cameras");
    if (!permission.allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    try {
      const rawBody: unknown = await req.json();
      if (!isObject(rawBody)) return badRequest("Invalid request body");
      const name = typeof rawBody.name === "string" ? rawBody.name.trim() : "";
      const code = typeof rawBody.code === "string" ? rawBody.code.trim().toUpperCase() : "";
      const protocol = ["http", "rtsp", "onvif", "webcam"].includes(String(rawBody.protocol)) ? String(rawBody.protocol) : "http";
      if (!name || !code) return badRequest("Camera name and code are required");
      if (protocol !== "webcam" && !String(rawBody.ip_address || "").trim()) return badRequest("IP address is required for network cameras");
      const companyId = user.role === "super_admin" && Number(rawBody.company_id) > 0 ? Number(rawBody.company_id) : user.company_id;
      if (!companyId) return badRequest("A company is required");

      const result = await pool.query(
        `INSERT INTO access_cameras
          (company_id, gate_id, facility_id, name, code, purpose, direction,
           protocol, ip_address, port, stream_url, device_id, status,
           notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'active',$13,$14)
         RETURNING *`,
        [
          companyId,
          Number(rawBody.gate_id) || null,
          Number(rawBody.facility_id) || null,
          name.slice(0, 120),
          code.slice(0, 40),
          ["security", "occupancy", "check_in", "safety", "other"].includes(String(rawBody.purpose)) ? String(rawBody.purpose) : "security",
          ["in", "out", "both"].includes(String(rawBody.direction)) ? String(rawBody.direction) : "both",
          protocol,
          protocol === "webcam" ? null : String(rawBody.ip_address).slice(0, 45),
          protocol === "webcam" ? null : Number(rawBody.port) || 80,
          typeof rawBody.stream_url === "string" ? rawBody.stream_url.slice(0, 2_000) : null,
          typeof rawBody.device_id === "string" ? rawBody.device_id.slice(0, 1_000) : null,
          typeof rawBody.notes === "string" ? rawBody.notes.slice(0, 5_000) : null,
          user.id,
        ]
      );
      const camera = result.rows[0];
      await logAudit({ company_id: companyId, user_id: user.id, action: "CREATE", table_name: "access_cameras", record_id: camera.id, new_values: camera });
      return created(camera);
    } catch (error) {
      return errorResponse(error);
    }
  });
}

export async function PUT(req: Request) {
  return withAuth(req, async (user) => {
    const permission = await requirePermission(user, "edit", "access_cameras");
    if (!permission.allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    try {
      const rawBody: unknown = await req.json();
      if (!isObject(rawBody)) return badRequest("Invalid request body");
      const id = Number(rawBody.id);
      if (!Number.isInteger(id) || id < 1) return badRequest("Camera ID is required");
      const values: unknown[] = [id];
      let ownership = "id=$1";
      if (user.role !== "super_admin") {
        values.push(user.company_id);
        ownership += ` AND company_id=$${values.length}`;
      }
      const oldResult = await pool.query(`SELECT * FROM access_cameras WHERE ${ownership}`, values);
      if (oldResult.rows.length === 0) return NextResponse.json({ error: "Camera not found" }, { status: 404 });
      const old = oldResult.rows[0];
      const protocol = ["http", "rtsp", "onvif", "webcam"].includes(String(rawBody.protocol)) ? String(rawBody.protocol) : old.protocol;
      const status = ["active", "inactive", "offline", "maintenance"].includes(String(rawBody.status)) ? String(rawBody.status) : old.status;
      const result = await pool.query(
        `UPDATE access_cameras
         SET gate_id=$1, facility_id=$2, name=$3, code=$4, purpose=$5,
             direction=$6, protocol=$7, ip_address=$8, port=$9,
             stream_url=$10, device_id=$11, status=$12, notes=$13
         WHERE id=$14 RETURNING *`,
        [
          rawBody.gate_id === "" || rawBody.gate_id === null ? null : Number(rawBody.gate_id) || old.gate_id,
          rawBody.facility_id === "" || rawBody.facility_id === null ? null : Number(rawBody.facility_id) || old.facility_id,
          typeof rawBody.name === "string" ? rawBody.name.trim().slice(0, 120) : old.name,
          typeof rawBody.code === "string" ? rawBody.code.trim().toUpperCase().slice(0, 40) : old.code,
          ["security", "occupancy", "check_in", "safety", "other"].includes(String(rawBody.purpose)) ? String(rawBody.purpose) : old.purpose,
          ["in", "out", "both"].includes(String(rawBody.direction)) ? String(rawBody.direction) : old.direction,
          protocol,
          protocol === "webcam" ? null : typeof rawBody.ip_address === "string" ? rawBody.ip_address.slice(0, 45) : old.ip_address,
          protocol === "webcam" ? null : Number(rawBody.port) || old.port,
          typeof rawBody.stream_url === "string" ? rawBody.stream_url.slice(0, 2_000) : old.stream_url,
          typeof rawBody.device_id === "string" ? rawBody.device_id.slice(0, 1_000) : old.device_id,
          status,
          typeof rawBody.notes === "string" ? rawBody.notes.slice(0, 5_000) : old.notes,
          id,
        ]
      );
      const camera = result.rows[0];
      await logAudit({ company_id: camera.company_id, user_id: user.id, action: "UPDATE", table_name: "access_cameras", record_id: camera.id, old_values: old, new_values: camera });
      return ok(camera);
    } catch (error) {
      return errorResponse(error);
    }
  });
}

export async function DELETE(req: Request) {
  return withAuth(req, async (user) => {
    const permission = await requirePermission(user, "delete", "access_cameras");
    if (!permission.allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    try {
      const rawBody: unknown = await req.json();
      if (!isObject(rawBody)) return badRequest("Invalid request body");
      const id = Number(rawBody.id);
      if (!Number.isInteger(id) || id < 1) return badRequest("Camera ID is required");
      const values: unknown[] = [id];
      let ownership = "id=$1";
      if (user.role !== "super_admin") {
        values.push(user.company_id);
        ownership += ` AND company_id=$${values.length}`;
      }
      const result = await pool.query(`DELETE FROM access_cameras WHERE ${ownership} RETURNING *`, values);
      if (result.rows.length === 0) return NextResponse.json({ error: "Camera not found" }, { status: 404 });
      const camera = result.rows[0];
      await logAudit({ company_id: camera.company_id, user_id: user.id, action: "DELETE", table_name: "access_cameras", record_id: camera.id, old_values: camera });
      return ok({ deleted: true });
    } catch (error) {
      return errorResponse(error);
    }
  });
}
