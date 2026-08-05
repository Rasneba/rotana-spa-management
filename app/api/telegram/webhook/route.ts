import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { approveBookingRequest, declineBookingRequest, resolveSpaRecord } from "@/lib/booking-approval";
import { sendTelegramMessage } from "@/lib/notification-dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const STAFF_CHAT_IDS = (process.env.TELEGRAM_STAFF_CHAT_ID || "")
  .split(",")
  .map((id) => id.trim().replace(/^@/, "").toLowerCase())
  .filter(Boolean);

function isStaff(chatId: unknown): boolean {
  const key = String(chatId ?? "").replace(/^@/, "").toLowerCase();
  return STAFF_CHAT_IDS.length > 0 && STAFF_CHAT_IDS.includes(key);
}

function commandBody(text: string, command: string): string {
  return text.replace(new RegExp(`^/${command}(?:@[\\w_]+)?\\s*`, "i"), "").trim();
}

function parseApproveArgs(text: string): { id: number; therapistRef: string | null; offeringRef: string | null } | { error: string } {
  const rest = commandBody(text, "approve");
  const tokens = rest.split(/\s+/).filter(Boolean);
  const id = Number(tokens[0]);
  if (!Number.isInteger(id) || id < 1) return { error: "Usage: /approve <request id> [t:<therapist>] [s:<service>]" };
  let therapistRef: string | null = null;
  let offeringRef: string | null = null;
  for (const token of tokens.slice(1)) {
    if (token.startsWith("t:")) therapistRef = token.slice(2);
    else if (token.startsWith("s:")) offeringRef = token.slice(2);
    else if (therapistRef === null) therapistRef = token;
    else if (offeringRef === null) offeringRef = token;
  }
  return { id, therapistRef, offeringRef };
}

async function getCompanyStaffUser(companyId: number): Promise<number | null> {
  const result = await pool.query(
    `SELECT id FROM users WHERE company_id=$1 AND role IN ('admin','manager','super_admin') ORDER BY id LIMIT 1`,
    [companyId]
  );
  return result.rows[0]?.id ?? null;
}

