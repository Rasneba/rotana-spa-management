import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { badRequest, created, err, ok, withAuth, type AuthUser } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { can, requirePermission, type PermissionAction } from "@/lib/permissions";
import { getSpaModule, type SpaFieldDefinition, type SpaModuleDefinition } from "@/lib/spa-modules";

type RouteParams = { params: Promise<{ section: string; module: string }> };
type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected database error";
}

function databaseError(error: unknown) {
  const code = isObject(error) && typeof error.code === "string" ? error.code : "";
  if (code === "42P01") {
    return NextResponse.json(
      { error: "Spa management tables are not installed. Apply db-migration-v33.sql." },
      { status: 503 }
    );
  }
  return err(errorMessage(error));
}

async function authorize(user: AuthUser, action: PermissionAction, definition: SpaModuleDefinition) {
  const permission = await requirePermission(user, action, definition.resource);
  if (!permission.allowed) {
    return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  }
  return null;
}

function getCompanyId(user: AuthUser, requested?: unknown): number | null {
  if (user.role === "super_admin") {
    const value = Number(requested);
    return Number.isInteger(value) && value > 0 ? value : null;
  }
  return typeof user.company_id === "number" && user.company_id > 0 ? user.company_id : null;
}

function normalizeField(field: SpaFieldDefinition, raw: unknown): string | number | null {
  if (raw === undefined || raw === null || raw === "") return null;

  if (field.type === "number" || field.type === "currency") {
    const number = Number(raw);
    return Number.isFinite(number) ? number : null;
  }

  const value = String(raw).trim();
  const maxLength = field.type === "textarea" ? 10_000 : 1_000;
  return value.slice(0, maxLength);
}

function validateAndNormalize(
  definition: SpaModuleDefinition,
  body: JsonObject
): { details?: Record<string, string | number | null>; error?: string } {
  const source = isObject(body.details) ? body.details : body;
  const details: Record<string, string | number | null> = {};

  for (const field of definition.fields) {
    const value = normalizeField(field, source[field.key]);
    if (field.required && (value === null || value === "")) {
      return { error: `${field.label} is required` };
    }
    if (typeof value === "number") {
      if (field.min !== undefined && value < field.min) return { error: `${field.label} must be at least ${field.min}` };
      if (field.max !== undefined && value > field.max) return { error: `${field.label} must not exceed ${field.max}` };
    }
    if (field.options && value !== null && !field.options.includes(String(value))) {
      return { error: `${field.label} has an invalid value` };
    }
    if ((field.type === "date" || field.type === "datetime-local") && typeof value === "string") {
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return { error: `${field.label} must be a valid date` };
    }
    if (field.type === "email" && typeof value === "string" && !/^\S+@\S+\.\S+$/.test(value)) {
      return { error: `${field.label} must be a valid email address` };
    }
    if (field.type === "url" && typeof value === "string") {
      try {
        new URL(value);
      } catch {
        return { error: `${field.label} must be a valid URL` };
      }
    }
    details[field.key] = value;
  }

  return { details };
}

function normalizedStatus(definition: SpaModuleDefinition, value: unknown): string | null {
  const status = typeof value === "string" ? value : definition.defaultStatus;
  return definition.statusOptions.includes(status) ? status : null;
}

function applyDerivedValues(
  definition: SpaModuleDefinition,
  details: Record<string, string | number | null>,
  currentStatus: string
): string {
  if (definition.key === "gym/body-measurements" && !details.bmi) {
    const weight = Number(details.weight);
    const heightMeters = Number(details.height) / 100;
    if (weight > 0 && heightMeters > 0) {
      details.bmi = Number((weight / (heightMeters * heightMeters)).toFixed(1));
    }
  }

  if (definition.key === "staff/commission" && !details.commission_amount) {
    const base = Number(details.base_amount);
    const rate = Number(details.rate);
    if (base >= 0 && rate >= 0) details.commission_amount = Number((base * rate / 100).toFixed(2));
  }

  if (["inventory/products", "inventory/consumables"].includes(definition.key)
      && !["inactive", "expired"].includes(currentStatus)) {
    const quantity = Number(details.quantity || 0);
    const reorder = Number(details.reorder_level || 0);
    if (quantity <= 0) return "out-of-stock";
    if (reorder > 0 && quantity <= reorder) return "low-stock";
    return "in-stock";
  }

  if (definition.key === "gym/classes" && ["scheduled", "open", "full"].includes(currentStatus)) {
    const capacity = Number(details.capacity || 0);
    const enrolled = Number(details.enrolled || 0);
    if (capacity > 0 && enrolled >= capacity) return "full";
    if (currentStatus === "full" && enrolled < capacity) return "open";
  }

  if (definition.key === "operations/towel-management"
      && !["lost", "laundry"].includes(currentStatus)) {
    const issued = Number(details.issued_quantity || 0);
    const returned = Number(details.returned_quantity || 0);
    if (issued > 0 && returned >= issued) return "returned";
    if (returned > 0) return "partially-returned";
    return "issued";
  }

  return currentStatus;
}

