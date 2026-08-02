"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useRouter } from "@/lib/i18n/navigation";
import type { SpaVisit } from "@/lib/spa-service-orders";
import { humanizeStatus } from "@/lib/spa-service-orders";

type Member = { id: number; customer_id?: string; full_name: string; phone?: string };
type Capabilities = { create: boolean; edit: boolean; services: boolean; orders: boolean };

type VisitsResponse = {
  visits: SpaVisit[];
  capabilities: Capabilities;
  error?: string;
};

function statusTone(status: string): string {
  if (["finished", "order_printed", "handed_to_cashier"].includes(status)) return "success";
  if (["checked_in", "assigned"].includes(status)) return "warning";
  if (status === "cancelled") return "danger";
  return "info";
}

export default function SpaVisitsWorkspace() {
  const router = useRouter();
  const [visits, setVisits] = useState<SpaVisit[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [capabilities, setCapabilities] = useState<Capabilities>({ create: false, edit: false, services: false, orders: false });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ member_id: "", customer_name: "", customer_phone: "", notes: "" });

  const load = useCallback(async (signal?: AbortSignal) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoading(true);
    setError("");
    const search = new URLSearchParams();
    if (query.trim()) search.set("q", query.trim());
    if (status) search.set("status", status);
    if (date) search.set("date", date);
    try {
      const response = await fetch(`/api/spa/visits?${search}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      const data = await response.json() as VisitsResponse;
      if (!response.ok) throw new Error(data.error || "Unable to load visits");
      setVisits(data.visits || []);
      setCapabilities(data.capabilities || { create: false, edit: false, services: false, orders: false });
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setError(loadError instanceof Error ? loadError.message : "Unable to load visits");
      setVisits([]);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [date, query, status]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), query ? 250 : 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load, query]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch("/api/membership/members", { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((data: unknown) => setMembers(Array.isArray(data) ? data as Member[] : []))
      .catch(() => setMembers([]));
  }, []);

  const selectedMember = members.find((member) => String(member.id) === form.member_id);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/spa/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          member_id: form.member_id ? Number(form.member_id) : null,
          customer_name: selectedMember?.full_name || form.customer_name,
          customer_phone: selectedMember?.phone || form.customer_phone,
        }),
      });
      const data = await response.json() as SpaVisit & { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to create visit");
      setShowForm(false);
      setForm({ member_id: "", customer_name: "", customer_phone: "", notes: "" });
      router.push(`/dashboard/spa/operations/visits/${data.id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create visit");
    } finally {
      setSaving(false);
    }
  };

  const summary = useMemo(() => ({
    total: visits.length,
    waiting: visits.filter((visit) => ["checked_in", "assigned"].includes(visit.status)).length,
    inTreatment: visits.filter((visit) => visit.status === "in_treatment").length,
    finished: visits.filter((visit) => ["finished", "order_printed", "handed_to_cashier"].includes(visit.status)).length,
  }), [visits]);

  return (
    <div className="spa-workspace-page">
      <header className="spa-workspace-header">
        <div className="spa-workspace-heading">
          <span className="spa-workspace-icon"><i className="bi bi-person-walking" /></span>
          <div><p>Reception &amp; Treatment</p><h1>Visits</h1><span>Check in customers, assign therapists and follow each treatment through service-order handoff.</span></div>
        </div>
        {capabilities.create && <button type="button" className="spa-primary-button" onClick={() => setShowForm(true)}><i className="bi bi-plus-lg" /> Create Visit</button>}
      </header>

      {error && <div className="spa-workspace-alert danger" role="alert"><i className="bi bi-exclamation-circle" />{error}</div>}

      <section className="spa-workspace-summary spa-visit-summary" aria-label="Visit summary">
        <article><span>Visits</span><strong>{summary.total}</strong><i className="bi bi-people" /></article>
        <article><span>Waiting / Assigned</span><strong>{summary.waiting}</strong><i className="bi bi-hourglass-split" /></article>
        <article><span>In Treatment</span><strong>{summary.inTreatment}</strong><i className="bi bi-flower1" /></article>
        <article><span>Finished</span><strong>{summary.finished}</strong><i className="bi bi-check2-circle" /></article>
      </section>

      <section className="spa-workspace-card">
        <div className="spa-workspace-toolbar spa-visit-toolbar">
          <label className="spa-workspace-search"><i className="bi bi-search" /><span className="visually-hidden">Search visits</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Visit number, customer or therapist…" /></label>
          <label className="spa-workspace-filter"><span className="visually-hidden">Visit status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="checked_in">Checked In</option><option value="assigned">Assigned</option><option value="in_treatment">In Treatment</option><option value="finished">Finished</option><option value="order_printed">Order Printed</option><option value="handed_to_cashier">At Cashier</option><option value="cancelled">Cancelled</option></select></label>
          <label className="spa-visit-date"><span className="visually-hidden">Visit date</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
          <button type="button" className="spa-secondary-button" onClick={() => setDate("")}>All dates</button>
        </div>
        <div className="spa-workspace-table-wrap">
          {loading ? (
            <div className="spa-workspace-state"><span className="spinner-border spinner-border-sm" /><p>Loading visits…</p></div>
          ) : visits.length === 0 ? (
            <div className="spa-workspace-state"><i className="bi bi-person-walking" /><h2>No visits found</h2><p>Create a visit when reception checks in a customer.</p></div>
          ) : (
            <table className="spa-workspace-table">
              <thead><tr><th>Visit No</th><th>Customer</th><th>Therapist</th><th>Check-in</th><th>Services</th><th>Status</th><th /></tr></thead>
              <tbody>{visits.map((visit) => (
                <tr key={visit.id}>
                  <td><span className="spa-record-code">{visit.visit_no}</span></td>
                  <td><strong>{visit.customer_name}</strong>{visit.customer_phone && <small className="spa-cell-subtitle">{visit.customer_phone}</small>}</td>
                  <td>{visit.therapist_name || <span className="text-muted">Unassigned</span>}</td>
                  <td>{new Date(visit.checked_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                  <td>{Number(visit.total_items || 0)} item{Number(visit.total_items || 0) === 1 ? "" : "s"}</td>
                  <td><span className={`spa-status-pill ${statusTone(visit.status)}`}>{humanizeStatus(visit.status)}</span></td>
                  <td><Link href={`/dashboard/spa/operations/visits/${visit.id}`} className="spa-open-workspace">Open <i className="bi bi-arrow-right" /></Link></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </section>

      {showForm && (
        <div className="spa-form-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setShowForm(false); }}>
          <section className="spa-record-modal spa-visit-modal" role="dialog" aria-modal="true" aria-labelledby="create-visit-title">
            <header><div><p>Reception check-in</p><h2 id="create-visit-title">Create Visit</h2></div><button type="button" onClick={() => setShowForm(false)} aria-label="Close"><i className="bi bi-x-lg" /></button></header>
            <form onSubmit={submit}>
              <div className="spa-record-form-grid">
                <label className="span-two"><span>Existing Member</span><select value={form.member_id} onChange={(event) => setForm((current) => ({ ...current, member_id: event.target.value }))}><option value="">Walk-in customer</option>{members.map((member) => <option key={member.id} value={member.id}>{member.customer_id ? `${member.customer_id} · ` : ""}{member.full_name}</option>)}</select></label>
                {!form.member_id && <><label><span>Customer Name *</span><input required value={form.customer_name} onChange={(event) => setForm((current) => ({ ...current, customer_name: event.target.value }))} /></label><label><span>Phone</span><input type="tel" value={form.customer_phone} onChange={(event) => setForm((current) => ({ ...current, customer_phone: event.target.value }))} /></label></>}
                <label className="span-two"><span>Reception Notes</span><textarea rows={3} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional visit notes or customer requests" /></label>
              </div>
              <footer><button type="button" className="spa-secondary-button" onClick={() => setShowForm(false)} disabled={saving}>Cancel</button><button type="submit" className="spa-primary-button" disabled={saving}>{saving ? <><span className="spinner-border spinner-border-sm" /> Creating…</> : <><i className="bi bi-box-arrow-in-right" /> Check In &amp; Create Visit</>}</button></footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
