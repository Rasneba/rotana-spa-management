"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function CompaniesPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", tin: "", email: "", phone: "", address: "", license_type: "demo" });
  const [saving, setSaving] = useState(false);

  const load = () => {
    const tok = localStorage.getItem("token");
    if (!tok) { router.push("/login"); return; }
    setLoading(true);
    fetch("/api/companies", { headers: { Authorization: `Bearer ${tok}` } })
      .then(r => r.json())
      .then(d => { setCompanies(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => { setError("Failed to load"); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const tok = localStorage.getItem("token");
    if (!tok) return;
    setSaving(true);
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setShowForm(false);
        setForm({ name: "", tin: "", email: "", phone: "", address: "", license_type: "demo" });
        load();
      } else {
        setError(data.error || "Failed to create");
      }
    } catch { setError("Server error"); }
    setSaving(false);
  };

  if (loading) {
    return <div className="d-flex justify-content-center py-5"><div className="spinner-border text-primary" role="status"></div></div>;
  }

  return (
    <div className="page-enter">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="fw-bold">Companies</h3>
          <p className="text-muted small mb-0">Manage registered companies</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
          <i className="bi bi-plus-lg me-1"></i>{showForm ? "Cancel" : "New Company"}
        </button>
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      {showForm && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <h6 className="fw-semibold mb-3">New Company</h6>
            <form onSubmit={create}>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label small">Company Name</label>
                  <input className="form-control form-control-sm" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="col-md-3">
                  <label className="form-label small">TIN</label>
                  <input className="form-control form-control-sm" value={form.tin} onChange={e => setForm({ ...form, tin: e.target.value })} required />
                </div>
                <div className="col-md-3">
                  <label className="form-label small">Email</label>
                  <input className="form-control form-control-sm" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="col-md-2">
                  <label className="form-label small">Phone</label>
                  <input className="form-control form-control-sm" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="col-md-8">
                  <label className="form-label small">Address</label>
                  <input className="form-control form-control-sm" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="col-md-4">
                  <label className="form-label small">License Type</label>
                  <select className="form-select form-select-sm" value={form.license_type} onChange={e => setForm({ ...form, license_type: e.target.value })}>
                    <option value="demo">Demo</option>
                    <option value="trial">Trial</option>
                    <option value="full">Full</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
              </div>
              <div className="mt-3">
                <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                  {saving ? <span className="spinner-border spinner-border-sm me-1"></span> : null}
                  Create Company
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
                <th>Name</th>
                <th>TIN</th>
                <th>License</th>
                <th>Status</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Registered</th>
              </tr>
            </thead>
            <tbody>
              {companies.map(c => (
                <tr key={c.id}>
                  <td className="fw-semibold">{c.name}</td>
                  <td><code>{c.tin}</code></td>
                  <td><span className="badge bg-info">{c.license_type}</span></td>
                  <td>
                    {c.status === "active" ? (
                      <span className="badge bg-success">Active</span>
                    ) : (
                      <span className="badge bg-secondary">{c.status}</span>
                    )}
                  </td>
                  <td>{c.contact_email || c.email || "-"}</td>
                  <td>{c.contact_phone || c.phone || "-"}</td>
                  <td>{new Date(c.registration_date).toLocaleDateString()}</td>
                </tr>
              ))}
              {companies.length === 0 && (
                <tr><td colSpan={7} className="text-center text-muted py-4">No companies registered</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
