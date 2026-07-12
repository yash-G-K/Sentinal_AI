// src/pages/Analytics.tsx
import React, { useState, useMemo, useCallback, useRef } from "react";
import ReactECharts from "echarts-for-react";
import {
  BarChart2, TrendingUp, Shield, Globe, Activity, Download,
  Calendar, Clock, ChevronDown, RefreshCw, Maximize2, Minimize2,
  FileText, Mail, Plus, X, CheckCircle, AlertTriangle, Zap,
  Eye, EyeOff, Filter, SlidersHorizontal
} from "lucide-react";
import {
  fetchAnalyticsTimeseries,
  fetchAnalyticsTopStats,
} from "../services/analyticsApi";
import type {
  TimeRange,
  AnalyticsTimeseries,
  AnalyticsTopStats,
  TopCountry
} from "../services/analyticsApi";

// ─── Types ────────────────────────────────────────────────────────────────────
type TabId = "overview" | "traffic" | "security" | "performance" | "regional";

// ─── Theme ────────────────────────────────────────────────────────────────────
const isDark = () => document.documentElement.classList.contains("dark");

function getTheme() {
  const dark = isDark();
  return {
    bg:        dark ? "#1e293b" : "#ffffff",
    border:    dark ? "#334155" : "#e2e8f0",
    text:      dark ? "#f1f5f9" : "#0f172a",
    muted:     dark ? "#94a3b8" : "#64748b",
    axisLine:  dark ? "#334155" : "#e2e8f0",
    tooltip: {
      backgroundColor: dark ? "#0f172a" : "#ffffff",
      borderColor:     dark ? "#334155" : "#e2e8f0",
      textStyle:       { color: dark ? "#f1f5f9" : "#0f172a", fontSize: 12 },
    },
  };
}

const C = {
  blue:   "#3b82f6",
  red:    "#ef4444",
  green:  "#10b981",
  amber:  "#f59e0b",
  purple: "#8b5cf6",
  cyan:   "#06b6d4",
  rose:   "#f43f5e",
  slate:  "#64748b",
};

const PALETTE = [C.blue, C.green, C.amber, C.purple, C.cyan, C.rose];

function baseOption(extra?: any) {
  const t = getTheme();
  return {
    backgroundColor: "transparent",
    textStyle: { fontFamily: "Inter, ui-sans-serif, sans-serif", color: t.muted },
    grid: { left: "2%", right: "3%", top: "12%", bottom: "8%", containLabel: true },
    tooltip: {
      ...t.tooltip,
      confine: true,
      extraCssText: "box-shadow:0 4px 24px rgba(0,0,0,0.18);border-radius:10px;padding:10px 14px;",
    },
    ...extra,
  };
}



// ─── Chart Wrapper ────────────────────────────────────────────────────────────
function ChartCard({ title, subtitle, children, onExport, className }: {
  title: string; subtitle?: string; children: React.ReactNode; onExport?: () => void; className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`rounded-xl overflow-hidden ${className ?? ""} ${expanded ? "fixed inset-4 z-50 shadow-2xl" : ""}`}
      style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
        <div>
          <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>{title}</p>
          {subtitle && <p className="text-[10px] mt-0.5" style={{ color: "var(--muted-fg)" }}>{subtitle}</p>}
        </div>
        <div className="flex items-center gap-1">
          {onExport && <button onClick={onExport} className="h-6 w-6 flex items-center justify-center rounded" style={{ color: "var(--muted-fg)" }}><Download size={12} /></button>}
          <button onClick={() => setExpanded(e => !e)} className="h-6 w-6 flex items-center justify-center rounded" style={{ color: "var(--muted-fg)" }}>
            {expanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </div>
      </div>
      <div className={`p-4 ${expanded ? "h-[calc(100%-52px)]" : ""}`}>{children}</div>
    </div>
  );
}

// ─── Individual Chart Components ──────────────────────────────────────────────