function recordCode(definition: SpaModuleDefinition): string {
  const prefix = definition.slug
    .split("-")
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 5);
  return `${prefix || "SPA"}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function GET(req: Request, { params }: RouteParams) {
  const { section, module } = await params;
  const definition = getSpaModule(section, module);
  if (!definition) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  return withAuth(req, async (user) => {
    const denied = await authorize(user, "view", definition);
    if (denied) return denied;

    try {
      const url = new URL(req.url);
      const query = (url.searchParams.get("q") || "").trim().slice(0, 120);
      const status = (url.searchParams.get("status") || "").trim();
      const requestedCompany = url.searchParams.get("company_id");
      const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 100, 1), 250);
      const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);

      const values: unknown[] = [definition.key];
      const clauses = ["module_key = $1", "deleted_at IS NULL"];
      const companyId = user.role === "super_admin"
        ? (requestedCompany ? Number(requestedCompany) : null)
        : user.company_id;

      if (companyId) {
        values.push(companyId);
        clauses.push(`company_id = $${values.length}`);
      }
      if (query) {
        values.push(`%${query}%`);
        clauses.push(`(title ILIKE $${values.length} OR record_code ILIKE $${values.length} OR details::text ILIKE $${values.length})`);
      }
      if (status) {
        values.push(status);
        clauses.push(`status = $${values.length}`);
      }

      values.push(limit, offset);
      const recordsResult = await pool.query(
        `SELECT id, company_id, module_key, record_code, title, status, record_date,
                amount, details, created_by, updated_by, created_at, updated_at,
                COUNT(*) OVER()::int AS filtered_count
         FROM spa_management_records
         WHERE ${clauses.join(" AND ")}
         ORDER BY record_date DESC NULLS LAST, created_at DESC
         LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values
      );

      const summaryValues: unknown[] = [definition.key];
      const summaryClauses = ["module_key = $1", "deleted_at IS NULL"];
      if (companyId) {
        summaryValues.push(companyId);
        summaryClauses.push(`company_id = $${summaryValues.length}`);
      }
      const summaryResult = await pool.query(
        `SELECT COUNT(*)::int AS total,
                COALESCE(SUM(amount), 0)::numeric AS total_amount,
                COUNT(*) FILTER (WHERE record_date::date = CURRENT_DATE)::int AS today
         FROM spa_management_records
         WHERE ${summaryClauses.join(" AND ")}`,
        summaryValues
      );
      const statusResult = await pool.query(
        `SELECT status, COUNT(*)::int AS count
         FROM spa_management_records
         WHERE ${summaryClauses.join(" AND ")}
         GROUP BY status ORDER BY status`,
        summaryValues
      );

      const [canCreate, canEdit, canDelete, canApprove] = await Promise.all([
        can(user, "create", definition.resource),
        can(user, "edit", definition.resource),
        can(user, "delete", definition.resource),
        can(user, "approve", definition.resource),
      ]);

      return ok({
        records: recordsResult.rows,
        filteredCount: recordsResult.rows[0]?.filtered_count || 0,
        summary: {
          ...summaryResult.rows[0],
          statuses: Object.fromEntries(statusResult.rows.map((row) => [row.status, row.count])),
        },
        capabilities: { create: canCreate, edit: canEdit, delete: canDelete, approve: canApprove },
      });
    } catch (error) {
      return databaseError(error);
    }
  });
}

export async function POST(req: Request, { params }: RouteParams) {
  const { section, module } = await params;
  const definition = getSpaModule(section, module);
  if (!definition) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  return withAuth(req, async (user) => {
    const denied = await authorize(user, "create", definition);
    if (denied) return denied;

    try {
      const rawBody: unknown = await req.json();
      if (!isObject(rawBody)) return badRequest("Invalid request body");
      const companyId = getCompanyId(user, rawBody.company_id);
      if (!companyId) return badRequest("A company is required");

      const normalized = validateAndNormalize(definition, rawBody);
      if (normalized.error || !normalized.details) return badRequest(normalized.error || "Invalid record");
      let status = normalizedStatus(definition, rawBody.status);
      if (!status) return badRequest("Invalid status");
      status = applyDerivedValues(definition, normalized.details, status);

      const titleValue = normalized.details[definition.primaryField];
      if (titleValue === null || titleValue === undefined || String(titleValue).trim() === "") {
        return badRequest(`${definition.singular} title is required`);
      }
      const recordDate = definition.dateField ? normalized.details[definition.dateField] : null;
      const amount = definition.amountField ? normalized.details[definition.amountField] : null;

      const result = await pool.query(
        `INSERT INTO spa_management_records
          (company_id, module_key, record_code, title, status, record_date, amount,
           details, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$9)
         RETURNING *`,
        [
          companyId,
          definition.key,
          recordCode(definition),
          String(titleValue).slice(0, 240),
          status,
          recordDate || null,
          typeof amount === "number" ? amount : null,
          JSON.stringify(normalized.details),
          user.id,
        ]
      );
      const record = result.rows[0];
      await logAudit({
        company_id: companyId,
        user_id: user.id,
        action: "CREATE",
        table_name: `spa_management_records:${definition.key}`,
        record_id: record.id,
        new_values: record,
      });
      return created(record);
    } catch (error) {
      return databaseError(error);
    }
  });
}

