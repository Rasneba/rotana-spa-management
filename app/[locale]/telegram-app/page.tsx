"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type TgWebApp = {
  initData: string;
  colorScheme?: "light" | "dark";
  ready: () => void;
  expand: () => void;
  close: () => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp };
  }
}

type BookingRequest = {
  id: number;
  full_name: string;
  phone: string;
  email: string | null;
  treatment: string;
  branch: string;
  preferred_at: string;
  status: string;
  notification_channel: string;
  notification_contact: string;
  notes: string | null;
};

type Therapist = { id: number; title: string };
type Offering = { id: number; title: string; duration_minutes: number };

type Phase = "boot" | "denied" | "error" | "ready";

function formatWhen(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

const statusColors: Record<string, string> = {
  new: "var(--tg-theme-button-color)",
  contacted: "var(--tg-theme-accent-text-color, #168acd)",
  confirmed: "#2e9e5b",
  declined: "var(--tg-theme-destructive-text-color, #e53935)",
  archived: "var(--tg-theme-hint-color)",
};

export default function TelegramAppPage() {
  const [phase, setPhase] = useState<Phase>("boot");
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [step, setStep] = useState<"therapist" | "service" | "confirm" | null>(null);
  const [selectedTherapist, setSelectedTherapist] = useState<Therapist | null>(null);
  const [selectedOffering, setSelectedOffering] = useState<Offering | null>(null);
  const [declineConfirmId, setDeclineConfirmId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const webApp = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;

  const loadData = useCallback(
    async (tok: string) => {
      try {
        const [reqRes, resRes] = await Promise.all([
          fetch("/api/spa/website-requests", { headers: { Authorization: `Bearer ${tok}` } }),
          fetch("/api/telegram/mini-app-resources", { headers: { Authorization: `Bearer ${tok}` } }),
        ]);
        const reqData = await reqRes.json();
        const resData = await resRes.json();
        setRequests(Array.isArray(reqData.requests) ? reqData.requests : []);
        setTherapists(Array.isArray(resData.therapists) ? resData.therapists : []);
        setOfferings(Array.isArray(resData.offerings) ? resData.offerings : []);
      } catch {
        setToast("Failed to load bookings");
      }
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      webApp?.ready();
      webApp?.expand();
      let initData = "";
      for (let i = 0; i < 30; i++) {
        const current = window.Telegram?.WebApp?.initData ?? "";
        if (current) {
          initData = current;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (cancelled) return;
      try {
        const res = await fetch("/api/telegram/mini-app-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData }),
        });
        const data = await res.json();
        if (!res.ok) {
          setPhase(data.error === "Not authorized as staff" ? "denied" : "error");
          setError(data.error || "Unable to open session");
          return;
        }
        setToken(data.token);
        setPhase("ready");
        await loadData(data.token);
      } catch {
        if (!cancelled) {
          setPhase("error");
          setError("Network error");
        }
      }
    };
    boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const api = useCallback(
    (url: string, method: string, body?: unknown) =>
      fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: body ? JSON.stringify(body) : undefined,
      }),
    [token]
  );

  const pending = useMemo(() => requests.filter((r) => r.status === "new" || r.status === "contacted"), [requests]);
  const shown = filter === "pending" ? pending : requests;
  const approvingRequest = approvingId !== null ? requests.find((r) => r.id === approvingId) : null;

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
  }

  function openApprove(r: BookingRequest) {
    setApprovingId(r.id);
    setSelectedTherapist(null);
    setSelectedOffering(null);
    if (therapists.length <= 1) {
      const only = therapists[0] || null;
      setSelectedTherapist(only);
      pickService(r, only);
    } else {
      setStep("therapist");
    }
  }

  function pickTherapist(r: BookingRequest, t: Therapist) {
    setSelectedTherapist(t);
    pickService(r, t);
  }

  function pickService(r: BookingRequest, t: Therapist | null) {
    const needle = (r.treatment || "").trim().toLowerCase();
    let list = offerings;
    if (needle) {
      const exact = offerings.filter((o) => o.title.trim().toLowerCase() === needle);
      const partial = offerings.filter((o) => o.title.toLowerCase().includes(needle));
      if (exact.length > 0) list = exact;
      else if (partial.length > 0) list = partial;
    }
    if (list.length === 0) list = offerings;
    if (list.length <= 1) {
      const only = list[0] || null;
      setSelectedOffering(only);
      setStep(t && only ? "confirm" : "service");
    } else {
      setStep("service");
    }
  }

  async function confirmApprove(r: BookingRequest, t: Therapist | null, o: Offering | null) {
    if (!t || !o) return;
    setBusy(true);
    try {
      const res = await api("/api/spa/website-requests", "PUT", {
        id: r.id,
        status: "confirmed",
        therapist_record_id: t.id,
        offering_id: o.id,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) flash(`#${r.id} approved → ${t.title} | ${o.title}`);
      else flash(data.error || "Approval failed");
    } finally {
      setBusy(false);
      setApprovingId(null);
      setStep(null);
      await loadData(token);
    }
  }

  async function decline(r: BookingRequest) {
    if (declineConfirmId !== r.id) {
      setDeclineConfirmId(r.id);
      return;
    }
    setDeclineConfirmId(null);
    setBusy(true);
    try {
      const res = await api("/api/spa/website-requests", "PUT", { id: r.id, status: "declined" });
      const data = await res.json().catch(() => ({}));
      flash(res.ok ? `#${r.id} declined` : data.error || "Decline failed");
    } finally {
      setBusy(false);
      await loadData(token);
    }
  }

  const pickerTitle =
    step === "therapist"
      ? "Choose therapist"
      : step === "service"
        ? "Choose service"
        : "Confirm approval";

  return (
    <>
      <div className="tg-app">
        <header className="tg-app__header">
          <div>
            <strong>Dagi Spa</strong>
            <span>Booking approvals</span>
          </div>
          <button className="tg-app__ghost" onClick={() => setFilter(filter === "pending" ? "all" : "pending")}>
            {filter === "pending" ? `Pending ${pending.length}` : `All ${requests.length}`}
          </button>
        </header>

        {phase === "boot" && <p className="tg-app__hint">Opening session…</p>}

        {phase === "denied" && (
          <div className="tg-app__state">
            <strong>Not authorized</strong>
            <p>{error}</p>
            <p className="tg-app__hint">Open this Mini App from the Dagi Spa bot menu button.</p>
            {webApp && (
              <button className="tg-app__btn" onClick={() => webApp.close()}>
                Close
              </button>
            )}
          </div>
        )}

        {phase === "error" && (
          <div className="tg-app__state">
            <strong>Error</strong>
            <p>{error}</p>
            <p className="tg-app__hint">Make sure you open this from the Telegram bot.</p>
            <button className="tg-app__btn" onClick={() => location.reload()}>
              Retry
            </button>
          </div>
        )}

        {phase === "ready" && (
          <>
            {shown.length === 0 && <p className="tg-app__hint">No bookings to show.</p>}
            <div className="tg-app__list">
              {shown.map((r) => (
                <article className="tg-app__card" key={r.id}>
                  <div className="tg-app__card-head">
                    <strong>#{r.id} {r.full_name}</strong>
                    <span className="tg-app__chip" style={{ background: statusColors[r.status] || "var(--tg-theme-hint-color)" }}>
                      {r.status}
                    </span>
                  </div>
                  <div className="tg-app__meta">
                    <span>📞 {r.phone}</span>
                    {r.email ? <span>✉️ {r.email}</span> : null}
                    <span>💆 {r.treatment} · {r.branch}</span>
                    <span>🕐 {formatWhen(r.preferred_at)}</span>
                    <span>🔔 {r.notification_channel} {r.notification_contact}</span>
                    {r.notes ? <span className="tg-app__notes">📝 {r.notes}</span> : null}
                  </div>
                  <div className="tg-app__actions">
                    {(r.status === "new" || r.status === "contacted") && (
                      <>
                        <button className="tg-app__btn" disabled={busy} onClick={() => openApprove(r)}>
                          Approve
                        </button>
                        <button
                          className={`tg-app__btn tg-app__btn--danger ${declineConfirmId === r.id ? "tg-app__btn--warn" : ""}`}
                          disabled={busy}
                          onClick={() => decline(r)}
                        >
                          {declineConfirmId === r.id ? "Tap again to decline" : "Decline"}
                        </button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {approvingRequest && (
          <div className="tg-app__sheet">
            <div className="tg-app__sheet-head">
              <strong>{pickerTitle} · #{approvingRequest.id}</strong>
              <button className="tg-app__ghost" onClick={() => { setApprovingId(null); setStep(null); }}>
                ✕
              </button>
            </div>
            {step === "therapist" &&
              therapists.map((t) => (
                <button key={t.id} className="tg-app__row" onClick={() => pickTherapist(approvingRequest, t)}>
                  {t.title}
                </button>
              ))}
            {step === "service" &&
              offerings.map((o) => (
                <button key={o.id} className="tg-app__row" onClick={() => confirmApprove(approvingRequest, selectedTherapist, o)}>
                  {o.title}
                  <small>{o.duration_minutes} min</small>
                </button>
              ))}
            {step === "confirm" && (
              <div>
                <p className="tg-app__hint">
                  {selectedTherapist?.title} · {selectedOffering?.title} on {formatWhen(approvingRequest.preferred_at)}
                </p>
                <button className="tg-app__btn tg-app__btn--block" disabled={busy} onClick={() => confirmApprove(approvingRequest, selectedTherapist, selectedOffering)}>
                  {busy ? "Approving…" : "Confirm approval"}
                </button>
              </div>
            )}
          </div>
        )}

        {toast && <div className="tg-app__toast">{toast}</div>}
      </div>

      <style jsx global>{`
        :root {
          --tg-bg: var(--tg-theme-bg-color, #ffffff);
          --tg-sec: var(--tg-theme-secondary-bg-color, #f1f1f4);
          --tg-text: var(--tg-theme-text-color, #111111);
          --tg-hint: var(--tg-theme-hint-color, #999999);
          --tg-btn: var(--tg-theme-button-color, #2481cc);
          --tg-btn-text: var(--tg-theme-button-text-color, #ffffff);
        }
        body { background: var(--tg-bg); color: var(--tg-text); margin: 0; font-family: -apple-system, "Segoe UI", Roboto, sans-serif; }
        .tg-app { padding: 12px 12px 40px; }
        .tg-app__header { display: flex; align-items: center; justify-content: space-between; padding: 6px 2px 14px; }
        .tg-app__header strong { display: block; font-size: 18px; }
        .tg-app__header span { font-size: 12px; color: var(--tg-hint); }
        .tg-app__ghost { border: 0; background: none; color: var(--tg-btn); font-size: 13px; padding: 4px; }
        .tg-app__list { display: flex; flex-direction: column; gap: 10px; }
        .tg-app__card { background: var(--tg-sec); border-radius: 12px; padding: 12px; }
        .tg-app__card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
        .tg-app__card-head strong { font-size: 15px; }
        .tg-app__chip { font-size: 11px; color: #fff; padding: 2px 8px; border-radius: 10px; text-transform: capitalize; }
        .tg-app__meta { display: flex; flex-direction: column; gap: 3px; font-size: 13px; color: var(--tg-text); opacity: .9; }
        .tg-app__notes { font-size: 12px; color: var(--tg-hint); }
        .tg-app__actions { display: flex; gap: 8px; margin-top: 10px; }
        .tg-app__btn { background: var(--tg-btn); color: var(--tg-btn-text); border: 0; border-radius: 10px; padding: 10px 16px; font-size: 14px; flex: 1; cursor: pointer; }
        .tg-app__btn:disabled { opacity: .6; }
        .tg-app__btn--danger { background: var(--tg-sec); color: var(--tg-theme-destructive-text-color, #e53935); border: 1px solid var(--tg-theme-destructive-text-color, #e53935); }
        .tg-app__btn--warn { background: var(--tg-theme-destructive-text-color, #e53935); color: #fff; border: 0; }
        .tg-app__btn--block { display: block; width: 100%; margin-top: 8px; }
        .tg-app__hint { color: var(--tg-hint); font-size: 13px; text-align: center; padding: 24px 8px; }
        .tg-app__state { text-align: center; padding: 48px 16px; }
        .tg-app__state strong { font-size: 16px; }
        .tg-app__state p { color: var(--tg-hint); font-size: 13px; }
        .tg-app__sheet { position: fixed; left: 0; right: 0; bottom: 0; background: var(--tg-bg); border-top: 1px solid var(--tg-sec); padding: 14px; border-radius: 16px 16px 0 0; max-height: 70vh; overflow: auto; box-shadow: 0 -4px 20px rgba(0,0,0,.12); }
        .tg-app__sheet-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .tg-app__row { display: flex; justify-content: space-between; align-items: center; width: 100%; background: var(--tg-sec); border: 0; color: var(--tg-text); border-radius: 10px; padding: 12px; margin-bottom: 8px; font-size: 14px; cursor: pointer; }
        .tg-app__row small { color: var(--tg-hint); }
        .tg-app__toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); background: var(--tg-text); color: var(--tg-bg); padding: 10px 16px; border-radius: 20px; font-size: 13px; max-width: 90%; text-align: center; z-index: 20; }
      `}</style>
    </>
  );
}
