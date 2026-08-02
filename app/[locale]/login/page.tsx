"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Leaf, LockKeyhole, Mail, ShieldCheck, Sparkles } from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const rememberedEmail = localStorage.getItem("rotana-remembered-email");
      if (rememberedEmail) setEmail(rememberedEmail);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("user", JSON.stringify(data.user));
        localStorage.setItem("token", data.token);
        if (remember) localStorage.setItem("rotana-remembered-email", email);
        else localStorage.removeItem("rotana-remembered-email");
        router.push("/dashboard");
        return;
      }
      setError(data.error || "We couldn’t sign you in with those details.");
    } catch {
      setError("We couldn’t reach the server. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-showcase" aria-label="Rotana Spa welcome">
        <div className="auth-brand">
          <span className="auth-brand-mark"><Leaf /></span>
          <span>Rotana Spa<small>Operations suite</small></span>
        </div>

        <div className="auth-story">
          <div className="auth-story-tag"><Sparkles size={14} /> CALM OPERATIONS, BEAUTIFUL DAYS</div>
          <h1>Every guest moment, beautifully orchestrated.</h1>
          <p>Bring scheduling, memberships and your daily floor operations together in one composed workspace.</p>
          <div className="auth-quote"><i />Thoughtful service begins with a clear day.</div>
        </div>

        <div className="auth-showcase-footer"><span>ROTANA SPA MANAGEMENT</span><span>PRIVATE &amp; SECURE</span></div>
      </section>

      <section className="auth-main">
        <div className="auth-language"><LanguageSwitcher /></div>
        <div className="auth-form-wrap">
          <div className="auth-mobile-brand"><span className="auth-brand-mark"><Leaf size={18} /></span>Rotana Spa</div>
          <header className="auth-form-header">
            <div className="eyebrow">WELCOME BACK</div>
            <h2>Sign in to your space</h2>
            <p>Use your staff account to continue to the Rotana workspace.</p>
          </header>

          <form onSubmit={login} noValidate>
            {error && <div className="auth-error" role="alert"><ShieldCheck size={16} />{error}</div>}

            <div className="mb-3">
              <label className="auth-form-label" htmlFor="email">Work email</label>
              <div className="auth-field">
                <Mail className="field-icon" size={17} />
                <input id="email" type="email" autoComplete="email" placeholder="you@rotanaspa.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </div>
            </div>

            <div>
              <label className="auth-form-label" htmlFor="password">Password</label>
              <div className="auth-field">
                <LockKeyhole className="field-icon" size={17} />
                <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required />
                <button className="auth-password-toggle" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <div className="auth-options">
              <label className="auth-check"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />Remember my email</label>
              <button className="auth-help-link" type="button" onClick={() => setError("Please contact your spa administrator to reset your password.")}>Need help?</button>
            </div>

            <button className="auth-submit" type="submit" disabled={loading}>
              {loading ? <><span className="spinner-border spinner-border-sm" aria-hidden="true" /> Signing you in…</> : <>Continue to workspace <span aria-hidden="true">→</span></>}
            </button>
          </form>
          <p className="auth-security-note"><ShieldCheck size={14} />Your workspace is protected with secure access.</p>
        </div>
      </section>
    </main>
  );
}