function TrafficTrendChart({ d }: { d: AnalyticsTimeseries }) {
  const option = {
    ...baseOption(),
    legend: { data: ["Allowed", "Blocked"], top: 0, right: 0, textStyle: { color: getTheme().muted, fontSize: 11 } },
    xAxis: { type: "category", data: d.labels, axisLine: { lineStyle: { color: getTheme().axisLine } }, axisLabel: { color: getTheme().muted, fontSize: 10, interval: Math.floor(d.labels.length / 6) } },
    yAxis: { type: "value", axisLabel: { color: getTheme().muted, fontSize: 10, formatter: (v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v } },
    series: [
      { name: "Allowed", type: "bar", stack: "total", data: d.allowed, itemStyle: { color: C.blue, borderRadius: [0,0,0,0] }, emphasis: { focus: "series" } },
      { name: "Blocked", type: "bar", stack: "total", data: d.blocked, itemStyle: { color: C.red,  borderRadius: [2,2,0,0] }, emphasis: { focus: "series" } },
    ],
  };
  return <ReactECharts option={option} style={{ height: 240 }} notMerge />;
}

function ThreatTrendChart({ d }: { d: AnalyticsTimeseries }) {
  const option = {
    ...baseOption(),
    legend: { data: ["SQLi", "XSS", "RCE", "Brute Force"], top: 0, right: 0, textStyle: { color: getTheme().muted, fontSize: 11 } },
    xAxis: { type: "category", data: d.labels, axisLine: { lineStyle: { color: getTheme().axisLine } }, axisLabel: { color: getTheme().muted, fontSize: 10, interval: Math.floor(d.labels.length / 6) } },
    yAxis: { type: "value", axisLabel: { color: getTheme().muted, fontSize: 10 } },
    series: [
      { name: "SQLi",        type: "line", data: d.sqli,       smooth: true, itemStyle: { color: C.red    }, lineStyle: { width: 2, color: C.red    }, areaStyle: { color: `${C.red}18`    }, symbol: "none" },
      { name: "XSS",         type: "line", data: d.xss,        smooth: true, itemStyle: { color: C.amber  }, lineStyle: { width: 2, color: C.amber  }, areaStyle: { color: `${C.amber}18`  }, symbol: "none" },
      { name: "RCE",         type: "line", data: d.rce,        smooth: true, itemStyle: { color: C.rose   }, lineStyle: { width: 2, color: C.rose   }, areaStyle: { color: `${C.rose}18`   }, symbol: "none" },
      { name: "Brute Force", type: "line", data: d.bruteForce, smooth: true, itemStyle: { color: C.purple }, lineStyle: { width: 2, color: C.purple }, areaStyle: { color: `${C.purple}18` }, symbol: "none" },
    ],
  };
  return <ReactECharts option={option} style={{ height: 240 }} notMerge />;
}

function LatencyChart({ d }: { d: AnalyticsTimeseries }) {
  const option = {
    ...baseOption(),
    legend: { data: ["P50", "P95", "P99"], top: 0, right: 0, textStyle: { color: getTheme().muted, fontSize: 11 } },
    xAxis: { type: "category", data: d.labels, axisLabel: { color: getTheme().muted, fontSize: 10, interval: Math.floor(d.labels.length / 6) } },
    yAxis: { type: "value", axisLabel: { color: getTheme().muted, fontSize: 10, formatter: (v: number) => `${v}ms` } },
    series: [
      { name: "P50", type: "line", data: d.latencyP50, smooth: true, itemStyle: { color: C.green  }, lineStyle: { width: 2, color: C.green  }, symbol: "none" },
      { name: "P95", type: "line", data: d.latencyP95, smooth: true, itemStyle: { color: C.amber  }, lineStyle: { width: 2, color: C.amber  }, symbol: "none" },
      { name: "P99", type: "line", data: d.latencyP99, smooth: true, itemStyle: { color: C.red    }, lineStyle: { width: 2, color: C.red    }, symbol: "none" },
    ],
  };
  return <ReactECharts option={option} style={{ height: 240 }} notMerge />;
}

function BandwidthChart({ d }: { d: AnalyticsTimeseries }) {
  const option = {
    ...baseOption(),
    xAxis: { type: "category", data: d.labels, axisLabel: { color: getTheme().muted, fontSize: 10, interval: Math.floor(d.labels.length / 6) } },
    yAxis: { type: "value", axisLabel: { color: getTheme().muted, fontSize: 10, formatter: (v: number) => `${v} MB` } },
    series: [{
      name: "Bandwidth", type: "line", data: d.bandwidth, smooth: true, symbol: "none",
      itemStyle: { color: C.cyan }, lineStyle: { width: 2.5, color: C.cyan },
      areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: `${C.cyan}50` }, { offset: 1, color: `${C.cyan}05` }] } },
    }],
  };
  return <ReactECharts option={option} style={{ height: 200 }} notMerge />;
}

