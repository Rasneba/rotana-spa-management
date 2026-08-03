import pool from "@/lib/db";
import type { AuthUser } from "@/lib/api-utils";

export type PermissionAction = "view" | "create" | "edit" | "delete" | "approve";

export { RESOURCE_GROUPS, getAllResources, getDefaultPermissions } from "@/lib/permission-defs";

export function actionsToBits(actions: PermissionAction[]): boolean[] {
  const all: PermissionAction[] = ["view", "create", "edit", "delete", "approve"];
  return all.map((a) => actions.includes(a));
}

export function bitsToActions(bits: boolean[]): PermissionAction[] {
  const all: PermissionAction[] = ["view", "create", "edit", "delete", "approve"];
  return all.filter((_, i) => bits[i]);
}

let permissionCache: Record<string, Record<string, boolean[]>> | null = null;
let permissionCacheTime = 0;
const CACHE_TTL = 30000;

async function fetchRolePermissions(): Promise<Record<string, Record<string, boolean[]>>> {
  if (permissionCache && Date.now() - permissionCacheTime < CACHE_TTL) {
    return permissionCache;
  }
  try {
    const result = await pool.query(`
      SELECT r.name as role_name, rp.resource,
        rp.can_view, rp.can_create, rp.can_edit, rp.can_delete, rp.can_approve
      FROM role_permissions rp
      JOIN roles r ON r.id = rp.role_id
    `);
    const map: Record<string, Record<string, boolean[]>> = {};
    for (const row of result.rows) {
      if (!map[row.role_name]) map[row.role_name] = {};
      map[row.role_name][row.resource] = [
        row.can_view, row.can_create, row.can_edit, row.can_delete, row.can_approve,
      ];
    }
    permissionCache = map;
    permissionCacheTime = Date.now();
    return map;
  } catch {
    return {};
  }
}

export function clearPermissionCache(): void {
  permissionCache = null;
  permissionCacheTime = 0;
}

export async function can(
  user: AuthUser,
  action: PermissionAction,
  resource: string
): Promise<boolean> {
  if (user.role === "super_admin") return true;

  const actionIndex: Record<PermissionAction, number> = {
    view: 0, create: 1, edit: 2, delete: 3, approve: 4,
  };

  const rolePerms = await fetchRolePermissions();
  const resourcePerms = rolePerms[user.role]?.[resource];

  if (!resourcePerms) {
    if (user.role === "admin") return true;
    if (user.role === "guest") return false;
    return false;
  }

  return resourcePerms[actionIndex[action]] === true;
}

export async function requirePermission(
  user: AuthUser,
  action: PermissionAction,
  resource: string
): Promise<{ allowed: boolean; error?: any }> {
  const allowed = await can(user, action, resource);
  if (!allowed) {
    return {
      allowed: false,
      error: { error: `Permission denied: ${action} ${resource}` },
    };
  }
  return { allowed: true };
}

export async function hasAny(
  user: AuthUser,
  resource: string
): Promise<boolean> {
  if (user.role === "super_admin" || user.role === "admin") return true;
  const rolePerms = await fetchRolePermissions();
  const perms = rolePerms[user.role]?.[resource];
  if (!perms) return false;
  return perms.some(Boolean);
}

export function isGuest(user: AuthUser): boolean {
  return user.role === "guest";
}
