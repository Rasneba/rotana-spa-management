"use client";

import { useEffect, useState } from "react";
import { Link } from "@/lib/i18n/navigation";
import { GemBadge, GemCard, GemHeader } from "@/lib/gem-ui";
import { Grid3X3, Map, RefreshCw } from "lucide-react";

type Area = { id: number; name: string; type: string; capacity: number; occupied: number };
type Stats = { totalCapacity: number; occupancy: Area[]; error?: string };

export default function AccessCapacityWorkspace() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [totalCapacity, setTotalCapacity] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch("/api/spa/access/stats", { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json() as Stats;
      if (!response.ok) throw new Error(data.error || "Unable to load capacity spaces");
      setAreas(data.occupancy || []);
      setTotalCapacity(Number(data.totalCapacity || 0));
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load capacity spaces");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const occupied = areas.reduce((total, area) => total + Number(area.occupied), 0);
  const available = Math.max(0, totalCapacity - occupied);

  return (
    <div className="access-suite-page">
      <GemHeader
        title="Slots — Capacity & Spaces"
        subtitle="Parking slots converted into Spa/Gym room, zone and facility capacity"
        actions={<div className="access-dashboard-actions"><button type="button" onClick={() => void load()}><RefreshCw size={16} />Refresh</button><Link href="/dashboard/spa/access/zones" className="primary"><Map size={16} />Manage Areas</Link></div>}
      />
      <div className="access-conversion-note"><Grid3X3 size={18} /><div><strong>No parking-slot records are used</strong><span>Each Spa/Gym area exposes its capacity and current facility sessions. This is a partial merge of the original slot-occupancy component.</span></div></div>
      {error && <div className="spa-workspace-alert danger">{error}</div>}
      <div className="access-capacity-summary">
        <article><span>Total Capacity</span><strong>{totalCapacity}</strong></article>
        <article><span>Currently Occupied</span><strong>{occupied}</strong></article>
        <article><span>Available Spaces</span><strong>{available}</strong></article>
        <article><span>Configured Areas</span><strong>{areas.length}</strong></article>
      </div>
      {loading ? <div className="spa-workspace-state"><span className="spinner-border" /><p>Loading spaces…</p></div> : (
        <div className="access-space-grid">
          {areas.map((area) => {
            const capacity = Number(area.capacity || 0);
            const used = Number(area.occupied || 0);
            const percent = capacity > 0 ? Math.min(100, Math.round(used / capacity * 100)) : 0;
            const full = capacity > 0 && used >= capacity;
            return (
              <GemCard key={area.id} className={`access-space-card ${full ? "full" : ""}`}>
                <div className="access-space-heading"><div><span>{area.type}</span><h2>{area.name}</h2></div><GemBadge variant={full ? "danger" : capacity === 0 ? "default" : "success"}>{capacity === 0 ? "Not limited" : full ? "Full" : "Available"}</GemBadge></div>
                <div className="access-space-count"><strong>{used}</strong><span>/ {capacity || "∞"}</span></div>
                <div className="access-capacity-track large"><i style={{ width: `${percent}%` }} /></div>
                <p>{capacity > 0 ? `${Math.max(0, capacity - used)} spaces available` : "Capacity is not configured"}</p>
              </GemCard>
            );
          })}
          {areas.length === 0 && <div className="spa-workspace-state"><Grid3X3 size={32} /><p>No Spa/Gym areas configured.</p></div>}
        </div>
      )}
    </div>
  );
}
