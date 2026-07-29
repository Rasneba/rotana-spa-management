"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      setLoading(false);

      if (res.ok) {
        localStorage.setItem("user", JSON.stringify(data.user));
        localStorage.setItem("token", data.token);
        router.push("/dashboard");
      } else {
        setError(data.error || "Login failed");
      }
    } catch {
      setLoading(false);
      setError("Server error");
    }
  };

  return (
    <div className="d-flex justify-content-center align-items-center vh-100" style={{ background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)" }}>
      <div style={{ position: "absolute", top: 20, right: 20 }}>
        <LanguageSwitcher />
      </div>
      <div className="card border-0 shadow-lg p-4" style={{ width: "400px", borderRadius: "12px" }}>
        <div className="text-center mb-4">
          <div className="bg-primary text-white d-inline-flex align-items-center justify-content-center rounded-circle mb-3" style={{ width: "60px", height: "60px" }}>
            <i className="bi bi-grid-fill fs-3"></i>
          </div>
          <h3 className="fw-bold">Rotana Spa</h3>
          <p className="text-muted small">Sign in to your account</p>
        </div>

        <form onSubmit={login}>
          <div className="mb-3">
            <label className="form-label small fw-semibold">Email</label>
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-envelope"></i></span>
              <input className="form-control" type="email" placeholder="Enter your email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label small fw-semibold">Password</label>
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-lock"></i></span>
              <input type="password" className="form-control" placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
          </div>

          {error && <div className="alert alert-danger py-2 small">{error}</div>}

          <button type="submit" className="btn btn-primary w-100 py-2 fw-semibold" disabled={loading}>
            {loading ? (
              <span><span className="spinner-border spinner-border-sm me-2" role="status"></span>Signing in...</span>
            ) : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
