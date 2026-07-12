// src/pages/Settings.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  Settings as SettingsIcon, Save, ShieldAlert, Cpu, Database,
  Bell, Loader2, Check, RotateCcw, Wifi, Eye, Activity,
  ToggleLeft, ToggleRight, AlertTriangle, Info, Shield, Sliders,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface WAFSettings {
  // Engine
  waf_mode: string;
  auto_block_enabled: string;
  ai_analysis_enabled: string;
  geo_blocking_enabled: string;
  rate_limiting_enabled: string;
  // Thresholds
  confidence_threshold: string;
  rate_limit_req_per_min: string;
  block_duration_minutes: string;
  max_body_size_kb: string;
  // Detectors
  detect_sqli: string;
  detect_xss: string;
  detect_path_traversal: string;
  detect_rce: string;
  detect_bot: string;
  // Notifications
  notify_email_enabled: string;
  notify_slack_enabled: string;
  notify_email_recipient: string;
  notify_slack_webhook: string;
  notify_on_critical: string;
  notify_on_high: string;
  notify_on_medium: string;
  // Logging
  log_allowed_requests: string;
  log_retention_days: string;
  // System
  system_name: string;
  system_timezone: string;
}

type Tab = "engine" | "thresholds" | "detectors" | "notifications" | "logging";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "engine",        label: "WAF Engine",    icon: <Cpu size={14} /> },
  { key: "thresholds",    label: "Thresholds",    icon: <Sliders size={14} /> },
  { key: "detectors",     label: "Detectors",     icon: <Shield size={14} /> },
  { key: "notifications", label: "Notifications", icon: <Bell size={14} /> },
  { key: "logging",       label: "Logging",       icon: <Database size={14} /> },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const bool = (v: string) => v === "true";
const str  = (v: boolean) => v ? "true" : "false";

function Toggle({ value, onChange, id }: { value: boolean; onChange: (v: boolean) => void; id: string }) {
  return (
    <button
      id={id}
      type="button"
      onClick={() => onChange(!value)}
      className="flex items-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full"
      aria-checked={value}
      role="switch"
    >
      <span className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200"
        style={{ backgroundColor: value ? "#3b82f6" : "var(--border)" }}>
        <span className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200"
          style={{ transform: value ? "translateX(20px)" : "translateX(2px)" }} />
      </span>
    </button>
  );
}

function SectionRow({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b last:border-0"
      style={{ borderColor: "var(--border)" }}>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>{label}</p>
        {desc && <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-fg)" }}>{desc}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5 space-y-1" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <h2 className="flex items-center gap-2 text-sm font-bold mb-4" style={{ color: "var(--fg)" }}>
        <span style={{ color: "var(--primary)" }}>{icon}</span>
        {title}
      </h2>
      {children}
    </div>
  );
}

