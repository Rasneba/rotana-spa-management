"use client";
import { useEffect, useState } from "react";
import { GemPage, GemHeader, GemCard, GemCardBare, GemBtn, GemTable, GemBadge, GemInput, GemSelect } from "@/lib/gem-ui";
import { Layers, Plus, X, Save } from "lucide-react";

export default function MembershipPlansPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ name: "", type: "general", description: "", duration_days: "30", max_members: "" });
  const [saving, setSaving] = useState(false);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/membership/plans", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (Array.isArray(data)) setPlans(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch("/api/membership/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, duration_days: parseInt(form.duration_days) || 30 }),
      });
      if (res.ok) { setShowForm(false); setForm({ name: "", type: "general", description: "", duration_days: "30", max_members: "" }); load(); }
      else { const err = await res.json(); alert(err.error); }
    } catch { alert("Server error"); }
    setSaving(false);
  };

  const typeBadge = (t: string) => {
    const map: Record<string, "success" | "warning" | "info" | "default"> = { gym: "success", parking: "warning", club: "info", general: "default" };
    return <GemBadge variant={map[t] || "default"}>{t}</GemBadge>;
  };

  return (
    <GemPage>
      <GemHeader
        title="Membership Plans"
        subtitle="Configure operational membership duration and access; pricing remains in the separate POS"
        actions={
          <GemBtn onClick={() => setShowForm(!showForm)}>
            {showForm ? <X size={16} /> : <Plus size={16} />}{showForm ? "Cancel" : "New Plan"}
          </GemBtn>
        }
      />

      {showForm && (
        <GemCard className="mb-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Layers size={18} />Create Plan</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm text-gray-500 font-medium mb-1 block">Plan Name <span className="text-red-500">*</span></label>
              <GemInput type="text" required value={form.name} onChange={(e: any) => setForm({...form, name: e.target.value})} />
            </div>
            <div>
              <label className="text-sm text-gray-500 font-medium mb-1 block">Type</label>
              <GemSelect value={form.type} onChange={(e: any) => setForm({...form, type: e.target.value})}>
                <option value="general">General</option>
                <option value="gym">Gym</option>
                <option value="spa">Spa</option>
                <option value="cafe">Cafe</option>
              </GemSelect>
            </div>
            <div>
              <label className="text-sm text-gray-500 font-medium mb-1 block">Duration (days)</label>
              <GemInput type="number" value={form.duration_days} onChange={(e: any) => setForm({...form, duration_days: e.target.value})} />
            </div>
            <div>
              <label className="text-sm text-gray-500 font-medium mb-1 block">Max Members</label>
              <GemInput type="number" value={form.max_members} onChange={(e: any) => setForm({...form, max_members: e.target.value})} />
            </div>
            <div className="md:col-span-4">
              <label className="text-sm text-gray-500 font-medium mb-1 block">Description</label>
              <textarea className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black/30 transition-all" rows={2} value={form.description} onChange={(e: any) => setForm({...form, description: e.target.value})} />
            </div>
            <div className="md:col-span-4">
              <GemBtn type="submit" disabled={saving}>
                <Save size={16} />{saving ? "Saving..." : "Create Plan"}
              </GemBtn>
            </div>
          </form>
        </GemCard>
      )}

      <GemCardBare>
        {loading ? (
          <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-black/20 border-t-black rounded-full animate-spin" /></div>
        ) : plans.length === 0 ? (
          <div className="text-center text-gray-400 py-8"><Layers size={32} className="mx-auto mb-2 opacity-40" /><p className="text-sm">No plans created yet</p></div>
        ) : (
          <div className="overflow-x-auto p-6">
            <GemTable
              headers={["Name", "Type", "Duration", "Members", "Status"]}
              rows={plans.map(p => [
                <span className="font-semibold">{p.name}</span>,
                typeBadge(p.type),
                `${p.duration_days} days`,
                <GemBadge>{p.member_count || 0}</GemBadge>,
                p.is_active ? <GemBadge variant="success">Active</GemBadge> : <GemBadge variant="danger">Inactive</GemBadge>,
              ])}
            />
          </div>
        )}
      </GemCardBare>
    </GemPage>
  );
}
