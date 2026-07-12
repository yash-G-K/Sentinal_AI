// src/services/dashboardApi.ts
// Typed API layer for the Dashboard page.
// All functions return typed interfaces that match the FastAPI response schemas exactly.

import { apiFetch } from "../components/api";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface KpiValue {
  value: number;
  trend: number;
}

export interface DashboardKpis {
  total_requests:   KpiValue;
  blocked_requests: KpiValue;
  allowed_requests: KpiValue;
  threat_score:     KpiValue;
  critical_alerts:  KpiValue;
  avg_response_ms:  KpiValue;
  firewall_health:  KpiValue;
  ai_confidence:    KpiValue;
}

export interface TrafficChart {
  labels:  string[];
  allowed: number[];
  blocked: number[];
}

export interface AttackTimelineChart {
  labels:   string[];
  critical: number[];
  high:     number[];
  medium:   number[];
  low:      number[];
}

export interface RiskTrendChart {
  labels: string[];
  scores: number[];
}

export interface GeoEntry {
  country: string;
  count:   number;
}

export interface IPEntry {
  ip:    string;
  count: number;
}

export interface GeoData {
  top_countries: GeoEntry[];
  top_ips:       IPEntry[];
}

export interface DashboardCharts {
  traffic:         TrafficChart;
  attack_timeline: AttackTimelineChart;
  risk_trend:      RiskTrendChart;
  geo:             GeoData;
}

// ── API Functions ─────────────────────────────────────────────────────────────

export async function fetchDashboardKpis(): Promise<DashboardKpis> {
  return apiFetch<DashboardKpis>("/dashboard/kpis");
}

export async function fetchDashboardCharts(): Promise<DashboardCharts> {
  return apiFetch<DashboardCharts>("/dashboard/charts");
}