function NumberInput({ value, onChange, min, max, unit }: { value: string; onChange: (v: string) => void; min?: number; max?: number; unit?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        min={min} max={max}
        className="h-8 w-24 rounded-lg border px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        style={{ backgroundColor: "var(--muted)", borderColor: "var(--border)", color: "var(--fg)" }}
      />
      {unit && <span className="text-[11px]" style={{ color: "var(--muted-fg)" }}>{unit}</span>}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function Settings() {
  const [tab,     setTab]     = useState<Tab>("engine");
  const [cfg,     setCfg]     = useState<WAFSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [status,  setStatus]  = useState<"idle" | "saved" | "error">("idle");
  const [dirty,   setDirty]   = useState(false);

  // ── Fetch settings ────────────────────────────────────────────────────────
  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/v1/settings");
      const data = await res.json();
      setCfg(data.data);
      setDirty(false);
    } catch {
      setCfg(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  // ── Update helper ─────────────────────────────────────────────────────────
  const update = (key: keyof WAFSettings, value: string) => {
    setCfg(prev => prev ? { ...prev, [key]: value } : prev);
    setDirty(true);
    setStatus("idle");
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!cfg) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: cfg }),
      });
      if (res.ok) {
        const data = await res.json();
        setCfg(data.data);
        setDirty(false);
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 3000);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    } finally {
      setSaving(false);
    }
  };

  // ── Reset ─────────────────────────────────────────────────────────────────
  const handleReset = async () => {
    if (!confirm("Reset all settings to factory defaults?")) return;
    setSaving(true);
    try {
      const res  = await fetch("/api/v1/settings/reset", { method: "POST" });
      const data = await res.json();
      setCfg(data.data);
      setDirty(false);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setStatus("error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--primary)" }} />
      </div>
    );
  }

  if (!cfg) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <AlertTriangle size={32} style={{ color: "#f59e0b" }} />
        <p className="text-sm" style={{ color: "var(--muted-fg)" }}>Failed to load settings. Check backend connection.</p>
        <button onClick={fetchSettings} className="text-xs text-blue-500 hover:underline">Retry</button>
      </div>
    );
  }

  const wafModeColor = cfg.waf_mode === "active" ? "#10b981" : cfg.waf_mode === "monitor" ? "#f59e0b" : "#ef4444";
  const wafModeLabel = cfg.waf_mode === "active" ? "Active (blocking)" : cfg.waf_mode === "monitor" ? "Monitor only (no blocking)" : "Disabled";

  return (
    <div className="space-y-4 max-w-4xl">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--fg)" }}>System Settings</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted-fg)" }}>
            Configure WAF engine, thresholds, detectors, and notifications
            {dirty && <span className="ml-2 text-amber-500 text-xs font-medium">· Unsaved changes</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleReset} disabled={saving}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border transition-colors hover:opacity-80 disabled:opacity-40"
            style={{ borderColor: "var(--border)", color: "var(--muted-fg)", backgroundColor: "var(--muted)" }}>
            <RotateCcw size={12} /> Reset defaults
          </button>
          <button onClick={handleSave} disabled={saving || !dirty}
            className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)" }}>
            {saving ? <><Loader2 size={13} className="animate-spin" /> Saving…</> :
             status === "saved" ? <><Check size={13} /> Saved!</> :
             <><Save size={13} /> Save Changes</>}
          </button>
        </div>
      </div>

      {/* Status banner */}
      {status === "saved" && (
        <div className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-medium"
          style={{ backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d" }}>
          <Check size={13} /> Settings saved and applied successfully.
        </div>
      )}
      {status === "error" && (
        <div className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-medium"
          style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
          <AlertTriangle size={13} /> Failed to save. Please try again.
        </div>
      )}

      {/* ── WAF Mode banner ─────────────────────────────────────────── */}
      <div className="rounded-xl px-5 py-3 flex items-center justify-between flex-wrap gap-3"
        style={{ backgroundColor: "var(--card)", border: `2px solid ${wafModeColor}33` }}>
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 rounded-full animate-pulse" style={{ backgroundColor: wafModeColor }} />
          <div>
            <span className="text-xs font-semibold" style={{ color: "var(--fg)" }}>WAF Mode: </span>
            <span className="text-xs font-bold" style={{ color: wafModeColor }}>{wafModeLabel}</span>
          </div>
        </div>
        <div className="flex gap-1">
          {(["active", "monitor", "off"] as const).map(m => (
            <button key={m} type="button"
              onClick={() => update("waf_mode", m)}
              className="px-3 py-1 rounded-lg text-xs font-semibold transition-all capitalize"
              style={{
                backgroundColor: cfg.waf_mode === m ? wafModeColor : "var(--muted)",
                color: cfg.waf_mode === m ? "#fff" : "var(--muted-fg)",
              }}>
              {m === "active" ? "Active" : m === "monitor" ? "Monitor" : "Off"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────── */}
      <div className="flex gap-1 rounded-xl p-1" style={{ backgroundColor: "var(--muted)" }}>
        {TABS.map(t => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-1 justify-center"
            style={{
              backgroundColor: tab === t.key ? "var(--card)" : "transparent",
              color: tab === t.key ? "var(--primary)" : "var(--muted-fg)",
              boxShadow: tab === t.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
            }}>
            {t.icon} <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab content ─────────────────────────────────────────────── */}

      {/* Engine Tab */}
      {tab === "engine" && (
        <Card title="WAF Engine Configuration" icon={<Cpu size={16} />}>
          <SectionRow label="Auto-Block Attacking IPs"
            desc="Immediately place IPs with high threat score on the block list">
            <Toggle id="toggle-auto-block" value={bool(cfg.auto_block_enabled)}
              onChange={v => update("auto_block_enabled", str(v))} />
          </SectionRow>
          <SectionRow label="AI-Powered Deep Inspection"
            desc="Use local LLM to scan suspicious payloads (requires Ollama)">
            <Toggle id="toggle-ai" value={bool(cfg.ai_analysis_enabled)}
              onChange={v => update("ai_analysis_enabled", str(v))} />
          </SectionRow>
          <SectionRow label="GeoIP Blocking"
            desc="Block or monitor requests based on country of origin">
            <Toggle id="toggle-geo" value={bool(cfg.geo_blocking_enabled)}
              onChange={v => update("geo_blocking_enabled", str(v))} />
          </SectionRow>
          <SectionRow label="Rate Limiting"
            desc="Enforce per-IP rate limits to prevent brute-force and DDoS">
            <Toggle id="toggle-rate" value={bool(cfg.rate_limiting_enabled)}
              onChange={v => update("rate_limiting_enabled", str(v))} />
          </SectionRow>
          <SectionRow label="System Name"
            desc="Display name shown in dashboards and notifications">
            <input type="text" value={cfg.system_name}
              onChange={e => update("system_name", e.target.value)}
              className="h-8 w-44 rounded-lg border px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ backgroundColor: "var(--muted)", borderColor: "var(--border)", color: "var(--fg)" }} />
          </SectionRow>
          <SectionRow label="Timezone"
            desc="Used for log timestamps and report scheduling">
            <select value={cfg.system_timezone}
              onChange={e => update("system_timezone", e.target.value)}
              className="h-8 rounded-lg border px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ backgroundColor: "var(--muted)", borderColor: "var(--border)", color: "var(--fg)" }}>
              {["UTC", "US/Eastern", "US/Pacific", "Europe/London", "Asia/Kolkata", "Asia/Singapore"].map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </SectionRow>
        </Card>
      )}

      {/* Thresholds Tab */}
      {tab === "thresholds" && (
        <Card title="Threat Thresholds & Limits" icon={<Sliders size={16} />}>
          <SectionRow label="AI Block Confidence Threshold"
            desc="Minimum AI confidence score (%) to trigger an automatic block">
            <div className="flex flex-col items-end gap-1 w-40">
              <span className="text-xs font-mono font-bold" style={{ color: "var(--primary)" }}>
                {cfg.confidence_threshold}%
              </span>
              <input type="range" min="50" max="99" value={cfg.confidence_threshold}
                onChange={e => update("confidence_threshold", e.target.value)}
                className="w-full h-1.5 rounded-lg cursor-pointer appearance-none"
                style={{ accentColor: "var(--primary)" }} />
              <div className="flex justify-between w-full text-[9px]" style={{ color: "var(--muted-fg)" }}>
                <span>50% (permissive)</span><span>99% (strict)</span>
              </div>
            </div>
          </SectionRow>
          <SectionRow label="Rate Limit" desc="Max requests per IP per minute before throttling">
            <NumberInput value={cfg.rate_limit_req_per_min}
              onChange={v => update("rate_limit_req_per_min", v)} min={1} max={10000} unit="req/min" />
          </SectionRow>
          <SectionRow label="Block Duration" desc="How long a temp-blocked IP remains on the blocklist">
            <NumberInput value={cfg.block_duration_minutes}
              onChange={v => update("block_duration_minutes", v)} min={1} max={10080} unit="minutes" />
          </SectionRow>
          <SectionRow label="Max Request Body Size" desc="Requests with bodies larger than this are rejected">
            <NumberInput value={cfg.max_body_size_kb}
              onChange={v => update("max_body_size_kb", v)} min={1} max={102400} unit="KB" />
          </SectionRow>

          {/* Visual summary */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              { label: "Confidence", value: `${cfg.confidence_threshold}%`, color: "#3b82f6" },
              { label: "Rate Limit", value: `${cfg.rate_limit_req_per_min}/min`, color: "#8b5cf6" },
              { label: "Block Time", value: `${cfg.block_duration_minutes}m`, color: "#f59e0b" },
              { label: "Body Limit", value: `${cfg.max_body_size_kb}KB`, color: "#10b981" },
            ].map(stat => (
              <div key={stat.label} className="rounded-lg p-3 text-center"
                style={{ backgroundColor: "var(--muted)" }}>
                <p className="text-lg font-black" style={{ color: stat.color }}>{stat.value}</p>
                <p className="text-[10px] font-medium mt-0.5" style={{ color: "var(--muted-fg)" }}>{stat.label}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Detectors Tab */}
      {tab === "detectors" && (
        <Card title="Attack Detection Modules" icon={<Shield size={16} />}>
          <div className="mb-2 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs"
            style={{ backgroundColor: "#eff6ff", color: "#1d4ed8" }}>
            <Info size={12} className="shrink-0" />
            Disabling a detector does not remove its rules — it only prevents automatic scanning.
          </div>
          {[
            { key: "detect_sqli",           label: "SQL Injection Detector",     desc: "Regex + heuristic analysis of SQL patterns in params/body", sev: "critical" },
            { key: "detect_xss",            label: "XSS Detector",               desc: "Detects script injection in query, headers, and form fields", sev: "high" },
            { key: "detect_path_traversal", label: "Path Traversal Detector",    desc: "Identifies ../  and encoded directory traversal sequences", sev: "high" },
            { key: "detect_rce",            label: "RCE / Command Injection",    desc: "Detects shell command injection patterns in HTTP requests", sev: "critical" },
            { key: "detect_bot",            label: "Malicious Bot Detector",     desc: "Fingerprints known scanners, crawlers, and bad user-agents", sev: "medium" },
          ].map(d => {
            const sevColor = d.sev === "critical" ? "#dc2626" : d.sev === "high" ? "#c2410c" : "#b45309";
            return (
              <SectionRow key={d.key} label={d.label} desc={d.desc}>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold rounded px-1.5 py-0.5"
                    style={{ backgroundColor: `${sevColor}15`, color: sevColor }}>
                    {d.sev}
                  </span>
                  <Toggle id={`toggle-${d.key}`} value={bool((cfg as any)[d.key])}
                    onChange={v => update(d.key as keyof WAFSettings, str(v))} />
                </div>
              </SectionRow>
            );
          })}
        </Card>
      )}

      {/* Notifications Tab */}
      {tab === "notifications" && (
        <div className="space-y-4">
          <Card title="Notification Channels" icon={<Bell size={16} />}>
            <SectionRow label="Email Alerts" desc="Receive security alerts via email">
              <Toggle id="toggle-email" value={bool(cfg.notify_email_enabled)}
                onChange={v => update("notify_email_enabled", str(v))} />
            </SectionRow>
            {bool(cfg.notify_email_enabled) && (
              <SectionRow label="Email Recipient" desc="Alert email address">
                <input type="email" value={cfg.notify_email_recipient}
                  onChange={e => update("notify_email_recipient", e.target.value)}
                  placeholder="security@company.com"
                  className="h-8 w-52 rounded-lg border px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ backgroundColor: "var(--muted)", borderColor: "var(--border)", color: "var(--fg)" }} />
              </SectionRow>
            )}
            <SectionRow label="Slack Alerts" desc="Post alerts to a Slack webhook">
              <Toggle id="toggle-slack" value={bool(cfg.notify_slack_enabled)}
                onChange={v => update("notify_slack_enabled", str(v))} />
            </SectionRow>
            {bool(cfg.notify_slack_enabled) && (
              <SectionRow label="Slack Webhook URL" desc="Incoming webhook URL from your Slack app">
                <input type="url" value={cfg.notify_slack_webhook}
                  onChange={e => update("notify_slack_webhook", e.target.value)}
                  placeholder="https://hooks.slack.com/..."
                  className="h-8 w-64 rounded-lg border px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ backgroundColor: "var(--muted)", borderColor: "var(--border)", color: "var(--fg)" }} />
              </SectionRow>
            )}
          </Card>

          <Card title="Alert Severity Triggers" icon={<AlertTriangle size={16} />}>
            {[
              { key: "notify_on_critical", label: "Critical Events",  desc: "SQLi, RCE, path traversal", color: "#dc2626" },
              { key: "notify_on_high",     label: "High Severity",    desc: "XSS, brute force, escalation", color: "#c2410c" },
              { key: "notify_on_medium",   label: "Medium Severity",  desc: "Rate limiting, auth anomalies", color: "#b45309" },
            ].map(s => (
              <SectionRow key={s.key} label={s.label} desc={s.desc}>
                <div className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <Toggle id={`toggle-${s.key}`} value={bool((cfg as any)[s.key])}
                    onChange={v => update(s.key as keyof WAFSettings, str(v))} />
                </div>
              </SectionRow>
            ))}
          </Card>
        </div>
      )}

      {/* Logging Tab */}
      {tab === "logging" && (
        <Card title="Log Management" icon={<Database size={16} />}>
          <SectionRow label="Log Allowed Requests"
            desc="Include benign, allowed traffic in the request log (increases storage usage)">
            <Toggle id="toggle-log-allowed" value={bool(cfg.log_allowed_requests)}
              onChange={v => update("log_allowed_requests", str(v))} />
          </SectionRow>
          <SectionRow label="Log Retention Period"
            desc="Automatically purge logs older than this many days">
            <NumberInput value={cfg.log_retention_days}
              onChange={v => update("log_retention_days", v)} min={7} max={3650} unit="days" />
          </SectionRow>

          {/* Storage estimate */}
          <div className="mt-4 rounded-xl p-4" style={{ backgroundColor: "var(--muted)" }}>
            <p className="text-[11px] font-semibold mb-3" style={{ color: "var(--fg)" }}>Storage Estimate</p>
            <div className="space-y-2">
              {[
                { label: "Attack logs", pct: 65, color: "#dc2626" },
                { label: "Audit logs",  pct: 20, color: "#3b82f6" },
                { label: "Requests",    pct: 15, color: "#10b981" },
              ].map(s => (
                <div key={s.label} className="space-y-1">
                  <div className="flex justify-between text-[10px]" style={{ color: "var(--muted-fg)" }}>
                    <span>{s.label}</span><span>{s.pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] mt-3" style={{ color: "var(--muted-fg)" }}>
              Retention: {cfg.log_retention_days} days · Estimated ~{Math.round(Number(cfg.log_retention_days) * 0.4)}MB/month
            </p>
          </div>
        </Card>
      )}

      {/* ── Footer save bar ─────────────────────────────────────────── */}
      {dirty && (
        <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-xl px-5 py-3 shadow-2xl"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--primary)" }}>
          <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
            You have unsaved changes.
          </p>
          <div className="flex gap-2">
            <button onClick={fetchSettings} disabled={saving}
              className="h-7 px-3 rounded-lg text-xs border disabled:opacity-40"
              style={{ borderColor: "var(--border)", color: "var(--muted-fg)" }}>
              Discard
            </button>
            <button onClick={handleSave} disabled={saving}
              className="h-7 px-4 rounded-lg text-xs font-semibold text-white disabled:opacity-40 flex items-center gap-1.5"
              style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)" }}>
              {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
              {saving ? "Saving…" : "Save now"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
