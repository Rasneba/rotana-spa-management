"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/i18n/navigation";
import { CheckCircle, Monitor, Printer, QrCode, RotateCcw, User, UserPlus } from "lucide-react";
import { GemAlert, GemBadge, GemCard, GemInput, GemSelect } from "@/lib/gem-ui";

type Member = { id: number; customer_id?: string; full_name: string; phone?: string };
type Option = { id: number; name: string; code?: string; status?: string; is_active?: boolean };
type KioskResult = {
  visit: { id: number | string; visit_no: string; checked_in_at: string };
  pass: { id: number; token: string; expiry_date: string; qr_data_url: string; max_uses: number };
  customer: { full_name: string; phone?: string };
};

export default function CheckInKioskWorkspace() {
  const [members, setMembers] = useState<Member[]>([]);
  const [areas, setAreas] = useState<Option[]>([]);
  const [gates, setGates] = useState<Option[]>([]);
  const [mode, setMode] = useState<"member" | "walkin">("member");
  const [search, setSearch] = useState("");
  const [memberId, setMemberId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [areaId, setAreaId] = useState("");
  const [gateId, setGateId] = useState("");
  const [purpose, setPurpose] = useState("Spa/Gym visit");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<KioskResult | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    Promise.all([
      fetch("/api/membership/members", { headers: { Authorization: `Bearer ${token}` } }).then((response) => response.json()),
      fetch("/api/membership/facilities", { headers: { Authorization: `Bearer ${token}` } }).then((response) => response.json()),
      fetch("/api/membership/gates?status=active", { headers: { Authorization: `Bearer ${token}` } }).then((response) => response.json()),
    ]).then(([memberData, areaData, gateData]) => {
      setMembers(Array.isArray(memberData) ? memberData : []);
      setAreas(Array.isArray(areaData) ? areaData.filter((area) => area.is_active !== false) : []);
      setGates(Array.isArray(gateData) ? gateData.filter((gate) => gate.status === "active") : []);
    }).catch(() => setError("Unable to load kiosk choices."));
  }, []);

  const filteredMembers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return members.slice(0, 30);
    return members.filter((member) => [member.full_name, member.phone, member.customer_id].some((value) => String(value || "").toLowerCase().includes(term))).slice(0, 30);
  }, [members, search]);

  const checkIn = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    if (mode === "member" && !memberId) return setError("Select a member.");
    if (mode === "walkin" && !name.trim()) return setError("Enter the walk-in customer name.");
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/spa/access/kiosk", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          member_id: mode === "member" ? Number(memberId) : null,
          customer_name: mode === "walkin" ? name.trim() : null,
          customer_phone: mode === "walkin" ? phone.trim() : null,
          facility_id: areaId ? Number(areaId) : null,
          gate_id: gateId ? Number(gateId) : null,
          purpose,
        }),
      });
      const data = await response.json() as KioskResult & { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to complete check-in");
      setResult(data);
    } catch (checkInError) {
      setError(checkInError instanceof Error ? checkInError.message : "Unable to complete check-in");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setMode("member");
    setSearch("");
    setMemberId("");
    setName("");
    setPhone("");
    setPurpose("Spa/Gym visit");
    setError("");
  };

  if (result) {
    return (
      <div className="access-suite-page access-kiosk-success">
        <div className="kiosk-success-actions"><button type="button" onClick={() => window.print()}><Printer size={16} />Print Pass</button><button type="button" onClick={reset}><RotateCcw size={16} />New Check-In</button><Link href={`/dashboard/spa/operations/visits/${result.visit.id}`}>Open Visit <i className="bi bi-arrow-right" /></Link></div>
        <article id="spa-kiosk-pass" className="kiosk-pass-card">
          <CheckCircle size={42} />
          <GemBadge variant="success">CHECKED IN</GemBadge>
          <h1>{result.customer.full_name}</h1>
          {result.customer.phone && <p>{result.customer.phone}</p>}
          <Image src={result.pass.qr_data_url} alt="Spa and Gym QR access pass" width={260} height={260} unoptimized />
          <strong>{result.visit.visit_no}</strong>
          <span>Show this QR at the Spa/Gym access point</span>
          <dl><div><dt>Check-In</dt><dd>{new Date(result.visit.checked_in_at).toLocaleString()}</dd></div><div><dt>Valid Until</dt><dd>{new Date(result.pass.expiry_date).toLocaleDateString()}</dd></div><div><dt>Maximum Scans</dt><dd>{result.pass.max_uses}</dd></div></dl>
          <footer>DAGI SPA · ACCESS PASS</footer>
        </article>
      </div>
    );
  }

  return (
    <div className="access-suite-page access-kiosk-page">
      <div className="kiosk-heading"><span><Monitor size={30} /></span><p>Converted Kiosk Component</p><h1>Spa &amp; Gym Check-In</h1><small>Creates an operational visit and a 24-hour QR access pass. No parking or payment records.</small></div>
      {error && <GemAlert type="danger" onClose={() => setError("")}>{error}</GemAlert>}
      <GemCard className="kiosk-form-card">
        <div className="kiosk-mode-switch"><button type="button" className={mode === "member" ? "active" : ""} onClick={() => setMode("member")}><User size={16} />Registered Member</button><button type="button" className={mode === "walkin" ? "active" : ""} onClick={() => setMode("walkin")}><UserPlus size={16} />Walk-In Guest</button></div>
        {mode === "member" ? (
          <div className="kiosk-member-picker"><label>Search Member</label><GemInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, phone or member code" /><div>{filteredMembers.map((member) => <button type="button" key={member.id} className={memberId === String(member.id) ? "selected" : ""} onClick={() => { setMemberId(String(member.id)); setSearch(member.full_name); }}><span><strong>{member.full_name}</strong><small>{member.customer_id || `Member ${member.id}`}</small></span><em>{member.phone || ""}</em></button>)}</div></div>
        ) : (
          <div className="kiosk-fields two"><label><span>Guest Name *</span><GemInput value={name} onChange={(event) => setName(event.target.value)} /></label><label><span>Phone</span><GemInput type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></label></div>
        )}
        <div className="kiosk-fields two"><label><span>Spa/Gym Area</span><GemSelect value={areaId} onChange={(event) => setAreaId(event.target.value)}><option value="">Any area</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</GemSelect></label><label><span>Access Gate</span><GemSelect value={gateId} onChange={(event) => setGateId(event.target.value)}><option value="">Any active gate</option>{gates.map((gate) => <option key={gate.id} value={gate.id}>{gate.name}</option>)}</GemSelect></label></div>
        <label className="kiosk-purpose"><span>Visit Purpose</span><GemInput value={purpose} onChange={(event) => setPurpose(event.target.value)} /></label>
        <button type="button" className="kiosk-submit" onClick={() => void checkIn()} disabled={loading || (mode === "member" ? !memberId : !name.trim())}><QrCode size={20} />{loading ? "Checking in…" : "Check In & Generate QR"}</button>
      </GemCard>
    </div>
  );
}
