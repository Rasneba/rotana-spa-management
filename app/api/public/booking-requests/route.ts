import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { badRequest, created, err } from "@/lib/api-utils";

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, max = 500): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validEmail(value: string): boolean {
  return value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function getPublicCompanyId(): Promise<number | null> {
  const configured = Number(process.env.PUBLIC_COMPANY_ID || 0);
  if (configured > 0) return configured;
  const result = await pool.query("SELECT id FROM companies WHERE status='active' ORDER BY id LIMIT 1");
  return result.rows[0]?.id || null;
}

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    if (!isObject(body)) return badRequest("Invalid booking request");

    const fullName = text(body.full_name, 200);
    const phone = text(body.phone, 40);
    const email = text(body.email, 200);
    const branch = text(body.branch, 120);
    const treatment = text(body.treatment, 160);
    const preferredAt = text(body.preferred_at, 80);
    const notes = text(body.notes, 2000);
    const locale = text(body.locale, 10) || "en";

    if (!fullName) return badRequest("Full name is required");
    if (!phone) return badRequest("Phone is required");
    if (!branch) return badRequest("Branch is required");
    if (!treatment) return badRequest("Treatment is required");
    if (!preferredAt || Number.isNaN(Date.parse(preferredAt))) return badRequest("Preferred date/time is required");
    if (!validEmail(email)) return badRequest("Enter a valid email address");

    const companyId = await getPublicCompanyId();
    if (!companyId) return err("No active company is configured for public bookings", 503);

    const result = await pool.query(
      `INSERT INTO website_booking_requests
        (company_id, full_name, phone, email, branch, treatment, preferred_at, notes, locale, source, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7::timestamp,$8,$9,'public_website','new')
       RETURNING id, status, created_at`,
      [companyId, fullName, phone, email || null, branch, treatment, preferredAt, notes || null, locale]
    );

    return created({ request: result.rows[0] });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "";
    if (code === "42P01") {
      return NextResponse.json({ error: "Apply db-migration-v38.sql before using public booking requests." }, { status: 503 });
    }
    return err(error instanceof Error ? error.message : "Unable to create booking request");
  }
}
