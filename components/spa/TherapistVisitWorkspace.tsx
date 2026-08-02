"use client";

import { useCallback, useEffect, useState } from "react";
import { Link } from "@/lib/i18n/navigation";
import ServiceOrderPrint from "@/components/spa/ServiceOrderPrint";
import type { SpaServiceOrder, SpaVisit, VisitService } from "@/lib/spa-service-orders";
import { humanizeStatus } from "@/lib/spa-service-orders";

type GenericRecord = {
  id: number | string;
  title: string;
  status: string;
  details: Record<string, string | number | null>;
};

type DetailResponse = {
  visit: SpaVisit;
  capabilities: { create: boolean; edit: boolean; services: boolean; orders: boolean };
  error?: string;
};

function tone(status: string): string {
  if (["finished", "order_printed", "handed_to_cashier"].includes(status)) return "success";
  if (["checked_in", "assigned"].includes(status)) return "warning";
  if (status === "cancelled") return "danger";
  return "info";
}

export default function TherapistVisitWorkspace({ visitId }: { visitId: string }) {
  const [visit, setVisit] = useState<SpaVisit | null>(null);
  const [therapists, setTherapists] = useState<GenericRecord[]>([]);
  const [catalogue, setCatalogue] = useState<GenericRecord[]>([]);
  const [order, setOrder] = useState<SpaServiceOrder | null>(null);
  const [capabilities, setCapabilities] = useState({ create: false, edit: false, services: false, orders: false });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedTherapist, setSelectedTherapist] = useState("");
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [serviceForm, setServiceForm] = useState({ service_record_id: "", quantity: "1", notes: "" });
  const [notes, setNotes] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const [visitResponse, therapistResponse, serviceResponse] = await Promise.all([
        fetch(`/api/spa/visits?id=${visitId}`, { headers: { Authorization: `Bearer ${token}` }, signal }),
        fetch("/api/spa/spa/therapists?status=active&limit=250", { headers: { Authorization: `Bearer ${token}` }, signal }),
        fetch("/api/spa/spa/services?status=active&limit=250", { headers: { Authorization: `Bearer ${token}` }, signal }),
      ]);
      const visitData = await visitResponse.json() as DetailResponse;
      const therapistData = await therapistResponse.json() as { records?: GenericRecord[] };
      const serviceData = await serviceResponse.json() as { records?: GenericRecord[] };
      if (!visitResponse.ok) throw new Error(visitData.error || "Unable to load visit");
      setVisit(visitData.visit);
      setNotes(visitData.visit.notes || "");
      setSelectedTherapist(visitData.visit.therapist_record_id ? String(visitData.visit.therapist_record_id) : "");
      setCapabilities(visitData.capabilities);
      setTherapists(therapistResponse.ok ? therapistData.records || [] : []);
      setCatalogue(serviceResponse.ok ? serviceData.records || [] : []);

      if (visitData.visit.order_id) {
        const orderResponse = await fetch(`/api/spa/visits/${visitId}/service-order`, {
          headers: { Authorization: `Bearer ${token}` },
          signal,
        });
        if (orderResponse.ok) setOrder(await orderResponse.json() as SpaServiceOrder);
      }
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setError(loadError instanceof Error ? loadError.message : "Unable to load visit");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [visitId]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load]);

  const updateVisit = async (action: string, payload: Record<string, unknown> = {}) => {
    const token = localStorage.getItem("token");
    if (!token) return null;
    setBusy(action);
    setError("");
    try {
      const response = await fetch("/api/spa/visits", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: visitId, action, ...payload }),
      });
      const data = await response.json() as SpaVisit & { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to update visit");
      setVisit((current) => current ? { ...current, ...data } : data);
      return data;
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update visit");
      return null;
    } finally {
      setBusy("");
    }
  };

  const assignTherapist = async () => {
    if (!selectedTherapist) return;
    const updated = await updateVisit("assign", { therapist_record_id: Number(selectedTherapist) });
    if (updated) setNotice("Therapist assigned.");
  };

  const addService = async (event: React.FormEvent) => {
    event.preventDefault();
    const token = localStorage.getItem("token");
    if (!token || !serviceForm.service_record_id) return;
    setBusy("service");
    setError("");
    try {
      const response = await fetch(`/api/spa/visits/${visitId}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          service_record_id: Number(serviceForm.service_record_id),
          quantity: Number(serviceForm.quantity),
          notes: serviceForm.notes,
        }),
      });
      const data = await response.json() as VisitService & { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to add service");
      setShowServiceForm(false);
      setServiceForm({ service_record_id: "", quantity: "1", notes: "" });
      await load();
      setNotice("Service list updated.");
    } catch (serviceError) {
      setError(serviceError instanceof Error ? serviceError.message : "Unable to add service");
    } finally {
      setBusy("");
    }
  };

  const removeService = async (service: VisitService) => {
    if (!window.confirm(`Remove ${service.service_name} from this treatment?`)) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    setBusy(`remove-${service.id}`);
    try {
      const response = await fetch(`/api/spa/visits/${visitId}/services`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: service.id }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to remove service");
      await load();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Unable to remove service");
    } finally {
      setBusy("");
    }
  };

  const serviceOrderAction = async (action: "finish" | "print" | "handoff") => {
    const token = localStorage.getItem("token");
    if (!token) return null;
    setBusy(action);
    setError("");
    try {
      const response = await fetch(`/api/spa/visits/${visitId}/service-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      });
      const data = await response.json() as { order: SpaServiceOrder; visit: SpaVisit; error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to update service order");
      setOrder(data.order);
      setVisit((current) => current ? { ...current, ...data.visit } : data.visit);
      return data.order;
    } catch (orderError) {
      setError(orderError instanceof Error ? orderError.message : "Unable to update service order");
      return null;
    } finally {
      setBusy("");
    }
  };

  const printDraft = async () => {
    const printedOrder = await serviceOrderAction("print");
    if (printedOrder) window.setTimeout(() => window.print(), 80);
  };

  const finishTreatment = async () => {
    if (notes !== (visit?.notes || "")) {
      const savedVisit = await updateVisit("update", { notes });
      if (!savedVisit) return;
    }
    const finishedOrder = await serviceOrderAction("finish");
    if (!finishedOrder) return;
    const printedOrder = await serviceOrderAction("print");
    if (printedOrder) {
      setNotice("Treatment finished. The draft service order is ready to print.");
      window.setTimeout(() => window.print(), 80);
    }
  };

  const services = visit?.services || [];
  const totalItems = services.reduce((sum, service) => sum + Number(service.quantity), 0);
  const treatmentClosed = Boolean(visit && ["finished", "order_printed", "handed_to_cashier", "cancelled"].includes(visit.status));

  if (loading && !visit) return <div className="spa-workspace-state"><span className="spinner-border" /><p>Loading therapist workspace…</p></div>;
  if (!visit) return <div className="spa-workspace-page"><div className="spa-workspace-alert danger">{error || "Visit not found"}</div></div>;

  return (
    <div className="spa-workspace-page therapist-visit-page">
      <header className="therapist-visit-header">
        <div>
          <Link href="/dashboard/spa/operations/visits" className="therapist-back-link"><i className="bi bi-arrow-left" /> Visits</Link>
          <p>Therapist Workspace</p>
          <h1>{visit.visit_no}</h1>
          <span className={`spa-status-pill ${tone(visit.status)}`}>{humanizeStatus(visit.status)}</span>
        </div>
        <div className="therapist-visit-facts">
          <div><span>Customer</span><strong>{visit.customer_name}</strong></div>
          <div><span>Therapist</span><strong>{visit.therapist_name || "Not assigned"}</strong></div>
          <div><span>Checked In</span><strong>{new Date(visit.checked_in_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</strong></div>
        </div>
      </header>

      {error && <div className="spa-workspace-alert danger" role="alert"><i className="bi bi-exclamation-circle" />{error}</div>}
      {notice && <div className="spa-workspace-alert success" role="status"><i className="bi bi-check-circle" />{notice}</div>}

      <div className="therapist-workspace-grid">
        <main className="therapist-treatment-card">
          <section className="therapist-assignment">
            <div><p>Assigned Therapist</p><h2>{visit.therapist_name || "Choose a therapist"}</h2></div>
            {!treatmentClosed && capabilities.edit && <div className="therapist-assignment-controls"><select value={selectedTherapist} onChange={(event) => setSelectedTherapist(event.target.value)}><option value="">Select therapist</option>{therapists.map((therapist) => <option key={therapist.id} value={therapist.id}>{therapist.title}</option>)}</select><button type="button" className="spa-secondary-button" onClick={assignTherapist} disabled={!selectedTherapist || busy === "assign"}>Assign</button></div>}
          </section>

          <section className="therapist-services-section">
            <div className="therapist-section-heading"><div><p>Services Used</p><h2>Treatment services</h2></div><span>{totalItems} item{totalItems === 1 ? "" : "s"}</span></div>
            {services.length === 0 ? <div className="therapist-empty-services"><i className="bi bi-flower2" /><p>No services added yet.</p></div> : (
              <ul className="therapist-service-list">{services.map((service) => <li key={service.id}><i className="bi bi-check-circle-fill" /><div><strong>{service.service_name}</strong>{service.service_code && <span>{service.service_code}</span>}</div><b>× {service.quantity}</b>{!treatmentClosed && capabilities.services && <button type="button" onClick={() => void removeService(service)} disabled={busy === `remove-${service.id}`}><i className="bi bi-trash" /><span>Remove</span></button>}</li>)}</ul>
            )}
            {!treatmentClosed && capabilities.services && <button type="button" className="therapist-add-service" onClick={() => setShowServiceForm(true)} disabled={visit.status !== "in_treatment" || !visit.therapist_record_id} title={visit.status !== "in_treatment" ? "Start treatment before recording services" : "Add service used"}><i className="bi bi-plus-lg" /> Add Service</button>}
          </section>

          <section className="therapist-notes-section">
            <label htmlFor="treatment-notes">Treatment Notes</label>
            <textarea id="treatment-notes" rows={4} value={notes} readOnly={treatmentClosed || !capabilities.edit} onChange={(event) => setNotes(event.target.value)} placeholder="Treatment observations or operational notes" />
            {!treatmentClosed && capabilities.edit && <button type="button" className="spa-secondary-button" onClick={() => void updateVisit("update", { notes })} disabled={busy === "update"}><i className="bi bi-save" /> Save Notes</button>}
          </section>

          <footer className="therapist-treatment-actions">
            {!treatmentClosed && visit.status !== "in_treatment" && capabilities.edit && <button type="button" className="spa-secondary-button" onClick={() => void updateVisit("start")} disabled={!visit.therapist_record_id || busy === "start"}><i className="bi bi-play-fill" /> Start Treatment</button>}
            {!treatmentClosed && capabilities.orders && <button type="button" className="spa-primary-button finish-treatment" onClick={finishTreatment} disabled={visit.status !== "in_treatment" || !visit.therapist_record_id || services.length === 0 || Boolean(busy)}><i className="bi bi-check2-circle" /> Finish Treatment</button>}
            {visit.finished_at && capabilities.orders && <button type="button" className="spa-secondary-button" onClick={printDraft} disabled={Boolean(busy)}><i className="bi bi-printer" /> Print Draft</button>}
            {order && order.print_count > 0 && order.status !== "handed_to_cashier" && visit.finished_at && capabilities.orders && <button type="button" className="spa-secondary-button" onClick={() => void serviceOrderAction("handoff")} disabled={Boolean(busy)}><i className="bi bi-box-arrow-right" /> Handed to Cashier</button>}
          </footer>
        </main>

        <aside className="therapist-handoff-card">
          <span className="handoff-icon"><i className="bi bi-receipt-cutoff" /></span>
          <p>Cashier Handoff</p>
          <h2>Draft only—never a receipt</h2>
          <ul><li>No prices</li><li>No tax or discounts</li><li>No payment collection</li><li>No POS database connection</li></ul>
          <p className="handoff-note">The customer takes the printed service order to the separate Sales/POS cashier.</p>
          <div className="therapist-related-links">
            <Link href="/dashboard/spa/operations/service-orders">View Service Orders <i className="bi bi-arrow-right" /></Link>
            <Link href="/dashboard/spa/inventory/stock-usage">Record Inventory Usage <i className="bi bi-arrow-right" /></Link>
            <Link href="/dashboard/spa/operations/towel-management">Towel Management <i className="bi bi-arrow-right" /></Link>
          </div>
        </aside>
      </div>

      {order && <section className="service-order-preview"><div className="therapist-section-heading"><div><p>80 mm Draft Preview</p><h2>Service Order</h2></div><span>Printed {order.print_count}×</span></div><ServiceOrderPrint order={order} /></section>}

      {showServiceForm && (
        <div className="spa-form-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setShowServiceForm(false); }}>
          <section className="spa-record-modal therapist-service-modal" role="dialog" aria-modal="true" aria-labelledby="add-service-title">
            <header><div><p>{visit.visit_no}</p><h2 id="add-service-title">Add Service Used</h2></div><button type="button" onClick={() => setShowServiceForm(false)} aria-label="Close"><i className="bi bi-x-lg" /></button></header>
            <form onSubmit={addService}>
              <div className="spa-record-form-grid">
                <label className="span-two"><span>Service *</span><select required value={serviceForm.service_record_id} onChange={(event) => setServiceForm((current) => ({ ...current, service_record_id: event.target.value }))}><option value="">Select service</option>{catalogue.map((service) => <option key={service.id} value={service.id}>{service.details.service_code ? `${service.details.service_code} · ` : ""}{service.title}</option>)}</select></label>
                <label><span>Quantity *</span><input type="number" min="1" max="99" required value={serviceForm.quantity} onChange={(event) => setServiceForm((current) => ({ ...current, quantity: event.target.value }))} /></label>
                <label><span>Line Note</span><input value={serviceForm.notes} onChange={(event) => setServiceForm((current) => ({ ...current, notes: event.target.value }))} /></label>
              </div>
              <footer><button type="button" className="spa-secondary-button" onClick={() => setShowServiceForm(false)}>Cancel</button><button type="submit" className="spa-primary-button" disabled={busy === "service"}>{busy === "service" ? "Adding…" : "Add Service"}</button></footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
