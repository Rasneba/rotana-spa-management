import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { badRequest, err, ok, withAuth } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { can, requirePermission } from "@/lib/permissions";

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function apiError(error: unknown) {
  const code = isObject(error) && typeof error.code === "string" ? error.code : "";
  if (code === "42P01") return NextResponse.json({ error: "Apply db-migration-v34.sql before viewing service orders." }, { status: 503 });
  return err(error instanceof Error ? error.message : "Unable to load service orders");
}

export async function GET(req: Request) {
  return withAuth(req, async (user) => {
    const permission = await requirePermission(user, "view", "spa_service_orders");
    if (!permission.allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    try {
      const url = new URL(req.url);
      const values: unknown[] = [];
      const clauses = ["TRUE"];
      if (user.role !== "super_admin") {
        values.push(user.company_id);
        clauses.push(`so.company_id=$${values.length}`);
      } else {
        const requestedCompany = Number(url.searchParams.get("company_id"));
        if (Number.isInteger(requestedCompany) && requestedCompany > 0) {
          values.push(requestedCompany);
          clauses.push(`so.company_id=$${values.length}`);
        }
      }
      const status = url.searchParams.get("status");
      if (status) {
        values.push(status);
        clauses.push(`so.status=$${values.length}`);
      }
      const query = (url.searchParams.get("q") || "").trim().slice(0, 120);
      if (query) {
        values.push(`%${query}%`);
        clauses.push(`(so.order_no ILIKE $${values.length} OR v.visit_no ILIKE $${values.length} OR v.customer_name ILIKE $${values.length} OR v.therapist_name ILIKE $${values.length})`);
      }
      const from = url.searchParams.get("from");
      if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
        values.push(from);
        clauses.push(`so.generated_at::date >= $${values.length}::date`);
      }
      const to = url.searchParams.get("to");
      if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
        values.push(to);
        clauses.push(`so.generated_at::date <= $${values.length}::date`);
      }

      const result = await pool.query(
        `SELECT so.*, v.visit_no, v.customer_name, v.therapist_name,
                v.checked_in_at, v.finished_at
         FROM spa_service_orders so
         JOIN spa_visits v ON v.id=so.visit_id
         WHERE ${clauses.join(" AND ")}
         ORDER BY so.generated_at DESC
         LIMIT 250`,
        values
      );
      const summaryResult = await pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status='draft')::int AS drafts,
                COUNT(*) FILTER (WHERE status='printed')::int AS printed,
                COUNT(*) FILTER (WHERE status='handed_to_cashier')::int AS handed_to_cashier,
                COALESCE(SUM(total_items), 0)::int AS total_items
         FROM spa_service_orders
         WHERE ${user.role === "super_admin" ? "TRUE" : "company_id=$1"}`,
        user.role === "super_admin" ? [] : [user.company_id]
      );
      const [canCreate, canEdit] = await Promise.all([
        can(user, "create", "spa_service_orders"),
        can(user, "edit", "spa_service_orders"),
      ]);
      return ok({ orders: result.rows, summary: summaryResult.rows[0], capabilities: { create: canCreate, edit: canEdit } });
    } catch (error) {
      return apiError(error);
    }
  });
}

export async function PUT(req: Request) {
  return withAuth(req, async (user) => {
    const permission = await requirePermission(user, "edit", "spa_service_orders");
    if (!permission.allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    try {
      const rawBody: unknown = await req.json();
      if (!isObject(rawBody)) return badRequest("Invalid request body");
      const id = Number(rawBody.id);
      if (!Number.isInteger(id) || id < 1) return badRequest("Service order ID is required");
      if (rawBody.action !== "void") return badRequest("Invalid service-order action");
      const values: unknown[] = [id];
      let ownership = "id=$1";
      if (user.role !== "super_admin") {
        values.push(user.company_id);
        ownership += ` AND company_id=$${values.length}`;
      }
      const result = await pool.query(
        `UPDATE spa_service_orders SET status='void' WHERE ${ownership} RETURNING *`,
        values
      );
      if (result.rows.length === 0) return NextResponse.json({ error: "Service order not found" }, { status: 404 });
      const order = result.rows[0];
      await logAudit({
        company_id: order.company_id,
        user_id: user.id,
        action: "UPDATE",
        table_name: "spa_service_orders",
        record_id: order.id,
        new_values: order,
      });
      return ok(order);
    } catch (error) {
      return apiError(error);
    }
  });
}
