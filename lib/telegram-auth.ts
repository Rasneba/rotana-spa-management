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

// Verifies the Telegram WebApp initData signature using the bot token
// (HMAC-SHA256 of the sorted data_check_string keyed with SHA256(bot_token)).
export function verifyTelegramInitData(initData: string): InitDataResult {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, reason: "bad_hash" };
  if (!initData) return { ok: false, reason: "missing_init_data" };

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return { ok: false, reason: "invalid_format" };
  }

  const hash = params.get("hash");
  if (!hash) return { ok: false, reason: "invalid_format" };

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");

  const secretKey = crypto.createHash("sha256").update(token).digest();
  const computed = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  if (computed !== hash.toLowerCase()) return { ok: false, reason: "bad_hash" };

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
