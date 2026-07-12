import React from "react";
import { cn } from "../utils";

type Status = "good" | "warning" | "critical" | "neutral";

interface KpiCardProps {
  title: string;
  value: string | number;
  unit?: string;
  trend?: number; // positive = up, negative = down
  status?: Status;
  icon?: React.ReactNode;
  description?: string;
}

function TrendBadge({ trend }: { trend: number }) {
  const up = trend >= 0;
  const color = up ? "#10b981" : "#ef4444";
  const bg   = up ? "#10b98122" : "#ef444422"; // softer transparent bg
  const arrow = up ? "▲" : "▼";
  const formatted = Math.abs(trend).toFixed(0); // remove decimal for space
  return (
    <span
      className="inline-flex items-center shrink-0 rounded px-1 py-[2px] text-[9px] font-bold tracking-tighter"
      style={{ color, backgroundColor: bg }}
    >
      {arrow} {formatted}%
    </span>
  );
}

const statusDot: Record<Status, string> = {
  good:     "#10b981",
  warning:  "#f59e0b",
  critical: "#ef4444",
  neutral:  "#94a3b8",
};

export function KpiCard({ title, value, unit, trend, status = "neutral", icon, description }: KpiCardProps) {
  return (
    <div
      className="rounded-xl p-2.5 flex flex-col gap-1.5 transition-shadow hover:shadow-md h-full"
      style={{
        backgroundColor: "var(--card)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-1">
        <span className="text-[9px] font-bold uppercase tracking-tight leading-tight" style={{ color: "var(--muted-fg)" }}>
          {title}
        </span>
        {icon && (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded" style={{ backgroundColor: "var(--muted)" }}>
            {React.cloneElement(icon as React.ReactElement, { size: 12 })}
          </span>
        )}
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-1 mt-0.5">
        <span className="text-lg font-bold tracking-tighter truncate" style={{ color: "var(--fg)" }}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
        {unit && <span className="text-[10px] shrink-0" style={{ color: "var(--muted-fg)" }}>{unit}</span>}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-1">
        <div className="flex items-center gap-1 min-w-0 pr-1">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: statusDot[status] }}
          />
          <span className="text-[9px] truncate" style={{ color: "var(--muted-fg)" }}>
            {description ?? status}
          </span>
        </div>
        {trend !== undefined && <TrendBadge trend={trend} />}
      </div>
    </div>
  );
}