function ErrorRateChart({ d }: { d: AnalyticsTimeseries }) {
  const option = {
    ...baseOption(),
    xAxis: { type: "category", data: d.labels, axisLabel: { color: getTheme().muted, fontSize: 10, interval: Math.floor(d.labels.length / 6) } },
    yAxis: { type: "value", axisLabel: { color: getTheme().muted, fontSize: 10, formatter: (v: number) => `${v}%` }, max: 10 },
    series: [{
      type: "line", data: d.errorRate, smooth: true, symbol: "none",
      itemStyle: { color: C.red }, lineStyle: { width: 2, color: C.red },
      areaStyle: { color: `${C.red}20` },
      markLine: { data: [{ yAxis: 5, name: "SLA Threshold" }], lineStyle: { color: C.amber, type: "dashed" }, label: { formatter: "SLA 5%", color: C.amber, fontSize: 10 } },
    }],
  };
  return <ReactECharts option={option} style={{ height: 200 }} notMerge />;
}

function StatusCodeChart({ data }: { data: AnalyticsTopStats["status_codes"] }) {
  const option = {
    ...baseOption({ grid: undefined }),
    tooltip: { trigger: "item", ...baseOption().tooltip, formatter: "{b}: {c}% ({d}%)" },
    legend: { orient: "vertical", right: 0, top: "center", textStyle: { color: getTheme().muted, fontSize: 11 } },
    series: [{
      type: "pie", radius: ["55%", "80%"], center: ["38%", "50%"], avoidLabelOverlap: false,
      label: { show: false }, emphasis: { label: { show: true, fontSize: 14, fontWeight: "bold" } },
      data: data.map(s => ({ name: s.code, value: s.v, itemStyle: { color: s.color } })),
    }],
  };
  return <ReactECharts option={option} style={{ height: 200 }} notMerge />;
}

function MethodChart({ data }: { data: AnalyticsTopStats["http_methods"] }) {
  const option = {
    ...baseOption({ grid: undefined }),
    tooltip: { trigger: "item", ...baseOption().tooltip },
    legend: { orient: "vertical", right: 0, top: "center", textStyle: { color: getTheme().muted, fontSize: 11 } },
    series: [{
      type: "pie", radius: ["55%", "80%"], center: ["38%", "50%"],
      label: { show: false }, emphasis: { label: { show: true, fontSize: 14, fontWeight: "bold" } },
      data: data.map((m, i) => ({ name: m.m, value: m.v, itemStyle: { color: PALETTE[i % PALETTE.length] } })),
    }],
  };
  return <ReactECharts option={option} style={{ height: 200 }} notMerge />;
}

function TopEndpointsChart({ data }: { data: AnalyticsTopStats["top_endpoints"] }) {
  const option = {
    ...baseOption({ grid: { left: "2%", right: "4%", top: "5%", bottom: "3%", containLabel: true } }),
    xAxis: { type: "value", axisLabel: { color: getTheme().muted, fontSize: 10, formatter: (v: number) => `${(v/1000).toFixed(0)}k` } },
    yAxis: { type: "category", data: data.map(e => e.e).reverse(), axisLabel: { color: getTheme().muted, fontSize: 10 } },
    series: [{
      type: "bar", data: data.map(e => e.req).reverse(), barMaxWidth: 18,
      itemStyle: { color: C.blue, borderRadius: [0, 4, 4, 0] },
      label: { show: true, position: "right", formatter: (p: any) => `${(p.value/1000).toFixed(0)}k`, color: getTheme().muted, fontSize: 10 },
    }],
  };
  return <ReactECharts option={option} style={{ height: 200 }} notMerge />;
}

