// src/services/threatIntelligenceApi.ts
// Typed API client for the Threat Intelligence page.

import { apiFetch } from "../components/api";

// ── Types (mirrors backend ThreatIntelligenceResponse schema) ─────────────────

export interface ThreatSummary {
  risk_score: number;
  risk_level: "low" | "medium" | "high" | "critical";
  ai_confidence: number;
  detection_rate: number;
  false_positive_rate: number;
  total_requests: number;
  blocked_requests: number;
  attack_events: number;
  ai_analyses: number;
}

export interface AttackCategory {
  label: string;
  type: string;
  count: number;
  pct: number;
  color: string;
  trend: number;
}

export interface MitreAttack {
  id: string;
  name: string;
  tactic: string;
  type: string;
  count: number;
  risk: string;
}

export interface EmergingThreat {
  id: number;
  name: string;
  severity: "low" | "medium" | "high" | "critical";
  confidence: number;
  description: string;
  detectedAt: string;
  affectedSystems: string[];
  ip: string;
  recommendation: string;
}

export interface IOC {
  type: string;
  value: string;
  tag: string;
  risk: "low" | "medium" | "high" | "critical";
  seen: number;
}

export interface AIInsight {
  text: string;
  model: string;
  confidence: number;
}

export interface Recommendation {
  id: number;
  action: string;
  effort: string;
  impact: string;
  done: boolean;
}

export interface ThreatIntelligenceData {
  summary: ThreatSummary;
  attack_categories: AttackCategory[];
  mitre_attacks: MitreAttack[];
  emerging_threats: EmergingThreat[];
  iocs: IOC[];
  ai_insight: AIInsight;
  recommendations: Recommendation[];
}

// ── API Function ──────────────────────────────────────────────────────────────

export async function fetchThreatIntelligence(): Promise<ThreatIntelligenceData> {
  return apiFetch<ThreatIntelligenceData>("/threat-intelligence/summary");
}
