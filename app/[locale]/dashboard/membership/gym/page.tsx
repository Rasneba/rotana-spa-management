"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  CircleCheck,
  Clock3,
  Dumbbell,
  ScanLine,
  Users,
} from "lucide-react";

type Checkin = { id: number; member_id: number; member_name: string; member_code?: string; plan_name?: string; check_in_at: string };
type GymStats = { total: number | string; active: number | string; completed: number | string };
type HourlyEntry = { hour: number | string; count: number | string };
type GymFacility = { id: number; name: string; type: string; capacity?: number | string | null };

function currentDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function GymManagementPage() {
  const [activeCheckins, setActiveCheckins] = useState<Checkin[]>([]);
  const [stats, setStats] = useState<GymStats>({ total: 0, active: 0, completed: 0 });
  const [hourly, setHourly] = useState<HourlyEntry[]>([]);
  const [facilities, setFacilities] = useState<GymFacility[]>([]);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [attendanceResponse, facilityResponse] = await Promise.all([
        fetch(`/api/membership/attendance?date=${currentDate()}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/membership/facilities", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [attendance, facilityData] = await Promise.all([attendanceResponse.json(), facilityResponse.json()]);
      if (attendance?.ok) {
        setActiveCheckins(attendance.data.activeCheckins || []);
        setStats(attendance.data.stats || { total: 0, active: 0, completed: 0 });
        setHourly(attendance.data.hourly || []);
      }
      setFacilities(Array.isArray(facilityData) ? facilityData.filter((item) => item.type === "gym" || item.type === "zone") : []);
    } catch {
      // Keep the last successful operational snapshot visible.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void load(); }, 0);
    const clock = window.setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => { window.clearTimeout(initialLoad); window.clearInterval(clock); };
    // The initial live-floor snapshot is loaded once when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const peakHour = useMemo(() => {
    if (!hourly.length) return "—";
    const busiest = [...hourly].sort((a, b) => Number(b.count) - Number(a.count))[0];
    return `${String(busiest.hour).padStart(2, "0")}:00`;
  }, [hourly]);
  const gymCapacity = facilities.reduce((total, facility) => total + (Number(facility.capacity) || 0), 0);
  const occupancy = gymCapacity ? Math.min(100, Math.round((Number(stats.active) / gymCapacity) * 100)) : 0;

  return (
    <div className="spa-schedule-page">
      <section className="spa-schedule-hero">
        <div>
          <div className="spa-eyebrow"><Activity size={14} /> FITNESS FLOOR</div>
          <h1>Gym management</h1>
          <p>Keep the floor flowing, monitor live attendance and make every member visit count.</p>
        </div>
        <div className="spa-hero-actions">
          <Link href="/dashboard/membership/facilities" className="schedule-today-button text-decoration-none">Manage areas <ArrowUpRight size={15} /></Link>
          <Link href="/dashboard/membership/attendance" className="schedule-primary-button text-decoration-none"><ScanLine size={16} /> Open check-in</Link>
        </div>
      </section>

      <section className="schedule-summary-grid">
        <div className="schedule-summary-card summary-violet"><div className="summary-icon"><Users size={20} /></div><div><span>Visits today</span><strong>{stats.total || 0}</strong></div></div>
        <div className="schedule-summary-card summary-mint"><div className="summary-icon"><Activity size={20} /></div><div><span>On the floor</span><strong>{stats.active || 0}</strong></div></div>
        <div className="schedule-summary-card summary-amber"><div className="summary-icon"><CircleCheck size={20} /></div><div><span>Completed visits</span><strong>{stats.completed || 0}</strong></div></div>
        <div className="schedule-summary-card summary-slate"><div className="summary-icon"><Clock3 size={20} /></div><div><span>Peak arrival</span><strong>{peakHour}</strong></div></div>
      </section>

      <section className="schedule-bottom-grid" style={{ marginTop: 0 }}>
        <div className="schedule-panel">
          <div className="panel-heading">
            <div><span className="spa-eyebrow"><Users size={14} /> LIVE FLOOR</span><h2>Members currently training</h2></div>
            <span>{activeCheckins.length} active</span>
          </div>
          {loading ? (
            <div className="panel-empty">Loading the live floor…</div>
          ) : activeCheckins.length === 0 ? (
            <div className="panel-empty">The floor is currently clear. New RFID check-ins will appear here instantly.</div>
          ) : (
            <div className="arrival-list">
              {activeCheckins.slice(0, 7).map((checkin) => {
                const minutes = Math.max(0, Math.round((currentTime.getTime() - new Date(checkin.check_in_at).getTime()) / 60000));
                return <Link key={checkin.id} href={`/dashboard/membership/members/${checkin.member_id}`} className="text-decoration-none">
                  <div className="grid" style={{ gridTemplateColumns: "3.35rem minmax(0, 1fr) .5rem", gap: ".55rem", alignItems: "center", padding: ".62rem 0", borderTop: "1px solid #edf0eb" }}>
                    <time style={{ color: "#698173", fontSize: ".64rem", fontWeight: 800 }}>{minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`}</time>
                    <div style={{ minWidth: 0 }}><strong style={{ display: "block", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", color: "#40584b", fontSize: ".69rem" }}>{checkin.member_name}</strong><span style={{ display: "block", marginTop: ".12rem", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", color: "#8c9990", fontSize: ".6rem" }}>{checkin.member_code} · {checkin.plan_name || "Membership"}</span></div>
                    <i className="arrival-status checked-in" />
                  </div>
                </Link>;
              })}
            </div>
          )}
        </div>

        <div className="schedule-panel room-readiness">
          <div className="panel-heading"><div><span className="spa-eyebrow"><Dumbbell size={14} /> CAPACITY</span><h2>Fitness floor status</h2></div></div>
          <div className="readiness-items">
            <div><span>Configured capacity</span><strong>{gymCapacity || "Not set"}</strong></div>
            <div><span>Current occupancy</span><strong>{gymCapacity ? `${occupancy}%` : `${stats.active || 0} members`}</strong></div>
            <div><span>Available places</span><strong>{gymCapacity ? Math.max(0, gymCapacity - Number(stats.active || 0)) : "—"}</strong></div>
          </div>
          {gymCapacity > 0 && <div style={{ height: 8, marginTop: "1rem", overflow: "hidden", borderRadius: 20, background: "#dce8df" }}><div style={{ width: `${occupancy}%`, height: "100%", borderRadius: 20, background: occupancy > 85 ? "#bc7e5b" : "#3e7d5c" }} /></div>}
        </div>
      </section>

      <section className="schedule-workspace" style={{ marginTop: "1rem" }}>
        <div className="schedule-toolbar">
          <div className="date-control"><div><span>Gym areas</span><small>Set capacity to keep the live occupancy signal accurate.</small></div></div>
          <Link href="/dashboard/membership/facilities" className="schedule-today-button text-decoration-none">Add an area <ArrowUpRight size={15} /></Link>
        </div>
        {facilities.length === 0 ? (
          <div className="schedule-empty" style={{ minHeight: "14rem" }}><Dumbbell size={30} /><h2>No gym areas configured</h2><p>Create your gym floor or training zones in Facilities to start monitoring capacity.</p></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
            {facilities.map((facility) => <div key={facility.id} style={{ padding: "1rem", border: "1px solid #e6ece5", borderRadius: ".75rem", background: "#fcfdfb" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: ".75rem", alignItems: "start" }}><div style={{ width: 35, height: 35, display: "grid", placeItems: "center", borderRadius: ".65rem", color: "#327154", background: "#e6f3e9" }}><Dumbbell size={17} /></div><span style={{ padding: ".25rem .4rem", borderRadius: ".35rem", color: "#5d7d68", background: "#edf5ed", fontSize: ".59rem", fontWeight: 800 }}>ACTIVE</span></div>
              <h3 style={{ margin: ".8rem 0 .2rem", color: "#365444", fontSize: ".8rem", fontWeight: 800 }}>{facility.name}</h3>
              <p style={{ margin: 0, color: "#829087", fontSize: ".65rem" }}>{facility.capacity ? `${facility.capacity} member capacity` : "Capacity not set"}</p>
            </div>)}
          </div>
        )}
      </section>
    </div>
  );
}