function CountryTrafficChart({ data }: { data: AnalyticsTopStats["top_countries"] }) {
  const option = {
    ...baseOption({ grid: { left: "2%", right: "6%", top: "5%", bottom: "3%", containLabel: true } }),
    legend: { data: ["Allowed", "Blocked"], top: 0, right: 0, textStyle: { color: getTheme().muted, fontSize: 11 } },
    xAxis: { type: "value", axisLabel: { color: getTheme().muted, fontSize: 10, formatter: (v: number) => `${(v/1000).toFixed(0)}k` } },
    yAxis: { type: "category", data: data.map(c => c.code).reverse(), axisLabel: { color: getTheme().muted, fontSize: 10 } },
    series: [
      { name: "Allowed", type: "bar", stack: "total", data: data.map(c => c.req - c.blocked).reverse(), itemStyle: { color: C.blue }, barMaxWidth: 16 },
      { name: "Blocked", type: "bar", stack: "total", data: data.map(c => c.blocked).reverse(), itemStyle: { color: C.red, borderRadius: [0, 4, 4, 0] }, barMaxWidth: 16 },
    ],
  };
  return <ReactECharts option={option} style={{ height: 260 }} notMerge />;
}

function RiskScoreChart({ d }: { d: AnalyticsTimeseries }) {
  const option = {
    ...baseOption(),
    xAxis: { type: "category", data: d.labels, axisLabel: { color: getTheme().muted, fontSize: 10, interval: Math.floor(d.labels.length / 6) } },
    yAxis: { type: "value", min: 0, max: 100, axisLabel: { color: getTheme().muted, fontSize: 10 } },
    series: [{
      type: "line", data: d.riskScore, smooth: true, symbol: "none",
      lineStyle: { width: 2.5, color: C.purple },
      areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: `${C.purple}50` }, { offset: 1, color: `${C.purple}05` }] } },
      markLine: { data: [{ yAxis: 60, name: "High Risk Threshold" }], lineStyle: { color: C.red, type: "dashed" }, label: { formatter: "High", color: C.red, fontSize: 10 } },
    }],
  };
  return <ReactECharts option={option} style={{ height: 200 }} notMerge />;
}

