// src/pages/Signup.tsx
import React, { useState } from "react";
import {
  Shield, Eye, EyeOff, Loader2, AlertCircle, Lock, Mail,
  User, CheckCircle2, ChevronRight,
} from "lucide-react";

interface SignupProps {
  onSignupSuccess: () => void;
  onGoToLogin: () => void;
}

type StrengthLevel = 0 | 1 | 2 | 3 | 4;

function getPasswordStrength(pwd: string): StrengthLevel {
  let score = 0;
  if (pwd.length >= 8)           score++;
  if (/[A-Z]/.test(pwd))         score++;
  if (/[0-9]/.test(pwd))         score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return score as StrengthLevel;
}

const STRENGTH_LABELS: Record<StrengthLevel, string> = {
  0: "Too weak", 1: "Weak", 2: "Fair", 3: "Good", 4: "Strong",
};
const STRENGTH_COLORS: Record<StrengthLevel, string> = {
  0: "#ef4444", 1: "#f97316", 2: "#eab308", 3: "#22c55e", 4: "#10b981",
};
const ROLES = ["SOC Analyst", "Security Admin", "API Developer", "Viewer"];

export function Signup({ onSignupSuccess, onGoToLogin }: SignupProps) {
  const [fullName, setFullName] = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [role,     setRole]     = useState("SOC Analyst");
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState(false);

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!fullName.trim())    { setError("Full name is required."); return; }
    if (!email.trim())       { setError("Email address is required."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/signup", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName, email, password, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Registration failed. Please try again.");
      } else {
        setSuccess(true);
        setTimeout(() => onSignupSuccess(), 2200);
      }
    } catch {
      setError("Cannot connect to server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ backgroundColor: "var(--bg)" }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-20 animate-pulse"
          style={{ background: "radial-gradient(circle, #8b5cf6, transparent)", filter: "blur(70px)" }}
        />
        <div
          className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full opacity-20 animate-pulse"
          style={{ background: "radial-gradient(circle, #3b82f6, transparent)", filter: "blur(70px)", animationDelay: "1.2s" }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-5"
          style={{ background: "radial-gradient(circle, #06b6d4, transparent)", filter: "blur(90px)" }}
        />
      </div>

      <div className="relative w-full max-w-md px-4 py-8">
        <div className="text-center mb-7">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-2xl"
            style={{ background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)" }}
          >
            <Shield size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tight" style={{ color: "var(--fg)" }}>
            Sentinel<span style={{ color: "#3b82f6" }}>AI</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted-fg)" }}>
            AI-Powered Web Application Firewall
          </p>
        </div>

        <div
          className="rounded-2xl p-8 shadow-2xl"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
        >
          {success ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg"
                style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)" }}
              >
                <CheckCircle2 size={36} className="text-white" />
              </div>
              <h2 className="text-lg font-bold" style={{ color: "var(--fg)" }}>Account Created!</h2>
              <p className="text-sm leading-relaxed" style={{ color: "var(--muted-fg)" }}>
                Your account has been created successfully.<br />
                Redirecting you to the login page...
              </p>
              <div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    background: "linear-gradient(90deg, #3b82f6, #8b5cf6)",
                    animation: "sentinelShrink 2.2s linear forwards",
                  }}
                />
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-bold mb-1" style={{ color: "var(--fg)" }}>
                Create your account
              </h2>
              <p className="text-xs mb-6" style={{ color: "var(--muted-fg)" }}>
                Sign up to access the Sentinel-AI dashboard
              </p>

              {error && (
                <div
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 mb-4 text-xs"
                  style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}
                >
                  <AlertCircle size={14} className="shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--fg)" }}>Full name</label>
                  <div className="relative">
                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-fg)" }} />
                    <input
                      id="signup-name"
                      type="text"
                      autoComplete="name"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      placeholder="Jane Smith"
                      className="w-full h-10 pl-9 pr-3 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      style={{ backgroundColor: "var(--muted)", borderColor: "var(--border)", color: "var(--fg)" }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--fg)" }}>Email address</label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-fg)" }} />
                    <input
                      id="signup-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@sentinel.ai"
                      className="w-full h-10 pl-9 pr-3 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      style={{ backgroundColor: "var(--muted)", borderColor: "var(--border)", color: "var(--fg)" }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--fg)" }}>Role</label>
                  <select
                    id="signup-role"
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    className="w-full h-10 pl-3 pr-8 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none"
                    style={{ backgroundColor: "var(--muted)", borderColor: "var(--border)", color: "var(--fg)" }}
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--fg)" }}>Password</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-fg)" }} />
                    <input
                      id="signup-password"
                      type={showPwd ? "text" : "password"}
                      autoComplete="new-password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      className="w-full h-10 pl-9 pr-10 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      style={{ backgroundColor: "var(--muted)", borderColor: "var(--border)", color: "var(--fg)" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
                      style={{ color: "var(--muted-fg)" }}
                    >
                      {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {password.length > 0 && (
                    <div className="mt-2">
                      <div className="flex gap-1 mb-1">
                        {[1, 2, 3, 4].map(i => (
                          <div
                            key={i}
                            className="flex-1 h-1 rounded-full transition-all duration-300"
                            style={{ backgroundColor: i <= strength ? STRENGTH_COLORS[strength] : "var(--border)" }}
                          />
                        ))}
                      </div>
                      <p className="text-[10px] font-medium" style={{ color: STRENGTH_COLORS[strength] }}>
                        {STRENGTH_LABELS[strength]}
                      </p>
                    </div>
                  )}
                </div>

                <button
                  id="signup-submit"
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)" }}
                >
                  {loading
                    ? <><Loader2 size={15} className="animate-spin" /> Creating account...</>
                    : <><span>Create account</span><ChevronRight size={15} /></>
                  }
                </button>
              </form>

              <div className="mt-6 pt-4 border-t text-center" style={{ borderColor: "var(--border)" }}>
                <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={onGoToLogin}
                    className="font-semibold hover:underline transition-colors"
                    style={{ color: "#3b82f6" }}
                  >
                    Sign in
                  </button>
                </p>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-xs mt-4" style={{ color: "var(--muted-fg)" }}>
          Protected by Sentinel-AI WAF · All sessions are logged
        </p>
      </div>

      <style>{`
        @keyframes sentinelShrink {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </div>
  );
}
