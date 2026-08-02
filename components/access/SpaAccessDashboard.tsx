"use client";

import { useCallback, useEffect, useState } from "react";
import { Link } from "@/lib/i18n/navigation";
import {
  Activity,
  BarChart3,
  Camera,
  CalendarCheck,
  CreditCard,
  DoorOpen,
  Grid3X3,
  LayoutDashboard,
  Map,
  Monitor,
  PackageSearch,
  ReceiptText,
  ScanLine,
  ShieldCheck,
  TicketCheck,
  Users,
  Wrench,
} from "lucide-react";
import { GemBadge, GemCard, GemCardBare, GemHeader, GemTable } from "@/lib/gem-ui";

type AccessStats = {
  totalAreas: number;
  totalCapacity: number;
  activeVisits: number;
  activeSessions: number;
  todayEntries: number;
  todayExits: number;
  totalCustomers: number;
  activeSubscriptions: number;
  activeCards: number;
  activePasses: number;
  gates: { total: number; active: number };
  cameras: { total: number; active: number };
  pendingCommands: number;
  recentAccess: Array<{
    id: number | string;
    access_type: string;
    method: string;
    status: string;
    reason?: string;
    created_at: string;
    gate_name?: string;
    member_name?: string;
    member_code?: string;
  }>;
  occupancy: Array<{ id: number; name: string; type: string; capacity: number; occupied: number }>;
  error?: string;
};

const accessModules = [
  { name: "Zones & Lots", converted: "Spa & Gym areas", icon: Map, href: "/dashboard/spa/access/zones", color: "#4f7b66" },
  { name: "Slots", converted: "Capacity & spaces", icon: Grid3X3, href: "/dashboard/spa/access/slots", color: "#5d7ba6" },
  { name: "Gates", converted: "Entry and exit points", icon: DoorOpen, href: "/dashboard/spa/access/gates", color: "#31855e" },
  { name: "Cameras", converted: "Security and occupancy cameras", icon: Camera, href: "/dashboard/spa/access/cameras", color: "#657385" },
  { name: "Customers", converted: "Member and guest profiles", icon: Users, href: "/dashboard/spa/access/customers", color: "#b77932" },
  { name: "Vehicles", converted: "Converted to equipment assets", icon: Wrench, href: "/dashboard/spa/access/vehicles", color: "#6c7181" },
  { name: "RFID Cards", converted: "Cards and wristbands", icon: CreditCard, href: "/dashboard/spa/access/rfid-cards", color: "#7656a8" },
  { name: "Access Control", converted: "Live access events and door queue", icon: ShieldCheck, href: "/dashboard/spa/access/control", color: "#2f7956" },
  { name: "QR Access", converted: "Scan and verify Spa/Gym passes", icon: ScanLine, href: "/dashboard/spa/access/qr-access", color: "#3675a5" },
  { name: "Subscriptions", converted: "Membership validity periods", icon: CalendarCheck, href: "/dashboard/spa/access/subscriptions", color: "#388566" },
  { name: "Sessions", converted: "Active facility sessions", icon: Activity, href: "/dashboard/spa/access/sessions", color: "#a95454" },
  { name: "Rates", converted: "Service catalogue — no prices", icon: PackageSearch, href: "/dashboard/spa/access/rates", color: "#587965" },
  { name: "QR Tickets", converted: "QR day and guest passes", icon: TicketCheck, href: "/dashboard/spa/access/qr-tickets", color: "#477daa" },
  { name: "Kiosk", converted: "Member and walk-in check-in", icon: Monitor, href: "/dashboard/spa/access/kiosk", color: "#416b85" },
  { name: "POS", converted: "Draft service orders only", icon: ReceiptText, href: "/dashboard/spa/access/pos", color: "#8b6c35" },
  { name: "Reports", converted: "Operational access reports", icon: BarChart3, href: "/dashboard/spa/access/reports", color: "#507568" },
];

