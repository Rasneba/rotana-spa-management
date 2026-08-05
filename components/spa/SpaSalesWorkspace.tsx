"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ReadyOrder = {
  id: number;
  order_no: string;
  visit_no: string;
  customer_name: string;
  customer_phone?: string | null;
  therapist_name?: string | null;
  total_items: number;
  service_snapshot: { services?: Array<{ code: string | null; name: string; quantity: number }> };
};
type LineItem = { code: string | null; name: string; quantity: number; unit_price: number; total: number };
type Sale = {
  id: number;
  invoice_no: string;
  service_order_id: number;
  customer_name: string;
  customer_phone?: string | null;
  line_items: LineItem[];
  subtotal: string | number;
  discount: string | number;
  tax: string | number;
  total: string | number;
  payment_method: string;
  payment_status: string;
  order_status: string;
  addispay_uuid?: string | null;
  addispay_checkout_url?: string | null;
  created_at: string;
};
type ResponseShape = {
  sales: Sale[];
  readyOrders: ReadyOrder[];
  summary: { total: number; unpaid: number; pending: number; paid: number; paid_total: string | number };
  capabilities: { create: boolean; edit: boolean };
  error?: string;
};

function currency(value: string | number) {
  return new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 2 }).format(Number(value || 0));
}
function tone(status: string) {
  if (status === "paid" || status === "completed") return "success";
  if (status === "pending") return "warning";
  if (status === "failed" || status === "void") return "danger";
  return "info";
}
function titleCase(value: string) { return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function normalizeItems(items: LineItem[]) {
  return items.map((item) => ({ ...item, quantity: Number(item.quantity) || 1, unit_price: Number(item.unit_price) || 0, total: (Number(item.quantity) || 1) * (Number(item.unit_price) || 0) }));
}

export default function SpaSalesWorkspace() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [readyOrders, setReadyOrders] = useState<ReadyOrder[]>([]);
  const [summary, setSummary] = useState<ResponseShape["summary"]>({ total: 0, unpaid: 0, pending: 0, paid: 0, paid_total: 0 });
  const [capabilities, setCapabilities] = useState({ create: false, edit: false });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<Sale | null>(null);
  const [items, setItems] = useState<LineItem[]>([]);
  const [discount, setDiscount] = useState("0");
  const [tax, setTax] = useState("0");
  const [phone, setPhone] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const search = new URLSearchParams();
      if (query.trim()) search.set("q", query.trim());
      if (status) search.set("status", status);
      const response = await fetch(`/api/spa/sales/orders?${search}`, { headers: { Authorization: `Bearer ${token}` }, signal });
      const data = await response.json() as ResponseShape;
      if (!response.ok) throw new Error(data.error || "Unable to load Spa Sales");
      setSales(data.sales || []);
      setReadyOrders(data.readyOrders || []);
      setSummary(data.summary || { total: 0, unpaid: 0, pending: 0, paid: 0, paid_total: 0 });
      setCapabilities(data.capabilities || { create: false, edit: false });
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setError(loadError instanceof Error ? loadError.message : "Unable to load Spa Sales");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [query, status]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), query ? 250 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load, query]);

  const totals = useMemo(() => {
    const rows = normalizeItems(items);
    const subtotal = rows.reduce((sum, item) => sum + item.total, 0);
    const total = Math.max(0, subtotal - Number(discount || 0) + Number(tax || 0));
    return { subtotal, total };
  }, [items, discount, tax]);

  function openSale(sale: Sale) {
    setSelected(sale);
    setItems(normalizeItems(sale.line_items || []));
    setDiscount(String(sale.discount || 0));
    setTax(String(sale.tax || 0));
    setPhone(sale.customer_phone || "");
  }

  async function convert(order: ReadyOrder) {
    const token = localStorage.getItem("token");
    if (!token) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/spa/sales/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ service_order_id: order.id }),
      });
      const sale = await response.json() as Sale & { error?: string };
      if (!response.ok) throw new Error(sale.error || "Unable to convert service order");
      setNotice(`${order.order_no} converted to ${sale.invoice_no}. Add prices and collect payment.`);
      openSale(sale);
      await load();
    } catch (convertError) {
      setError(convertError instanceof Error ? convertError.message : "Unable to convert service order");
    } finally { setSaving(false); }
  }

  async function saveSale(action: "update" | "cash_payment") {
    if (!selected) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/spa/sales/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: selected.id, line_items: normalizeItems(items), discount: Number(discount || 0), tax: Number(tax || 0), action, payment_reference: action === "cash_payment" ? `CASH-${Date.now()}` : undefined }),
      });
      const sale = await response.json() as Sale & { error?: string };
      if (!response.ok) throw new Error(sale.error || "Unable to save sale");
      setSelected(sale);
      setNotice(action === "cash_payment" ? "Cash payment recorded." : "Sale updated.");
      await load();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Unable to save sale"); }
    finally { setSaving(false); }
  }

  async function startAddisPay() {
    if (!selected) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    if (!phone.trim()) { setError("Customer phone is required for AddisPay"); return; }
    await saveSale("update");
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/spa/sales/addispay/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sale_order_id: selected.id, phone_number: phone }),
      });
      const data = await response.json() as { status?: string; data?: { checkout_url?: string }; sale?: Sale; message?: string; error?: string };
      if (!response.ok || data.status !== "success") throw new Error(data.message || data.error || "Unable to initialize AddisPay");
      if (data.sale) setSelected(data.sale);
      if (data.data?.checkout_url) window.open(data.data.checkout_url, "_blank");
      setNotice("AddisPay checkout opened. Complete payment, then verify.");
      await load();
    } catch (payError) { setError(payError instanceof Error ? payError.message : "Unable to initialize AddisPay"); }
    finally { setSaving(false); }
  }

  async function verifyAddisPay() {
    if (!selected) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/spa/sales/addispay/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sale_order_id: selected.id }),
      });
      const data = await response.json() as { status?: { status?: string; message?: string }; sale?: Sale; error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to verify AddisPay");
      if (data.sale) setSelected(data.sale);
      setNotice(data.status?.status === "success" ? "AddisPay payment verified." : data.status?.message || "Payment is not completed yet.");
      await load();
    } catch (verifyError) { setError(verifyError instanceof Error ? verifyError.message : "Unable to verify AddisPay"); }
    finally { setSaving(false); }
  }

  return (
    <div className="spa-workspace-page spa-sales-page">
      <header className="spa-workspace-header">
        <div className="spa-workspace-heading"><span className="spa-workspace-icon"><i className="bi bi-shop" /></span><div><p>Cashier POS</p><h1>Spa Sales</h1><span>Convert service orders to priced sales, collect cash, or open AddisPay checkout.</span></div></div>
      </header>
      {notice && <div className="spa-workspace-alert success"><i className="bi bi-check-circle" />{notice}</div>}
      {error && <div className="spa-workspace-alert danger"><i className="bi bi-exclamation-circle" />{error}</div>}

      <section className="spa-workspace-summary">
        <article><span>Sales</span><strong>{summary.total || 0}</strong><i className="bi bi-receipt" /></article>
        <article><span>Unpaid</span><strong>{summary.unpaid || 0}</strong><i className="bi bi-hourglass" /></article>
        <article><span>Pending AddisPay</span><strong>{summary.pending || 0}</strong><i className="bi bi-phone" /></article>
        <article><span>Paid Total</span><strong>{currency(summary.paid_total || 0)}</strong><i className="bi bi-cash-stack" /></article>
      </section>

      {readyOrders.length > 0 && (
        <section className="spa-workspace-card mb-4">
          <div className="spa-workspace-toolbar"><strong>Ready for POS</strong><span className="spa-result-count">{readyOrders.length} handed-off order{readyOrders.length === 1 ? "" : "s"}</span></div>
          <div className="spa-ready-order-grid">
            {readyOrders.map((order) => <article key={order.id}><span>{order.order_no}</span><h3>{order.customer_name}</h3><p>{order.total_items} item(s) · {order.therapist_name || "Therapist"}</p><button type="button" className="spa-primary-button" disabled={!capabilities.create || saving} onClick={() => void convert(order)}><i className="bi bi-arrow-right-circle" /> Convert to sale</button></article>)}
          </div>
        </section>
      )}

      <section className="spa-workspace-card">
        <div className="spa-workspace-toolbar">
          <label className="spa-workspace-search"><i className="bi bi-search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search invoice or customer…" /></label>
          <label className="spa-workspace-filter"><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All payments</option><option value="unpaid">Unpaid</option><option value="pending">Pending</option><option value="paid">Paid</option></select></label>
        </div>
        <div className="spa-workspace-table-wrap">
          {loading ? <div className="spa-workspace-state"><span className="spinner-border spinner-border-sm" /><p>Loading Spa Sales…</p></div> : sales.length === 0 ? <div className="spa-workspace-state empty"><i className="bi bi-shop" /><h2>No sales yet</h2><p>Handed-off service orders can be converted to cashier sales here.</p></div> : (
            <table className="spa-workspace-table"><thead><tr><th>Invoice</th><th>Customer</th><th>Total</th><th>Payment</th><th>Created</th><th>Actions</th></tr></thead><tbody>{sales.map((sale) => <tr key={sale.id}><td><span className="spa-record-code">{sale.invoice_no}</span></td><td><strong>{sale.customer_name}</strong><br /><span className="text-muted small">{sale.customer_phone || "—"}</span></td><td>{currency(sale.total)}</td><td><span className={`spa-status-pill ${tone(sale.payment_status)}`}>{titleCase(sale.payment_status)}</span><br /><small>{titleCase(sale.payment_method || "cash")}</small></td><td>{new Date(sale.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</td><td><button type="button" className="spa-secondary-button" onClick={() => openSale(sale)}>Open POS</button></td></tr>)}</tbody></table>
          )}
        </div>
      </section>

      {selected && (
        <div className="spa-form-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setSelected(null); }}>
          <section className="spa-record-modal spa-sales-modal" role="dialog" aria-modal="true" aria-labelledby="spa-sale-title">
            <header><div><p>{selected.invoice_no}</p><h2 id="spa-sale-title">{selected.customer_name}</h2></div><button type="button" onClick={() => setSelected(null)}><i className="bi bi-x-lg" /></button></header>
            <div className="spa-sales-lines">
              {items.map((item, index) => <div key={`${item.name}-${index}`} className="spa-sales-line"><strong>{item.name}</strong><input type="number" min="1" value={item.quantity} onChange={(event) => setItems((rows) => rows.map((row, i) => i === index ? { ...row, quantity: Number(event.target.value) } : row))} /><input type="number" min="0" step="0.01" value={item.unit_price} onChange={(event) => setItems((rows) => rows.map((row, i) => i === index ? { ...row, unit_price: Number(event.target.value) } : row))} /><span>{currency((Number(item.quantity) || 1) * (Number(item.unit_price) || 0))}</span></div>)}
            </div>
            <div className="spa-sales-totals"><label>Discount<input type="number" min="0" step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} /></label><label>Tax<input type="number" min="0" step="0.01" value={tax} onChange={(event) => setTax(event.target.value)} /></label><strong>Total {currency(totals.total)}</strong></div>
            <div className="spa-sales-payment"><label>AddisPay Phone<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="09... or +251..." /></label></div>
            <footer><button type="button" className="spa-secondary-button" onClick={() => void saveSale("update")} disabled={saving || !capabilities.edit}>Save prices</button><button type="button" className="spa-primary-button" onClick={() => void saveSale("cash_payment")} disabled={saving || !capabilities.edit || totals.total <= 0}>Cash paid</button><button type="button" className="spa-primary-button" onClick={() => void startAddisPay()} disabled={saving || !capabilities.edit || totals.total <= 0}>Open AddisPay</button><button type="button" className="spa-secondary-button" onClick={() => void verifyAddisPay()} disabled={saving || !selected.addispay_uuid}>Verify AddisPay</button></footer>
          </section>
        </div>
      )}
    </div>
  );
}
