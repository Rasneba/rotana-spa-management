import { NextResponse } from "next/server";
import { badRequest, err, ok } from "@/lib/api-utils";
import { verifyRfidSubscriptionAccess } from "@/lib/access-subscription";

type JsonObject = Record<string, unknown>;
function isObject(value: unknown): value is JsonObject { return typeof value === "object" && value !== null && !Array.isArray(value); }
function text(value: unknown, max = 200) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }

function authorized(req: Request) {
  const configured = process.env.ACCESS_RELAY_TOKEN || process.env.RELAY_API_KEY || "";
  if (!configured) return true;
  const header = req.headers.get("authorization") || req.headers.get("x-relay-token") || "";
  return header === configured || header === `Bearer ${configured}`;
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized relay" }, { status: 401 });
  try {
    const body: unknown = await req.json();
    if (!isObject(body)) return badRequest("Invalid RFID swipe request");
    const cardUid = text(body.card_uid || body.card || body.uid, 100);
    if (!cardUid) return badRequest("card_uid is required");
    const decision = await verifyRfidSubscriptionAccess({
      cardUid,
      companyId: Number(body.company_id) || null,
      gateId: Number(body.gate_id) || null,
      gateCode: text(body.gate_code, 80) || null,
      requestedAccessType: text(body.access_type, 20) || null,
      deviceId: text(body.device_id, 120) || null,
      source: "hardware_relay",
    });
    return ok({ ok: true, ...decision, open_door: decision.granted, door_open_seconds: decision.granted ? 2 : 0 });
  } catch (error) {
    return err(error instanceof Error ? error.message : "Unable to verify RFID access");
  }
}
