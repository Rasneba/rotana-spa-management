"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { GemPage, GemHeader, GemCard, GemCardBare, GemBtn, GemBtnOutline, GemTable, GemBadge, GemInput, GemSelect } from "@/lib/gem-ui";
import { Repeat, Plus, Save } from "lucide-react";

export function SubscriptionsWorkspace({ initialCreate = false }: { initialCreate?: boolean }) {
  const [items, setItems] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(initialCreate);
  const [form, setForm] = useState<any>({ member_id: "", plan_id: "", end_date: "", billing_cycle: "monthly", auto_renew: false });
  const [saving, setSaving] = useState(false);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [r, mr, pr] = await Promise.all([
        fetch("/api/membership/subscriptions", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/membership/members", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/membership/plans", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const data = await r.json();
      const mData = await mr.json();
      const pData = await pr.json();
      setItems(Array.isArray(data) ? data : []);
      setMembers(Array.isArray(mData) ? mData : []);
      setPlans(Array.isArray(pData) ? pData : []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !form.member_id || !form.end_date) return;
    setSaving(true);
    try {
      const res = await fetch("/api/membership/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, member_id: parseInt(form.member_id), plan_id: form.plan_id ? parseInt(form.plan_id) : null }),
      });
      if (res.ok) { setShowForm(false); setForm({ member_id: "", plan_id: "", end_date: "", billing_cycle: "monthly", auto_renew: false }); load(); }
      else { const err = await res.json(); alert(err.error); }
    } catch { alert("Server error"); }
    setSaving(false);
  };

  const statusBadge = (s: string) => {
    const map: Record<string, "success" | "warning" | "danger" | "default"> = { active: "success", expired: "warning", cancelled: "danger", suspended: "default" };
    return <GemBadge variant={map[s] || "default"}>{s}</GemBadge>;
  };

  const cancelSub = async (id: number) => {
    if (!confirm("Cancel this subscription?")) return;
    try {
      await fetch("/api/membership/subscriptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, status: "cancelled" }),
      });
      load();
    } catch {}
  };

  return (
    <GemPage>
      <GemHeader title="Subscriptions" subtitle="Operational membership periods and renewals; pricing and payment stay in the separate POS"
        actions={<GemBtn onClick={() => setShowForm(!showForm)}><Plus size={16} />New Subscription</GemBtn>} />

      {showForm && (
        <GemCard className="mb-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Repeat size={18} />Create Subscription</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="text-sm text-gray-500 font-medium mb-1 block">Member *</label>
              <GemSelect required value={form.member_id} onChange={(e: any) => setForm({...form, member_id: e.target.value})}>
                <option value="">Select Member</option>
                {members.map((m: any) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </GemSelect>
            </div>
            <div>
              <label className="text-sm text-gray-500 font-medium mb-1 block">Plan</label>
              <GemSelect value={form.plan_id} onChange={(e: any) => setForm({...form, plan_id: e.target.value})}>
                <option value="">No plan</option>
                {plans.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </GemSelect>
            </div>
            <div>
              <label className="text-sm text-gray-500 font-medium mb-1 block">End Date *</label>
              <GemInput type="date" required value={form.end_date} onChange={(e: any) => setForm({...form, end_date: e.target.value})} />
            </div>
            <div>
              <label className="text-sm text-gray-500 font-medium mb-1 block">Billing Cycle</label>
              <GemSelect value={form.billing_cycle} onChange={(e: any) => setForm({...form, billing_cycle: e.target.value})}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
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
          <div className="text-center text-gray-400 py-8"><Repeat size={32} className="mx-auto mb-2 opacity-40" /><p className="text-sm">No subscriptions yet</p></div>
        ) : (
          <div className="overflow-x-auto p-6">
            <GemTable
              headers={["Member", "Plan", "Cycle", "Start", "End", "Status", ""]}
              rows={items.map(s => [
                <Link href={`/dashboard/spa/customers/profiles/${s.member_id}`} className="font-semibold hover:text-blue-600">{s.member_name}</Link>,
                s.plan_name || "-",
                s.billing_cycle,
                new Date(s.start_date).toLocaleDateString(),
                new Date(s.end_date).toLocaleDateString(),
                statusBadge(s.status),
                s.status === "active" ? <button className="text-red-500 hover:text-red-700 p-1 text-sm" onClick={() => cancelSub(s.id)}>Cancel</button> : null,
              ])}
            />
          </div>
        )}
      </GemCardBare>
    </GemPage>
  );
}

export default function SubscriptionsPage() {
  return <SubscriptionsWorkspace />;
}
