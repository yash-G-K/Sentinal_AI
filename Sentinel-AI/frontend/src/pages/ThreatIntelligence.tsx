import { useState, useEffect, useCallback } from "react";
import {
  Shield, AlertTriangle, TrendingUp, Brain, ChevronDown, ChevronRight,
  Target, Zap, Activity, Eye, CheckCircle, XCircle, Clock, ExternalLink,
  Info, BarChart2, Globe, Lock,
} from "lucide-react";

import { fetchThreatIntelligence } from "../services/threatIntelligenceApi";
import type {
  ThreatIntelligenceData,
  AttackCategory,
  MitreAttack as MitreAttackType,
  EmergingThreat as EmergingThreatType,
  IOC as IOCType,
  Recommendation as RecommendationType,
} from "../services/threatIntelligenceApi";

// ─── Helpers ────────────────────────────────────────────────────────────────

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// ─── Risk Badge ─────────────────────────────────────────────────────────────

type RiskLevel = "critical" | "high" | "medium" | "low";

const riskConfig: Record<RiskLevel, { label: string; bg: string; color: string; dot: string }> = {
  critical: { label: "Critical", bg: "#fef2f2", color: "#dc2626", dot: "#ef4444" },
  high:     { label: "High",     bg: "#fff7ed", color: "#c2410c", dot: "#f97316" },
  medium:   { label: "Medium",   bg: "#fffbeb", color: "#b45309", dot: "#f59e0b" },
  low:      { label: "Low",      bg: "#f0fdf4", color: "#15803d", dot: "#22c55e" },
};

function RiskBadge({ level }: { level: RiskLevel }) {
  const cfg = riskConfig[level] ?? riskConfig.low;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

// ─── Confidence Meter ────────────────────────────────────────────────────────

function ConfidenceMeter({ score }: { score: number }) {
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: "var(--muted)" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-semibold w-8 text-right" style={{ color }}>
        {score}%
      </span>
    </div>
  );
}

// ─── Collapsible Section ─────────────────────────────────────────────────────

function CollapsibleSection({
  title, icon, badge, defaultOpen = false, children,
}: {
  title: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}>
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <span style={{ color: "var(--primary)" }}>{icon}</span>
          <span className="font-semibold text-sm" style={{ color: "var(--fg)" }}>{title}</span>
          {badge && <span>{badge}</span>}
        </div>
        {open ? <ChevronDown size={16} style={{ color: "var(--muted-fg)" }} /> : <ChevronRight size={16} style={{ color: "var(--muted-fg)" }} />}
      </button>
      {open && (
        <div className="px-5 pb-5 border-t" style={{ borderColor: "var(--border)" }}>
          <div className="pt-4">{children}</div>
        </div>
      )}
    </div>
  );
}

// ─── Section Card ────────────────────────────────────────────────────────────

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl" style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}>
      <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
        <span style={{ color: "var(--primary)" }}>{icon}</span>
        <span className="font-semibold text-sm" style={{ color: "var(--fg)" }}>{title}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Attack Category Bar ─────────────────────────────────────────────────────

