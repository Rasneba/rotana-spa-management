"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const modules = [
  { name: "Spa Management", moduleCode: "membership", icon: "bi-flower1", href: "/dashboard/membership", color: "#557463", desc: "Bookings, memberships, gym and daily operations" },
  { name: "Audit", icon: "bi-journal-text", href: "/dashboard/audit-logs", color: "#14b8a6", desc: "Audit trails, activity logs" },
];

const quickActions = [
  { label: "New Booking", icon: "bi-calendar-plus", href: "/dashboard/spa/operations/appointments", color: "primary" },
  { label: "New Member", icon: "bi-person-plus", href: "/dashboard/spa/customers/profiles", color: "success" },
  { label: "Gym Floor", icon: "bi-activity", href: "/dashboard/spa/gym/attendance", color: "info" },
  { label: "Check In", icon: "bi-box-arrow-in-right", href: "/dashboard/spa/operations/check-in", color: "warning" },
];

export default function Dashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [currency, setCurrency] = useState("Birr");
  const [greeting, setGreeting] = useState("");
  const [licensedModules, setLicensedModules] = useState<string[]>([]);
  const [userRole, setUserRole] = useState("");
  const [companyName, setCompanyName] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      const u = JSON.parse(stored);
      const role = (u.role || "").toLowerCase();
      setUserRole(role);
      setCompanyName(u.company_name || "");
      if (u.company_id) {
        const tok = localStorage.getItem("token");
        if (tok) {
          fetch(`/api/companies/${u.company_id}`, { headers: { Authorization: `Bearer ${tok}` } })
            .then(r => r.json())
            .then(data => {
              if (data?.modules && Array.isArray(data.modules)) {
                setLicensedModules(data.modules.filter((m: any) => m.enabled).map((m: any) => m.code));
              }
            })
            .catch(() => {});
        }
      }
    }

    const h = new Date().getHours();
    if (h < 12) setGreeting("Good Morning");
    else if (h < 17) setGreeting("Good Afternoon");
    else setGreeting("Good Evening");

    const tok = localStorage.getItem("token");
    if (!tok) return;
    Promise.all([
      fetch("/api/dashboard/stats", { headers: { Authorization: `Bearer ${tok}` } }).then(r => r.json()),
      fetch("/api/settings", { headers: { Authorization: `Bearer ${tok}` } }).then(r => r.json()).catch(() => ({})),
    ]).then(([s, settings]) => {
      setStats(s);
      if (settings?.currency) setCurrency(settings.currency);
    }).catch(console.error);
  }, [router]);

  if (userRole === "super_admin") {
    router.replace("/dashboard/admin");
    return null;
  }

  if (!stats) {
    return (
      <div className="d-flex justify-content-center py-5">
        <div className="spinner-border text-primary" role="status"></div>
      </div>
    );
  }
  const hasLicense = (code: string) => licensedModules.includes(code);

  const visibleModules = modules.filter(m => {
    if (!m.moduleCode) return hasLicense("audit");
    return hasLicense(m.moduleCode);
  });

  const visibleQuickActions = quickActions.filter(a => {
    if (a.href.includes("/membership")) return hasLicense("membership");
    return false;
  });

  const spaCards = [
    { title: "Total Members", value: stats.totalMembers || stats.totalCustomers, color: "text-primary", icon: "bi-people", href: "/dashboard/spa/customers/profiles" },
    { title: "Active Members", value: stats.activeMembers || stats.activeCustomers, color: "text-success", icon: "bi-person-check", href: "/dashboard/spa/customers/profiles" },
    { title: "Today Check-ins", value: stats.todayCheckIns || 0, color: "text-warning", icon: "bi-box-arrow-in-right", href: "/dashboard/spa/operations/check-in" },
    { title: "Revenue", value: `${currency} ${(stats.totalRevenue || 0)?.toLocaleString()}`, color: "text-info", icon: "bi-cash-stack", href: "/dashboard/spa/charges/payment-history" },
  ];

  return (
    <div className="page-enter">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="fw-bold mb-1">{greeting}</h3>
          <p className="text-muted mb-0 small">Welcome to {companyName || "Rotana Spa"}</p>
        </div>
        <div className="d-flex gap-2">
          {visibleQuickActions.map((a) => (
            <Link key={a.label} href={a.href} className={`btn btn-outline-${a.color} btn-sm d-flex align-items-center gap-1`}>
              <i className={`bi ${a.icon}`}></i> {a.label}
            </Link>
          ))}
        </div>
      </div>

      {visibleModules.length > 0 && (
        <>
          <h5 className="fw-semibold mb-3"><i className="bi bi-grid me-2"></i>Modules</h5>
          <div className="row g-3 mb-4">
            {visibleModules.map((mod) => (
              <div className="col-md-4 col-lg-3" key={mod.name}>
                <Link href={mod.href} className="text-decoration-none">
                  <div className="card interactive-card border-0 shadow-sm h-100" style={{ borderRadius: "12px" }}>
                    <div className="card-body p-3 d-flex align-items-start gap-3">
                      <div
                        className="d-flex align-items-center justify-content-center rounded-3 flex-shrink-0"
                        style={{ width: "48px", height: "48px", backgroundColor: `${mod.color}15` }}
                      >
                        <i className={`bi ${mod.icon} fs-4`} style={{ color: mod.color }}></i>
                      </div>
                      <div className="min-w-0">
                        <h6 className="fw-bold mb-1" style={{ color: "var(--foreground)" }}>{mod.name}</h6>
                        <p className="text-muted small mb-0" style={{ fontSize: "12px", lineHeight: 1.3 }}>{mod.desc}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </>
      )}

      <>
        <h5 className="fw-semibold mb-3"><i className="bi bi-speedometer2 me-2"></i>Spa Quick Stats</h5>
        <div className="row g-3 mb-4">
          {spaCards.map((item) => (
            <div className="col-md-3" key={item.title}>
              <Link href={item.href} className="text-decoration-none">
                <div className="card interactive-card border-0 shadow-sm p-3 rounded-3 h-100">
                  <div className="d-flex align-items-center gap-3">
                    <i className={`bi ${item.icon} fs-2 ${item.color}`}></i>
                    <div>
                      <div className="text-muted small text-uppercase fw-bold">{item.title}</div>
                      <div className={`fs-4 fw-bold counter-value ${item.color}`}>{item.value}</div>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </>

      {stats.recentMembers?.length > 0 && (
        <div className="card border-0 shadow-sm">
          <div className="card-header fw-semibold d-flex justify-content-between align-items-center" style={{ backgroundColor: "var(--card-bg)", borderBottom: "1px solid var(--card-border)" }}>
            <span>Recent Members</span>
            <Link href="/dashboard/spa/customers/profiles" className="btn btn-sm btn-outline-primary">View All</Link>
          </div>
          <div className="card-body p-0">
            <table className="table table-hover mb-0">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Plan</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentMembers.map((m: any) => (
                  <tr key={m.id}>
                    <td>{m.code}</td>
                    <td>{m.first_name} {m.last_name}</td>
                    <td>{m.plan_name || "-"}</td>
                    <td>
                      {m.status === "active" ? (
                        <span className="badge bg-success">Active</span>
                      ) : m.status === "expired" ? (
                        <span className="badge bg-danger">Expired</span>
                      ) : (
                        <span className="badge bg-secondary">{m.status}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="text-center text-muted small mt-4">
        <i className="bi bi-building me-1"></i>{companyName || "Rotana Spa"} &middot;
        <i className="bi bi-laptop ms-2 me-1"></i>Rotana Spa Management System
      </div>
    </div>
  );
}
