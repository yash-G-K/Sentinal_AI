import { useState, useEffect } from "react";
import { AlertTriangle, ShieldAlert, BellRing, RefreshCw, Clock, CheckCircle, Search } from "lucide-react";
import { apiFetch } from "../components/api";

interface SecurityEvent {
  id: number;
  event_type: string;
  severity: string;
  message: string;
  source?: string;
  created_at: string;
}

export function Alerts() {
  const [alerts, setAlerts] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters and state
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ items: SecurityEvent[] }>("/security-events?size=30");
      if (data && data.items) {
        setAlerts(data.items);
      }
    } catch {
      setAlerts([]);
    } finally {
      setTimeout(() => setLoading(false), 600);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const getSevStyles = (sev: string) => {
    switch (sev.toUpperCase()) {
      case "CRITICAL":
        return { bg: "#fef2f2", color: "#dc2626", border: "1px solid #fee2e2" };
      case "HIGH":
        return { bg: "#fff7ed", color: "#c2410c", border: "1px solid #ffedd5" };
      case "MEDIUM":
        return { bg: "#fffbeb", color: "#b45309", border: "1px solid #fef3c7" };
      default:
        return { bg: "#eff6ff", color: "#1d4ed8", border: "1px solid #dbeafe" };
    }
  };

  const handleDismiss = (id: number) => {
    setDismissed(prev => new Set(prev).add(id));
  };

  const filteredAlerts = alerts.filter(a => {
    if (dismissed.has(a.id)) return false;
    if (severityFilter !== "all" && a.severity.toLowerCase() !== severityFilter) return false;
    if (typeFilter !== "all" && a.event_type.toLowerCase() !== typeFilter) return false;
    if (search && !a.message.toLowerCase().includes(search.toLowerCase()) && !a.event_type.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4 max-w-screen-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--fg)" }}>Security Alerts</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted-fg)" }}>
            Real-time critical security alerts and system events
          </p>
        </div>
        <button
          onClick={loadAlerts}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          style={{ backgroundColor: "var(--muted)", color: "var(--fg)" }}
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", padding: "12px", borderRadius: "12px" }}>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-fg)" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search alerts..."
            className="h-8 w-full rounded-md border pl-7 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ backgroundColor: "var(--muted)", borderColor: "var(--border)", color: "var(--fg)" }}
          />
        </div>
        <select
          value={severityFilter}
          onChange={e => setSeverityFilter(e.target.value)}
          className="h-8 rounded-md border px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{ backgroundColor: "var(--muted)", borderColor: "var(--border)", color: "var(--fg)" }}
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="h-8 rounded-md border px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{ backgroundColor: "var(--muted)", borderColor: "var(--border)", color: "var(--fg)" }}
        >
          <option value="all">All Types</option>
          <option value="threat_block">Threat Block</option>
          <option value="firewall_match">Firewall Match</option>
          <option value="system_error">System Error</option>
        </select>
      </div>

      <div className="space-y-3">
        {filteredAlerts.length === 0 && (
          <p className="text-sm text-center py-10" style={{ color: "var(--muted-fg)" }}>No security events found</p>
        )}
        {filteredAlerts.map(a => {
          const style = getSevStyles(a.severity);
          return (
            <div
              key={a.id}
              className="rounded-xl p-4 flex items-start gap-3.5 transition-all hover:opacity-90 group"
              style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
            >
              <span className="rounded-lg p-2 flex-shrink-0" style={{ backgroundColor: style.bg, color: style.color }}>
                <ShieldAlert size={18} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold font-mono tracking-wider uppercase" style={{ color: style.color }}>
                      {a.event_type}
                    </span>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ backgroundColor: style.bg, color: style.color }}>
                      {a.severity}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs" style={{ color: "var(--muted-fg)" }}>
                    <Clock size={12} />
                    <span>{new Date(a.created_at + (a.created_at.endsWith("Z") ? "" : "Z")).toLocaleString()}</span>
                  </div>
                </div>
                <p className="text-sm font-medium mt-1.5" style={{ color: "var(--fg)" }}>{a.message}</p>
                <div className="mt-2.5 flex items-center justify-between gap-4 text-xs">
                  <span style={{ color: "var(--muted-fg)" }}>Source: <strong style={{ color: "var(--fg)" }}>{a.source || "Unknown"}</strong></span>
                  
                  <button 
                    onClick={() => handleDismiss(a.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider px-2 py-1 rounded"
                    style={{ color: "#10b981", backgroundColor: "#ecfdf5" }}
                  >
                    <CheckCircle size={12} />
                    Acknowledge
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
