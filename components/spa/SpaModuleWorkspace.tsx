"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SpaFieldDefinition, SpaModuleDefinition } from "@/lib/spa-modules";

type FieldValue = string | number | null;

type SpaRecord = {
  id: number | string;
  company_id: number;
  record_code: string;
  title: string;
  status: string;
  record_date: string | null;
  amount: string | number | null;
  details: Record<string, FieldValue>;
  created_at: string;
  updated_at: string;
};

type WorkspaceResponse = {
  records: SpaRecord[];
  filteredCount: number;
  summary: {
    total: number;
    today: number;
    total_amount: string | number;
    statuses: Record<string, number>;
  };
  capabilities: { create: boolean; edit: boolean; delete: boolean; approve: boolean };
  error?: string;
};

type FormState = Record<string, string> & { status: string };

function localDateTimeValue(date = new Date()): string {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function initialForm(definition: SpaModuleDefinition): FormState {
  const form: FormState = { status: definition.defaultStatus };
  for (const field of definition.fields) {
    if (field.required && field.type === "date") form[field.key] = new Date().toISOString().slice(0, 10);
    else if (field.required && field.type === "datetime-local") form[field.key] = localDateTimeValue();
    else form[field.key] = "";
  }
  return form;
}

function titleCase(value: string): string {
  return value.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(status: string): string {
  if (["active", "available", "approved", "completed", "paid", "verified", "operational", "resolved", "in-stock", "recorded"].includes(status)) return "success";
  if (["pending", "waiting", "scheduled", "queued", "submitted", "follow-up", "low-stock", "draft"].includes(status)) return "warning";
  if (["rejected", "cancelled", "inactive", "out-of-stock", "out-of-service", "expired", "blocked", "no-show"].includes(status)) return "danger";
  return "info";
}

function formatDate(value: FieldValue, withTime = false): string {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return withTime
    ? date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
    : date.toLocaleDateString([], { dateStyle: "medium" });
}

function formatValue(field: SpaFieldDefinition, value: FieldValue): string {
  if (value === null || value === undefined || value === "") return "—";
  if (field.type === "currency") {
    return new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 2 }).format(Number(value));
  }
  if (field.type === "date") return formatDate(value);
  if (field.type === "datetime-local") return formatDate(value, true);
  if (field.type === "number") return Number(value).toLocaleString();
  return String(value);
}

