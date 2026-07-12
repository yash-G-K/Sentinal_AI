// src/pages/AuditLogs.tsx
import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Search, Filter, Download, Columns, ChevronDown, ChevronRight,
  CheckSquare, Square, X, Clock, Shield, User, Server, Key,
  AlertTriangle, Info, CheckCircle, XCircle, MoreHorizontal,
  Calendar, Rows3, AlignJustify, List, Save, Trash2, RefreshCw,
  Eye, Code, GitBranch, Copy, Check, Loader2,
} from "lucide-react";
import { fetchAuditLogs } from "../services/auditApi";
import type { AuditLogEntry } from "../services/auditApi";

// ─── Types ───────────────────────────────────────────────────────────────────
type Severity = "critical" | "high" | "medium" | "low" | "info";
type Category = "authentication" | "firewall" | "policy" | "system" | "api" | "user-mgmt";
type Action   = "blocked" | "allowed" | "modified" | "deleted" | "created" | "failed" | "escalated";
type ActorType = "user" | "system" | "api-key";
type View = "table" | "timeline";
type Density = "compact" | "comfortable" | "spacious";

interface Actor { type: ActorType; name: string; ip?: string; }

interface LogEntry {
  id: string;
  timestamp: string;
  severity: Severity;
  category: Category;
  action: Action;
  actor: Actor;
  resource: string;
  message: string;
  requestId: string;
  country?: string;
  userAgent?: string;
  meta: Record<string, unknown>;
  diff?: { before: Record<string, unknown>; after: Record<string, unknown> };
}

interface SavedFilter {
  id: string;
  name: string;
  query: string;
  filters: Partial<Filters>;
}

interface Filters {
  severity: Severity | "";
  category: Category | "";
  action: Action | "";
  actorType: ActorType | "";
  dateFrom: string;
  dateTo: string;
}

interface ColDef { key: string; label: string; visible: boolean; mono?: boolean; }

// ─── Constants ────────────────────────────────────────────────────────────────
const SEV_CONFIG: Record<Severity, { color: string; bg: string; icon: React.ReactNode }> = {
  critical: { color: "#ef4444", bg: "#ef444415", icon: <AlertTriangle size={10} strokeWidth={3} /> },
  high:     { color: "#f97316", bg: "#f9731615", icon: <AlertTriangle size={10} strokeWidth={3} /> },
  medium:   { color: "#f59e0b", bg: "#f59e0b15", icon: <Info size={10} strokeWidth={3} /> },
  low:      { color: "#10b981", bg: "#10b98115", icon: <Info size={10} strokeWidth={3} /> },
  info:     { color: "#3b82f6", bg: "#3b82f615", icon: <Info size={10} strokeWidth={3} /> },
};

const CAT_ICON: Record<Category, React.ReactNode> = {
  authentication: <Key size={12} />,
  firewall:       <Shield size={12} />,
  policy:         <CheckCircle size={12} />,
  system:         <Server size={12} />,
  api:            <Code size={12} />,
  "user-mgmt":    <User size={12} />,
};

const ACTION_COLOR: Record<Action, string> = {
  blocked: "#dc2626", allowed: "#15803d", modified: "#1d4ed8",
  deleted: "#7c2d12", created: "#166534", failed: "#92400e", escalated: "#7c3aed",
};

const DEFAULT_COLS: ColDef[] = [
  { key: "timestamp", label: "Timestamp",  visible: true, mono: true },
  { key: "severity",  label: "Severity",   visible: true },
  { key: "category",  label: "Category",   visible: true },
  { key: "action",    label: "Action",     visible: true },
  { key: "actor",     label: "Actor",      visible: true },
  { key: "resource",  label: "Resource",   visible: true, mono: true },
  { key: "message",   label: "Message",    visible: true },
  { key: "requestId", label: "Request ID", visible: false, mono: true },
  { key: "country",   label: "Country",    visible: false },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function cn(...c: (string|false|null|undefined)[]) { return c.filter(Boolean).join(" "); }

function formatTs(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US",{month:"short",day:"2-digit"}) + " " +
    d.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false});
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SevBadge({ s }: { s: Severity }) {
  const cfg = SEV_CONFIG[s];
  return (
    <span className="inline-flex items-center gap-1 rounded px-1.5 py-[2px] text-[9px] font-bold uppercase tracking-wider border"
      style={{ color: cfg.color, backgroundColor: cfg.bg, borderColor: `${cfg.color}33` }}>
      {cfg.icon} {s}
    </span>
  );
}

