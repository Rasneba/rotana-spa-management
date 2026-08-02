"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/i18n/navigation";
import ServiceOrderPrint from "@/components/spa/ServiceOrderPrint";
import type { SpaServiceOrder, SpaVisit, VisitService } from "@/lib/spa-service-orders";
import { humanizeStatus } from "@/lib/spa-service-orders";

type OfferingRecord = {
  id: number | string;
  title: string;
  status: string;
  details: {
    offering_code?: string | null;
    classification?: string | null;
    category?: string | null;
    duration_minutes?: string | number | null;
  };
};

type TherapistRecord = { id: number | string; title: string };
type DetailResponse = {
  visit: SpaVisit;
  capabilities: { create: boolean; edit: boolean; services: boolean; orders: boolean };
  error?: string;
};

const CLASSIFICATIONS = [
  { value: "", label: "All" },
  { value: "spa_service", label: "Spa" },
  { value: "gym_service", label: "Gym" },
  { value: "package", label: "Packages" },
];

function tone(status: string): string {
  if (["finished", "order_printed", "handed_to_cashier"].includes(status)) return "success";
  if (["checked_in", "assigned"].includes(status)) return "warning";
  if (status === "cancelled") return "danger";
  return "info";
}

function offeringIcon(classification?: string | null): string {
  if (classification === "gym_service") return "bi-heart-pulse";
  if (classification === "package") return "bi-gift";
  return "bi-flower2";
}

