import { NextResponse } from "next/server";
import { withAuth, ok, err, notFound, deleted } from "@/lib/api-utils";
import { requirePermission } from "@/lib/permissions";
import pool from "@/lib/db";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { allowed } = await requirePermission(user, "view", "notifications");
    if (!allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    const { id } = await params;
    try {
      const result = await pool.query(
        `SELECT n.* FROM notifications n WHERE n.id = $1`,
        [id]
      );
      if (result.rows.length === 0) return notFound("Notification not found");
      return ok(result.rows[0]);
    } catch (e: any) { return err(e.message); }
  });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { allowed } = await requirePermission(user, "edit", "notifications");
    if (!allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    const { id } = await params;
    try {
      const result = await pool.query(
        `UPDATE notifications SET is_read = true, read_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
        [id]
      );
      if (result.rows.length === 0) return notFound("Notification not found");
      return ok(result.rows[0]);
    } catch (e: any) { return err(e.message); }
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { allowed } = await requirePermission(user, "delete", "notifications");
    if (!allowed) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    const { id } = await params;
    try {
      await pool.query("DELETE FROM notifications WHERE id = $1", [id]);
      return deleted("Notification deleted");
    } catch (e: any) { return err(e.message); }
  });
}
