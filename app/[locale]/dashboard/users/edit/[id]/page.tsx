"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function EditUserPage() {
  const { id } = useParams();
  const router = useRouter();
  const [roles, setRoles] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuper, setIsSuper] = useState(false);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const [form, setForm] = useState<any>({ is_active: true });

  useEffect(() => {
    const load = async () => {
      const tok = localStorage.getItem("token");
      if (!tok) { setLoading(false); return; }
      const stored = localStorage.getItem("user");
      const u = stored ? JSON.parse(stored) : null;
      setIsSuper(u?.role === "super_admin");
      try {
        const [userRes, rolesRes, companiesRes] = await Promise.all([
          fetch(`/api/users/${id}`, { headers: { Authorization: `Bearer ${tok}` } }),
          fetch("/api/roles", { headers: { Authorization: `Bearer ${tok}` } }),
          fetch("/api/companies", { headers: { Authorization: `Bearer ${tok}` } }),
        ]);
        const uData = await userRes.json();
        const rData = await rolesRes.json();
        const cData = await companiesRes.json();
        if (uData && !uData.error) setForm({ ...uData, password: "", confirm_password: "" });
        if (Array.isArray(rData)) setRoles(rData);
        if (Array.isArray(cData)) setCompanies(cData);
      } catch (err) { console.error(err); }
      setLoading(false);
    };
    load();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value;
    setForm({ ...form, [e.target.name]: value });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password && form.password !== form.confirm_password) {
      alert("Passwords do not match");
      return;
    }
    try {
      const body: any = { ...form };
      if (!body.password) { delete body.password; delete body.confirm_password; }
      body.role_id = body.role_id ? parseInt(body.role_id) : null;
      body.company_id = body.company_id ? parseInt(body.company_id) : null;
      const res = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        router.push("/dashboard/users");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update user");
      }
    } catch { alert("Server error"); }
  };

  if (loading) {
    return <div className="d-flex justify-content-center py-5"><div className="spinner-border text-primary" role="status"></div></div>;
  }

  return (
    <div className="container-fluid">
      <h4 className="fw-bold mb-4">Edit User</h4>
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <form onSubmit={submit}>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label small fw-semibold">Name *</label>
                <input name="name" className="form-control" value={form.name || ""} onChange={handleChange} required />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-semibold">Email *</label>
                <input type="email" name="email" className="form-control" value={form.email || ""} onChange={handleChange} required />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-semibold">Password (leave blank to keep)</label>
                <input type="password" name="password" className="form-control" value={form.password || ""} onChange={handleChange} />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-semibold">Confirm Password</label>
                <input type="password" name="confirm_password" className="form-control" value={form.confirm_password || ""} onChange={handleChange} />
              </div>
              <div className="col-md-4">
                <label className="form-label small fw-semibold">Role</label>
                <select name="role_id" className="form-control" value={form.role_id || ""} onChange={handleChange}>
                  <option value="">Select Role</option>
                  {roles.map((r: any) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label small fw-semibold">Company <span className="text-danger">*</span></label>
                <select name="company_id" className="form-control" value={form.company_id || ""} onChange={handleChange} required disabled={!isSuper}>
                  <option value="">Select Company</option>
                  {companies.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.tin})</option>
                  ))}
                </select>
                {!isSuper && <div className="form-text text-muted small">Company is locked to your company</div>}
              </div>
              <div className="col-md-4">
                <label className="form-label small fw-semibold">Phone</label>
                <input name="phone" className="form-control" value={form.phone || ""} onChange={handleChange} />
              </div>
              <div className="col-md-4">
              </div>
              <div className="col-md-4">
                <div className="form-check form-switch mt-4">
                  <input className="form-check-input" type="checkbox" name="is_active" id="is_active"
                    checked={form.is_active ?? true} onChange={handleChange} />
                  <label className="form-check-label" htmlFor="is_active">Active</label>
                </div>
              </div>
            </div>
            <div className="mt-4 d-flex gap-2">
              <button type="submit" className="btn btn-primary px-4">
                <i className="bi bi-save me-1"></i>Update User
              </button>
              <button type="button" className="btn btn-secondary px-4" onClick={() => router.back()}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
