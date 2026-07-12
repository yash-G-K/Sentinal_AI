/**
 * components/dashboard/LiveThreatFeed.tsx
 * Real-time scrolling threat event feed powered by WebSocket.
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { Shield, Wifi, WifiOff, Loader2, AlertTriangle, Zap, Bug } from "lucide-react";
import { useWebSocket, type WSMessage } from "../../hooks/useWebSocket";

interface ThreatEvent {
  id: string;
  attack_type: string;
  severity: string;
  confidence: number;
  ip: string;
  country: string;
  endpoint: string;
  method: string;
  blocked: boolean;
  ts: string;
}

const SEV_STYLES: Record<string, { bg: string; color: string; pulse: string }> = {
  CRITICAL: { bg: "#fef2f2", color: "#dc2626", pulse: "#dc262633" },
  HIGH:     { bg: "#fff7ed", color: "#c2410c", pulse: "#c2410c33" },
  MEDIUM:   { bg: "#fffbeb", color: "#b45309", pulse: "#b4530933" },
  LOW:      { bg: "#f0fdf4", color: "#15803d", pulse: "#15803d33" },
};

function AttackIcon({ type }: { type: string }) {
  const t = type.toLowerCase();
  if (t.includes("sql"))  return <Bug size={12} />;
  if (t.includes("xss"))  return <Zap size={12} />;
  if (t.includes("path")) return <AlertTriangle size={12} />;
  return <Shield size={12} />;
}

const MAX_EVENTS = 50;

export function LiveThreatFeed() {
  const [events, setEvents] = useState<ThreatEvent[]>([]);
  const [flash,  setFlash]  = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMessage = useCallback((msg: WSMessage) => {
    if (msg.type !== "threat") return;
    const d = msg.data as ThreatEvent;
    const evt: ThreatEvent = {
      ...d,
      id: `${Date.now()}-${Math.random()}`,
    };
    setEvents(prev => [evt, ...prev].slice(0, MAX_EVENTS));

    // Flash the header
    setFlash(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(false), 800);
  }, []);

  const wsStatus = useWebSocket("/api/v1/ws/threats", handleMessage);

  // Auto-scroll to top when new event arrives
  useEffect(() => {
    listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [events.length]);

  const card = { backgroundColor: "var(--card)", border: "1px solid var(--border)" };

  return (
    <div className="rounded-xl overflow-hidden flex flex-col" style={{ ...card, height: "100%" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{
          borderColor: "var(--border)",
          backgroundColor: flash ? "#dc262608" : "var(--card)",
          transition: "background-color 0.3s",
        }}>
        <div className="flex items-center gap-2">
          <Shield size={15} style={{ color: flash ? "#dc2626" : "var(--primary)" }}
            className="transition-colors duration-300" />
          <span className="text-xs font-bold" style={{ color: "var(--fg)" }}>
            Live Threat Feed
          </span>
          {events.length > 0 && (
            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
              style={{ backgroundColor: "#fef2f2", color: "#dc2626" }}>
              {events.length}
            </span>
          )}
        </div>

        {/* Connection indicator */}
        <div className="flex items-center gap-1.5 text-[11px]"
          style={{ color: wsStatus.connected ? "#10b981" : "#f59e0b" }}>
          {wsStatus.connected
            ? <><Wifi size={11} className="shrink-0" /> Live</>
            : wsStatus.reconnecting
              ? <><Loader2 size={11} className="animate-spin shrink-0" /> Reconnecting…</>
              : <><WifiOff size={11} className="shrink-0" /> Offline</>}
        </div>
      </div>

      {/* Event list */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
            <div className="h-10 w-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "var(--muted)" }}>
              <Shield size={18} style={{ color: "var(--muted-fg)" }} />
            </div>
            <p className="text-xs font-medium" style={{ color: "var(--muted-fg)" }}>
              {wsStatus.connected ? "No threats detected · monitoring…" : "Connecting to threat feed…"}
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {events.map((evt, idx) => {
              const sev = SEV_STYLES[evt.severity?.toUpperCase()] ?? SEV_STYLES.LOW;
              const isNew = idx === 0;
              return (
                <div key={evt.id}
                  className="px-4 py-2.5 transition-all duration-300"
                  style={{
                    backgroundColor: isNew ? sev.pulse : "transparent",
                    animation: isNew ? "none" : undefined,
                  }}>
                  <div className="flex items-start justify-between gap-2">
                    {/* Left */}
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold shrink-0 flex items-center gap-1"
                        style={{ backgroundColor: sev.bg, color: sev.color }}>
                        <AttackIcon type={evt.attack_type} />
                        {evt.severity?.toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold truncate" style={{ color: "var(--fg)" }}>
                          {evt.attack_type?.replace(/_/g, " ")}
                        </p>
                        <p className="text-[10px] truncate" style={{ color: "var(--muted-fg)" }}>
                          <span className="font-mono">{evt.ip}</span>
                          {evt.country && evt.country !== "Unknown" && ` · ${evt.country}`}
                          {" · "}<span className="font-mono">{evt.method} {evt.endpoint}</span>
                        </p>
                      </div>
                    </div>
                    {/* Right */}
                    <div className="text-right shrink-0">
                      <span className="block text-[10px] font-mono font-bold"
                        style={{ color: evt.blocked ? "#dc2626" : "#10b981" }}>
                        {evt.blocked ? "BLOCKED" : "FLAGGED"}
                      </span>
                      <span className="text-[9px]" style={{ color: "var(--muted-fg)" }}>
                        {Math.round(evt.confidence)}% conf
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
