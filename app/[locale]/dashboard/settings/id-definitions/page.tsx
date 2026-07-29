"use client";

import { useEffect, useState } from "react";

const ENTITY_TYPES = [
  "customer", "member",
];

const RESET_TYPES = ["never", "yearly", "monthly", "daily"];

export default function IdDefinitionsPage() {
  const [defs, setDefs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<any>({
    entity_type: "customer",
    prefix: "CUST",
    suffix: "",
    separator: "-",
    pad_length: 5,
    start_from: 1,
    reset_type: "never",
    pattern: "{PREFIX}{SEP}{SEQ}",
    branch_id: "",
    description: ""
  });
  const [saving, setSaving] = useState(false);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const defRes = await fetch("/api/settings/id-definitions", { headers: { Authorization: `Bearer ${token}` } });
      const defData = await defRes.json();
      if (Array.isArray(defData)) setDefs(defData);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setEditId(null);
    setForm({ entity_type: "customer", prefix: "CUST", suffix: "", separator: "-", pad_length: 5, start_from: 1, reset_type: "never", pattern: "{PREFIX}{SEP}{SEQ}", branch_id: "", description: "" });
    setShowForm(false);
  };

  const handleEdit = (d: any) => {
    setEditId(d.id);
    setForm({
      entity_type: d.entity_type,
      prefix: d.prefix,
      suffix: d.suffix || "",
      separator: d.separator,
      pad_length: d.pad_length,
      start_from: d.start_from,
      reset_type: d.reset_type,
      pattern: d.pattern,
      branch_id: d.branch_id || "",
      description: d.description || ""
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    const payload = { ...form, branch_id: form.branch_id ? Number(form.branch_id) : null };
    try {
      let res;
      if (editId) {
        res = await fetch(`/api/settings/id-definitions/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/settings/id-definitions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
      }
      if (res.ok) { resetForm(); load(); }
      else { const err = await res.json(); alert(err.error); }
    } catch { alert("Server error"); }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!token || !confirm("Delete this ID definition?")) return;
    try {
      const res = await fetch(`/api/settings/id-definitions/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) load();
      else alert("Failed to delete");
    } catch { alert("Server error"); }
  };

  const patternHint = (et: string) => {
    const hints: Record<string, string> = {
      customer: "{PREFIX}{SEP}{SEQ} → CUST-00001",
      member: "{PREFIX}{SEP}{SEQ} → MEM-00001",
      employee: "{PREFIX}{SEP}{SEQ} → EMP-00001",
      voucher: "{PREFIX}{SEP}{SEQ}{SEP}{SUFFIX} → VCH-00001-HO",
      parking_session: "{PREFIX}{SEP}{SEQ} → PK-000001",
      qr_ticket: "{PREFIX}{SEP}{SEQ} → QR-000001",
      invoice: "{PREFIX}{SEP}{SEQ} → INV-00001",
    };
    return hints[et] || "{PREFIX}{SEP}{SEQ} → PREFIX-00001";
  };

  return (
    <div className="page-enter">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="fw-bold mb-1"><i className="bi bi-upc-scan me-2"></i>ID Definitions</h4>
          <p className="text-muted small mb-0">Configure auto-generated ID formats per entity type, company, and branch</p>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(!showForm); }}>
          <i className={`bi ${showForm ? "bi-x" : "bi-plus-lg"} me-1`}></i>{showForm ? "Cancel" : "New Definition"}
        </button>
      </div>

      {showForm && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header fw-semibold"><i className="bi bi-pencil-square me-2"></i>{editId ? "Edit" : "New"} ID Definition</div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label small fw-semibold">Entity Type</label>
                  <select className="form-select" value={form.entity_type} onChange={e => setForm({...form, entity_type: e.target.value})}>
                    {ENTITY_TYPES.map(et => <option key={et} value={et}>{et.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
                <div className="col-md-2">
                  <label className="form-label small fw-semibold">Prefix</label>
                  <input type="text" className="form-control" required value={form.prefix} onChange={e => setForm({...form, prefix: e.target.value.toUpperCase()})} />
                </div>
                <div className="col-md-2">
                  <label className="form-label small fw-semibold">Suffix</label>
                  <input type="text" className="form-control" value={form.suffix} onChange={e => setForm({...form, suffix: e.target.value})} placeholder="e.g. {BRANCH_CODE}" />
                </div>
                <div className="col-md-1">
                  <label className="form-label small fw-semibold">Sep</label>
                  <input type="text" className="form-control" maxLength={2} value={form.separator} onChange={e => setForm({...form, separator: e.target.value})} />
                </div>
                <div className="col-md-1">
                  <label className="form-label small fw-semibold">Pad</label>
                  <input type="number" className="form-control" min={1} max={10} value={form.pad_length} onChange={e => setForm({...form, pad_length: Number(e.target.value)})} />
                </div>
                <div className="col-md-1">
                  <label className="form-label small fw-semibold">Start</label>
                  <input type="number" className="form-control" min={1} value={form.start_from} onChange={e => setForm({...form, start_from: Number(e.target.value)})} />
                </div>
                <div className="col-md-2">
                  <label className="form-label small fw-semibold">Reset</label>
                  <select className="form-select" value={form.reset_type} onChange={e => setForm({...form, reset_type: e.target.value})}>
                    {RESET_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-semibold">Pattern</label>
                  <input type="text" className="form-control" value={form.pattern} onChange={e => setForm({...form, pattern: e.target.value})} />
                  <small className="text-muted">
                    {patternHint(form.entity_type)}
                    <span className="d-block">Placeholders: {'{PREFIX} {SEP} {SEQ} {SUFFIX} {BRANCH_CODE} {YYYY} {YY} {MM} {DD}'}</span>
                  </small>
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-semibold">Description</label>
                  <input type="text" className="form-control" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
                </div>
                <div className="col-12">
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    <i className="bi bi-save me-1"></i>{saving ? "Saving..." : editId ? "Update Definition" : "Create Definition"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-4"><div className="spinner-border text-primary" role="status"></div></div>
          ) : defs.length === 0 ? (
            <div className="text-center text-muted py-4"><i className="bi bi-upc-scan fs-2 d-block mb-2"></i>No ID definitions configured</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Entity Type</th>
                    <th>Prefix</th>
                    <th>Pattern</th>
                    <th>Pad</th>
                    <th>Start</th>
                    <th>Reset</th>
                    <th>Status</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {defs.map(d => (
                    <tr key={d.id}>
                      <td className="fw-semibold text-capitalize">{d.entity_type.replace(/_/g, " ")}</td>
                      <td><span className="badge bg-dark">{d.prefix}</span></td>
                      <td className="small text-muted font-monospace">{d.pattern}</td>
                      <td>{d.pad_length}</td>
                      <td>{d.start_from}</td>
                      <td><span className="badge bg-info">{d.reset_type}</span></td>
                      <td>
                        <span className={`badge ${d.is_active ? "bg-success" : "bg-secondary"}`}>
                          {d.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="text-end">
                        <button className="btn btn-sm btn-outline-primary me-1" onClick={() => handleEdit(d)} title="Edit">
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(d.id)} title="Delete">
                          <i className="bi bi-trash"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
