"use client";

import { Fragment, useEffect, useState } from "react";
import { PageHeader, LoadingSpinner } from "@/components";
import { RESOURCE_GROUPS } from "@/lib/permission-defs";

const ACTIONS = ["view", "create", "edit", "delete", "approve"];
const ACTION_LABELS: Record<string, string> = {
  view: "View", create: "Create", edit: "Edit", delete: "Delete", approve: "Approve",
};

const GROUP_ICONS: Record<string, string> = {
  Dashboard: "house-door",
  Customers: "people",
  Membership: "person-badge",
  Operations: "activity",
  Gym: "heart-pulse",
  Spa: "flower1",
  Inventory: "boxes",
  Staff: "person-workspace",
  Facilities: "building",
  Reports: "bar-chart",
  System: "gear-wide-connected",
};

export default function RolesPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [permsMap, setPermsMap] = useState<Record<number, Record<string, boolean[]>>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newRole, setNewRole] = useState({ name: "", description: "" });

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    const tok = localStorage.getItem("token");
    if (!tok) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/roles", { headers: { Authorization: `Bearer ${tok}` } });
      const data = await res.json();
      if (!Array.isArray(data)) {
        console.warn("Roles API returned non-array:", data);
        setRoles([]);
        setLoading(false);
        return;
      }

      setRoles(data);
      const map: Record<number, Record<string, boolean[]>> = {};
      await Promise.all(data.map(async (r: any) => {
        try {
          const pRes = await fetch(`/api/roles/${r.id}/permissions`, { headers: { Authorization: `Bearer ${tok}` } });
          const pData = await pRes.json();
          map[r.id] = pData || {};
        } catch { map[r.id] = {}; }
      }));
      setPermsMap(map);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const toggleBit = (roleId: number, resource: string, actionIdx: number) => {
    setPermsMap((prev) => {
      const rolePerms = { ...(prev[roleId] || {}) };
      const bits = [...(rolePerms[resource] || [false, false, false, false, false])];
      bits[actionIdx] = !bits[actionIdx];
      rolePerms[resource] = bits;
      return { ...prev, [roleId]: rolePerms };
    });
  };

  const toggleResource = (roleId: number, resource: string, on: boolean) => {
    setPermsMap((prev) => {
      const rolePerms = { ...(prev[roleId] || {}) };
      rolePerms[resource] = on ? [true, true, true, true, true] : [false, false, false, false, false];
      return { ...prev, [roleId]: rolePerms };
    });
  };

  const resourceOn = (roleId: number, resource: string): boolean => {
    const bits = permsMap[roleId]?.[resource];
    if (!bits) return false;
    return bits.every(Boolean);
  };

  const saveRole = async (roleId: number) => {
    setSaving(roleId);
    try {
      const res = await fetch(`/api/roles/${roleId}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(permsMap[roleId] || {}),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || "Failed to save");
      }
    } catch { alert("Server error"); }
    setSaving(null);
  };

  const createRole = async () => {
    if (!newRole.name.trim()) return;
    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(newRole),
      });
      if (res.ok) {
        setShowNewForm(false);
        setNewRole({ name: "", description: "" });
        loadAll();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to create role");
      }
    } catch { alert("Server error"); }
  };

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div>
      <PageHeader title="Roles & Permissions" icon="shield-lock" subtitle="Manage role-based access for all user groups">
        <button className="btn btn-primary btn-sm" onClick={() => setShowNewForm(!showNewForm)}>
          <i className="bi bi-plus-lg me-1"></i>New Role
        </button>
      </PageHeader>

      {showNewForm && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <div className="row g-3 align-items-end">
              <div className="col-md-4">
                <label className="form-label small fw-semibold">Role Name</label>
                <input className="form-control form-control-sm" placeholder="e.g. hr_manager"
                  value={newRole.name} onChange={(e) => setNewRole({ ...newRole, name: e.target.value })} />
              </div>
              <div className="col-md-5">
                <label className="form-label small fw-semibold">Description</label>
                <input className="form-control form-control-sm" placeholder="Optional description"
                  value={newRole.description} onChange={(e) => setNewRole({ ...newRole, description: e.target.value })} />
              </div>
              <div className="col-md-3">
                <button className="btn btn-success btn-sm w-100" onClick={createRole}>
                  <i className="bi bi-check-lg me-1"></i>Create Role
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {roles.map((role: any) => {
        const perms = permsMap[role.id] || {};
        return (
            <div key={role.id} className="card border-0 shadow-sm mb-4">
            <div className="card-header d-flex justify-content-between align-items-center py-3">
              <div>
                <h5 className="mb-0 fw-semibold d-inline me-2">{role.name}</h5>
                <span className="badge bg-secondary">{role.permission_count || 0} permissions</span>
                {role.name === "guest" && (
                  <span className="badge bg-warning text-dark ms-2">View-only by default</span>
                )}
                {role.description && (
                  <p className="text-muted small mb-0 mt-1">{role.description}</p>
                )}
                {role.name === "guest" && (
                  <p className="text-muted small mb-0 mt-1">
                    <i className="bi bi-info-circle me-1"></i>
                    Guests can only access pages with granted <strong>view</strong> permissions. Use the checkboxes below to grant access.
                  </p>
                )}
              </div>
              <button className="btn btn-primary btn-sm px-3" onClick={() => saveRole(role.id)} disabled={saving === role.id}>
                <i className="bi bi-save me-1"></i>{saving === role.id ? "Saving..." : "Save"}
              </button>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-bordered mb-0 small">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: "180px", minWidth: "180px" }}>Resource</th>
                      {ACTIONS.map((a) => (
                        <th key={a} className="text-center text-capitalize" style={{ width: "80px", minWidth: "80px" }}>
                          {ACTION_LABELS[a]}
                        </th>
                      ))}
                      <th className="text-center" style={{ width: "50px", minWidth: "50px" }}>
                        <i className="bi bi-check-all" title="Toggle all"></i>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(RESOURCE_GROUPS).map(([groupKey, group]) => (
                      <Fragment key={groupKey}>
                        <tr className="table-secondary">
                          <td colSpan={7} className="fw-bold small py-2">
                            <i className={`bi bi-${GROUP_ICONS[groupKey] || "gear-wide"} me-2`}></i>
                            {group.label}
                          </td>
                        </tr>
                        {group.resources.map((res) => {
                          const bits = perms[res] || [false, false, false, false, false];
                          return (
                            <tr key={res}>
                              <td className="text-capitalize ps-4">{res.replace(/_/g, " ")}</td>
                              {bits.map((bit: boolean, i: number) => (
                                <td key={i} className="text-center">
                                  <input
                                    type="checkbox"
                                    className="form-check-input"
                                    checked={bit}
                                    onChange={() => toggleBit(role.id, res, i)}
                                  />
                                </td>
                              ))}
                              <td className="text-center">
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  checked={resourceOn(role.id, res)}
                                  onChange={() => toggleResource(role.id, res, !resourceOn(role.id, res))}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
