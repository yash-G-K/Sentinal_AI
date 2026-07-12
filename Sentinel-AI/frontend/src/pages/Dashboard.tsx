import { useState, useEffect, useCallback } from "react";
import { Activity, Shield, Zap, AlertTriangle, Clock, Heart, Brain, Wifi, WifiOff, Loader2 } from "lucide-react";
import { KpiCard } from "../components/kpi/KpiCard";
import { AttackMap } from "../components/visualization/AttackMap";
import { ChartWrapper } from "../components/charts/ChartWrapper";
import { LiveThreatFeed } from "../components/dashboard/LiveThreatFeed";
import { useWebSocket, type WSMessage } from "../hooks/useWebSocket";
import {
  fetchDashboardKpis,
  fetchDashboardCharts,
  type DashboardKpis,
  type DashboardCharts,
} from "../services/dashboardApi";
import {
  hoursLabels,
  daysLabels,
  smoothSeries,
  PALETTE_LIGHT,
  PALETTE_DARK,
  C,
  baseOption,
} from "../components/charts/theme";

// ── Dark mode hook ─────────────────────────────────────────────────────────────
function useDark(): boolean {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  );
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setDark(document.documentElement.classList.contains("dark"))
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

// ── Chart builders (unchanged) ────────────────────────────────────────────────
function buildTrafficOption(dark: boolean, charts: DashboardCharts | null): object {
  const H = charts?.traffic.labels ?? hoursLabels(24);
  const allowed = charts?.traffic.allowed ?? smoothSeries(24, 4200, 800);
  const blocked = charts?.traffic.blocked ?? smoothSeries(24, 180, 60);
  const p = dark ? PALETTE_DARK : PALETTE_LIGHT;
  return {
    ...baseOption(dark),
    tooltip: { trigger: "axis" },
    legend: { data: ["Allowed", "Blocked"], bottom: 0 },
    grid: { top: 16, right: 20, bottom: 44, left: 8, containLabel: true },
    xAxis: { type: "category", data: H, boundaryGap: false },
    yAxis: { type: "value", splitNumber: 4 },
    series: [
      {
        name: "Allowed", type: "line", data: allowed, smooth: true, symbol: "none",
        color: p[1], lineStyle: { width: 2 },
        areaStyle: {
          color: {
            type: "linear", x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: p[1] + "33" }, { offset: 1, color: p[1] + "00" }]
          }
        },
      },
      {
        name: "Blocked", type: "line", data: blocked, smooth: true, symbol: "none",
        color: p[7], lineStyle: { width: 2 },
        areaStyle: {
          color: {
            type: "linear", x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: p[7] + "33" }, { offset: 1, color: p[7] + "00" }]
          }
        },
      },
    ],
  };
}

function buildBlockedVsAllowedOption(dark: boolean, charts: DashboardCharts | null): object {
  const H = charts?.traffic.labels ?? hoursLabels(24);
  const allowed = charts?.traffic.allowed ?? smoothSeries(24, 4200, 800);
  const blocked = charts?.traffic.blocked ?? smoothSeries(24, 180, 60);
  const p = dark ? PALETTE_DARK : PALETTE_LIGHT;
  return {
    ...baseOption(dark),
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { data: ["Allowed", "Blocked"], bottom: 0 },
    grid: { top: 16, right: 20, bottom: 44, left: 8, containLabel: true },
    xAxis: { type: "category", data: H },
    yAxis: { type: "value", splitNumber: 4 },
    series: [
      { name: "Allowed", type: "bar", stack: "total", data: allowed, color: p[1], barMaxWidth: 16, itemStyle: { borderRadius: [0, 0, 0, 0] } },
      { name: "Blocked", type: "bar", stack: "total", data: blocked, color: p[7], barMaxWidth: 16, itemStyle: { borderRadius: [4, 4, 0, 0] } },
    ],
  };
}

