"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/i18n/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Plus, Save, Users, X } from "lucide-react";
import { GemBtn, GemBtnOutline, GemInput, GemSelect } from "@/lib/gem-ui";

const DAY_START = 8;
const DAY_END = 21;
const SLOT_MINUTES = 30;
const SLOT_WIDTH = 76;
const ROW_HEIGHT = 92;
const THERAPIST_WIDTH = 190;
const THERAPIST_COLORS = ["#2f855a", "#4f6fb5", "#a15f9b", "#c47a38", "#2b8a8a", "#8a64c5", "#c15364"];

type Therapist = { id: number; title: string; details?: { specialties?: string } };
type Offering = { id: number; title: string; details: { offering_code?: string; duration_minutes?: number | string; category?: string; classification?: string } };
type Customer = { id: number; full_name: string; customer_id?: string; phone?: string };
type Facility = { id: number; name: string; type?: string };
type Booking = {
  id: number;
  therapist_record_id: number;
  therapist_name: string;
  offering_id: number;
  offering_name?: string;
  offering_code?: string;
  member_id?: number | null;
  member_name?: string | null;
  guest_name?: string | null;
  guest_phone?: string | null;
  facility_id?: number | null;
  facility_name?: string | null;
  service_name: string;
  starts_at: string;
  ends_at: string;
  duration_minutes?: number;
  status: string;
  notes?: string | null;
};
type Capabilities = { create: boolean; edit: boolean; delete: boolean };
type FormState = {
  id: string;
  therapist_record_id: string;
  offering_id: string;
  customer_mode: "customer" | "walkin";
  member_id: string;
  guest_name: string;
  guest_phone: string;
  facility_id: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string;
};

const emptyForm: FormState = {
  id: "",
  therapist_record_id: "",
  offering_id: "",
  customer_mode: "customer",
  member_id: "",
  guest_name: "",
  guest_phone: "",
  facility_id: "",
  start_time: "09:00",
  end_time: "10:00",
  status: "confirmed",
  notes: "",
};

const timeSlots = Array.from(
  { length: ((DAY_END - DAY_START) * 60) / SLOT_MINUTES + 1 },
  (_, index) => {
    const minutes = DAY_START * 60 + index * SLOT_MINUTES;
    return { minutes, value: `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}` };
  }
);

function localDateKey(date: Date): string {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return localDateKey(value);
}