export default function SpaAccessDashboard() {
  const [stats, setStats] = useState<AccessStats | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const response = await fetch("/api/spa/access/stats", { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json() as AccessStats;
      if (!response.ok) throw new Error(data.error || "Unable to load access dashboard");
      setStats(data);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load access dashboard");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => void load(), 15_000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [load]);

  return (
    <div className="access-suite-page">
      <GemHeader
        title="Spa & Gym Access Dashboard"
        subtitle="Converted access, occupancy, credential, kiosk and entry operations"
        actions={
          <div className="access-dashboard-actions">
            <Link href="/dashboard/spa/access/control"><ShieldCheck size={16} />Access Control</Link>
            <Link href="/dashboard/spa/access/kiosk" className="primary"><Monitor size={16} />Check-In Kiosk</Link>
          </div>
        }
      />

      <div className="access-conversion-note">
        <LayoutDashboard size={18} />
        <div><strong>Adapted from the reusable components in Rasneba/-geniouserp</strong><span>Parking records, vehicle recognition, rates and embedded POS were not copied. Every card below uses Spa/Gym facilities, members, credentials, visits or service orders.</span></div>
      </div>

      {error && <div className="spa-workspace-alert danger" role="alert"><i className="bi bi-exclamation-circle" />{error}</div>}

      {!stats ? (
        <div className="spa-workspace-state"><span className="spinner-border" /><p>Loading access operations…</p></div>
      ) : (
        <>
          <div className="access-kpi-grid">
            {[
              { label: "Areas & Capacity", value: `${stats.totalAreas} / ${stats.totalCapacity}`, sub: "active areas / total capacity", icon: Map, tone: "green", href: "/dashboard/spa/access/zones" },
              { label: "Active Sessions", value: stats.activeSessions + stats.activeVisits, sub: `${stats.activeVisits} treatment visits`, icon: Activity, tone: "blue", href: "/dashboard/spa/access/sessions" },
              { label: "Today Entries", value: stats.todayEntries, sub: `${stats.todayExits} exits`, icon: DoorOpen, tone: "violet", href: "/dashboard/spa/access/control" },
              { label: "Customers", value: stats.totalCustomers, sub: `${stats.activeSubscriptions} active subscriptions`, icon: Users, tone: "amber", href: "/dashboard/spa/access/customers" },
              { label: "Active Credentials", value: stats.activeCards + stats.activePasses, sub: `${stats.activeCards} RFID · ${stats.activePasses} QR`, icon: CreditCard, tone: "purple", href: "/dashboard/spa/access/rfid-cards" },
              { label: "Devices Online", value: stats.gates.active + stats.cameras.active, sub: `${stats.gates.active}/${stats.gates.total} gates · ${stats.cameras.active}/${stats.cameras.total} cameras`, icon: Camera, tone: "slate", href: "/dashboard/spa/access/cameras" },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <Link key={card.label} href={card.href} className="access-kpi-link">
                  <GemCard className={`access-kpi-card ${card.tone}`}>
                    <span className="access-kpi-icon"><Icon size={20} /></span>
                    <div><p>{card.label}</p><strong>{card.value}</strong><small>{card.sub}</small></div>
                  </GemCard>
                </Link>
              );
            })}
          </div>

          <div className="access-dashboard-panels">
            <GemCardBare>
              <div className="access-panel-heading"><div><p>Live Activity</p><h2>Recent Access Events</h2></div><Link href="/dashboard/spa/access/control">View all</Link></div>
              {stats.recentAccess.length === 0 ? <div className="access-panel-empty">No access events recorded yet.</div> : (
                <div className="overflow-x-auto p-4">
                  <GemTable
                    headers={["Time", "Customer", "Gate", "Direction", "Method", "Result"]}
                    rows={stats.recentAccess.map((event) => [
                      <span key="time" className="text-sm">{new Date(event.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>,
                      <span key="customer" className="font-medium">{event.member_name || "Guest"}</span>,
                      event.gate_name || "—",
                      <GemBadge key="direction" variant={event.access_type === "entry" ? "success" : "warning"}>{event.access_type}</GemBadge>,
                      <GemBadge key="method">{event.method}</GemBadge>,
                      <GemBadge key="result" variant={event.status === "granted" ? "success" : "danger"}>{event.status}</GemBadge>,
                    ])}
                  />
                </div>
              )}
            </GemCardBare>

            <GemCardBare>
              <div className="access-panel-heading"><div><p>Capacity</p><h2>Area Occupancy</h2></div><span>{stats.pendingCommands} commands queued</span></div>
              <div className="access-occupancy-list">
                {stats.occupancy.length === 0 ? <div className="access-panel-empty">No active areas configured.</div> : stats.occupancy.slice(0, 8).map((area) => {
                  const percent = area.capacity > 0 ? Math.min(100, Math.round(area.occupied / area.capacity * 100)) : 0;
                  return <div key={area.id}><div><strong>{area.name}</strong><span>{area.occupied} / {area.capacity || "—"}</span></div><div className="access-capacity-track"><i style={{ width: `${percent}%` }} /></div><small>{area.type}</small></div>;
                })}
              </div>
            </GemCardBare>
          </div>
        </>
      )}

      <section className="access-module-section">
        <div className="access-section-title"><div><p>Converted Component Set</p><h2>Access & Entry Workspaces</h2></div><span>16 pictured components · Spa/Gym data</span></div>
        <div className="access-module-grid">
          {accessModules.map((module) => {
            const Icon = module.icon;
            return (
              <Link key={module.name} href={module.href} className="access-module-link">
                <GemCard className="access-module-card">
                  <span style={{ color: module.color }}><Icon size={25} /></span>
                  <div><h3>{module.name}</h3><p>{module.converted}</p></div>
                  <i className="bi bi-arrow-right" />
                </GemCard>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
