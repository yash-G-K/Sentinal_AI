import { Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";
import { AppLayout }         from "./components/layout/AppLayout";
import { Dashboard }         from "./pages/Dashboard";
import { Analytics }         from "./pages/Analytics";
import { ThreatIntelligence } from "./pages/ThreatIntelligence";
import { AuditLogs }         from "./pages/AuditLogs";
import { Traffic }           from "./pages/Traffic";
import { Requests }          from "./pages/Requests";
import { Alerts }            from "./pages/Alerts";
import { Users }             from "./pages/Users";
import { ApiKeys }           from "./pages/ApiKeys";
import { Settings }          from "./pages/Settings";
import { FirewallRules }     from "./pages/FirewallRules";
import { SOCAssistant }      from "./pages/SOCAssistant";
import { Domains }           from "./pages/Domains";
import { Login }             from "./pages/Login";
import { Signup }            from "./pages/Signup";
import type { AuthUser }     from "./pages/Login";

// ── Auth helpers ─────────────────────────────────────────────────────────────
function getStoredAuth(): { token: string; user: AuthUser } | null {
  try {
    const token = localStorage.getItem("sentinel_token");
    const raw   = localStorage.getItem("sentinel_user");
    if (token && raw) return { token, user: JSON.parse(raw) };
  } catch {}
  return null;
}

// ── App ───────────────────────────────────────────────────────────────────────
type AuthView = "login" | "signup";

export default function App() {
  const [auth,     setAuth]     = useState<{ token: string; user: AuthUser } | null>(getStoredAuth);
  const [authView, setAuthView] = useState<AuthView>("login");

  const handleLogin = (token: string, user: AuthUser) => {
    setAuth({ token, user });
  };

  const handleLogout = () => {
    localStorage.removeItem("sentinel_token");
    localStorage.removeItem("sentinel_user");
    setAuth(null);
    setAuthView("login");
  };

  // ── Unauthenticated: show Login or Signup ────────────────────────────────
  if (!auth) {
    if (authView === "signup") {
      return (
        <Signup
          onSignupSuccess={() => setAuthView("login")}
          onGoToLogin={() => setAuthView("login")}
        />
      );
    }
    return (
      <Login
        onLogin={handleLogin}
        onGoToSignup={() => setAuthView("signup")}
      />
    );
  }

  // ── Authenticated ────────────────────────────────────────────────────────
  return (
    <AppLayout user={auth.user} onLogout={handleLogout}>
      <Routes>
        <Route path="/"            element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard"   element={<Dashboard />} />
        <Route path="/traffic"     element={<Traffic />} />
        <Route path="/threats"     element={<ThreatIntelligence />} />
        <Route path="/requests"    element={<Requests />} />
        <Route path="/analytics"   element={<Analytics />} />
        <Route path="/audit-logs"  element={<AuditLogs />} />
        <Route path="/alerts"      element={<Alerts />} />
        <Route path="/users"       element={<Users currentUser={auth.user} />} />
        <Route path="/api-keys"    element={<ApiKeys />} />
        <Route path="/settings"    element={<Settings />} />
        <Route path="/domains"     element={<Domains />} />
        <Route path="/firewall"    element={<FirewallRules />} />
        <Route path="/assistant"   element={<SOCAssistant />} />
        <Route path="*"            element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AppLayout>
  );
}