export async function PUT(req: Request, { params }: RouteParams) {
  const { section, module } = await params;
  const definition = getSpaModule(section, module);
  if (!definition) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  return withAuth(req, async (user) => {
    const denied = await authorize(user, "edit", definition);
    if (denied) return denied;

    try {
      const rawBody: unknown = await req.json();
      if (!isObject(rawBody)) return badRequest("Invalid request body");
      const id = Number(rawBody.id);
      if (!Number.isInteger(id) || id < 1) return badRequest("Record ID is required");

      const normalized = validateAndNormalize(definition, rawBody);
      if (normalized.error || !normalized.details) return badRequest(normalized.error || "Invalid record");
      let status = normalizedStatus(definition, rawBody.status);
      if (!status) return badRequest("Invalid status");
      status = applyDerivedValues(definition, normalized.details, status);
      const titleValue = normalized.details[definition.primaryField];
      if (titleValue === null || titleValue === undefined || String(titleValue).trim() === "") {
        return badRequest(`${definition.singular} title is required`);
      }

      const ownershipValues: unknown[] = [id, definition.key];
      let ownership = "id = $1 AND module_key = $2 AND deleted_at IS NULL";
      if (user.role !== "super_admin") {
        ownershipValues.push(user.company_id);
        ownership += ` AND company_id = $${ownershipValues.length}`;
      }
      const oldResult = await pool.query(
        `SELECT * FROM spa_management_records WHERE ${ownership}`,
        ownershipValues
      );
      if (oldResult.rows.length === 0) {
        return NextResponse.json({ error: `${definition.singular} not found` }, { status: 404 });
      }

      const recordDate = definition.dateField ? normalized.details[definition.dateField] : null;
      const amount = definition.amountField ? normalized.details[definition.amountField] : null;
      const updateValues: unknown[] = [
        String(titleValue).slice(0, 240),
        status,
        recordDate || null,
        typeof amount === "number" ? amount : null,
        JSON.stringify(normalized.details),
        user.id,
        id,
        definition.key,
      ];
      let updateOwnership = "id = $7 AND module_key = $8 AND deleted_at IS NULL";
      if (user.role !== "super_admin") {
        updateValues.push(user.company_id);
        updateOwnership += ` AND company_id = $${updateValues.length}`;
      }

      const result = await pool.query(
        `UPDATE spa_management_records
         SET title=$1, status=$2, record_date=$3, amount=$4, details=$5::jsonb, updated_by=$6
         WHERE ${updateOwnership}
         RETURNING *`,
        updateValues
      );
      const record = result.rows[0];
      await logAudit({
        company_id: record.company_id,
        user_id: user.id,
        action: "UPDATE",
        table_name: `spa_management_records:${definition.key}`,
        record_id: record.id,
        old_values: oldResult.rows[0],
        new_values: record,
      });
      return ok(record);
    } catch (error) {
      return databaseError(error);
    }
  });
}

export async function DELETE(req: Request, { params }: RouteParams) {
  const { section, module } = await params;
  const definition = getSpaModule(section, module);
  if (!definition) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  return withAuth(req, async (user) => {
    const denied = await authorize(user, "delete", definition);
    if (denied) return denied;

    try {
      const rawBody: unknown = await req.json();
      if (!isObject(rawBody)) return badRequest("Invalid request body");
      const id = Number(rawBody.id);
      if (!Number.isInteger(id) || id < 1) return badRequest("Record ID is required");

      const values: unknown[] = [id, definition.key, user.id];
      let ownership = "id = $1 AND module_key = $2 AND deleted_at IS NULL";
      if (user.role !== "super_admin") {
        values.push(user.company_id);
        ownership += ` AND company_id = $${values.length}`;
      }
      const result = await pool.query(
        `UPDATE spa_management_records
         SET deleted_at=CURRENT_TIMESTAMP, updated_by=$3
         WHERE ${ownership}
         RETURNING *`,
        values
      );
      if (result.rows.length === 0) {
        return NextResponse.json({ error: `${definition.singular} not found` }, { status: 404 });
      }
      const record = result.rows[0];
      await logAudit({
        company_id: record.company_id,
        user_id: user.id,
        action: "DELETE",
        table_name: `spa_management_records:${definition.key}`,
        record_id: record.id,
        old_values: record,
      });
      return ok({ deleted: true, id: record.id });
    } catch (error) {
      return databaseError(error);
    }
  });
}
