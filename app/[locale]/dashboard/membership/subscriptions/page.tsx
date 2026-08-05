"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/i18n/navigation";
import { Plus, QrCode, Repeat, Save, Snowflake } from "lucide-react";
import { GemBadge, GemBtn, GemBtnOutline, GemCard, GemCardBare, GemHeader, GemInput, GemSelect, GemTable } from "@/lib/gem-ui";

type Customer = { id: number; full_name: string; customer_id?: string; phone?: string };
type Offering = { id: number; title: string; amount?: string | number | null; details: { offering_code?: string; classification?: string; duration_days?: string | number; price?: string | number } };
type Membership = {
  id: number;
  member_id: number;
  member_name: string;
  member_code?: string;
  member_phone?: string;
  offering_id?: number;
  plan_name?: string;
  billing_cycle: string;
  start_date: string;
  end_date: string;
  status: string;
  amount?: string | number;
  display_amount?: string | number;
  payment_method?: string;
  payment_reference?: string | null;
  qr_image?: string | null;
  freeze_start?: string | null;
  freeze_end?: string | null;
  notes?: string | null;
};

type MembershipForm = {
  member_id: string;
  offering_id: string;
  start_date: string;
  end_date: string;
  billing_cycle: string;
  amount: string;
  payment_method: string;
  payment_reference: string;
  notes: string;
  auto_renew: boolean;
};

const today = () => new Date().toISOString().slice(0, 10);
const emptyForm: MembershipForm = { member_id: "", offering_id: "", start_date: today(), end_date: "", billing_cycle: "monthly", amount: "", payment_method: "cash", payment_reference: "", notes: "", auto_renew: false };
function addDays(date: string, days: number) { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }
function currency(value: unknown) { return new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 2 }).format(Number(value || 0)); }