function buildAttackTimelineOption(dark: boolean, charts: DashboardCharts | null): object {
  const H = charts?.attack_timeline.labels ?? hoursLabels(24);
  const critical = charts?.attack_timeline.critical ?? smoothSeries(24, 5, 4);
  const high = charts?.attack_timeline.high ?? smoothSeries(24, 15, 8);
  const medium = charts?.attack_timeline.medium ?? smoothSeries(24, 30, 12);
  const low = charts?.attack_timeline.low ?? smoothSeries(24, 40, 15);
  const p = dark ? PALETTE_DARK : PALETTE_LIGHT;
  return {
    ...baseOption(dark),
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { 
      data: ["Critical", "High", "Medium", "Low"], 
      bottom: 0, 
      itemGap: 8, 
      itemWidth: 8,
      textStyle: { fontSize: 10, fontFamily: "Inter, sans-serif" } 
    },
    grid: { top: 16, right: 20, bottom: 44, left: 8, containLabel: true },
    xAxis: { type: "category", data: H },
    yAxis: { type: "value", splitNumber: 4 },
    series: [
      { name: "Critical", type: "bar", stack: "a", data: critical, color: dark ? "#f87171" : C.red, barMaxWidth: 16 },
      { name: "High", type: "bar", stack: "a", data: high, color: p[3], barMaxWidth: 16 },
      { name: "Medium", type: "bar", stack: "a", data: medium, color: p[2], barMaxWidth: 16 },
      { name: "Low", type: "bar", stack: "a", data: low, color: p[1], barMaxWidth: 16, itemStyle: { borderRadius: [4, 4, 0, 0] } },
    ],
  };
}

function buildRiskTrendOption(dark: boolean, charts: DashboardCharts | null): object {
  const D = charts?.risk_trend.labels ?? daysLabels(30);
  const risk = charts?.risk_trend.scores ?? smoothSeries(30, 42, 10);
  const threshold = Array(risk.length).fill(70);
  const p = dark ? PALETTE_DARK : PALETTE_LIGHT;
  return {
    ...baseOption(dark),
    tooltip: { trigger: "axis" },
    legend: { data: ["Risk Score", "Alert Threshold"], bottom: 0 },
    grid: { top: 16, right: 20, bottom: 44, left: 8, containLabel: true },
    xAxis: { type: "category", data: D, boundaryGap: false },
    yAxis: { type: "value", min: 0, max: 100, splitNumber: 4 },
    visualMap: {
      show: false,
      pieces: [
        { lt: 40, color: p[1] },
        { gte: 40, lt: 70, color: p[2] },
        { gte: 70, color: dark ? "#f87171" : C.red },
      ],
      outOfRange: { color: p[9] },
      seriesIndex: 0,
    },
    series: [
      {
        name: "Risk Score", type: "line", data: risk, smooth: true, symbol: "none",
        lineStyle: { width: 2.5 }, areaStyle: { opacity: 0.15 },
      },
      {
        name: "Alert Threshold", type: "line", data: threshold, symbol: "none",
        color: dark ? "#f87171" : C.red, lineStyle: { width: 1.5, type: "dashed" },
      },
    ],
  };
}

// ── Static fallbacks ──────────────────────────────────────────────────────────
const STATIC_KPIS = {
  total_requests: { value: 0, trend: 0 },
  blocked_requests: { value: 0, trend: 0 },
  allowed_requests: { value: 0, trend: 0 },
  threat_score: { value: 0, trend: 0 },
  critical_alerts: { value: 0, trend: 0 },
  avg_response_ms: { value: 0, trend: 0 },
  firewall_health: { value: 99.9, trend: 0 },
  ai_confidence: { value: 0, trend: 0 },
};

