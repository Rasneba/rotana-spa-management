export type NotificationChannel = "sms" | "telegram" | "whatsapp" | "email" | "phone";

type DispatchResult = {
  status: "sent" | "queued" | "failed" | "manual_required";
  providerResponse?: string;
};

export type TelegramInlineKeyboard = { text: string; callback_data: string }[][];

async function telegramApi(method: string, payload: Record<string, unknown>): Promise<Response> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  return fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function sendTelegram(chatId: string, text: string, keyboard?: TelegramInlineKeyboard): Promise<DispatchResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { status: "queued", providerResponse: "TELEGRAM_BOT_TOKEN not configured" };
  const recipient = chatId.trim();
  if (!recipient) return { status: "failed", providerResponse: "Missing recipient" };
  try {
    const payload: Record<string, unknown> = { chat_id: recipient, text };
    if (keyboard && keyboard.length > 0) payload.reply_markup = { inline_keyboard: keyboard };
    const response = await telegramApi("sendMessage", payload);
    return { status: response.ok ? "sent" : "failed", providerResponse: await response.text() };
  } catch (error) {
    return { status: "failed", providerResponse: error instanceof Error ? error.message : "Telegram request failed" };
  }
}

export async function dispatchCustomerNotification(params: {
  channel: NotificationChannel;
  recipient: string;
  subject: string;
  message: string;
}): Promise<DispatchResult> {
  const recipient = params.recipient.trim();
  if (!recipient) return { status: "failed", providerResponse: "Missing recipient" };

  if (params.channel === "telegram") {
    return sendTelegram(recipient, params.message);
  }

  if (params.channel === "whatsapp" && process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
    const response = await fetch(`https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: recipient.replace(/\D/g, ""), type: "text", text: { body: params.message } }),
    });
    return { status: response.ok ? "sent" : "failed", providerResponse: await response.text() };
  }

  if (params.channel === "sms" && process.env.SMS_WEBHOOK_URL) {
    const response = await fetch(process.env.SMS_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: recipient, message: params.message, subject: params.subject }),
    });
    return { status: response.ok ? "sent" : "failed", providerResponse: await response.text() };
  }

  if (params.channel === "email" && process.env.EMAIL_WEBHOOK_URL) {
    const response = await fetch(process.env.EMAIL_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: recipient, subject: params.subject, message: params.message }),
    });
    return { status: response.ok ? "sent" : "failed", providerResponse: await response.text() };
  }

  return { status: params.channel === "phone" ? "manual_required" : "queued", providerResponse: "No provider credentials configured; notification queued for external/manual delivery." };
}

export async function dispatchStaffNotification(message: string, keyboard?: TelegramInlineKeyboard): Promise<DispatchResult> {
  const chatId = (process.env.TELEGRAM_STAFF_CHAT_ID || "").trim();
  if (!chatId) return { status: "queued", providerResponse: "TELEGRAM_STAFF_CHAT_ID not configured" };
  return sendTelegram(chatId, message, keyboard);
}

export function sendTelegramMessage(chatId: string, text: string, keyboard?: TelegramInlineKeyboard): Promise<DispatchResult> {
  return sendTelegram(chatId, text, keyboard);
}

export async function answerTelegramCallback(callbackQueryId: string, text?: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    const payload: Record<string, unknown> = { callback_query_id: callbackQueryId };
    if (text) payload.text = text;
    await telegramApi("answerCallbackQuery", payload);
  } catch {
    // best effort
  }
}

export async function editTelegramMessage(chatId: string | number, messageId: number, text: string, keyboard?: TelegramInlineKeyboard | null): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    const payload: Record<string, unknown> = { chat_id: String(chatId), message_id: messageId, text };
    payload.reply_markup = { inline_keyboard: keyboard && keyboard.length > 0 ? keyboard : [] };
    await telegramApi("editMessageText", payload);
  } catch {
    // best effort
  }
}
