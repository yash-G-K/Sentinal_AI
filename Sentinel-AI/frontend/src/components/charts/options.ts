// src/components/charts/options.ts
// All 12 chart option builders — one file, zero duplication.
// Each function accepts `dark: boolean` and returns an ECharts option object.

import { baseOption, hoursLabels, daysLabels, smoothSeries, C, PALETTE_LIGHT, PALETTE_DARK } from "./theme";

function merge(dark: boolean, extra: object): object {
  const base = baseOption(dark);
  return deepMerge(base, extra);
}

function deepMerge(target: any, source: any): any {
  const out = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      typeof target[key] === "object" &&
      target[key] !== null &&
      !Array.isArray(target[key])
    ) {
      out[key] = deepMerge(target[key], source[key]);
    } else {
      out[key] = source[key];
    }
  }
  return out;
}

const H = hoursLabels(24);
const D = daysLabels(30);
const palette = (dark: boolean) => dark ? PALETTE_DARK : PALETTE_LIGHT;

// ── 1. Traffic Trend ─────────────────────────────────────────────────────────
export function trafficTrendOption(dark: boolean): object {
  const blocked  = smoothSeries(24, 180,  60);
  const allowed  = smoothSeries(24, 4200, 800);
  const p = palette(dark);
  return merge(dark, {
    tooltip: { trigger: "axis" },
    legend: { data: ["Allowed", "Blocked"], bottom: 0 },
    grid: { top: 16, right: 20, bottom: 44, left: 8, containLabel: true },
    xAxis: { type: "category", data: H, boundaryGap: false },
    yAxis: { type: "value", splitNumber: 4 },
    series: [
      {
        name: "Allowed",
        type: "line",
        data: allowed,
        smooth: true,
        symbol: "none",
        color: p[1],
        areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: p[1] + "33" }, { offset: 1, color: p[1] + "00" }] } },
        lineStyle: { width: 2 },
      },
      {
        name: "Blocked",
        type: "line",
        data: blocked,
        smooth: true,
        symbol: "none",
        color: p[7],
        areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: p[7] + "33" }, { offset: 1, color: p[7] + "00" }] } },
        lineStyle: { width: 2 },
      },
    ],
  });
}

// ── 2. Blocked vs Allowed ─────────────────────────────────────────────────────
export function blockedVsAllowedOption(dark: boolean): object {
  const blocked = smoothSeries(24, 180, 60);
  const allowed = smoothSeries(24, 4200, 800);
  const p = palette(dark);
  return merge(dark, {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { data: ["Allowed", "Blocked"], bottom: 0 },
    grid: { top: 16, right: 20, bottom: 44, left: 8, containLabel: true },
    xAxis: { type: "category", data: H },
    yAxis: { type: "value", splitNumber: 4 },
    series: [
      {
        name: "Allowed",
        type: "bar",
        stack: "total",
        data: allowed,
        color: p[1],
        barMaxWidth: 16,
        itemStyle: { borderRadius: [0, 0, 0, 0] },
      },
      {
        name: "Blocked",
        type: "bar",
        stack: "total",
        data: blocked,
        color: p[7],
        barMaxWidth: 16,
        itemStyle: { borderRadius: [4, 4, 0, 0] },
      },
    ],
  });
}

// ── 3. Threat Categories ─────────────────────────────────────────────────────
export function threatCategoriesOption(dark: boolean): object {
  const cats   = ["SQLi", "XSS", "Path Traversal", "Rate Limit", "Botnet", "RCE", "CSRF"];
  const counts = [1284, 847, 612, 504, 391, 203, 88];
  const p = palette(dark);
  return merge(dark, {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: 100, right: 20, top: 20, bottom: 20, containLabel: false },
    xAxis: { type: "value", splitNumber: 4 },
    yAxis: { type: "category", data: cats, axisLabel: { fontSize: 11 } },
    series: [{
      type: "bar",
      data: counts.map((v, i) => ({ value: v, itemStyle: { color: p[i % p.length], borderRadius: [0, 4, 4, 0] } })),
      barMaxWidth: 18,
      label: { show: true, position: "right", color: dark ? "#94a3b8" : "#64748b", fontSize: 11, formatter: (p: any) => p.value.toLocaleString() },
    }],
  });
}

