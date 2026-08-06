import crypto from "crypto";

export type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

export type InitDataResult =
  | { ok: true; user: TelegramUser }
  | { ok: false; reason: "missing_init_data" | "invalid_format" | "bad_hash" | "expired" | "missing_user" };

type CheckPair = { hash: string; dataCheckString: string };

// Official Telegram algorithm: split on "&", then on the first "=", URL-decode
// both key and value with decodeURIComponent. Excludes "hash".
function buildCheckManual(initData: string): CheckPair | null {
  try {
    const pairs: [string, string][] = [];
    let hash = "";
    for (const pair of initData.split("&")) {
      const eq = pair.indexOf("=");
      if (eq === -1) continue;
      const key = decodeURIComponent(pair.slice(0, eq));
      const value = decodeURIComponent(pair.slice(eq + 1));
      if (key === "hash") {
        hash = value;
        continue;
      }
      pairs.push([key, value]);
    }
    pairs.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return { hash, dataCheckString: pairs.map(([k, v]) => `${k}=${v}`).join("\n") };
  } catch {
    return null;
  }
}

// Fallback using URLSearchParams semantics (some clients rely on this).
function buildCheckUrlSearch(initData: string): CheckPair | null {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash") || "";
    const pairs = [...params.entries()].filter(([key]) => key !== "hash").sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return { hash, dataCheckString: pairs.map(([k, v]) => `${k}=${v}`).join("\n") };
  } catch {
    return null;
  }
}

function hashMatches(dataCheckString: string, expected: string, token: string): boolean {
  const secretKey = crypto.createHash("sha256").update(token).digest();
  const computed = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  return computed === expected.toLowerCase();
}

// Verifies the Telegram WebApp initData signature using the bot token
// (HMAC-SHA256 of the sorted data_check_string keyed with SHA256(bot_token)).
export function verifyTelegramInitData(initData: string): InitDataResult {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, reason: "bad_hash" };
  if (!initData) return { ok: false, reason: "missing_init_data" };

  const check: CheckPair | null = buildCheckManual(initData);
  if (!check) return { ok: false, reason: "invalid_format" };
  if (!check.hash) return { ok: false, reason: "invalid_format" };

  let valid = hashMatches(check.dataCheckString, check.hash, token);
  if (!valid) {
    const fallback = buildCheckUrlSearch(initData);
    if (fallback && fallback.hash) {
      valid = hashMatches(fallback.dataCheckString, fallback.hash, token);
    }
  }
  if (!valid) return { ok: false, reason: "bad_hash" };

  const params = new URLSearchParams(initData);
  const authDate = Number(params.get("auth_date") || 0);
  if (!authDate || Math.floor(Date.now() / 1000) - authDate > 24 * 3600) return { ok: false, reason: "expired" };

  const userRaw = params.get("user");
  if (!userRaw) return { ok: false, reason: "missing_user" };
  try {
    const user = JSON.parse(userRaw) as TelegramUser;
    if (typeof user.id !== "number" || Number.isNaN(user.id)) return { ok: false, reason: "missing_user" };
    return { ok: true, user };
  } catch {
    return { ok: false, reason: "missing_user" };
  }
}
