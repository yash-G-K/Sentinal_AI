// src/pages/SOCAssistant.tsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Send, Brain, Shield, AlertTriangle, FileText, Terminal,
  ChevronRight, ChevronDown, Copy, Check, Bookmark, BookmarkCheck,
  Clock, Activity, Zap, Search, Plus, X, RotateCcw, Database,
  GitBranch, Target, Layers, Cpu, Eye, ExternalLink, Info,
  TrendingUp, Flag, Hash, Globe, Network, BookOpen, Sparkles,
  MessageSquare, History, Filter, Code, CheckCircle, XCircle,
  BarChart2, List, ArrowRight, Loader2
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type MsgRole = "user" | "assistant";
type CardType = "text" | "threat_analysis" | "rule_suggestion" | "log_summary" | "incident" | "attack_pattern" | "ioc_list" | "remediation";

interface Source { label: string; type: "log" | "rule" | "event" | "intel"; id?: string; }
interface FollowUp { label: string; query: string; }

interface MitreTag { id: string; name: string; tactic: string; }

interface ThreatCard {
  threatName: string; severity: "critical" | "high" | "medium" | "low";
  confidence: number; mitre: MitreTag[]; iocs: string[];
  affectedEndpoints: string[]; recommendation: string;
  firstSeen: string; count: number;
}
interface RuleCard {
  name: string; action: "block" | "allow" | "rate_limit" | "challenge";
  conditions: Array<{ field: string; op: string; value: string }>;
  effectiveness: number; falsePositiveRisk: "low" | "medium" | "high";
  reason: string;
}
interface LogSummaryCard {
  period: string; totalEvents: number; anomalies: number;
  keyFindings: string[]; topPatterns: Array<{ pattern: string; count: number }>;
  riskLevel: "critical" | "elevated" | "normal";
}
interface IncidentCard {
  incidentId: string; severity: "critical" | "high" | "medium";
  title: string; timeline: Array<{ time: string; event: string }>;
  affectedAssets: string[]; attackChain: string[]; status: "active" | "contained" | "resolved";
  containmentSteps: string[];
}
interface AttackPatternCard {
  name: string; mitre: MitreTag; killChainPhase: string;
  indicators: string[]; confidence: number; examples: string[];
}

interface Message {
  id: string; role: MsgRole; timestamp: string;
  text?: string; cardType?: CardType;
  threatData?:     ThreatCard;
  ruleData?:       RuleCard;
  logData?:        LogSummaryCard;
  incidentData?:   IncidentCard;
  attackData?:     AttackPatternCard;
  confidence?:     number;
  sources?:        Source[];
  followUps?:      FollowUp[];
  bookmarked?:     boolean;
  thinking?:       boolean; // loading state
}

interface Session { id: string; title: string; lastAt: string; msgCount: number; }

// ─── Response Engine ──────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 9); }
function nowTs() { return new Date().toISOString(); }