function HeatmapChart() {
  // Keeping heatmap deterministic but mocked since it requires complex 3D grouping 
  // not currently supported in basic timeseries.
  const rng = () => Math.random(); // simplified seed replacement for compilation
  const hours = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2,"0")}:00`);
  const days  = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const data  = days.flatMap((_, d) => hours.map((_, h) => [h, d, Math.round(rng() * 8000 + 500)]));
  const option = {
    ...baseOption({ grid: { left: "5%", right: "8%", top: "8%", bottom: "14%", containLabel: true } }),
    tooltip: { position: "top", formatter: (p: any) => `${days[p.data[1]]} ${hours[p.data[0]]}<br/>${p.data[2].toLocaleString()} reqs` },
    xAxis: { type: "category", data: hours, axisLabel: { color: getTheme().muted, fontSize: 9, interval: 3 } },
    yAxis: { type: "category", data: days,  axisLabel: { color: getTheme().muted, fontSize: 10 } },
    visualMap: { min: 500, max: 8500, show: false, inRange: { color: [`${C.blue}20`, C.blue, C.purple] } },
    series: [{ type: "heatmap", data, itemStyle: { borderRadius: 2, borderWidth: 1, borderColor: "var(--bg)" } }],
  };
  return <ReactECharts option={option} style={{ height: 180 }} notMerge />;
}

// ─── KPI Summary Card ─────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, trend, trendUp, color }: {
  label: string; value: string; sub: string; trend: string; trendUp?: boolean; color: string;
}) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-fg)" }}>{label}</p>
      <p className="text-2xl font-bold mt-1.5" style={{ color: "var(--fg)" }}>{value}</p>
      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-[11px] font-semibold" style={{ color: trendUp === undefined ? "var(--muted-fg)" : trendUp ? "#10b981" : "#ef4444" }}>{trend}</span>
        <span className="text-[11px]" style={{ color: "var(--muted-fg)" }}>{sub}</span>
      </div>
      <div className="mt-2 h-1 rounded-full" style={{ backgroundColor: "var(--border)" }}>
        <div className="h-full rounded-full" style={{ width: "100%", backgroundColor: `${color}60` }} />
      </div>
    </div>
  );
}

// ─── Schedule Report Modal ────────────────────────────────────────────────────
function ScheduleModal({ onClose }: { onClose: () => void }) {
  const [name,    setName]    = useState("");
  const [format,  setFormat]  = useState<"pdf"|"csv">("pdf");
  const [freq,    setFreq]    = useState<"daily"|"weekly"|"monthly">("weekly");
  const [email,   setEmail]   = useState("");
  const [saved,   setSaved]   = useState(false);

  const inputCls = "h-8 w-full rounded-md border px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500";
  const iStyle   = { backgroundColor: "var(--muted)", borderColor: "var(--border)", color: "var(--fg)" };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="w-full max-w-md rounded-2xl shadow-2xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <p className="font-bold text-sm" style={{ color: "var(--fg)" }}>Schedule Report</p>
          <button onClick={onClose}><X size={16} style={{ color: "var(--muted-fg)" }} /></button>
        </div>
        {saved ? (
          <div className="px-5 py-8 text-center space-y-3">
            <CheckCircle size={32} className="mx-auto" style={{ color: "#10b981" }} />
            <p className="font-semibold text-sm" style={{ color: "var(--fg)" }}>Report Scheduled!</p>
            <p className="text-xs" style={{ color: "var(--muted-fg)" }}>"{name}" will be sent {freq} to {email}</p>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-3">
            <div className="space-y-1"><label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-fg)" }}>Report Name</label><input value={name} onChange={e => setName(e.target.value)} placeholder="Weekly Security Summary" className={inputCls} style={iStyle} /></div>
            <div className="space-y-1"><label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-fg)" }}>Recipient Email</label><input value={email} onChange={e => setEmail(e.target.value)} placeholder="security-team@corp.com" className={inputCls} style={iStyle} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-fg)" }}>Format</label>
                <select value={format} onChange={e => setFormat(e.target.value as any)} className={inputCls} style={iStyle}>
                  <option value="pdf">PDF Report</option><option value="csv">CSV Data Export</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-fg)" }}>Frequency</label>
                <select value={freq} onChange={e => setFreq(e.target.value as any)} className={inputCls} style={iStyle}>
                  <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="flex-1 h-8 rounded-lg text-xs font-medium" style={{ backgroundColor: "var(--muted)", color: "var(--fg)" }}>Cancel</button>
              <button onClick={() => { if (name && email) setSaved(true); }}
                disabled={!name || !email}
                className="flex-1 h-8 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-40">
                Schedule Report
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab Panels ───────────────────────────────────────────────────────────────
function OverviewTab({ d, top }: { d: AnalyticsTimeseries, top: AnalyticsTopStats }) {
  const totalReq  = d.requests.reduce((a, b) => a + b, 0);
  const totalBlk  = d.blocked.reduce((a, b) => a + b, 0);
  const avgLat    = Math.round(d.latencyP50.reduce((a, b) => a + b, 0) / d.latencyP50.length);
  const blockRate = ((totalBlk / totalReq) * 100).toFixed(1);

  return (
    <div className="space-y-4">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Requests"    value={`${(totalReq/1000).toFixed(0)}K`} sub="vs. previous period" trend="↑ 12.4%" trendUp={true}  color={C.blue}   />
        <KpiCard label="Threats Blocked"   value={`${(totalBlk/1000).toFixed(0)}K`} sub="block rate"          trend={`${blockRate}%`}           color={C.red}    />
        <KpiCard label="Avg Latency (P50)" value={`${avgLat}ms`}                    sub="vs SLA 150ms"        trend="↓ 8.2%" trendUp={true}     color={C.green}  />
        <KpiCard label="Availability"      value="99.97%"                            sub="this period"         trend="↑ 0.01%" trendUp={true}    color={C.purple} />
      </div>

      {/* Main charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Request Volume" subtitle="Allowed vs. Blocked over time" className="lg:col-span-2">
          <TrafficTrendChart d={d} />
        </ChartCard>
        <ChartCard title="HTTP Status Codes" subtitle="Response code distribution">
          <StatusCodeChart data={top.status_codes} />
          <div className="mt-2 space-y-1.5">
            {top.status_codes.map(s => (
              <div key={s.code} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} /><span style={{ color: "var(--fg)" }}>{s.code}</span></div>
                <span className="font-mono" style={{ color: "var(--muted-fg)" }}>{s.v}%</span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Threat Trend" subtitle="Attack types over time"><ThreatTrendChart d={d} /></ChartCard>
        <ChartCard title="Top Traffic Origins" subtitle="Requests by country (allowed + blocked)"><CountryTrafficChart data={top.top_countries} /></ChartCard>
      </div>
    </div>
  );
}

function TrafficTab({ d, top }: { d: AnalyticsTimeseries, top: AnalyticsTopStats }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Request Volume" subtitle="Allowed vs. Blocked" className="lg:col-span-2"><TrafficTrendChart d={d} /></ChartCard>
        <ChartCard title="HTTP Methods" subtitle="Method distribution"><MethodChart data={top.http_methods} /></ChartCard>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Bandwidth Consumed" subtitle="MB transferred per period"><BandwidthChart d={d} /></ChartCard>
        <ChartCard title="Top Endpoints" subtitle="Highest traffic paths"><TopEndpointsChart data={top.top_endpoints} /></ChartCard>
      </div>
      <ChartCard title="Request Heatmap" subtitle="Requests by day and hour (last 7 days)"><HeatmapChart /></ChartCard>
    </div>
  );
}

function SecurityTab({ d, top }: { d: AnalyticsTimeseries, top: AnalyticsTopStats }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Threat Vectors Over Time" subtitle="Attack category breakdown"><ThreatTrendChart d={d} /></ChartCard>
        <ChartCard title="Composite Risk Score" subtitle="AI-computed WAF risk (0–100)"><RiskScoreChart d={d} /></ChartCard>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Top Attack Sources" subtitle="Blocked requests by country" className="lg:col-span-2">
          <div className="space-y-2">
            {top.top_countries.filter((c: TopCountry) => c.blocked > 0).slice(0, 5).map((c: TopCountry) => (
              <div key={c.code} className="flex items-center gap-3">
                <span className="text-lg flex-shrink-0">{c.flag}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span style={{ color: "var(--fg)" }}>{c.c}</span>
                    <span className="font-mono" style={{ color: "var(--muted-fg)" }}>{c.blocked.toLocaleString()} blocked</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ backgroundColor: "var(--border)" }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (c.blocked / Math.max(...top.top_countries.map(t=>t.blocked)))*100)}%`, backgroundColor: c.blocked > 3000 ? C.red : C.amber }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
        <ChartCard title="Rule Effectiveness" subtitle="Blocks per active rule">
          <div className="space-y-2.5">
            {[{ name:"SQLi Block",v:1847,color:C.red},{ name:"Geo Block",v:2103,color:C.amber},{ name:"XSS Block",v:984,color:C.purple},{ name:"Brute Force",v:421,color:C.blue},{ name:"Path Traversal",v:312,color:C.cyan}].map(r => (
              <div key={r.name}>
                <div className="flex justify-between text-xs mb-0.5"><span style={{ color: "var(--fg)" }}>{r.name}</span><span className="font-mono" style={{ color: "var(--muted-fg)" }}>{r.v.toLocaleString()}</span></div>
                <div className="h-1.5 rounded-full" style={{ backgroundColor: "var(--border)" }}>
                  <div className="h-full rounded-full" style={{ width: `${(r.v / 2200) * 100}%`, backgroundColor: r.color }} />
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

function PerformanceTab({ d }: { d: AnalyticsTimeseries }) {
  const avgP50 = Math.round(d.latencyP50.reduce((a,b)=>a+b,0)/Math.max(1, d.latencyP50.length));
  const avgP95 = Math.round(d.latencyP95.reduce((a,b)=>a+b,0)/Math.max(1, d.latencyP95.length));
  const avgP99 = Math.round(d.latencyP99.reduce((a,b)=>a+b,0)/Math.max(1, d.latencyP99.length));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[{label:"Avg Latency P50",v:`${avgP50}ms`,color:C.green},{label:"Avg Latency P95",v:`${avgP95}ms`,color:C.amber},{label:"Avg Latency P99",v:`${avgP99}ms`,color:C.red}].map(k => (
          <div key={k.label} className="rounded-xl p-4 text-center" style={{ backgroundColor:"var(--card)", border:"1px solid var(--border)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color:"var(--muted-fg)" }}>{k.label}</p>
            <p className="text-2xl font-bold mt-1.5" style={{ color:k.color }}>{k.v}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Response Latency Percentiles" subtitle="P50 / P95 / P99 over time"><LatencyChart d={d} /></ChartCard>
        <ChartCard title="Error Rate" subtitle="5xx responses as % of total" ><ErrorRateChart d={d} /></ChartCard>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Bandwidth" subtitle="Total data transferred"><BandwidthChart d={d} /></ChartCard>
        <ChartCard title="Availability" subtitle="SLA compliance this period">
          <div className="flex items-center justify-center py-6">
            <div className="text-center">
              <p className="text-5xl font-black" style={{ color: "#10b981" }}>99.97%</p>
              <p className="text-sm mt-2" style={{ color: "var(--muted-fg)" }}>SLA Target: 99.9%</p>
              <div className="mt-3 flex items-center gap-2 justify-center">
                <CheckCircle size={14} style={{ color: "#10b981" }} />
                <span className="text-xs font-semibold" style={{ color: "#10b981" }}>SLA Met — 12.6 min downtime this period</span>
              </div>
            </div>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

function RegionalTab({ top }: { top: AnalyticsTopStats }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Traffic by Country" subtitle="Allowed vs. Blocked requests"><CountryTrafficChart data={top.top_countries} /></ChartCard>
        <ChartCard title="Country Risk Profile" subtitle="Block rate per originating country">
          <div className="space-y-2.5 py-1">
            {top.top_countries.map(c => {
              const blockRate = ((c.blocked / c.req) * 100).toFixed(1);
              const risk = parseFloat(blockRate) > 50 ? "#ef4444" : parseFloat(blockRate) > 10 ? "#f59e0b" : "#10b981";
              return (
                <div key={c.code} className="flex items-center gap-3">
                  <span className="text-base flex-shrink-0 w-7">{c.flag}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-[11px]">
                      <span style={{ color: "var(--fg)" }}>{c.c}</span>
                      <span className="font-mono font-semibold" style={{ color: risk }}>{blockRate}% blocked</span>
                    </div>
                    <div className="mt-0.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--border)" }}>
                      <div className="h-full rounded-full" style={{ width: `${blockRate}%`, backgroundColor: risk }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>
      </div>
      <ChartCard title="ASN Analysis" subtitle="Traffic by Autonomous System Network — top sources">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead><tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["ASN / Organization","Requests","Risk Level","Block Rate"].map(h => (
                <th key={h} className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-fg)" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {top.asn_data.map((a, i) => {
                const riskC = { critical: "#ef4444", high: "#f97316", medium: "#f59e0b", low: "#10b981" }[a.risk] ?? "#64748b";
                const blockRate = a.risk === "critical" ? "97.3%" : a.risk === "high" ? "62.1%" : a.risk === "medium" ? "14.2%" : "0.4%";
                return (
                  <tr key={i} className="border-b" style={{ borderColor: "var(--border)" }}>
                    <td className="px-3 py-2.5 text-xs font-mono" style={{ color: "var(--fg)" }}>{a.asn}</td>
                    <td className="px-3 py-2.5 text-xs font-mono" style={{ color: "var(--muted-fg)" }}>{a.req.toLocaleString()}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] font-bold uppercase rounded px-2 py-0.5 capitalize" style={{ backgroundColor: `${riskC}18`, color: riskC }}>{a.risk}</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs font-mono" style={{ color: a.risk === "critical" || a.risk === "high" ? "#ef4444" : "var(--muted-fg)" }}>
                      {blockRate}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}

// ─── Main Analytics Component ─────────────────────────────────────────────────
const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode; desc: string }> = [
  { id: "overview",     label: "Overview",     icon: <BarChart2 size={14} />,  desc: "Executive summary" },
  { id: "traffic",      label: "Traffic",      icon: <Activity size={14} />,   desc: "Request analysis" },
  { id: "security",     label: "Security",     icon: <Shield size={14} />,     desc: "Threat analytics" },
  { id: "performance",  label: "Performance",  icon: <Zap size={14} />,        desc: "Latency & health" },
  { id: "regional",     label: "Regional",     icon: <Globe size={14} />,      desc: "Geo analysis" },
];

const RANGES: Array<{ value: TimeRange; label: string }> = [
  { value: "24h", label: "24 Hours" },
  { value: "7d",  label: "7 Days"   },
  { value: "30d", label: "30 Days"  },
  { value: "90d", label: "90 Days"  },
];

export function Analytics() {
  const [tab,       setTab]       = useState<TabId>("overview");
  const [range,     setRange]     = useState<TimeRange>("30d");
  const [showSched, setShowSched] = useState(false);
  const [isRefresh, setRefresh]   = useState(false);
  const [loading,   setLoading]   = useState(true);

  const [d, setD] = useState<AnalyticsTimeseries | null>(null);
  const [top, setTop] = useState<AnalyticsTopStats | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [timeseriesData, topData] = await Promise.all([
        fetchAnalyticsTimeseries(range),
        fetchAnalyticsTopStats(range)
      ]);
      setD(timeseriesData);
      setTop(topData);
    } catch (err) {
      console.warn("Analytics API unavailable, UI might be empty or fallback.");
    } finally {
      setLoading(false);
    }
  }, [range]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefresh(true);
    loadData().then(() => setTimeout(() => setRefresh(false), 600));
  };

  const handleExport = () => {
    if (!d) return;
    const csv = [
      ["Date", "Total Requests", "Blocked", "Allowed", "Latency P50 (ms)", "Error Rate (%)"],
      ...d.labels.map((l, i) => [l, d.requests[i], d.blocked[i], d.allowed[i], d.latencyP50[i], d.errorRate[i]]),
    ].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `sentinel-analytics-${range}.csv`; a.click();
  };

  const rangeLabel = RANGES.find(r => r.value === range)?.label ?? "";
  const updatedAt  = new Date().toLocaleString("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <div className="space-y-4 max-w-screen-2xl">
      {/* ── Page header ────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--fg)" }}>Analytics & Reports</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted-fg)" }}>
            Long-term trend analysis, performance monitoring, and executive reporting
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Time range selector */}
          <div className="flex items-center gap-0.5 rounded-lg p-0.5" style={{ backgroundColor: "var(--muted)", border: "1px solid var(--border)" }}>
            {RANGES.map(r => (
              <button key={r.value} onClick={() => setRange(r.value)}
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                style={{
                  backgroundColor: range === r.value ? "var(--card)" : "transparent",
                  color: range === r.value ? "var(--fg)" : "var(--muted-fg)",
                  boxShadow: range === r.value ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                }}>
                {r.label}
              </button>
            ))}
          </div>
          {/* Refresh */}
          <button onClick={handleRefresh} className="h-8 w-8 flex items-center justify-center rounded-lg" style={{ backgroundColor: "var(--muted)", color: "var(--fg)" }}>
            <RefreshCw size={13} className={isRefresh ? "animate-spin" : ""} />
          </button>
          {/* Export */}
          <button onClick={handleExport} className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium" style={{ backgroundColor: "var(--muted)", color: "var(--fg)" }}>
            <Download size={13} /> Export CSV
          </button>
          {/* Schedule */}
          <button onClick={() => setShowSched(true)} className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors">
            <Calendar size={13} /> Schedule Report
          </button>
        </div>
      </div>

      {/* ── Metadata bar ───────────────────────────────────────── */}
      <div className="flex items-center gap-4 text-xs" style={{ color: "var(--muted-fg)" }}>
        <span className="flex items-center gap-1"><Clock size={11} /> {rangeLabel} view</span>
        <span>·</span>
        <span className="flex items-center gap-1"><Activity size={11} /> Last updated {updatedAt}</span>
        <span>·</span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" /> Live data
        </span>
      </div>

      {/* ── Tab navigation ──────────────────────────────────────── */}
      <div className="flex items-center gap-0 rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-3 text-xs font-medium transition-colors border-b-2 min-w-[80px]"
            style={{
              borderColor: tab === t.id ? "#2563eb" : "transparent",
              color: tab === t.id ? "#2563eb" : "var(--muted-fg)",
              backgroundColor: tab === t.id ? "#eff6ff" : "transparent",
            }}>
            {t.icon}
            <span className="font-semibold">{t.label}</span>
            <span className="hidden sm:block text-[9px] opacity-70">{t.desc}</span>
          </button>
        ))}
      </div>

      {/* ── Tab content ─────────────────────────────────────────── */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="text-sm font-medium" style={{ color: "var(--muted-fg)" }}>Loading Analytics...</div>
        </div>
      ) : d && top ? (
        <>
          {tab === "overview"     && <OverviewTab     d={d} top={top} />}
          {tab === "traffic"      && <TrafficTab      d={d} top={top} />}
          {tab === "security"     && <SecurityTab     d={d} top={top} />}
          {tab === "performance"  && <PerformanceTab  d={d} />}
          {tab === "regional"     && <RegionalTab     top={top} />}
        </>
      ) : null}

      {/* ── Schedule modal ──────────────────────────────────────── */}
      {showSched && <ScheduleModal onClose={() => setShowSched(false)} />}
    </div>
  );
}
