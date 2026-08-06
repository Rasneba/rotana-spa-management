import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { verifyTelegramInitData, debugInitData } from "@/lib/telegram-auth";
import { createToken } from "@/lib/auth";

export const runtime = "nodejs";

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function staffList(envKey: string): string[] {
  return (process.env[envKey] || "")
    .split(",")
    .map((item) => item.trim().replace(/^@/, "").toLowerCase())
    .filter(Boolean);
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
    if (!isObject(body)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    const initData = typeof body.initData === "string" ? body.initData : "";
    const verified = verifyTelegramInitData(initData);
    if (!verified.ok) {
      console.error(
        `[mini-app-session] verify=${verified.reason} len=${initData.length} initData=${JSON.stringify(initData)}`
      );
      const message =
        verified.reason === "missing_init_data"
          ? "No Telegram session found. Open this from the bot menu button in Telegram."
          : verified.reason === "bad_hash"
            ? "Session verification failed (hash mismatch)."
            : verified.reason === "expired"
              ? "Telegram session expired. Reopen the Mini App."
              : "Invalid Telegram session.";
      const extra =
        verified.reason === "bad_hash"
          ? { debug: debugInitData(initData) }
          : {};
      return NextResponse.json({ error: message, ...extra }, { status: 401 });
    }
    const tgUser = verified.user;

    const chatIds = staffList("TELEGRAM_STAFF_CHAT_ID");
    const usernames = staffList("TELEGRAM_STAFF_USERNAMES");
    const isStaff =
      chatIds.includes(String(tgUser.id)) ||
      (tgUser.username ? usernames.includes(tgUser.username.toLowerCase()) : false);
    if (!isStaff) return NextResponse.json({ error: "Not authorized as staff" }, { status: 403 });

    const companyId = await getPublicCompanyId();
    if (!companyId) return NextResponse.json({ error: "No active company configured" }, { status: 503 });

    const staffResult = await pool.query(
      `SELECT id, email, name, role FROM users
       WHERE company_id=$1 AND role IN ('admin','manager','super_admin') AND is_active=true
       ORDER BY id LIMIT 1`,
      [companyId]
    );
    const staffUser = staffResult.rows[0];
    if (!staffUser) return NextResponse.json({ error: "No staff account configured for this company" }, { status: 500 });

    const token = await createToken({
      id: staffUser.id,
      email: staffUser.email,
      role: staffUser.role,
      company_id: companyId,
    });

    return NextResponse.json({
      token,
      user: { id: staffUser.id, name: staffUser.name, role: staffUser.role, company_id: companyId },
    });
  } catch {
    return NextResponse.json({ error: "Unable to open session" }, { status: 500 });
  }
}
