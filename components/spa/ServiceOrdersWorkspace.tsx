"use client";

import { useCallback, useEffect, useState } from "react";
import { Link } from "@/lib/i18n/navigation";
import ServiceOrderPrint from "@/components/spa/ServiceOrderPrint";
import type { SpaServiceOrder, SpaVisit } from "@/lib/spa-service-orders";
import { humanizeStatus } from "@/lib/spa-service-orders";

type ServiceOrderRow = SpaServiceOrder & {
  visit_no: string;
  customer_name: string;
  therapist_name: string;
  checked_in_at: string;
  finished_at: string;
};

type OrdersResponse = {
  orders: ServiceOrderRow[];
  summary: { total: number; drafts: number; printed: number; handed_to_cashier: number; total_items: number };
  capabilities: { create: boolean; edit: boolean };
  error?: string;
};

function tone(status: string): string {
  if (status === "handed_to_cashier") return "success";
  if (status === "printed") return "info";
  if (status === "void") return "danger";
  return "warning";
}

export default function ServiceOrdersWorkspace() {
  const [orders, setOrders] = useState<ServiceOrderRow[]>([]);
  const [summary, setSummary] = useState<OrdersResponse["summary"]>({ total: 0, drafts: 0, printed: 0, handed_to_cashier: 0, total_items: 0 });
  const [capabilities, setCapabilities] = useState({ create: false, edit: false });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | number>("");
  const [error, setError] = useState("");
  const [printOrder, setPrintOrder] = useState<SpaServiceOrder | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoading(true);
    setError("");
    const search = new URLSearchParams();
    if (query.trim()) search.set("q", query.trim());
    if (status) search.set("status", status);
    try {
      const response = await fetch(`/api/spa/service-orders?${search}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      const data = await response.json() as OrdersResponse;
      if (!response.ok) throw new Error(data.error || "Unable to load service orders");
      setOrders(data.orders || []);
      setSummary(data.summary || { total: 0, drafts: 0, printed: 0, handed_to_cashier: 0, total_items: 0 });
      setCapabilities(data.capabilities || { create: false, edit: false });
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setError(loadError instanceof Error ? loadError.message : "Unable to load service orders");
      setOrders([]);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [query, status]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), query ? 250 : 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load, query]);

  const orderAction = async (order: ServiceOrderRow, action: "print" | "handoff") => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setBusy(`${action}-${order.id}`);
    setError("");
    try {
      const response = await fetch(`/api/spa/visits/${order.visit_id}/service-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      });
      const data = await response.json() as { order: SpaServiceOrder; visit: SpaVisit; error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to update service order");
      if (action === "print") {
        setPrintOrder(data.order);
        window.setTimeout(() => window.print(), 80);
      }
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to update service order");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="spa-workspace-page service-orders-page">
      <header className="spa-workspace-header">
        <div className="spa-workspace-heading"><span className="spa-workspace-icon"><i className="bi bi-receipt-cutoff" /></span><div><p>Operational Handoff</p><h1>Service Orders</h1><span>Draft treatment slips for the separate Sales/POS cashier. No prices, payment, tax or invoices are created here.</span></div></div>
        <Link href="/dashboard/spa/operations/visits" className="spa-primary-button"><i className="bi bi-person-walking" /> Open Visits</Link>
      </header>

      <div className="pos-boundary-banner"><i className="bi bi-shield-check" /><div><strong>Separate-system boundary</strong><span>These drafts are operational references only. The cashier enters services, calculates prices and collects payment in the separate POS application.</span></div></div>
      {error && <div className="spa-workspace-alert danger" role="alert"><i className="bi bi-exclamation-circle" />{error}</div>}

      <section className="spa-workspace-summary spa-service-order-summary">
        <article><span>Total Orders</span><strong>{summary.total}</strong><i className="bi bi-receipt" /></article>
        <article><span>Drafts</span><strong>{summary.drafts}</strong><i className="bi bi-file-earmark" /></article>
        <article><span>Printed</span><strong>{summary.printed}</strong><i className="bi bi-printer" /></article>
        <article><span>At Cashier</span><strong>{summary.handed_to_cashier}</strong><i className="bi bi-person-check" /></article>
      </section>

      <section className="spa-workspace-card">
        <div className="spa-workspace-toolbar">
          <label className="spa-workspace-search"><i className="bi bi-search" /><span className="visually-hidden">Search service orders</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Order, visit, customer or therapist…" /></label>
          <label className="spa-workspace-filter"><span className="visually-hidden">Service order status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="draft">Draft</option><option value="printed">Printed</option><option value="handed_to_cashier">Handed to Cashier</option><option value="void">Void</option></select></label>
          <span className="spa-result-count">{summary.total_items} treatment item{summary.total_items === 1 ? "" : "s"}</span>
        </div>
        <div className="spa-workspace-table-wrap">
          {loading ? <div className="spa-workspace-state"><span className="spinner-border spinner-border-sm" /><p>Loading service orders…</p></div> : orders.length === 0 ? <div className="spa-workspace-state"><i className="bi bi-receipt-cutoff" /><h2>No service orders</h2><p>Draft orders are generated when a therapist finishes treatment.</p></div> : (
            <table className="spa-workspace-table">
              <thead><tr><th>Visit No</th><th>Customer</th><th>Therapist</th><th>Generated</th><th>Items</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>{orders.map((order) => <tr key={order.id}><td><span className="spa-record-code">{order.visit_no}</span></td><td><strong>{order.customer_name}</strong></td><td>{order.therapist_name}</td><td>{new Date(order.generated_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</td><td>{order.total_items}</td><td><span className={`spa-status-pill ${tone(order.status)}`}>{humanizeStatus(order.status)}</span></td><td><div className="service-order-actions"><Link href={`/dashboard/spa/operations/visits/${order.visit_id}`} title="Open visit"><i className="bi bi-eye" /></Link><button type="button" onClick={() => void orderAction(order, "print")} disabled={Boolean(busy)} title="Print draft"><i className="bi bi-printer" /></button>{capabilities.edit && order.print_count > 0 && order.status !== "handed_to_cashier" && order.status !== "void" && <button type="button" onClick={() => void orderAction(order, "handoff")} disabled={Boolean(busy)} title="Mark handed to cashier"><i className="bi bi-box-arrow-right" /></button>}</div></td></tr>)}</tbody>
            </table>
          )}
        </div>
      </section>

      {printOrder && <div className="service-order-print-only"><ServiceOrderPrint order={printOrder} /></div>}
    </div>
  );
}
