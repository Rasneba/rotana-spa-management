"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const user = localStorage.getItem("user");
    if (!user) { router.push("/login"); return; }
    const u = JSON.parse(user);
    if (u.role !== "super_admin") { router.push("/dashboard"); return; }

    const tok = localStorage.getItem("token");
    if (!tok) { router.push("/login"); return; }

    fetch("/api/admin/dashboard", { headers: { Authorization: `Bearer ${tok}` } })
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError("Failed to load dashboard"));
  }, [router]);

  if (error) {
    return <div className="alert alert-danger m-4">{error}</div>;
  }

  if (!data) {
    return (
      <div className="d-flex justify-content-center py-5">
        <div className="spinner-border text-primary" role="status"></div>
      </div>
    );
  }

  return (
    <div className="page-enter">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="fw-bold">Super Admin Dashboard</h3>
          <p className="text-muted small mb-0">System overview</p>
        </div>
        <div className="d-flex gap-2">
          <Link href="/dashboard/companies" className="btn btn-primary btn-sm">
            <i className="bi bi-building me-1"></i>Manage Companies
          </Link>
          <Link href="/dashboard/demo-licenses" className="btn btn-success btn-sm">
            <i className="bi bi-key me-1"></i>Issue License
          </Link>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card border-0 shadow-sm p-3 rounded-3 h-100">
            <div className="d-flex align-items-center gap-3">
              <i className="bi bi-building fs-2 text-primary"></i>
              <div>
                <div className="text-muted small text-uppercase fw-bold">Companies</div>
                <div className="fs-4 fw-bold">{data.totalCompanies}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 shadow-sm p-3 rounded-3 h-100">
            <div className="d-flex align-items-center gap-3">
              <i className="bi bi-key fs-2 text-success"></i>
              <div>
                <div className="text-muted small text-uppercase fw-bold">Active Licenses</div>
                <div className="fs-4 fw-bold">{data.totalActiveLicenses}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 shadow-sm p-3 rounded-3 h-100">
            <div className="d-flex align-items-center gap-3">
              <i className="bi bi-people fs-2 text-info"></i>
              <div>
                <div className="text-muted small text-uppercase fw-bold">Total Users</div>
                <div className="fs-4 fw-bold">{data.totalUsers}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 shadow-sm p-3 rounded-3 h-100">
            <div className="d-flex align-items-center gap-3">
              <i className="bi bi-exclamation-triangle fs-2 text-warning"></i>
              <div>
                <div className="text-muted small text-uppercase fw-bold">Expiring This Week</div>
                <div className="fs-4 fw-bold">{data.expiringThisWeek}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {data.recentCompanies?.length > 0 && (
        <div className="card border-0 shadow-sm">
          <div className="card-header fw-semibold d-flex justify-content-between align-items-center" style={{ backgroundColor: "var(--card-bg)", borderBottom: "1px solid var(--card-border)" }}>
            <span><i className="bi bi-building me-2"></i>Recent Companies</span>
            <Link href="/dashboard/companies" className="btn btn-sm btn-outline-primary">View All</Link>
          </div>
          <div className="card-body p-0">
            <table className="table table-hover mb-0">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>TIN</th>
                  <th>License</th>
                  <th>Status</th>
                  <th>Users</th>
                  <th>Active Licenses</th>
                  <th>Latest Expiry</th>
                </tr>
              </thead>
              <tbody>
                {data.recentCompanies.map((c: any) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td><code>{c.tin}</code></td>
                    <td><span className="badge bg-info">{c.license_type}</span></td>
                    <td>
                      {c.status === "active" ? (
                        <span className="badge bg-success">Active</span>
                      ) : (
                        <span className="badge bg-secondary">{c.status}</span>
                      )}
                    </td>
                    <td>{c.user_count}</td>
                    <td>{c.active_licenses}</td>
                    <td>{c.latest_expiry ? new Date(c.latest_expiry).toLocaleDateString() : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="text-center text-muted small mt-4">
        <i className="bi bi-shield-lock me-1"></i>Super Admin &middot;
        <i className="bi bi-laptop ms-2 me-1"></i>Rotana Spa Management System
      </div>
    </div>
  );
}
