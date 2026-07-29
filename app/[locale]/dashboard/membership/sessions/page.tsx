"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { GemPage, GemHeader, GemCard, GemCardBare, GemTable, GemBadge, GemInput, GemBtn } from "@/lib/gem-ui";
import { Timer, LogOut } from "lucide-react";

export default function SessionsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [showActive, setShowActive] = useState(false);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const activeParam = showActive ? "&active=true" : "";
      const res = await fetch(`/api/membership/sessions?date=${date}${activeParam}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (Array.isArray(data)) setSessions(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [date, showActive]);

  const checkOut = async (id: number) => {
    try {
      await fetch("/api/membership/sessions", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      });
      load();
    } catch {}
  };

  const activeSessions = sessions.filter(s => !s.check_out_at);
  const completedSessions = sessions.filter(s => s.check_out_at);

  return (
    <GemPage>
      <GemHeader title="Visit Sessions" subtitle="Member check-in/check-out visit records"
        actions={
          <div className="flex gap-2 items-center">
            <GemInput type="date" value={date} onChange={(e: any) => setDate(e.target.value)} className="w-40" />
            <label className="flex items-center gap-1 text-sm cursor-pointer">
              <input type="checkbox" checked={showActive} onChange={e => setShowActive(e.target.checked)} />
              Active only
            </label>
          </div>
        } />

      {activeSessions.length > 0 && (
        <GemCard className="mb-6">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Timer size={18} />Currently Active ({activeSessions.length})</h3>
          <div className="space-y-2">
            {activeSessions.map(s => {
              const mins = Math.floor((Date.now() - new Date(s.check_in_at).getTime()) / 60000);
              return (
                <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <Link href={`/dashboard/membership/members/${s.member_id}`} className="font-medium text-sm hover:text-blue-600">{s.member_name}</Link>
                    <p className="text-xs text-gray-400">{s.member_code} &middot; {s.facility_name || "General"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <GemBadge variant="success">{mins < 60 ? `${mins}m` : `${Math.floor(mins/60)}h ${mins%60}m`}</GemBadge>
                    <span className="text-xs text-gray-400">{new Date(s.check_in_at).toLocaleTimeString()}</span>
                    <button className="text-red-500 hover:text-red-700 p-1" onClick={() => checkOut(s.id)} title="Check out"><LogOut size={16} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </GemCard>
      )}

      <GemCardBare>
        {loading ? (
          <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-black/20 border-t-black rounded-full animate-spin" /></div>
        ) : sessions.length === 0 ? (
          <div className="text-center text-gray-400 py-8"><Timer size={32} className="mx-auto mb-2 opacity-40" /><p className="text-sm">No sessions for this date</p></div>
        ) : (
          <div className="overflow-x-auto p-6">
            <GemTable
              headers={["Member", "Facility", "Check In", "Check Out", "Duration", "Source"]}
              rows={sessions.map(s => {
                const dur = s.duration_minutes;
                return [
                  <div>
                    <Link href={`/dashboard/membership/members/${s.member_id}`} className="font-semibold text-sm hover:text-blue-600">{s.member_name}</Link>
                    <p className="font-mono text-[10px] text-gray-400">{s.member_code}</p>
                  </div>,
                  s.facility_name || "-",
                  <span className="text-sm">{new Date(s.check_in_at).toLocaleTimeString()}</span>,
                  s.check_out_at ? <span className="text-sm">{new Date(s.check_out_at).toLocaleTimeString()}</span> : <GemBadge variant="success">Active</GemBadge>,
                  dur ? <span className="text-sm">{dur < 60 ? `${dur}m` : `${Math.floor(dur/60)}h ${dur%60}m`}</span> : "-",
                  <GemBadge>{s.source}</GemBadge>,
                ];
              })}
            />
          </div>
        )}
      </GemCardBare>
    </GemPage>
  );
}
