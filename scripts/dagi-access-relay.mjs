import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const DEFAULTS = {
  APP_URL: "http://localhost:3000",
  ACCESS_RELAY_TOKEN: "",
  COMPANY_ID: "1",
  GATE_CODE: "GATE-1",
  GATE_ID: "",
  DEVICE_ID: "dagi-relay-1",
  CONTROLLER_IP: "192.168.0.68",
  CONTROLLER_PORT: 80,
  CONTROLLER_USERNAME: "admin",
  CONTROLLER_PASSWORD: "888888",
  EVENT_POLL_MS: 1000,
  COMMAND_POLL_MS: 2000,
};

function loadConfig() {
  const envCfg = Object.fromEntries(Object.entries(process.env).filter(([k]) => k in DEFAULTS));
  for (const p of [".env.relay", join(homedir(), ".dagi-access-relay.json")]) {
    if (existsSync(p)) {
      try {
        return { ...DEFAULTS, ...JSON.parse(readFileSync(p, "utf8")), ...envCfg };
      } catch {}
    }
  }
  return { ...DEFAULTS, ...envCfg };
}

const CFG = loadConfig();
const CONTROLLER = `http://${CFG.CONTROLLER_IP}:${CFG.CONTROLLER_PORT}`;
const AUTH = Buffer.from(`${CFG.CONTROLLER_USERNAME}:${CFG.CONTROLLER_PASSWORD}`).toString("base64");
const HEADERS = { Authorization: `Basic ${AUTH}` };
const API_HEADERS = { "Content-Type": "application/json", ...(CFG.ACCESS_RELAY_TOKEN ? { Authorization: `Bearer ${CFG.ACCESS_RELAY_TOKEN}` } : {}) };
let lastEventId = "0";
let lastSwipeKey = "";
let lastSwipeAt = 0;

async function controllerFetch(path, options = {}) {
  try {
    const res = await fetch(`${CONTROLLER}${path}`, { headers: HEADERS, signal: AbortSignal.timeout(10000), ...options });
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    console.log(`controller ${path} failed: ${e.message}`);
    return null;
  }
}

async function openDoor(delay = 2) {
  console.log(`OPEN door for ${delay}s`);
  await controllerFetch("/cdor.cgi?open=1", { method: "POST" });
}

async function api(path, body, method = "POST") {
  const res = await fetch(`${CFG.APP_URL}${path}`, { method, headers: API_HEADERS, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${method} ${path} failed with ${res.status}`);
  return data;
}

async function verifySwipe(cardUid, event = {}) {
  const now = Date.now();
  const dedupKey = `${cardUid}:${event.Reader || ""}:${event.Time || ""}`;
  if (dedupKey === lastSwipeKey && now - lastSwipeAt < 3000) return;
  lastSwipeKey = dedupKey;
  lastSwipeAt = now;
  console.log(`SWIPE ${cardUid}`);
  const result = await api("/api/spa/access/rfid-swipe", {
    card_uid: cardUid,
    company_id: Number(CFG.COMPANY_ID) || undefined,
    gate_id: Number(CFG.GATE_ID) || undefined,
    gate_code: CFG.GATE_CODE || undefined,
    device_id: CFG.DEVICE_ID,
    raw_event: event,
  });
  if (result.granted || result.open_door) {
    console.log(`GRANTED ${result.member?.name || cardUid}: ${result.days_remaining || 0} day(s) remaining`);
    await openDoor(result.door_open_seconds || 2);
  } else {
    console.log(`DENIED ${cardUid}: ${result.reason} — ${result.message}`);
  }
}

async function pollEvents() {
  const raw = await controllerFetch(`/Event.xml?ID=${lastEventId}`);
  if (!raw) return;
  const compact = raw.replace(/>\s+</g, "><").replace(/\s+/g, " ");
  const match = compact.match(/<response>(.*?)<\/response>/);
  if (!match) return;
  try {
    const event = JSON.parse(match[1]);
    if (!event.Card || !event.ID) return;
    if (String(event.ID) === String(lastEventId)) return;
    lastEventId = String(event.ID);
    await verifySwipe(String(event.Card), event);
  } catch {}
}

async function pollCommands() {
  try {
    await api("/api/spa/access/relay", { gate_id: Number(CFG.GATE_ID) || undefined, gate_code: CFG.GATE_CODE || undefined, device_id: CFG.DEVICE_ID }, "POST");
    const qs = new URLSearchParams();
    if (CFG.COMPANY_ID) qs.set("company_id", CFG.COMPANY_ID);
    if (CFG.GATE_ID) qs.set("gate_id", CFG.GATE_ID);
    if (CFG.GATE_CODE) qs.set("gate_code", CFG.GATE_CODE);
    const res = await fetch(`${CFG.APP_URL}/api/spa/access/relay?${qs}`, { headers: API_HEADERS });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "relay poll failed");
    for (const cmd of data.commands || []) {
      try {
        if (cmd.command === "open") await openDoor(cmd.door_open_delay || 2);
        await api("/api/spa/access/relay", { command_id: cmd.id, status: "completed", response: "Executed by Dagi access relay", gate_id: cmd.gate_id, device_id: CFG.DEVICE_ID });
        console.log(`COMMAND #${cmd.id} completed`);
      } catch (e) {
        await api("/api/spa/access/relay", { command_id: cmd.id, status: "failed", response: e.message, gate_id: cmd.gate_id, device_id: CFG.DEVICE_ID }).catch(() => undefined);
      }
    }
  } catch (e) {
    console.log(`relay poll: ${e.message}`);
  }
}

console.log("═".repeat(58));
console.log("  Dagi Spa — Hardware Access Relay");
console.log("═".repeat(58));
console.log(`  App:        ${CFG.APP_URL}`);
console.log(`  Gate:       ${CFG.GATE_CODE || CFG.GATE_ID}`);
console.log(`  Controller: ${CONTROLLER}`);
console.log("═".repeat(58));

controllerFetch("/Event.xml?ID=0").then((r) => console.log(`Controller: ${r ? "OK" : "no response"}`));
setInterval(pollEvents, Number(CFG.EVENT_POLL_MS) || 1000);
setInterval(pollCommands, Number(CFG.COMMAND_POLL_MS) || 2000);
