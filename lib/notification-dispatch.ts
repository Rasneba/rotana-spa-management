export type NotificationChannel = "sms" | "telegram" | "whatsapp" | "email" | "phone";

export async function dispatchCustomerNotification(params: {
  channel: NotificationChannel;
  recipient: string;
  subject: string;
  message: string;
}): Promise<{ status: "sent" | "queued" | "failed" | "manual_required"; providerResponse?: string }> {
  const recipient = params.recipient.trim();
  if (!recipient) return { status: "failed", providerResponse: "Missing recipient" };

  if (params.channel === "telegram" && process.env.TELEGRAM_BOT_TOKEN) {
    const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: recipient, text: params.message }),
    });
    return { status: response.ok ? "sent" : "failed", providerResponse: await response.text() };
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
