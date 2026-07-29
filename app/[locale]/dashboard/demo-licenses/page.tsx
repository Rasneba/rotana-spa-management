"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function DemoLicensesPage() {
  const router = useRouter();
  const [licenses, setLicenses] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ company_name: "", company_tin: "", contact_name: "", contact_email: "", duration_days: "15", notes: "", module_ids: [] as number[] });
  const [saving, setSaving] = useState(false);

  const load = () => {
    const tok = localStorage.getItem("token");
    if (!tok) { router.push("/login"); return; }
    setLoading(true);
    Promise.all([
      fetch("/api/demo-licenses", { headers: { Authorization: `Bearer ${tok}` } }).then(r => r.json()),
      fetch("/api/companies", { headers: { Authorization: `Bearer ${tok}` } }).then(r => r.json()),
      fetch("/api/modules", { headers: { Authorization: `Bearer ${tok}` } }).then(r => r.json()).catch(() => []),
    ]).then(([lics, comps, mods]) => {
      setLicenses(Array.isArray(lics) ? lics : []);
      setCompanies(Array.isArray(comps) ? comps : []);
      setModules(Array.isArray(mods) ? mods : []);
      setLoading(false);
    }).catch(() => { setError("Failed to load"); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const issue = async (e: React.FormEvent) => {
    e.preventDefault();
    const tok = localStorage.getItem("token");
    if (!tok) return;
    setSaving(true);
    try {
      const res = await fetch("/api/demo-licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setShowForm(false);
        setForm({ company_name: "", company_tin: "", contact_name: "", contact_email: "", duration_days: "15", notes: "", module_ids: [] });
        load();
      } else {
        setError(data.error || "Failed to issue license");
      }
    } catch { setError("Server error"); }
    setSaving(false);
  };

  const toggleModule = (id: number) => {
    setForm(f => ({
      ...f,
      module_ids: f.module_ids.includes(id) ? f.module_ids.filter(m => m !== id) : [...f.module_ids, id],
    }));
  };

  const revoke = async (id: number) => {
    if (!confirm("Revoke this license?")) return;
    const tok = localStorage.getItem("token");
    if (!tok) return;
    try {
      await fetch(`/api/demo-licenses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ status: "revoked" }),
      });
      load();
    } catch { setError("Failed to revoke"); }
  };

  if (loading) {
    return <div className="d-flex justify-content-center py-5"><div className="spinner-border text-primary" role="status"></div></div>;
  }

  return (
    <div className="page-enter">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="fw-bold">Demo Licenses</h3>
          <p className="text-muted small mb-0">Issue and manage company licenses</p>
        </div>
        <button className="btn btn-success btn-sm" onClick={() => setShowForm(!showForm)}>
          <i className="bi bi-plus-lg me-1"></i>{showForm ? "Cancel" : "Issue License"}
        </button>
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      {showForm && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <h6 className="fw-semibold mb-3">Issue New License</h6>
            <form onSubmit={issue}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label small">Company Name</label>
                  <input className="form-control form-control-sm" list="company-list" value={form.company_name} onChange={e => {
                    setForm({ ...form, company_name: e.target.value });
                    const selected = companies.find(c => c.name === e.target.value);
                    if (selected) setForm(f => ({ ...f, company_name: selected.name, company_tin: selected.tin }));
                  }} required />
                  <datalist id="company-list">
                    {companies.map(c => <option key={c.id} value={c.name} />)}
                  </datalist>
                </div>
                <div className="col-md-6">
                  <label className="form-label small">Company TIN</label>
                  <input className="form-control form-control-sm" value={form.company_tin} onChange={e => setForm({ ...form, company_tin: e.target.value })} required />
                </div>
                <div className="col-md-4">
                  <label className="form-label small">Contact Name</label>
                  <input className="form-control form-control-sm" value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} />
                </div>
                <div className="col-md-4">
                  <label className="form-label small">Contact Email</label>
                  <input className="form-control form-control-sm" type="email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} />
                </div>
                <div className="col-md-4">
                  <label className="form-label small">Duration (days)</label>
                  <input className="form-control form-control-sm" type="number" value={form.duration_days} onChange={e => setForm({ ...form, duration_days: e.target.value })} />
                </div>
                <div className="col-12">
                  <label className="form-label small">Notes</label>
                  <input className="form-control form-control-sm" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                </div>
                {modules.length > 0 && (
                  <div className="col-12">
                    <label className="form-label small">Modules</label>
                    <div className="d-flex gap-3 flex-wrap">
                      {modules.map(m => (
                        <div key={m.id} className="form-check">
                          <input className="form-check-input" type="checkbox" id={`mod-${m.id}`} checked={form.module_ids.includes(m.id)} onChange={() => toggleModule(m.id)} />
                          <label className="form-check-label small" htmlFor={`mod-${m.id}`}>{m.name}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-3">
                <button type="submit" className="btn btn-success btn-sm" disabled={saving}>
                  {saving ? <span className="spinner-border spinner-border-sm me-1"></span> : null}
                  Issue License
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          <table className="table table-hover mb-0">
            <thead>
              <tr>
                <th>License Key</th>
                <th>Company</th>
                <th>Contact</th>
                <th>Issued</th>
                <th>Expires</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {licenses.map(l => (
                <tr key={l.id}>
                  <td><code>{l.license_key}</code></td>
                  <td>{l.company_name}</td>
                  <td>{l.contact_name || l.contact_email || "-"}</td>
                  <td>{new Date(l.issued_date).toLocaleDateString()}</td>
                  <td>{new Date(l.expiry_date).toLocaleDateString()}</td>
                  <td>
                    {l.status === "active" ? (
                      <span className="badge bg-success">Active</span>
                    ) : l.status === "expired" ? (
                      <span className="badge bg-danger">Expired</span>
                    ) : (
                      <span className="badge bg-secondary">{l.status}</span>
                    )}
                  </td>
                  <td>
                    {l.status === "active" && (
                      <button className="btn btn-sm btn-outline-danger" onClick={() => revoke(l.id)}>
                        <i className="bi bi-x-circle"></i>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {licenses.length === 0 && (
                <tr><td colSpan={7} className="text-center text-muted py-4">No licenses issued</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
