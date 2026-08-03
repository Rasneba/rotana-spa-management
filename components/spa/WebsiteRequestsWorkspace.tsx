"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type WebsiteRequest = {
  id: number;
  full_name: string;
  phone: string;
  email: string | null;
  branch: string;
  treatment: string;
  preferred_at: string;
  notes: string | null;
  staff_notes: string | null;
  status: string;
  source: string;
  locale: string;
  created_at: string;
};

type ResponseShape = {
  requests: WebsiteRequest[];
  summary: Record<string, number>;
  capabilities: { edit: boolean; delete: boolean };
  error?: string;
};

const statuses = ["new", "contacted", "confirmed", "declined", "archived"];

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(status: string) {
  if (status === "confirmed") return "success";
  if (status === "declined" || status === "archived") return "danger";
  if (status === "contacted") return "info";
  return "warning";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export default function WebsiteRequestsWorkspace() {
  const [requests, setRequests] = useState<WebsiteRequest[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [capabilities, setCapabilities] = useState({ edit: false, delete: false });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<WebsiteRequest | null>(null);
  const [editStatus, setEditStatus] = useState("new");
  const [staffNotes, setStaffNotes] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const search = new URLSearchParams();
      if (query.trim()) search.set("q", query.trim());
      if (status) search.set("status", status);
      const response = await fetch(`/api/spa/website-requests?${search}`, { headers: { Authorization: `Bearer ${token}` }, signal });
      const data = await response.json() as ResponseShape;
      if (!response.ok) throw new Error(data.error || "Unable to load website requests");
      setRequests(Array.isArray(data.requests) ? data.requests : []);
      setSummary(data.summary || {});
      setCapabilities(data.capabilities || { edit: false, delete: false });
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setError(loadError instanceof Error ? loadError.message : "Unable to load website requests");
      setRequests([]);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [query, status]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), query ? 250 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load, query]);

  const total = useMemo(() => Object.values(summary).reduce((sum, count) => sum + Number(count || 0), 0), [summary]);

  function openEdit(request: WebsiteRequest) {
    setEditing(request);
    setEditStatus(request.status);
    setStaffNotes(request.staff_notes || "");
    setError("");
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    setSavingId(editing.id);
    setError("");
    try {
      const response = await fetch("/api/spa/website-requests", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: editing.id, status: editStatus, staff_notes: staffNotes }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to update website request");
      setEditing(null);
      setNotice("Website request updated. Staff confirmation is tracked without creating an appointment or payment.");
      window.setTimeout(() => setNotice(""), 4000);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update website request");
    } finally {
      setSavingId(null);
    }
  }

  async function archive(request: WebsiteRequest) {
    if (!window.confirm(`Archive request from ${request.full_name}?`)) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    setSavingId(request.id);
    setError("");
    try {
      const response = await fetch("/api/spa/website-requests", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: request.id }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to archive website request");
      setNotice("Website request archived.");
      window.setTimeout(() => setNotice(""), 3000);
      await load();
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Unable to archive website request");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="spa-workspace-page">
      <header className="spa-workspace-header">
        <div className="spa-workspace-heading">
          <span className="spa-workspace-icon"><i className="bi bi-globe2" /></span>
          <div>
            <p>Operations</p>
            <h1>Website Requests</h1>
            <span>Review and confirm booking requests submitted from the public Dagi Spa website.</span>
          </div>
        </div>
      </header>

      {notice && <div className="spa-workspace-alert success" role="status"><i className="bi bi-check-circle" />{notice}</div>}
      {error && <div className="spa-workspace-alert danger" role="alert"><i className="bi bi-exclamation-circle" />{error}</div>}

      <section className="spa-workspace-summary" aria-label="Website request summary">
        <article><span>Total Requests</span><strong>{total.toLocaleString()}</strong><i className="bi bi-inbox" /></article>
        <article><span>New</span><strong>{Number(summary.new || 0).toLocaleString()}</strong><i className="bi bi-stars" /></article>
        <article><span>Confirmed</span><strong>{Number(summary.confirmed || 0).toLocaleString()}</strong><i className="bi bi-check2-circle" /></article>
      </section>

      <section className="spa-workspace-card">
        <div className="spa-workspace-toolbar">
          <label className="spa-workspace-search"><i className="bi bi-search" /><span className="visually-hidden">Search website requests</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, phone, email, treatment…" /></label>
          <label className="spa-workspace-filter"><span className="visually-hidden">Filter status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}</select></label>
        </div>
        <div className="spa-workspace-table-wrap">
          {loading ? <div className="spa-workspace-state"><span className="spinner-border spinner-border-sm" /><p>Loading website requests…</p></div> : requests.length === 0 ? (
            <div className="spa-workspace-state empty"><i className="bi bi-globe2" /><h2>No website requests</h2><p>Public booking form submissions will appear here for staff confirmation.</p></div>
          ) : (
            <table className="spa-workspace-table">
              <thead><tr><th>Guest</th><th>Branch</th><th>Treatment</th><th>Preferred time</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td><strong>{request.full_name}</strong><br /><span className="text-muted small">{request.phone}{request.email ? ` · ${request.email}` : ""}</span></td>
                    <td>{request.branch}</td>
                    <td>{request.treatment}</td>
                    <td>{formatDate(request.preferred_at)}<br /><span className="text-muted small">Received {formatDate(request.created_at)}</span></td>
                    <td><span className={`spa-status-pill ${statusTone(request.status)}`}>{titleCase(request.status)}</span></td>
                    <td><div className="spa-row-actions">{capabilities.edit && <button type="button" onClick={() => openEdit(request)} title="Update"><i className="bi bi-pencil" /></button>}{capabilities.delete && <button type="button" className="danger" onClick={() => void archive(request)} disabled={savingId === request.id} title="Archive"><i className="bi bi-archive" /></button>}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {editing && (
        <div className="spa-form-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && savingId === null) setEditing(null); }}>
          <section className="spa-record-modal" role="dialog" aria-modal="true" aria-labelledby="website-request-title">
            <header><div><p>Website request #{editing.id}</p><h2 id="website-request-title">{editing.full_name}</h2></div><button type="button" onClick={() => setEditing(null)} disabled={savingId !== null} aria-label="Close"><i className="bi bi-x-lg" /></button></header>
            <form onSubmit={saveEdit}>
              <div className="spa-record-detail-grid">
                <div><dt>Phone</dt><dd>{editing.phone}</dd></div>
                <div><dt>Email</dt><dd>{editing.email || "—"}</dd></div>
                <div><dt>Branch</dt><dd>{editing.branch}</dd></div>
                <div><dt>Treatment</dt><dd>{editing.treatment}</dd></div>
                <div><dt>Preferred time</dt><dd>{formatDate(editing.preferred_at)}</dd></div>
                <div><dt>Language</dt><dd>{editing.locale?.toUpperCase() || "EN"}</dd></div>
                <div className="span-two"><dt>Guest notes</dt><dd>{editing.notes || "—"}</dd></div>
              </div>
              <div className="spa-record-form-grid">
                <label><span>Status *</span><select required value={editStatus} onChange={(event) => setEditStatus(event.target.value)}>{statuses.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}</select></label>
                <label className="span-two"><span>Staff notes</span><textarea rows={4} value={staffNotes} onChange={(event) => setStaffNotes(event.target.value)} placeholder="Call outcome, confirmation notes, or decline reason…" /></label>
              </div>
              <footer><button type="button" className="spa-secondary-button" onClick={() => setEditing(null)} disabled={savingId !== null}>Cancel</button><button type="submit" className="spa-primary-button" disabled={savingId !== null}>{savingId === editing.id ? "Saving…" : "Save confirmation"}</button></footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