// ── Dashboard Component ───────────────────────────────────────────────────────
export function Dashboard() {
  const dark = useDark();
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [charts, setCharts] = useState<DashboardCharts | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>("");

  // ── HTTP polling (30 sec) for charts ─────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [kpiData, chartData] = await Promise.all([
          fetchDashboardKpis(),
          fetchDashboardCharts(),
        ]);
        if (!cancelled) {
          setKpis(kpiData);
          setCharts(chartData);
          setLastUpdate(new Date().toLocaleTimeString());
        }
      } catch (err) {
        console.warn("Dashboard API unavailable, using fallback data.", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // ── WebSocket real-time KPI updates ──────────────────────────────────────
  const handleWsMessage = useCallback((msg: WSMessage) => {
    if (msg.type === "kpi_update" && msg.data) {
      // Merge live WS KPI data into state
      const d = msg.data as Record<string, { value: number; trend: number }>;
      setKpis(prev => ({ ...(prev ?? STATIC_KPIS), ...d } as DashboardKpis));
      setLastUpdate(new Date().toLocaleTimeString());
    }
  }, []);

  const wsStatus = useWebSocket("/api/v1/ws/dashboard", handleWsMessage);

  const k = kpis ?? STATIC_KPIS;

  const kpiCards = [
    { title: "Total Reqs", value: k.total_requests.value, trend: k.total_requests.trend, status: "good" as const, icon: <Activity size={16} className="text-blue-500" />, description: "Last 24 hours" },
    { title: "Blocked", value: k.blocked_requests.value, trend: k.blocked_requests.trend, status: "good" as const, icon: <Shield size={16} className="text-red-400" />, description: "Threats stopped" },
    { title: "Allowed", value: k.allowed_requests.value, trend: k.allowed_requests.trend, status: "good" as const, icon: <Zap size={16} className="text-emerald-500" />, description: "Clean traffic" },
    { title: "Threat Score", value: k.threat_score.value, trend: k.threat_score.trend, status: "warning" as const, icon: <AlertTriangle size={16} className="text-amber-500" />, description: "AI confidence", unit: "/ 100" },
    { title: "Critical", value: k.critical_alerts.value, trend: k.critical_alerts.trend, status: k.critical_alerts.value > 0 ? "critical" as const : "good" as const, icon: <AlertTriangle size={16} className="text-red-500" />, description: "Last 24 hours" },
    { title: "Avg Latency", value: k.avg_response_ms.value, trend: k.avg_response_ms.trend, status: "good" as const, icon: <Clock size={16} className="text-violet-500" />, description: "Within SLA", unit: "ms" },
    { title: "FW Health", value: k.firewall_health.value, trend: k.firewall_health.trend, status: "good" as const, icon: <Heart size={16} className="text-pink-400" />, description: "All systems up", unit: "%" },
    { title: "AI Confidence", value: k.ai_confidence.value, trend: k.ai_confidence.trend, status: "good" as const, icon: <Brain size={16} className="text-indigo-400" />, description: "Accuracy", unit: "%" },
  ];

  return (
    <div className="space-y-3 max-w-screen-2xl mx-auto pb-2">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--fg)" }}>Dashboard</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-fg)" }}>
            Real-time WAF security posture
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* WebSocket status */}
          <div className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs font-semibold shadow-sm"
            style={{ backgroundColor: "var(--muted)", color: wsStatus.connected ? "#10b981" : "#f59e0b", border: "1px solid var(--border)" }}>
            {wsStatus.connected
              ? <><Wifi size={12} /> Live</>
              : wsStatus.reconnecting
                ? <><Loader2 size={12} className="animate-spin" /> ...</>
                : <><WifiOff size={12} /> Offline</>}
          </div>
          {/* Last update */}
          <div className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs font-semibold shadow-sm"
            style={{ backgroundColor: "var(--card)", color: "var(--muted-fg)", border: "1px solid var(--border)" }}>
            <span className={`h-2 w-2 rounded-full ${loading ? "bg-amber-400 animate-pulse" : "bg-emerald-500"}`} />
            {lastUpdate ? `Updated ${lastUpdate}` : loading ? "..." : "Live"}
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {kpiCards.map((kpi) => (
          <div key={kpi.title} className="col-span-1">
            <KpiCard {...kpi} />
          </div>
        ))}
      </div>

      {/* SOC Board ── Globe left, Feed right, fixed height for zero-scroll */}
      <div style={{ display: "flex", gap: 16, height: 280, overflow: "hidden" }}>
        {/* Globe — 65% width */}
        <div className="shadow-sm" style={{ flex: "0 0 65%", display: "flex", flexDirection: "column",
          backgroundColor: "var(--card)", border: "1px solid var(--border)",
          borderRadius: 12, padding: 8, overflow: "hidden", height: "100%" }}>
          <AttackMap dark={dark} />
        </div>
        {/* Feed — remaining width */}
        <div className="shadow-sm" style={{ flex: 1, height: "100%", overflow: "hidden", backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }}>
          <LiveThreatFeed />
        </div>
      </div>

      {/* 4 charts (ALL IN ONE ROW) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="shadow-sm rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <ChartWrapper title="Traffic Trend" subtitle="Allowed vs Blocked"
            option={buildTrafficOption(dark, charts)} height={180} dark={dark} />
        </div>
        <div className="shadow-sm rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <ChartWrapper title="Attack Timeline" subtitle="By severity"
            option={buildAttackTimelineOption(dark, charts)} height={180} dark={dark} />
        </div>
        <div className="shadow-sm rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <ChartWrapper title="Blocked vs Allowed" subtitle="Stacked view"
            option={buildBlockedVsAllowedOption(dark, charts)} height={180} dark={dark} />
        </div>
        <div className="shadow-sm rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <ChartWrapper title="Risk Trend" subtitle="30-day rolling risk"
            option={buildRiskTrendOption(dark, charts)} height={180} dark={dark} />
        </div>
      </div>

    </div>
  );
}
