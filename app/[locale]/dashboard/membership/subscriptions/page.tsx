"use client";

import { useEffect, useState } from "react";
import { Link } from "@/lib/i18n/navigation";
import { Plus, Repeat, Save } from "lucide-react";
import { GemBadge, GemBtn, GemBtnOutline, GemCard, GemCardBare, GemHeader, GemInput, GemSelect, GemTable } from "@/lib/gem-ui";

type Customer = { id: number; full_name: string; customer_id?: string };
type Offering = { id: number; title: string; details: { offering_code?: string; classification?: string } };
type Membership = {
  id: number;
  member_id: number;
  member_name: string;
  member_code?: string;
  offering_id?: number;
  plan_name?: string;
  billing_cycle: string;
  start_date: string;
  end_date: string;
  status: string;
};

type MembershipForm = {
  member_id: string;
  offering_id: string;
  end_date: string;
  billing_cycle: string;
  auto_renew: boolean;
};

const emptyForm: MembershipForm = { member_id: "", offering_id: "", end_date: "", billing_cycle: "monthly", auto_renew: false };

export function SubscriptionsWorkspace({ initialCreate = false }: { initialCreate?: boolean }) {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(initialCreate);
  const [form, setForm] = useState<MembershipForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
    } catch {
      setError("Unable to load memberships and offerings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const token = localStorage.getItem("token");
    if (!token || !form.member_id || !form.offering_id || !form.end_date) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/membership/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, member_id: Number(form.member_id), offering_id: Number(form.offering_id) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to assign membership");
      setShowForm(false);
      setForm(emptyForm);
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to assign membership");
    } finally {
      setSaving(false);
    }
  };

  const cancelMembership = async (id: number) => {
    if (!window.confirm("Cancel this membership assignment?")) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    const response = await fetch("/api/membership/subscriptions", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, status: "cancelled" }),
    });
    if (response.ok) await load();
  };

  const statusBadge = (status: string) => {
    const variants: Record<string, "success" | "warning" | "danger" | "default"> = { active: "success", expired: "warning", cancelled: "danger", suspended: "default" };
    return <GemBadge variant={variants[status] || "default"}>{status}</GemBadge>;
  };

  return (
    <div className="spa-workspace-page">
      <GemHeader title="Memberships & Renewals" subtitle="Assign a classified offering to the existing customer record; never register the customer again"
        actions={<GemBtn onClick={() => setShowForm(!showForm)}><Plus size={16} />New Membership</GemBtn>} />
      <div className="master-data-notice"><i className="bi bi-person-check" /><div><strong>Reuse the customer master</strong><span>Select an existing customer below. If the person is missing, add them once in Customer &amp; Member Master.</span></div></div>
      {error && <div className="spa-workspace-alert danger">{error}</div>}

      {showForm && (
        <GemCard className="mb-6">
          <h2 className="customer-master-form-title"><Repeat size={18} />Assign Membership Offering</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <label><span className="form-label">Customer *</span><GemSelect required value={form.member_id} onChange={(event) => setForm({ ...form, member_id: event.target.value })}><option value="">Select existing customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.customer_id ? `${customer.customer_id} · ` : ""}{customer.full_name}</option>)}</GemSelect></label>
            <label><span className="form-label">Offering *</span><GemSelect required value={form.offering_id} onChange={(event) => setForm({ ...form, offering_id: event.target.value })}><option value="">Select offering</option>{offerings.map((item) => <option key={item.id} value={item.id}>{item.details?.offering_code ? `${item.details.offering_code} · ` : ""}{item.title}</option>)}</GemSelect></label>
            <label><span className="form-label">End Date *</span><GemInput type="date" required value={form.end_date} onChange={(event) => setForm({ ...form, end_date: event.target.value })} /></label>
            <label><span className="form-label">Billing Cycle</span><GemSelect value={form.billing_cycle} onChange={(event) => setForm({ ...form, billing_cycle: event.target.value })}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option></GemSelect></label>
            <div className="md:col-span-4 flex justify-end gap-2"><GemBtnOutline onClick={() => setShowForm(false)}>Cancel</GemBtnOutline><GemBtn type="submit" disabled={saving}><Save size={16} />{saving ? "Saving…" : "Assign Offering"}</GemBtn></div>
          </form>
        </GemCard>
      )}

      <GemCardBare>
        {loading ? <div className="spa-workspace-state"><span className="spinner-border" /></div> : memberships.length === 0 ? <div className="spa-workspace-state"><Repeat size={32} /><p>No membership assignments yet.</p></div> : (
          <div className="overflow-x-auto p-5"><GemTable
            headers={["Customer", "Offering", "Cycle", "Start", "End", "Status", ""]}
            rows={memberships.map((membership) => [
              <Link key="customer" href={`/dashboard/spa/customers/profiles/${membership.member_id}`} className="font-semibold hover:text-blue-600">{membership.member_name}</Link>,
              <span key="offering">{membership.plan_name || "—"}</span>,
              <span key="cycle">{membership.billing_cycle}</span>,
              <span key="start">{new Date(membership.start_date).toLocaleDateString()}</span>,
              <span key="end">{new Date(membership.end_date).toLocaleDateString()}</span>,
              <span key="status">{statusBadge(membership.status)}</span>,
              membership.status === "active" ? <button key="action" className="text-red-500 hover:text-red-700 p-1 text-sm" onClick={() => void cancelMembership(membership.id)}>Cancel</button> : <span key="action">—</span>,
            ])}
          /></div>
        )}
      </GemCardBare>
    </div>
  );
}

export default function SubscriptionsPage() {
  return <SubscriptionsWorkspace />;
}
