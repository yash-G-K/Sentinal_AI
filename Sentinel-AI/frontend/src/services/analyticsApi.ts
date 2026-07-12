// src/services/analyticsApi.ts
// Typed API layer for the Analytics page.

import { apiFetch } from "../components/api";

// ── Types ─────────────────────────────────────────────────────────────────────

export type TimeRange = "24h" | "7d" | "30d" | "90d" | "custom";

export interface AnalyticsTimeseries {
  labels: string[];
  requests: number[];
  blocked: number[];
  allowed: number[];
  latencyP50: number[];
  latencyP95: number[];
  latencyP99: number[];
  bandwidth: number[];
  errorRate: number[];
  sqli: number[];
  xss: number[];
  rce: number[];
  bruteForce: number[];
  riskScore: number[];
}

export interface TopEndpoint {
  e: string;
  req: number;
}

export interface TopCountry {
  c: string;
  code: string;
  req: number;
  blocked: number;
  flag: string;
}

export interface HttpMethod {
  m: string;
  v: number;
}

export interface StatusCode {
  code: string;
  v: number;
  color: string;
}

export interface AsnData {
  asn: string;
  req: number;
  risk: "low" | "medium" | "high" | "critical";
}

export interface AnalyticsTopStats {
  top_endpoints: TopEndpoint[];
  top_countries: TopCountry[];
  http_methods: HttpMethod[];
  status_codes: StatusCode[];
  asn_data: AsnData[];
}

// ── API Functions ─────────────────────────────────────────────────────────────

export async function fetchAnalyticsTimeseries(range: string): Promise<AnalyticsTimeseries> {
  return apiFetch<AnalyticsTimeseries>(`/analytics/timeseries?range=${range}`);
}

export async function fetchAnalyticsTopStats(range: string): Promise<AnalyticsTopStats> {
  return apiFetch<AnalyticsTopStats>(`/analytics/top?range=${range}`);
}
