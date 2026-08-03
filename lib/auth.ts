import { SignJWT, jwtVerify } from "jose";
import { NextResponse } from "next/server";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "dagi-spa-secret-key-2026"
);

export async function createToken(payload: { id: number; email: string; role: string; company_id?: number; company_name?: string; company_tin?: string }) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(SECRET);
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as { id: number; email: string; role: string; company_id?: number; company_name?: string; company_tin?: string };
  } catch {
    return null;
  }
}

export async function getAuthUser(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return await verifyToken(authHeader.split(" ")[1]);
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
