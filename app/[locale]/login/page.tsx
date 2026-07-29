"use client";

import { useEffect, useState } from "react";
import { Link } from "@/lib/i18n/navigation";
import { useTheme } from "@/components/ThemeProvider";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function LoginPortal() {
  const { theme, toggle } = useTheme();
  const [existingUser, setExistingUser] = useState<any>(null);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) setExistingUser(JSON.parse(stored));
  }, []);

  return (
    <div className="d-flex justify-content-center align-items-center vh-100" style={{ background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)" }}>
      <div style={{ position: "absolute", top: 20, right: 20 }} className="d-flex gap-2">
        <div className="mt-1"><LanguageSwitcher /></div>
        <button onClick={toggle} className="theme-toggle" title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
          <i className={`bi ${theme === 'light' ? 'bi-moon-stars' : 'bi-sun'} fs-4 text-white`}></i>
        </button>
      </div>

      <div className="card border-0 shadow-lg p-4" style={{ width: "520px", borderRadius: "12px" }}>
        <div className="text-center mb-4">
          <div className="bg-primary text-white d-inline-flex align-items-center justify-content-center rounded-circle mb-3" style={{ width: "60px", height: "60px" }}>
            <i className="bi bi-grid-fill fs-3"></i>
          </div>
          <h3 className="fw-bold">Rotana Spa</h3>
          <p className="text-muted small">Select your login type</p>
        </div>

        {existingUser && (
          <div className="alert alert-warning py-2 small mb-3 d-flex justify-content-between align-items-center">
            <span><i className="bi bi-info-circle me-1"></i>Logged in as <strong>{existingUser.name || existingUser.email}</strong></span>
            <button className="btn btn-sm btn-outline-warning" onClick={() => { localStorage.clear(); setExistingUser(null); }}>
              <i className="bi bi-box-arrow-right me-1"></i>Logout
            </button>
          </div>
        )}

        <div className="d-flex flex-column gap-3">
          <Link href="/login/admin" className="btn btn-outline-dark text-start p-3 d-flex align-items-center gap-3 border-2" style={{ borderRadius: "10px" }}>
            <div className="bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center rounded" style={{ width: "44px", height: "44px", minWidth: "44px" }}>
              <i className="bi bi-shield-lock fs-4"></i>
            </div>
            <div>
              <div className="fw-bold">Super Admin</div>
              <div className="small text-muted">Full system access across all companies</div>
            </div>
            <i className="bi bi-chevron-right ms-auto text-muted"></i>
          </Link>

          <Link href="/login/company" className="btn btn-outline-dark text-start p-3 d-flex align-items-center gap-3 border-2" style={{ borderRadius: "10px" }}>
            <div className="bg-success bg-opacity-10 text-success d-flex align-items-center justify-content-center rounded" style={{ width: "44px", height: "44px", minWidth: "44px" }}>
              <i className="bi bi-building fs-4"></i>
            </div>
            <div>
              <div className="fw-bold">Company Admin</div>
              <div className="small text-muted">Manage your company's HR & operations</div>
            </div>
            <i className="bi bi-chevron-right ms-auto text-muted"></i>
          </Link>

          <Link href="/login/guest" className="btn btn-outline-dark text-start p-3 d-flex align-items-center gap-3 border-2" style={{ borderRadius: "10px" }}>
            <div className="bg-warning bg-opacity-10 text-warning d-flex align-items-center justify-content-center rounded" style={{ width: "44px", height: "44px", minWidth: "44px" }}>
              <i className="bi bi-eye fs-4"></i>
            </div>
            <div>
              <div className="fw-bold">Guest</div>
              <div className="small text-muted">View-only access to company data</div>
            </div>
            <i className="bi bi-chevron-right ms-auto text-muted"></i>
          </Link>
        </div>

        <div className="text-center mt-4">
          <small className="text-muted">
            Demo super admin: admin@rotana.com / 123456<br />
            Demo company admin: TIN-000001 / admin@gmail.com / 123456
          </small>
        </div>
      </div>
    </div>
  );
}
