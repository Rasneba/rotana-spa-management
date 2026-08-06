// Registers the Telegram bot webhook so incoming /approve /status /decline
// messages reach the app. Requires a publicly reachable HTTPS URL.
//
// Usage:
//   node scripts/set-telegram-webhook.mjs https://your-domain.com/api/telegram/webhook
//   node scripts/set-telegram-webhook.mjs "https://your-domain.com/api/telegram/webhook <secret>"

import fs from "node:fs";

function readEnv(key) {
  const raw = fs.existsSync(".env") ? fs.readFileSync(".env", "utf8") : "";
  const line = raw.split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
  if (!line) return "";
  return line.slice(key.length + 1).trim().replace(/^["']|["']$/g, "");
}

(async () => {
  const [url, secret] = process.argv.slice(2);
  if (!url) {
    console.error("Usage: node scripts/set-telegram-webhook.mjs https://your-domain.com/api/telegram/webhook [secret]");
    process.exit(1);
  }
  const token = readEnv("TELEGRAM_BOT_TOKEN");
  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN not found in .env");
    process.exit(1);
  }
  const body = { url, allowed_updates: ["message", "callback_query"] };
  if (secret) body.secret_token = secret;
  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  console.log(JSON.stringify(result, null, 2));
  if (result.ok) {
    console.log("Webhook registered. Send /start to your bot to test.");
  } else {
    console.error("Failed to register webhook:", result.description);
    process.exit(1);
  }
})().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
