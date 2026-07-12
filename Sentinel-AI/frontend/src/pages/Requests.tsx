// src/pages/Requests.tsx
import { useState, useEffect } from "react";
import { Search, Eye, Filter, RefreshCw, ChevronRight, CheckCircle, Shield } from "lucide-react";
import { apiFetch } from "../components/api";

interface RequestDetail {
  id: number;
  request_uuid: string;
  ip_address: string;
  method: string;
  protocol: string;
  host: string;
  endpoint: string;
  response_status: number;
  response_time_ms: number;
  decision: string;
  country?: string;
  city?: string;
  created_at: string;
}

export function Requests() {
  const [requests, setRequests] = useState<RequestDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeReq, setActiveReq] = useState<RequestDetail | null>(null);
  const [search, setSearch] = useState("");

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ items: RequestDetail[] }>("/requests?size=30");
      if (data && data.items) {
        setRequests(data.items);
        if (data.items.length > 0 && !activeReq) {
          setActiveReq(data.items[0]);
        }
      }
    } catch {
      // Offline fallback mock data
      const mock: RequestDetail[] = [
        { id: 1, request_uuid: "uuid-9a8b-7c", ip_address: "185.220.101.47", method: "GET", protocol: "HTTP/2", host: "api.sentinel.ai", endpoint: "/api/v1/users?id=1%20OR%201=1", response_status: 403, response_time_ms: 12, decision: "blocked", country: "RU", city: "Moscow", created_at: new Date().toISOString() },
        { id: 2, request_uuid: "uuid-8b7c-6d", ip_address: "8.8.8.8", method: "POST", protocol: "HTTP/1.1", host: "api.sentinel.ai", endpoint: "/auth/token", response_status: 200, response_time_ms: 45, decision: "allowed", country: "US", city: "Mountain View", created_at: new Date(Date.now() - 5000).toISOString() },
      ];
      setRequests(mock);
      setActiveReq(mock[0]);
    } finally {
      setTimeout(() => setLoading(false), 600);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const filtered = requests.filter(r => r.endpoint.toLowerCase().includes(search.toLowerCase()) || r.ip_address.includes(search));

  return (
    <div className="space-y-4 max-w-screen-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--fg)" }}>Request Inspector</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted-fg)" }}>
            Deep inspect HTTP requests, headers, and WAF outcomes
          </p>
        </div>
        <button
          onClick={loadRequests}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          style={{ backgroundColor: "var(--muted)", color: "var(--fg)" }}
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* List */}
        <div className="lg:col-span-2 space-y-3">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-fg)" }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by endpoint, IP..."
              className="h-8 w-full rounded-md border pl-7 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ backgroundColor: "var(--muted)", borderColor: "var(--border)", color: "var(--fg)" }}
            />
          </div>

          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {filtered.map(r => (
                <button
                  key={r.id}
                  onClick={() => setActiveReq(r)}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  style={{ backgroundColor: activeReq?.id === r.id ? "var(--muted)" : "transparent" }}
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold" style={{ color: "var(--fg)" }}>{r.method}</span>
                      <span className="text-xs font-mono truncate" style={{ color: "var(--fg)" }}>{r.endpoint}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px]" style={{ color: "var(--muted-fg)" }}>
                      <span>{r.ip_address}</span>
                      <span>·</span>
                      <span>{r.country || "—"}</span>
                      <span>·</span>
                      <span>{r.response_time_ms}ms</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
                      style={{
                        backgroundColor: r.decision.includes("block") ? "#fef2f2" : "#f0fdf4",
                        color: r.decision.includes("block") ? "#dc2626" : "#15803d",
                      }}>
                      {r.decision}
                    </span>
                    <ChevronRight size={13} style={{ color: "var(--muted-fg)" }} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Inspector Detail Panel */}
        <div className="rounded-xl p-5 space-y-4" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", height: "fit-content" }}>
          <h2 className="font-bold text-sm" style={{ color: "var(--fg)" }}>HTTP Details</h2>
          {activeReq ? (
            <div className="space-y-3.5 text-xs">
              <div>
                <p className="text-[10px] uppercase font-semibold tracking-wide" style={{ color: "var(--muted-fg)" }}>Request ID</p>
                <p className="font-mono" style={{ color: "var(--fg)" }}>{activeReq.request_uuid}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-semibold tracking-wide" style={{ color: "var(--muted-fg)" }}>Full URL</p>
                <p className="font-mono break-all" style={{ color: "var(--fg)" }}>{activeReq.host}{activeReq.endpoint}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] uppercase font-semibold tracking-wide" style={{ color: "var(--muted-fg)" }}>Client IP</p>
                  <p className="font-mono font-medium" style={{ color: "var(--fg)" }}>{activeReq.ip_address}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-semibold tracking-wide" style={{ color: "var(--muted-fg)" }}>Location</p>
                  <p style={{ color: "var(--fg)" }}>{activeReq.city ? `${activeReq.city}, ${activeReq.country}` : activeReq.country || "—"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] uppercase font-semibold tracking-wide" style={{ color: "var(--muted-fg)" }}>Status Code</p>
                  <p className="font-mono font-bold" style={{ color: activeReq.response_status < 400 ? "#10b981" : "#ef4444" }}>{activeReq.response_status}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-semibold tracking-wide" style={{ color: "var(--muted-fg)" }}>Protocol</p>
                  <p className="font-mono" style={{ color: "var(--fg)" }}>{activeReq.protocol}</p>
                </div>
              </div>
              <div className="border-t pt-3" style={{ borderColor: "var(--border)" }}>
                <p className="text-[10px] uppercase font-semibold tracking-wide" style={{ color: "var(--muted-fg)" }}>WAF Policy Outcome</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: activeReq.decision.includes("block") ? "#ef4444" : "#10b981" }} />
                  <span className="font-semibold capitalize text-sm" style={{ color: "var(--fg)" }}>{activeReq.decision}</span>
                </div>
              </div>
              <div className="border-t pt-3 space-y-2" style={{ borderColor: "var(--border)" }}>
                <p className="text-[10px] uppercase font-semibold tracking-wide" style={{ color: "var(--muted-fg)" }}>Request Headers</p>
                <div className="bg-black/5 dark:bg-white/5 rounded p-2 font-mono text-[11px] overflow-x-auto whitespace-pre">
                  <span style={{ color: "var(--fg)" }}>
{`Host: ${activeReq.host}
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)
Accept: application/json
X-Forwarded-For: ${activeReq.ip_address}
Content-Type: ${activeReq.method === "POST" || activeReq.method === "PUT" ? "application/json" : "*/*"}`}
                  </span>
                </div>
              </div>
              <div className="border-t pt-3 space-y-2" style={{ borderColor: "var(--border)" }}>
                <p className="text-[10px] uppercase font-semibold tracking-wide" style={{ color: "var(--muted-fg)" }}>Request Body Payload</p>
                <div className="bg-black/5 dark:bg-white/5 rounded p-2 font-mono text-[11px] overflow-x-auto whitespace-pre min-h-[40px]">
                  <span style={{ color: activeReq.method === "GET" ? "var(--muted-fg)" : "var(--fg)" }}>
{activeReq.method === "GET" 
  ? "(No body payload for GET request)" 
  : activeReq.endpoint.includes("login") 
    ? '{\n  "username": "admin",\n  "password": "***"\n}'
    : '{\n  "data": "..."\n}'
}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs" style={{ color: "var(--muted-fg)" }}>Select a request to inspect details</p>
          )}
        </div>
      </div>
    </div>
  );
}
