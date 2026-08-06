import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  if (!token) return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not set on this runtime" }, { status: 500 });
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json();
    return NextResponse.json({ tokenPrefix: token.slice(0, 12), ok: data.ok, bot: data.result || data });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
