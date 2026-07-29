"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  useEffect(() => {
    const load = async () => {
      const tok = localStorage.getItem("token");
      if (!tok) { setLoading(false); return; }
      try {
        const sRes = await fetch("/api/settings", { headers: { Authorization: `Bearer ${tok}` } });
        const sData = await sRes.json();
        if (sData && !sData.error) setSettings(sData);
      } catch { }
      setLoading(false);
    };
    load();
  }, []);

  const handleChange = (key: string, value: string) => {
    setSettings({ ...settings, [key]: value });
  };

  const save = async () => {
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(settings),
    });
    if (res.ok) alert("Settings saved");
    else alert("Failed to save settings");
    setSaving(false);
  };

  if (loading) {
    return <div className="d-flex justify-content-center py-5"><div className="spinner-border text-primary" role="status"></div></div>;
  }

  const fields = [
    { key: "company_name", label: "Company Name", type: "text" },
    { key: "company_address", label: "Company Address", type: "text" },
    { key: "company_phone", label: "Company Phone", type: "text" },
    { key: "company_email", label: "Company Email", type: "email" },
    { key: "currency", label: "Currency", type: "text" },
  ];

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="fw-bold mb-0">System Settings</h4>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          <i className="bi bi-save me-1"></i>{saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      <div className="row g-4">
        <div className="col-lg-8">
          <div className="card border-0 shadow-sm">
            <div className="card-header fw-semibold">Spa Configuration</div>
            <div className="card-body">
              <div className="row g-3">
                {fields.map((f) => (
                  <div className="col-md-6" key={f.key}>
                    <label className="form-label small fw-semibold">{f.label}</label>
                    <input
                      type={f.type}
                      className="form-control"
                      value={settings[f.key] || ""}
                      onChange={(e) => handleChange(f.key, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-header fw-semibold"><i className="bi bi-info-circle me-2"></i>System Information</div>
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="small">App Version</span>
                <span className="badge bg-secondary">0.1.0</span>
              </div>
              <hr />
              <div className="small text-muted">Next.js 16 · React 19 · Bootstrap 5 · PostgreSQL</div>
            </div>
          </div>

          <div className="card border-0 shadow-sm">
            <div className="card-header fw-semibold"><i className="bi bi-shield-lock me-2"></i>User Management</div>
            <div className="card-body">
              <p className="small text-muted mb-2">Manage system users, roles, and permissions.</p>
              <Link href="/dashboard/users" className="btn btn-outline-primary btn-sm w-100 mb-2">
                <i className="bi bi-people me-1"></i>Go to Users
              </Link>
              <Link href="/dashboard/roles" className="btn btn-outline-primary btn-sm w-100">
                <i className="bi bi-shield me-1"></i>Go to Roles & Permissions
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
