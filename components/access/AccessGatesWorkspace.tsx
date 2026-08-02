"use client";

import { useEffect, useState } from "react";
import { GemBadge, GemCard, GemCardBare, GemBtn, GemBtnOutline, GemHeader, GemInput, GemSelect, GemTable } from "@/lib/gem-ui";
import { DoorOpen, Plus, RefreshCw, Save, X } from "lucide-react";

type Gate = {
  id: number;
  name: string;
  code: string;
  location?: string;
  gate_type: string;
  direction: string;
  status: string;
  ip_address?: string;
  port?: number;
  door_open_delay?: number;
  is_qr_enabled: boolean;
  is_nfc_enabled: boolean;
  is_rfid_enabled: boolean;
  controller_model?: string;
  camera_count?: number;
  pending_commands?: number;
  notes?: string;
};

const emptyForm = {
  name: "",
  code: "",
  location: "",
  gate_type: "entry",
  direction: "in",
  status: "active",
  ip_address: "",
  port: "",
  door_open_delay: "2",
  is_qr_enabled: true,
  is_nfc_enabled: false,
  is_rfid_enabled: true,
  controller_model: "",
  notes: "",
};

export default function AccessGatesWorkspace() {
  const [gates, setGates] = useState<Gate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Gate | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  const load = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch("/api/membership/gates", { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load gates");
      setGates(Array.isArray(data) ? data : []);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load gates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (gate: Gate) => {
    setEditing(gate);
    setForm({
      name: gate.name,
      code: gate.code || "",
      location: gate.location || "",
      gate_type: gate.gate_type || "entry",
      direction: gate.direction || "both",
      status: gate.status || "active",
      ip_address: gate.ip_address || "",
      port: gate.port ? String(gate.port) : "",
      door_open_delay: String(gate.door_open_delay || 2),
      is_qr_enabled: gate.is_qr_enabled !== false,
      is_nfc_enabled: gate.is_nfc_enabled === true,
      is_rfid_enabled: gate.is_rfid_enabled !== false,
      controller_model: gate.controller_model || "",
      notes: gate.notes || "",
    });
    setShowForm(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/membership/gates", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, id: editing?.id, port: form.port ? Number(form.port) : null, door_open_delay: Number(form.door_open_delay) || 2 }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save gate");
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save gate");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (gate: Gate, status: string) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const response = await fetch("/api/membership/gates", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: gate.id, status }),
      });
      if (!response.ok) throw new Error("Unable to change gate status");
      await load();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Unable to change gate status");
    }
  };

  const remove = async (gate: Gate) => {
    if (!window.confirm(`Delete ${gate.name}?`)) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const response = await fetch("/api/membership/gates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: gate.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to delete gate");
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete gate");
    }
  };

  return (
    <div className="access-suite-page">
      <GemHeader
        title="Gates"
        subtitle="Spa & Gym entry and exit points with QR, RFID, NFC and optional controllers"
        actions={<div className="access-dashboard-actions"><button type="button" onClick={() => void load()}><RefreshCw size={16} />Refresh</button><button type="button" className="primary" onClick={openNew}><Plus size={16} />Add Gate</button></div>}
      />
      <div className="access-conversion-note"><DoorOpen size={18} /><div><strong>Fully converted gate component</strong><span>ANPR and vehicle barriers were removed. Controller networking is optional; QR, RFID and NFC are configured per Spa/Gym entry point.</span></div></div>
      {error && <div className="spa-workspace-alert danger">{error}</div>}

      {showForm && (
        <GemCard className="mb-6">
          <div className="access-inline-form-heading"><h2><DoorOpen size={18} />{editing ? "Edit" : "Register"} Gate</h2><button type="button" onClick={() => setShowForm(false)}><X size={16} /></button></div>
          <form onSubmit={submit} className="access-form-grid">
            <label><span>Name *</span><GemInput required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
            <label><span>Code *</span><GemInput required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} placeholder="SPA-G1" /></label>
            <label><span>Location</span><GemInput value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Main spa entrance" /></label>
            <label><span>Gate Type</span><GemSelect value={form.gate_type} onChange={(event) => setForm({ ...form, gate_type: event.target.value })}><option value="entry">Entry</option><option value="exit">Exit</option><option value="both">Both</option></GemSelect></label>
            <label><span>Direction</span><GemSelect value={form.direction} onChange={(event) => setForm({ ...form, direction: event.target.value })}><option value="in">In</option><option value="out">Out</option><option value="both">Both</option></GemSelect></label>
            <label><span>Status</span><GemSelect value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option><option value="maintenance">Maintenance</option></GemSelect></label>
            <label><span>Controller IP</span><GemInput value={form.ip_address} onChange={(event) => setForm({ ...form, ip_address: event.target.value })} placeholder="192.168.1.50" /></label>
            <label><span>Port</span><GemInput type="number" value={form.port} onChange={(event) => setForm({ ...form, port: event.target.value })} /></label>
            <label><span>Open Delay (seconds)</span><GemInput type="number" min="1" value={form.door_open_delay} onChange={(event) => setForm({ ...form, door_open_delay: event.target.value })} /></label>
            <label><span>Controller Model</span><GemInput value={form.controller_model} onChange={(event) => setForm({ ...form, controller_model: event.target.value })} /></label>
            <div className="access-feature-field"><span>Reader Features</span><div>{[["is_qr_enabled", "QR"], ["is_rfid_enabled", "RFID"], ["is_nfc_enabled", "NFC"]].map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(form[key as keyof typeof form])} onChange={(event) => setForm({ ...form, [key]: event.target.checked })} />{label}</label>)}</div></div>
            <label className="span-two"><span>Notes</span><textarea rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
            <div className="span-two access-form-actions"><GemBtnOutline onClick={() => setShowForm(false)}>Cancel</GemBtnOutline><GemBtn type="submit" disabled={saving}><Save size={16} />{saving ? "Saving…" : "Save Gate"}</GemBtn></div>
          </form>
        </GemCard>
      )}

      <GemCardBare>
        {loading ? <div className="spa-workspace-state"><span className="spinner-border" /></div> : gates.length === 0 ? <div className="spa-workspace-state"><DoorOpen size={32} /><p>No gates configured.</p></div> : (
          <div className="overflow-x-auto p-5"><GemTable headers={["Code", "Gate", "Direction", "Controller", "Readers", "Cameras", "Commands", "Status", "Actions"]} rows={gates.map((gate) => [
            <span key="code" className="font-mono font-bold">{gate.code}</span>,
            <div key="gate"><strong>{gate.name}</strong><small className="spa-cell-subtitle">{gate.location || "No location"}</small></div>,
            <GemBadge key="direction" variant="info">{gate.direction}</GemBadge>,
            gate.ip_address ? <span key="controller" className="text-sm">{gate.ip_address}{gate.port ? `:${gate.port}` : ""}</span> : <span key="controller" className="text-muted">Not linked</span>,
            <div key="readers" className="flex gap-1">{gate.is_qr_enabled && <GemBadge variant="success">QR</GemBadge>}{gate.is_rfid_enabled && <GemBadge>RFID</GemBadge>}{gate.is_nfc_enabled && <GemBadge variant="warning">NFC</GemBadge>}</div>,
            Number(gate.camera_count || 0),
            Number(gate.pending_commands || 0),
            <GemSelect key="status" value={gate.status} onChange={(event) => void changeStatus(gate, event.target.value)} className="w-32"><option value="active">Active</option><option value="inactive">Inactive</option><option value="maintenance">Maintenance</option></GemSelect>,
            <div key="actions" className="spa-row-actions"><button type="button" onClick={() => openEdit(gate)}><i className="bi bi-pencil" /></button><button type="button" className="danger" onClick={() => void remove(gate)}><i className="bi bi-trash" /></button></div>,
          ])} /></div>
        )}
      </GemCardBare>
    </div>
  );
}
