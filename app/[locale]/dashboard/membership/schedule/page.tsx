"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "@/lib/i18n/navigation";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Dumbbell,
  LoaderCircle,
  Plus,
  Sparkles,
  UserRound,
  Users,
  X,
} from "lucide-react";

const DAY_START = 8;
const DAY_END = 21;
const HOUR_HEIGHT = 76;

type Appointment = {
  id: number;
  member_id?: number | null;
  member_name?: string | null;
  member_code?: string | null;
  facility_id: number;
  facility_name?: string | null;
  service_name: string;
  guest_name?: string | null;
  guest_phone?: string | null;
  starts_at: string;
  ends_at: string;
  status: "confirmed" | "checked_in" | "completed" | "no_show" | "cancelled";
  notes?: string | null;
};

type Facility = { id: number; name: string; type: string; capacity?: number | null };
type Member = { id: number; full_name: string; customer_id?: string };
type RateCard = { id: number; name: string; duration_minutes?: number | null; facility_id?: number | null };

const statusMeta: Record<Appointment["status"], { label: string; className: string }> = {
  confirmed: { label: "Confirmed", className: "confirmed" },
  checked_in: { label: "Checked in", className: "checked-in" },
  completed: { label: "Completed", className: "completed" },
  no_show: { label: "No show", className: "no-show" },
  cancelled: { label: "Cancelled", className: "cancelled" },
};

function localDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(key: string, amount: number) {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + amount);
  return localDateKey(date);
}

function displayTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function displayDate(key: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(dateFromKey(key));
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function eventPosition(appointment: Appointment) {
  const start = new Date(appointment.starts_at);
  const end = new Date(appointment.ends_at);
  const minutesFromStart = Math.max(0, start.getHours() * 60 + start.getMinutes() - DAY_START * 60);
  const rawDuration = Math.max(30, Math.round((end.getTime() - start.getTime()) / 60000));
  return {
    top: `${(minutesFromStart / 60) * HOUR_HEIGHT + 4}px`,
    height: `${Math.max(42, (rawDuration / 60) * HOUR_HEIGHT - 8)}px`,
  };
}

export default function SpaSchedulePage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(() => localDateKey(new Date()));
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [resourcesLoading, setResourcesLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    member_id: "",
    guest_name: "",
    guest_phone: "",
    rate_card_id: "",
    service_name: "",
    facility_id: "",
    start_time: "10:00",
    duration: "60",
    notes: "",
  });

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const visibleFacilities = useMemo(
    () => facilities.filter((facility) => ["room", "sauna", "steam", "pool", "gym", "zone"].includes(facility.type)),
    [facilities]
  );
  const calendarFacilities = visibleFacilities.length ? visibleFacilities : facilities;
  const dayAppointments = useMemo(
    () => appointments.filter((appointment) => localDateKey(new Date(appointment.starts_at)) === selectedDate),
    [appointments, selectedDate]
  );
  const upcomingDates = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(selectedDate, index - 3)), [selectedDate]);
  const activeAppointments = dayAppointments.filter((appointment) => !["cancelled", "no_show"].includes(appointment.status));

  const loadAppointments = async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const from = addDays(selectedDate, -3);
      const to = addDays(selectedDate, 3);
      const response = await fetch(`/api/membership/appointments?from=${from}&to=${to}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load the schedule");
      setAppointments(Array.isArray(data) ? data : []);
    } catch (loadError: unknown) {
      setAppointments([]);
      setError(errorMessage(loadError, "Unable to load the schedule"));
    } finally {
      setLoading(false);
    }
  };

  const loadResources = async () => {
    if (!token) return;
    setResourcesLoading(true);
    try {
      const [facilityResponse, memberResponse, rateResponse] = await Promise.all([
        fetch("/api/membership/facilities", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/membership/members", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/spa/spa/services?status=active&limit=250", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [facilityData, memberData, rateData] = await Promise.all([
        facilityResponse.json(), memberResponse.json(), rateResponse.json(),
      ]);
      const loadedFacilities = Array.isArray(facilityData) ? facilityData : [];
      setFacilities(loadedFacilities);
      setMembers(Array.isArray(memberData) ? memberData : memberData.data || []);
      const serviceRecords = Array.isArray(rateData?.records) ? rateData.records : [];
      setRateCards(serviceRecords.map((record: any) => ({
        id: Number(record.id),
        name: record.title,
        duration_minutes: Number(record.details?.duration_minutes) || null,
      })));
      if (loadedFacilities.length) {
        setForm((current) => current.facility_id ? current : { ...current, facility_id: String(loadedFacilities[0].id) });
      }
    } catch {
      // The schedule remains usable for data that did load; the booking form explains missing choices.
    } finally {
      setResourcesLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadResources(); }, 0);
    return () => window.clearTimeout(timer);
    // Resource choices are intentionally loaded once when the workspace opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadAppointments(); }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const openNewBooking = (facilityId?: number, hour?: number) => {
    setFormError("");
    setSelectedAppointment(null);
    setForm((current) => ({
      ...current,
      facility_id: facilityId ? String(facilityId) : current.facility_id || (facilities[0] ? String(facilities[0].id) : ""),
      start_time: hour ? `${String(hour).padStart(2, "0")}:00` : current.start_time,
    }));
    setShowForm(true);
  };

  const updateRateCard = (rateCardId: string) => {
    const rateCard = rateCards.find((item) => item.id === Number(rateCardId));
    setForm((current) => ({
      ...current,
      rate_card_id: rateCardId,
      service_name: rateCard?.name || current.service_name,
      duration: rateCard?.duration_minutes ? String(rateCard.duration_minutes) : current.duration,
      facility_id: rateCard?.facility_id ? String(rateCard.facility_id) : current.facility_id,
    }));
  };

  const createAppointment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setFormError("");
    if (!form.member_id && !form.guest_name.trim()) {
      setFormError("Choose a member or add the walk-in guest’s name.");
      return;
    }
    if (!form.service_name.trim() || !form.facility_id) {
      setFormError("Choose a service and treatment area.");
      return;
    }

    const start = new Date(`${selectedDate}T${form.start_time}:00`);
    const end = new Date(start.getTime() + Math.max(15, Number(form.duration) || 60) * 60000);
    setSaving(true);
    try {
      const response = await fetch("/api/membership/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          member_id: form.member_id ? Number(form.member_id) : null,
          guest_name: form.guest_name,
          guest_phone: form.guest_phone,
          // Service pricing belongs to the separate POS. The appointment stores only the operational service name.
          rate_card_id: null,
          service_name: form.service_name,
          facility_id: Number(form.facility_id),
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          notes: form.notes,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save the appointment");
      setShowForm(false);
      setForm((current) => ({ ...current, member_id: "", guest_name: "", guest_phone: "", notes: "" }));
      await loadAppointments();
    } catch (saveError: unknown) {
      setFormError(errorMessage(saveError, "Unable to save the appointment"));
    } finally {
      setSaving(false);
    }
  };

  const setAppointmentStatus = async (status: Appointment["status"]) => {
    if (!selectedAppointment || !token) return;
    setSaving(true);
    try {
      const response = await fetch("/api/membership/appointments", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: selectedAppointment.id, status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update appointment");

      if (status === "checked_in") {
        const visitResponse = await fetch("/api/spa/visits", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            appointment_id: selectedAppointment.id,
            member_id: selectedAppointment.member_id || null,
            customer_name: selectedAppointment.member_name || selectedAppointment.guest_name,
            customer_phone: selectedAppointment.guest_phone || "",
            notes: selectedAppointment.notes || "",
          }),
        });
        const visit = await visitResponse.json();
        if (!visitResponse.ok) throw new Error(visit.error || "Appointment checked in, but the visit could not be created");
        setSelectedAppointment(null);
        router.push(`/dashboard/spa/operations/visits/${visit.id}`);
        return;
      }

      setSelectedAppointment(null);
      await loadAppointments();
    } catch (statusError: unknown) {
      setError(errorMessage(statusError, "Unable to update appointment"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="spa-schedule-page">
      <section className="spa-schedule-hero">
        <div>
          <div className="spa-eyebrow"><Sparkles size={14} /> DAILY FLOW</div>
          <h1>Spa schedule</h1>
          <p>Balance rooms, therapists and guest moments from one calm workspace.</p>
        </div>
        <div className="spa-hero-actions">
          <button className="schedule-today-button" onClick={() => setSelectedDate(localDateKey(new Date()))}>Today</button>
          <button className="schedule-primary-button" onClick={() => openNewBooking()} disabled={resourcesLoading}>
            <Plus size={17} /> New appointment
          </button>
        </div>
      </section>

      <section className="schedule-summary-grid" aria-label="Daily scheduling summary">
        <div className="schedule-summary-card summary-violet">
          <div className="summary-icon"><CalendarDays size={20} /></div>
          <div><span>Today&apos;s bookings</span><strong>{dayAppointments.length}</strong></div>
        </div>
        <div className="schedule-summary-card summary-mint">
          <div className="summary-icon"><UserRound size={20} /></div>
          <div><span>Guest arrivals</span><strong>{dayAppointments.filter((item) => item.status === "checked_in").length}</strong></div>
        </div>
        <div className="schedule-summary-card summary-amber">
          <div className="summary-icon"><Clock3 size={20} /></div>
          <div><span>Confirmed</span><strong>{dayAppointments.filter((item) => item.status === "confirmed").length}</strong></div>
        </div>
        <div className="schedule-summary-card summary-slate">
          <div className="summary-icon"><Dumbbell size={20} /></div>
          <div><span>Areas in use</span><strong>{new Set(activeAppointments.map((item) => item.facility_id)).size}</strong></div>
        </div>
      </section>

      <section className="schedule-workspace">
        <div className="schedule-toolbar">
          <div className="date-control">
            <button onClick={() => setSelectedDate(addDays(selectedDate, -1))} aria-label="Previous day"><ChevronLeft size={18} /></button>
            <div>
              <span>{displayDate(selectedDate)}</span>
              <small>{selectedDate === localDateKey(new Date()) ? "Today’s treatment plan" : "Treatment plan"}</small>
            </div>
            <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} aria-label="Next day"><ChevronRight size={18} /></button>
          </div>
          <div className="schedule-legend" aria-label="Appointment status legend">
            {(["confirmed", "checked_in", "completed"] as const).map((status) => (
              <span key={status}><i className={`legend-dot ${statusMeta[status].className}`} />{statusMeta[status].label}</span>
            ))}
          </div>
        </div>

        <div className="schedule-week-strip" aria-label="Select a day">
          {upcomingDates.map((date) => {
            const dateValue = dateFromKey(date);
            const bookingCount = appointments.filter((item) => localDateKey(new Date(item.starts_at)) === date).length;
            return (
              <button key={date} className={date === selectedDate ? "selected" : ""} onClick={() => setSelectedDate(date)}>
                <span>{new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(dateValue)}</span>
                <strong>{dateValue.getDate()}</strong>
                <i>{bookingCount || "·"}</i>
              </button>
            );
          })}
        </div>

        {error && <div className="schedule-inline-error"><X size={16} />{error}</div>}

        <div className="schedule-calendar-wrap">
          {loading ? (
            <div className="schedule-loading"><LoaderCircle className="animate-spin" size={24} /> Loading appointments…</div>
          ) : calendarFacilities.length === 0 ? (
            <div className="schedule-empty">
              <Dumbbell size={30} />
              <h2>Set up your treatment areas first</h2>
              <p>Add rooms, sauna, pool or gym zones in Facilities before booking appointments.</p>
            </div>
          ) : (
            <div className="schedule-calendar" style={{ gridTemplateColumns: `76px repeat(${calendarFacilities.length}, minmax(176px, 1fr))` }}>
              <div className="schedule-time-header">Time</div>
              {calendarFacilities.map((facility) => (
                <button key={facility.id} className="schedule-facility-header" onClick={() => openNewBooking(facility.id)} title={`Book ${facility.name}`}>
                  <span>{facility.name}</span>
                  <small>{facility.type}{facility.capacity ? ` · ${facility.capacity} spots` : ""}</small>
                </button>
              ))}

              <div className="schedule-time-column" style={{ height: `${(DAY_END - DAY_START) * HOUR_HEIGHT}px` }}>
                {Array.from({ length: DAY_END - DAY_START + 1 }, (_, index) => (
                  <span key={index} style={{ top: `${index * HOUR_HEIGHT - 9}px` }}>{String(DAY_START + index).padStart(2, "0")}:00</span>
                ))}
              </div>
              {calendarFacilities.map((facility) => (
                <div key={facility.id} className="schedule-facility-column" style={{ height: `${(DAY_END - DAY_START) * HOUR_HEIGHT}px` }}>
                  {Array.from({ length: DAY_END - DAY_START }, (_, index) => (
                    <button
                      key={index}
                      className="schedule-time-slot"
                      style={{ top: `${index * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                      onClick={() => openNewBooking(facility.id, DAY_START + index)}
                      aria-label={`Book ${facility.name} at ${DAY_START + index}:00`}
                    />
                  ))}
                  {dayAppointments.filter((appointment) => appointment.facility_id === facility.id).map((appointment) => {
                    const meta = statusMeta[appointment.status];
                    return (
                      <button
                        key={appointment.id}
                        className={`schedule-event ${meta.className}`}
                        style={eventPosition(appointment)}
                        onClick={() => setSelectedAppointment(appointment)}
                        title={`${appointment.service_name} · ${appointment.member_name || appointment.guest_name}`}
                      >
                        <strong>{displayTime(appointment.starts_at)} · {appointment.service_name}</strong>
                        <span>{appointment.member_name || appointment.guest_name || "Walk-in guest"}</span>
                        <em>{meta.label}</em>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="schedule-bottom-grid">
        <div className="schedule-panel">
          <div className="panel-heading"><div><span className="spa-eyebrow"><Users size={14} /> NEXT UP</span><h2>Guest arrivals</h2></div><span>{activeAppointments.length} active</span></div>
          {activeAppointments.length === 0 ? (
            <div className="panel-empty">No arrivals or treatments are scheduled for this day.</div>
          ) : (
            <div className="arrival-list">
              {activeAppointments.slice(0, 4).map((appointment) => (
                <button key={appointment.id} onClick={() => setSelectedAppointment(appointment)}>
                  <time>{displayTime(appointment.starts_at)}</time>
                  <div><strong>{appointment.member_name || appointment.guest_name || "Walk-in guest"}</strong><span>{appointment.service_name} · {appointment.facility_name || "Spa area"}</span></div>
                  <i className={`arrival-status ${statusMeta[appointment.status].className}`} />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="schedule-panel room-readiness">
          <div className="panel-heading"><div><span className="spa-eyebrow"><Sparkles size={14} /> ROOM READINESS</span><h2>Today&apos;s pace</h2></div></div>
          <div className="readiness-items">
            <div><span>Scheduled treatment time</span><strong>{Math.round(activeAppointments.reduce((total, item) => total + (new Date(item.ends_at).getTime() - new Date(item.starts_at).getTime()) / 60000, 0))} min</strong></div>
            <div><span>Open treatment areas</span><strong>{Math.max(0, calendarFacilities.length - new Set(activeAppointments.map((item) => item.facility_id)).size)}</strong></div>
            <div><span>Walk-in guests</span><strong>{dayAppointments.filter((item) => !item.member_id).length}</strong></div>
          </div>
        </div>
      </section>

      {showForm && (
        <div className="schedule-modal-backdrop" role="presentation" onMouseDown={() => !saving && setShowForm(false)}>
          <section className="schedule-booking-modal" role="dialog" aria-modal="true" aria-labelledby="booking-title" onMouseDown={(event) => event.stopPropagation()}>
            <header><div><span className="spa-eyebrow"><Sparkles size={14} /> RESERVATION</span><h2 id="booking-title">New appointment</h2><p>{displayDate(selectedDate)}</p></div><button onClick={() => setShowForm(false)} aria-label="Close booking form"><X size={20} /></button></header>
            <form onSubmit={createAppointment}>
              <div className="booking-section-label">Guest details</div>
              <div className="booking-field-grid two">
                <label>Member<select value={form.member_id} onChange={(event) => setForm({ ...form, member_id: event.target.value, guest_name: event.target.value ? "" : form.guest_name })}><option value="">Walk-in guest</option>{members.map((member) => <option key={member.id} value={member.id}>{member.full_name}{member.customer_id ? ` · ${member.customer_id}` : ""}</option>)}</select></label>
                <label>Phone<input value={form.guest_phone} onChange={(event) => setForm({ ...form, guest_phone: event.target.value })} placeholder="For walk-ins" /></label>
              </div>
              {!form.member_id && <label className="booking-full-field">Guest name *<input value={form.guest_name} onChange={(event) => setForm({ ...form, guest_name: event.target.value })} placeholder="Guest full name" /></label>}

              <div className="booking-section-label">Treatment details</div>
              <div className="booking-field-grid two">
                <label>Service catalogue<select value={form.rate_card_id} onChange={(event) => updateRateCard(event.target.value)}><option value="">Custom service</option>{rateCards.map((card) => <option key={card.id} value={card.id}>{card.name}{card.duration_minutes ? ` · ${card.duration_minutes} min` : ""}</option>)}</select></label>
                <label>Service name *<input value={form.service_name} onChange={(event) => setForm({ ...form, service_name: event.target.value })} placeholder="e.g. Aroma massage" /></label>
                <label>Treatment area *<select value={form.facility_id} onChange={(event) => setForm({ ...form, facility_id: event.target.value })}><option value="">Choose an area</option>{facilities.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}</select></label>
                <label>Duration<select value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })}>{[30, 45, 60, 75, 90, 120].map((duration) => <option key={duration} value={duration}>{duration} minutes</option>)}</select></label>
                <label>Starts at *<input type="time" value={form.start_time} onChange={(event) => setForm({ ...form, start_time: event.target.value })} required /></label>
                <label className="booking-notes">Notes<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Preferences, therapist notes…" rows={2} /></label>
              </div>
              {formError && <div className="booking-error"><X size={15} />{formError}</div>}
              <footer><button type="button" className="schedule-cancel-button" onClick={() => setShowForm(false)} disabled={saving}>Cancel</button><button type="submit" className="schedule-primary-button" disabled={saving || resourcesLoading}>{saving ? <><LoaderCircle className="animate-spin" size={16} /> Booking…</> : <><Check size={16} /> Confirm appointment</>}</button></footer>
            </form>
          </section>
        </div>
      )}

      {selectedAppointment && (
        <div className="schedule-modal-backdrop" role="presentation" onMouseDown={() => !saving && setSelectedAppointment(null)}>
          <section className="appointment-detail-modal" role="dialog" aria-modal="true" aria-labelledby="appointment-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedAppointment(null)} aria-label="Close appointment"><X size={20} /></button>
            <span className={`appointment-status-pill ${statusMeta[selectedAppointment.status].className}`}>{statusMeta[selectedAppointment.status].label}</span>
            <h2 id="appointment-title">{selectedAppointment.service_name}</h2>
            <p className="detail-guest"><UserRound size={17} />{selectedAppointment.member_name || selectedAppointment.guest_name || "Walk-in guest"}</p>
            <dl><div><dt>Time</dt><dd>{displayTime(selectedAppointment.starts_at)} – {displayTime(selectedAppointment.ends_at)}</dd></div><div><dt>Area</dt><dd>{selectedAppointment.facility_name || "Spa area"}</dd></div>{selectedAppointment.notes && <div><dt>Notes</dt><dd>{selectedAppointment.notes}</dd></div>}</dl>
            {!["completed", "cancelled", "no_show"].includes(selectedAppointment.status) && <div className="appointment-actions">{selectedAppointment.status === "confirmed" && <button onClick={() => setAppointmentStatus("checked_in")} disabled={saving}><UserRound size={16} /> Check in &amp; create visit</button>}{selectedAppointment.status === "checked_in" && <button onClick={() => setAppointmentStatus("completed")} disabled={saving}><Check size={16} /> Complete</button>}<button className="danger" onClick={() => setAppointmentStatus("cancelled")} disabled={saving}>Cancel</button></div>}
          </section>
        </div>
      )}
    </div>
  );
}
