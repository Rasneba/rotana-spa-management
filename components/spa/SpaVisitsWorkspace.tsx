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
    <div className="spa-workspace-page visit-board-page">
      <header className="visit-board-header">
        <div><p>Reception &amp; Treatment</p><h1>Visits</h1><span>Touch a visit card to open the service-order workspace.</span></div>
        {capabilities.create && <button type="button" onClick={() => setShowForm(true)}><i className="bi bi-plus-lg" /> New Visit</button>}
      </header>

      {error && <div className="spa-workspace-alert danger" role="alert"><i className="bi bi-exclamation-circle" />{error}</div>}

      <section className="visit-board-summary" aria-label="Visit summary">
        <article><span>Visits</span><strong>{summary.total}</strong></article>
        <article><span>Waiting</span><strong>{summary.waiting}</strong></article>
        <article className="active"><span>In Treatment</span><strong>{summary.inTreatment}</strong></article>
        <article><span>Finished</span><strong>{summary.finished}</strong></article>
      </section>

      <section className="visit-board-controls">
        <label className="visit-board-search"><i className="bi bi-search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search visit, customer or therapist…" /></label>
        <label className="visit-board-date"><i className="bi bi-calendar3" /><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <button type="button" onClick={() => setDate("")}>All Dates</button>
      </section>

      <nav className="visit-status-tabs" aria-label="Filter visits by status">
        {[
          ["", "All"],
          ["checked_in", "Checked In"],
          ["assigned", "Assigned"],
          ["in_treatment", "In Treatment"],
          ["finished", "Finished"],
          ["order_printed", "Printed"],
          ["handed_to_cashier", "At Cashier"],
        ].map(([value, label]) => <button key={value || "all"} type="button" className={status === value ? "active" : ""} onClick={() => setStatus(value)}>{label}</button>)}
      </nav>

      {loading ? (
        <div className="spa-workspace-state visit-board-loading"><span className="spinner-border" /><p>Loading visits…</p></div>
      ) : visits.length === 0 ? (
        <div className="spa-workspace-state visit-board-empty"><i className="bi bi-person-walking" /><h2>No visits found</h2><p>Create a visit when reception checks in a customer.</p>{capabilities.create && <button type="button" onClick={() => setShowForm(true)}>Create Visit</button>}</div>
      ) : (
        <section className="visit-card-grid">
          {visits.map((visit) => (
            <Link key={visit.id} href={`/dashboard/spa/operations/visits/${visit.id}`} className={`visit-touch-card ${visit.status}`}>
              <div className="visit-card-top"><code>{visit.visit_no}</code><span className={`spa-status-pill ${statusTone(visit.status)}`}>{humanizeStatus(visit.status)}</span></div>
              <div className="visit-card-customer"><span>{visit.customer_name.charAt(0).toUpperCase()}</span><div><h2>{visit.customer_name}</h2><p>{visit.customer_phone || "No phone"}</p></div></div>
              <dl>
                <div><dt>Therapist</dt><dd>{visit.therapist_name || "Unassigned"}</dd></div>
                <div><dt>Check-In</dt><dd>{new Date(visit.checked_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</dd></div>
                <div><dt>Items</dt><dd>{Number(visit.total_items || 0)}</dd></div>
              </dl>
              <footer><span>{visit.status === "in_treatment" ? "Continue Order" : visit.status === "checked_in" ? "Assign Therapist" : "Open Visit"}</span><i className="bi bi-chevron-right" /></footer>
            </Link>
          ))}
        </section>
      )}

      {showForm && (
        <div className="spa-form-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setShowForm(false); }}>
          <section className="spa-record-modal spa-visit-modal" role="dialog" aria-modal="true" aria-labelledby="create-visit-title">
            <header><div><p>Reception check-in</p><h2 id="create-visit-title">Create Visit</h2></div><button type="button" onClick={() => setShowForm(false)} aria-label="Close"><i className="bi bi-x-lg" /></button></header>
            <form onSubmit={submit}>
              <div className="spa-record-form-grid">
                <label className="span-two"><span>Existing Customer</span><select value={form.member_id} onChange={(event) => setForm((current) => ({ ...current, member_id: event.target.value }))}><option value="">Walk-in customer</option>{members.map((member) => <option key={member.id} value={member.id}>{member.customer_id ? `${member.customer_id} · ` : ""}{member.full_name}</option>)}</select></label>
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
