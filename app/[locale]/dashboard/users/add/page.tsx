"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AddUserPage() {
  const router = useRouter();
  const [roles, setRoles] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [isSuper, setIsSuper] = useState(false);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const [form, setForm] = useState({
    name: "", email: "", password: "", confirm_password: "",
    role_id: "", phone: "", company_id: "", is_active: true,
  });

  useEffect(() => {
    const tok = localStorage.getItem("token");
    if (!tok) return;
    const stored = localStorage.getItem("user");
    const u = stored ? JSON.parse(stored) : null;
    setIsSuper(u?.role === "super_admin");

    Promise.all([
      fetch("/api/roles", { headers: { Authorization: `Bearer ${tok}` } }).then(r => r.json()),
      fetch("/api/companies", { headers: { Authorization: `Bearer ${tok}` } }).then(r => r.json()),
    ]).then(([r, c]) => {
      if (Array.isArray(r)) setRoles(r);
      if (Array.isArray(c)) {
        setCompanies(c);
        if (!u || u.role !== "super_admin") {
          const userCompany = c.find((comp: any) => comp.id === u?.company_id);
          if (userCompany) {
            setForm(prev => ({ ...prev, company_id: String(userCompany.id) }));
          }
        }
      }
    }).catch(() => {});
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value;
    setForm({ ...form, [e.target.name]: value });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm_password) {
      alert("Passwords do not match");
      return;
    }
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          role_id: form.role_id ? parseInt(form.role_id) : null,
          company_id: form.company_id ? parseInt(form.company_id) : null,
        }),
      });
      if (res.ok) {
        router.push("/dashboard/users");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create user");
      }
    } catch { alert("Server error"); }
  };

  return (
    <div className="container-fluid">
      <h4 className="fw-bold mb-4">Add User</h4>
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <form onSubmit={submit}>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label small fw-semibold">Name *</label>
                <input name="name" className="form-control" value={form.name} onChange={handleChange} required />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-semibold">Email *</label>
                <input type="email" name="email" className="form-control" value={form.email} onChange={handleChange} required />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-semibold">Password *</label>
                <input type="password" name="password" className="form-control" value={form.password} onChange={handleChange} required />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-semibold">Confirm Password *</label>
                <input type="password" name="confirm_password" className="form-control" value={form.confirm_password} onChange={handleChange} required />
              </div>
              <div className="col-md-4">
                <label className="form-label small fw-semibold">Role</label>
                <select name="role_id" className="form-control" value={form.role_id} onChange={handleChange}>
                  <option value="">Select Role</option>
                  {roles.map((r: any) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                {form.role_id && roles.find((r: any) => String(r.id) === form.role_id)?.name === "guest" && (
                  <div className="form-text text-warning small">
                    <i className="bi bi-info-circle me-1"></i>
                    Configure guest permissions in <a href="/dashboard/roles">Roles &amp; Permissions</a> after creating this user.
                  </div>
                )}
              </div>
              <div className="col-md-4">
                <label className="form-label small fw-semibold">Company <span className="text-danger">*</span></label>
                <select name="company_id" className="form-control" value={form.company_id} onChange={handleChange} required disabled={!isSuper}>
                  <option value="">Select Company</option>
                  {companies.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.tin})</option>
                  ))}
                </select>
                {!isSuper && <div className="form-text text-muted small">Company is locked to your company</div>}
              </div>
              <div className="col-md-4">
                <label className="form-label small fw-semibold">Phone</label>
                <input name="phone" className="form-control" value={form.phone} onChange={handleChange} />
              </div>
              <div className="col-md-4">
              </div>
              <div className="col-md-4">
                <div className="form-check form-switch mt-4">
                  <input className="form-check-input" type="checkbox" name="is_active" id="is_active"
                    checked={form.is_active} onChange={handleChange} />
                  <label className="form-check-label" htmlFor="is_active">Active</label>
                </div>
              </div>
            </div>
            <div className="mt-4 d-flex gap-2">
              <button type="submit" className="btn btn-primary px-4">
                <i className="bi bi-save me-1"></i>Save User
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
