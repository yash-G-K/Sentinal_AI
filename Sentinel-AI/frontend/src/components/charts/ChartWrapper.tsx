// src/components/charts/ChartWrapper.tsx
import React, { useRef, useState, useCallback } from "react";
import ReactECharts from "echarts-for-react";
import { Maximize2, Minimize2, Download, X } from "lucide-react";

interface Props {
  title: string;
  subtitle?: string;
  option: object;
  height?: number;
  dark?: boolean;
  className?: string;
}

export function ChartWrapper({
  title,
  subtitle,
  option,
  height = 280,
  dark = false,
  className = "",
}: Props) {
  const chartRef = useRef<ReactECharts>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const exportPng = useCallback(() => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance) return;
    const url = instance.getDataURL({
      type: "png",
      pixelRatio: 2,
      backgroundColor: dark ? "#1e293b" : "#ffffff",
    });
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, "_")}.png`;
    a.click();
  }, [title, dark]);

  const headerBg  = dark ? "var(--card)"   : "var(--card)";
  const borderCol = dark ? "var(--border)" : "var(--border)";

  const header = (
    <div
      className="flex items-center justify-between px-4 py-3 border-b"
      style={{ borderColor: borderCol }}
    >
      <div>
        <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>{title}</p>
        {subtitle && (
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-fg)" }}>{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={exportPng}
          title="Export PNG"
          className="flex h-7 w-7 items-center justify-center rounded-md transition-colors"
          style={{ color: "var(--muted-fg)" }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--muted)")}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          <Download size={13} />
        </button>
        <button
          onClick={() => setFullscreen(f => !f)}
          title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          className="flex h-7 w-7 items-center justify-center rounded-md transition-colors"
          style={{ color: "var(--muted-fg)" }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--muted)")}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
      </div>
    </div>
  );

  const chart = (
    <ReactECharts
      ref={chartRef}
      option={option}
      style={{ height: fullscreen ? "calc(100vh - 80px)" : `${height}px`, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge={false}
      lazyUpdate={true}
    />
  );

  // Fullscreen overlay
  if (fullscreen) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col"
        style={{ backgroundColor: "var(--bg)" }}
      >
        {/* Fullscreen header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ backgroundColor: headerBg, borderColor: borderCol }}
        >
          <div>
            <p className="text-base font-bold" style={{ color: "var(--fg)" }}>{title}</p>
            {subtitle && <p className="text-sm" style={{ color: "var(--muted-fg)" }}>{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportPng}
              title="Export PNG"
              className="flex h-8 w-8 items-center justify-center rounded-md transition-colors"
              style={{ backgroundColor: "var(--muted)", color: "var(--fg)" }}
            >
              <Download size={15} />
            </button>
            <button
              onClick={() => setFullscreen(false)}
              title="Close"
              className="flex h-8 w-8 items-center justify-center rounded-md transition-colors"
              style={{ backgroundColor: "var(--muted)", color: "var(--fg)" }}
            >
              <X size={15} />
            </button>
          </div>
        </div>
        <div className="flex-1 p-6">{chart}</div>
      </div>
    );
  }

  // Normal card
  return (
    <div
      className={`rounded-xl overflow-hidden ${className}`}
      style={{
        backgroundColor: headerBg,
        border: `1px solid ${borderCol}`,
      }}
    >
      {header}
      <div className="p-3">{chart}</div>
    </div>
  );
}
