"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, DoorOpen, RefreshCw, ShieldCheck, Wifi, WifiOff } from "lucide-react";
import { GemBadge, GemCard, GemCardBare, GemHeader, GemSelect, GemTable } from "@/lib/gem-ui";

type Gate = { id: number; name: string; code: string; status: string; ip_address?: string; last_seen_at?: string; camera_count?: number };
type AccessLog = { id: number | string; created_at: string; member_name?: string; guest_name?: string; member_code?: string; gate_name?: string; access_type: string; method: string; status: string; reason?: string };
type Command = { id: number | string; command: string; status: string; gate_name: string; requested_at: string; response?: string };
type ControlResponse = { gates: Gate[]; logs: AccessLog[]; commands: Command[]; stats: { total: number; granted: number; denied: number; entries: number; exits: number }; error?: string };

export default function AccessControlWorkspace() {
  const [data, setData] = useState<ControlResponse>({ gates: [], logs: [], commands: [], stats: { total: 0, granted: 0, denied: 0, entries: 0, exits: 0 } });
  const [selectedGate, setSelectedGate] = useState("");
  const [loading, setLoading] = useState(true);
  const [commanding, setCommanding] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoading(true);
    try {
      const suffix = selectedGate ? `?gate_id=${selectedGate}&limit=150` : "?limit=150";
      const response = await fetch(`/api/spa/access/control${suffix}`, { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json() as ControlResponse;
      if (!response.ok) throw new Error(payload.error || "Unable to load access control");
      setData(payload);
      if (!selectedGate && payload.gates[0]) setSelectedGate(String(payload.gates[0].id));
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load access control");
    } finally {
      setLoading(false);
    }
  }, [selectedGate]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => void load(), 5_000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [load]);

  const queueOpen = async () => {
    const token = localStorage.getItem("token");
    if (!token || !selectedGate) return;
    setCommanding(true);
    setError("");
    try {
      const response = await fetch("/api/spa/access/control", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "open", gate_id: Number(selectedGate), reason: "Manual front-desk request" }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to queue door command");
      setMessage(payload.message || "Door command queued.");
      window.setTimeout(() => setMessage(""), 4_000);
      await load();
    } catch (commandError) {
      setError(commandError instanceof Error ? commandError.message : "Unable to queue door command");
    } finally {
      setCommanding(false);
    }
  };

  const gate = data.gates.find((item) => String(item.id) === selectedGate);
  const controllerOnline = Boolean(gate?.last_seen_at && gate.status === "active");

  return (
    <div className="access-suite-page">
      <GemHeader
        title="Access Control"
        subtitle="Real-time Spa/Gym entry events with optional local door-controller relay"
        actions={<div className="access-control-actions"><GemSelect value={selectedGate} onChange={(event) => setSelectedGate(event.target.value)}><option value="">All gates</option>{data.gates.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}</GemSelect><span className={controllerOnline ? "online" : "offline"}>{controllerOnline ? <Wifi size={14} /> : <WifiOff size={14} />}{controllerOnline ? "Controller Online" : "Relay Not Confirmed"}</span><button type="button" onClick={() => void queueOpen()} disabled={!selectedGate || commanding}><DoorOpen size={16} />{commanding ? "Queueing…" : "Queue Open Command"}</button><button type="button" className="icon" onClick={() => void load()}><RefreshCw size={16} /></button></div>}
      />
      <div className="access-conversion-note"><ShieldCheck size={18} /><div><strong>Partially merged access-control component</strong><span>Live event monitoring and door actions were retained. A door action is queued for an optional local relay and is never shown as physically completed until that relay acknowledges it.</span></div></div>
      {message && <div className="spa-workspace-alert success"><i className="bi bi-check-circle" />{message}</div>}
      {error && <div className="spa-workspace-alert danger"><i className="bi bi-exclamation-circle" />{error}</div>}

      <div className="access-control-kpis">
        {[{ label: "Today Events", value: data.stats.total, icon: Activity, tone: "blue" }, { label: "Granted", value: data.stats.granted, icon: ShieldCheck, tone: "green" }, { label: "Denied", value: data.stats.denied, icon: ShieldCheck, tone: "red" }, { label: "Entry / Exit", value: `${data.stats.entries} / ${data.stats.exits}`, icon: DoorOpen, tone: "violet" }].map((item) => { const Icon = item.icon; return <GemCard key={item.label} className={`access-control-kpi ${item.tone}`}><Icon size={20} /><div><span>{item.label}</span><strong>{item.value}</strong></div></GemCard>; })}
      </div>

      <div className="access-control-grid">
        <GemCardBare>
          <div className="access-panel-heading"><div><p>Live Feed</p><h2>Access Events</h2></div><GemBadge variant="info">5s refresh</GemBadge></div>
          {loading && data.logs.length === 0 ? <div className="spa-workspace-state"><span className="spinner-border" /></div> : data.logs.length === 0 ? <div className="access-panel-empty">No access events found.</div> : (
            <div className="overflow-x-auto p-4"><GemTable headers={["Time", "Customer", "Gate", "Direction", "Method", "Reason", "Result"]} rows={data.logs.map((log) => [
              <span key="time" className="text-sm">{new Date(log.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</span>,
              <div key="customer"><strong>{log.member_name || log.guest_name || "Guest"}</strong>{log.member_code && <small className="spa-cell-subtitle">{log.member_code}</small>}</div>,
              log.gate_name || "—",
              <GemBadge key="direction" variant={log.access_type === "entry" ? "success" : "warning"}>{log.access_type}</GemBadge>,
              <GemBadge key="method">{log.method}</GemBadge>,
              <span key="reason" className="text-sm">{log.reason || "—"}</span>,
              <GemBadge key="result" variant={log.status === "granted" ? "success" : "danger"}>{log.status}</GemBadge>,
            ])} /></div>
          )}
        </GemCardBare>

        <GemCardBare>
          <div className="access-panel-heading"><div><p>Local Relay</p><h2>Device Commands</h2></div><span>{data.commands.filter((item) => ["pending", "processing"].includes(item.status)).length} queued</span></div>
          <div className="access-command-list">{data.commands.length === 0 ? <div className="access-panel-empty">No door commands.</div> : data.commands.map((command) => <article key={command.id}><span className={`command-status ${command.status}`}><i /></span><div><strong>{command.command.toUpperCase()} · {command.gate_name}</strong><small>{new Date(command.requested_at).toLocaleString()}</small>{command.response && <p>{command.response}</p>}</div><GemBadge variant={command.status === "completed" ? "success" : command.status === "failed" ? "danger" : "warning"}>{command.status}</GemBadge></article>)}</div>
        </GemCardBare>
      </div>
    </div>
  );
}
