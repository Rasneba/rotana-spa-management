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
  if (code === "42P01" || code === "42703") return NextResponse.json({ error: "Apply db-migration-v35.sql before using access control." }, { status: 503 });
  return err(error instanceof Error ? error.message : "Unable to manage access control");
}

export async function GET(req: Request) {
  return withAuth(req, async (user) => {
    const permission = await requirePermission(user, "view", "access_control");
    if (!permission.allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    try {
      const url = new URL(req.url);
      const gateId = Number(url.searchParams.get("gate_id"));
      const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 100, 1), 300);
      const values: unknown[] = [];
      const clauses = ["TRUE"];
      if (user.role !== "super_admin") {
        values.push(user.company_id);
        clauses.push(`l.company_id=$${values.length}`);
      }
      if (Number.isInteger(gateId) && gateId > 0) {
        values.push(gateId);
        clauses.push(`l.gate_id=$${values.length}`);
      }
      values.push(limit);
      const logs = await pool.query(
        `SELECT l.*, g.name AS gate_name, g.code AS gate_code,
                m.full_name AS member_name, m.customer_id AS member_code,
                p.token AS pass_token, p.guest_name
         FROM access_logs l
         LEFT JOIN entry_gates g ON g.id=l.gate_id
         LEFT JOIN membership_members m ON m.id=l.member_id
         LEFT JOIN qr_passes p ON p.id=l.qr_pass_id
         WHERE ${clauses.join(" AND ")}
         ORDER BY l.created_at DESC LIMIT $${values.length}`,
        values
      );

      const isSuper = user.role === "super_admin";
      const companyId = user.company_id || null;
      const [gates, stats, commands] = await Promise.all([
        pool.query(
          `SELECT g.*,
                  (SELECT COUNT(*)::int FROM access_cameras c WHERE c.gate_id=g.id) AS camera_count
           FROM entry_gates g
           WHERE ($1=true OR g.company_id=$2)
           ORDER BY g.name`,
          [isSuper, companyId]
        ),
        pool.query(
          `SELECT COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE status='granted')::int AS granted,
                  COUNT(*) FILTER (WHERE status='denied')::int AS denied,
                  COUNT(*) FILTER (WHERE access_type='entry' AND status='granted')::int AS entries,
                  COUNT(*) FILTER (WHERE access_type='exit' AND status='granted')::int AS exits
           FROM access_logs
           WHERE ($1=true OR company_id=$2) AND created_at::date=CURRENT_DATE`,
          [isSuper, companyId]
        ),
        pool.query(
          `SELECT cmd.*, g.name AS gate_name
           FROM access_device_commands cmd
           JOIN entry_gates g ON g.id=cmd.gate_id
           WHERE ($1=true OR cmd.company_id=$2)
           ORDER BY cmd.requested_at DESC LIMIT 20`,
          [isSuper, companyId]
        ),
      ]);
      return ok({ logs: logs.rows, gates: gates.rows, stats: stats.rows[0], commands: commands.rows });
    } catch (error) {
      return errorResponse(error);
    }
  });
}

export async function POST(req: Request) {
  return withAuth(req, async (user) => {
    const permission = await requirePermission(user, "create", "access_control");
    if (!permission.allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    try {
      const rawBody: unknown = await req.json();
      if (!isObject(rawBody)) return badRequest("Invalid request body");
      const action = typeof rawBody.action === "string" ? rawBody.action : "";
      const gateId = Number(rawBody.gate_id);
      if (!Number.isInteger(gateId) || gateId < 1) return badRequest("Gate is required");
      const gateValues: unknown[] = [gateId];
      let ownership = "id=$1";
      if (user.role !== "super_admin") {
        gateValues.push(user.company_id);
        ownership += ` AND company_id=$${gateValues.length}`;
      }
      const gateResult = await pool.query(`SELECT * FROM entry_gates WHERE ${ownership}`, gateValues);
      if (gateResult.rows.length === 0) return NextResponse.json({ error: "Gate not found" }, { status: 404 });
      const gate = gateResult.rows[0];

      if (action === "open") {
        if (gate.status !== "active") return badRequest("Only active gates can receive door commands");
        const result = await pool.query(
          `INSERT INTO access_device_commands
            (company_id, gate_id, command, requested_by, metadata)
           VALUES ($1,$2,'open',$3,$4::jsonb) RETURNING *`,
          [gate.company_id, gate.id, user.id, JSON.stringify({ source: "web", requested_for: rawBody.reason || "manual access" })]
        );
        const command = result.rows[0];
        await logAudit({ company_id: gate.company_id, user_id: user.id, action: "SUBMIT", table_name: "access_device_commands", record_id: command.id, new_values: command });
        return created({ command, message: "Door-open command queued for the local access relay." });
      }

      if (action === "log") {
        const accessType = rawBody.access_type === "exit" ? "exit" : "entry";
        const status = rawBody.status === "denied" ? "denied" : "granted";
        const memberId = Number(rawBody.member_id) || null;
        if (memberId) {
          const member = await pool.query(`SELECT id FROM membership_members WHERE id=$1 AND company_id=$2`, [memberId, gate.company_id]);
          if (member.rows.length === 0) return badRequest("Member not found");
        }
        const result = await pool.query(
          `INSERT INTO access_logs
            (company_id, gate_id, member_id, access_type, method, status, reason, details)
           VALUES ($1,$2,$3,$4,'manual',$5,$6,$7::jsonb) RETURNING *`,
          [gate.company_id, gate.id, memberId, accessType, status, typeof rawBody.reason === "string" ? rawBody.reason.slice(0, 120) : null, JSON.stringify({ recorded_by: user.id })]
        );
        return created(result.rows[0]);
      }

      return badRequest("Unknown access-control action");
    } catch (error) {
      return errorResponse(error);
    }
  });
}

export async function PUT(req: Request) {
  return withAuth(req, async (user) => {
    const permission = await requirePermission(user, "edit", "access_control");
    if (!permission.allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    try {
      const rawBody: unknown = await req.json();
      if (!isObject(rawBody)) return badRequest("Invalid request body");
      const id = Number(rawBody.id);
      const status = String(rawBody.status || "");
      if (!Number.isInteger(id) || id < 1) return badRequest("Command ID is required");
      if (!["processing", "completed", "failed", "cancelled"].includes(status)) return badRequest("Invalid command status");
      const values: unknown[] = [status, typeof rawBody.response === "string" ? rawBody.response.slice(0, 2_000) : null, id];
      let ownership = "id=$3";
      if (user.role !== "super_admin") {
        values.push(user.company_id);
        ownership += ` AND company_id=$${values.length}`;
      }
      const result = await pool.query(
        `UPDATE access_device_commands
         SET status=$1, response=$2,
             completed_at=CASE WHEN $1 IN ('completed','failed','cancelled') THEN CURRENT_TIMESTAMP ELSE completed_at END
         WHERE ${ownership} RETURNING *`,
        values
      );
      if (result.rows.length === 0) return NextResponse.json({ error: "Command not found" }, { status: 404 });
      return ok(result.rows[0]);
    } catch (error) {
      return errorResponse(error);
    }
  });
}
