import { useState } from "react";
import {
  Search, Bell, Moon, Sun, RotateCw, CircleUser,
  Clock, LogOut, ChevronDown, Shield,
} from "lucide-react";
import type { AuthUser } from "../../pages/Login";

function IconBtn({
  label, onClick, children,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{ borderRadius: "6px" }}
      className="flex h-8 w-8 items-center justify-center text-sm transition-colors text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      {children}
    </button>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1 text-xs" style={{ color: "var(--muted-fg)" }} title={label}>
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: ok ? "#10b981" : "#ef4444" }}
      />
      <span className="hidden md:inline">{label}</span>
    </div>
  );
}

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  "Super Admin":    { bg: "#fce7f3", color: "#be185d" },
  "Security Admin": { bg: "#ede9fe", color: "#7c3aed" },
  "SOC Analyst":    { bg: "#dbeafe", color: "#1d4ed8" },
  "Viewer":         { bg: "#f0fdf4", color: "#15803d" },
  "API Developer":  { bg: "#fff7ed", color: "#c2410c" },
};

interface TopBarProps {
  user?: AuthUser;
  onLogout?: () => void;
}

export function TopBar({ user, onLogout }: TopBarProps) {
  const [dark,       setDark]       = useState(false);
  const [time,       setTime]       = useState(new Date());
  const [showProfile, setShowProfile] = useState(false);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = () => {
    setTime(new Date());
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const roleStyle = user ? (ROLE_COLORS[user.role] ?? { bg: "#f1f5f9", color: "#475569" }) : null;

  return (
    <header
      className="flex h-14 shrink-0 items-center justify-between px-4 gap-3"
      style={{
        backgroundColor: "var(--card)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* Left – search */}
      <div className="flex items-center gap-2 flex-1 max-w-sm">
        <div className="relative w-full">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2"
            style={{ color: "var(--muted-fg)" }}
          />
          <input
            type="text"
            placeholder="Search… (Ctrl+K)"
            className="h-8 w-full rounded-md border pl-7 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{
              backgroundColor: "var(--muted)",
              borderColor: "var(--border)",
              color: "var(--fg)",
            }}
          />
        </div>
      </div>

      {/* Right – status + actions */}
      <div className="flex items-center gap-2">
        {/* Status indicators */}
        <div className="hidden sm:flex items-center gap-3 mr-1">
          <StatusPill ok={true} label="Connected" />
          <StatusPill ok={true} label="API OK" />
          <div className="flex items-center gap-1 text-xs" style={{ color: "var(--muted-fg)" }}>
            <Clock size={12} />
            <span>{time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        </div>

        <div className="h-4 w-px" style={{ backgroundColor: "var(--border)" }} />

        <IconBtn label="Refresh" onClick={refresh}>
          <RotateCw size={15} className={isRefreshing ? "animate-spin" : ""} />
        </IconBtn>
        <IconBtn label="Notifications">
          <span className="relative">
            <Bell size={15} />
            <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-red-500" />
          </span>
        </IconBtn>
        <IconBtn label={dark ? "Light mode" : "Dark mode"} onClick={toggleDark}>
          {dark ? <Sun size={15} /> : <Moon size={15} />}
        </IconBtn>

        {/* User avatar + dropdown */}
        {user ? (
          <div className="relative">
            <button
              onClick={() => setShowProfile(s => !s)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:opacity-80"
              style={{ backgroundColor: "var(--muted)" }}
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full text-white text-[10px] font-bold"
                style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)" }}>
                {user.full_name?.charAt(0).toUpperCase() ?? "U"}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-[11px] font-semibold leading-none" style={{ color: "var(--fg)" }}>
                  {user.full_name || user.email}
                </p>
                <p className="text-[10px] leading-none mt-0.5" style={{ color: "var(--muted-fg)" }}>
                  {user.role}
                </p>
              </div>
              <ChevronDown size={11} style={{ color: "var(--muted-fg)" }} />
            </button>

            {showProfile && (
              <div className="absolute right-0 top-10 z-50 w-56 rounded-xl shadow-2xl overflow-hidden"
                style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                {/* Header */}
                <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                  <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>
                    {user.full_name || user.email}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--muted-fg)" }}>{user.email}</p>
                  {roleStyle && (
                    <span className="inline-block mt-1.5 rounded px-2 py-0.5 text-[10px] font-bold"
                      style={{ backgroundColor: roleStyle.bg, color: roleStyle.color }}>
                      <Shield size={9} className="inline mr-0.5" />
                      {user.role}
                    </span>
                  )}
                </div>
                {/* Actions */}
                <div className="p-1">
                  <button
                    onClick={() => { setShowProfile(false); onLogout?.(); }}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs transition-colors hover:opacity-80"
                    style={{ color: "#dc2626" }}
                  >
                    <LogOut size={13} />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <IconBtn label="Profile">
            <CircleUser size={17} />
          </IconBtn>
        )}
      </div>
    </header>
  );
}