export default function TherapistVisitWorkspace({ visitId }: { visitId: string }) {
  const [visit, setVisit] = useState<SpaVisit | null>(null);
  const [therapists, setTherapists] = useState<TherapistRecord[]>([]);
  const [catalogue, setCatalogue] = useState<OfferingRecord[]>([]);
  const [order, setOrder] = useState<SpaServiceOrder | null>(null);
  const [capabilities, setCapabilities] = useState({ create: false, edit: false, services: false, orders: false });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedTherapist, setSelectedTherapist] = useState("");
  const [notes, setNotes] = useState("");
  const [catalogueSearch, setCatalogueSearch] = useState("");
  const [classification, setClassification] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const [visitResponse, therapistResponse, offeringResponse] = await Promise.all([
        fetch(`/api/spa/visits?id=${visitId}`, { headers: { Authorization: `Bearer ${token}` }, signal }),
        fetch("/api/spa/spa/therapists?status=active&limit=250", { headers: { Authorization: `Bearer ${token}` }, signal }),
        fetch("/api/spa/catalog/offerings?status=active&limit=250", { headers: { Authorization: `Bearer ${token}` }, signal }),
      ]);
      const visitData = await visitResponse.json() as DetailResponse;
      const therapistData = await therapistResponse.json() as { records?: TherapistRecord[] };
      const offeringData = await offeringResponse.json() as { records?: OfferingRecord[] };
      if (!visitResponse.ok) throw new Error(visitData.error || "Unable to load visit");
      setVisit(visitData.visit);
      setNotes(visitData.visit.notes || "");
      setSelectedTherapist(visitData.visit.therapist_record_id ? String(visitData.visit.therapist_record_id) : "");
      setCapabilities(visitData.capabilities);
      setTherapists(therapistResponse.ok ? therapistData.records || [] : []);
      setCatalogue(offeringResponse.ok
        ? (offeringData.records || []).filter((record) => ["spa_service", "gym_service", "package"].includes(String(record.details?.classification)))
        : []);

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
    if (updated) setNotice("Therapist assigned. Start the treatment to order services.");
  };

  const saveService = async (offering: OfferingRecord, quantity: number) => {
    const token = localStorage.getItem("token");
    if (!token || quantity < 1) return;
    setBusy(`offering-${offering.id}`);
    setError("");
    try {
      const response = await fetch(`/api/spa/visits/${visitId}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ offering_id: Number(offering.id), quantity }),
      });
      const line = await response.json() as VisitService & { error?: string };
      if (!response.ok) throw new Error(line.error || "Unable to update service");
      setVisit((current) => {
        if (!current) return current;
        const existing = current.services || [];
        const found = existing.some((item) => String(item.id) === String(line.id));
        return { ...current, services: found ? existing.map((item) => String(item.id) === String(line.id) ? line : item) : [...existing, line] };
      });
    } catch (serviceError) {
      setError(serviceError instanceof Error ? serviceError.message : "Unable to update service");
    } finally {
      setBusy("");
    }
  };

  const removeService = async (service: VisitService) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setBusy(`line-${service.id}`);
    setError("");
    try {
      const response = await fetch(`/api/spa/visits/${visitId}/services`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: service.id }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to remove service");
      setVisit((current) => current ? { ...current, services: (current.services || []).filter((item) => String(item.id) !== String(service.id)) } : current);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Unable to remove service");
    } finally {
      setBusy("");
    }
  };

  const changeQuantity = async (service: VisitService, nextQuantity: number) => {
    if (nextQuantity <= 0) return removeService(service);
    const offeringId = service.offering_id || service.service_record_id;
    const offering = catalogue.find((item) => String(item.id) === String(offeringId)) || {
      id: offeringId,
      title: service.service_name,
      status: "active",
      details: { offering_code: service.service_code },
    };
    await saveService(offering, nextQuantity);
  };

  const addOffering = async (offering: OfferingRecord) => {
    if (visit?.status !== "in_treatment") return;
    const existing = (visit.services || []).find((service) => String(service.offering_id || service.service_record_id) === String(offering.id));
    await saveService(offering, Number(existing?.quantity || 0) + 1);
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
      setNotice("Treatment finished. Draft service order is ready.");
      window.setTimeout(() => window.print(), 80);
    }
  };

  const services = visit?.services || [];
  const totalItems = services.reduce((sum, service) => sum + Number(service.quantity), 0);
  const treatmentClosed = Boolean(visit && ["finished", "order_printed", "handed_to_cashier", "cancelled"].includes(visit.status));
  const filteredCatalogue = useMemo(() => {
    const term = catalogueSearch.trim().toLowerCase();
    return catalogue.filter((item) => {
      const matchesClass = !classification || item.details.classification === classification;
      const matchesSearch = !term || [item.title, item.details.offering_code, item.details.category].some((value) => String(value || "").toLowerCase().includes(term));
      return matchesClass && matchesSearch;
    });
  }, [catalogue, catalogueSearch, classification]);

  if (loading && !visit) return <div className="touch-order-loading"><span className="spinner-border" /><p>Opening visit…</p></div>;
  if (!visit) return <div className="spa-workspace-page"><div className="spa-workspace-alert danger">{error || "Visit not found"}</div></div>;

  return (
    <div className="touch-order-page">
      <header className="touch-order-topbar">
        <Link href="/dashboard/spa/operations/visits" className="touch-back-button" aria-label="Back to visits"><i className="bi bi-chevron-left" /></Link>
        <div className="touch-visit-identity"><span>{visit.visit_no}</span><strong>{visit.customer_name}</strong>{visit.customer_phone && <small>{visit.customer_phone}</small>}</div>
        <div className="touch-visit-meta"><span className={`spa-status-pill ${tone(visit.status)}`}>{humanizeStatus(visit.status)}</span><div><small>Therapist</small><strong>{visit.therapist_name || "Not assigned"}</strong></div><div><small>Check-in</small><strong>{new Date(visit.checked_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong></div></div>
      </header>

      {error && <div className="touch-order-message danger"><i className="bi bi-exclamation-circle" />{error}<button type="button" onClick={() => setError("")}><i className="bi bi-x" /></button></div>}
      {notice && <div className="touch-order-message success"><i className="bi bi-check-circle" />{notice}<button type="button" onClick={() => setNotice("")}><i className="bi bi-x" /></button></div>}

      <section className="touch-workflow-strip">
        <div className={`touch-workflow-step ${visit.therapist_record_id ? "done" : "active"}`}><b>1</b><span>Assign</span></div>
        <i />
        <div className={`touch-workflow-step ${visit.status === "in_treatment" ? "active" : visit.treatment_started_at ? "done" : ""}`}><b>2</b><span>Treat</span></div>
        <i />
        <div className={`touch-workflow-step ${treatmentClosed ? "done" : ""}`}><b>3</b><span>Finish</span></div>
        {!treatmentClosed && capabilities.edit && (
          <div className="touch-therapist-picker">
            <select value={selectedTherapist} onChange={(event) => setSelectedTherapist(event.target.value)} aria-label="Select therapist"><option value="">Select therapist</option>{therapists.map((therapist) => <option key={therapist.id} value={therapist.id}>{therapist.title}</option>)}</select>
            <button type="button" onClick={() => void assignTherapist()} disabled={!selectedTherapist || busy === "assign"}>{visit.therapist_record_id ? "Change" : "Assign"}</button>
          </div>
        )}
      </section>

      <div className="touch-order-layout">
        <main className="touch-catalog-panel">
          <div className="touch-catalog-toolbar">
            <label><i className="bi bi-search" /><input value={catalogueSearch} onChange={(event) => setCatalogueSearch(event.target.value)} placeholder="Search services…" /></label>
            <div className="touch-category-tabs">{CLASSIFICATIONS.map((item) => <button key={item.value || "all"} type="button" className={classification === item.value ? "active" : ""} onClick={() => setClassification(item.value)}>{item.label}</button>)}</div>
          </div>

          {visit.status !== "in_treatment" && !treatmentClosed && (
            <div className="touch-catalog-gate">
              <i className="bi bi-hand-index-thumb" />
              <h2>{visit.therapist_record_id ? "Start treatment to add services" : "Assign a therapist first"}</h2>
              <p>Service tiles become active after treatment starts.</p>
              {visit.therapist_record_id && <button type="button" onClick={() => void updateVisit("start")} disabled={busy === "start"}><i className="bi bi-play-fill" /> Start Treatment</button>}
            </div>
          )}

          <div className="touch-service-grid">
            {filteredCatalogue.map((offering) => {
              const cartLine = services.find((service) => String(service.offering_id || service.service_record_id) === String(offering.id));
              return (
                <button
                  type="button"
                  key={offering.id}
                  className={`touch-service-tile category-${offering.details.classification || "service"} ${cartLine ? "selected" : ""}`}
                  onClick={() => void addOffering(offering)}
                  disabled={visit.status !== "in_treatment" || Boolean(busy)}
                >
                  <span className="touch-service-icon"><i className={`bi ${offeringIcon(offering.details.classification)}`} /></span>
                  <div><h3>{offering.title}</h3><p>{offering.details.category || offering.details.classification?.replace("_", " ")}</p>{offering.details.duration_minutes && <small><i className="bi bi-clock" /> {offering.details.duration_minutes} min</small>}</div>
                  {offering.details.offering_code && <code>{offering.details.offering_code}</code>}
                  {cartLine && <b className="touch-tile-quantity">{cartLine.quantity}</b>}
                  {busy === `offering-${offering.id}` && <span className="touch-tile-loading"><span className="spinner-border spinner-border-sm" /></span>}
                </button>
              );
            })}
            {filteredCatalogue.length === 0 && <div className="touch-catalog-empty"><i className="bi bi-search" /><p>No matching offerings.</p><Link href="/dashboard/spa/catalog/offerings">Open Offering Master</Link></div>}
          </div>
        </main>

        <aside className="touch-cart-panel">
          <div className="touch-cart-header"><div><span>Current Visit</span><h2>Services Used</h2></div><b>{totalItems}</b></div>
          <div className="touch-cart-lines">
            {services.length === 0 ? (
              <div className="touch-cart-empty"><i className="bi bi-basket2" /><h3>No services yet</h3><p>Tap a service tile to add it.</p></div>
            ) : services.map((service) => (
              <article key={service.id} className="touch-cart-line">
                <div className="touch-line-name"><strong>{service.service_name}</strong><small>{service.service_code || "Service"}</small></div>
                <div className="touch-quantity-control">
                  <button type="button" onClick={() => void changeQuantity(service, Number(service.quantity) - 1)} disabled={treatmentClosed || Boolean(busy)} aria-label={`Decrease ${service.service_name}`}><i className="bi bi-dash" /></button>
                  <b>{service.quantity}</b>
                  <button type="button" onClick={() => void changeQuantity(service, Number(service.quantity) + 1)} disabled={treatmentClosed || Boolean(busy)} aria-label={`Increase ${service.service_name}`}><i className="bi bi-plus" /></button>
                </div>
                <button type="button" className="touch-line-remove" onClick={() => void removeService(service)} disabled={treatmentClosed || Boolean(busy)} aria-label={`Remove ${service.service_name}`}><i className="bi bi-trash3" /></button>
              </article>
            ))}
          </div>

          <div className="touch-cart-notes">
            <label htmlFor="touch-treatment-notes"><i className="bi bi-pencil-square" /> Visit Notes</label>
            <textarea id="touch-treatment-notes" rows={2} value={notes} readOnly={treatmentClosed || !capabilities.edit} onChange={(event) => setNotes(event.target.value)} placeholder="Optional notes…" />
            {!treatmentClosed && capabilities.edit && <button type="button" onClick={() => void updateVisit("update", { notes })} disabled={busy === "update"}>Save notes</button>}
          </div>

          <div className="touch-cart-summary"><span>Total service items</span><strong>{totalItems}</strong></div>
          <div className="touch-cart-actions">
            {!treatmentClosed && visit.status !== "in_treatment" && capabilities.edit && <button type="button" className="start" onClick={() => void updateVisit("start")} disabled={!visit.therapist_record_id || busy === "start"}><i className="bi bi-play-fill" /> Start Treatment</button>}
            {!treatmentClosed && capabilities.orders && <button type="button" className="finish" onClick={() => void finishTreatment()} disabled={visit.status !== "in_treatment" || services.length === 0 || Boolean(busy)}><i className="bi bi-check2-circle" /> Finish Treatment</button>}
            {visit.finished_at && capabilities.orders && <button type="button" className="print" onClick={() => void printDraft()} disabled={Boolean(busy)}><i className="bi bi-printer" /> Print Draft</button>}
            {order && order.print_count > 0 && order.status !== "handed_to_cashier" && capabilities.orders && <button type="button" className="handoff" onClick={() => void serviceOrderAction("handoff")} disabled={Boolean(busy)}><i className="bi bi-box-arrow-right" /> Handed to Cashier</button>}
          </div>
          <div className="touch-pos-note"><i className="bi bi-shield-check" /><span>Draft only · No prices · Payment at separate cashier</span></div>
        </aside>
      </div>

      {order && <div className="service-order-print-only"><ServiceOrderPrint order={order} /></div>}
    </div>
  );
}
