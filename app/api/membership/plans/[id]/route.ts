import { NextResponse } from "next/server";

const migrated = () => NextResponse.json(
  { error: "Membership plans were consolidated into the classified Offering Master. Use /api/spa/catalog/offerings." },
  { status: 410 }
);

export async function GET() { return migrated(); }
export async function PUT() { return migrated(); }
export async function DELETE() { return migrated(); }
