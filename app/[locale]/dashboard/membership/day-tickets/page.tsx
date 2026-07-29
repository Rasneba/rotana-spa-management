"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { GemPage, GemHeader, GemCard, GemCardBare, GemBtn, GemBtnOutline, GemTable, GemBadge, GemInput, GemSelect } from "@/lib/gem-ui";
import { Ticket, Plus, Save } from "lucide-react";

export default function DayTicketsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [rates, setRates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ guest_name: "", facility_id: "", rate_id: "", price: "", currency: "ETB" });
  const [saving, setSaving] = useState(false);
  const [showUsed, setShowUsed] = useState(false);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [r, fr, rr] = await Promise.all([
        fetch(`/api/membership/day-tickets${showUsed ? "" : "?is_used=false"}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/membership/facilities", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/membership/rate-cards", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const data = await r.json();
      const fData = await fr.json();
      const rData = await rr.json();
      setItems(Array.isArray(data) ? data : []);
      setFacilities(Array.isArray(fData) ? fData : []);
      setRates(Array.isArray(rData) ? rData : []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [showUsed]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      const rate = rates.find(r => r.id === parseInt(form.rate_id));
      const res = await fetch("/api/membership/day-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          guest_name: form.guest_name,
          facility_id: form.facility_id ? parseInt(form.facility_id) : null,
          rate_id: form.rate_id ? parseInt(form.rate_id) : null,
          price: parseFloat(form.price) || (rate ? parseFloat(rate.price) : 0),
          currency: form.currency || rate?.currency || "ETB",
        }),
      });
      if (res.ok) { setShowForm(false); load(); }
      else { const err = await res.json(); alert(err.error); }
    } catch { alert("Server error"); }
    setSaving(false);
  };

  const markUsed = async (id: number) => {
    try {
      await fetch("/api/membership/day-tickets", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, is_used: true }),
      });
      load();
    } catch {}
  };

  return (
    <GemPage>
      <GemHeader title="Day Tickets" subtitle="Single-use day passes for walk-in guests"
        actions={
          <div className="flex gap-2 items-center">
            <label className="flex items-center gap-1 text-sm cursor-pointer">
              <input type="checkbox" checked={!showUsed} onChange={e => setShowUsed(!e.target.checked)} />
              Active only
            </label>
            <GemBtn onClick={() => setShowForm(!showForm)}><Plus size={16} />Issue Ticket</GemBtn>
          </div>
        } />

      {showForm && (
        <GemCard className="mb-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Ticket size={18} />Issue Day Ticket</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="text-sm text-gray-500 font-medium mb-1 block">Guest Name</label>
              <GemInput value={form.guest_name} onChange={(e: any) => setForm({...form, guest_name: e.target.value})} />
            </div>
            <div>
              <label className="text-sm text-gray-500 font-medium mb-1 block">Facility</label>
              <GemSelect value={form.facility_id} onChange={(e: any) => setForm({...form, facility_id: e.target.value})}>
                <option value="">Any</option>
                {facilities.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </GemSelect>
            </div>
            <div>
              <label className="text-sm text-gray-500 font-medium mb-1 block">Rate</label>
              <GemSelect value={form.rate_id} onChange={(e: any) => {
                const rate = rates.find(r => r.id === parseInt(e.target.value));
                setForm({...form, rate_id: e.target.value, price: rate ? rate.price : form.price, currency: rate ? rate.currency : form.currency});
              }}>
                <option value="">Custom price</option>
                {rates.filter(r => r.service_type === 'day_pass' || r.service_type === 'session').map((r: any) => (
                  <option key={r.id} value={r.id}>{r.name} ({r.currency} {Number(r.price).toLocaleString()})</option>
                ))}
              </GemSelect>
            </div>
            <div>
              <label className="text-sm text-gray-500 font-medium mb-1 block">Price</label>
              <GemInput type="number" step="0.01" value={form.price} onChange={(e: any) => setForm({...form, price: e.target.value})} />
            </div>
            <div className="flex items-end gap-2">
              <GemBtn type="submit" disabled={saving}><Save size={16} />{saving ? "Issuing..." : "Issue Ticket"}</GemBtn>
              <GemBtnOutline onClick={() => setShowForm(false)}>Cancel</GemBtnOutline>
            </div>
          </form>
        </GemCard>
      )}

      <GemCardBare>
        {loading ? (
          <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-black/20 border-t-black rounded-full animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="text-center text-gray-400 py-8"><Ticket size={32} className="mx-auto mb-2 opacity-40" /><p className="text-sm">No day tickets issued</p></div>
        ) : (
          <div className="overflow-x-auto p-6">
            <GemTable
              headers={["Ticket #", "Guest", "Facility", "Price", "Issued", "Status", ""]}
              rows={items.map(t => [
                <span className="font-mono text-xs font-semibold">{t.ticket_number}</span>,
                t.guest_name || "-",
                t.facility_name || "-",
                `${t.currency} ${Number(t.price).toLocaleString()}`,
                new Date(t.created_at).toLocaleDateString(),
                t.is_used ? <GemBadge variant="success">Used</GemBadge> : <GemBadge variant="info">Active</GemBadge>,
                !t.is_used ? <button className="text-green-600 hover:text-green-800 text-sm" onClick={() => markUsed(t.id)}>Mark Used</button> : null,
              ])}
            />
          </div>
        )}
      </GemCardBare>
    </GemPage>
  );
}
