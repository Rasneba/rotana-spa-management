import { NextResponse } from "next/server";
import pool from "@/lib/db";
import {
  approveBookingRequest,
  declineBookingRequest,
  resolveSpaRecord,
  listActiveTherapists,
  listActiveOfferings,
  getActiveTherapist,
  getActiveOffering,
  hasConflict,
  type SpaListRecord,
} from "@/lib/booking-approval";
import { sendTelegramMessage, answerTelegramCallback, editTelegramMessage, type TelegramInlineKeyboard } from "@/lib/notification-dispatch";

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

const STAFF_USERNAMES = (process.env.TELEGRAM_STAFF_USERNAMES || "")
  .split(",")
  .map((name) => name.trim().replace(/^@/, "").toLowerCase())
  .filter(Boolean);

function isStaffChat(chatId: unknown): boolean {
  const key = String(chatId ?? "").replace(/^@/, "").toLowerCase();
  return STAFF_CHAT_IDS.length > 0 && STAFF_CHAT_IDS.includes(key);
}

function isStaffUser(from: JsonObject | null): boolean {
  if (STAFF_USERNAMES.length === 0) return false;
  const username = typeof from?.username === "string" ? from.username.replace(/^@/, "").toLowerCase() : "";
  return username !== "" && STAFF_USERNAMES.includes(username);
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
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

const HELP_TEXT = [
  "Dagi Spa booking bot.",
  "",
  "Commands:",
  "/menu - list pending bookings with action buttons",
  "/status <id> - check a web booking",
  "/approve <id> - approve (uses assigned or unique therapist/service)",
  "/approve <id> t:<therapist> s:<service> - approve with specific therapist & service (record ID or code)",
  "/decline <id> - decline a web booking",
  "",
  "New web bookings are announced here with Approve / Status / Decline buttons.",
].join("\n");

async function fetchRequest(id: number): Promise<JsonObject | null> {
  const result = await pool.query(`SELECT * FROM website_booking_requests WHERE id=$1`, [id]);
  return result.rows[0] || null;
}

function requestLines(request: JsonObject): string[] {
  return [
    `Request #${request.id}`,
    `Status: ${request.status}`,
    `Customer: ${request.full_name}`,
    `Phone: ${request.phone}${request.email ? `\nEmail: ${request.email}` : ""}`,
    `Treatment: ${request.treatment} at ${request.branch}`,
    `When: ${formatWhen(String(request.preferred_at || ""))}`,
  ].filter(Boolean);
}

function menuKeyboard(id: number): TelegramInlineKeyboard {
  return [
    [{ text: "✅ Approve", callback_data: `approve:${id}` }, { text: "📋 Status", callback_data: `status:${id}` }],
    [{ text: "❌ Decline", callback_data: `decline:${id}` }],
  ];
}

async function out(chatId: number, messageId: number | null, text: string, keyboard?: TelegramInlineKeyboard | null): Promise<void> {
  if (messageId === null || messageId === undefined) {
    await sendTelegramMessage(String(chatId), text, keyboard ?? undefined);
  } else {
    await editTelegramMessage(String(chatId), messageId, text, keyboard ?? null);
  }
}

function toIso(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

async function therapistAvailability(companyId: number, preferredAt: string, facilityId: number | null, therapists: SpaListRecord[]): Promise<{ therapist: SpaListRecord; free: boolean }[]> {
  const startsAt = toIso(preferredAt);
  const endsAt = new Date(new Date(preferredAt).getTime() + 60 * 60 * 1000).toISOString();
  return Promise.all(
    therapists.map(async (therapist) => {
      const conflict = await hasConflict({ companyId, therapistId: therapist.id, facilityId: facilityId || null, startsAt, endsAt });
      return { therapist, free: conflict === null };
    })
  );
}

async function showTherapistPicker(chatId: number, messageId: number | null, request: JsonObject, therapists: SpaListRecord[]): Promise<void> {
  const rows = await therapistAvailability(request.company_id as number, String(request.preferred_at || ""), request.assigned_facility_id as number | null, therapists);
  const keyboard: TelegramInlineKeyboard = rows.map(({ therapist, free }) => [
    { text: `${free ? "✅" : "⛔"} ${therapist.title}`, callback_data: `t:${request.id}:${therapist.id}` },
  ]);
  keyboard.push([{ text: "↩ Menu", callback_data: `menu:${request.id}` }]);
  const text = `Request #${request.id} — choose therapist for ${formatWhen(String(request.preferred_at || ""))}:\n✅ free · ⛔ already booked at that time`;
  await out(chatId, messageId, text, keyboard);
}

async function showOfferingPicker(chatId: number, messageId: number | null, request: JsonObject, therapistId: number, offerings: SpaListRecord[]): Promise<void> {
  const keyboard: TelegramInlineKeyboard = offerings.map((offering) => [
    { text: offering.title, callback_data: `o:${request.id}:${therapistId}:${offering.id}` },
  ]);
  keyboard.push([{ text: "↩ Menu", callback_data: `menu:${request.id}` }]);
  const text = `Request #${request.id} — choose service for ${request.treatment}:`;
  await out(chatId, messageId, text, keyboard);
}

async function approveFlow(chatId: number, messageId: number | null, requestId: number, therapistId?: number, offeringId?: number): Promise<void> {
  const request = await fetchRequest(requestId);
  if (!request) return out(chatId, messageId, `Request #${requestId} not found.`);
  if (request.status === "confirmed") return out(chatId, messageId, `Request #${requestId} is already confirmed.`);

  let therapist: SpaListRecord | null = null;
  if (therapistId) {
    therapist = await getActiveTherapist(request.company_id as number, therapistId);
    if (!therapist) return out(chatId, messageId, "Therapist not found or not active.");
  } else if (request.assigned_therapist_record_id) {
    therapist = await getActiveTherapist(request.company_id as number, Number(request.assigned_therapist_record_id));
  } else {
    const therapists = await listActiveTherapists(request.company_id as number);
    if (therapists.length === 0) return out(chatId, messageId, "No active therapist found. Add one in the Offering Master first.");
    if (therapists.length === 1) therapist = therapists[0];
    else return showTherapistPicker(chatId, messageId, request, therapists);
  }
  if (!therapist) return out(chatId, messageId, "No active therapist resolved.");

  let offering: SpaListRecord | null = null;
  if (offeringId) {
    offering = await getActiveOffering(request.company_id as number, offeringId);
    if (!offering) return out(chatId, messageId, "Service not found or not active.");
  } else if (request.assigned_offering_id) {
    offering = await getActiveOffering(request.company_id as number, Number(request.assigned_offering_id));
  } else {
    let candidates = await listActiveOfferings(request.company_id as number, String(request.treatment || ""));
    if (candidates.length === 0) candidates = await listActiveOfferings(request.company_id as number);
    if (candidates.length === 1) offering = candidates[0];
    else return showOfferingPicker(chatId, messageId, request, therapist.id, candidates);
  }
  if (!offering) return out(chatId, messageId, "No active service resolved.");

  const requestedBy = await getCompanyStaffUser(request.company_id as number);
  const approval = await approveBookingRequest({
    requestId: request.id as number,
    companyId: request.company_id as number,
    therapistRecordId: therapist.id,
    offeringId: offering.id,
    facilityId: request.assigned_facility_id as number | null,
    requestedBy,
  });

  if (approval.ok) {
    const when = formatWhen(String(approval.request.preferred_at || ""));
    const contact = request.notification_contact ? String(request.notification_contact) : "";
    const text = `✅ Request #${request.id} approved!\n${request.full_name} → ${therapist.title} | ${offering.title}\nWhen: ${when}${contact ? `\nClient notification: ${request.notification_channel} ${contact}` : ""}`;
    return out(chatId, messageId, text, null);
  }

  const retry: TelegramInlineKeyboard = [[{ text: "↩ Try another therapist", callback_data: `approve:${request.id}` }]];
  return out(chatId, messageId, `⚠️ Could not approve #${request.id}: ${approval.error}`, retry);
}

async function statusFlow(chatId: number, messageId: number | null, requestId: number): Promise<void> {
  const request = await fetchRequest(requestId);
  if (!request) return out(chatId, messageId, `Request #${requestId} not found.`);
  return out(chatId, messageId, requestLines(request).join("\n"));
}

async function declineFlow(chatId: number, messageId: number | null, requestId: number): Promise<void> {
  const request = await fetchRequest(requestId);
  if (!request) return out(chatId, messageId, `Request #${requestId} not found.`);
  const requestedBy = await getCompanyStaffUser(request.company_id as number);
  const outcome = await declineBookingRequest(requestId, request.company_id as number, "Declined from Telegram", requestedBy);
  if (outcome.ok) return out(chatId, messageId, `Request #${requestId} declined.`);
  return out(chatId, messageId, `Could not decline #${requestId}: ${outcome.error}`);
}

async function menuFlow(chatId: number, messageId: number | null, requestId: number): Promise<void> {
  const request = await fetchRequest(requestId);
  if (!request) return out(chatId, messageId, `Request #${requestId} not found.`);
  return out(chatId, messageId, requestLines(request).join("\n"), menuKeyboard(requestId));
}

async function pendingListFlow(chatId: number, messageId: number | null): Promise<void> {
  const result = await pool.query(
    `SELECT id, full_name, treatment, branch, preferred_at, status
     FROM website_booking_requests
     WHERE status IN ('new','contacted')
     ORDER BY created_at DESC
     LIMIT 5`
  );
  if (result.rows.length === 0) return out(chatId, messageId, "No pending web bookings.");
  const header = result.rows
    .map((row, index) => `${index + 1}. #${row.id} ${row.full_name} — ${row.treatment} (${row.status})`)
    .join("\n");
  const keyboard: TelegramInlineKeyboard = result.rows.map((row) => [
    { text: `✅ Approve #${row.id}`, callback_data: `approve:${row.id}` },
    { text: `📋 Status #${row.id}`, callback_data: `status:${row.id}` },
    { text: `❌ Decline #${row.id}`, callback_data: `decline:${row.id}` },
  ]);
  return out(chatId, messageId, `Pending bookings:\n${header}`, keyboard);
}

async function handleCallback(callback: JsonObject): Promise<void> {
  const data = typeof callback.data === "string" ? callback.data : "";
  const message = isObject(callback.message) ? callback.message : null;
  const chat = message && isObject(message.chat) ? message.chat : null;
  const chatId = chat && typeof chat.id === "number" ? chat.id : undefined;
  const messageId = message && typeof message.message_id === "number" ? message.message_id : undefined;
  const callbackId = typeof callback.id === "string" ? callback.id : "";
  const from = isObject(callback.from) ? callback.from : null;

  if (chatId === undefined) return;
  if (!isStaffChat(chatId) && !isStaffUser(from)) return;
  await answerTelegramCallback(callbackId);
  if (messageId === undefined) return;

  const parts = data.split(":");
  const action = parts[0];
  const requestId = Number(parts[1]);
  const argA = parts[2] ? Number(parts[2]) : undefined;
  const argB = parts[3] ? Number(parts[3]) : undefined;
  if (!Number.isInteger(requestId) || requestId < 1) return;

  switch (action) {
    case "menu":
      return menuFlow(chatId, messageId, requestId);
    case "status":
      return statusFlow(chatId, messageId, requestId);
    case "decline":
      return declineFlow(chatId, messageId, requestId);
    case "approve":
      return approveFlow(chatId, messageId, requestId);
    case "t":
      return approveFlow(chatId, messageId, requestId, argA, undefined);
    case "o":
      return approveFlow(chatId, messageId, requestId, argA, argB);
  }
}

async function handleTextMessage(chatId: number, from: JsonObject | null, text: string): Promise<void> {
  const lower = text.toLowerCase();
  const staff = isStaffChat(chatId) || isStaffUser(from);

  if (lower.startsWith("/start") || lower.startsWith("/help")) {
    await sendTelegramMessage(String(chatId), HELP_TEXT);
    return;
  }

  if (lower.startsWith("/menu")) {
    if (!staff) return;
    return pendingListFlow(chatId, null);
  }

  if (lower.startsWith("/status")) {
    if (!staff) return;
    const id = Number(commandBody(text, "status").split(/\s+/)[0]);
    if (!Number.isInteger(id) || id < 1) {
      await sendTelegramMessage(String(chatId), "Usage: /status <request id>");
      return;
    }
    return statusFlow(chatId, null, id);
  }

  if (lower.startsWith("/decline")) {
    if (!staff) return;
    const id = Number(commandBody(text, "decline").split(/\s+/)[0]);
    if (!Number.isInteger(id) || id < 1) {
      await sendTelegramMessage(String(chatId), "Usage: /decline <request id>");
      return;
    }
    return declineFlow(chatId, null, id);
  }

  if (lower.startsWith("/approve")) {
    if (!staff) return;
    const args = parseApproveArgs(text);
    if ("error" in args) {
      await sendTelegramMessage(String(chatId), args.error);
      return;
    }
    const request = await fetchRequest(args.id);
    if (!request) {
      await sendTelegramMessage(String(chatId), `Request #${args.id} not found.`);
      return;
    }
    let therapistId: number | undefined;
    if (args.therapistRef) {
      if (/^\d+$/.test(args.therapistRef)) {
        const therapist = await getActiveTherapist(request.company_id as number, Number(args.therapistRef));
        if (!therapist) {
          await sendTelegramMessage(String(chatId), `Therapist #${args.therapistRef} not found.`);
          return;
        }
        therapistId = therapist.id;
      } else {
        const resolved = await resolveSpaRecord(request.company_id as number, "spa/therapists", args.therapistRef);
        if ("error" in resolved) {
          await sendTelegramMessage(String(chatId), resolved.error);
          return;
        }
        therapistId = resolved.id;
      }
    }
    let offeringId: number | undefined;
    if (args.offeringRef) {
      if (/^\d+$/.test(args.offeringRef)) {
        const offering = await getActiveOffering(request.company_id as number, Number(args.offeringRef));
        if (!offering) {
          await sendTelegramMessage(String(chatId), `Service #${args.offeringRef} not found.`);
          return;
        }
        offeringId = offering.id;
      } else {
        const resolved = await resolveSpaRecord(request.company_id as number, "catalog/offerings", args.offeringRef);
        if ("error" in resolved) {
          await sendTelegramMessage(String(chatId), resolved.error);
          return;
        }
        offeringId = resolved.id;
      }
    }
    return approveFlow(chatId, null, args.id, therapistId, offeringId);
  }
}

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

    if (isObject(raw.callback_query)) {
      await handleCallback(raw.callback_query).catch(() => undefined);
      return NextResponse.json({ ok: true });
    }

    const message = isObject(raw.message) ? raw.message : null;
    if (!message) return NextResponse.json({ ok: true });

    const chat = isObject(message.chat) ? message.chat : null;
    const chatId = chat && typeof chat.id === "number" ? chat.id : undefined;
    const text = typeof message.text === "string" ? message.text.trim() : "";
    const from = isObject(message.from) ? message.from : null;
    if (chatId === undefined || !text) return NextResponse.json({ ok: true });

    await handleTextMessage(chatId, from, text).catch(() => undefined);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
