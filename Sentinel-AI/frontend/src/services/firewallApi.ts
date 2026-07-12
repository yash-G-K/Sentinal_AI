import axios from 'axios';

const API_URL = '/api/v1/firewall';

export type RuleAction = "block" | "allow" | "rate_limit" | "challenge" | "log";
export type CondField = "ip" | "path" | "method" | "country" | "user-agent" | "query-param" | "header" | "body";
export type CondOp = "equals" | "contains" | "starts_with" | "ends_with" | "matches" | "in_list" | "not_in";

export interface Condition {
  id: string;
  field: CondField;
  operator: CondOp;
  value: string;
  negate?: boolean;
}

export interface VersionEntry {
  version: number;
  at: string;
  by: string;
  summary: string;
}

export interface Rule {
  id: number;
  rule_name: string;
  description: string;
  rule_type: string;       // e.g. "BUILTIN_SQLI", "CUSTOM"
  priority: number;
  enabled: boolean;
  status: string;
  action: RuleAction;
  conditions: Condition[];
  tags: string[];
  category?: string;       // e.g. "SQL Injection", "Bot Detection"
  hits: number;
  created_at: string;
  updated_at: string;
  version: number;
  versions: VersionEntry[];
}

export interface AIRec {
  id: string;
  title: string;
  reason: string;
  confidence: number;
  severity: string;
  recommended_action: string;
  explanation: string;
  preview_rule: Partial<Rule>;
}

export interface SimulationRequest {
  rule: Partial<Rule>;
  method: string;
  path: string;
  ip_address: string;
  country: string;
  user_agent: string;
  headers: Record<string, string>;
  query_params: Record<string, string>;
  body: string;
}

export interface SimulationResponse {
  would_match: boolean;
  action_taken: string;
  matched_condition?: Condition;
  explanation: string;
}

export const fetchRules = async (): Promise<Rule[]> => {
  const { data } = await axios.get(`${API_URL}/rules`);
  return Array.isArray(data.data) ? data.data : [];
};

export const createRule = async (rule: Partial<Rule>): Promise<Rule> => {
  const { data } = await axios.post(`${API_URL}/rules`, rule);
  return data.data;
};

export const updateRule = async (id: number, rule: Partial<Rule>): Promise<Rule> => {
  const { data } = await axios.put(`${API_URL}/rules/${id}`, rule);
  return data.data;
};

export const deleteRule = async (id: number): Promise<void> => {
  await axios.delete(`${API_URL}/rules/${id}`);
};

export const toggleRule = async (id: number, enabled: boolean): Promise<Rule> => {
  const { data } = await axios.patch(`${API_URL}/rules/${id}/toggle`, { enabled });
  return data.data;
};

export const updatePriority = async (id: number, priority: number): Promise<Rule> => {
  const { data } = await axios.patch(`${API_URL}/rules/${id}/priority`, { priority });
  return data.data;
};

export const rollbackRule = async (id: number, target_version: number): Promise<Rule> => {
  const { data } = await axios.post(`${API_URL}/rules/${id}/rollback`, { target_version });
  return data.data;
};

export const simulateRule = async (req: SimulationRequest): Promise<SimulationResponse> => {
  const { data } = await axios.post(`${API_URL}/rules/simulate`, req);
  return data.data;
};

export const fetchAIRecs = async (): Promise<AIRec[]> => {
  const { data } = await axios.get(`${API_URL}/ai-recs`);
  return Array.isArray(data.data) ? data.data : [];
};