const RESPONSES: Record<string, () => Message> = {
  sql: () => ({
    id: uid(), role: "assistant", timestamp: nowTs(), cardType: "threat_analysis", confidence: 94,
    threatData: {
      threatName: "SQL Injection (SQLi) - Blind Boolean-Based", severity: "critical",
      confidence: 94, count: 1847, firstSeen: "2026-07-03T11:23:00Z",
      mitre: [
        { id: "T1190", name: "Exploit Public-Facing Application", tactic: "Initial Access" },
        { id: "T1078", name: "Valid Accounts",                    tactic: "Defense Evasion" },
      ],
      iocs: ["sqlmap/1.7.9", "' OR '1'='1", "UNION SELECT NULL--", "185.220.101.47", "45.33.32.156"],
      affectedEndpoints: ["/api/v1/users", "/api/v1/products", "/auth/login"],
      recommendation: "Deploy SQL_INJECTION_BLOCK_v2 rule immediately. All three affected endpoints lack parameterized query enforcement at the API gateway layer.",
    },
    sources: [
      { label: "WAF Attack Log",     type: "log",   id: "waf_log_20260703" },
      { label: "Request History",    type: "log",   id: "req_20260703" },
      { label: "IP Reputation Feed", type: "intel", id: "ip_rep_185" },
    ],
    followUps: [
      { label: "Generate blocking rule for SQLi",       query: "Generate a WAF rule to block SQL injection payloads" },
      { label: "Show all attacks from Russia today",    query: "Summarize all attack attempts from Russian IP ranges in the last 24 hours" },
      { label: "What other OWASP Top 10 are we seeing?",query: "Which OWASP Top 10 vulnerabilities have been attempted in the last 7 days?" },
    ],
  }),

  rule: () => ({
    id: uid(), role: "assistant", timestamp: nowTs(), cardType: "rule_suggestion", confidence: 89,
    ruleData: {
      name: "Block SQL Injection - Boolean & UNION Based",
      action: "block", effectiveness: 92, falsePositiveRisk: "low",
      reason: "Patterns derived from 1,847 confirmed SQLi attempts over 72 hours. Regex tuned to minimize false positives on legitimate search queries.",
      conditions: [
        { field: "query-param", op: "matches",  value: "(\\bUNION\\b.+\\bSELECT\\b|\\bOR\\b\\s+['\"]?\\d+['\"]?\\s*=\\s*['\"]?\\d)" },
        { field: "user-agent",  op: "contains", value: "sqlmap" },
        { field: "path",        op: "matches",  value: "(%27|'|--|%23|#)" },
      ],
    },
    sources: [{ label: "Attack log analysis", type: "log" }, { label: "OWASP SQLi patterns", type: "intel" }],
    followUps: [
      { label: "Show false positive risk analysis", query: "Analyze false positive risk for this SQLi blocking rule on our API endpoints" },
      { label: "Generate XSS blocking rule",        query: "Generate a WAF rule to block XSS payloads" },
      { label: "Test this rule in simulation mode", query: "Run simulation mode with this rule against recent traffic" },
    ],
  }),

  log: () => ({
    id: uid(), role: "assistant", timestamp: nowTs(), cardType: "log_summary", confidence: 97,
    logData: {
      period: "Last 24 hours (2026-07-02 18:00 -> 2026-07-03 18:00)",
      totalEvents: 284391, anomalies: 47, riskLevel: "critical",
      keyFindings: [
        "1,847 SQLi attempts blocked - 94% from 3 ASNs (AS51396, AS203020, AS60781)",
        "Brute-force campaign on /auth/login: 2,341 attempts, 0 successful logins",
        "Path traversal spike at 14:22 UTC - 312 attempts in 8-minute window",
        "3 new IPs added to blocklist via AI auto-detection (confidence > 90%)",
        "Geo-block rule caught 2,103 requests from sanctioned regions",
      ],
      topPatterns: [
        { pattern: "SQL boolean injection via query-param",  count: 1847 },
        { pattern: "Brute-force /auth/login POST",           count: 2341 },
        { pattern: "XSS payload in search param",            count: 984  },
        { pattern: "Path traversal ../etc/passwd",           count: 312  },
        { pattern: "Scanner UA (sqlmap, nikto, nmap)",       count: 218  },
      ],
    },
    sources: [
      { label: "WAF Request Log",    type: "log" },
      { label: "Security Events DB", type: "log" },
      { label: "Attack Log",         type: "log" },
    ],
    followUps: [
      { label: "Explain the SQLi campaign in detail",    query: "Analyze the SQL injection campaign targeting our API. Who is behind it?" },
      { label: "Create incident report for brute force", query: "Generate an incident report for the brute-force attack on /auth/login" },
      { label: "Which rules were most effective?",       query: "Which firewall rules blocked the most threats in the last 24 hours?" },
    ],
  }),

  incident: () => ({
    id: uid(), role: "assistant", timestamp: nowTs(), cardType: "incident", confidence: 91,
    incidentData: {
      incidentId: "INC-2026-0703-001", severity: "high",
      title: "Coordinated Brute-Force Campaign on Authentication Endpoint",
      status: "contained",
      timeline: [
        { time: "11:47 UTC", event: "First anomalous login attempt from 185.220.101.47" },
        { time: "11:52 UTC", event: "Rate limit threshold breached - 100 req/min exceeded" },
        { time: "11:54 UTC", event: "AI Detector escalated to on-call via PagerDuty" },
        { time: "12:01 UTC", event: "Geo-IP analysis identified 12 source countries" },
        { time: "12:09 UTC", event: "Automatic IP block applied to 23 attacking IPs" },
        { time: "12:15 UTC", event: "Attack volume dropped 97% after containment" },
      ],
      affectedAssets: ["/auth/login", "/auth/oauth/token", "User auth service (svc-auth-prod)"],
      attackChain: ["Reconnaissance", "Credential Stuffing", "Authentication Bypass Attempt", "Lateral Movement (attempted, blocked)"],
      containmentSteps: [
        "Block all IPs from AS51396 (Tor exit nodes) at edge firewall",
        "Enable MFA enforcement for all admin accounts",
        "Rotate JWT signing secret as precaution",
        "Increase /auth/login rate limit to 10 req/min per IP",
        "Alert security team to monitor for lateral movement",
      ],
    },
    sources: [
      { label: "Security Event: BF-2026-0703", type: "event", id: "sec_evt_001" },
      { label: "IP Reputation: 185.220.101.47", type: "intel" },
      { label: "WAF Request Log", type: "log" },
    ],
    followUps: [
      { label: "Generate containment rule", query: "Generate a WAF rule to rate-limit /auth/login to 10 req/min per IP" },
      { label: "Export incident report",    query: "Export this incident as a formatted PDF report" },
      { label: "MITRE ATT&CK mapping",      query: "Map this brute-force incident to MITRE ATT&CK techniques" },
    ],
  }),

  attack: () => ({
    id: uid(), role: "assistant", timestamp: nowTs(), cardType: "attack_pattern", confidence: 88,
    attackData: {
      name: "Credential Stuffing via Distributed Proxy Network",
      killChainPhase: "Credential Access",
      confidence: 88,
      mitre: { id: "T1110.004", name: "Credential Stuffing", tactic: "Credential Access" },
      indicators: [
        "185.220.101.47 - Tor exit node (AbuseIPDB score: 97/100)",
        "45.33.32.156 - VPN provider (Mullvad, flagged)",
        "Rotating user agents across requests (9 distinct UAs detected)",
        "Login attempts distributed across 47-second intervals to avoid rate limits",
        "10,000+ username/password combinations from RockYou2024 wordlist pattern",
      ],
      examples: [
        "POST /auth/login {email: 'admin@corp.com', pass: 'Admin123!'}",
        "POST /auth/login {email: 'root@corp.com', pass: 'password1'}",
        "POST /auth/login {email: 'alice@corp.com', pass: 'Alice2024!'}",
      ],
    },
    sources: [
      { label: "TOR exit node feed", type: "intel" },
      { label: "AbuseIPDB correlation", type: "intel" },
      { label: "Login request log", type: "log" },
    ],
    followUps: [
      { label: "How do we detect credential stuffing proactively?", query: "What detection rules can identify credential stuffing before accounts are compromised?" },
      { label: "Generate honeypot account rule", query: "Generate a rule to detect and block any login attempt to our canary accounts" },
      { label: "Full MITRE ATT&CK kill chain", query: "Show me the full MITRE ATT&CK kill chain for this attack campaign" },
    ],
  }),

  default: () => ({
    id: uid(), role: "assistant", timestamp: nowTs(), cardType: "text",
    confidence: 82,
    text: `I've analyzed the current security context. Here's what I'm seeing:\n\n**Current threat level: ELEVATED**\n\n- 7 critical alerts active in the last hour\n- SQL injection campaign ongoing from 3 source ASNs\n- Authentication brute-force partially contained\n- 2 AI-generated rule recommendations pending review\n\nI can help you investigate specific threats, generate firewall rules, analyze logs, or create incident reports. Use the suggested prompts below or describe what you'd like to investigate.`,
    sources: [{ label: "Dashboard context", type: "event" }, { label: "Active alert feed", type: "log" }],
    followUps: [
      { label: "What are the top threats right now?",    query: "Summarize the current active threats and their severity levels" },
      { label: "Analyze the last 24 hours",              query: "Give me a full security summary for the last 24 hours" },
      { label: "Who is attacking us most aggressively?", query: "Which threat actor or IP is responsible for the most attacks today?" },
    ],
  }),
};

function getResponse(query: string): () => Message {
  const q = query.toLowerCase();
  if (q.includes("sql") || q.includes("injection"))             return RESPONSES.sql;
  if (q.includes("rule") || q.includes("generate") || q.includes("block rule")) return RESPONSES.rule;
  if (q.includes("log") || q.includes("summarize") || q.includes("summary") || q.includes("24"))  return RESPONSES.log;
  if (q.includes("incident") || q.includes("report"))           return RESPONSES.incident;
  if (q.includes("attack") || q.includes("brute") || q.includes("credential") || q.includes("pattern")) return RESPONSES.attack;
  return RESPONSES.default;
}

const SUGGESTED_PROMPTS: FollowUp[] = [
  { label: "Security summary - last 24h",          query: "Give me a full security summary for the last 24 hours" },
  { label: "Explain current SQLi campaign",        query: "Analyze the SQL injection campaign targeting our API" },
  { label: "Generate rule for brute force",        query: "Generate a WAF rule to rate-limit /auth/login to 10 req/min per IP" },
  { label: "Incident report - auth attack",        query: "Generate an incident report for the brute-force attack on /auth/login" },
  { label: "Who is attacking us today?",           query: "Which threat actors or IP ranges are responsible for attacks today?" },
  { label: "MITRE ATT&CK mapping",                 query: "Map our current incidents to MITRE ATT&CK techniques and tactics" },
  { label: "Top 5 IOCs in last 7 days",            query: "List the top 5 indicators of compromise from the last 7 days" },
  { label: "Firewall rule effectiveness",          query: "Which firewall rules blocked the most threats in the last 24 hours?" },
];

