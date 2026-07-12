// src/pages/Traffic.tsx
import { useState, useEffect } from "react";
import { Activity, RefreshCw, AlertTriangle, Shield, CheckCircle, Search, Filter } from "lucide-react";
import { apiFetch } from "../components/api";

interface RequestData {
  id: number;
  ip_address: string;
  method: string;
  protocol: string;
  host: string;
  endpoint: string;
  response_status: number;
  response_time_ms: number;
  decision: string;
  country?: string;
  created_at: string;
}

const MOCK_TRAFFIC: RequestData[] = [
  { id: 1, ip_address: "185.220.101.47", method: "GET", protocol: "HTTP/2", host: "api.sentinel.ai", endpoint: "/api/v1/users", response_status: 403, response_time_ms: 12, decision: "blocked", country: "RU", created_at: new Date().toISOString() },
  { id: 2, ip_address: "8.8.8.8", method: "POST", protocol: "HTTP/1.1", host: "api.sentinel.ai", endpoint: "/auth/token", response_status: 200, response_time_ms: 45, decision: "allowed", country: "US", created_at: new Date(Date.now() - 10000).toISOString() },
  { id: 3, ip_address: "45.33.32.156", method: "GET", protocol: "HTTP/2", host: "api.sentinel.ai", endpoint: "/wp-admin", response_status: 404, response_time_ms: 8, decision: "allowed", country: "US", created_at: new Date(Date.now() - 25000).toISOString() },
  { id: 4, ip_address: "192.168.1.1", method: "PUT", protocol: "HTTP/1.1", host: "api.sentinel.ai", endpoint: "/api/v1/rules/12", response_status: 204, response_time_ms: 18, decision: "allowed", country: "Local", created_at: new Date(Date.now() - 40000).toISOString() },
  { id: 5, ip_address: "103.21.244.12", method: "POST", protocol: "HTTP/2", host: "api.sentinel.ai", endpoint: "/api/v1/feedback", response_status: 403, response_time_ms: 14, decision: "blocked", country: "CN", created_at: new Date(Date.now() - 60000).toISOString() },
];

export function Traffic() {
  const [requests, setRequests] = useState<RequestData[]>(MOCK_TRAFFIC);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterDecision, setFilterDecision] = useState("all");

  const loadTraffic = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ items: RequestData[] }>("/requests?size=40");
      if (data && data.items) {
        setRequests(data.items);
      }
    } catch {
      // Fallback already matches mock
    } finally {
      setTimeout(() => setLoading(false), 600);
    }
  };

  useEffect(() => {
    loadTraffic();
    const interval = setInterval(loadTraffic, 10000);
    return () => clearInterval(interval);
  }, []);

  const filtered = requests.filter(r => {
    const matchesSearch = r.endpoint.toLowerCase().includes(search.toLowerCase()) || r.ip_address.includes(search);
    const matchesDecision = filterDecision === "all" || (filterDecision === "blocked" ? r.decision.includes("block") : r.decision.includes("allow"));
    return matchesSearch && matchesDecision;
  });

  return (
    <div className="space-y-4 max-w-screen-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--fg)" }}>Traffic Stream</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted-fg)" }}>
            Live traffic activity and WAF decision tracking
          </p>
        </div>
        <button
          onClick={loadTraffic}
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
            placeholder="Search path, IP..."
            className="h-8 w-full rounded-md border pl-7 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ backgroundColor: "var(--muted)", borderColor: "var(--border)", color: "var(--fg)" }}
          />
        </div>
        <select
          value={filterDecision}
          onChange={e => setFilterDecision(e.target.value)}
          className="h-8 rounded-md border px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{ backgroundColor: "var(--muted)", borderColor: "var(--border)", color: "var(--fg)" }}
        >
          <option value="all">All Decisions</option>
          <option value="allowed">Allowed</option>
          <option value="blocked">Blocked</option>
        </select>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr style={{ backgroundColor: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
                <th className="px-4 py-2 text-xs font-semibold" style={{ color: "var(--muted-fg)" }}>Timestamp</th>
                <th className="px-4 py-2 text-xs font-semibold" style={{ color: "var(--muted-fg)" }}>Source IP</th>
                <th className="px-4 py-2 text-xs font-semibold" style={{ color: "var(--muted-fg)" }}>Country</th>
                <th className="px-4 py-2 text-xs font-semibold" style={{ color: "var(--muted-fg)" }}>Method</th>
                <th className="px-4 py-2 text-xs font-semibold" style={{ color: "var(--muted-fg)" }}>Endpoint</th>
                <th className="px-4 py-2 text-xs font-semibold" style={{ color: "var(--muted-fg)" }}>Latency</th>
                <th className="px-4 py-2 text-xs font-semibold" style={{ color: "var(--muted-fg)" }}>Status</th>
                <th className="px-4 py-2 text-xs font-semibold text-right" style={{ color: "var(--muted-fg)" }}>Decision</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-b" style={{ borderColor: "var(--border)" }}>
                  <td className="px-4 py-2 text-xs font-mono" style={{ color: "var(--muted-fg)" }}>
                    {new Date(r.created_at + (r.created_at.endsWith("Z") ? "" : "Z")).toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-2 text-xs font-mono font-medium" style={{ color: "var(--fg)" }}>{r.ip_address}</td>
                  <td className="px-4 py-2 text-xs" style={{ color: "var(--fg)" }}>{r.country || "—"}</td>
                  <td className="px-4 py-2 text-xs font-semibold" style={{ color: "var(--fg)" }}>{r.method}</td>
                  <td className="px-4 py-2 text-xs font-mono truncate max-w-[200px]" style={{ color: "var(--fg)" }} title={r.endpoint}>{r.endpoint}</td>
                  <td className="px-4 py-2 text-xs font-mono" style={{ color: "var(--muted-fg)" }}>{r.response_time_ms} ms</td>
                  <td className="px-4 py-2 text-xs font-mono font-semibold" style={{ color: r.response_status < 400 ? "#10b981" : "#ef4444" }}>
                    {r.response_status}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                      style={{
                        backgroundColor: r.decision.includes("block") ? "#fef2f2" : "#f0fdf4",
                        color: r.decision.includes("block") ? "#dc2626" : "#15803d",
                      }}>
                      {r.decision.includes("block") ? <Shield size={10} /> : <CheckCircle size={10} />}
                      {r.decision}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