function escapeCsv(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export default function SpaModuleWorkspace({ definition }: { definition: SpaModuleDefinition }) {
  const [records, setRecords] = useState<SpaRecord[]>([]);
  const [summary, setSummary] = useState<WorkspaceResponse["summary"]>({ total: 0, today: 0, total_amount: 0, statuses: {} });
  const [capabilities, setCapabilities] = useState<WorkspaceResponse["capabilities"]>({ create: false, edit: false, delete: false, approve: false });
  const [filteredCount, setFilteredCount] = useState(0);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [classificationFilter, setClassificationFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [viewing, setViewing] = useState<SpaRecord | null>(null);
  const [editing, setEditing] = useState<SpaRecord | null>(null);
  const [form, setForm] = useState<FormState>(() => initialForm(definition));

  const endpoint = `/api/spa/${definition.section}/${definition.slug}`;
  const listFields = useMemo(() => {
    const selected = definition.fields.filter((field) => field.list);
    return (selected.length > 0 ? selected : definition.fields).slice(0, 5);
  }, [definition]);
  const classificationOptions = definition.fields.find((field) => field.key === "classification")?.options || [];

  const load = useCallback(async (signal?: AbortSignal) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoading(true);
    setError("");
    const search = new URLSearchParams({ limit: "250" });
    if (query.trim()) search.set("q", query.trim());
    if (statusFilter) search.set("status", statusFilter);
    if (classificationFilter) search.set("classification", classificationFilter);

    try {
      const response = await fetch(`${endpoint}?${search}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      const data = await response.json() as WorkspaceResponse;
      if (!response.ok) throw new Error(data.error || "Unable to load records");
      setRecords(Array.isArray(data.records) ? data.records : []);
      setSummary(data.summary || { total: 0, today: 0, total_amount: 0, statuses: {} });
      setCapabilities(data.capabilities || { create: false, edit: false, delete: false, approve: false });
      setFilteredCount(Number(data.filteredCount || 0));
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setError(loadError instanceof Error ? loadError.message : "Unable to load records");
      setRecords([]);
      setCapabilities({ create: false, edit: false, delete: false, approve: false });
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [endpoint, query, statusFilter, classificationFilter]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), query ? 250 : 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load, query]);

  useEffect(() => {
    if (!showForm && !viewing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || saving) return;
      setShowForm(false);
      setViewing(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showForm, viewing, saving]);

  const openCreate = () => {
    setEditing(null);
    setForm(initialForm(definition));
    setError("");
    setShowForm(true);
  };

  const openEdit = (record: SpaRecord) => {
    const next = initialForm(definition);
    for (const field of definition.fields) {
      const value = record.details?.[field.key];
      if (value === null || value === undefined) next[field.key] = "";
      else if (field.type === "datetime-local") {
        const date = new Date(String(value));
        next[field.key] = Number.isNaN(date.getTime()) ? String(value) : localDateTimeValue(date);
      } else next[field.key] = String(value);
    }
    next.status = record.status;
    setEditing(record);
    setForm(next);
    setError("");
    setShowForm(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) return;
    setSaving(true);
    setError("");
    try {
      const payload: Record<string, unknown> = { ...form };
      if (editing) payload.id = editing.id;
      const response = await fetch(endpoint, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || `Unable to save ${definition.singular.toLowerCase()}`);
      setShowForm(false);
      setNotice(`${definition.singular} ${editing ? "updated" : "created"} successfully.`);
      window.setTimeout(() => setNotice(""), 3500);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save record");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (record: SpaRecord) => {
    if (!window.confirm(`Delete ${record.title}? This action is recorded in the audit log.`)) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: record.id }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to delete record");
      setNotice(`${definition.singular} deleted.`);
      window.setTimeout(() => setNotice(""), 3500);
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete record");
    }
  };

  const exportCsv = () => {
    const headers = ["Code", ...listFields.map((field) => field.label), "Status", "Updated"];
    const rows = records.map((record) => [
      record.record_code,
      ...listFields.map((field) => record.details?.[field.key] ?? ""),
      record.status,
      record.updated_at,
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${definition.slug}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const leadingStatus = Object.entries(summary.statuses || {}).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="spa-workspace-page">
      <header className="spa-workspace-header">
        <div className="spa-workspace-heading">
          <span className="spa-workspace-icon"><i className={`bi bi-${definition.icon}`} /></span>
          <div>
            <p>{titleCase(definition.section)} Management</p>
            <h1>{definition.title}</h1>
            <span>{definition.description}</span>
          </div>
        </div>
        <div className="spa-workspace-actions">
          <button type="button" className="spa-secondary-button" onClick={exportCsv} disabled={records.length === 0}>
            <i className="bi bi-download" /> Export
          </button>
          {capabilities.create && (
            <button type="button" className="spa-primary-button" onClick={openCreate}>
              <i className="bi bi-plus-lg" /> Add {definition.singular}
            </button>
          )}
        </div>
      </header>

      {notice && <div className="spa-workspace-alert success" role="status"><i className="bi bi-check-circle" />{notice}</div>}
      {error && !showForm && <div className="spa-workspace-alert danger" role="alert"><i className="bi bi-exclamation-circle" />{error}</div>}

      <section className="spa-workspace-summary" aria-label={`${definition.title} summary`}>
        <article><span>Total Records</span><strong>{Number(summary.total || 0).toLocaleString()}</strong><i className="bi bi-collection" /></article>
        <article><span>Added Today</span><strong>{Number(summary.today || 0).toLocaleString()}</strong><i className="bi bi-calendar2-check" /></article>
        {definition.amountField ? (
          <article><span>Total Value</span><strong>{new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 0 }).format(Number(summary.total_amount || 0))}</strong><i className="bi bi-cash-stack" /></article>
        ) : (
          <article><span>Leading Status</span><strong className="summary-status">{leadingStatus ? `${titleCase(leadingStatus[0])} · ${leadingStatus[1]}` : "No data"}</strong><i className="bi bi-activity" /></article>
        )}
      </section>

      <section className="spa-workspace-card">
        <div className="spa-workspace-toolbar">
          <label className="spa-workspace-search">
            <i className="bi bi-search" />
            <span className="visually-hidden">Search {definition.title}</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${definition.title.toLowerCase()}…`} />
          </label>
          {classificationOptions.length > 0 && (
            <label className="spa-workspace-filter">
              <span className="visually-hidden">Filter by classification</span>
              <select value={classificationFilter} onChange={(event) => setClassificationFilter(event.target.value)}>
                <option value="">All classifications</option>
                {classificationOptions.map((classification) => <option key={classification} value={classification}>{titleCase(classification)}</option>)}
              </select>
            </label>
          )}
          <label className="spa-workspace-filter">
            <span className="visually-hidden">Filter by status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">All statuses</option>
              {definition.statusOptions.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}
            </select>
          </label>
          <span className="spa-result-count">{filteredCount.toLocaleString()} result{filteredCount === 1 ? "" : "s"}</span>
        </div>

        <div className="spa-workspace-table-wrap">
          {loading ? (
            <div className="spa-workspace-state"><span className="spinner-border spinner-border-sm" /><p>Loading {definition.title.toLowerCase()}…</p></div>
          ) : records.length === 0 ? (
            <div className="spa-workspace-state empty">
              <i className={`bi bi-${definition.icon}`} />
              <h2>{query || statusFilter || classificationFilter ? "No matching records" : `No ${definition.title.toLowerCase()} yet`}</h2>
              <p>{query || statusFilter || classificationFilter ? "Try changing your search or status filter." : `Add the first ${definition.singular.toLowerCase()} to begin.`}</p>
              {!query && !statusFilter && !classificationFilter && capabilities.create && <button type="button" className="spa-primary-button" onClick={openCreate}>Add {definition.singular}</button>}
            </div>
          ) : (
            <table className="spa-workspace-table">
              <thead><tr><th>Code</th>{listFields.map((field) => <th key={field.key}>{field.label}</th>)}<th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td><span className="spa-record-code">{record.record_code}</span></td>
                    {listFields.map((field) => <td key={field.key}>{formatValue(field, record.details?.[field.key])}</td>)}
                    <td><span className={`spa-status-pill ${statusTone(record.status)}`}>{titleCase(record.status)}</span></td>
                    <td>
                      <div className="spa-row-actions">
                        <button type="button" onClick={() => setViewing(record)} aria-label={`View ${record.title}`} title="View"><i className="bi bi-eye" /></button>
                        {capabilities.edit && <button type="button" onClick={() => openEdit(record)} aria-label={`Edit ${record.title}`} title="Edit"><i className="bi bi-pencil" /></button>}
                        {capabilities.delete && <button type="button" className="danger" onClick={() => void remove(record)} aria-label={`Delete ${record.title}`} title="Delete"><i className="bi bi-trash" /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {viewing && (
        <div className="spa-form-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setViewing(null); }}>
          <section className="spa-record-modal spa-record-detail" role="dialog" aria-modal="true" aria-labelledby="spa-record-detail-title">
            <header>
              <div><p>{viewing.record_code}</p><h2 id="spa-record-detail-title">{viewing.title}</h2></div>
              <button type="button" onClick={() => setViewing(null)} aria-label="Close"><i className="bi bi-x-lg" /></button>
            </header>
            <div className="spa-record-detail-body">
              <div className="spa-record-detail-meta">
                <div><span>Status</span><strong><span className={`spa-status-pill ${statusTone(viewing.status)}`}>{titleCase(viewing.status)}</span></strong></div>
                <div><span>Created</span><strong>{formatDate(viewing.created_at, true)}</strong></div>
                <div><span>Last Updated</span><strong>{formatDate(viewing.updated_at, true)}</strong></div>
              </div>
              <dl className="spa-record-detail-grid">
                {definition.fields.map((field) => {
                  const value = viewing.details?.[field.key];
                  return (
                    <div key={field.key} className={field.type === "textarea" ? "span-two" : ""}>
                      <dt>{field.label}</dt>
                      <dd>
                        {field.type === "url" && value ? (
                          <a href={String(value)} target="_blank" rel="noreferrer">Open attachment <i className="bi bi-box-arrow-up-right" /></a>
                        ) : formatValue(field, value)}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
            <footer>
              <button type="button" className="spa-secondary-button" onClick={() => setViewing(null)}>Close</button>
              {capabilities.edit && <button type="button" className="spa-primary-button" onClick={() => { const record = viewing; setViewing(null); openEdit(record); }}><i className="bi bi-pencil" /> Edit {definition.singular}</button>}
            </footer>
          </section>
        </div>
      )}

      {showForm && (
        <div className="spa-form-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setShowForm(false); }}>
          <section className="spa-record-modal" role="dialog" aria-modal="true" aria-labelledby="spa-record-modal-title">
            <header>
              <div><p>{editing ? "Update record" : "New record"}</p><h2 id="spa-record-modal-title">{editing ? `Edit ${definition.singular}` : `Add ${definition.singular}`}</h2></div>
              <button type="button" onClick={() => setShowForm(false)} disabled={saving} aria-label="Close"><i className="bi bi-x-lg" /></button>
            </header>
            <form onSubmit={save}>
              {error && <div className="spa-workspace-alert danger" role="alert"><i className="bi bi-exclamation-circle" />{error}</div>}
              <div className="spa-record-form-grid">
                {definition.fields.map((field) => (
                  <label key={field.key} className={field.type === "textarea" ? "span-two" : ""}>
                    <span>{field.label}{field.required && <em> *</em>}</span>
                    {field.type === "textarea" ? (
                      <textarea rows={3} required={field.required} placeholder={field.placeholder} value={form[field.key] || ""} onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))} />
                    ) : field.type === "select" ? (
                      <select required={field.required} value={form[field.key] || ""} onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}>
                        <option value="">Select {field.label.toLowerCase()}</option>
                        {field.options?.map((option) => <option key={option} value={option}>{titleCase(option)}</option>)}
                      </select>
                    ) : (
                      <input
                        type={field.type === "currency" ? "number" : field.type}
                        required={field.required}
                        placeholder={field.placeholder}
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        value={form[field.key] || ""}
                        onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
                      />
                    )}
                  </label>
                ))}
                <label>
                  <span>Status *</span>
                  <select required value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                    {definition.statusOptions.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}
                  </select>
                </label>
              </div>
              <footer>
                <button type="button" className="spa-secondary-button" onClick={() => setShowForm(false)} disabled={saving}>Cancel</button>
                <button type="submit" className="spa-primary-button" disabled={saving}>
                  {saving ? <><span className="spinner-border spinner-border-sm" /> Saving…</> : <><i className="bi bi-check-lg" /> {editing ? "Save Changes" : `Create ${definition.singular}`}</>}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