const INITIAL_SESSIONS: Session[] = [
  { id: "s1", title: "SQLi Campaign Analysis", lastAt: new Date(Date.now() - 3600000).toISOString(), msgCount: 12 },
  { id: "s2", title: "Brute Force Incident",   lastAt: new Date(Date.now() - 86400000).toISOString(), msgCount: 8 },
  { id: "s3", title: "Rule Tuning Session",    lastAt: new Date(Date.now() - 172800000).toISOString(), msgCount: 5 },
];

const WELCOME_MSG: Message = {
  id: "welcome", role: "assistant", timestamp: nowTs(), cardType: "text",
  confidence: 100,
  text: `**Sentinel SOC Copilot** is ready.\n\nI have access to your WAF logs, attack history, firewall rules, IP reputation feeds, and threat intelligence. I can help you:\n\n- Analyze active threats and campaigns\n- Generate optimized firewall rules from attack patterns\n- Summarize log data into actionable findings\n- Create structured incident reports\n- Map attacks to MITRE ATT&CK techniques\n- Identify indicators of compromise\n\nWhat would you like to investigate?`,
  sources: [
    { label: "WAF Request Log (284K events)", type: "log" },
    { label: "Attack Log (3.8K entries)",     type: "log" },
    { label: "IP Reputation Feed",            type: "intel" },
    { label: "7 Active Firewall Rules",       type: "rule" },
  ],
  followUps: SUGGESTED_PROMPTS.slice(0, 3),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function cn(...c: (string | false | null | undefined)[]) { return c.filter(Boolean).join(" "); }

const SEV_COLORS = {
  critical: { text: "#dc2626", bg: "#fef2f2", border: "#fee2e2" },
  high:     { text: "#c2410c", bg: "#fff7ed", border: "#ffedd5" },
  medium:   { text: "#b45309", bg: "#fffbeb", border: "#fef3c7" },
  low:      { text: "#15803d", bg: "#f0fdf4", border: "#dcfce7" },
};

const ACTION_COLORS = {
  block:      { text: "#dc2626", bg: "#fef2f2" },
  allow:      { text: "#15803d", bg: "#f0fdf4" },
  rate_limit: { text: "#b45309", bg: "#fffbeb" },
  challenge:  { text: "#1d4ed8", bg: "#eff6ff" },
};

const TACTIC_COLORS: Record<string, string> = {
  "Initial Access": "#ef4444", "Credential Access": "#f97316", "Persistence": "#f59e0b",
  "Privilege Escalation": "#8b5cf6", "Defense Evasion": "#06b6d4", "Lateral Movement": "#10b981",
  "Exfiltration": "#64748b", "Impact": "#dc2626", "Collection": "#2563eb", "Execution": "#7c3aed",
};

function ConfBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = (value / max) * 100;
  const color = pct >= 85 ? "#10b981" : pct >= 65 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: "var(--border)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[11px] font-mono font-semibold" style={{ color }}>{value}%</span>
    </div>
  );
}

function SourceChip({ s }: { s: Source }) {
  const icons = { log: <FileText size={10} />, rule: <Shield size={10} />, event: <Activity size={10} />, intel: <Globe size={10} /> };
  const colors = { log: "#60a5fa", rule: "#34d399", event: "#fbbf24", intel: "#a78bfa" };
  return (
    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium"
      style={{ backgroundColor: "var(--muted)", color: colors[s.type] }}>
      {icons[s.type]} {s.label}
    </span>
  );
}

function MitreBadge({ m }: { m: MitreTag }) {
  const color = TACTIC_COLORS[m.tactic] ?? "#64748b";
  return (
    <div className="flex items-center gap-1.5 rounded-md px-2 py-1" style={{ backgroundColor: `${color}18`, border: `1px solid ${color}30` }}>
      <span className="text-[10px] font-mono font-bold" style={{ color }}>{m.id}</span>
      <span className="text-[10px]" style={{ color: "var(--fg)" }}>{m.name}</span>
      <span className="text-[9px] font-semibold uppercase" style={{ color }}>{m.tactic}</span>
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="h-6 w-6 flex items-center justify-center rounded" style={{ color: "var(--muted-fg)" }}>
      {copied ? <Check size={12} style={{ color: "#10b981" }} /> : <Copy size={12} />}
    </button>
  );
}

// ─── Message Card Components ──────────────────────────────────────────────────

function ThreatCard({ d }: { d: ThreatCard }) {
  const sev = SEV_COLORS[d.severity];
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <AlertTriangle size={14} style={{ color: sev.text }} />
            <span className="font-bold text-sm" style={{ color: "var(--fg)" }}>{d.threatName}</span>
            <span className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
              style={{ backgroundColor: sev.bg, color: sev.text }}>{d.severity}</span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: "var(--muted-fg)" }}>
            <span>First seen: <span className="font-mono">{new Date(d.firstSeen).toLocaleString()}</span></span>
            <span>•</span>
            <span><strong style={{ color: "var(--fg)" }}>{d.count.toLocaleString()}</strong> occurrences</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-fg)" }}>AI Confidence</p>
          <div className="w-28 mt-1"><ConfBar value={d.confidence} /></div>
        </div>
      </div>

      {/* MITRE ATT&CK */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--muted-fg)" }}>MITRE ATT&CK Techniques</p>
        <div className="flex flex-wrap gap-1.5">{d.mitre.map(m => <MitreBadge key={m.id} m={m} />)}</div>
      </div>

      {/* IOCs */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--muted-fg)" }}>Indicators of Compromise (IOCs)</p>
        <div className="rounded-md p-2.5 space-y-1" style={{ backgroundColor: "#0f172a", border: "1px solid var(--border)" }}>
          {d.iocs.map(ioc => (
            <div key={ioc} className="flex items-center justify-between font-mono text-[11px]" style={{ color: "#34d399" }}>
              <span>{ioc}</span>
              <CopyBtn text={ioc} />
            </div>
          ))}
        </div>
      </div>

      {/* Affected endpoints */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--muted-fg)" }}>Affected Endpoints</p>
        <div className="flex flex-wrap gap-1.5">
          {d.affectedEndpoints.map(ep => (
            <span key={ep} className="font-mono text-[11px] rounded px-2 py-0.5" style={{ backgroundColor: "#fef2f2", color: "#dc2626" }}>{ep}</span>
          ))}
        </div>
      </div>

      {/* Recommendation */}
      <div className="rounded-md px-3 py-2.5 flex items-start gap-2" style={{ backgroundColor: "#eff6ff", border: "1px solid #bfdbfe" }}>
        <Zap size={13} style={{ color: "#1d4ed8", flexShrink: 0, marginTop: 1 }} />
        <p className="text-xs" style={{ color: "#1d4ed8" }}><strong>Recommendation:</strong> {d.recommendation}</p>
      </div>
    </div>
  );
}

