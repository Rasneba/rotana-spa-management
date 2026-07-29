"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { GemPage, GemHeader, GemCard, GemCardBare, GemBtn, GemBtnOutline, GemTable, GemBadge, GemInput, GemSelect } from "@/lib/gem-ui";
import { DollarSign, Plus, Save } from "lucide-react";

export default function RateCardsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({ name: "", facility_id: "", service_type: "session", price: "", currency: "ETB", duration_minutes: "" });
  const [saving, setSaving] = useState(false);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [r, fr] = await Promise.all([
        fetch("/api/membership/rate-cards", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/membership/facilities", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const data = await r.json();
      const fData = await fr.json();
      setItems(Array.isArray(data) ? data : []);
      setFacilities(Array.isArray(fData) ? fData : []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ name: "", facility_id: "", service_type: "session", price: "", currency: "ETB", duration_minutes: "" }); setShowForm(true); };

  const openEdit = (item: any) => { setEditing(item); setForm({ name: item.name, facility_id: item.facility_id || "", service_type: item.service_type, price: item.price, currency: item.currency, duration_minutes: item.duration_minutes || "" }); setShowForm(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !form.name) return;
    setSaving(true);
    try {
      const method = editing ? "PUT" : "POST";
      const body = editing ? { ...form, id: editing.id, is_active: editing.is_active, facility_id: form.facility_id ? parseInt(form.facility_id) : null, price: parseFloat(form.price) || 0, duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null } : { ...form, facility_id: form.facility_id ? parseInt(form.facility_id) : null, price: parseFloat(form.price) || 0, duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null };
      const res = await fetch("/api/membership/rate-cards", { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      if (res.ok) { setShowForm(false); setEditing(null); load(); }
      else { const err = await res.json(); alert(err.error); }
    } catch { alert("Server error"); }
    setSaving(false);
  };

  const deleteItem = async (id: number) => {
    if (!confirm("Delete this rate card?")) return;
    try {
      await fetch("/api/membership/rate-cards", { method: "DELETE", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ id }) });
      load();
    } catch {}
  };

  return (
    <GemPage>
      <GemHeader title="Rate Cards" subtitle="Pricing for services, day passes, sessions, and facilities"
        actions={<GemBtn onClick={openNew}><Plus size={16} />Add Rate</GemBtn>} />

      {showForm && (
        <GemCard className="mb-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><DollarSign size={18} />{editing ? "Edit" : "New"} Rate Card</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="text-sm text-gray-500 font-medium mb-1 block">Name *</label>
              <GemInput required value={form.name} onChange={(e: any) => setForm({...form, name: e.target.value})} />
            </div>
            <div>
              <label className="text-sm text-gray-500 font-medium mb-1 block">Service Type</label>
              <GemSelect value={form.service_type} onChange={(e: any) => setForm({...form, service_type: e.target.value})}>
                <option value="membership">Membership</option>
                <option value="day_pass">Day Pass</option>
                <option value="session">Session</option>
                <option value="facility">Facility</option>
                <option value="service">Service</option>
              </GemSelect>
            </div>
            <div>
              <label className="text-sm text-gray-500 font-medium mb-1 block">Facility</label>
              <GemSelect value={form.facility_id} onChange={(e: any) => setForm({...form, facility_id: e.target.value})}>
                <option value="">General</option>
                {facilities.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </GemSelect>
            </div>
            <div>
              <label className="text-sm text-gray-500 font-medium mb-1 block">Price</label>
              <GemInput type="number" value={form.price} onChange={(e: any) => setForm({...form, price: e.target.value})} />
            </div>
            <div className="flex items-end gap-2">
              <GemBtn type="submit" disabled={saving}><Save size={16} />{saving ? "Saving..." : "Save"}</GemBtn>
              <GemBtnOutline onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</GemBtnOutline>
            </div>
            <div>
              <label className="text-sm text-gray-500 font-medium mb-1 block">Duration (min)</label>
              <GemInput type="number" value={form.duration_minutes} onChange={(e: any) => setForm({...form, duration_minutes: e.target.value})} />
            </div>
          </form>
        </GemCard>
      )}

      <GemCardBare>
        {loading ? (
          <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-black/20 border-t-black rounded-full animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="text-center text-gray-400 py-8"><DollarSign size={32} className="mx-auto mb-2 opacity-40" /><p className="text-sm">No rate cards created yet</p></div>
        ) : (
          <div className="overflow-x-auto p-6">
            <GemTable
              headers={["Name", "Service", "Facility", "Price", "Duration", "Status", ""]}
              rows={items.map(r => [
                <span className="font-semibold">{r.name}</span>,
                <GemBadge>{r.service_type}</GemBadge>,
                r.facility_name || "-",
                <span className="font-semibold">{r.currency} {Number(r.price).toLocaleString()}</span>,
                r.duration_minutes ? `${r.duration_minutes} min` : "-",
                r.is_active ? <GemBadge variant="success">Active</GemBadge> : <GemBadge variant="danger">Inactive</GemBadge>,
                <div className="flex gap-1">
                  <button className="text-blue-500 hover:text-blue-700 p-1" onClick={() => openEdit(r)} title="Edit"><i className="bi bi-pencil"></i></button>
                  <button className="text-red-500 hover:text-red-700 p-1" onClick={() => deleteItem(r.id)} title="Delete"><i className="bi bi-trash"></i></button>
                </div>,
              ])}
            />
          </div>
        )}
      </GemCardBare>
    </GemPage>
  );
}
