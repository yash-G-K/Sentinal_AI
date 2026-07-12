import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, Search, Edit3, Trash2, CheckCircle, Shield, 
  Terminal, Activity, ToggleLeft, ToggleRight,
  ChevronUp, ChevronDown, Save, X, History,
  Brain, ChevronRight, Play, Eye, Code, SplitSquareVertical,
  Radio, FlaskConical, Lightbulb, RotateCcw
} from 'lucide-react';
import * as api from '../services/firewallApi';

type RuleAction = api.RuleAction;
type CondField = api.CondField;
type CondOp = api.CondOp;
type Condition = api.Condition;
type Rule = api.Rule;
type AIRec = api.AIRec;
type WafMode = "live" | "testing" | "simulation";
type EditorTab = "visual" | "json" | "preview";

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTION_CFG: Record<RuleAction, { label: string; color: string; bg: string; desc: string }> = {
  block:      { label: "Block",      color: "#dc2626", bg: "#fef2f2", desc: "Drop request immediately" },
  allow:      { label: "Allow",      color: "#15803d", bg: "#f0fdf4", desc: "Bypass other rules" },
  rate_limit: { label: "Rate Limit", color: "#ea580c", bg: "#fff7ed", desc: "Throttle IPs exceeding threshold" },
  challenge:  { label: "Challenge",  color: "#2563eb", bg: "#eff6ff", desc: "Show CAPTCHA/JS challenge" },
  log:        { label: "Log Only",   color: "#475569", bg: "#f8fafc", desc: "Record but do not block" },
};

const MODE_CFG: Record<WafMode, { label: string; color: string; bg: string; desc: string }> = {
  live:       { label: "Live Protection",  color: "#dc2626", bg: "#fef2f2", desc: "Rules are actively blocking traffic" },
  testing:    { label: "Testing Mode",     color: "#d97706", bg: "#fffbeb", desc: "Rules log but do not block" },
  simulation: { label: "Simulation Mode",  color: "#2563eb", bg: "#eff6ff", desc: "Dry-run — no traffic affected" },
};

const FIELDS: CondField[] = ["ip", "path", "method", "country", "user-agent", "query-param", "header", "body"];
const FIELD_LABELS: Record<CondField, string> = {
  ip: "IP Address", path: "URL Path", method: "HTTP Method", country: "Country Code",
  "user-agent": "User Agent", "query-param": "Query Parameter", header: "HTTP Header", body: "Request Body"
};

const OPS: CondOp[] = ["equals", "contains", "starts_with", "ends_with", "matches", "in_list", "not_in"];
const OP_LABELS: Record<CondOp, string> = {
  equals: "Equals", contains: "Contains", starts_with: "Starts With", ends_with: "Ends With",
  matches: "Matches Regex", in_list: "In List", not_in: "Not In List"
};

// ─── Utils ────────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).substring(2, 9); }

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className="focus:outline-none flex items-center">
      {on ? <ToggleRight size={32} style={{ color: "#2563eb" }} /> 
          : <ToggleLeft size={32} style={{ color: "var(--muted-fg)" }} />}
    </button>
  );
}

function ActionBadge({ a }: { a: RuleAction }) {
  const c = ACTION_CFG[a] || ACTION_CFG.log;
  return (
    <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
      style={{ backgroundColor: c.bg, color: c.color, border: `1px solid ${c.color}30` }}>
      {c.label}
    </span>
  );
}

// ─── Modals ───────────────────────────────────────────────────────────────────
function ConfirmDelete({ rule, onConfirm, onCancel }: { rule: Rule; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.55)" }}>
      <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        <h3 className="text-lg font-bold" style={{ color: "var(--fg)" }}>Delete Rule</h3>
        <p className="text-sm mt-2 mb-6" style={{ color: "var(--muted-fg)" }}>
          Are you sure you want to delete <span className="font-semibold" style={{ color: "var(--fg)" }}>{rule.rule_name}</span>? 
          This will permanently remove it from the WAF ruleset.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: "var(--muted)", color: "var(--fg)" }}>Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors">Delete Rule</button>
        </div>
      </div>
    </div>
  );
}

