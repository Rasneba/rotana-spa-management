"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { GemPage, GemHeader, GemCard, GemCardBare, GemTable, GemBadge, GemInput, GemSelect } from "@/lib/gem-ui";
import { History, Shield, User } from "lucide-react";

export default function AccessLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/membership/access-logs?date=${date}&limit=200`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.rows) { setLogs(data.rows); setTotal(data.total); }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [date]);

  return (
    <GemPage>
      <GemHeader title="Access Logs" subtitle="Entry and exit records"
        actions={
          <GemInput type="date" value={date} onChange={(e: any) => setDate(e.target.value)} className="w-44" />
        } />

      <GemCardBare>
        {loading ? (
          <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-black/20 border-t-black rounded-full animate-spin" /></div>
        ) : logs.length === 0 ? (
          <div className="text-center text-gray-400 py-8"><History size={32} className="mx-auto mb-2 opacity-40" /><p className="text-sm">No access logs for this date</p></div>
        ) : (
          <div className="p-6">
            <p className="text-sm text-gray-400 mb-3">{total} records for {new Date(date).toLocaleDateString()}</p>
            <div className="overflow-x-auto">
              <GemTable
                headers={["Time", "Member", "Gate", "Type", "Method", "Status"]}
                rows={logs.map(l => [
                  <span className="text-sm">{new Date(l.created_at).toLocaleTimeString()}</span>,
                  l.member_name ? <Link href={`/dashboard/membership/members/${l.member_id}`} className="hover:text-blue-600 text-sm font-medium">{l.member_name}</Link> : <span className="text-sm text-gray-400">-</span>,
                  l.gate_name || "-",
                  l.access_type === "entry" ? <GemBadge variant="success">Entry</GemBadge> : <GemBadge variant="warning">Exit</GemBadge>,
                  <GemBadge>{l.method}</GemBadge>,
                  l.status === "granted" ? <GemBadge variant="success">Granted</GemBadge> : <GemBadge variant="danger">Denied</GemBadge>,
                ])}
              />
            </div>
          </div>
        )}
      </GemCardBare>
    </GemPage>
  );
}
