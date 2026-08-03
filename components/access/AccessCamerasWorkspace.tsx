"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Eye, Laptop, Plus, Save, Square, X } from "lucide-react";
import { GemBadge, GemCard, GemCardBare, GemBtn, GemBtnOutline, GemHeader, GemInput, GemSelect, GemTable } from "@/lib/gem-ui";

type CameraRecord = {
  id: number;
  name: string;
  code: string;
  gate_id?: number;
  gate_name?: string;
  facility_id?: number;
  facility_name?: string;
  purpose: string;
  direction: string;
  protocol: string;
  ip_address?: string;
  port?: number;
  stream_url?: string;
  device_id?: string;
  status: string;
  notes?: string;
};
type OptionRecord = { id: number; name: string; code?: string };
type CameraResponse = { cameras: CameraRecord[]; capabilities: { create: boolean; edit: boolean; delete: boolean }; error?: string };

const emptyForm = {
  name: "",
  code: "",
  gate_id: "",
  facility_id: "",
  purpose: "security",
  direction: "both",
  protocol: "http",
  ip_address: "",
  port: "80",
  stream_url: "",
  device_id: "",
  status: "active",
  notes: "",
};

export default function AccessCamerasWorkspace() {
  const [cameras, setCameras] = useState<CameraRecord[]>([]);
  const [gates, setGates] = useState<OptionRecord[]>([]);
  const [facilities, setFacilities] = useState<OptionRecord[]>([]);
  const [capabilities, setCapabilities] = useState({ create: false, edit: false, delete: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CameraRecord | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [webcams, setWebcams] = useState<MediaDeviceInfo[]>([]);
  const [previewing, setPreviewing] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);

  const load = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoading(true);
    try {
      const [cameraResponse, gateResponse, facilityResponse] = await Promise.all([
        fetch("/api/spa/access/cameras", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/membership/gates", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/membership/facilities", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const cameraData = await cameraResponse.json() as CameraResponse;
      const gateData = await gateResponse.json();
      const facilityData = await facilityResponse.json();
      if (!cameraResponse.ok) throw new Error(cameraData.error || "Unable to load cameras");
      setCameras(cameraData.cameras || []);
      setCapabilities(cameraData.capabilities || { create: false, edit: false, delete: false });
      setGates(Array.isArray(gateData) ? gateData : []);
      setFacilities(Array.isArray(facilityData) ? facilityData : []);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load cameras");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(timer);
      previewStreamRef.current?.getTracks().forEach((track) => track.stop());
      previewStreamRef.current = null;
    };
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (camera: CameraRecord) => {
    setEditing(camera);
    setForm({
      name: camera.name,
      code: camera.code,
      gate_id: camera.gate_id ? String(camera.gate_id) : "",
      facility_id: camera.facility_id ? String(camera.facility_id) : "",
      purpose: camera.purpose,
      direction: camera.direction,
      protocol: camera.protocol,
      ip_address: camera.ip_address || "",
      port: camera.port ? String(camera.port) : "",
      stream_url: camera.stream_url || "",
      device_id: camera.device_id || "",
      status: camera.status,
      notes: camera.notes || "",
    });
    setShowForm(true);
  };

  const detectWebcams = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      const devices = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "videoinput");
      setWebcams(devices);
      if (devices[0]) {
        setEditing(null);
        setForm({ ...emptyForm, name: devices[0].label || "Spa Check-In Webcam", code: `CAM-${cameras.length + 1}`, protocol: "webcam", purpose: "check_in", device_id: devices[0].deviceId, port: "" });
        setShowForm(true);
      }
    } catch {
      setError("Camera access was denied or no webcam is available.");
    }
  };

  const previewWebcam = async (deviceId: string) => {
    try {
      previewStreamRef.current?.getTracks().forEach((track) => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId } } });
      previewStreamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setPreviewing(deviceId);
    } catch {
      setError("Unable to preview this webcam.");
    }
  };

  const stopPreview = () => {
    previewStreamRef.current?.getTracks().forEach((track) => track.stop());
    previewStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setPreviewing("");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/spa/access/cameras", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, id: editing?.id, gate_id: form.gate_id ? Number(form.gate_id) : null, facility_id: form.facility_id ? Number(form.facility_id) : null, port: form.port ? Number(form.port) : null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save camera");
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save camera");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (camera: CameraRecord, status: string) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const response = await fetch("/api/spa/access/cameras", { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: camera.id, status }) });
    if (response.ok) await load();
  };

  const remove = async (camera: CameraRecord) => {
    if (!window.confirm(`Delete ${camera.name}?`)) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    const response = await fetch("/api/spa/access/cameras", { method: "DELETE", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: camera.id }) });
    const data = await response.json();
    if (!response.ok) setError(data.error || "Unable to delete camera");
    else await load();
  };

  return (
    <div className="access-suite-page">
      <GemHeader title="Cameras" subtitle="Spa/Gym security, occupancy and check-in cameras"
        actions={<div className="access-dashboard-actions"><button type="button" onClick={() => void detectWebcams()}><Laptop size={16} />Use Webcam</button>{capabilities.create && <button type="button" className="primary" onClick={openNew}><Plus size={16} />Add Camera</button>}</div>} />
      <div className="access-conversion-note"><Camera size={18} /><div><strong>Fully converted camera component</strong><span>Webcam detection and network-stream configuration were retained. ANPR, plate confidence and vehicle fields were removed.</span></div></div>
      {error && <div className="spa-workspace-alert danger">{error}</div>}

      {showForm && (
        <GemCard className="mb-6">
          <div className="access-inline-form-heading"><h2><Camera size={18} />{editing ? "Edit" : "Register"} Camera</h2><button type="button" onClick={() => setShowForm(false)}><X size={16} /></button></div>
          <form onSubmit={submit} className="access-form-grid">
            <label><span>Name *</span><GemInput required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
            <label><span>Code *</span><GemInput required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} /></label>
            <label><span>Gate</span><GemSelect value={form.gate_id} onChange={(event) => setForm({ ...form, gate_id: event.target.value })}><option value="">No gate</option>{gates.map((gate) => <option key={gate.id} value={gate.id}>{gate.name}</option>)}</GemSelect></label>
            <label><span>Area / Facility</span><GemSelect value={form.facility_id} onChange={(event) => setForm({ ...form, facility_id: event.target.value })}><option value="">No area</option>{facilities.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}</GemSelect></label>
            <label><span>Purpose</span><GemSelect value={form.purpose} onChange={(event) => setForm({ ...form, purpose: event.target.value })}><option value="security">Security</option><option value="occupancy">Occupancy</option><option value="check_in">Check-In</option><option value="safety">Safety</option><option value="other">Other</option></GemSelect></label>
            <label><span>Direction</span><GemSelect value={form.direction} onChange={(event) => setForm({ ...form, direction: event.target.value })}><option value="in">In</option><option value="out">Out</option><option value="both">Both</option></GemSelect></label>
            <label><span>Protocol</span><GemSelect value={form.protocol} onChange={(event) => setForm({ ...form, protocol: event.target.value })}><option value="http">HTTP</option><option value="rtsp">RTSP</option><option value="onvif">ONVIF</option><option value="webcam">Webcam</option></GemSelect></label>
            <label><span>Status</span><GemSelect value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option><option value="offline">Offline</option><option value="maintenance">Maintenance</option></GemSelect></label>
            {form.protocol !== "webcam" ? <><label><span>IP Address *</span><GemInput required value={form.ip_address} onChange={(event) => setForm({ ...form, ip_address: event.target.value })} /></label><label><span>Port</span><GemInput type="number" value={form.port} onChange={(event) => setForm({ ...form, port: event.target.value })} /></label><label className="span-two"><span>Stream URL</span><GemInput value={form.stream_url} onChange={(event) => setForm({ ...form, stream_url: event.target.value })} placeholder="rtsp:// or http://" /></label></> : <label className="span-two"><span>Webcam Device</span><GemSelect value={form.device_id} onChange={(event) => setForm({ ...form, device_id: event.target.value })}><option value="">Browser default camera</option>{webcams.map((camera, index) => <option key={camera.deviceId} value={camera.deviceId}>{camera.label || `Camera ${index + 1}`}</option>)}</GemSelect></label>}
            <label className="span-two"><span>Notes</span><textarea rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
            <div className="span-two access-form-actions"><GemBtnOutline onClick={() => setShowForm(false)}>Cancel</GemBtnOutline><GemBtn type="submit" disabled={saving}><Save size={16} />{saving ? "Saving…" : "Save Camera"}</GemBtn></div>
          </form>
        </GemCard>
      )}

      {webcams.length > 0 && (
        <GemCard className="mb-6">
          <div className="access-webcam-heading"><div><Laptop size={18} /><strong>Detected Webcams</strong></div><GemBadge variant="info">{webcams.length} found</GemBadge></div>
          <div className="access-webcam-list">{webcams.map((camera, index) => <button type="button" key={camera.deviceId} onClick={() => void previewWebcam(camera.deviceId)}><span>{camera.label || `Camera ${index + 1}`}</span><Eye size={14} /></button>)}</div>
          {previewing && <div className="access-camera-preview"><video ref={videoRef} autoPlay playsInline /><button type="button" onClick={stopPreview}><Square size={14} />Stop Preview</button></div>}
        </GemCard>
      )}

      <GemCardBare>
        {loading ? <div className="spa-workspace-state"><span className="spinner-border" /></div> : cameras.length === 0 ? <div className="spa-workspace-state"><Camera size={32} /><p>No access cameras configured.</p></div> : (
          <div className="overflow-x-auto p-5"><GemTable headers={["Code", "Camera", "Gate / Area", "Source", "Purpose", "Direction", "Status", "Actions"]} rows={cameras.map((camera) => [
            <span key="code" className="font-mono font-bold">{camera.code}</span>,
            <strong key="name">{camera.name}</strong>,
            <div key="location"><span>{camera.gate_name || "No gate"}</span><small className="spa-cell-subtitle">{camera.facility_name || "No area"}</small></div>,
            camera.protocol === "webcam" ? <GemBadge key="source" variant="info">Webcam</GemBadge> : <span key="source" className="text-sm">{camera.ip_address}{camera.port ? `:${camera.port}` : ""}</span>,
            <GemBadge key="purpose">{camera.purpose.replace("_", " ")}</GemBadge>,
            <GemBadge key="direction" variant="info">{camera.direction}</GemBadge>,
            capabilities.edit ? <GemSelect key="status" value={camera.status} onChange={(event) => void changeStatus(camera, event.target.value)} className="w-32"><option value="active">Active</option><option value="inactive">Inactive</option><option value="offline">Offline</option><option value="maintenance">Maintenance</option></GemSelect> : <GemBadge key="status">{camera.status}</GemBadge>,
            <div key="actions" className="spa-row-actions">{capabilities.edit && <button type="button" onClick={() => openEdit(camera)}><i className="bi bi-pencil" /></button>}{capabilities.delete && <button type="button" className="danger" onClick={() => void remove(camera)}><i className="bi bi-trash" /></button>}</div>,
          ])} /></div>
        )}
      </GemCardBare>
    </div>
  );
}
