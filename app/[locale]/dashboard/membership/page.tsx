"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { GemPage, GemHeader, GemCard, GemCardBare, GemKpi, GemBtn, GemBtnOutline, GemTable, GemBadge } from "@/lib/gem-ui";
import {
  Activity,
  BarChart3,
  Boxes,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Dumbbell,
  Flower2,
  Layers,
  ReceiptText,
  Users,
} from "lucide-react";

const managementAreas = [
  { name: "Customers", icon: Users, desc: "Profiles, medical records, visits and loyalty", href: "/dashboard/spa/customers/profiles", color: "text-sky-600" },
  { name: "Offering Master", icon: Layers, desc: "One classified master for plans, services and packages", href: "/dashboard/spa/catalog/offerings", color: "text-blue-600" },
  { name: "Memberships", icon: CalendarDays, desc: "Assign offerings, renew, freeze or transfer", href: "/dashboard/spa/membership/renewals", color: "text-indigo-600" },
  { name: "Operations", icon: Activity, desc: "Visits, appointments, treatments and towels", href: "/dashboard/spa/operations/visits", color: "text-violet-600" },
  { name: "Gym", icon: Dumbbell, desc: "Trainers, workout plans, classes and attendance", href: "/dashboard/spa/gym/trainers", color: "text-emerald-600" },
  { name: "Spa", icon: Flower2, desc: "Therapists, treatment rooms and bookings", href: "/dashboard/spa/spa/therapists", color: "text-rose-600" },
  { name: "Inventory", icon: Boxes, desc: "Products, consumables, usage and suppliers", href: "/dashboard/spa/inventory/products", color: "text-amber-600" },
  { name: "Service Orders", icon: ReceiptText, desc: "Price-free draft slips for the separate POS cashier", href: "/dashboard/spa/operations/service-orders", color: "text-indigo-600" },
  { name: "Staff", icon: BriefcaseBusiness, desc: "Employees, schedules, commission and performance", href: "/dashboard/spa/staff/employees", color: "text-cyan-600" },
  { name: "Facilities", icon: Building2, desc: "Rooms, lockers, equipment and maintenance", href: "/dashboard/spa/facilities/rooms", color: "text-orange-600" },
  { name: "Reports", icon: BarChart3, desc: "Membership, attendance, service orders and utilization", href: "/dashboard/spa/reports/membership", color: "text-teal-600" },
];

export default function SpaManagementDashboard() {
  const [stats, setStats] = useState<any>(null);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const load = async () => {
    if (!token) return;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [plansRes, membersRes, visitsRes, ordersRes] = await Promise.all([
        fetch("/api/spa/catalog/offerings?classification=membership_plan&status=active&limit=250", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/membership/members", { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/spa/visits?date=${today}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/spa/service-orders?status=draft", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const offeringData = await plansRes.json();
      const plans = Array.isArray(offeringData.records) ? offeringData.records : [];
      const members = await membersRes.json();
      const visitsData = visitsRes.ok ? await visitsRes.json() : { visits: [] };
      const ordersData = ordersRes.ok ? await ordersRes.json() : { summary: { drafts: 0 } };
      const visits = Array.isArray(visitsData.visits) ? visitsData.visits : [];
      setStats({
        totalPlans: Array.isArray(plans) ? plans.length : 0,
        totalMembers: Array.isArray(members) ? members.length : 0,
        todayVisits: visits.length,
        draftOrders: Number(ordersData.summary?.drafts || 0),
        recentVisits: visits.slice(0, 5),
      });
    } catch {}
  };

  useEffect(() => { load(); }, []);

  return (
    <GemPage>
      <GemHeader
        title="Spa Management"
        subtitle="Manage visits, treatments, memberships and operational handoff—separate from Sales/POS"
        actions={
          <>
            <Link href="/dashboard/spa/operations/visits" className="text-inherit"><GemBtn><Activity size={16} />Visits</GemBtn></Link>
            <Link href="/dashboard/spa/operations/appointments" className="text-inherit"><GemBtnOutline><CalendarDays size={16} />Schedule</GemBtnOutline></Link>
            <Link href="/dashboard/spa/gym/attendance" className="text-inherit"><GemBtnOutline><Dumbbell size={16} />Gym</GemBtnOutline></Link>
            <Link href="/dashboard/spa/customers/profiles" className="text-inherit"><GemBtnOutline><Users size={16} />Members</GemBtnOutline></Link>
          </>
        }
      />

      {!stats ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-black/20 border-t-black rounded-full animate-spin" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Membership Offerings", value: stats.totalPlans, icon: <Layers size={22} />, color: "bg-black", href: "/dashboard/spa/catalog/offerings" },
              { label: "Total Members", value: stats.totalMembers, icon: <Users size={22} />, color: "bg-emerald-600", href: "/dashboard/spa/customers/profiles" },
              { label: "Today's Visits", value: stats.todayVisits, icon: <Activity size={22} />, color: "bg-violet-600", href: "/dashboard/spa/operations/visits" },
              { label: "Draft Orders", value: stats.draftOrders, icon: <ReceiptText size={22} />, color: "bg-amber-500", href: "/dashboard/spa/operations/service-orders" },
            ].map(card => (
              <Link key={card.label} href={card.href} className="text-inherit">
                <GemKpi title={card.label} value={card.value} icon={card.icon} color={card.color} />
              </Link>
            ))}
          </div>

          <GemCardBare className="mb-8">
            <div className="p-6 flex justify-between items-center border-b border-gray-100">
              <h2 className="font-semibold flex items-center gap-2"><Activity size={18} />Today&apos;s Visits</h2>
              <Link href="/dashboard/spa/operations/visits" className="text-sm font-medium text-black hover:underline">View All</Link>
            </div>
            <div className="overflow-x-auto">
              {stats.recentVisits.length === 0 ? (
                <div className="text-center text-gray-400 py-8 text-sm">No visits today</div>
              ) : (
                <GemTable
                  headers={["Visit", "Customer", "Therapist", "Services", "Status"]}
                  rows={stats.recentVisits.map((visit: any) => [
                    <Link href={`/dashboard/spa/operations/visits/${visit.id}`} className="font-mono font-semibold">{visit.visit_no}</Link>,
                    <span className="font-semibold">{visit.customer_name}</span>,
                    visit.therapist_name || "Unassigned",
                    Number(visit.total_items || 0),
                    <GemBadge variant={visit.status === "cancelled" ? "danger" : visit.status === "in_treatment" ? "info" : "success"}>{String(visit.status).replace(/_/g, " ")}</GemBadge>,
                  ])}
                />
              )}
            </div>
          </GemCardBare>
        </>
      )}

      <section aria-labelledby="management-areas-heading">
        <div className="mb-4">
          <h2 id="management-areas-heading" className="text-lg font-bold mb-1">Management areas</h2>
          <p className="text-sm text-gray-500">Move quickly between the spa&apos;s core day-to-day workspaces.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {managementAreas.map((area) => {
            const Icon = area.icon;
            return (
              <Link key={area.name} href={area.href} className="text-inherit">
                <GemCard className="text-center hover:shadow-md transition-shadow h-full">
                  <div className={`${area.color} mb-3 flex justify-center`}><Icon size={28} /></div>
                  <h3 className="font-bold mb-1">{area.name}</h3>
                  <p className="text-sm text-gray-500">{area.desc}</p>
                </GemCard>
              </Link>
            );
          })}
        </div>
      </section>
    </GemPage>
  );
}