// ── 4. Top Countries ─────────────────────────────────────────────────────────
export function topCountriesOption(dark: boolean): object {
  const countries = ["Russia", "China", "Iran", "Nigeria", "Romania", "India", "South Korea", "Brazil"];
  const counts    = [1847, 1203, 984, 721, 560, 430, 312, 204];
  const p = palette(dark);
  return merge(dark, {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: 90, right: 20, top: 20, bottom: 20, containLabel: false },
    xAxis: { type: "value", splitNumber: 4 },
    yAxis: { type: "category", data: countries, axisLabel: { fontSize: 11 } },
    series: [{
      type: "bar",
      data: counts.map((v, i) => ({ value: v, itemStyle: { color: p[i % p.length], borderRadius: [0, 4, 4, 0] } })),
      barMaxWidth: 18,
      label: { show: true, position: "right", color: dark ? "#94a3b8" : "#64748b", fontSize: 11 },
    }],
  });
}

// ── 5. Top IPs ───────────────────────────────────────────────────────────────
export function topIPsOption(dark: boolean): object {
  const ips    = ["185.220.101.47", "45.33.32.156", "192.168.1.105", "103.21.244.0", "188.166.113.28", "77.247.109.1"];
  const counts = [342, 218, 187, 143, 112, 89];
  const p = palette(dark);
  return merge(dark, {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: 130, right: 20, top: 20, bottom: 20, containLabel: false },
    xAxis: { type: "value", splitNumber: 4 },
    yAxis: { type: "category", data: ips, axisLabel: { fontSize: 10.5, fontFamily: "monospace" } },
    series: [{
      type: "bar",
      data: counts.map((v, i) => ({ value: v, itemStyle: { color: p[i % p.length], borderRadius: [0, 4, 4, 0] } })),
      barMaxWidth: 14,
      label: { show: true, position: "right", color: dark ? "#94a3b8" : "#64748b", fontSize: 11 },
    }],
  });
}

// ── 6. Response Time ─────────────────────────────────────────────────────────
export function responseTimeOption(dark: boolean): object {
  const p50 = smoothSeries(24, 18, 4);
  const p95 = smoothSeries(24, 52, 12);
  const p99 = smoothSeries(24, 98, 20);
  const p = palette(dark);
  return merge(dark, {
    tooltip: { trigger: "axis" },
    legend: { data: ["P50", "P95", "P99"], top: 8 },
    xAxis: { type: "category", data: H, boundaryGap: false },
    yAxis: { type: "value", name: "ms", nameTextStyle: { color: dark ? "#94a3b8" : "#64748b" }, splitNumber: 4 },
    series: [
      { name: "P50", type: "line", data: p50, smooth: true, symbol: "none", color: p[1], lineStyle: { width: 2 } },
      { name: "P95", type: "line", data: p95, smooth: true, symbol: "none", color: p[2], lineStyle: { width: 2 } },
      { name: "P99", type: "line", data: p99, smooth: true, symbol: "none", color: p[4], lineStyle: { width: 2, type: "dashed" } },
    ],
  });
}

// ── 7. Bandwidth ─────────────────────────────────────────────────────────────
export function bandwidthOption(dark: boolean): object {
  const inbound  = smoothSeries(24, 120, 40);
  const outbound = smoothSeries(24, 60,  20);
  const p = palette(dark);
  return merge(dark, {
    tooltip: { trigger: "axis", valueFormatter: (v: number) => `${v} MB/s` },
    legend: { data: ["Inbound", "Outbound"], top: 8 },
    xAxis: { type: "category", data: H, boundaryGap: false },
    yAxis: { type: "value", name: "MB/s", nameTextStyle: { color: dark ? "#94a3b8" : "#64748b" }, splitNumber: 4 },
    series: [
      {
        name: "Inbound",
        type: "line",
        data: inbound,
        smooth: true,
        symbol: "none",
        color: p[0],
        areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: p[0] + "44" }, { offset: 1, color: p[0] + "00" }] } },
        lineStyle: { width: 2 },
      },
      {
        name: "Outbound",
        type: "line",
        data: outbound,
        smooth: true,
        symbol: "none",
        color: p[6],
        areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: p[6] + "44" }, { offset: 1, color: p[6] + "00" }] } },
        lineStyle: { width: 2 },
      },
    ],
  });
}

// ── 8. Latency ───────────────────────────────────────────────────────────────
export function latencyOption(dark: boolean): object {
  const latency = smoothSeries(24, 22, 8);
  const threshold = Array(24).fill(50);
  const p = palette(dark);
  return merge(dark, {
    tooltip: { trigger: "axis", valueFormatter: (v: number) => `${v} ms` },
    legend: { data: ["Latency", "SLA Threshold"], top: 8 },
    xAxis: { type: "category", data: H, boundaryGap: false },
    yAxis: { type: "value", name: "ms", nameTextStyle: { color: dark ? "#94a3b8" : "#64748b" }, splitNumber: 4 },
    series: [
      {
        name: "Latency",
        type: "line",
        data: latency,
        smooth: true,
        symbol: "none",
        color: p[0],
        lineStyle: { width: 2 },
        areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: p[0] + "33" }, { offset: 1, color: p[0] + "00" }] } },
      },
      {
        name: "SLA Threshold",
        type: "line",
        data: threshold,
        symbol: "none",
        color: dark ? "#f87171" : C.red,
        lineStyle: { width: 1.5, type: "dashed" },
      },
    ],
  });
}