export function SubscriptionsWorkspace({ initialCreate = false }: { initialCreate?: boolean }) {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(initialCreate);
  const [form, setForm] = useState<MembershipForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [qrMembership, setQrMembership] = useState<Membership | null>(null);
  const [nowMs] = useState(() => Date.now());

  const load = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoading(true);
    try {
      const [membershipResponse, customerResponse, offeringResponse] = await Promise.all([
        fetch("/api/membership/subscriptions", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/membership/members", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/spa/catalog/offerings?status=active&limit=250", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const membershipData = await membershipResponse.json();
      const customerData = await customerResponse.json();
      const offeringData = await offeringResponse.json();
      setMemberships(Array.isArray(membershipData) ? membershipData : []);
      setCustomers(Array.isArray(customerData) ? customerData : []);
      const records = Array.isArray(offeringData.records) ? offeringData.records as Offering[] : [];
      setOfferings(records.filter((item) => ["membership_plan", "package", "access_pass"].includes(String(item.details?.classification))));
      setError("");
    } catch { setError("Unable to load memberships and offerings."); }
    finally { setLoading(false); }
  };

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, []);

  const summary = useMemo(() => ({
    total: memberships.length,
    active: memberships.filter((item) => item.status === "active").length,
    frozen: memberships.filter((item) => item.status === "frozen").length,
    expiring: memberships.filter((item) => item.status === "active" && new Date(item.end_date).getTime() - nowMs < 7 * 86_400_000).length,
  }), [memberships, nowMs]);

  function chooseOffering(id: string) {
    const offering = offerings.find((item) => String(item.id) === id);
    const duration = Number(offering?.details?.duration_days) || 30;
    const amount = offering?.amount ?? offering?.details?.price ?? "";
    setForm((current) => ({ ...current, offering_id: id, amount: amount ? String(amount) : current.amount, end_date: current.start_date ? addDays(current.start_date, duration) : current.end_date }));
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const token = localStorage.getItem("token");
    if (!token || !form.member_id || !form.offering_id) return;
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/membership/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, member_id: Number(form.member_id), offering_id: Number(form.offering_id), amount: form.amount ? Number(form.amount) : undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to assign membership");
      setShowForm(false); setForm(emptyForm); setNotice("Membership assigned and QR pass generated."); window.setTimeout(() => setNotice(""), 3500);
      await load();
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Unable to assign membership"); }
    finally { setSaving(false); }
  };

  const updateMembership = async (payload: Record<string, unknown>, success: string) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/membership/subscriptions", { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update membership");
      setNotice(success); window.setTimeout(() => setNotice(""), 3500); await load();
    } catch (actionError) { setError(actionError instanceof Error ? actionError.message : "Unable to update membership"); }
    finally { setSaving(false); }
  };

  const cancelMembership = (id: number) => { if (window.confirm("Cancel this membership assignment?")) void updateMembership({ id, status: "cancelled" }, "Membership cancelled."); };
  const renewMembership = (membership: Membership) => {
    const proposed = addDays(membership.end_date?.slice(0, 10) || today(), 30);
    const end = window.prompt("Renew until date (YYYY-MM-DD)", proposed);
    if (end) void updateMembership({ id: membership.id, action: "renew", end_date: end, amount: membership.amount || membership.display_amount || 0, payment_method: "cash" }, "Membership renewed and QR updated.");
  };
  const freezeMembership = (membership: Membership) => {
    const start = window.prompt("Freeze start date (YYYY-MM-DD)", today());
    if (!start) return;
    const end = window.prompt("Freeze end date (YYYY-MM-DD)", addDays(start, 7));
    if (end) void updateMembership({ id: membership.id, action: "freeze", freeze_start: start, freeze_end: end }, "Membership frozen.");
  };
  const unfreezeMembership = (membership: Membership) => { if (window.confirm("Unfreeze this membership and extend the end date by the frozen days?")) void updateMembership({ id: membership.id, action: "unfreeze" }, "Membership unfrozen and end date extended."); };

  const statusBadge = (status: string) => {
    const variants: Record<string, "success" | "warning" | "danger" | "default"> = { active: "success", expired: "warning", cancelled: "danger", suspended: "default", frozen: "warning", pending: "default" };
    return <GemBadge variant={variants[status] || "default"}>{status}</GemBadge>;
  };

  return (
    <div className="spa-workspace-page">
      <GemHeader title="Memberships & Renewals" subtitle="Assign offerings, collect payment details, generate QR passes, renew and freeze memberships"
        actions={<GemBtn onClick={() => setShowForm(!showForm)}><Plus size={16} />New Membership</GemBtn>} />
      <div className="spa-workspace-summary mb-4">
        <article><span>Total</span><strong>{summary.total}</strong><i className="bi bi-person-badge" /></article>
        <article><span>Active</span><strong>{summary.active}</strong><i className="bi bi-check-circle" /></article>
        <article><span>Frozen</span><strong>{summary.frozen}</strong><i className="bi bi-snow" /></article>
        <article><span>Expiring 7 Days</span><strong>{summary.expiring}</strong><i className="bi bi-hourglass-split" /></article>
      </div>
      <div className="master-data-notice"><i className="bi bi-person-check" /><div><strong>Subscription workflow</strong><span>Select an existing customer, choose a membership offering, collect payment info, and a QR pass is generated for access control.</span></div></div>
      {notice && <div className="spa-workspace-alert success"><i className="bi bi-check-circle" />{notice}</div>}
      {error && <div className="spa-workspace-alert danger">{error}</div>}

      {showForm && (
        <GemCard className="mb-6">
          <h2 className="customer-master-form-title"><Repeat size={18} />Assign Membership Offering</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <label><span className="form-label">Customer *</span><GemSelect required value={form.member_id} onChange={(event) => setForm({ ...form, member_id: event.target.value })}><option value="">Select existing customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.customer_id ? `${customer.customer_id} · ` : ""}{customer.full_name}</option>)}</GemSelect></label>
            <label><span className="form-label">Offering *</span><GemSelect required value={form.offering_id} onChange={(event) => chooseOffering(event.target.value)}><option value="">Select offering</option>{offerings.map((item) => <option key={item.id} value={item.id}>{item.details?.offering_code ? `${item.details.offering_code} · ` : ""}{item.title}</option>)}</GemSelect></label>
            <label><span className="form-label">Start Date</span><GemInput type="date" value={form.start_date} onChange={(event) => setForm({ ...form, start_date: event.target.value })} /></label>
            <label><span className="form-label">End Date *</span><GemInput type="date" required value={form.end_date} onChange={(event) => setForm({ ...form, end_date: event.target.value })} /></label>
            <label><span className="form-label">Billing Cycle</span><GemSelect value={form.billing_cycle} onChange={(event) => setForm({ ...form, billing_cycle: event.target.value })}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option></GemSelect></label>
            <label><span className="form-label">Amount (ETB)</span><GemInput type="number" min="0" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label>
            <label><span className="form-label">Payment Method</span><GemSelect value={form.payment_method} onChange={(event) => setForm({ ...form, payment_method: event.target.value })}><option value="cash">Cash</option><option value="card">Card</option><option value="bank_transfer">Bank Transfer</option><option value="mobile_money">Mobile Money</option><option value="addispay">AddisPay</option></GemSelect></label>
            <label><span className="form-label">Payment Reference</span><GemInput value={form.payment_reference} onChange={(event) => setForm({ ...form, payment_reference: event.target.value })} /></label>
            <label className="md:col-span-4"><span className="form-label">Notes</span><GemInput value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
            <div className="md:col-span-4 flex justify-end gap-2"><GemBtnOutline onClick={() => setShowForm(false)}>Cancel</GemBtnOutline><GemBtn type="submit" disabled={saving}><Save size={16} />{saving ? "Saving…" : "Assign & Generate QR"}</GemBtn></div>
          </form>
        </GemCard>
      )}

      <GemCardBare>
        {loading ? <div className="spa-workspace-state"><span className="spinner-border" /></div> : memberships.length === 0 ? <div className="spa-workspace-state"><Repeat size={32} /><p>No membership assignments yet.</p></div> : (
          <div className="overflow-x-auto p-5"><GemTable
            headers={["Customer", "Offering", "Amount", "Payment", "Start", "End", "Status", "Actions"]}
            rows={memberships.map((membership) => [
              <Link key="customer" href={`/dashboard/spa/customers/profiles/${membership.member_id}`} className="font-semibold hover:text-blue-600">{membership.member_name}</Link>,
              <span key="offering">{membership.plan_name || "—"}</span>,
              <span key="amount">{currency(membership.display_amount ?? membership.amount ?? 0)}</span>,
              <span key="payment">{membership.payment_method || "cash"}{membership.payment_reference ? ` · ${membership.payment_reference}` : ""}</span>,
              <span key="start">{new Date(membership.start_date).toLocaleDateString()}</span>,
              <span key="end">{new Date(membership.end_date).toLocaleDateString()}</span>,
              <span key="status">{statusBadge(membership.status)}</span>,
              <div key="action" className="membership-action-row">
                <button type="button" onClick={() => setQrMembership(membership)} title="QR"><QrCode size={15} /></button>
                <button type="button" onClick={() => renewMembership(membership)}>Renew</button>
                {membership.status === "frozen" ? <button type="button" onClick={() => unfreezeMembership(membership)}>Unfreeze</button> : <button type="button" onClick={() => freezeMembership(membership)}><Snowflake size={14} />Freeze</button>}
                {membership.status === "active" && <button type="button" className="danger" onClick={() => cancelMembership(membership.id)}>Cancel</button>}
              </div>,
            ])}
          /></div>
        )}
      </GemCardBare>

      {qrMembership && <div className="spa-form-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setQrMembership(null); }}><section className="spa-record-modal membership-qr-modal"><header><div><p>{qrMembership.member_code || "Membership"}</p><h2>{qrMembership.member_name}</h2></div><button type="button" onClick={() => setQrMembership(null)}><i className="bi bi-x-lg" /></button></header><div className="membership-qr-body">{qrMembership.qr_image ? <img src={qrMembership.qr_image} alt="Membership QR pass" /> : <QrCode size={120} />}<strong>{qrMembership.plan_name}</strong><span>Valid until {new Date(qrMembership.end_date).toLocaleDateString()}</span></div></section></div>}
    </div>
  );
}

export default function SubscriptionsPage() { return <SubscriptionsWorkspace />; }
