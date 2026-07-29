"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { GemPage, GemHeader, GemCard, GemCardBare, GemBtn, GemBtnOutline, GemTable, GemBadge, GemInput, GemSelect } from "@/lib/gem-ui";
import { QrCode, Plus, Save } from "lucide-react";

export default function QrPassesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ member_id: "", pass_type: "day_pass", expiry_date: "", max_uses: "1" });
  const [saving, setSaving] = useState(false);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [r, mr] = await Promise.all([
        fetch("/api/membership/qr-passes", { headers: { Authorization: `Bearer ${token}` } }),
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
    if (!token || !form.expiry_date) return;
    setSaving(true);
    try {
      const res = await fetch("/api/membership/qr-passes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, member_id: form.member_id ? parseInt(form.member_id) : null, max_uses: parseInt(form.max_uses) || 1 }),
      });
      if (res.ok) { setShowForm(false); load(); }
      else { const err = await res.json(); alert(err.error); }
    } catch { alert("Server error"); }
    setSaving(false);
  };

  const statusBadge = (s: string) => {
    const map: Record<string, "success" | "default" | "warning" | "danger"> = { active: "success", used: "default", expired: "warning", cancelled: "danger" };
    return <GemBadge variant={map[s] || "default"}>{s}</GemBadge>;
  };

  return (
    <GemPage>
      <GemHeader title="QR Passes" subtitle="Digital QR passes for spa access"
        actions={<GemBtn onClick={() => setShowForm(!showForm)}><Plus size={16} />Issue Pass</GemBtn>} />

      {showForm && (
        <GemCard className="mb-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><QrCode size={18} />Issue QR Pass</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm text-gray-500 font-medium mb-1 block">Member</label>
              <GemSelect value={form.member_id} onChange={(e: any) => setForm({...form, member_id: e.target.value})}>
                <option value="">Walk-in (no member)</option>
                {members.map((m: any) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </GemSelect>
            </div>
            <div>
              <label className="text-sm text-gray-500 font-medium mb-1 block">Pass Type</label>
              <GemSelect value={form.pass_type} onChange={(e: any) => setForm({...form, pass_type: e.target.value})}>
                <option value="day_pass">Day Pass</option>
                <option value="promo">Promotional</option>
                <option value="guest">Guest</option>
                <option value="staff">Staff</option>
              </GemSelect>
            </div>
            <div>
              <label className="text-sm text-gray-500 font-medium mb-1 block">Expiry Date *</label>
              <GemInput type="date" required value={form.expiry_date} onChange={(e: any) => setForm({...form, expiry_date: e.target.value})} />
            </div>
            <div className="flex items-end gap-2">
              <GemBtn type="submit" disabled={saving}><Save size={16} />{saving ? "Issuing..." : "Issue Pass"}</GemBtn>
              <GemBtnOutline onClick={() => setShowForm(false)}>Cancel</GemBtnOutline>
            </div>
          </form>
        </GemCard>
      )}

      <GemCardBare>
        {loading ? (
          <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-black/20 border-t-black rounded-full animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="text-center text-gray-400 py-8"><QrCode size={32} className="mx-auto mb-2 opacity-40" /><p className="text-sm">No QR passes issued yet</p></div>
        ) : (
          <div className="overflow-x-auto p-6">
            <GemTable
              headers={["Token", "Member", "Type", "Uses", "Issued", "Expiry", "Status"]}
              rows={items.map(p => [
                <span className="font-mono text-xs">{p.token.substring(0, 16)}...</span>,
                p.member_name ? <Link href={`/dashboard/membership/members/${p.member_id}`} className="hover:text-blue-600">{p.member_name}</Link> : <span className="text-gray-400">Walk-in</span>,
                <GemBadge>{p.pass_type}</GemBadge>,
                `${p.current_uses}/${p.max_uses}`,
                new Date(p.issued_date).toLocaleDateString(),
                new Date(p.expiry_date).toLocaleDateString(),
                statusBadge(p.status),
              ])}
            />
          </div>
        )}
      </GemCardBare>
    </GemPage>
  );
}
