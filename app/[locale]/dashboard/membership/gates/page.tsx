"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { GemPage, GemHeader, GemCard, GemCardBare, GemBtn, GemBtnOutline, GemTable, GemBadge, GemInput, GemSelect } from "@/lib/gem-ui";
import { DoorOpen, Plus, X, Save } from "lucide-react";

export default function GatesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({ name: "", location: "", gate_type: "entry", reader_type: "rfid" });
  const [saving, setSaving] = useState(false);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/membership/gates", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (Array.isArray(data)) setItems(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ name: "", location: "", gate_type: "entry", reader_type: "rfid" }); setShowForm(true); };

  const openEdit = (item: any) => { setEditing(item); setForm({ name: item.name, location: item.location || "", gate_type: item.gate_type, reader_type: item.reader_type }); setShowForm(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      const method = editing ? "PUT" : "POST";
      const body = editing ? { ...form, id: editing.id, is_active: editing.is_active } : form;
      const res = await fetch("/api/membership/gates", { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      if (res.ok) { setShowForm(false); setEditing(null); load(); }
      else { const err = await res.json(); alert(err.error); }
    } catch { alert("Server error"); }
    setSaving(false);
  };

  const deleteItem = async (id: number) => {
    if (!confirm("Delete this gate?")) return;
    try {
      await fetch("/api/membership/gates", { method: "DELETE", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ id }) });
      load();
    } catch {}
  };

  const gateTypeBadge = (t: string) => {
    const map: Record<string, "success" | "warning" | "info"> = { entry: "success", exit: "warning", both: "info" };
    return <GemBadge variant={map[t] || "default"}>{t}</GemBadge>;
  };

  return (
    <GemPage>
      <GemHeader title="Entry Gates" subtitle="Manage entry/exit gates with RFID and QR readers"
        actions={<GemBtn onClick={openNew}><Plus size={16} />Add Gate</GemBtn>} />

      {showForm && (
        <GemCard className="mb-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><DoorOpen size={18} />{editing ? "Edit" : "New"} Gate</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm text-gray-500 font-medium mb-1 block">Name *</label>
              <GemInput required value={form.name} onChange={(e: any) => setForm({...form, name: e.target.value})} />
            </div>
            <div>
              <label className="text-sm text-gray-500 font-medium mb-1 block">Location</label>
              <GemInput value={form.location} onChange={(e: any) => setForm({...form, location: e.target.value})} />
            </div>
            <div>
              <label className="text-sm text-gray-500 font-medium mb-1 block">Gate Type</label>
              <GemSelect value={form.gate_type} onChange={(e: any) => setForm({...form, gate_type: e.target.value})}>
                <option value="entry">Entry</option>
                <option value="exit">Exit</option>
                <option value="both">Both</option>
              </GemSelect>
            </div>
            <div className="flex items-end gap-2">
              <GemBtn type="submit" disabled={saving}><Save size={16} />{saving ? "Saving..." : "Save"}</GemBtn>
              <GemBtnOutline onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</GemBtnOutline>
            </div>
            <div>
              <label className="text-sm text-gray-500 font-medium mb-1 block">Reader Type</label>
              <GemSelect value={form.reader_type} onChange={(e: any) => setForm({...form, reader_type: e.target.value})}>
                <option value="rfid">RFID</option>
                <option value="qr">QR</option>
                <option value="both">Both</option>
                <option value="manual">Manual</option>
              </GemSelect>
            </div>
          </form>
        </GemCard>
      )}

      <GemCardBare>
        {loading ? (
          <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-black/20 border-t-black rounded-full animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="text-center text-gray-400 py-8"><DoorOpen size={32} className="mx-auto mb-2 opacity-40" /><p className="text-sm">No gates created yet</p></div>
        ) : (
          <div className="overflow-x-auto p-6">
            <GemTable
              headers={["Name", "Location", "Type", "Reader", "Status", ""]}
              rows={items.map(g => [
                <span className="font-semibold">{g.name}</span>,
                g.location || "-",
                gateTypeBadge(g.gate_type),
                <GemBadge>{g.reader_type}</GemBadge>,
                g.is_active ? <GemBadge variant="success">Active</GemBadge> : <GemBadge variant="danger">Inactive</GemBadge>,
                <div className="flex gap-1">
                  <button className="text-blue-500 hover:text-blue-700 p-1" onClick={() => openEdit(g)} title="Edit"><i className="bi bi-pencil"></i></button>
                  <button className="text-red-500 hover:text-red-700 p-1" onClick={() => deleteItem(g.id)} title="Delete"><i className="bi bi-trash"></i></button>
                </div>,
              ])}
            />
          </div>
        )}
      </GemCardBare>
    </GemPage>
  );
}