function ActionBadge({ a }: { a: Action }) {
  const color = ACTION_COLOR[a];
  return (
    <span className="inline-flex items-center rounded px-1.5 py-[2px] font-mono text-[9px] font-bold uppercase tracking-wide border" style={{ color, backgroundColor: `${color}15`, borderColor: `${color}33` }}>
      {a}
    </span>
  );
}

function ActorChip({ actor }: { actor: Actor }) {
  const icon = actor.type === "system" ? <Server size={11} /> :
               actor.type === "api-key" ? <Key size={11} /> : <User size={11} />;
  return (
    <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--fg)" }}>
      <span style={{ color: "var(--muted-fg)" }}>{icon}</span>
      <span className="font-medium">{actor.name}</span>
    </span>
  );
}

// ── JSON Viewer ───────────────────────────────────────────────
function JsonNode({ value, depth = 0 }: { value: unknown; depth?: number }) {
  const [open, setOpen] = useState(depth < 2);
  const pad = depth * 12;

  if (value === null) return <span style={{ color: "#94a3b8" }}>null</span>;
  if (typeof value === "boolean") return <span style={{ color: "#f59e0b" }}>{value.toString()}</span>;
  if (typeof value === "number") return <span style={{ color: "#60a5fa" }}>{value}</span>;
  if (typeof value === "string") return <span style={{ color: "#34d399" }}>"{value}"</span>;

  if (Array.isArray(value)) {
    if (value.length === 0) return <span style={{ color: "var(--muted-fg)" }}>{"[]"}</span>;
    return (
      <span>
        <button className="font-mono" style={{ color: "var(--muted-fg)" }} onClick={() => setOpen(o => !o)}>
          {open ? "▾" : "▸"} [{value.length}]
        </button>
        {open && (
          <div style={{ paddingLeft: 12 }}>
            {value.map((v, i) => (
              <div key={i} style={{ paddingLeft: pad }}>
                <JsonNode value={v} depth={depth + 1} />
                {i < value.length - 1 && <span style={{ color: "var(--muted-fg)" }}>,</span>}
              </div>
            ))}
          </div>
        )}
      </span>
    );
  }

  if (typeof value === "object") {
    const keys = Object.keys(value as object);
    if (keys.length === 0) return <span style={{ color: "var(--muted-fg)" }}>{"{}"}</span>;
    return (
      <span>
        <button className="font-mono" style={{ color: "var(--muted-fg)" }} onClick={() => setOpen(o => !o)}>
          {open ? "▾" : "▸"} {"{"}{keys.length}{"}"}
        </button>
        {open && (
          <div style={{ paddingLeft: 12 }}>
            {keys.map((k, i) => (
              <div key={k} style={{ paddingLeft: pad }}>
                <span style={{ color: "#a78bfa" }}>"{k}"</span>
                <span style={{ color: "var(--muted-fg)" }}>: </span>
                <JsonNode value={(value as Record<string,unknown>)[k]} depth={depth + 1} />
                {i < keys.length - 1 && <span style={{ color: "var(--muted-fg)" }}>,</span>}
              </div>
            ))}
          </div>
        )}
      </span>
    );
  }
  return <span>{String(value)}</span>;
}