function RuleCard({ d }: { d: RuleCard }) {
  const ac = ACTION_COLORS[d.action];
  const fpColors = { low: "#15803d", medium: "#b45309", high: "#dc2626" };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Shield size={14} style={{ color: "#2563eb" }} />
          <span className="font-bold text-sm" style={{ color: "var(--fg)" }}>{d.name}</span>
          <span className="rounded px-2 py-0.5 text-[10px] font-bold uppercase" style={{ backgroundColor: ac.bg, color: ac.text }}>{d.action.replace("_", " ")}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md p-2.5" style={{ backgroundColor: "var(--muted)", border: "1px solid var(--border)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--muted-fg)" }}>Effectiveness</p>
          <ConfBar value={d.effectiveness} />
        </div>
        <div className="rounded-md p-2.5" style={{ backgroundColor: "var(--muted)", border: "1px solid var(--border)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--muted-fg)" }}>False Positive Risk</p>
          <span className="text-xs font-bold capitalize" style={{ color: fpColors[d.falsePositiveRisk] }}>{d.falsePositiveRisk}</span>
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--muted-fg)" }}>Conditions</p>
        <div className="rounded-md p-2.5 space-y-1.5" style={{ backgroundColor: "#0f172a", border: "1px solid var(--border)" }}>
          {d.conditions.map((c, i) => (
            <div key={i} className="font-mono text-[11px]">
              {i > 0 && <span style={{ color: "#60a5fa" }}>OR </span>}
              <span style={{ color: "#a78bfa" }}>{c.field}</span>
              {" "}<span style={{ color: "#fbbf24" }}>{c.op}</span>
              {" "}<span style={{ color: "#34d399" }}>"{c.value}"</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs" style={{ color: "var(--muted-fg)" }}><strong style={{ color: "var(--fg)" }}>Rationale:</strong> {d.reason}</p>

      <div className="flex items-center gap-2 pt-1">
        <button className="flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors">
          <Plus size={12} /> Deploy Rule
        </button>
        <button className="flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium" style={{ backgroundColor: "var(--muted)", color: "var(--fg)" }}>
          <Eye size={12} /> Preview in Editor
        </button>
      </div>
    </div>
  );
}

function LogSummaryCard({ d }: { d: LogSummaryCard }) {
  const riskC = { critical: "#dc2626", elevated: "#b45309", normal: "#15803d" }[d.riskLevel];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <BarChart2 size={14} style={{ color: "#2563eb" }} />
            <span className="font-bold text-sm" style={{ color: "var(--fg)" }}>Log Summary</span>
            <span className="rounded px-2 py-0.5 text-[10px] font-bold uppercase"
              style={{ backgroundColor: `${riskC}18`, color: riskC }}>{d.riskLevel} risk</span>
          </div>
          <p className="text-[11px] mt-0.5 font-mono" style={{ color: "var(--muted-fg)" }}>{d.period}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center"><p className="text-lg font-bold" style={{ color: "var(--fg)" }}>{d.totalEvents.toLocaleString()}</p><p className="text-[10px]" style={{ color: "var(--muted-fg)" }}>Events</p></div>
          <div className="text-center"><p className="text-lg font-bold" style={{ color: riskC }}>{d.anomalies}</p><p className="text-[10px]" style={{ color: "var(--muted-fg)" }}>Anomalies</p></div>
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--muted-fg)" }}>Key Findings</p>
        <ul className="space-y-1.5">
          {d.keyFindings.map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-xs" style={{ color: "var(--fg)" }}>
              <CheckCircle size={12} style={{ color: "#10b981", marginTop: 2, flexShrink: 0 }} />
              {f}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--muted-fg)" }}>Top Attack Patterns</p>
        <div className="space-y-1.5">
          {d.topPatterns.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[10px] font-bold w-4 text-right" style={{ color: "var(--muted-fg)" }}>{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs truncate" style={{ color: "var(--fg)" }}>{p.pattern}</span>
                  <span className="text-xs font-mono ml-2" style={{ color: "var(--muted-fg)" }}>{p.count.toLocaleString()}</span>
                </div>
                <div className="mt-0.5 h-1 rounded-full" style={{ backgroundColor: "var(--border)" }}>
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, (p.count / d.topPatterns[0].count) * 100)}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function IncidentCard({ d }: { d: IncidentCard }) {
  const sev = SEV_COLORS[d.severity];
  const statusColors = { active: "#dc2626", contained: "#b45309", resolved: "#15803d" };
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Flag size={14} style={{ color: sev.text }} />
            <span className="font-mono text-xs font-bold" style={{ color: "var(--muted-fg)" }}>{d.incidentId}</span>
            <span className="rounded px-2 py-0.5 text-[10px] font-bold uppercase" style={{ backgroundColor: sev.bg, color: sev.text }}>{d.severity}</span>
            <span className="rounded px-2 py-0.5 text-[10px] font-bold uppercase capitalize"
              style={{ backgroundColor: `${statusColors[d.status]}18`, color: statusColors[d.status] }}>{d.status}</span>
          </div>
          <p className="font-bold text-sm mt-1" style={{ color: "var(--fg)" }}>{d.title}</p>
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--muted-fg)" }}>Attack Timeline</p>
        <div className="relative space-y-0 pl-5">
          <div className="absolute left-1.5 top-1 bottom-1 w-px" style={{ backgroundColor: "var(--border)" }} />
          {d.timeline.map((t, i) => (
            <div key={i} className="relative pb-2">
              <div className="absolute -left-3.5 top-1.5 h-2 w-2 rounded-full" style={{ backgroundColor: i === 0 ? "#dc2626" : "var(--border)", border: "1.5px solid var(--card)" }} />
              <div className="flex items-start gap-2">
                <span className="font-mono text-[10px] font-bold flex-shrink-0" style={{ color: "var(--muted-fg)" }}>{t.time}</span>
                <span className="text-[11px]" style={{ color: "var(--fg)" }}>{t.event}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--muted-fg)" }}>Affected Assets</p>
          <ul className="space-y-0.5">{d.affectedAssets.map((a, i) => <li key={i} className="text-xs font-mono" style={{ color: "#ef4444" }}>{a}</li>)}</ul>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--muted-fg)" }}>Kill Chain</p>
          <div className="flex flex-wrap gap-1">
            {d.attackChain.map((s, i) => (
              <span key={i} className="flex items-center gap-0.5">
                <span className="text-[10px] rounded px-1.5 py-0.5" style={{ backgroundColor: "var(--muted)", color: "var(--fg)" }}>{s}</span>
                {i < d.attackChain.length - 1 && <ArrowRight size={9} style={{ color: "var(--muted-fg)" }} />}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--muted-fg)" }}>Containment Steps</p>
        <ol className="space-y-1">
          {d.containmentSteps.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-xs" style={{ color: "var(--fg)" }}>
              <span className="font-bold flex-shrink-0 text-[10px] rounded-full h-4 w-4 flex items-center justify-center" style={{ backgroundColor: "var(--muted)", color: "var(--muted-fg)" }}>{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function AttackPatternCard({ d }: { d: AttackPatternCard }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Target size={14} style={{ color: "#7c3aed" }} />
            <span className="font-bold text-sm" style={{ color: "var(--fg)" }}>{d.name}</span>
          </div>
          <div className="flex items-center gap-2 mt-1"><MitreBadge m={d.mitre} /></div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-fg)" }}>Confidence</p>
          <div className="w-28 mt-1"><ConfBar value={d.confidence} /></div>
        </div>
      </div>

      <div className="rounded-md px-3 py-1.5" style={{ backgroundColor: "#f3e8ff", border: "1px solid #e9d5ff" }}>
        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#7c3aed" }}>Kill Chain Phase: </span>
        <span className="text-xs font-semibold" style={{ color: "#6d28d9" }}>{d.killChainPhase}</span>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--muted-fg)" }}>Technical Indicators</p>
        <ul className="space-y-1">
          {d.indicators.map((ind, i) => (
            <li key={i} className="flex items-start gap-2 text-[11px] font-mono" style={{ color: "var(--fg)" }}>
              <span style={{ color: "#7c3aed", flexShrink: 0 }}>&gt;</span> {ind}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--muted-fg)" }}>Observed Payloads</p>
        <div className="rounded-md p-2.5 space-y-1" style={{ backgroundColor: "#0f172a", border: "1px solid var(--border)" }}>
          {d.examples.map((ex, i) => (
            <div key={i} className="flex items-center justify-between">
              <code className="text-[10px] font-mono" style={{ color: "#fbbf24" }}>{ex}</code>
              <CopyBtn text={ex} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TextCard({ text }: { text: string }) {
  const parts = text.split(/\n/);
  return (
    <div className="text-sm space-y-1.5" style={{ color: "var(--fg)" }}>
      {parts.map((line, i) => {
        if (!line) return <br key={i} />;
        const bold = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        const bullet = line.startsWith("- ");
        return bullet
          ? <p key={i} className="flex items-start gap-2 text-xs" style={{ color: "var(--fg)" }}><span style={{ color: "#60a5fa" }}>•</span><span dangerouslySetInnerHTML={{ __html: bold.slice(2) }} /></p>
          : <p key={i} className="leading-relaxed" dangerouslySetInnerHTML={{ __html: bold }} />;
      })}
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
function MessageBubble({ msg, onBookmark, onFollowUp }: {
  msg: Message;
  onBookmark: (id: string) => void;
  onFollowUp: (q: string) => void;
}) {
  const isUser = msg.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[70%] rounded-xl px-4 py-2.5" style={{ backgroundColor: "#2563eb" }}>
          <p className="text-sm text-white">{msg.text}</p>
          <p className="text-[10px] mt-1 text-right" style={{ color: "rgba(255,255,255,0.6)" }}>
            {new Date(msg.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
          </p>
        </div>
      </div>
    );
  }

  if (msg.thinking) {
    return (
      <div className="flex items-start gap-3 mb-4">
        <div className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#7c3aed" }}>
          <Brain size={13} className="text-white" />
        </div>
        <div className="rounded-xl px-4 py-3" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 text-xs" style={{ color: "var(--muted-fg)" }}>
            <Loader2 size={12} className="animate-spin" />
            Analyzing security context...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 mb-4">
      {/* Avatar */}
      <div className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: "#7c3aed" }}>
        <Brain size={13} className="text-white" />
      </div>

      <div className="flex-1 min-w-0 space-y-2.5">
        {/* Header */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold" style={{ color: "var(--fg)" }}>Sentinel Copilot</span>
          <span className="text-[10px] font-mono" style={{ color: "var(--muted-fg)" }}>
            {new Date(msg.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
          </span>
          {msg.confidence !== undefined && (
            <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ backgroundColor: msg.confidence >= 85 ? "#f0fdf4" : "#fffbeb", color: msg.confidence >= 85 ? "#15803d" : "#b45309" }}>
              {msg.confidence}% confidence
            </span>
          )}
        </div>

        {/* Content card */}
        <div className="rounded-xl p-4 space-y-0" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          {msg.cardType === "text"            && msg.text         && <TextCard text={msg.text} />}
          {msg.cardType === "threat_analysis" && msg.threatData   && <ThreatCard d={msg.threatData} />}
          {msg.cardType === "rule_suggestion" && msg.ruleData     && <RuleCard d={msg.ruleData} />}
          {msg.cardType === "log_summary"     && msg.logData      && <LogSummaryCard d={msg.logData} />}
          {msg.cardType === "incident"        && msg.incidentData && <IncidentCard d={msg.incidentData} />}
          {msg.cardType === "attack_pattern"  && msg.attackData   && <AttackPatternCard d={msg.attackData} />}
        </div>

        {/* Sources */}
        {msg.sources && msg.sources.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-fg)" }}>Sources:</span>
            {msg.sources.map((s, i) => <SourceChip key={i} s={s} />)}
          </div>
        )}

        {/* Follow-ups */}
        {msg.followUps && msg.followUps.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-fg)" }}>Follow-up Investigations</p>
            <div className="flex flex-wrap gap-1.5">
              {msg.followUps.map((f, i) => (
                <button key={i} onClick={() => onFollowUp(f.query)}
                  className="flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors hover:opacity-80"
                  style={{ backgroundColor: "var(--muted)", color: "#2563eb", border: "1px solid #bfdbfe" }}>
                  <ChevronRight size={11} /> {f.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message actions */}
        <div className="flex items-center gap-1">
          <button onClick={() => onBookmark(msg.id)} title="Bookmark" className="h-6 w-6 flex items-center justify-center rounded" style={{ color: msg.bookmarked ? "#f59e0b" : "var(--muted-fg)" }}>
            {msg.bookmarked ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
          </button>
          <CopyBtn text={msg.text ?? JSON.stringify(msg.threatData ?? msg.ruleData ?? msg.logData ?? msg.incidentData ?? msg.attackData ?? "")} />
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

// Live event counter with animation
function LiveCounter({ base, color }: { base: number; color: string }) {
  const [count, setCount] = useState(base);
  useEffect(() => {
    const t = setInterval(() => setCount(c => c + Math.floor(Math.random() * 4)), 3000);
    return () => clearInterval(t);
  }, []);
  return <span className="font-mono text-[10px] font-bold tabular-nums" style={{ color }}>{count.toLocaleString()}</span>;
}

// Tiny toast for sidebar feedback
function SidebarToast({ msg }: { msg: string }) {
  return (
    <div
      className="absolute top-14 left-1/2 z-50 rounded-lg px-3 py-1.5 text-[11px] font-semibold text-white shadow-xl pointer-events-none"
      style={{ transform: "translateX(-50%)", backgroundColor: "#7c3aed", animation: "sbToast 2s ease forwards" }}
    >
      {msg}
    </div>
  );
}


// Relative time formatter
function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return "today";
  if (diff < 172800000) return "yesterday";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const SESSION_COLORS = ["#3b82f6", "#f97316", "#8b5cf6", "#10b981", "#ec4899"];

function AssistantSidebar({ sessions, onNewSession, onSelect, currentId, onSuggest, totalQueries, totalRules, totalIncidents }: {

  sessions: Session[];
  onNewSession: () => void;
  onSelect: (id: string) => void;
  currentId: string;
  suggested: FollowUp[];
  onSuggest: (q: string) => void;
  totalQueries: number;
  totalRules: number;
  totalIncidents: number;
}) {
  const navigate = useNavigate();
  const bodyRef = useRef<HTMLDivElement>(null);
  const [liveOpen, setLiveOpen] = useState(true);
  const [suggestOpen, setSuggestOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [hoveredSuggestion, setHoveredSuggestion] = useState<number | null>(null);
  const [wafCount] = useState(284152);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2100);
  };

  const handleNew = () => {
    onNewSession();
    bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    showToast("âœ“ New investigation started");
  };

  const filteredSessions = sessions.filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase())
  );
  const todaySessions = filteredSessions.filter(s => new Date(s.lastAt).toDateString() === new Date().toDateString());
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  const yesterdaySessions = filteredSessions.filter(s => new Date(s.lastAt).toDateString() === yest.toDateString());
  const olderSessions = filteredSessions.filter(s => new Date(s.lastAt) < yest && new Date(s.lastAt).toDateString() !== yest.toDateString());

  const liveItems = [
    { label: "WAF LOGS", sub: "Live feed", color: "#22c55e", dot: "#22c55e", pulse: true, isLive: true, icon: <Database size={11} />, value: <LiveCounter base={wafCount} color="#22c55e" />, suffix: " events", route: "/analytics" },
    { label: "THREAT INTEL", sub: "Updated 2m ago", color: "#a855f7", dot: "#a855f7", pulse: false, isLive: false, icon: <Globe size={11} />, value: <span className="font-semibold text-[10px]" style={{ color: "#a855f7" }}>Global</span>, suffix: " feed", route: "/threats" },
    { label: "FIREWALL", sub: "7 active rules", color: "#22d3ee", dot: "#22c55e", pulse: false, isLive: false, icon: <Shield size={11} />, value: <span className="font-semibold text-[10px]" style={{ color: "#22d3ee" }}>Healthy</span>, suffix: "", route: "/firewall" },
    { label: "INCIDENTS", sub: "3 critical open", color: "#ef4444", dot: "#ef4444", pulse: true, isLive: false, icon: <AlertTriangle size={11} />, value: <span className="font-bold text-[10px]" style={{ color: "#ef4444" }}>Review</span>, suffix: "", route: "/alerts" },
  ];

  const aiSuggestions = [
    { label: "Security Summary",    query: "Give me a full security summary for the last 24 hours",          preview: "Overview of all threats and anomalies in the last 24h" },
    { label: "Explain SQLi Campaign",query: "Analyze the SQL injection campaign targeting our API",            preview: "Deep dive into the SQL injection campaign patterns" },
    { label: "Generate Block Rule",  query: "Generate a WAF rule to block SQL injection payloads",            preview: "Create a WAF rule from current attack patterns" },
    { label: "MITRE ATT&CK Mapping", query: "Map our current incidents to MITRE ATT&CK techniques and tactics",preview: "Map incidents to the MITRE ATT&CK framework" },
    { label: "IOC Analysis",         query: "List the top 5 indicators of compromise from the last 7 days",   preview: "Identify and analyze top IOCs" },
  ];

  const SectionHeader = ({ label, icon, open, onToggle, count }: { label: string; icon?: React.ReactNode; open: boolean; onToggle: () => void; count?: number }) => (
    <button onClick={onToggle} className="w-full flex items-center justify-between py-2 group">
      <span className="text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color: "var(--muted-fg)" }}>
        {open ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
        {icon}
        {label}
      </span>
      {count !== undefined && (
        <span className="text-[9px] font-bold rounded-full px-1.5 py-0.5 tabular-nums transition-colors group-hover:bg-black/10 dark:group-hover:bg-white/10"
          style={{ backgroundColor: "var(--muted)", color: "var(--muted-fg)" }}>{count}</span>
      )}
    </button>
  );

  return (
    <div className="flex flex-col h-full relative" style={{ backgroundColor: "var(--muted)", borderRight: "1px solid var(--border)", width: 256, flexShrink: 0 }}>
      {/* Toast */}
      {toast && <SidebarToast msg={toast} />}

      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}>
            <Brain size={13} className="text-white" />
          </div>
          <div>
            <p className="text-xs font-bold leading-none" style={{ color: "var(--fg)" }}>SOC Copilot</p>
            <p className="text-[9px] mt-0.5 font-medium" style={{ color: "var(--muted-fg)" }}>Sentinel AI v2</p>
          </div>
        </div>
        <button
          onClick={handleNew}
          title="Start a new empty investigation session"
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-white transition-all hover:opacity-90 active:scale-95"
          style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}
        >
          <Plus size={10} /> New
        </button>
      </div>

      {/* Scrollable body */}
      <div ref={bodyRef} className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>

        {/* LIVE CONTEXT */}
        <div className="px-3 pt-3 pb-1">
          <SectionHeader icon={<Activity size={10} style={{ color: "#ef4444" }} />} label="LIVE CONTEXT" open={liveOpen} onToggle={() => setLiveOpen(o => !o)} />
          {liveOpen && (
            <div className="grid grid-cols-2 gap-1.5 pb-3">
              {liveItems.map(item => (
                <button
                  key={item.label}
                  onClick={() => navigate(item.route)}
                  title={`Open ${item.label}`}
                  className="rounded-xl p-2.5 text-left transition-all hover:opacity-90 active:scale-95"
                  style={{ backgroundColor: "var(--card)", border: `1px solid var(--border)`, borderLeft: `3px solid ${item.color}` }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span style={{ color: item.color }}>{item.icon}</span>
                    <div className="flex items-center gap-1">
                      {item.pulse ? (
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: item.dot }} />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ backgroundColor: item.dot }} />
                        </span>
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.dot }} />
                      )}
                      {item.isLive && <span className="text-[7px] font-black tracking-widest" style={{ color: item.dot }}>LIVE</span>}
                    </div>
                  </div>
                  <p className="text-[9px] font-black tracking-wide" style={{ color: item.color }}>{item.label}</p>
                  <p className="text-[8px] mt-0.5" style={{ color: "var(--muted-fg)" }}>{item.sub}</p>
                  <div className="mt-1.5 flex items-baseline gap-0.5">
                    {item.value}
                    <span className="text-[9px]" style={{ color: "var(--muted-fg)" }}>{item.suffix}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mx-3 mb-1" style={{ height: 1, backgroundColor: "var(--border)" }} />

        {/* AI SUGGESTIONS */}
        <div className="px-3 pt-2 pb-1">
          <SectionHeader icon={<Sparkles size={10} style={{ color: "#eab308" }} />} label="AI SUGGESTIONS" open={suggestOpen} onToggle={() => setSuggestOpen(o => !o)} count={aiSuggestions.length} />
          {suggestOpen && (
            <div className="space-y-0.5 pb-3">
              {aiSuggestions.map((s, i) => (
                <div key={i} className="relative">
                  <button
                    onClick={() => onSuggest(s.query)}
                    onMouseEnter={() => setHoveredSuggestion(i)}
                    onMouseLeave={() => setHoveredSuggestion(null)}
                    className="w-full text-left rounded-lg px-2.5 py-2 text-[11px] transition-all flex items-center gap-2"
                    style={{
                      color: hoveredSuggestion === i ? "var(--fg)" : "var(--muted-fg)",
                      backgroundColor: hoveredSuggestion === i ? "var(--muted)" : "transparent",
                      borderLeft: hoveredSuggestion === i ? "2px solid #7c3aed" : "2px solid transparent",
                    }}
                  >
                    <ChevronRight size={9} style={{ color: "#7c3aed", flexShrink: 0 }} />
                    <span className="truncate">{s.label}</span>
                  </button>
                  {hoveredSuggestion === i && (
                    <div
                      className="absolute left-full ml-2 top-0 z-50 w-44 rounded-lg p-2 text-[10px] pointer-events-none"
                      style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--muted-fg)", boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}
                    >
                      <div className="flex items-center gap-1 mb-1">
                        <Sparkles size={8} style={{ color: "#7c3aed" }} />
                        <span className="font-semibold text-[10px]" style={{ color: "var(--fg)" }}>AI Preview</span>
                      </div>
                      {s.preview}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mx-3 mb-1" style={{ height: 1, backgroundColor: "var(--border)" }} />

        {/* INVESTIGATION HISTORY */}
        <div className="px-3 pt-2 pb-1">
          <SectionHeader icon={<History size={10} style={{ color: "#3b82f6" }} />} label="INVESTIGATIONS" open={historyOpen} onToggle={() => setHistoryOpen(o => !o)} count={sessions.length} />
          {historyOpen && (
            <div className="pb-2">
              <div className="relative mb-2">
                <Search size={10} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-fg)" }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="w-full rounded-lg pl-7 pr-2 py-1.5 text-[10px] focus:outline-none"
                  style={{ border: "1px solid var(--border)", color: "var(--fg)", backgroundColor: "var(--muted)" }}
                />
              </div>
              {todaySessions.length > 0 && (
                <div className="mb-2">
                  <p className="text-[8px] font-bold uppercase tracking-widest px-1 mb-1" style={{ color: "var(--muted-fg)" }}>Today</p>
                  {todaySessions.map((s, i) => <SessionCard key={s.id} s={s} isActive={s.id === currentId} color={SESSION_COLORS[i % SESSION_COLORS.length]} onSelect={onSelect} />)}
                </div>
              )}
              {yesterdaySessions.length > 0 && (
                <div className="mb-2">
                  <p className="text-[8px] font-bold uppercase tracking-widest px-1 mb-1" style={{ color: "var(--muted-fg)" }}>Yesterday</p>
                  {yesterdaySessions.map((s, i) => <SessionCard key={s.id} s={s} isActive={s.id === currentId} color={SESSION_COLORS[(i + 1) % SESSION_COLORS.length]} onSelect={onSelect} />)}
                </div>
              )}
              {olderSessions.length > 0 && (
                <div className="mb-2">
                  <p className="text-[8px] font-bold uppercase tracking-widest px-1 mb-1" style={{ color: "var(--muted-fg)" }}>Earlier</p>
                  {olderSessions.map((s, i) => <SessionCard key={s.id} s={s} isActive={s.id === currentId} color={SESSION_COLORS[(i + 2) % SESSION_COLORS.length]} onSelect={onSelect} />)}
                </div>
              )}
              {filteredSessions.length === 0 && (
                <p className="text-[10px] text-center py-3" style={{ color: "var(--muted-fg)" }}>No investigations found</p>
              )}
            </div>
          )}
        </div>

        <div className="mx-3 mb-1" style={{ height: 1, backgroundColor: "var(--border)" }} />

        {/* SESSION ACTIVITY */}
        <div className="px-3 py-3">
          <p className="text-[9px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5" style={{ color: "var(--muted-fg)" }}><BarChart2 size={10} /> SESSION ACTIVITY</p>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { label: "Queries",  value: totalQueries,  color: "#7c3aed" },
              { label: "Rules",    value: totalRules,    color: "#22c55e" },
              { label: "Reports",  value: totalIncidents, color: "#f97316" },
            ].map(stat => (
              <div key={stat.label} className="rounded-lg p-2 text-center" style={{ backgroundColor: "var(--muted)", border: "1px solid var(--border)" }}>
                <p className="text-sm font-bold tabular-nums" style={{ color: stat.color }}>{stat.value}</p>
                <p className="text-[8px] mt-0.5 leading-tight" style={{ color: "var(--muted-fg)" }}>{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* AI CONTEXT */}
        <div className="px-3 pb-5">
          <p className="text-[9px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5" style={{ color: "var(--muted-fg)" }}><Brain size={10} style={{ color: "#a855f7" }} /> AI CONTEXT</p>
          <div className="rounded-xl p-2.5" style={{ backgroundColor: "var(--muted)", border: "1px solid var(--border)" }}>
            <p className="text-[9px] font-semibold mb-1.5" style={{ color: "#7c3aed" }}>Loaded into context:</p>
            {["WAF Logs (284K events)", "Threat Intel Feed", "Firewall Rules (7)", "Attack History"].map(ctx => (
              <div key={ctx} className="flex items-center gap-1.5 py-0.5">
                <CheckCircle size={9} style={{ color: "#22c55e" }} />
                <span className="text-[9px]" style={{ color: "var(--muted-fg)" }}>{ctx}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes sbToast {
          0%   { opacity:0; transform:translateX(-50%) translateY(-6px); }
          12%  { opacity:1; transform:translateX(-50%) translateY(0); }
          80%  { opacity:1; transform:translateX(-50%) translateY(0); }
          100% { opacity:0; transform:translateX(-50%) translateY(-6px); }
        }
      `}</style>
    </div>
  );
}



// Session card - theme-aware
function SessionCard({ s, isActive, color, onSelect }: { s: Session; isActive: boolean; color: string; onSelect: (id: string) => void }) {
  const [hovered, setHovered] = useState(false);
  const active = isActive || hovered;
  return (
    <button
      onClick={() => onSelect(s.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full text-left rounded-xl px-2.5 py-2 mb-0.5 transition-all"
      style={{
        backgroundColor: active ? "var(--muted)" : "transparent",
        borderLeft: `2px solid ${active ? color : "transparent"}`,
      }}
    >
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <p className="text-[11px] font-medium truncate" style={{ color: "var(--fg)" }}>{s.title}</p>
      </div>
      <p className="text-[9px] mt-1 flex items-center gap-1 pl-3" style={{ color: "var(--muted-fg)" }}>
        <Clock size={8} /> {relTime(s.lastAt)}
        <span className="ml-auto">{s.msgCount} msgs</span>
      </p>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

// Store per-session message histories
const SESSION_HISTORY_STORE: Map<string, Message[]> = new Map([
  ["current", [WELCOME_MSG]],
  ["s1", [
    WELCOME_MSG,
    { id: uid(), role: "user", timestamp: new Date(Date.now() - 3500000).toISOString(), text: "Analyze the SQL injection campaign targeting our API" },
    { ...RESPONSES.sql(), id: uid(), timestamp: new Date(Date.now() - 3490000).toISOString() },
  ]],
  ["s2", [
    WELCOME_MSG,
    { id: uid(), role: "user", timestamp: new Date(Date.now() - 85000000).toISOString(), text: "Generate an incident report for the brute-force attack on /auth/login" },
    { ...RESPONSES.incident(), id: uid(), timestamp: new Date(Date.now() - 84990000).toISOString() },
  ]],
  ["s3", [
    WELCOME_MSG,
    { id: uid(), role: "user", timestamp: new Date(Date.now() - 172000000).toISOString(), text: "Generate a WAF rule to block SQL injection payloads" },
    { ...RESPONSES.rule(), id: uid(), timestamp: new Date(Date.now() - 171990000).toISOString() },
  ]],
]);

export function SOCAssistant() {
  const [currentSessionId, setCurrentSessionId] = useState("current");
  const [sessionStore, setSessionStore] = useState<Map<string, Message[]>>(new Map(SESSION_HISTORY_STORE));
  const [sessions, setSessions] = useState<Session[]>(INITIAL_SESSIONS);
  const [input, setInput] = useState("");
  const [isLoading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Derived: messages for active session
  const messages = sessionStore.get(currentSessionId) ?? [WELCOME_MSG];

  const setMessages = (updater: Message[] | ((prev: Message[]) => Message[])) => {
    setSessionStore(prev => {
      const current = prev.get(currentSessionId) ?? [WELCOME_MSG];
      const next = typeof updater === "function" ? updater(current) : updater;
      return new Map(prev).set(currentSessionId, next);
    });
  };

  // Keep session msgCount in sync
  useEffect(() => {
    setSessions(prev => prev.map(s =>
      s.id === currentSessionId
        ? { ...s, msgCount: messages.filter(m => m.role === "user").length, lastAt: nowTs() }
        : s
    ));
  }, [messages.length, currentSessionId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Derived stats from all sessions
  const totalQueries = [...sessionStore.values()].reduce((sum, msgs) => sum + msgs.filter(m => m.role === "user").length, 0);
  const totalRules = [...sessionStore.values()].reduce((sum, msgs) => sum + msgs.filter(m => m.cardType === "rule_suggestion").length, 0);
  const totalIncidents = [...sessionStore.values()].reduce((sum, msgs) => sum + msgs.filter(m => m.cardType === "incident").length, 0);

  const send = useCallback(async (query: string) => {
    if (!query.trim() || isLoading) return;
    const userMsg: Message = { id: uid(), role: "user", timestamp: nowTs(), text: query };
    const thinkMsg: Message = { id: uid(), role: "assistant", timestamp: nowTs(), thinking: true };
    setMessages(m => [...m, userMsg, thinkMsg]);
    setInput("");
    setLoading(true);
    await new Promise(r => setTimeout(r, 1100 + Math.random() * 600));
    const response = getResponse(query)();
    setMessages(m => m.filter(x => !x.thinking).concat(response));
    setLoading(false);
  }, [isLoading, currentSessionId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  const handleBookmark = (id: string) => {
    setMessages(m => m.map(msg => msg.id === id ? { ...msg, bookmarked: !msg.bookmarked } : msg));
  };

  // Create new session
  const handleNewSession = () => {
    const id = uid();
    const title = `Investigation ${sessions.length + 1}`;
    const newSession: Session = { id, title, lastAt: nowTs(), msgCount: 0 };
    setSessions(prev => [newSession, ...prev]);
    setSessionStore(prev => new Map(prev).set(id, [WELCOME_MSG]));
    setCurrentSessionId(id);
  };

  // Switch session
  const handleSelectSession = (id: string) => {
    setCurrentSessionId(id);
    inputRef.current?.focus();
  };

  const QUICK_ACTIONS = [
    { label: "Threat Summary",   query: "Summarize current active threats and severity levels", icon: <AlertTriangle size={12} /> },
    { label: "Log Analysis",     query: "Give me a full security summary for the last 24 hours",  icon: <BarChart2 size={12} /> },
    { label: "Generate Rule",    query: "Generate a WAF rule to block SQL injection payloads",     icon: <Shield size={12} /> },
    { label: "Incident Report",  query: "Generate an incident report for the brute-force attack on /auth/login", icon: <Flag size={12} /> },
    { label: "Attack Patterns",  query: "Explain the attack patterns being used against our auth endpoint", icon: <Target size={12} /> },
  ];

  return (
    <div className="flex h-[calc(100vh-56px)] -mx-4 -mb-4 sm:-mx-6 sm:-mb-6" style={{ marginTop: 0 }}>
      {/* Sidebar */}
      <AssistantSidebar
        sessions={sessions}
        onNewSession={handleNewSession}
        onSelect={handleSelectSession}
        currentId={currentSessionId}
        suggested={SUGGESTED_PROMPTS}
        onSuggest={q => send(q)}
        totalQueries={totalQueries}
        totalRules={totalRules}
        totalIncidents={totalIncidents}
      />

      {/* Main Panel */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
              {sessions.find(s => s.id === currentSessionId)?.title ?? "Active Investigation Session"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "var(--muted-fg)" }}>
              {messages.filter(m => m.role === "user").length} queries • {messages.filter(m => m.bookmarked).length} bookmarked
            </span>
            <button
              onClick={() => setMessages([WELCOME_MSG])}
              className="h-7 px-2.5 rounded-md text-xs flex items-center gap-1"
              style={{ backgroundColor: "var(--muted)", color: "var(--muted-fg)" }}
            >
              <RotateCcw size={11} /> Reset
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {messages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} onBookmark={handleBookmark} onFollowUp={q => send(q)} />
          ))}
          <div ref={endRef} />
        </div>

        {/* Quick actions */}
        <div className="px-5 pb-2 flex items-center gap-1.5 flex-wrap border-t pt-3" style={{ borderColor: "var(--border)" }}>
          {QUICK_ACTIONS.map(qa => (
            <button key={qa.label} onClick={() => send(qa.query)} disabled={isLoading}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors hover:opacity-80 disabled:opacity-40"
              style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border)" }}>
              {qa.icon} {qa.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="px-5 py-3 flex-shrink-0">
          <div className="flex items-end gap-3 rounded-xl p-3" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#7c3aed" }}>
              <Terminal size={13} className="text-white" />
            </div>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask the Copilot to analyze a threat, generate a rule, summarize logs, or create an incident report..."
              rows={2}
              disabled={isLoading}
              className="flex-1 resize-none text-sm bg-transparent focus:outline-none disabled:opacity-50"
              style={{ color: "var(--fg)" }}
            />
            <button onClick={() => send(input)} disabled={!input.trim() || isLoading}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-white transition-colors flex-shrink-0 disabled:opacity-40"
              style={{ backgroundColor: "#7c3aed" }}>
              {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
          <p className="text-center text-[10px] mt-2" style={{ color: "var(--muted-fg)" }}>
            Responses use local WAF log context only • No external data sent • Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
