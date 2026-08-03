"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/i18n/navigation";
import { Eye, Plus, Users } from "lucide-react";
import { GemAlert, GemBadge, GemBtn, GemBtnOutline, GemCard, GemCardBare, GemHeader, GemInput, GemSelect, GemTable } from "@/lib/gem-ui";

type CustomerRecord = {
  id: number;
  customer_id: string;
  full_name: string;
  phone?: string;
  email?: string;
  id_number?: string;
  classification?: string;
  plan_name?: string;
  offering_id?: number;
  start_date?: string;
  end_date?: string;
  status?: string;
};
type Offering = { id: number; title: string; details: { classification?: string; offering_code?: string; validity_days?: number } };

const TODAY_KEY = new Date().toISOString().slice(0, 10);

const emptyForm = {
  full_name: "",
  phone: "",
  email: "",
  id_number: "",
  address: "",
  classification: "customer",
  offering_id: "",
  start_date: TODAY_KEY,
  notes: "",
};

export function MembersWorkspace({ initialCreate = false }: { initialCreate?: boolean }) {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [classificationFilter, setClassificationFilter] = useState("");
  const [showForm, setShowForm] = useState(initialCreate);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [existingCustomer, setExistingCustomer] = useState<{ id: number; full_name: string } | null>(null);

  const load = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoading(true);
    try {
      const [customerResponse, offeringResponse] = await Promise.all([
        fetch("/api/membership/members", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/spa/catalog/offerings?status=active&limit=250", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const customerData = await customerResponse.json();
      const offeringData = await offeringResponse.json();
      setCustomers(Array.isArray(customerData) ? customerData : []);
      const records = Array.isArray(offeringData.records) ? offeringData.records as Offering[] : [];
      setOfferings(records.filter((offering) => ["membership_plan", "package", "access_pass"].includes(String(offering.details?.classification))));
      setError("");
    } catch {
      setError("Unable to load the customer master.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const createCustomer = async (event: React.FormEvent) => {
    event.preventDefault();
    const token = localStorage.getItem("token");
    if (!token || !form.full_name.trim()) return;
    setSaving(true);
    setError("");
    setExistingCustomer(null);
    try {
      const response = await fetch("/api/membership/members", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, offering_id: form.offering_id ? Number(form.offering_id) : null }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409 && data.existing_customer) setExistingCustomer(data.existing_customer);
        throw new Error(data.error || "Unable to save customer");
      }
      setShowForm(false);
      setForm(emptyForm);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save customer");
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return customers.filter((customer) => {
      const matchesSearch = !term || [customer.full_name, customer.phone, customer.email, customer.customer_id, customer.id_number]
        .some((value) => String(value || "").toLowerCase().includes(term));
      const matchesClassification = !classificationFilter || customer.classification === classificationFilter;
      return matchesSearch && matchesClassification;
    });
  }, [classificationFilter, customers, search]);

  return (
    <div className="spa-workspace-page customer-master-page">
      <GemHeader
        title="Customer & Member Master"
        subtitle="One customer record with classification; membership is assigned to the same record through the Offering Master"
        actions={<GemBtn onClick={() => { setShowForm(!showForm); setError(""); setExistingCustomer(null); }}><Plus size={16} />Add Customer</GemBtn>}
      />
      <div className="master-data-notice"><i className="bi bi-diagram-2" /><div><strong>Single customer master</strong><span>Do not register the same person again as a member. Change the customer classification or assign a membership/package offering to the existing record.</span></div></div>
      {error && <GemAlert type="danger" onClose={() => setError("")}>{error}{existingCustomer && <Link href={`/dashboard/spa/customers/profiles/${existingCustomer.id}`} className="ms-2 fw-bold">Open {existingCustomer.full_name}</Link>}</GemAlert>}

      {showForm && (
        <GemCard className="mb-6">
          <h2 className="customer-master-form-title"><Users size={18} />Create Customer Record</h2>
          <form onSubmit={createCustomer} className="customer-master-form">
            <label><span>Full Name *</span><GemInput required value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} /></label>
            <label><span>Classification *</span><GemSelect value={form.classification} onChange={(event) => setForm({ ...form, classification: event.target.value })}><option value="customer">Customer</option><option value="member">Member</option><option value="vip">VIP</option><option value="corporate">Corporate</option><option value="guest">Guest</option></GemSelect></label>
            <label><span>Phone</span><GemInput type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
            <label><span>Email</span><GemInput type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
            <label><span>ID Number</span><GemInput value={form.id_number} onChange={(event) => setForm({ ...form, id_number: event.target.value })} /></label>
            <label><span>Membership / Package Offering</span><GemSelect value={form.offering_id} onChange={(event) => setForm({ ...form, offering_id: event.target.value, classification: event.target.value ? "member" : form.classification })}><option value="">No offering</option>{offerings.map((offering) => <option key={offering.id} value={offering.id}>{offering.details.offering_code ? `${offering.details.offering_code} · ` : ""}{offering.title}</option>)}</GemSelect></label>
            <label><span>Start Date</span><GemInput type="date" value={form.start_date} onChange={(event) => setForm({ ...form, start_date: event.target.value })} /></label>
            <label><span>Address</span><GemInput value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
            <label className="span-two"><span>Notes</span><textarea rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
            <div className="span-two customer-master-actions"><GemBtnOutline onClick={() => setShowForm(false)}>Cancel</GemBtnOutline><GemBtn type="submit" disabled={saving}>{saving ? "Saving…" : "Save Customer"}</GemBtn></div>
          </form>
        </GemCard>
      )}

      <div className="customer-master-toolbar">
        <GemInput placeholder="Search name, phone, email, code or ID…" value={search} onChange={(event) => setSearch(event.target.value)} />
        <GemSelect value={classificationFilter} onChange={(event) => setClassificationFilter(event.target.value)}><option value="">All classifications</option><option value="customer">Customers</option><option value="member">Members</option><option value="vip">VIP</option><option value="corporate">Corporate</option><option value="guest">Guests</option></GemSelect>
        <span>{filtered.length} of {customers.length} records</span>
      </div>

      <GemCardBare>
        {loading ? <div className="spa-workspace-state"><span className="spinner-border" /></div> : filtered.length === 0 ? <div className="spa-workspace-state"><Users size={32} /><p>No customer records found.</p></div> : (
          <div className="overflow-x-auto p-5"><GemTable
            headers={["Code", "Customer", "Classification", "Phone", "Offering", "Validity", "Status", ""]}
            rows={filtered.map((customer) => {
              const membershipActive = customer.end_date ? customer.end_date.slice(0, 10) >= TODAY_KEY : true;
              return [
                <span key="code" className="font-mono text-xs text-gray-400">{customer.customer_id}</span>,
                <Link key="name" href={`/dashboard/spa/customers/profiles/${customer.id}`} className="font-semibold hover:text-blue-600">{customer.full_name}</Link>,
                <GemBadge key="classification" variant={customer.classification === "member" ? "info" : "default"}>{customer.classification || "customer"}</GemBadge>,
                <span key="phone" className="text-sm">{customer.phone || "—"}</span>,
                <GemBadge key="offering" variant="info">{customer.plan_name || "None"}</GemBadge>,
                <span key="validity" className="text-sm">{customer.offering_id && customer.end_date ? new Date(customer.end_date).toLocaleDateString() : "—"}</span>,
                customer.offering_id ? <GemBadge key="status" variant={membershipActive ? "success" : "danger"}>{membershipActive ? "Active" : "Expired"}</GemBadge> : <GemBadge key="status">Customer</GemBadge>,
                <Link key="view" href={`/dashboard/spa/customers/profiles/${customer.id}`} aria-label={`Open ${customer.full_name}`}><Eye size={16} /></Link>,
              ];
            })}
          /></div>
        )}
      </GemCardBare>
    </div>
  );
}

export default function MembersPage() {
  return <MembersWorkspace />;
}
