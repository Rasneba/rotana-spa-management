"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { GemPage, GemHeader, GemCard, GemCardBare, GemBtn, GemBtnOutline, GemTable, GemBadge, GemInput, GemSelect } from "@/lib/gem-ui";
import { Users, Plus, ArrowLeft, Eye } from "lucide-react";

export function MembersWorkspace({ initialCreate = false }: { initialCreate?: boolean }) {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(initialCreate);
  const [form, setForm] = useState<any>({ full_name: "", phone: "", email: "", plan_id: "" });
  const [plans, setPlans] = useState<any[]>([]);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const load = async () => {
    if (!token) return;
    try {
      const [mRes, pRes] = await Promise.all([
        fetch("/api/membership/members", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/membership/plans", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const mData = await mRes.json();
      const pData = await pRes.json();
      setMembers(Array.isArray(mData) ? mData : mData.data || []);
      setPlans(Array.isArray(pData) ? pData : pData.data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.full_name || !token) return;
    try {
      const r = await fetch("/api/membership/members", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, plan_id: form.plan_id ? parseInt(form.plan_id) : null }),
      });
      const d = await r.json();
      if (d.id || d.ok) { setShowForm(false); setForm({ full_name: "", phone: "", email: "", plan_id: "" }); load(); }
    } catch {}
  };

  const filtered = members.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = !q || m.full_name?.toLowerCase().includes(q) || m.phone?.includes(q) || m.customer_id?.toLowerCase().includes(q);
    const matchStatus = !statusFilter || (statusFilter === "active" ? new Date(m.end_date) >= new Date() : new Date(m.end_date) < new Date());
    return matchSearch && matchStatus;
  });

  return (
    <GemPage>
      <GemHeader
        title="Members"
        subtitle="Manage gym & membership members"
        actions={
          <>
            <Link href="/dashboard/membership" className="text-inherit"><GemBtnOutline><ArrowLeft size={16} />Back</GemBtnOutline></Link>
            <GemBtn onClick={() => setShowForm(!showForm)}><Plus size={16} />Add Member</GemBtn>
          </>
        }
      />

      {showForm && (
        <GemCard className="mb-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Users size={18} />New Member</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm text-gray-500 font-medium mb-1 block">Full name *</label>
              <GemInput placeholder="Enter full name" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div>
              <label className="text-sm text-gray-500 font-medium mb-1 block">Phone</label>
              <GemInput placeholder="Phone number" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="text-sm text-gray-500 font-medium mb-1 block">Email</label>
              <GemInput placeholder="Email address" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="text-sm text-gray-500 font-medium mb-1 block">Plan</label>
              <GemSelect value={form.plan_id} onChange={e => setForm({ ...form, plan_id: e.target.value })}>
                <option value="">No plan</option>
                {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </GemSelect>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <GemBtn onClick={handleCreate}>Save</GemBtn>
            <GemBtnOutline onClick={() => setShowForm(false)}>Cancel</GemBtnOutline>
          </div>
        </GemCard>
      )}

      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <div className="flex-1 min-w-[200px] max-w-md">
          <GemInput placeholder="Search by name, phone, or code..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <GemSelect value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-40">
          <option value="">All members</option>
          <option value="active">Active only</option>
          <option value="expired">Expired</option>
        </GemSelect>
        <span className="text-sm text-gray-400">{filtered.length} of {members.length} members</span>
      </div>

      <GemCardBare>
        {loading ? (
          <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-black/20 border-t-black rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-400 py-8"><Users size={32} className="mx-auto mb-2 opacity-40" /><p className="text-sm">No members found</p></div>
        ) : (
          <div className="overflow-x-auto p-6">
            <GemTable
              headers={["Code", "Name", "Phone", "Plan", "Start", "End", "Status", ""]}
              rows={filtered.map(m => {
                const isActive = m.end_date ? new Date(m.end_date) >= new Date() : true;
                const daysLeft = m.end_date ? Math.max(0, Math.ceil((new Date(m.end_date).getTime() - Date.now()) / 86400000)) : null;
                return [
                  <span className="font-mono text-xs text-gray-400">{m.customer_id}</span>,
                  <Link href={`/dashboard/spa/customers/profiles/${m.id}`} className="font-semibold hover:text-blue-600 transition-colors">{m.full_name}</Link>,
                  <span className="text-sm">{m.phone || "-"}</span>,
                  <GemBadge variant="info">{m.plan_name || "N/A"}</GemBadge>,
                  <span className="text-sm">{m.start_date ? new Date(m.start_date).toLocaleDateString() : "-"}</span>,
                  <span className="text-sm">{m.end_date ? new Date(m.end_date).toLocaleDateString() : "-"}</span>,
                  isActive ? <GemBadge variant="success">{daysLeft !== null ? `${daysLeft}d left` : "Active"}</GemBadge> : <GemBadge variant="danger">Expired</GemBadge>,
                  <Link href={`/dashboard/spa/customers/profiles/${m.id}`} className="text-blue-500 hover:text-blue-700 transition-colors"><Eye size={16} /></Link>,
                ];
              })}
            />
          </div>
        )}
      </GemCardBare>
    </GemPage>
  );
}

export default function MembersPage() {
  return <MembersWorkspace />;
}
