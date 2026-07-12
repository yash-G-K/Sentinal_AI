// src/services/auditApi.ts
// Fetches real audit log data from the backend /api/v1/audit endpoint

export interface AuditActor {
  type: "user" | "system" | "api-key";
  name: string;
  ip?: string;
}

export interface AuditDiff {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  category: "authentication" | "firewall" | "policy" | "system" | "api" | "user-mgmt";
  action: "blocked" | "allowed" | "modified" | "deleted" | "created" | "failed" | "escalated";
  actor: AuditActor;
  resource: string;
  message: string;
  requestId: string;
  country?: string;
  userAgent?: string;
  meta: Record<string, unknown>;
  diff?: AuditDiff;
}

export interface AuditFilters {
  page?: number;
  size?: number;
  severity?: string;
  category?: string;
  action?: string;
  actorType?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface AuditPageResult {
  data: AuditLogEntry[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export async function fetchAuditLogs(filters: AuditFilters = {}): Promise<AuditPageResult> {
  const params = new URLSearchParams();
  if (filters.page)      params.set("page",      String(filters.page));
  if (filters.size)      params.set("size",      String(filters.size));
  if (filters.severity)  params.set("severity",  filters.severity);
  if (filters.category)  params.set("category",  filters.category);
  if (filters.action)    params.set("action",    filters.action);
  if (filters.actorType) params.set("actorType", filters.actorType);
  if (filters.search)    params.set("search",    filters.search);
  if (filters.dateFrom)  params.set("dateFrom",  filters.dateFrom);
  if (filters.dateTo)    params.set("dateTo",    filters.dateTo);

  const qs = params.toString();
  const url = `/api/v1/audit${qs ? `?${qs}` : ""}`;

  try {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json() as AuditPageResult;
  } catch (err) {
    console.warn("Audit API unavailable, returning empty result.", err);
    return { data: [], total: 0, page: 1, size: 20, pages: 1 };
  }
}
