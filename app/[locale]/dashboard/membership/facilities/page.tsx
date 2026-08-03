"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { GemPage, GemHeader, GemCard, GemCardBare, GemBtn, GemBtnOutline, GemTable, GemBadge, GemInput, GemSelect } from "@/lib/gem-ui";
import { Building2, Plus, X, Save } from "lucide-react";

export function FacilitiesWorkspace({ roomsOnly = false, title = "Facilities" }: { roomsOnly?: boolean; title?: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({ name: "", type: roomsOnly ? "room" : "other", capacity: "", description: "" });
  const [saving, setSaving] = useState(false);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/membership/facilities", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (Array.isArray(data)) setItems(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ name: "", type: roomsOnly ? "room" : "other", capacity: "", description: "" }); setShowForm(true); };

  const visibleItems = roomsOnly ? items.filter((item) => item.type === "room") : items;

  const openEdit = (item: any) => { setEditing(item); setForm({ name: item.name, type: item.type, capacity: item.capacity || "", description: item.description || "" }); setShowForm(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      const url = editing ? "/api/membership/facilities" : "/api/membership/facilities";
      const method = editing ? "PUT" : "POST";
      const body = editing ? { ...form, id: editing.id, is_active: editing.is_active } : form;
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      if (res.ok) { setShowForm(false); setEditing(null); load(); }
      else { const err = await res.json(); alert(err.error); }
    } catch { alert("Server error"); }
    setSaving(false);
  };

  const deleteItem = async (id: number) => {
    if (!confirm("Delete this facility?")) return;
    try {
      await fetch("/api/membership/facilities", { method: "DELETE", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ id }) });
      load();
    } catch {}
  };

  const typeBadge = (t: string) => {
    const map: Record<string, "success" | "warning" | "info" | "default" | "danger"> = { pool: "info", gym: "success", room: "default", sauna: "warning", steam: "warning", cafe: "danger", changing: "default" };
    return <GemBadge variant={map[t] || "default"}>{t}</GemBadge>;
  };

  return (
    <GemPage>
      <GemHeader title={title} subtitle={roomsOnly ? "Manage spa treatment and service rooms" : "Spa treatment rooms, gym zones, pool, sauna, steam, cafe areas"}
        actions={<GemBtn onClick={openNew}><Plus size={16} />Add Facility</GemBtn>} />

      {showForm && (
        <GemCard className="mb-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Building2 size={18} />{editing ? "Edit" : "New"} Facility</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm text-gray-500 font-medium mb-1 block">Name *</label>
              <GemInput required value={form.name} onChange={(e: any) => setForm({...form, name: e.target.value})} />
            </div>
            <div>
              <label className="text-sm text-gray-500 font-medium mb-1 block">Type</label>
              <GemSelect value={form.type} onChange={(e: any) => setForm({...form, type: e.target.value})}>
                <option value="room">Room</option>
                <option value="zone">Zone</option>
                <option value="pool">Pool</option>
                <option value="sauna">Sauna</option>
                <option value="steam">Steam Room</option>
                <option value="cafe">Cafe</option>
                <option value="gym">Gym</option>
                <option value="changing">Changing</option>
                <option value="other">Other</option>
              </GemSelect>
            </div>
            <div>
              <label className="text-sm text-gray-500 font-medium mb-1 block">Capacity</label>
              <GemInput type="number" value={form.capacity} onChange={(e: any) => setForm({...form, capacity: e.target.value})} />
            </div>
            <div className="flex items-end gap-2">
              <GemBtn type="submit" disabled={saving}><Save size={16} />{saving ? "Saving..." : "Save"}</GemBtn>
              <GemBtnOutline onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</GemBtnOutline>
            </div>
            <div className="md:col-span-4">
              <label className="text-sm text-gray-500 font-medium mb-1 block">Description</label>
              <textarea className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm" rows={2} value={form.description} onChange={(e: any) => setForm({...form, description: e.target.value})} />
            </div>
          </form>
        </GemCard>
      )}

      <GemCardBare>
        {loading ? (
          <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-black/20 border-t-black rounded-full animate-spin" /></div>
        ) : visibleItems.length === 0 ? (
          <div className="text-center text-gray-400 py-8"><Building2 size={32} className="mx-auto mb-2 opacity-40" /><p className="text-sm">No facilities created yet</p></div>
        ) : (
          <div className="overflow-x-auto p-6">
            <GemTable
              headers={["Name", "Type", "Capacity", "Status", ""]}
              rows={visibleItems.map(f => [
                <span className="font-semibold">{f.name}</span>,
                typeBadge(f.type),
                f.capacity || "-",
                f.is_active ? <GemBadge variant="success">Active</GemBadge> : <GemBadge variant="danger">Inactive</GemBadge>,
                <div className="flex gap-1">
                  <button className="text-blue-500 hover:text-blue-700 p-1" onClick={() => openEdit(f)} title="Edit"><i className="bi bi-pencil"></i></button>
                  <button className="text-red-500 hover:text-red-700 p-1" onClick={() => deleteItem(f.id)} title="Delete"><i className="bi bi-trash"></i></button>
                </div>,
              ])}
            />
          </div>
        )}
      </GemCardBare>
    </GemPage>
  );
}

export default function FacilitiesPage() {
  return <FacilitiesWorkspace />;
}
