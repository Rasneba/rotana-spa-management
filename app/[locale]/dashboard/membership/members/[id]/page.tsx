"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { GemPage, GemCard, GemCardBare, GemTable, GemBadge, GemKpi } from "@/lib/gem-ui";
import { ArrowLeft, Clock, CalendarCheck, Layers, User, UserCheck } from "lucide-react";

export default function MemberDetailPage() {
  const { id } = useParams();
  const [member, setMember] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "attendance">("overview");
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  useEffect(() => {
    if (!token || !id) return;
    const load = async () => {
      try {
        const [mRes, aRes] = await Promise.all([
          fetch(`/api/membership/members/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`/api/membership/attendance/history?member_id=${id}&limit=20`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const mData = await mRes.json();
        const aData = await aRes.json();
        setMember(mData.id ? mData : null);
        setAttendance(aData.ok ? aData.data || [] : []);
      } catch {}
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) return <GemPage><div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-black/20 border-t-black rounded-full animate-spin" /></div></GemPage>;
  if (!member) return <GemPage><div className="text-center text-gray-400 py-12"><User size={32} className="mx-auto mb-2 opacity-40" /><p className="text-sm">Member not found</p></div></GemPage>;

  const isActive = member.end_date ? new Date(member.end_date) >= new Date() : true;
  const daysLeft = member.end_date ? Math.max(0, Math.ceil((new Date(member.end_date).getTime() - Date.now()) / 86400000)) : null;
  const totalVisits = attendance.length;
  const thisMonth = attendance.filter((a: any) => new Date(a.check_in_at).getMonth() === new Date().getMonth()).length;

  const tabs = [
    { key: "overview" as const, label: "Overview" },
    { key: "attendance" as const, label: `Attendance (${attendance.length})` },
  ];

  return (
    <GemPage>
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/spa/customers/profiles" className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"><ArrowLeft size={16} /></Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{member.full_name}</h1>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-gray-400">{member.customer_id}</span>
              <span className="text-gray-300">&middot;</span>
              <span className="text-sm text-gray-500">{member.phone || "No phone"}</span>
            </div>
          </div>
        </div>
        <div>
          {isActive ? (
            <GemBadge variant="success" className="text-sm px-4 py-2">
              {daysLeft !== null ? `${daysLeft} days remaining` : "Active"}
            </GemBadge>
          ) : (
            <GemBadge variant="danger" className="text-sm px-4 py-2">Expired</GemBadge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <GemKpi title="Total Visits" value={totalVisits} icon={<Clock size={22} />} color="bg-blue-500" />
        <GemKpi title="This Month" value={thisMonth} icon={<CalendarCheck size={22} />} color="bg-emerald-600" />
        <GemKpi title="Plan" value={member.plan_name || "N/A"} icon={<Layers size={22} />} color="bg-purple-500" />
        <GemKpi title="Status" value={isActive ? "Active" : "Expired"} icon={<UserCheck size={22} />} color="bg-amber-500" />
      </div>

      <div className="flex gap-1 mb-6 rounded-2xl p-1 shadow-sm border border-gray-100">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === t.key ? "bg-black text-white" : "text-gray-500 hover:bg-gray-50"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <GemCard>
          <h3 className="font-semibold mb-4 flex items-center gap-2"><User size={18} />Member Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              {[["Code", member.customer_id], ["Name", member.full_name], ["Phone", member.phone || "-"], ["Email", member.email || "-"], ["ID Number", member.id_number || "-"]].map(([l, v]) => (
                <div key={l} className="flex justify-between border-b border-gray-50 pb-2"><span className="text-xs text-gray-400 uppercase font-medium">{l}</span><span className="text-sm font-medium">{v}</span></div>
              ))}
            </div>
            <div className="space-y-3">
              {[["Plan", <GemBadge variant="info">{member.plan_name || "N/A"}</GemBadge>], ["Type", member.plan_type || "-"], ["Start Date", member.start_date ? new Date(member.start_date).toLocaleDateString() : "-"], ["End Date", member.end_date ? new Date(member.end_date).toLocaleDateString() : "-"], ["Address", member.address || "-"]].map(([l, v]) => (
                <div key={l as string} className="flex justify-between border-b border-gray-50 pb-2"><span className="text-xs text-gray-400 uppercase font-medium">{l as string}</span><span className="text-sm font-medium">{v}</span></div>
              ))}
            </div>
          </div>
        </GemCard>
      )}

      {activeTab === "attendance" && (
        <GemCardBare>
          <div className="p-6">
            {attendance.length === 0 ? (
              <div className="text-center text-gray-400 py-8"><Clock size={32} className="mx-auto mb-2 opacity-40" /><p className="text-sm">No attendance records</p></div>
            ) : (
              <GemTable
                headers={["Date", "Check In", "Check Out", "Duration", "Source", "Status"]}
                rows={attendance.map((a: any) => {
                  const dur = a.check_out_at ? Math.floor((new Date(a.check_out_at).getTime() - new Date(a.check_in_at).getTime()) / 60000) : Math.floor((Date.now() - new Date(a.check_in_at).getTime()) / 60000);
                  return [
                    <span className="text-sm">{new Date(a.check_in_at).toLocaleDateString()}</span>,
                    <span className="text-sm">{new Date(a.check_in_at).toLocaleTimeString()}</span>,
                    <span className="text-sm">{a.check_out_at ? new Date(a.check_out_at).toLocaleTimeString() : "-"}</span>,
                    <span className="font-semibold text-sm">{dur < 60 ? `${dur}m` : `${Math.floor(dur / 60)}h ${dur % 60}m`}</span>,
                    <GemBadge>{a.source || "rfid"}</GemBadge>,
                    a.status === "checked_in" ? <GemBadge variant="success">Active</GemBadge> : <GemBadge>Done</GemBadge>,
                  ];
                })}
              />
            )}
          </div>
        </GemCardBare>
      )}

    </GemPage>
  );
}
