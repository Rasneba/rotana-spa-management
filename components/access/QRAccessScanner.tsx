"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, CheckCircle, QrCode, ScanLine, ShieldCheck, XCircle } from "lucide-react";
import { GemBadge, GemCard, GemHeader, GemInput, GemSelect } from "@/lib/gem-ui";

type Gate = { id: number; name: string; code: string; is_qr_enabled: boolean; status: string };
type VerifyResult = {
  granted: boolean;
  reason: string;
  customer?: { name?: string; member_code?: string };
  pass?: { current_uses: number; max_uses: number; expiry_date: string };
  error?: string;
};
type ScanHistory = VerifyResult & { id: number; scannedAt: string; raw: string };

export default function QRAccessScanner() {
  const [gates, setGates] = useState<Gate[]>([]);
  const [gateId, setGateId] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [autoDoor, setAutoDoor] = useState(true);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [history, setHistory] = useState<ScanHistory[]>([]);
  const [error, setError] = useState("");
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const processingRef = useRef(false);
  const lastCodeRef = useRef({ value: "", at: 0 });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch("/api/membership/gates?status=active", { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((data: unknown) => {
        const list = Array.isArray(data) ? data.filter((gate) => gate.is_qr_enabled !== false) as Gate[] : [];
        setGates(list);
        if (list[0]) setGateId(String(list[0].id));
      })
      .catch(() => setError("Unable to load QR-enabled gates."));
    return () => {
      if (scannerRef.current) void scannerRef.current.stop().catch(() => undefined);
    };
  }, []);

  const verify = useCallback(async (rawCode: string) => {
    const code = rawCode.trim();
    if (!code || processingRef.current) return;
    const now = Date.now();
    if (lastCodeRef.current.value === code && now - lastCodeRef.current.at < 4_000) return;
    lastCodeRef.current = { value: code, at: now };
    processingRef.current = true;
    setProcessing(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const response = await fetch("/api/spa/access/qr-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code, gate_id: gateId ? Number(gateId) : null, access_type: "entry" }),
      });
      const data = await response.json() as VerifyResult;
      if (!response.ok && data.granted === undefined) throw new Error(data.error || "Unable to verify QR pass");
      setResult(data);
      setHistory((current) => [{ ...data, id: now, scannedAt: new Date().toISOString(), raw: code }, ...current].slice(0, 20));
      setManualCode("");

      if (data.granted && autoDoor && gateId) {
        await fetch("/api/spa/access/control", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: "open", gate_id: Number(gateId), reason: "Granted QR access" }),
        });
      }
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "Unable to verify QR pass");
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  }, [autoDoor, gateId]);

  const startScanner = useCallback(async () => {
    if (cameraActive) return;
    setError("");
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("spa-qr-camera");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => void verify(decodedText),
        () => undefined
      );
      setCameraActive(true);
    } catch {
      scannerRef.current = null;
      setCameraActive(false);
      setError("Camera access failed. You can still paste or type the QR token.");
    }
  }, [cameraActive, verify]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
      try { scannerRef.current.clear(); } catch {}
      scannerRef.current = null;
    }
    setCameraActive(false);
  }, []);

  return (
    <div className="access-suite-page">
      <GemHeader title="QR Access" subtitle="Scan and verify Spa/Gym member, guest and kiosk passes"
        actions={<div className="access-dashboard-actions"><button type="button" onClick={cameraActive ? () => void stopScanner() : () => void startScanner()}>{cameraActive ? <CameraOff size={16} /> : <Camera size={16} />}{cameraActive ? "Stop Camera" : "Start Camera"}</button></div>} />
      <div className="access-conversion-note"><QrCode size={18} /><div><strong>Fully converted QR access component</strong><span>The webcam scanner was retained. Parking subscription lookup and vehicle fields were replaced with Spa/Gym QR passes, visits and access logs.</span></div></div>
      {error && <div className="spa-workspace-alert danger">{error}</div>}

      <div className="qr-access-grid">
        <GemCard className="qr-scanner-card">
          <div className="qr-card-heading"><div><ScanLine size={18} /><strong>Pass Scanner</strong></div><GemBadge variant={cameraActive ? "success" : "default"}>{cameraActive ? "Camera Active" : "Manual Ready"}</GemBadge></div>
          <label><span>Access Gate</span><GemSelect value={gateId} onChange={(event) => setGateId(event.target.value)}><option value="">No specific gate</option>{gates.map((gate) => <option key={gate.id} value={gate.id}>{gate.name} ({gate.code})</option>)}</GemSelect></label>
          <div id="spa-qr-camera" className="qr-camera-region" />
          {!cameraActive && <div className="qr-camera-placeholder"><ScanLine size={38} /><p>Start the camera to scan a pass</p></div>}
          <form onSubmit={(event) => { event.preventDefault(); void verify(manualCode); }} className="qr-manual-form"><GemInput value={manualCode} onChange={(event) => setManualCode(event.target.value)} placeholder="Paste QR JSON or pass token" /><button type="submit" disabled={!manualCode.trim() || processing}>{processing ? "Verifying…" : "Verify"}</button></form>
          <label className="qr-auto-door"><input type="checkbox" checked={autoDoor} onChange={(event) => setAutoDoor(event.target.checked)} /><span>Queue door-open command after granted access</span></label>
        </GemCard>

        <GemCard className={`qr-result-card ${result ? result.granted ? "granted" : "denied" : "idle"}`}>
          {!result ? <div className="qr-result-empty"><ShieldCheck size={44} /><h2>Awaiting scan</h2><p>The verification result will appear here.</p></div> : <><span className="qr-result-icon">{result.granted ? <CheckCircle size={38} /> : <XCircle size={38} />}</span><p>{result.granted ? "ACCESS GRANTED" : "ACCESS DENIED"}</p><h2>{result.customer?.name || "Unknown pass"}</h2>{result.customer?.member_code && <code>{result.customer.member_code}</code>}<dl><div><dt>Reason</dt><dd>{result.reason.replace(/_/g, " ")}</dd></div>{result.pass && <><div><dt>Uses</dt><dd>{result.pass.current_uses} / {result.pass.max_uses}</dd></div><div><dt>Expiry</dt><dd>{new Date(result.pass.expiry_date).toLocaleDateString()}</dd></div></>}</dl>{result.granted && autoDoor && gateId && <small>Door command queued for the local relay.</small>}</>}
        </GemCard>
      </div>

      <GemCard className="qr-history-card">
        <div className="qr-card-heading"><div><ActivityIcon /><strong>Recent Scans</strong></div><GemBadge>{history.length}</GemBadge></div>
        {history.length === 0 ? <div className="access-panel-empty">No QR codes scanned in this browser session.</div> : <div className="qr-history-list">{history.map((scan) => <article key={scan.id}><span className={scan.granted ? "granted" : "denied"}>{scan.granted ? <CheckCircle size={16} /> : <XCircle size={16} />}</span><div><strong>{scan.customer?.name || "Unknown"}</strong><small>{new Date(scan.scannedAt).toLocaleTimeString()} · {scan.reason.replace(/_/g, " ")}</small></div><GemBadge variant={scan.granted ? "success" : "danger"}>{scan.granted ? "Granted" : "Denied"}</GemBadge></article>)}</div>}
      </GemCard>
    </div>
  );
}

function ActivityIcon() {
  return <i className="bi bi-activity" aria-hidden="true" />;
}