// ── 9. Attack Timeline ────────────────────────────────────────────────────────
export function attackTimelineOption(dark: boolean): object {
  const critical = smoothSeries(24, 5,  4);
  const high     = smoothSeries(24, 15, 8);
  const medium   = smoothSeries(24, 30, 12);
  const low      = smoothSeries(24, 40, 15);
  const p = palette(dark);
  return merge(dark, {
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
      { name: "Critical", type: "bar", stack: "a", data: critical, color: dark ? "#f87171" : C.red,    barMaxWidth: 16 },
      { name: "High",     type: "bar", stack: "a", data: high,     color: p[3],                         barMaxWidth: 16 },
      { name: "Medium",   type: "bar", stack: "a", data: medium,   color: p[2],                         barMaxWidth: 16 },
      { name: "Low",      type: "bar", stack: "a", data: low,      color: p[1], itemStyle: { borderRadius: [4, 4, 0, 0] }, barMaxWidth: 16 },
    ],
  });
}

// ── 10. Protocol Distribution ────────────────────────────────────────────────
export function protocolDistributionOption(dark: boolean): object {
  const p = palette(dark);
  const data = [
    { value: 4821, name: "HTTPS" },
    { value: 1203, name: "HTTP" },
    { value:  847, name: "WebSocket" },
    { value:  392, name: "gRPC" },
    { value:  184, name: "Other" },
  ];
  return merge(dark, {
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: { orient: "vertical", right: 16, top: "center" },
    series: [{
      type: "pie",
      radius: ["42%", "68%"],
      center: ["38%", "50%"],
      data: data.map((d, i) => ({ ...d, itemStyle: { color: p[i % p.length] } })),
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 13, fontWeight: "bold" }, scale: true, scaleSize: 5 },
      itemStyle: { borderRadius: 4, borderColor: dark ? "#0f172a" : "#ffffff", borderWidth: 2 },
    }],
  });
}

// ── 11. Risk Trend ───────────────────────────────────────────────────────────
export function riskTrendOption(dark: boolean): object {
  const risk      = smoothSeries(30, 42, 10);
  const threshold = Array(30).fill(70);
  const p = palette(dark);
  return merge(dark, {
    tooltip: { trigger: "axis" },
    legend: { data: ["Risk Score", "Alert Threshold"], bottom: 0 },
    grid: { top: 16, right: 20, bottom: 44, left: 8, containLabel: true },
    xAxis: { type: "category", data: D, boundaryGap: false },
    yAxis: { type: "value", min: 0, max: 100, splitNumber: 4 },
    visualMap: {
      show: false,
      pieces: [
        { lt: 40,              color: p[1] },
        { gte: 40,  lt: 70,   color: p[2] },
        { gte: 70,             color: dark ? "#f87171" : C.red },
      ],
      outOfRange: { color: p[9] },
      seriesIndex: 0,
    },
    series: [
      {
        name: "Risk Score",
        type: "line",
        data: risk,
        smooth: true,
        symbol: "none",
        lineStyle: { width: 2.5 },
        areaStyle: { opacity: 0.15 },
      },
      {
        name: "Alert Threshold",
        type: "line",
        data: threshold,
        symbol: "none",
        color: dark ? "#f87171" : C.red,
        lineStyle: { width: 1.5, type: "dashed" },
      },
    ],
  });
}

// ── 12. HTTP Status Codes ────────────────────────────────────────────────────
export function httpStatusCodesOption(dark: boolean): object {
  const p = palette(dark);
  const data = [
    { value: 71842, name: "200 OK" },
    { value:  8401, name: "404 Not Found" },
    { value:  3847, name: "403 Forbidden" },
    { value:  1204, name: "500 Server Error" },
    { value:   984, name: "302 Redirect" },
    { value:   430, name: "429 Rate Limited" },
    { value:   312, name: "Other" },
  ];
  return merge(dark, {
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: { orient: "vertical", right: 10, top: "center", textStyle: { fontSize: 10.5 } },
    series: [{
      type: "pie",
      radius: ["42%", "68%"],
      center: ["36%", "50%"],
      data: data.map((d, i) => ({ ...d, itemStyle: { color: p[i % p.length] } })),
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 12, fontWeight: "bold" }, scale: true, scaleSize: 5 },
      itemStyle: { borderRadius: 4, borderColor: dark ? "#0f172a" : "#ffffff", borderWidth: 2 },
    }],
  });
}
