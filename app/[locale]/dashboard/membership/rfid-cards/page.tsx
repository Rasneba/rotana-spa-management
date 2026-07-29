"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { GemPage, GemHeader, GemCard, GemCardBare, GemBtn, GemBtnOutline, GemTable, GemBadge, GemInput, GemSelect } from "@/lib/gem-ui";
import { CreditCard, Plus, Save } from "lucide-react";

export default function RfidCardsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ card_uid: "", member_id: "", type: "membership", status: "active", expiry_date: "" });
  const [saving, setSaving] = useState(false);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [r, mr] = await Promise.all([
        fetch("/api/membership/rfid-cards", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/membership/members", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const data = await r.json();
      const mData = await mr.json();
      setItems(Array.isArray(data) ? data : []);
      setMembers(Array.isArray(mData) ? mData : []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !form.card_uid) return;
    setSaving(true);
    try {
      const res = await fetch("/api/membership/rfid-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, member_id: form.member_id ? parseInt(form.member_id) : null }),
      });
      if (res.ok) { setShowForm(false); setForm({ card_uid: "", member_id: "", type: "membership", status: "active", expiry_date: "" }); load(); }
      else { const err = await res.json(); alert(err.error); }
    } catch { alert("Server error"); }
    setSaving(false);
  };

  const statusBadge = (s: string) => {
    const map: Record<string, "success" | "danger" | "warning" | "default"> = { active: "success", inactive: "default", lost: "danger", expired: "warning" };
    return <GemBadge variant={map[s] || "default"}>{s}</GemBadge>;
  };

  const typeBadge = (t: string) => {
    const map: Record<string, "info" | "success" | "warning" | "default"> = { membership: "info", day_pass: "success", temporary: "warning", staff: "default" };
    return <GemBadge variant={map[t] || "default"}>{t}</GemBadge>;
  };

  return (
    <GemPage>
      <GemHeader title="RFID Cards" subtitle="Member cards and wristbands"
        actions={<GemBtn onClick={() => setShowForm(!showForm)}><Plus size={16} />Add Card</GemBtn>} />

      {showForm && (
        <GemCard className="mb-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><CreditCard size={18} />New RFID Card</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="text-sm text-gray-500 font-medium mb-1 block">Card UID *</label>
              <GemInput required value={form.card_uid} onChange={(e: any) => setForm({...form, card_uid: e.target.value})} />
            </div>
            <div>
              <label className="text-sm text-gray-500 font-medium mb-1 block">Member</label>
              <GemSelect value={form.member_id} onChange={(e: any) => setForm({...form, member_id: e.target.value})}>
                <option value="">Unassigned</option>
                {members.map((m: any) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </GemSelect>
            </div>
            <div>
              <label className="text-sm text-gray-500 font-medium mb-1 block">Type</label>
              <GemSelect value={form.type} onChange={(e: any) => setForm({...form, type: e.target.value})}>
                <option value="membership">Membership</option>
                <option value="day_pass">Day Pass</option>
                <option value="temporary">Temporary</option>
                <option value="staff">Staff</option>
              </GemSelect>
            </div>
            <div>
              <label className="text-sm text-gray-500 font-medium mb-1 block">Status</label>
              <GemSelect value={form.status} onChange={(e: any) => setForm({...form, status: e.target.value})}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="lost">Lost</option>
                <option value="expired">Expired</option>
              </GemSelect>
            </div>
            <div className="flex items-end gap-2">
              <GemBtn type="submit" disabled={saving}><Save size={16} />{saving ? "Saving..." : "Save"}</GemBtn>
              <GemBtnOutline onClick={() => setShowForm(false)}>Cancel</GemBtnOutline>
            </div>
          </form>
        </GemCard>
      )}

      <GemCardBare>
        {loading ? (
          <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-black/20 border-t-black rounded-full animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="text-center text-gray-400 py-8"><CreditCard size={32} className="mx-auto mb-2 opacity-40" /><p className="text-sm">No RFID cards registered yet</p></div>
        ) : (
          <div className="overflow-x-auto p-6">
            <GemTable
              headers={["Card UID", "Member", "Type", "Status", "Issued", "Expiry"]}
              rows={items.map(c => [
                <span className="font-mono text-sm font-semibold">{c.card_uid}</span>,
                c.member_name ? <Link href={`/dashboard/membership/members/${c.member_id}`} className="hover:text-blue-600">{c.member_name}</Link> : <span className="text-gray-400">-</span>,
                typeBadge(c.type),
                statusBadge(c.status),
                c.issued_date ? new Date(c.issued_date).toLocaleDateString() : "-",
                c.expiry_date ? new Date(c.expiry_date).toLocaleDateString() : "-",
              ])}
            />
          </div>
        )}
      </GemCardBare>
    </GemPage>
  );
}
