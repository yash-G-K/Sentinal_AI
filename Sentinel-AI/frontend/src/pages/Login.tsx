// src/pages/Login.tsx
import React, { useState } from "react";
import { Shield, Eye, EyeOff, Loader2, AlertCircle, Lock, Mail } from "lucide-react";

interface LoginProps {
  onLogin: (token: string, user: AuthUser) => void;
  onGoToSignup?: () => void;
}

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  mfa_enabled: boolean;
}

export function Login({ onLogin, onGoToSignup }: LoginProps) {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Please enter your email and password."); return; }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Invalid credentials.");
      } else {
        localStorage.setItem("sentinel_token", data.access_token);
        localStorage.setItem("sentinel_user", JSON.stringify(data.user));
        onLogin(data.access_token, data.user);
      }
    } catch {
      setError("Cannot connect to server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ backgroundColor: "var(--bg)" }}>

      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-20 animate-pulse"
          style={{ background: "radial-gradient(circle, #3b82f6, transparent)", filter: "blur(60px)" }} />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full opacity-20 animate-pulse"
          style={{ background: "radial-gradient(circle, #8b5cf6, transparent)", filter: "blur(60px)", animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-5"
          style={{ background: "radial-gradient(circle, #06b6d4, transparent)", filter: "blur(80px)" }} />
      </div>

      <div className="relative w-full max-w-md px-4">
        {/* Logo + Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-2xl"
            style={{ background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)" }}>
            <Shield size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tight" style={{ color: "var(--fg)" }}>
            Sentinel<span style={{ color: "#3b82f6" }}>AI</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted-fg)" }}>
            AI-Powered Web Application Firewall
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8 shadow-2xl"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          <h2 className="text-lg font-bold mb-1" style={{ color: "var(--fg)" }}>Sign in to your account</h2>
          <p className="text-xs mb-6" style={{ color: "var(--muted-fg)" }}>
            Enter your credentials to access the dashboard
          </p>

          {/* Error banner */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2.5 mb-4 text-xs"
              style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
              <AlertCircle size={14} className="shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--fg)" }}>
                Email address
              </label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--muted-fg)" }} />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@sentinel.ai"
                  className="w-full h-10 pl-9 pr-3 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  style={{
                    backgroundColor: "var(--muted)", borderColor: "var(--border)", color: "var(--fg)",
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--fg)" }}>
                Password
              </label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--muted-fg)" }} />
                <input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-10 pl-9 pr-10 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  style={{
                    backgroundColor: "var(--muted)", borderColor: "var(--border)", color: "var(--fg)",
                  }}
                />
                <button type="button" onClick={() => setShowPwd(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
                  style={{ color: "var(--muted-fg)" }}>
                  {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)" }}>
              {loading ? <><Loader2 size={15} className="animate-spin" /> Signing in…</> : "Sign in"}
            </button>
          </form>

          {/* Demo hints */}
          <div className="mt-6 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--muted-fg)" }}>
              Demo credentials
            </p>
            <div className="space-y-1">
              {[
                { email: "admin@sentinel.ai",  pwd: "Admin@1234",  role: "Super Admin" },
                { email: "alice@sentinel.ai",  pwd: "Admin@123",   role: "Admin" },
                { email: "bob@sentinel.ai",    pwd: "Analyst@123", role: "SOC Analyst" },
              ].map(c => (
                <button key={c.email} type="button"
                  onClick={() => { setEmail(c.email); setPassword(c.pwd); setError(""); }}
                  className="w-full flex items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: "var(--muted)" }}>
                  <span style={{ color: "var(--fg)" }}>{c.email}</span>
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{ backgroundColor: "#dbeafe", color: "#1d4ed8" }}>{c.role}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sign up link */}
          {onGoToSignup && (
            <div className="mt-4 text-center">
              <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={onGoToSignup}
                  className="font-semibold hover:underline transition-colors"
                  style={{ color: "#3b82f6" }}
                >
                  Create one
                </button>
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-xs mt-4" style={{ color: "var(--muted-fg)" }}>
          Protected by Sentinel-AI WAF · All sessions are logged
        </p>
      </div>
    </div>
  );
}
