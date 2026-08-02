"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { GemPage, GemHeader, GemCard, GemCardBare, GemKpi, GemBtn, GemBtnOutline, GemTable, GemBadge } from "@/lib/gem-ui";
import {
  Activity,
  BadgeDollarSign,
  BarChart3,
  Boxes,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle,
  CreditCard,
  DollarSign,
  Dumbbell,
  Flower2,
  Layers,
  Users,
} from "lucide-react";

const managementAreas = [
  { name: "Customers", icon: Users, desc: "Profiles, medical records, visits and loyalty", href: "/dashboard/spa/customers/profiles", color: "text-sky-600" },
  { name: "Membership", icon: Layers, desc: "Plans, registration, renewals and access cards", href: "/dashboard/membership/plans", color: "text-blue-600" },
  { name: "Operations", icon: Activity, desc: "Check-ins, appointments, sessions and queue", href: "/dashboard/spa/operations/check-in", color: "text-violet-600" },
  { name: "Gym", icon: Dumbbell, desc: "Trainers, workout plans, classes and attendance", href: "/dashboard/spa/gym/trainers", color: "text-emerald-600" },
  { name: "Spa", icon: Flower2, desc: "Services, therapists, rooms, bookings and packages", href: "/dashboard/spa/spa/services", color: "text-rose-600" },
  { name: "Inventory", icon: Boxes, desc: "Products, consumables, usage and suppliers", href: "/dashboard/spa/inventory/products", color: "text-amber-600" },
  { name: "Charges", icon: BadgeDollarSign, desc: "Pending charges, cashier and receipt workflows", href: "/dashboard/spa/charges/pending-charges", color: "text-indigo-600" },
  { name: "Staff", icon: BriefcaseBusiness, desc: "Employees, schedules, commission and performance", href: "/dashboard/spa/staff/employees", color: "text-cyan-600" },
  { name: "Facilities", icon: Building2, desc: "Rooms, lockers, equipment and maintenance", href: "/dashboard/spa/facilities/rooms", color: "text-orange-600" },
  { name: "Reports", icon: BarChart3, desc: "Membership, attendance, revenue and utilization", href: "/dashboard/spa/reports/membership", color: "text-teal-600" },
];

export default function SpaManagementDashboard() {
  const [stats, setStats] = useState<any>(null);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const load = async () => {
    if (!token) return;
    try {
      const [plansRes, membersRes, paymentsRes] = await Promise.all([
        fetch("/api/membership/plans", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/membership/members", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/membership/payments", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const plans = await plansRes.json();
      const members = await membersRes.json();
      const payments = await paymentsRes.json();
      const activeMembers = Array.isArray(members) ? members.filter((m: any) => m.status === "active") : [];
      const totalRevenue = Array.isArray(payments) ? payments.reduce((s: number, p: any) => s + Number(p.amount), 0) : 0;
      setStats({
        totalPlans: Array.isArray(plans) ? plans.length : 0,
        totalMembers: Array.isArray(members) ? members.length : 0,
        activeMembers: activeMembers.length,
        totalRevenue,
        recentPayments: Array.isArray(payments) ? payments.slice(0, 5) : [],
      });
    } catch {}
  };

  useEffect(() => { load(); }, []);

  return (
    <GemPage>
      <GemHeader
        title="Spa Management"
        subtitle="Manage bookings, memberships, gym access and daily operations"
        actions={
          <>
            <Link href="/dashboard/spa/operations/appointments" className="text-inherit"><GemBtn><CalendarDays size={16} />Schedule</GemBtn></Link>
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
              { label: "Total Plans", value: stats.totalPlans, icon: <Layers size={22} />, color: "bg-black", href: "/dashboard/membership/plans" },
              { label: "Total Members", value: stats.totalMembers, icon: <Users size={22} />, color: "bg-emerald-600", href: "/dashboard/spa/customers/profiles" },
              { label: "Active Members", value: stats.activeMembers, icon: <CheckCircle size={22} />, color: "bg-blue-500", href: "/dashboard/spa/customers/profiles" },
              { label: "Revenue", value: `ETB ${stats.totalRevenue.toLocaleString()}`, icon: <DollarSign size={22} />, color: "bg-amber-500", href: "/dashboard/spa/charges/payment-history" },
            ].map(card => (
              <Link key={card.label} href={card.href} className="text-inherit">
                <GemKpi title={card.label} value={card.value} icon={card.icon} color={card.color} />
              </Link>
            ))}
          </div>

          <GemCardBare className="mb-8">
            <div className="p-6 flex justify-between items-center border-b border-gray-100">
              <h2 className="font-semibold flex items-center gap-2"><CreditCard size={18} />Recent Payments</h2>
              <Link href="/dashboard/spa/charges/payment-history" className="text-sm font-medium text-black hover:underline">View All</Link>
            </div>
            <div className="overflow-x-auto">
              {stats.recentPayments.length === 0 ? (
                <div className="text-center text-gray-400 py-8 text-sm">No payments yet</div>
              ) : (
                <GemTable
                  headers={["Customer", "Plan", "Amount", "Method", "Date"]}
                  rows={stats.recentPayments.map((p: any) => [
                    <span className="font-semibold">{p.member_name}</span>,
                    <GemBadge variant="info">{p.plan_name}</GemBadge>,
                    `ETB ${Number(p.amount).toLocaleString()}`,
                    <GemBadge>{p.payment_method}</GemBadge>,
                    <span className="text-sm">{new Date(p.payment_date).toLocaleDateString()}</span>,
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