function inputTime(value: string): string {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function minutesFor(value: string): number {
  const date = new Date(value);
  return date.getHours() * 60 + date.getMinutes();
}

function timeWithDuration(startTime: string, duration: number): string {
  const [hours, minutes] = startTime.split(":").map(Number);
  const end = hours * 60 + minutes + duration;
  return `${String(Math.floor(end / 60) % 24).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
}

function amharicPeriod(minutes: number): { label: string; className: string } {
  const hour = Math.floor(minutes / 60) % 24;
  if (hour < 12) return { label: "ጠዋት", className: "morning" };
  if (hour === 12) return { label: "ቀትር", className: "noon" };
  if (hour < 18) return { label: "ከሰዓት", className: "afternoon" };
  return { label: "ማታ", className: "evening" };
}

function amharicTimeFromMinutes(minutes: number): string {
  const normalizedMinutes = ((minutes % 1440) + 1440) % 1440;
  const standardHour = Math.floor(normalizedMinutes / 60);
  const ethiopianHour = ((standardHour + 5) % 12) + 1;
  const minute = normalizedMinutes % 60;
  return `${ethiopianHour}:${String(minute).padStart(2, "0")} ${amharicPeriod(normalizedMinutes).label}`;
}

function amharicTime(value: string): string {
  const date = new Date(value);
  return amharicTimeFromMinutes(date.getHours() * 60 + date.getMinutes());
}

function amharicInputTime(value: string): string {
  const [hours, minutes] = value.split(":").map(Number);
  return amharicTimeFromMinutes(hours * 60 + minutes);
}

function periodClass(minutes: number): string {
  return `time-period-${amharicPeriod(minutes).className}`;
}

function statusClass(status: string): string {
  if (status === "checked_in") return "checked-in";
  if (status === "completed") return "completed";
  if (status === "cancelled" || status === "no_show") return "cancelled";
  return "confirmed";
}

export default function SpaTherapistBookingBoard() {
  const [selectedDate, setSelectedDate] = useState(() => localDateKey(new Date()));
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [capabilities, setCapabilities] = useState<Capabilities>({ create: false, edit: false, delete: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [therapistSearch, setTherapistSearch] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const [bookingResponse, therapistResponse, offeringResponse, customerResponse, facilityResponse] = await Promise.all([
        fetch(`/api/spa/bookings?date=${selectedDate}`, { headers: { Authorization: `Bearer ${token}` }, signal }),
        fetch("/api/spa/spa/therapists?status=active&limit=250", { headers: { Authorization: `Bearer ${token}` }, signal }),
        fetch("/api/spa/catalog/offerings?status=active&limit=250", { headers: { Authorization: `Bearer ${token}` }, signal }),
        fetch("/api/membership/members", { headers: { Authorization: `Bearer ${token}` }, signal }),
        fetch("/api/membership/facilities", { headers: { Authorization: `Bearer ${token}` }, signal }),
      ]);
      const bookingData = await bookingResponse.json() as { bookings?: Booking[]; capabilities?: Capabilities; error?: string };
      const therapistData = await therapistResponse.json() as { records?: Therapist[] };
      const offeringData = await offeringResponse.json() as { records?: Offering[] };
      const customerData = await customerResponse.json();
      const facilityData = await facilityResponse.json();
      if (!bookingResponse.ok) throw new Error(bookingData.error || "Unable to load Spa bookings");
      setBookings(bookingData.bookings || []);
      setCapabilities(bookingData.capabilities || { create: false, edit: false, delete: false });
      setTherapists(therapistResponse.ok ? therapistData.records || [] : []);
      setOfferings(offeringResponse.ok
        ? (offeringData.records || []).filter((item) => ["spa_service", "package"].includes(String(item.details?.classification)))
        : []);
      setCustomers(Array.isArray(customerData) ? customerData : []);
      setFacilities(Array.isArray(facilityData) ? facilityData.filter((item) => item.is_active !== false) : []);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setError(loadError instanceof Error ? loadError.message : "Unable to load Spa bookings");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load]);

  const selectedOffering = offerings.find((item) => String(item.id) === form.offering_id);
  const serviceDuration = Number(selectedOffering?.details?.duration_minutes) || 60;

  const setOffering = (offeringId: string) => {
    const offering = offerings.find((item) => String(item.id) === offeringId);
    const duration = Number(offering?.details?.duration_minutes) || 60;
    setForm((current) => ({ ...current, offering_id: offeringId, end_time: timeWithDuration(current.start_time, duration) }));
  };

  const setStartTime = (startTime: string) => {
    setForm((current) => ({ ...current, start_time: startTime, end_time: timeWithDuration(startTime, serviceDuration) }));
  };

  const openNew = (therapistId = "", startTime = "09:00") => {
    setForm({ ...emptyForm, therapist_record_id: therapistId, start_time: startTime, end_time: timeWithDuration(startTime, 60) });
    setShowForm(true);
    setError("");
  };

  const openEdit = (booking: Booking) => {
    setForm({
      id: String(booking.id),
      therapist_record_id: String(booking.therapist_record_id || ""),
      offering_id: String(booking.offering_id || ""),
      customer_mode: booking.member_id ? "customer" : "walkin",
      member_id: booking.member_id ? String(booking.member_id) : "",
      guest_name: booking.guest_name || "",
      guest_phone: booking.guest_phone || "",
      facility_id: booking.facility_id ? String(booking.facility_id) : "",
      start_time: inputTime(booking.starts_at),
      end_time: inputTime(booking.ends_at),
      status: booking.status,
      notes: booking.notes || "",
    });
    setShowForm(true);
    setError("");
  };

  const saveBooking = async (event: React.FormEvent) => {
    event.preventDefault();
    const token = localStorage.getItem("token");
    if (!token || !form.therapist_record_id || !form.offering_id) return;
    setSaving(true);
    setError("");
    try {
      const startsAt = new Date(`${selectedDate}T${form.start_time}:00`).toISOString();
      const endsAt = new Date(`${selectedDate}T${form.end_time}:00`).toISOString();
      const response = await fetch("/api/spa/bookings", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: form.id ? Number(form.id) : undefined,
          therapist_record_id: Number(form.therapist_record_id),
          offering_id: Number(form.offering_id),
          member_id: form.customer_mode === "customer" && form.member_id ? Number(form.member_id) : null,
          guest_name: form.customer_mode === "walkin" ? form.guest_name : null,
          guest_phone: form.customer_mode === "walkin" ? form.guest_phone : null,
          facility_id: form.facility_id ? Number(form.facility_id) : null,
          starts_at: startsAt,
          ends_at: endsAt,
          status: form.status,
          notes: form.notes,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save booking");
      setShowForm(false);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save booking");
    } finally {
      setSaving(false);
    }
  };

  const cancelBooking = async () => {
    if (!form.id || !window.confirm("Cancel this Spa booking?")) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    setSaving(true);
    try {
      const response = await fetch("/api/spa/bookings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: Number(form.id) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to cancel booking");
      setShowForm(false);
      await load();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Unable to cancel booking");
    } finally {
      setSaving(false);
    }
  };

  const visibleTherapists = useMemo(() => {
    const term = therapistSearch.trim().toLowerCase();
    return therapists.filter((therapist) => !term || therapist.title.toLowerCase().includes(term) || String(therapist.details?.specialties || "").toLowerCase().includes(term));
  }, [therapistSearch, therapists]);

  const totalTimelineWidth = timeSlots.length * SLOT_WIDTH;
  const dayLabel = new Date(`${selectedDate}T12:00:00`).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="spa-booking-page">
      <header className="spa-booking-header">
        <div><p>Spa Operations</p><h1>Bookings by Therapist</h1><span>Therapists run vertically · time runs horizontally</span></div>
        <div className="spa-booking-date-nav"><button type="button" onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}><ChevronLeft size={20} /></button><label><CalendarDays size={17} /><input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label><button type="button" onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}><ChevronRight size={20} /></button><button type="button" className="today" onClick={() => setSelectedDate(localDateKey(new Date()))}>Today</button></div>
        {capabilities.create && <button type="button" className="new-booking-button" onClick={() => openNew()}><Plus size={18} />New Booking</button>}
      </header>

      <div className="spa-booking-subbar"><div><strong>{dayLabel}</strong><span>{bookings.length} booking{bookings.length === 1 ? "" : "s"}</span></div><label><i className="bi bi-search" /><input value={therapistSearch} onChange={(event) => setTherapistSearch(event.target.value)} placeholder="Find therapist…" /></label><div className="booking-legend"><span className="confirmed">Confirmed</span><span className="checked-in">Checked In</span><span className="completed">Completed</span></div><div className="amharic-period-legend"><span className="morning">ጠዋት</span><span className="noon">ቀትር</span><span className="afternoon">ከሰዓት</span><span className="evening">ማታ</span></div></div>
      {error && !showForm && <div className="spa-workspace-alert danger"><i className="bi bi-exclamation-circle" />{error}</div>}

      <section className="therapist-timeline-shell">
        {loading ? <div className="spa-workspace-state"><span className="spinner-border" /><p>Loading therapist bookings…</p></div> : visibleTherapists.length === 0 ? <div className="spa-workspace-state"><Users size={34} /><h2>No active therapists</h2><p>Add therapists before creating Spa bookings.</p><Link href="/dashboard/spa/spa/therapists">Open Therapists</Link></div> : (
          <div className="therapist-timeline-scroll">
            <div className="therapist-timeline-board" style={{ width: THERAPIST_WIDTH + totalTimelineWidth }}>
              <div className="therapist-time-header" style={{ gridTemplateColumns: `${THERAPIST_WIDTH}px ${totalTimelineWidth}px` }}>
                <div className="therapist-column-title">Therapist</div>
                <div className="horizontal-time-labels" style={{ gridTemplateColumns: `repeat(${timeSlots.length}, ${SLOT_WIDTH}px)` }}>{timeSlots.map((slot) => <span key={slot.value} className={`${slot.value.endsWith(":00") ? "hour" : "half"} ${periodClass(slot.minutes)}`}><b>{slot.value}</b><small>{amharicTimeFromMinutes(slot.minutes)}</small></span>)}</div>
              </div>

              {visibleTherapists.map((therapist, therapistIndex) => {
                const therapistBookings = bookings.filter((booking) => Number(booking.therapist_record_id) === Number(therapist.id));
                return (
                  <div className="therapist-timeline-row" key={therapist.id} style={{ gridTemplateColumns: `${THERAPIST_WIDTH}px ${totalTimelineWidth}px`, minHeight: ROW_HEIGHT, "--therapist-color": THERAPIST_COLORS[therapistIndex % THERAPIST_COLORS.length] } as React.CSSProperties}>
                    <div className="vertical-therapist-card"><span>{therapist.title.charAt(0).toUpperCase()}</span><div><strong>{therapist.title}</strong><small>{therapist.details?.specialties || "Spa therapist"}</small><em>{therapistBookings.length} bookings</em></div></div>
                    <div className="horizontal-booking-track" style={{ width: totalTimelineWidth, minHeight: ROW_HEIGHT }}>
                      <div className="horizontal-slot-grid" style={{ gridTemplateColumns: `repeat(${timeSlots.length}, ${SLOT_WIDTH}px)` }}>{timeSlots.map((slot) => <button key={slot.value} type="button" className={periodClass(slot.minutes)} onClick={() => openNew(String(therapist.id), slot.value)} disabled={!capabilities.create || slot.minutes >= DAY_END * 60} aria-label={`Book ${therapist.title} at ${slot.value} · ${amharicTimeFromMinutes(slot.minutes)}`} />)}</div>
                      {therapistBookings.map((booking) => {
                        const start = minutesFor(booking.starts_at);
                        const end = minutesFor(booking.ends_at);
                        const left = ((start - DAY_START * 60) / SLOT_MINUTES) * SLOT_WIDTH;
                        const width = Math.max(SLOT_WIDTH, ((end - start) / SLOT_MINUTES) * SLOT_WIDTH - 5);
                        return <button type="button" key={booking.id} className={`horizontal-booking-event ${statusClass(booking.status)}`} style={{ left: Math.max(0, left), width }} onClick={() => openEdit(booking)}><strong>{booking.member_name || booking.guest_name || "Guest"}</strong><span>{inputTime(booking.starts_at)}–{inputTime(booking.ends_at)}</span><em>{amharicTime(booking.starts_at)}–{amharicTime(booking.ends_at)}</em><small>{booking.offering_name || booking.service_name}</small></button>;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {showForm && (
        <div className="spa-form-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setShowForm(false); }}>
          <section className="spa-booking-modal" role="dialog" aria-modal="true" aria-labelledby="spa-booking-title">
            <header><div><p>{form.id ? "Edit therapist booking" : "New therapist booking"}</p><h2 id="spa-booking-title">{form.id ? "Edit Spa Booking" : "Book by Therapist"}</h2></div><button type="button" onClick={() => setShowForm(false)}><X size={18} /></button></header>
            <form onSubmit={saveBooking}>
              {error && <div className="spa-workspace-alert danger">{error}</div>}
              <div className="spa-booking-form-grid">
                <label><span>Therapist *</span><GemSelect required value={form.therapist_record_id} onChange={(event) => setForm({ ...form, therapist_record_id: event.target.value })}><option value="">Select therapist</option>{therapists.map((therapist) => <option key={therapist.id} value={therapist.id}>{therapist.title}</option>)}</GemSelect></label>
                <label><span>Service / Package *</span><GemSelect required value={form.offering_id} onChange={(event) => setOffering(event.target.value)}><option value="">Select service</option>{offerings.map((offering) => <option key={offering.id} value={offering.id}>{offering.details?.offering_code ? `${offering.details.offering_code} · ` : ""}{offering.title} · {Number(offering.details?.duration_minutes) || 60} min</option>)}</GemSelect></label>

                {form.therapist_record_id && (
                  <div className="spa-booking-time-section span-two">
                    <div><Clock3 size={18} /><span>Booking Time</span><small>{selectedOffering ? `${selectedOffering.title} · ${serviceDuration} minutes` : "Choose a service to calculate end time"}</small></div>
                    <label><span>Start Time · መጀመሪያ *</span><input type="time" required step="900" value={form.start_time} onChange={(event) => setStartTime(event.target.value)} /><small className="amharic-selected-time">{amharicInputTime(form.start_time)}</small></label>
                    <label><span>End Time · መጨረሻ *</span><input type="time" required step="900" value={form.end_time} onChange={(event) => setForm({ ...form, end_time: event.target.value })} /><small className="amharic-selected-time">{amharicInputTime(form.end_time)}</small></label>
                  </div>
                )}

                <div className="booking-customer-mode span-two"><button type="button" className={form.customer_mode === "customer" ? "active" : ""} onClick={() => setForm({ ...form, customer_mode: "customer", guest_name: "", guest_phone: "" })}>Existing Customer</button><button type="button" className={form.customer_mode === "walkin" ? "active" : ""} onClick={() => setForm({ ...form, customer_mode: "walkin", member_id: "" })}>Walk-In Guest</button></div>
                {form.customer_mode === "customer" ? <label className="span-two"><span>Customer *</span><GemSelect required value={form.member_id} onChange={(event) => setForm({ ...form, member_id: event.target.value })}><option value="">Select customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.customer_id ? `${customer.customer_id} · ` : ""}{customer.full_name}</option>)}</GemSelect></label> : <><label><span>Guest Name *</span><GemInput required value={form.guest_name} onChange={(event) => setForm({ ...form, guest_name: event.target.value })} /></label><label><span>Guest Phone</span><GemInput type="tel" value={form.guest_phone} onChange={(event) => setForm({ ...form, guest_phone: event.target.value })} /></label></>}
                <label><span>Treatment Room</span><GemSelect value={form.facility_id} onChange={(event) => setForm({ ...form, facility_id: event.target.value })}><option value="">No room assigned</option>{facilities.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}</GemSelect></label>
                <label><span>Status</span><GemSelect value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="confirmed">Confirmed</option><option value="checked_in">Checked In</option><option value="completed">Completed</option><option value="no_show">No Show</option><option value="cancelled">Cancelled</option></GemSelect></label>
                <label className="span-two"><span>Notes</span><textarea rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
              </div>
              <footer>{form.id && capabilities.delete && <button type="button" className="cancel-booking" onClick={() => void cancelBooking()} disabled={saving}>Cancel Booking</button>}<span /><GemBtnOutline onClick={() => setShowForm(false)}>Close</GemBtnOutline><GemBtn type="submit" disabled={saving || !form.therapist_record_id || !form.offering_id}>{saving ? "Saving…" : <><Save size={16} />Save Booking</>}</GemBtn></footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