function formatWhen(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

const HELP_TEXT = [
  "Dagi Spa booking bot.",
  "",
  "Commands:",
  "/status <id> - check a web booking",
  "/approve <id> - approve (uses assigned or unique therapist/service)",
  "/approve <id> t:<therapist> s:<service> - approve with specific therapist & service (use record ID or code)",
  "/decline <id> - decline a web booking",
  "",
  "New web bookings are announced here automatically.",
].join("\n");

export async function POST(req: Request) {
  try {
    if (process.env.TELEGRAM_WEBHOOK_SECRET) {
      const secret = req.headers.get("x-telegram-bot-api-secret-token");
      if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
        return NextResponse.json({ ok: false, error: "Invalid secret token" }, { status: 403 });
      }
    }

    const raw: unknown = await req.json();
    if (!isObject(raw)) return NextResponse.json({ ok: true });

    const message = isObject(raw.message) ? raw.message : null;
    if (!message) return NextResponse.json({ ok: true });

    const chatId = message.chat && isObject(message.chat) ? message.chat.id : undefined;
    const text = typeof message.text === "string" ? message.text.trim() : "";
    if (chatId === undefined || !text) return NextResponse.json({ ok: true });

    const lower = text.toLowerCase();

    if (lower.startsWith("/start") || lower.startsWith("/help")) {
      await sendTelegramMessage(String(chatId), HELP_TEXT);
      return NextResponse.json({ ok: true });
    }

    if (lower.startsWith("/status")) {
      if (!isStaff(chatId)) return NextResponse.json({ ok: true });
      const id = Number(commandBody(text, "status").split(/\s+/)[0]);
      if (!Number.isInteger(id) || id < 1) {
        await sendTelegramMessage(String(chatId), "Usage: /status <request id>");
        return NextResponse.json({ ok: true });
      }
      const result = await pool.query(`SELECT * FROM website_booking_requests WHERE id=$1`, [id]);
      const request = result.rows[0];
      if (!request) {
        await sendTelegramMessage(String(chatId), `Request #${id} not found.`);
        return NextResponse.json({ ok: true });
      }
      const lines = [
        `Request #${request.id}`,
        `Status: ${request.status}`,
        `Customer: ${request.full_name}`,
        `Phone: ${request.phone}`,
        `Treatment: ${request.treatment} at ${request.branch}`,
        `When: ${formatWhen(request.preferred_at)}`,
      ];
      await sendTelegramMessage(String(chatId), lines.join("\n"));
      return NextResponse.json({ ok: true });
    }

    if (lower.startsWith("/decline")) {
      if (!isStaff(chatId)) return NextResponse.json({ ok: true });
      const id = Number(commandBody(text, "decline").split(/\s+/)[0]);
      if (!Number.isInteger(id) || id < 1) {
        await sendTelegramMessage(String(chatId), "Usage: /decline <request id>");
        return NextResponse.json({ ok: true });
      }
      const existing = await pool.query(`SELECT id, company_id FROM website_booking_requests WHERE id=$1`, [id]);
      if (!existing.rows[0]) {
        await sendTelegramMessage(String(chatId), `Request #${id} not found.`);
        return NextResponse.json({ ok: true });
      }
      const requestedBy = await getCompanyStaffUser(existing.rows[0].company_id);
      const outcome = await declineBookingRequest(id, existing.rows[0].company_id, "Declined from Telegram", requestedBy);
      if (outcome.ok) {
        await sendTelegramMessage(String(chatId), `Request #${id} declined.`);
      } else {
        await sendTelegramMessage(String(chatId), `Could not decline #${id}: ${outcome.error}`);
      }
      return NextResponse.json({ ok: true });
    }

    if (lower.startsWith("/approve")) {
      if (!isStaff(chatId)) return NextResponse.json({ ok: true });
      const args = parseApproveArgs(text);
      if ("error" in args) {
        await sendTelegramMessage(String(chatId), args.error);
        return NextResponse.json({ ok: true });
      }
      const existing = await pool.query(
        `SELECT id, company_id, status, treatment, assigned_therapist_record_id, assigned_offering_id, assigned_facility_id, full_name, notification_channel, notification_contact FROM website_booking_requests WHERE id=$1`,
        [args.id]
      );
      const request = existing.rows[0];
      if (!request) {
        await sendTelegramMessage(String(chatId), `Request #${args.id} not found.`);
        return NextResponse.json({ ok: true });
      }
      if (request.status === "confirmed") {
        await sendTelegramMessage(String(chatId), `Request #${args.id} is already confirmed.`);
        return NextResponse.json({ ok: true });
      }

      const therapistResult = args.therapistRef
        ? await resolveSpaRecord(request.company_id, "spa/therapists", args.therapistRef)
        : request.assigned_therapist_record_id
          ? await resolveSpaRecord(request.company_id, "spa/therapists", String(request.assigned_therapist_record_id))
          : null;
      let therapist: { id: number; title: string } | null = null;
      if (therapistResult === null) {
        const unique = await pool.query(
          `SELECT id, title FROM spa_management_records
           WHERE company_id=$1 AND module_key='spa/therapists' AND status='active' AND deleted_at IS NULL`,
          [request.company_id]
        );
        if (unique.rows.length === 1) {
          therapist = unique.rows[0];
        } else if (unique.rows.length === 0) {
          await sendTelegramMessage(String(chatId), "No active therapist found. Add one in the Offering Master first.");
          return NextResponse.json({ ok: true });
        } else {
          await sendTelegramMessage(String(chatId), `Multiple therapists available. Specify one: /approve ${args.id} t:<therapist id or code>`);
          return NextResponse.json({ ok: true });
        }
      } else if ("error" in therapistResult) {
        await sendTelegramMessage(String(chatId), therapistResult.error);
        return NextResponse.json({ ok: true });
      } else {
        therapist = therapistResult;
      }

      const offeringResult = args.offeringRef
        ? await resolveSpaRecord(request.company_id, "catalog/offerings", args.offeringRef)
        : request.assigned_offering_id
          ? await resolveSpaRecord(request.company_id, "catalog/offerings", String(request.assigned_offering_id))
          : null;
      let offering: { id: number; title: string } | null = null;
      if (offeringResult === null) {
        const treatment = String(request.treatment || "").trim();
        const matches = treatment
          ? await pool.query(
              `SELECT id, title FROM spa_management_records
               WHERE company_id=$1 AND module_key='catalog/offerings' AND status='active' AND deleted_at IS NULL
                 AND details->>'classification' IN ('spa_service','package')
                 AND (LOWER(title)=LOWER($2) OR LOWER(details->>'offering_code')=LOWER($2) OR title ILIKE $3)`,
              [request.company_id, treatment, `%${treatment}%`]
            )
          : { rows: [] };
        if (matches.rows.length === 1) {
          offering = matches.rows[0];
        } else if (matches.rows.length === 0) {
          await sendTelegramMessage(String(chatId), `No active service matches "${treatment}". Specify one: /approve ${args.id} s:<service id or code>`);
          return NextResponse.json({ ok: true });
        } else {
          await sendTelegramMessage(String(chatId), `Multiple services match "${treatment}". Specify one: /approve ${args.id} s:<service id or code>`);
          return NextResponse.json({ ok: true });
        }
      } else if ("error" in offeringResult) {
        await sendTelegramMessage(String(chatId), offeringResult.error);
        return NextResponse.json({ ok: true });
      } else {
        offering = offeringResult;
      }

      const requestedBy = await getCompanyStaffUser(request.company_id);
      if (!therapist || !offering) {
        await sendTelegramMessage(String(chatId), "Could not resolve therapist or service for this request.");
        return NextResponse.json({ ok: true });
      }
      const approval = await approveBookingRequest({
        requestId: args.id,
        companyId: request.company_id,
        therapistRecordId: therapist.id,
        offeringId: offering.id,
        facilityId: request.assigned_facility_id || null,
        requestedBy,
      });
      if (approval.ok) {
        const updated = approval.request;
        const when = formatWhen(String(updated.preferred_at));
        const contact = request.notification_contact || "";
        await sendTelegramMessage(
          String(chatId),
          `Request #${args.id} approved!\n${request.full_name} → ${therapist.title} | ${offering.title}\nWhen: ${when}${contact ? `\nClient confirmation: ${request.notification_channel} ${contact}` : ""}`
        );
      } else {
        await sendTelegramMessage(String(chatId), `Could not approve #${args.id}: ${approval.error}`);
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
