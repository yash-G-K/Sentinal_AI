// src/components/charts/theme.ts
// ─────────────────────────────────────────────────────────────
// Single source of truth for all chart styling.
// Muted, professional palette inspired by Cloudflare / Datadog.
// ─────────────────────────────────────────────────────────────

export const C = {
  blue:   "#4f8ef7",
  teal:   "#14b8a6",
  green:  "#10b981",
  amber:  "#f59e0b",
  orange: "#f97316",
  red:    "#e05252",
  purple: "#8b5cf6",
  cyan:   "#06b6d4",
  pink:   "#d06fa4",
  slate:  "#64748b",
} as const;

// Ordered palette used for series colours
export const PALETTE_LIGHT: string[] = [
  C.blue, C.green, C.amber, C.purple, C.cyan, C.orange, C.teal, C.pink, C.red, C.slate,
];
export const PALETTE_DARK: string[] = [
  "#60a5fa", "#34d399", "#fbbf24", "#a78bfa",
  "#22d3ee", "#fb923c", "#2dd4bf", "#f472b6",
  "#f87171", "#94a3b8",
];

export interface ThemeVars {
  bg: string;
  fg: string;
  fgMuted: string;
  border: string;
  card: string;
  palette: string[];
}

export function getThemeVars(dark: boolean): ThemeVars {
  return dark
    ? {
        bg:      "transparent",
        fg:      "#f1f5f9",
        fgMuted: "#94a3b8",
        border:  "#334155",
        card:    "#1e293b",
        palette: PALETTE_DARK,
      }
    : {
        bg:      "transparent",
        fg:      "#0f172a",
        fgMuted: "#64748b",
        border:  "#e2e8f0",
        card:    "#ffffff",
        palette: PALETTE_LIGHT,
      };
}

// ─── Base ECharts option ─────────────────────────────────────
// Merge this into every chart option to get consistent styling.
export function baseOption(dark: boolean) {
  const t = getThemeVars(dark);
  return {
    backgroundColor: t.bg,
    color: t.palette,
    textStyle: {
      fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      color: t.fgMuted,
    },
    legend: {
      textStyle: {
        color: t.fgMuted,
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        fontSize: 11,
      },
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 16,
    },
    grid: {
      top: 52,
      right: 20,
      bottom: 40,
      left: 8,
      containLabel: true,
    },
    tooltip: {
      backgroundColor: dark ? "#1e293b" : "#ffffff",
      borderColor:     dark ? "#334155" : "#e2e8f0",
      borderWidth: 1,
      padding: [10, 14],
      textStyle: {
        color:      dark ? "#f1f5f9" : "#0f172a",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        fontSize: 12,
        lineHeight: 20,
      },
      extraCssText:
        "box-shadow: 0 8px 24px rgba(0,0,0,0.12); border-radius: 8px;",
      axisPointer: {
        lineStyle:  { color: dark ? "#475569" : "#cbd5e1", width: 1 },
        crossStyle: { color: dark ? "#475569" : "#cbd5e1" },
      },
    },
    xAxis: {
      axisLine:  { lineStyle: { color: dark ? "#334155" : "#e2e8f0" } },
      axisTick:  { show: false },
      axisLabel: {
        color: t.fgMuted,
        fontSize: 11,
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      },
      splitLine: { show: false },
    },
    yAxis: {
      axisLine:  { show: false },
      axisTick:  { show: false },
      axisLabel: {
        color: t.fgMuted,
        fontSize: 11,
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      },
      splitLine: {
        lineStyle: { color: dark ? "#1e293b" : "#f1f5f9", type: "dashed" },
      },
    },
  };
}

// ─── Shared data generators ───────────────────────────────────

export function hoursLabels(count = 24): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 3600_000);
    out.push(d.getHours().toString().padStart(2, "0") + ":00");
  }
  return out;
}

export function daysLabels(count = 30): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400_000);
    out.push(`${d.getMonth() + 1}/${d.getDate()}`);
  }
  return out;
}

export function randBetween(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}

export function smoothSeries(length: number, base: number, jitter: number): number[] {
  const out: number[] = [];
  let v = base;
  for (let i = 0; i < length; i++) {
    v = Math.max(0, v + (Math.random() - 0.48) * jitter);
    out.push(Math.round(v));
  }
  return out;
}