function CategoryBar({ label, count, pct, color, trend }: AttackCategory) {
  const up = trend > 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: "var(--fg)" }}>{label}</span>
        <div className="flex items-center gap-2">
          {trend !== 0 && (
            <span className="text-[10px] font-semibold" style={{ color: up ? "#ef4444" : "#10b981" }}>
              {up ? "▲" : "▼"} {Math.abs(trend)}%
            </span>
          )}
          <span className="text-xs font-bold w-12 text-right" style={{ color: "var(--muted-fg)" }}>
            {count.toLocaleString()}
          </span>
        </div>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--muted)" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function ThreatIntelligence() {
  const [data, setData] = useState<ThreatIntelligenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("just now");

  const loadData = useCallback(async () => {
    try {
      const result = await fetchThreatIntelligence();
      setData(result);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.warn("Threat Intelligence API unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60_000);
    return () => clearInterval(interval);
  }, [loadData]);

  const riskLevel = (data?.summary.risk_level ?? "low") as RiskLevel;
  const riskColor = riskLevel === "critical" ? "#ef4444" : riskLevel === "high" ? "#f97316" : riskLevel === "medium" ? "#f59e0b" : "#22c55e";
  const criticalCount = data?.emerging_threats.filter(t => t.severity === "critical").length ?? 0;
  const pendingRecs = (data?.recommendations ?? []).filter((r: RecommendationType) => !r.done).length;

  return (
    <div className="space-y-5 max-w-7xl">

      {/* ── Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--fg)" }}>Threat Intelligence</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted-fg)" }}>
            AI-analysed attack patterns, emerging threats, and actionable intelligence
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RiskBadge level={riskLevel} />
          <div className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs" style={{ backgroundColor: "var(--muted)", color: "var(--muted-fg)" }}>
            <Clock size={12} />
            Updated {lastUpdated}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="text-sm font-medium" style={{ color: "var(--muted-fg)" }}>Loading Threat Intelligence...</div>
        </div>
      ) : (
        <>

          {/* ── Top row: Summary + AI Insight */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Risk summary */}
            <div className="rounded-xl p-5 space-y-4" style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}>
              <div className="flex items-center gap-2">
                <Target size={16} style={{ color: "var(--primary)" }} />
                <span className="font-semibold text-sm" style={{ color: "var(--fg)" }}>Current Risk</span>
              </div>
              <div className="text-center py-2">
                <div className="text-5xl font-black" style={{ color: riskColor }}>
                  {data?.summary.risk_score ?? 0}
                </div>
                <div className="text-xs mt-1" style={{ color: "var(--muted-fg)" }}>out of 100</div>
                <div className="mt-2 flex justify-center"><RiskBadge level={riskLevel} /></div>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1" style={{ color: "var(--muted-fg)" }}>
                    <span>AI Confidence</span><span>{data?.summary.ai_confidence ?? 94}%</span>
                  </div>
                  <ConfidenceMeter score={data?.summary.ai_confidence ?? 94} />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1" style={{ color: "var(--muted-fg)" }}>
                    <span>Detection Rate</span><span>{data?.summary.detection_rate ?? 99.7}%</span>
                  </div>
                  <ConfidenceMeter score={Math.round(data?.summary.detection_rate ?? 99)} />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1" style={{ color: "var(--muted-fg)" }}>
                    <span>False Positive Rate</span><span>{data?.summary.false_positive_rate ?? 0.3}%</span>
                  </div>
                  <ConfidenceMeter score={Math.round(data?.summary.false_positive_rate ?? 0)} />
                </div>
              </div>
            </div>

            {/* AI Insight */}
            <div className="lg:col-span-2 rounded-xl p-5" style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}>
              <div className="flex items-center gap-2 mb-3">
                <Brain size={16} style={{ color: "#8b5cf6" }} />
                <span className="font-semibold text-sm" style={{ color: "var(--fg)" }}>AI Security Analysis</span>
                <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: "#ede9fe", color: "#7c3aed" }}>
                  {data?.ai_insight.model ?? "AI Model"} · {data?.ai_insight.confidence ?? 94}% confidence
                </span>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "var(--muted-fg)" }}>
                {data?.ai_insight.text ?? "Loading AI analysis..."}
              </p>
              <div className="mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" }}>
                <Info size={12} />
                Analysis refreshes every 60 seconds based on live traffic data.
              </div>
            </div>
          </div>

          {/* ── Attack Categories */}
          <SectionCard title="Threat Categories" icon={<BarChart2 size={16} />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-4">
              {(data?.attack_categories ?? []).length === 0 ? (
                <p className="text-xs col-span-2" style={{ color: "var(--muted-fg)" }}>No attack events in the last 7 days.</p>
              ) : (
                (data?.attack_categories ?? []).map((cat) => (
                  <CategoryBar key={cat.label} {...cat} />
                ))
              )}
            </div>
          </SectionCard>

          {/* ── MITRE ATT&CK */}
          <CollapsibleSection
            title="MITRE ATT&CK Mapping"
            icon={<Target size={16} />}
            defaultOpen={true}
            badge={
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: "var(--muted)", color: "var(--muted-fg)" }}>
                {(data?.mitre_attacks ?? []).length} techniques
              </span>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: "var(--muted-fg)" }} className="text-xs uppercase tracking-wide">
                    <th className="pb-3 text-left font-semibold">ID</th>
                    <th className="pb-3 text-left font-semibold">Technique</th>
                    <th className="pb-3 text-left font-semibold">Tactic</th>
                    <th className="pb-3 text-right font-semibold">Events</th>
                    <th className="pb-3 text-right font-semibold">Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {(data?.mitre_attacks ?? []).map((t: MitreAttackType) => (
                    <tr key={t.id} className="group">
                      <td className="py-3 pr-4">
                        <code className="rounded px-1.5 py-0.5 text-xs font-mono" style={{ backgroundColor: "var(--muted)", color: "var(--primary)" }}>
                          {t.id}
                        </code>
                      </td>
                      <td className="py-3 pr-4 font-medium" style={{ color: "var(--fg)" }}>{t.name}</td>
                      <td className="py-3 pr-4 text-xs" style={{ color: "var(--muted-fg)" }}>{t.tactic}</td>
                      <td className="py-3 pr-4 text-right font-mono font-semibold" style={{ color: "var(--fg)" }}>{t.count.toLocaleString()}</td>
                      <td className="py-3 text-right"><RiskBadge level={t.risk as RiskLevel} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(data?.mitre_attacks ?? []).length === 0 && (
                <p className="text-xs py-2" style={{ color: "var(--muted-fg)" }}>No MITRE events in the last 30 days.</p>
              )}
            </div>
            <a href="https://attack.mitre.org" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-3 text-xs hover:underline" style={{ color: "var(--primary)" }}>
              View MITRE ATT&CK framework <ExternalLink size={11} />
            </a>
          </CollapsibleSection>

          {/* ── Emerging Threats */}
          <CollapsibleSection
            title="Emerging Threats"
            icon={<TrendingUp size={16} />}
            defaultOpen={true}
            badge={
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: criticalCount > 0 ? "#fef2f2" : "var(--muted)", color: criticalCount > 0 ? "#dc2626" : "var(--muted-fg)" }}>
                {criticalCount > 0 ? `${criticalCount} critical` : "All clear"}
              </span>
            }
          >
            <div className="space-y-3">
              {(data?.emerging_threats ?? []).length === 0 ? (
                <p className="text-xs" style={{ color: "var(--muted-fg)" }}>No high-severity threats detected in the last 48 hours.</p>
              ) : (
                (data?.emerging_threats ?? []).map((threat: EmergingThreatType) => (
                  <div key={threat.id} className="rounded-lg p-4" style={{ backgroundColor: "var(--muted)", border: "1px solid var(--border)" }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold text-sm" style={{ color: "var(--fg)" }}>{threat.name}</span>
                          <RiskBadge level={threat.severity as RiskLevel} />
                        </div>
                        <p className="text-xs leading-relaxed" style={{ color: "var(--muted-fg)" }}>{threat.description}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {threat.affectedSystems.map((s) => (
                            <span key={s} className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ backgroundColor: "var(--card)", color: "var(--muted-fg)", border: "1px solid var(--border)" }}>
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xs mb-2" style={{ color: "var(--muted-fg)" }}>{threat.detectedAt}</div>
                        <div className="w-24">
                          <div className="text-[10px] mb-1 text-right" style={{ color: "var(--muted-fg)" }}>Confidence</div>
                          <ConfidenceMeter score={threat.confidence} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CollapsibleSection>

          {/* ── IOCs */}
          <CollapsibleSection
            title="Indicators of Compromise"
            icon={<Eye size={16} />}
            defaultOpen={false}
            badge={
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: "var(--muted)", color: "var(--muted-fg)" }}>
                {(data?.iocs ?? []).length} IOCs
              </span>
            }
          >
            <div className="space-y-2">
              {(data?.iocs ?? []).length === 0 ? (
                <p className="text-xs" style={{ color: "var(--muted-fg)" }}>No indicators of compromise detected.</p>
              ) : (
                (data?.iocs ?? []).map((ioc: IOCType, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg px-4 py-3" style={{ backgroundColor: "var(--muted)", border: "1px solid var(--border)" }}>
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-bold w-14 text-center" style={{ backgroundColor: "var(--card)", color: "var(--primary)", border: "1px solid var(--border)" }}>
                      {ioc.type}
                    </span>
                    <code className="flex-1 text-xs font-mono truncate" style={{ color: "var(--fg)" }}>{ioc.value}</code>
                    <span className="text-xs hidden sm:inline" style={{ color: "var(--muted-fg)" }}>{ioc.tag}</span>
                    <span className="text-xs font-mono" style={{ color: "var(--muted-fg)" }}>×{ioc.seen}</span>
                    <RiskBadge level={ioc.risk} />
                  </div>
                ))
              )}
            </div>
          </CollapsibleSection>

          {/* ── Recommended Actions */}
          <CollapsibleSection
            title="Recommended Actions"
            icon={<Zap size={16} />}
            defaultOpen={true}
            badge={
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: "#fff7ed", color: "#c2410c" }}>
                {pendingRecs} pending
              </span>
            }
          >
            <div className="space-y-2">
              {(data?.recommendations ?? []).map((rec: RecommendationType) => (
                <div
                  key={rec.id}
                  className={cn("flex items-center gap-4 rounded-lg px-4 py-3", rec.done && "opacity-50")}
                  style={{ backgroundColor: "var(--muted)", border: "1px solid var(--border)" }}
                >
                  {rec.done
                    ? <CheckCircle size={16} style={{ color: "#10b981", flexShrink: 0 }} />
                    : <XCircle size={16} style={{ color: "#94a3b8", flexShrink: 0 }} />
                  }
                  <span className={cn("flex-1 text-sm", rec.done && "line-through")} style={{ color: "var(--fg)" }}>
                    {rec.action}
                  </span>
                  <div className="hidden sm:flex items-center gap-2">
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ backgroundColor: "var(--card)", color: "var(--muted-fg)", border: "1px solid var(--border)" }}>
                      Effort: {rec.effort}
                    </span>
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ backgroundColor: rec.impact === "High" ? "#d1fae5" : "#fef3c7", color: rec.impact === "High" ? "#065f46" : "#92400e" }}>
                      Impact: {rec.impact}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>

        </>
      )}
    </div>
  );
}
