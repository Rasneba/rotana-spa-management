"use client";

import { useEffect, useState } from "react";

const typeBadge = (t: string) => {
  const map: Record<string, string> = { info: "primary", warning: "warning", alert: "danger", success: "success" };
  return map[t] || "secondary";
};

const typeIcon = (t: string) => {
  const map: Record<string, string> = { info: "bi-info-circle", warning: "bi-exclamation-triangle", alert: "bi-bell", success: "bi-check-circle" };
  return map[t] || "bi-bell";
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("");
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const [form, setForm] = useState({ title: "", message: "", type: "info" });

  const loadData = async () => {
    const tok = localStorage.getItem("token");
    if (!tok) { setLoading(false); return; }
    setLoading(true);
    try {
      const url = filter ? `/api/notifications?is_read=${filter}` : "/api/notifications";
      const nRes = await fetch(url, { headers: { Authorization: `Bearer ${tok}` } });
      const nData = await nRes.json();
      if (Array.isArray(nData)) setNotifications(nData);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [filter]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const markRead = async (id: number) => {
    await fetch(`/api/notifications/${id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });
    loadData();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title: form.title,
        message: form.message,
        type: form.type,
      }),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ title: "", message: "", type: "info" });
      loadData();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to create notification");
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="fw-bold mb-0">Notifications</h4>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <i className="bi bi-plus-lg me-1"></i>{showForm ? "Cancel" : "New Notification"}
        </button>
      </div>

      <div className="mb-3">
        <select className="form-control w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All</option>
          <option value="false">Unread</option>
          <option value="true">Read</option>
        </select>
      </div>

      {showForm && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header fw-semibold">Create Notification</div>
          <div className="card-body">
            <form onSubmit={submit}>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label small fw-semibold">Type *</label>
                  <select name="type" className="form-control" value={form.type} onChange={handleChange} required>
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="alert">Alert</option>
                    <option value="success">Success</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-semibold">Title *</label>
                  <input type="text" name="title" className="form-control" value={form.title} onChange={handleChange} required />
                </div>
                <div className="col-12">
                  <label className="form-label small fw-semibold">Message *</label>
                  <textarea name="message" className="form-control" rows={3} value={form.message} onChange={handleChange} required></textarea>
                </div>
              </div>
              <div className="mt-3">
                <button type="submit" className="btn btn-primary px-4"><i className="bi bi-send me-1"></i>Send Notification</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border text-primary" role="status"></div></div>
      ) : notifications.length === 0 ? (
        <div className="text-center text-muted py-5">No notifications</div>
      ) : (
        <div className="list-group">
          {notifications.map((n: any) => (
            <div key={n.id} className={`list-group-item list-group-item-action d-flex gap-3 py-3 ${n.is_read ? "" : "border-start border-primary border-4"}`}>
              <div className="flex-shrink-0">
                <i className={`bi ${typeIcon(n.type)} fs-4 text-${typeBadge(n.type)}`}></i>
              </div>
              <div className="flex-grow-1">
                <div className="d-flex justify-content-between align-items-center">
                  <h6 className="mb-0 fw-semibold">{n.title}</h6>
                  <small className="text-muted">{new Date(n.created_at).toLocaleDateString()}</small>
                </div>
                <p className="mb-1 small text-muted">{n.message}</p>
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <span className={`badge bg-${typeBadge(n.type)} me-2`}>{n.type}</span>
                    <small className="text-muted">{n.employee_name || "All"}</small>
                  </div>
                  {!n.is_read && (
                    <button className="btn btn-outline-primary btn-sm" onClick={() => markRead(n.id)}>
                      <i className="bi bi-check2 me-1"></i>Mark Read
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