function VersionModal({ rule, onClose, onRollback }: { rule: Rule; onClose: () => void; onRollback: (v: number) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.55)" }}>
      <div className="w-full max-w-lg rounded-2xl shadow-2xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div>
            <p className="font-bold text-sm" style={{ color: "var(--fg)" }}>Version History</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-fg)" }}>{rule.rule_name}</p>
          </div>
          <button onClick={onClose}><X size={16} style={{ color: "var(--muted-fg)" }} /></button>
        </div>
        <div className="p-5 space-y-0 relative max-h-[60vh] overflow-y-auto">
          <div className="absolute left-9 top-6 bottom-6 w-px" style={{ backgroundColor: "var(--border)" }} />
          {(rule.versions || []).map((v, i) => (
            <div key={v.version} className="relative pl-10 pb-5">
              <div className="absolute left-6 top-1.5 h-3 w-3 rounded-full border-2 z-10"
                style={{ backgroundColor: i === 0 ? "#2563eb" : "var(--card)", borderColor: i === 0 ? "#2563eb" : "var(--border)" }} />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>v{v.version} · {v.summary}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-fg)" }}>{v.by}</p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-mono block" style={{ color: "var(--muted-fg)" }}>
                    {new Date(v.at).toLocaleString()}
                  </span>
                  {i !== 0 && (
                    <button onClick={() => onRollback(v.version)} className="text-[10px] text-blue-500 hover:underline mt-1">Rollback to v{v.version}</button>
                  )}
                </div>
              </div>
              {i === 0 && (
                <span className="inline-block mt-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ backgroundColor: "#eff6ff", color: "#1d4ed8" }}>Current</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SimModal({ rules, onClose }: { rules: Rule[]; onClose: () => void }) {
  const [method, setMethod] = useState("GET");
  const [path, setPath] = useState("/api/v1/users");
  const [ip, setIp] = useState("127.0.0.1");
  const [ua, setUa] = useState("Mozilla/5.0");
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedRule, setSelectedRule] = useState(rules[0]?.id || "");

  const handleSimulate = async () => {
    setLoading(true);
    try {
        const rule = rules.find(r => r.id === Number(selectedRule));
        if (!rule) return;
        const res = await api.simulateRule({
            rule: rule as any,
            method,
            path,
            ip_address: ip,
            country: "US",
            user_agent: ua,
            headers: {},
            query_params: {},
            body: ""
        });
        setResults(res);
    } catch(e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.55)" }}>
      <div className="w-full max-w-2xl rounded-2xl shadow-2xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <FlaskConical size={16} style={{ color: "#7c3aed" }} />
            <p className="font-bold text-sm" style={{ color: "var(--fg)" }}>Rule Simulation</p>
          </div>
          <button onClick={onClose}><X size={16} style={{ color: "var(--muted-fg)" }} /></button>
        </div>
        <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs text-[var(--muted-fg)] block mb-1">Select Rule</label>
                    <select value={selectedRule} onChange={e=>setSelectedRule(e.target.value)} className="w-full p-2 text-xs rounded border bg-[var(--muted)] border-[var(--border)] text-[var(--fg)]">
                        {rules.map(r => <option key={r.id} value={r.id}>{r.rule_name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs text-[var(--muted-fg)] block mb-1">Method</label>
                    <input value={method} onChange={e=>setMethod(e.target.value)} className="w-full p-2 text-xs rounded border bg-[var(--muted)] border-[var(--border)] text-[var(--fg)]"/>
                </div>
                <div>
                    <label className="text-xs text-[var(--muted-fg)] block mb-1">Path</label>
                    <input value={path} onChange={e=>setPath(e.target.value)} className="w-full p-2 text-xs rounded border bg-[var(--muted)] border-[var(--border)] text-[var(--fg)]"/>
                </div>
                <div>
                    <label className="text-xs text-[var(--muted-fg)] block mb-1">IP Address</label>
                    <input value={ip} onChange={e=>setIp(e.target.value)} className="w-full p-2 text-xs rounded border bg-[var(--muted)] border-[var(--border)] text-[var(--fg)]"/>
                </div>
            </div>
            <button onClick={handleSimulate} disabled={loading} className="px-4 py-2 bg-purple-600 text-white rounded text-xs font-bold">{loading ? "Simulating..." : "Run Simulation"}</button>
            
            {results && (
                <div className="mt-4 p-4 rounded border bg-[var(--muted)] border-[var(--border)]">
                    <p className="text-sm font-bold text-[var(--fg)] mb-2">Simulation Result</p>
                    <p className="text-xs text-[var(--muted-fg)]">Would Match: <span className={results.would_match ? "text-red-500 font-bold" : "text-green-500 font-bold"}>{results.would_match ? "YES" : "NO"}</span></p>
                    <p className="text-xs text-[var(--muted-fg)]">Action Taken: <span className="font-bold">{results.action_taken}</span></p>
                    <p className="text-xs text-[var(--muted-fg)] mt-2">Explanation: {results.explanation}</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}

function CondRow({ cond, onChange, onDelete, isOnly }: {
  cond: Condition; onChange: (c: Condition) => void; onDelete: () => void; isOnly: boolean;
}) {
  const sel = "h-7 rounded-md border px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400";
  const sStyle = { backgroundColor: "var(--muted)", borderColor: "var(--border)", color: "var(--fg)" };
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select value={cond.field} onChange={e => onChange({ ...cond, field: e.target.value as CondField })} className={sel} style={sStyle}>
        {FIELDS.map(f => <option key={f} value={f}>{FIELD_LABELS[f]}</option>)}
      </select>
      <button onClick={() => onChange({ ...cond, negate: !cond.negate })}
        className="h-7 px-2 rounded-md text-[11px] font-medium"
        style={{ backgroundColor: cond.negate ? "#fef2f2" : "var(--muted)", color: cond.negate ? "#dc2626" : "var(--muted-fg)", border: "1px solid var(--border)" }}>
        {cond.negate ? "NOT" : "IS"}
      </button>
      <select value={cond.operator} onChange={e => onChange({ ...cond, operator: e.target.value as CondOp })} className={sel} style={sStyle}>
        {OPS.map(o => <option key={o} value={o}>{OP_LABELS[o]}</option>)}
      </select>
      <input value={cond.value} onChange={e => onChange({ ...cond, value: e.target.value })}
        placeholder="value…"
        className="h-7 min-w-[120px] flex-1 rounded-md border px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
        style={{ backgroundColor: "var(--muted)", borderColor: "var(--border)", color: "var(--fg)" }}
      />
      <button disabled={isOnly} onClick={onDelete}
        className="h-7 w-7 flex items-center justify-center rounded-md disabled:opacity-30"
        style={{ backgroundColor: "var(--muted)", color: "var(--muted-fg)" }}>
        <X size={12} />
      </button>
    </div>
  );
}

function RuleEditor({ rule, onSave, onClose }: {
  rule: Rule | null; 
  onSave: (r: Partial<Rule>) => Promise<void>;
  onClose: () => void;
}) {
  const blank: Partial<Rule> = {
    rule_name: "", description: "", priority: 99, enabled: true,
    action: "block", conditions: [{ id: uid(), field: "path", operator: "contains", value: "", negate: false }],
    tags: [],
  };
  const [draft, setDraft] = useState<Partial<Rule>>(rule ?? blank);
  const [tab, setTab]     = useState<EditorTab>("visual");
  const [jsonStr, setJsonStr] = useState(() => JSON.stringify(rule ?? blank, null, 2));
  const [jsonErr, setJsonErr] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);

  const isNew  = !rule;

  const updateCond = (id: string, c: Condition) =>
    setDraft(d => ({ ...d, conditions: d.conditions?.map(x => x.id === id ? c : x) }));
  const addCond = () =>
    setDraft(d => ({ ...d, conditions: [...(d.conditions||[]), { id: uid(), field: "path", operator: "contains", value: "", negate: false }] }));
  const removeCond = (id: string) =>
    setDraft(d => ({ ...d, conditions: d.conditions?.filter(x => x.id !== id) }));
  const addTag = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" || !tagInput.trim()) return;
    e.preventDefault();
    setDraft(d => ({ ...d, tags: [...new Set([...(d.tags||[]), tagInput.trim()])] }));
    setTagInput("");
  };
  const removeTag = (t: string) => setDraft(d => ({ ...d, tags: d.tags?.filter(x => x !== t) }));

  const syncJsonToDraft = () => {
    try {
      const parsed = JSON.parse(jsonStr);
      setDraft(parsed);
      setJsonErr("");
    } catch (e: any) {
      setJsonErr(e.message);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
        await onSave(draft);
    } catch(e) {
        alert("Failed to save rule. Ensure conditions are valid.");
    } finally {
        setSaving(false);
    }
  };

  const tabs: EditorTab[] = ["visual", "json"];
  const tabLabels = { visual: "Visual Builder", json: "JSON Editor", preview: "Preview" };

  return (
    <div className="fixed inset-0 z-40 flex justify-end" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="h-full flex flex-col" style={{ width: "min(780px, 95vw)", backgroundColor: "var(--bg)", borderLeft: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div>
            <p className="font-bold text-sm" style={{ color: "var(--fg)" }}>{isNew ? "New Rule" : `Edit: ${rule?.rule_name}`}</p>
          </div>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-md" style={{ backgroundColor: "var(--muted)", color: "var(--fg)" }}><X size={14} /></button>
        </div>

        <div className="flex border-b flex-shrink-0" style={{ backgroundColor: "var(--muted)", borderColor: "var(--border)" }}>
          {tabs.map(t => (
            <button key={t} onClick={() => { setTab(t); if (t === "json") setJsonStr(JSON.stringify(draft, null, 2)); }}
              className="px-4 py-2.5 text-xs font-medium border-b-2 transition-colors"
              style={{ borderColor: tab === t ? "#2563eb" : "transparent", color: tab === t ? "#2563eb" : "var(--muted-fg)" }}>
              {t === "visual" && <Eye size={12} className="inline mr-1.5" />}
              {t === "json"   && <Code size={12} className="inline mr-1.5" />}
              {tabLabels[t]}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {tab === "visual" && (
            <>
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-fg)" }}>Rule Name *</label>
                  <input value={draft.rule_name || ""} onChange={e => setDraft(d => ({ ...d, rule_name: e.target.value }))}
                    className="h-8 w-full rounded-md border px-3 text-xs" style={{ backgroundColor: "var(--muted)", borderColor: "var(--border)", color: "var(--fg)" }} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-fg)" }}>Description</label>
                  <textarea value={draft.description || ""} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                    rows={2} className="w-full rounded-md border px-3 py-2 text-xs resize-none" style={{ backgroundColor: "var(--muted)", borderColor: "var(--border)", color: "var(--fg)" }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-fg)" }}>Priority</label>
                  <input type="number" min={1} max={999} value={draft.priority || 100} onChange={e => setDraft(d => ({ ...d, priority: Number(e.target.value) }))}
                    className="h-8 w-full rounded-md border px-3 text-xs" style={{ backgroundColor: "var(--muted)", borderColor: "var(--border)", color: "var(--fg)" }} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-fg)" }}>Enabled</label>
                  <div className="h-8 flex items-center gap-2">
                    <Toggle on={!!draft.enabled} onChange={() => setDraft(d => ({ ...d, enabled: !d.enabled }))} />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-fg)" }}>Action</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(Object.keys(ACTION_CFG) as RuleAction[]).map(a => {
                    const cfg = ACTION_CFG[a];
                    const selected = draft.action === a;
                    return (
                      <button key={a} onClick={() => setDraft(d => ({ ...d, action: a }))}
                        className="rounded-lg p-3 text-left transition-all"
                        style={{ border: `2px solid ${selected ? cfg.color : "var(--border)"}`, backgroundColor: selected ? cfg.bg : "var(--muted)" }}>
                        <p className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.label}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-fg)" }}>Match Conditions</label>
                  <button onClick={addCond} className="flex items-center gap-1 text-xs font-medium" style={{ color: "#2563eb" }}><Plus size={12} /> Add Condition</button>
                </div>
                <div className="space-y-2 rounded-lg p-3" style={{ border: "1px solid var(--border)", backgroundColor: "var(--muted)" }}>
                  {(draft.conditions||[]).map((c, i) => (
                    <div key={c.id}>
                      {i > 0 && <p className="text-[10px] font-bold text-blue-400 py-0.5 pl-1">AND</p>}
                      <CondRow cond={c} onChange={nc => updateCond(c.id, nc)} onDelete={() => removeCond(c.id)} isOnly={(draft.conditions||[]).length === 1} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-fg)" }}>Tags</label>
                <div className="flex flex-wrap gap-1.5 items-center rounded-lg p-2" style={{ border: "1px solid var(--border)", backgroundColor: "var(--muted)", minHeight: "36px" }}>
                  {(draft.tags||[]).map(t => (
                    <span key={t} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: "#eff6ff", color: "#1d4ed8" }}>
                      {t} <button onClick={() => removeTag(t)}><X size={9} /></button>
                    </span>
                  ))}
                  <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={addTag} placeholder="Add tag, press Enter…" className="flex-1 min-w-[120px] bg-transparent text-xs focus:outline-none" style={{ color: "var(--fg)" }} />
                </div>
              </div>
            </>
          )}
          {tab === "json" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <button onClick={syncJsonToDraft} className="flex items-center gap-1 h-7 px-3 rounded-md text-xs font-medium bg-blue-100 text-blue-800">Apply JSON</button>
              </div>
              {jsonErr && <p className="text-xs text-red-500">{jsonErr}</p>}
              <textarea value={jsonStr} onChange={e => setJsonStr(e.target.value)} rows={24} className="w-full rounded-lg p-4 font-mono text-xs bg-slate-900 text-slate-100" />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between px-5 py-4 border-t flex-shrink-0" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <button onClick={onClose} className="h-8 px-4 rounded-lg text-xs font-medium" style={{ backgroundColor: "var(--muted)", color: "var(--fg)" }}>Discard</button>
          <button onClick={handleSave} disabled={!(draft.rule_name||"").trim() || saving} className="h-8 px-5 rounded-lg text-xs font-semibold text-white bg-blue-600">
            {saving ? "Saving..." : "Save Rule"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AIRecsPanel({ recs, onApply }: { recs: AIRec[]; onApply: (r: AIRec) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3" style={{ borderBottom: open ? "1px solid var(--border)" : "none" }}>
        <div className="flex items-center gap-2">
          <Brain size={15} style={{ color: "#7c3aed" }} />
          <span className="font-semibold text-sm" style={{ color: "var(--fg)" }}>AI Rule Recommendations</span>
        </div>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x" style={{ borderColor: "var(--border)" }}>
          {recs.map(rec => (
            <div key={rec.id} className="p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <Lightbulb size={14} className="mt-0.5 flex-shrink-0" style={{ color: "#f59e0b" }} />
                  <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>{rec.title}</p>
                </div>
                <div className="flex-shrink-0 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-green-50 text-green-700">
                  {rec.confidence}% confidence
                </div>
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: "var(--muted-fg)" }}>{rec.reason}</p>
              <button onClick={() => onApply(rec)} className="flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 mt-2">
                <Plus size={11} /> Apply Recommendation
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function FirewallRules() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [aiRecs, setAiRecs] = useState<AIRec[]>([]);
  const [mode, setMode] = useState<WafMode>("live");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Rule | null | "new">(undefined as any);
  const [deletePending, setDP] = useState<Rule | null>(null);
  const [versionRule, setVR] = useState<Rule | null>(null);
  const [showSim, setSim] = useState(false);

  const loadData = async () => {
    try {
        const [rRes, aRes] = await Promise.all([api.fetchRules(), api.fetchAIRecs()]);
        const rules = Array.isArray(rRes) ? rRes : [];
        setRules(rules);
        
        const existingNames = new Set(rules.map((r: Rule) => r.rule_name));
        const recs = Array.isArray(aRes) ? aRes : [];
        setAiRecs(recs.filter((rec: AIRec) => !existingNames.has(rec.preview_rule.rule_name)));
    } catch(e) { console.error(e); }
  };

  useEffect(() => {
    loadData();
    const int = setInterval(loadData, 60000);
    return () => clearInterval(int);
  }, []);

  const filtered = useMemo(() => {
    let d = [...rules];
    if (search) {
      const q = search.toLowerCase();
      d = d.filter(r => r.rule_name.toLowerCase().includes(q));
    }
    return d;
  }, [rules, search]);

  const handleToggle = async (id: number, current: boolean) => {
    try {
      await api.toggleRule(id, !current);
      await loadData();
    } catch(e) { console.error(e); }
  };

  const handlePriority = async (id: number, current: number, dir: number) => {
    try {
        await api.updatePriority(id, current + dir);
        await loadData();
    } catch(e) {}
  };

  const handleDelete = async () => {
    if (!deletePending) return;
    try {
        await api.deleteRule(deletePending.id);
        setDP(null);
        await loadData();
    } catch(e) {}
  };

  const handleSave = async (ruleData: Partial<Rule>) => {
    try {
        if (ruleData.id) {
            await api.updateRule(ruleData.id, ruleData);
        } else {
            await api.createRule(ruleData);
        }
        setEditing(undefined as any);
        await loadData();
    } catch(e) { throw e; }
  };

  const applyAIRec = async (rec: AIRec) => {
    try {
        await api.createRule(rec.preview_rule);
        await loadData();
    } catch(e) {}
  };

  const handleRollback = async (version: number) => {
    if (!versionRule) return;
    try {
        await api.rollbackRule(versionRule.id, version);
        setVR(null);
        await loadData();
    } catch(e: any) {
        alert(e.response?.data?.detail || "Rollback failed");
    }
  }

  const modeInfo = MODE_CFG[mode];
  const card = { backgroundColor: "var(--card)", border: "1px solid var(--border)" };

  return (
    <div className="space-y-4 max-w-screen-2xl">
      <div className="flex items-center justify-between rounded-xl px-4 py-2.5 gap-3 flex-wrap" style={{ backgroundColor: modeInfo.bg, border: `1px solid ${modeInfo.color}30` }}>
        <div className="flex items-center gap-2.5">
          <span className="h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: modeInfo.color }} />
          <span className="font-bold text-sm" style={{ color: modeInfo.color }}>WAF Mode: {modeInfo.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {(["live","testing","simulation"] as WafMode[]).map(m => (
            <button key={m} onClick={() => setMode(m)} className="capitalize px-3 py-1 rounded-md text-xs font-semibold" style={{ backgroundColor: mode === m ? MODE_CFG[m].color : "transparent", color: mode === m ? "#fff" : MODE_CFG[m].color, border: `1px solid ${MODE_CFG[m].color}60` }}>
              {m}
            </button>
          ))}
          {mode === "simulation" && (
            <button onClick={() => setSim(true)} className="flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-semibold text-white ml-2 bg-purple-600"><Terminal size={11} /> Run Simulation</button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--fg)" }}>Firewall Rules</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted-fg)" }}>{rules.filter(r => r.enabled).length} active · {rules.length} total</p>
        </div>
        <button onClick={() => setEditing("new")} className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-xs font-semibold text-white bg-blue-600"><Plus size={13} /> New Rule</button>
      </div>

      {aiRecs.length > 0 && <AIRecsPanel recs={aiRecs} onApply={applyAIRec} />}

      <div className="rounded-xl overflow-hidden" style={card}>
        <table className="w-full text-left">
          <thead>
            <tr style={{ backgroundColor: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
              <th className="w-10 px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-center" style={{ color: "var(--muted-fg)" }}>PRI</th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-fg)" }}>Rule Name</th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-fg)" }}>Action</th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-fg)" }}>Conditions</th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-fg)" }}>Hits</th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-fg)" }}>Status</th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-right" style={{ color: "var(--muted-fg)" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((rule, idx) => (
              <tr key={rule.id} className="border-b transition-colors" style={{ borderColor: "var(--border)", opacity: rule.enabled ? 1 : 0.65 }}>
                <td className="px-2 py-2.5 text-center">
                  <div className="flex flex-col items-center gap-0.5">
                    <button onClick={() => handlePriority(rule.id, rule.priority, -1)}><ChevronUp size={12} className="text-gray-400 hover:text-blue-500" /></button>
                    <span className="text-[11px] font-mono font-bold" style={{ color: "var(--fg)" }}>{rule.priority}</span>
                    <button onClick={() => handlePriority(rule.id, rule.priority, 1)}><ChevronDown size={12} className="text-gray-400 hover:text-blue-500" /></button>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>{rule.rule_name}</p>
                        {rule.rule_type?.startsWith('BUILTIN') && (
                          <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>Built-in</span>
                        )}
                      </div>
                      {rule.category && <p className="text-[10px] mt-0.5 font-medium" style={{ color: "#7c3aed" }}>{rule.category}</p>}
                      <p className="text-[11px] mt-0.5 line-clamp-1" style={{ color: "var(--muted-fg)" }}>{rule.description}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5"><ActionBadge a={rule.action} /></td>
                <td className="px-3 py-2.5 text-xs font-mono text-gray-500">{(rule.conditions||[]).length} conds</td>
                <td className="px-3 py-2.5 text-xs font-mono text-gray-500">{rule.hits.toLocaleString()}</td>
                <td className="px-3 py-2.5"><Toggle on={rule.enabled} onChange={() => handleToggle(rule.id, rule.enabled)} /></td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => setVR(rule)} className="h-6 w-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-200"><History size={13} /></button>
                    <button onClick={() => setEditing(rule)} className="h-6 w-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-200"><Edit3 size={13} /></button>
                    <button onClick={() => setDP(rule)} className="h-6 w-6 flex items-center justify-center rounded text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(editing === "new" || (editing && editing !== undefined)) && (
        <RuleEditor rule={editing === "new" ? null : (editing as Rule)} onSave={handleSave} onClose={() => setEditing(undefined as any)} />
      )}
      {deletePending && <ConfirmDelete rule={deletePending} onConfirm={handleDelete} onCancel={() => setDP(null)} />}
      {versionRule && <VersionModal rule={versionRule} onClose={() => setVR(null)} onRollback={handleRollback}/>}
      {showSim && <SimModal rules={rules} onClose={() => setSim(false)} />}
    </div>
  );
}