function JsonViewer({ data }: { data: Record<string, unknown> }) {
  const [copied, setCopied] = useState(false);
  const raw = JSON.stringify(data, null, 2);
  return (
    <div className="relative">
      <button
        onClick={() => { copyToClipboard(raw); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="absolute top-2 right-2 flex items-center gap-1 rounded px-2 py-1 text-[11px]"
        style={{ backgroundColor: "var(--muted)", color: "var(--muted-fg)" }}
      >
        {copied ? <Check size={11} /> : <Copy size={11} />}
        {copied ? "Copied" : "Copy"}
      </button>
      <div className="rounded-lg p-4 font-mono text-[12px] leading-relaxed overflow-auto max-h-72"
        style={{ backgroundColor: "#0f172a", color: "#f1f5f9" }}>
        <JsonNode value={data} depth={0} />
      </div>
    </div>
  );
}

// ── Diff Viewer ───────────────────────────────────────────────
function DiffViewer({ before, after }: { before: Record<string,unknown>; after: Record<string,unknown> }) {
  const allKeys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  return (
    <div className="grid grid-cols-2 gap-3 font-mono text-xs">
      <div className="rounded-lg p-3 space-y-1" style={{ backgroundColor: "#fee2e2" }}>
        <p className="text-[10px] font-bold uppercase tracking-wider text-red-600 mb-2">Before</p>
        {allKeys.map(k => (
          <div key={k}>
            <span className="text-red-400">"{k}"</span>
            <span className="text-slate-500">: </span>
            <span className="text-red-700">{before[k] !== undefined ? JSON.stringify(before[k]) : <em className="text-slate-400">—</em>}</span>
          </div>
        ))}
      </div>
      <div className="rounded-lg p-3 space-y-1" style={{ backgroundColor: "#dcfce7" }}>
        <p className="text-[10px] font-bold uppercase tracking-wider text-green-700 mb-2">After</p>
        {allKeys.map(k => (
          <div key={k}>
            <span className="text-green-500">"{k}"</span>
            <span className="text-slate-500">: </span>
            <span className="text-green-800">{after[k] !== undefined ? JSON.stringify(after[k]) : <em className="text-slate-400">—</em>}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Expanded Row ──────────────────────────────────────────────
type ExpTab = "details" | "json" | "diff";

function ExpandedRow({ entry, colspan }: { entry: LogEntry; colspan: number }) {
  const [tab, setTab] = useState<ExpTab>("details");
  const tabs: { key: ExpTab; label: string; icon: React.ReactNode; disabled?: boolean }[] = [
    { key: "details", label: "Details", icon: <Eye size={12} /> },
    { key: "json",    label: "JSON Payload",    icon: <Code size={12} /> },
    { key: "diff",    label: "State Diff",    icon: <GitBranch size={12} />, disabled: !entry.diff },
  ];

  const det: [string, string][] = [
    ["Event ID",    entry.id],
    ["Request ID",  entry.requestId],
    ["Timestamp",   new Date(entry.timestamp).toLocaleString()],
    ["Actor Name",  entry.actor.name],
    ["Actor Type",  entry.actor.type],
    ["Source IP",   entry.actor.ip || "—"],
    ["Country",     entry.country || "—"],
    ["Resource",    entry.resource],
    ["User Agent",  entry.userAgent || "—"],
  ];

  return (
    <tr>
      <td colSpan={colspan} className="px-0 pb-0 pt-0">
        <div className="mx-4 my-3 rounded-xl overflow-hidden shadow-inner flex flex-col" style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}>
          {/* Top Info Bar */}
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ backgroundColor: "var(--muted)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted-fg)" }}>Inspector</span>
              <span className="font-mono text-xs font-bold" style={{ color: "var(--fg)" }}>{entry.id}</span>
            </div>
            {/* Tabs inside top bar */}
            <div className="flex items-center gap-1">
              {tabs.map(t => (
                <button key={t.key}
                  disabled={t.disabled}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide rounded-md transition-colors",
                    tab === t.key ? "shadow-sm" : "border-transparent",
                    t.disabled ? "opacity-30 cursor-not-allowed" : "hover:bg-black/5 dark:hover:bg-white/5"
                  )}
                  style={{
                    backgroundColor: tab === t.key ? "var(--card)" : "transparent",
                    color: tab === t.key ? "var(--primary)" : "var(--muted-fg)",
                    border: tab === t.key ? "1px solid var(--border)" : "1px solid transparent"
                  }}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab body */}
          <div className="p-5" style={{ backgroundColor: "var(--card)" }}>
            {tab === "details" && (
              <div className="space-y-6">
                <div className="p-4 rounded-lg shadow-sm border" style={{ backgroundColor: "var(--muted)", borderColor: "var(--border)" }}>
                   <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--muted-fg)" }}>Event Message</p>
                   <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>{entry.message}</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-5">
                  {det.map(([k, v]) => (
                    <div key={k}>
                      <p className="text-[9px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "var(--muted-fg)" }}>{k}</p>
                      <p className="text-[11px] font-mono break-all font-semibold" style={{ color: "var(--fg)" }}>{v}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {tab === "json" && (
              <JsonViewer data={{ ...entry, meta: entry.meta }} />
            )}
            {tab === "diff" && entry.diff && (
              <DiffViewer before={entry.diff.before} after={entry.diff.after} />
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── Timeline view ─────────────────────────────────────────────
function TimelineView({ entries }: { entries: LogEntry[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  return (
    <div className="space-y-0 relative">
      <div className="absolute left-[19px] top-0 bottom-0 w-px" style={{ backgroundColor: "var(--border)" }} />
      {entries.map(e => {
        const cfg = SEV_CONFIG[e.severity];
        const open = expanded.has(e.id);
        return (
          <div key={e.id} className="relative pl-10 pb-4">
            {/* Dot */}
            <div className="absolute left-3 top-3 h-3.5 w-3.5 rounded-full border-2 z-10"
              style={{ backgroundColor: cfg.bg, borderColor: cfg.color }} />
            {/* Card */}
            <div className="rounded-lg" style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}>
              <button className="w-full flex items-start gap-3 px-4 py-3 text-left" onClick={() => toggle(e.id)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[11px]" style={{ color: "var(--muted-fg)" }}>{formatTs(e.timestamp)}</span>
                    <SevBadge s={e.severity} />
                    <span className="text-xs font-semibold" style={{ color: "var(--fg)" }}>{e.message}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <ActorChip actor={e.actor} />
                    <span className="text-[11px] font-mono truncate max-w-[200px]" style={{ color: "var(--muted-fg)" }}>{e.resource}</span>
                  </div>
                </div>
                {open ? <ChevronDown size={14} style={{ color: "var(--muted-fg)", flexShrink:0 }} /> : <ChevronRight size={14} style={{ color: "var(--muted-fg)", flexShrink:0 }} />}
              </button>
              {open && (
                <div className="border-t px-4 py-3" style={{ borderColor: "var(--border)" }}>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    {[["ID",e.id],["Request",e.requestId],["Country",e.country||"—"],["Action",e.action]].map(([k,v]) => (
                      <div key={k}>
                        <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-fg)" }}>{k}</p>
                        <p className="font-mono" style={{ color: "var(--fg)" }}>{v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Column Picker ─────────────────────────────────────────────
function ColumnPicker({ cols, onChange, onClose }: { cols: ColDef[]; onChange: (c: ColDef[]) => void; onClose: () => void }) {
  const toggle = (key: string) => onChange(cols.map(c => c.key === key ? { ...c, visible: !c.visible } : c));
  return (
    <div className="absolute right-0 top-10 z-30 w-52 rounded-xl shadow-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
        <span className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Columns</span>
        <button onClick={onClose}><X size={14} style={{ color: "var(--muted-fg)" }} /></button>
      </div>
      <div className="p-2 space-y-0.5">
        {cols.map(c => (
          <button key={c.key} onClick={() => toggle(c.key)}
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs hover:bg-black/5 dark:hover:bg-white/5"
            style={{ color: "var(--fg)" }}>
            {c.visible ? <CheckSquare size={13} style={{ color: "var(--primary)" }} /> : <Square size={13} style={{ color: "var(--muted-fg)" }} />}
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const SAVED_FILTERS_DEFAULT: SavedFilter[] = [
  { id:"sf1", name:"Critical Blocks",   query:"",  filters:{ severity:"critical", action:"blocked" } },
  { id:"sf2", name:"Auth Failures",     query:"",  filters:{ category:"authentication", action:"failed" } },
  { id:"sf3", name:"Policy Changes",    query:"",  filters:{ category:"policy" } },
  { id:"sf4", name:"System Events",     query:"",  filters:{ category:"system", actorType:"system" } },
];

const DENSITY_OPTS: { key: Density; label: string; icon: React.ReactNode }[] = [
  { key: "compact",     label: "Compact",     icon: <Rows3 size={13} /> },
  { key: "comfortable", label: "Comfortable", icon: <AlignJustify size={13} /> },
  { key: "spacious",    label: "Spacious",    icon: <List size={13} /> },
];

const DENSITY_ROW: Record<Density, string> = {
  compact:     "py-1 text-xs",
  comfortable: "py-2 text-sm",
  spacious:    "py-3 text-sm",
};

export function AuditLogs() {
  const [query,     setQuery]     = useState("");
  const [filters,   setFilters]   = useState<Filters>({ severity:"", category:"", action:"", actorType:"", dateFrom:"", dateTo:"" });
  const [view,      setView]      = useState<View>("table");
  const [density,   setDensity]   = useState<Density>("comfortable");
  const [cols,      setCols]      = useState<ColDef[]>(DEFAULT_COLS);
  const [page,      setPage]      = useState(1);
  const [selected,  setSelected]  = useState<Set<string>>(new Set());
  const [expanded,  setExpanded]  = useState<Set<string>>(new Set());
  const [showCols,  setShowCols]  = useState(false);
  const [showDens,  setShowDens]  = useState(false);
  const [savedFilters] = useState<SavedFilter[]>(SAVED_FILTERS_DEFAULT);
  const [sortCol,   setSortCol]   = useState<string>("timestamp");
  const [sortDir,   setSortDir]   = useState<"asc"|"desc">("desc");
  const [showFilters, setShowFilters] = useState(false);

  // ── Live data state ──────────────────────────────────────────
  const [logs,      setLogs]      = useState<LogEntry[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading,   setLoading]   = useState(true);

  const PER_PAGE = density === "compact" ? 15 : density === "comfortable" ? 10 : 7;

  // ── Fetch from real API ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAuditLogs({
      page,
      size: PER_PAGE,
      severity:  filters.severity  || undefined,
      category:  filters.category  || undefined,
      action:    filters.action    || undefined,
      actorType: filters.actorType || undefined,
      search:    query             || undefined,
      dateFrom:  filters.dateFrom  || undefined,
      dateTo:    filters.dateTo    || undefined,
    }).then(result => {
      if (cancelled) return;
      setLogs(result.data as LogEntry[]);
      setTotalLogs(result.total);
      setTotalPages(result.pages);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [page, PER_PAGE, filters, query]);

  const filtered = logs; // filtering is done server-side

  const visibleCols = cols.filter(c => c.visible);
  const colCount = visibleCols.length + 2; // +checkbox +expand

  // ── Filter & sort (client-side on current page data) ──────────
  // Primary filtering is server-side; this handles client sort only
  const paginated = useMemo(() => {
    const data = [...logs];
    data.sort((a, b) => {
      let va = (a as any)[sortCol] ?? "";
      let vb = (b as any)[sortCol] ?? "";
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      return (va < vb ? -1 : va > vb ? 1 : 0) * (sortDir === "asc" ? 1 : -1);
    });
    return data;
  }, [logs, sortCol, sortDir]);

  // ── Selection helpers ─────────────────────────────────────────
  const allPageSelected = paginated.length > 0 && paginated.every(e => selected.has(e.id));
  const toggleSelectAll = () => {
    if (allPageSelected) setSelected(s => { const n = new Set(s); paginated.forEach(e => n.delete(e.id)); return n; });
    else setSelected(s => { const n = new Set(s); paginated.forEach(e => n.add(e.id)); return n; });
  };
  const toggleRow   = (id: string) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleExpand = (id: string) => setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // ── Sort helper ───────────────────────────────────────────────
  const doSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  // ── Apply saved filter ────────────────────────────────────────
  const applySaved = (sf: SavedFilter) => {
    setQuery(sf.query);
    setFilters(f => ({ ...f, ...sf.filters }));
    setPage(1);
  };

  // ── Export ────────────────────────────────────────────────────
  const exportCSV = () => {
    const rows = [
      ["ID","Timestamp","Severity","Category","Action","Actor","Resource","Message","Request ID","Country"],
      ...logs.map(e => [e.id,e.timestamp,e.severity,e.category,e.action,e.actor.name,e.resource,`"${e.message}"`,e.requestId,e.country||""]),
    ];
    const csv  = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href = url; a.download = "audit-logs.csv"; a.click();
  };
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href = url; a.download = "audit-logs.json"; a.click();
  };

  const card = { backgroundColor: "var(--card)", border: "1px solid var(--border)" };
  const activeFiltersCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="space-y-4 max-w-screen-2xl">

      {/* ── Page header ───────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--fg)" }}>Audit Logs</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted-fg)" }}>
            {loading
              ? <span className="inline-flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Loading…</span>
              : <>{totalLogs.toLocaleString()} events · Live database</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            {(["table","timeline"] as View[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                className="px-3 py-1.5 text-xs font-medium transition-colors capitalize"
                style={{
                  backgroundColor: view === v ? "var(--primary)" : "var(--card)",
                  color: view === v ? "var(--primary-fg)" : "var(--muted-fg)",
                }}>
                {v}
              </button>
            ))}
          </div>
          {/* Export */}
          <div className="relative group">
            <button className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              style={{ backgroundColor: "var(--muted)", color: "var(--fg)" }}>
              <Download size={13} /> Export <ChevronDown size={11} />
            </button>
            <div className="hidden group-hover:block absolute right-0 top-9 z-20 rounded-lg shadow-lg w-40"
              style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
              <button onClick={exportCSV} className="block w-full px-4 py-2 text-xs text-left hover:bg-black/5 dark:hover:bg-white/5" style={{ color: "var(--fg)" }}>CSV ({totalLogs} rows)</button>
              <button onClick={exportJSON} className="block w-full px-4 py-2 text-xs text-left hover:bg-black/5 dark:hover:bg-white/5" style={{ color: "var(--fg)" }}>JSON ({totalLogs} rows)</button>
            </div>
          </div>
          <button onClick={() => { setQuery(""); setFilters({ severity:"", category:"", action:"", actorType:"", dateFrom:"", dateTo:"" }); setPage(1); }}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs" style={{ backgroundColor: "var(--muted)", color: "var(--muted-fg)" }}
            title="Reset all filters"><RefreshCw size={12} /></button>
        </div>
      </div>

      {/* ── Unified Search & Filter Command Palette ──────────────────────── */}
      <div className="rounded-xl p-3 flex flex-col gap-3 shadow-sm" style={card}>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[300px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-fg)" }} />
            <input value={query} onChange={e => { setQuery(e.target.value); setPage(1); }}
              placeholder='Search by message, resource path, IP, or Request ID…'
              className="h-10 w-full rounded-lg border pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-inner"
              style={{ backgroundColor: "var(--muted)", borderColor: "var(--border)", color: "var(--fg)" }} />
          </div>

          {/* Filter toggle */}
          <button onClick={() => setShowFilters(f => !f)}
            className="flex items-center gap-2 h-10 px-4 rounded-lg text-sm font-semibold shadow-sm transition-colors"
            style={{ backgroundColor: showFilters || activeFiltersCount > 0 ? "var(--primary)" : "var(--card)",
              color: showFilters || activeFiltersCount > 0 ? "var(--primary-fg)" : "var(--fg)",
              border: "1px solid var(--border)" }}>
            <Filter size={15} /> Filters {activeFiltersCount > 0 && <span className="px-1.5 py-0.5 rounded-md bg-white/20 text-[11px] leading-none">{activeFiltersCount}</span>}
          </button>
        </div>

        {/* Advanced filter dropdown */}
        {showFilters && (
          <div className="flex items-end gap-3 flex-wrap pt-3 border-t" style={{ borderColor: "var(--border)" }}>
            {([
              { key:"severity",  label:"Severity",  opts:["critical","high","medium","low","info"] },
              { key:"category",  label:"Category",  opts:["authentication","firewall","policy","system","api","user-mgmt"] },
              { key:"action",    label:"Action",    opts:["blocked","allowed","modified","deleted","created","failed","escalated"] },
              { key:"actorType", label:"Actor Type",opts:["user","system","api-key"] },
            ] as { key: keyof Filters; label: string; opts: string[] }[]).map(({ key, label, opts }) => (
              <div key={key} className="flex flex-col gap-1.5 flex-1 min-w-[120px]">
                <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-fg)" }}>{label}</label>
                <select value={filters[key]} onChange={e => { setFilters(f => ({ ...f, [key]: e.target.value as any })); setPage(1); }}
                  className="h-8 rounded-md border px-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm"
                  style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--fg)" }}>
                  <option value="">All {label}s</option>
                  {opts.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
                </select>
              </div>
            ))}
            <div className="flex flex-col gap-1.5 flex-1 min-w-[120px]">
              <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-fg)" }}>From Date</label>
              <input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
                className="h-8 rounded-md border px-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm"
                style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--fg)" }} />
            </div>
            <div className="flex flex-col gap-1.5 flex-1 min-w-[120px]">
              <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-fg)" }}>To Date</label>
              <input type="date" value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))}
                className="h-8 rounded-md border px-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm"
                style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--fg)" }} />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t mt-1" style={{ borderColor: "var(--border)" }}>
          {/* Saved Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <Save size={13} style={{ color: "var(--muted-fg)" }} />
            <span className="text-[10px] font-bold uppercase tracking-wider mr-1" style={{ color: "var(--muted-fg)" }}>Saved Views:</span>
            {savedFilters.map(sf => (
              <button key={sf.id} onClick={() => applySaved(sf)}
                className="rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors hover:bg-black/5 dark:hover:bg-white/5 shadow-sm"
                style={{ color: "var(--fg)", border: "1px solid var(--border)", backgroundColor: "var(--card)" }}>
                {sf.name}
              </button>
            ))}
          </div>

          {/* Active filter chips */}
          {activeFiltersCount > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider mr-1" style={{ color: "var(--muted-fg)" }}>Active:</span>
              {Object.entries(filters).filter(([,v]) => v).map(([k, v]) => (
                <span key={k} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold font-mono shadow-sm"
                  style={{ backgroundColor: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" }}>
                  {k}: {v}
                  <button onClick={() => setFilters(f => ({ ...f, [k]: "" }))} className="hover:opacity-70"><X size={10} /></button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Toolbar: density + columns + bulk actions ─────────── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* Bulk actions */}
        {selected.size > 0 ? (
          <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: "#eff6ff", border: "1px solid #bfdbfe" }}>
            <span className="text-xs font-semibold" style={{ color: "#1d4ed8" }}>{selected.size} selected</span>
            <button className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: "#dbeafe", color: "#1d4ed8" }}>Export selected</button>
            <button className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: "#dbeafe", color: "#dc2626" }}>Delete selected</button>
            <button onClick={() => setSelected(new Set())} className="text-xs px-1.5 py-0.5 rounded" style={{ color: "#1d4ed8" }}><X size={12} /></button>
          </div>
        ) : (
          <span className="text-xs" style={{ color: "var(--muted-fg)" }}>
            Page {page} of {totalPages} · {totalLogs} entries
          </span>
        )}

        <div className="flex items-center gap-2">
          {/* Density */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            {DENSITY_OPTS.map(d => (
              <button key={d.key} onClick={() => setDensity(d.key)} title={d.label}
                className="flex h-7 w-8 items-center justify-center transition-colors"
                style={{
                  backgroundColor: density === d.key ? "var(--muted)" : "var(--card)",
                  color: density === d.key ? "var(--fg)" : "var(--muted-fg)",
                }}>{d.icon}</button>
            ))}
          </div>
          {/* Column picker */}
          <div className="relative">
            <button onClick={() => setShowCols(c => !c)}
              className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs"
              style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border)" }}>
              <Columns size={12} /> Columns
            </button>
            {showCols && <ColumnPicker cols={cols} onChange={setCols} onClose={() => setShowCols(false)} />}
          </div>
        </div>
      </div>

      {/* ── Table / Timeline ──────────────────────────────────── */}
      {view === "timeline" ? (
        <TimelineView entries={paginated} />
      ) : (
        <div className="rounded-xl overflow-hidden" style={card}>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr style={{ backgroundColor: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
                  <th className="w-8 px-3 py-2">
                    <button onClick={toggleSelectAll}>
                      {allPageSelected
                        ? <CheckSquare size={14} style={{ color: "var(--primary)" }} />
                        : <Square size={14} style={{ color: "var(--muted-fg)" }} />}
                    </button>
                  </th>
                  <th className="w-6 px-2 py-2"></th>
                  {visibleCols.map(c => (
                    <th key={c.key}
                      className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide cursor-pointer select-none whitespace-nowrap"
                      style={{ color: "var(--muted-fg)" }}
                      onClick={() => doSort(c.key)}>
                      <span className="flex items-center gap-1">
                        {c.label}
                        {sortCol === c.key && <span className="text-blue-500">{sortDir === "asc" ? "↑" : "↓"}</span>}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 && (
                  <tr><td colSpan={colCount} className="py-16 text-center text-sm" style={{ color: "var(--muted-fg)" }}>No entries match your filters</td></tr>
                )}
                {paginated.map(e => {
                  const isSelected = selected.has(e.id);
                  const isExpanded = expanded.has(e.id);
                  return (
                    <React.Fragment key={e.id}>
                      <tr
                        className={cn("border-b transition-colors cursor-pointer", DENSITY_ROW[density],
                          isSelected ? "bg-blue-50 dark:bg-blue-900/30" : "hover:bg-slate-50 dark:hover:bg-slate-800/50")}
                        style={{ borderColor: "var(--border)" }}
                        onClick={() => toggleExpand(e.id)}
                      >
                        <td className="px-3" onClick={ev => { ev.stopPropagation(); toggleRow(e.id); }}>
                          {isSelected
                            ? <CheckSquare size={14} style={{ color: "var(--primary)" }} />
                            : <Square size={14} style={{ color: "var(--muted-fg)" }} />}
                        </td>
                        <td className="px-2">
                          {isExpanded
                            ? <ChevronDown size={13} style={{ color: "var(--muted-fg)" }} />
                            : <ChevronRight size={13} style={{ color: "var(--muted-fg)" }} />}
                        </td>
                        {visibleCols.map(c => (
                          <td key={c.key} className="px-3 whitespace-nowrap">
                            {c.key === "timestamp" && <span className="font-mono font-medium" style={{ color: "var(--muted-fg)", fontSize:"11px" }}>{formatTs(e.timestamp)}</span>}
                            {c.key === "severity"  && <SevBadge s={e.severity} />}
                            {c.key === "category"  && (
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-fg)" }}>
                                {CAT_ICON[e.category]} {e.category}
                              </span>
                            )}
                            {c.key === "action"    && <ActionBadge a={e.action} />}
                            {c.key === "actor"     && <ActorChip actor={e.actor} />}
                            {c.key === "resource"  && <span className="font-mono truncate block max-w-[180px] text-xs font-medium" style={{ color: "var(--fg)" }}>{e.resource}</span>}
                            {c.key === "message"   && <span className="truncate block max-w-[300px] text-xs font-semibold" style={{ color: "var(--fg)" }}>{e.message}</span>}
                            {c.key === "requestId" && <span className="font-mono text-[11px] font-bold tracking-tight" style={{ color: "var(--muted-fg)" }}>{e.requestId}</span>}
                            {c.key === "country"   && <span className="text-xs font-medium" style={{ color: "var(--muted-fg)" }}>{e.country || "—"}</span>}
                          </td>
                        ))}
                      </tr>
                      {isExpanded && <ExpandedRow entry={e} colspan={colCount} />}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: "var(--border)" }}>
            <span className="text-xs" style={{ color: "var(--muted-fg)" }}>
              {totalLogs > 0 ? `${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, totalLogs)} of ${totalLogs}` : "0 entries"}
            </span>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => setPage(1)}
                className="h-6 px-2 rounded text-[11px] disabled:opacity-30" style={{ color: "var(--muted-fg)" }}>«</button>
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="h-6 px-2 rounded text-[11px] disabled:opacity-30" style={{ color: "var(--muted-fg)" }}>‹</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let startPage = Math.max(1, page - 2);
                if (startPage + 4 > totalPages) startPage = Math.max(1, totalPages - 4);
                const p = startPage + i;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className="h-6 w-6 rounded text-[11px] font-medium"
                    style={{
                      backgroundColor: page === p ? "var(--primary)" : "transparent",
                      color: page === p ? "var(--primary-fg)" : "var(--muted-fg)",
                    }}>{p}</button>
                );
              })}
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="h-6 px-2 rounded text-[11px] disabled:opacity-30" style={{ color: "var(--muted-fg)" }}>›</button>
              <button disabled={page >= totalPages} onClick={() => setPage(totalPages)}
                className="h-6 px-2 rounded text-[11px] disabled:opacity-30" style={{ color: "var(--muted-fg)" }}>»</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
