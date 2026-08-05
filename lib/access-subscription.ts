import pool from "@/lib/db";

type DbGate = { id: number; company_id: number; code?: string | null; direction?: string | null; gate_type?: string | null };

export type AccessDecision = {
  granted: boolean;
  reason: string;
  message: string;
  access_type: "entry" | "exit";
  door_opened: boolean;
  days_remaining: number;
  member?: { id: number; name: string; code?: string | null; phone?: string | null };
  subscription?: { id: number; plan_name?: string | null; end_date: string };
  access_log?: unknown;
};

function daysRemaining(endDate: string | Date): number {
  return Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / 86_400_000));
}

function gateAccessType(direction?: string | null, requested?: string | null): "entry" | "exit" {
  if (requested === "exit") return "exit";
  if (requested === "entry") return "entry";
  if (direction === "out" || direction === "exit") return "exit";
  return "entry";
}

export async function verifyRfidSubscriptionAccess(params: {
  cardUid: string;
  companyId?: number | null;
  gateId?: number | null;
  gateCode?: string | null;
  requestedAccessType?: string | null;
  deviceId?: string | null;
  source?: string;
}): Promise<AccessDecision> {
  const cardUid = params.cardUid.trim();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let gate: DbGate | null = null;
    if (params.gateId || params.gateCode) {
      const gateValues: unknown[] = [];
      const gateWhere: string[] = ["status='active'"];
      if (params.gateId) { gateValues.push(params.gateId); gateWhere.push(`id=$${gateValues.length}`); }
      if (params.gateCode) { gateValues.push(params.gateCode); gateWhere.push(`code=$${gateValues.length}`); }
      if (params.companyId) { gateValues.push(params.companyId); gateWhere.push(`company_id=$${gateValues.length}`); }
      const gateResult = await client.query(`SELECT * FROM entry_gates WHERE ${gateWhere.join(" AND ")} LIMIT 1`, gateValues);
      gate = gateResult.rows[0] || null;
    }

    const cardValues: unknown[] = [cardUid];
    let cardWhere = "rc.card_uid=$1";
    if (params.companyId) { cardValues.push(params.companyId); cardWhere += ` AND rc.company_id=$${cardValues.length}`; }
    const cardResult = await client.query(
      `SELECT rc.*, m.full_name AS member_name, m.customer_id AS member_code, m.phone AS member_phone, m.status AS member_status
       FROM rfid_cards rc
       LEFT JOIN membership_members m ON m.id=rc.member_id
       WHERE ${cardWhere}
       LIMIT 1`,
      cardValues
    );

    const accessType = gateAccessType(gate?.direction || gate?.gate_type, params.requestedAccessType || null);
    const companyId = params.companyId || gate?.company_id || cardResult.rows[0]?.company_id || 1;
    const baseDetails = { source: params.source || "hardware_relay", device_id: params.deviceId || null, gate_code: params.gateCode || gate?.code || null };

    async function writeLog(decision: Omit<AccessDecision, "access_log">, extra: Record<string, unknown> = {}) {
      const logResult = await client.query(
        `INSERT INTO access_logs
          (company_id, gate_id, card_uid, member_id, subscription_id, access_type, method, status, reason, device_id, door_opened, days_remaining, details)
         VALUES ($1,$2,$3,$4,$5,$6,'rfid',$7,$8,$9,$10,$11,$12::jsonb)
         RETURNING *`,
        [companyId, gate?.id || params.gateId || null, cardUid, decision.member?.id || null, decision.subscription?.id || null,
          decision.access_type, decision.granted ? "granted" : "denied", decision.reason, params.deviceId || null,
          decision.door_opened, decision.days_remaining, JSON.stringify({ ...baseDetails, ...extra })]
      );
      return { ...decision, access_log: logResult.rows[0] };
    }

    if (!cardResult.rows[0]) {
      const denied = await writeLog({ granted: false, reason: "CARD_NOT_FOUND", message: "RFID card not found", access_type: accessType, door_opened: false, days_remaining: 0 });
      await client.query("COMMIT");
      return denied;
    }

    const card = cardResult.rows[0];
    const member = card.member_id ? { id: Number(card.member_id), name: card.member_name, code: card.member_code, phone: card.member_phone } : undefined;

    if (card.status !== "active") {
      const denied = await writeLog({ granted: false, reason: "CARD_INACTIVE", message: "RFID card is not active", access_type: accessType, door_opened: false, days_remaining: 0, member });
      await client.query("COMMIT");
      return denied;
    }
    if (!card.member_id) {
      const denied = await writeLog({ granted: false, reason: "CARD_NOT_ASSIGNED", message: "RFID card is not assigned to a member", access_type: accessType, door_opened: false, days_remaining: 0 });
      await client.query("COMMIT");
      return denied;
    }
    if (card.member_status && card.member_status !== "active") {
      const denied = await writeLog({ granted: false, reason: "MEMBER_INACTIVE", message: "Member is not active", access_type: accessType, door_opened: false, days_remaining: 0, member });
      await client.query("COMMIT");
      return denied;
    }

    const today = new Date().toISOString().slice(0, 10);
    const subResult = await client.query(
      `SELECT s.id, s.end_date, s.status, mp.name AS plan_name
       FROM subscriptions s
       LEFT JOIN membership_plans mp ON mp.id=s.plan_id
       WHERE s.company_id=$1 AND s.member_id=$2 AND s.status='active'
         AND s.start_date <= $3::date AND s.end_date >= $3::date
       ORDER BY s.end_date DESC LIMIT 1`,
      [card.company_id, card.member_id, today]
    );
    if (!subResult.rows[0]) {
      const denied = await writeLog({ granted: false, reason: "NO_ACTIVE_SUBSCRIPTION", message: "No active subscription covering today", access_type: accessType, door_opened: false, days_remaining: 0, member });
      await client.query("COMMIT");
      return denied;
    }

    const sub = subResult.rows[0];
    const remaining = daysRemaining(sub.end_date);
    await client.query("UPDATE rfid_cards SET last_used_at=CURRENT_TIMESTAMP WHERE id=$1", [card.id]).catch(() => undefined);

    if (accessType === "exit") {
      await client.query(
        `UPDATE visit_sessions SET check_out_at=CURRENT_TIMESTAMP, duration_minutes=EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP-check_in_at))/60, updated_at=CURRENT_TIMESTAMP
         WHERE id=(SELECT id FROM visit_sessions WHERE company_id=$1 AND member_id=$2 AND check_out_at IS NULL ORDER BY check_in_at DESC LIMIT 1)`,
        [card.company_id, card.member_id]
      ).catch(() => undefined);
    } else {
      await client.query(
        `INSERT INTO visit_sessions (company_id, member_id, subscription_id, card_uid, source, notes)
         SELECT $1,$2,$3,$4,'rfid','Hardware access check-in'
         WHERE NOT EXISTS (SELECT 1 FROM visit_sessions WHERE company_id=$1 AND member_id=$2 AND check_out_at IS NULL)`,
        [card.company_id, card.member_id, sub.id, cardUid]
      ).catch(() => undefined);
    }

    const granted = await writeLog({
      granted: true,
      reason: "ACCESS_GRANTED",
      message: "Access granted",
      access_type: accessType,
      door_opened: true,
      days_remaining: remaining,
      member,
      subscription: { id: Number(sub.id), plan_name: sub.plan_name, end_date: sub.end_date },
    }, { plan_name: sub.plan_name || null });
    await client.query("COMMIT");
    return granted;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
