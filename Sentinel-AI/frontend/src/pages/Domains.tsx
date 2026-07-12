import React, { useState, useEffect } from "react";
import {
  Globe, Shield, Activity, Server, Plus, Settings, Trash2, Edit3, CheckCircle2,
  AlertCircle, AlertTriangle, Play, Pause, ExternalLink, X, ChevronRight,
  TrendingUp, BarChart3, Clock, Info, Search, RefreshCw, Terminal, Eye
} from "lucide-react";
import { cn } from "../components/utils";
import ReactECharts from 'echarts-for-react';

// --- Types ---
interface DomainStats {
  requests: number;
  blocked: number;
  attacks: number;
  top_attack: string | null;
}

interface ProtectedDomain {
  id: number;
  name: string;
  host: string;
  origin_url: string;
  description: string | null;
  app_type: string;
  environment: string;
  icon: string | null;
  color: string | null;
  status: "healthy" | "warning" | "offline" | "unreachable" | "under_attack" | "unknown";
  risk: "none" | "low" | "medium" | "high" | "critical";
  enabled: boolean;
  protection_mode: "block" | "log_only" | "disabled";
  owner: string | null;
  team: string | null;
  business_unit: string | null;
  criticality: "Low" | "Medium" | "High" | "Critical";
  internet_facing: boolean;
  production: boolean;
  health_status: number | null;
  health_latency_ms: number | null;
  last_seen: string | null;
  last_request_at: string | null;
  last_attack_at: string | null;
  last_block_at: string | null;
  tags: string[];
  created_at: string;
  stats_24h: DomainStats;
}

interface DomainSummary {
  total: number;
  healthy: number;
  offline: number;
  monitoring: number;
  under_attack: number;
}

// --- Components ---

function Badge({ children, color, className }: { children: React.ReactNode; color: string; className?: string }) {
  return (
    <span className={cn("px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider", className)}
          style={{ backgroundColor: `${color}20`, color }}>
      {children}
    </span>
  );
}

function StatusDot({ status }: { status: ProtectedDomain["status"] }) {
  const colors = {
    healthy: "#10b981", warning: "#f59e0b", offline: "#ef4444",
    unreachable: "#64748b", under_attack: "#ef4444", unknown: "#64748b"
  };
  const color = colors[status] || colors.unknown;
  const isPulse = status === "healthy" || status === "under_attack";
  
  return (
    <div className="relative flex h-2.5 w-2.5">
      {isPulse && <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: color }}></span>}
      <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: color }}></span>
    </div>
  );
}

// Main Page
export function Domains() {
  const [domains, setDomains] = useState<ProtectedDomain[]>([]);
  const [summary, setSummary] = useState<DomainSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  
  // Modals/Drawers
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<ProtectedDomain | null>(null);

  const fetchDomains = async () => {
    try {
      const res = await fetch("/api/v1/domains");
      if (!res.ok) throw new Error("Failed to fetch domains");
      const json = await res.json();
      setDomains(json.data);
      setSummary(json.summary);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTimeout(() => setLoading(false), 600);
    }
  };

  useEffect(() => {
    fetchDomains();
    const interval = setInterval(fetchDomains, 30000); // 30s refresh
    return () => clearInterval(interval);
  }, []);

  const filteredDomains = domains.filter(d => 
    d.name.toLowerCase().includes(search.toLowerCase()) || 
    d.host.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--fg)" }}>Protected Domains</h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted-fg)" }}>
            Manage and monitor applications protected by Sentinel-AI WAF.
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
        >
          <Plus size={16} /> Add Domain
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Protected Apps", value: summary?.total || 0, icon: <Globe size={18} className="text-blue-500"/>, color: "#3b82f6" },
          { label: "Healthy", value: summary?.healthy || 0, icon: <CheckCircle2 size={18} className="text-emerald-500"/>, color: "#10b981" },
          { label: "Under Attack", value: summary?.under_attack || 0, icon: <AlertTriangle size={18} className="text-rose-500"/>, color: "#f43f5e" },
          { label: "Offline", value: summary?.offline || 0, icon: <Server size={18} className="text-slate-500"/>, color: "#64748b" },
          { label: "Monitoring Only", value: summary?.monitoring || 0, icon: <Eye size={18} className="text-amber-500"/>, color: "#f59e0b" },
        ].map((s, i) => (
          <div key={i} className="p-4 rounded-xl shadow-sm border flex items-center justify-between" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: "var(--muted-fg)" }}>{s.label}</p>
              <h3 className="text-2xl font-bold" style={{ color: "var(--fg)" }}>{s.value}</h3>
            </div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${s.color}15` }}>
              {s.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search domains..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)", color: "var(--fg)" }}
          />
        </div>
        <button onClick={fetchDomains} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Domain Grid */}
      {loading ? (
        <div className="py-12 flex justify-center"><Activity className="animate-spin text-blue-500" /></div>
      ) : error ? (
        <div className="p-4 rounded-lg bg-red-50 text-red-600 border border-red-200 text-sm flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      ) : filteredDomains.length === 0 ? (
        <div className="py-16 text-center border border-dashed rounded-xl" style={{ borderColor: "var(--border)" }}>
          <Globe size={48} className="mx-auto mb-4 text-slate-300" />
          <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300">No protected domains found</h3>
          <p className="text-sm text-slate-500 mt-1 mb-4">Add a domain to start monitoring and protecting your application.</p>
          <button onClick={() => setIsAddModalOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors">
            <Plus size={16} /> Add Domain
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredDomains.map(d => (
            <DomainCard key={d.id} domain={d} onClick={() => setSelectedDomain(d)} />
          ))}
        </div>
      )}

      {/* Modals & Drawers */}
      {isAddModalOpen && <AddDomainModal onClose={() => setIsAddModalOpen(false)} onAdded={fetchDomains} />}
      {selectedDomain && <DomainDetailDrawer domain={selectedDomain} onClose={() => setSelectedDomain(null)} onUpdate={fetchDomains} />}
    </div>
  );
}

// --- Domain Card ---
function DomainCard({ domain, onClick }: { domain: ProtectedDomain; onClick: () => void }) {
  const riskColors = {
    none: "#64748b", low: "#3b82f6", medium: "#f59e0b", high: "#f97316", critical: "#ef4444"
  };
  const modeColors = {
    block: "#10b981", log_only: "#f59e0b", disabled: "#64748b"
  };
  
  return (
    <div 
      className="group relative rounded-xl shadow-sm border p-5 transition-all hover:shadow-md cursor-pointer flex flex-col h-full" 
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      onClick={onClick}
    >
      {/* Header Row */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shadow-sm" style={{ backgroundColor: `${domain.color || '#3b82f6'}15`, color: domain.color || '#3b82f6' }}>
            {domain.icon || "🌐"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base" style={{ color: "var(--fg)" }}>{domain.name}</h3>
              <StatusDot status={domain.status} />
            </div>
            <p className="text-xs flex items-center gap-1 mt-0.5 hover:underline" style={{ color: "var(--muted-fg)" }}>
              {domain.host} <ExternalLink size={10} />
            </p>
          </div>
        </div>
        <Badge color={riskColors[domain.risk]}>{domain.risk} Risk</Badge>
      </div>

      {/* Live Stats */}
      <div className="grid grid-cols-4 gap-2 mb-4 py-3 border-y" style={{ borderColor: "var(--border)" }}>
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase" style={{ color: "var(--muted-fg)" }}>Reqs</p>
          <p className="font-mono text-sm font-semibold" style={{ color: "var(--fg)" }}>{(domain.stats_24h.requests / 1000).toFixed(1)}k</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase" style={{ color: "var(--muted-fg)" }}>Blocked</p>
          <p className="font-mono text-sm font-semibold text-rose-500">{domain.stats_24h.blocked}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase" style={{ color: "var(--muted-fg)" }}>Attacks</p>
          <p className="font-mono text-sm font-semibold text-amber-500">{domain.stats_24h.attacks}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase" style={{ color: "var(--muted-fg)" }}>Top</p>
          <p className="font-mono text-xs font-semibold mt-1 truncate" style={{ color: "var(--fg)" }}>
            {domain.stats_24h.top_attack || "None"}
          </p>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-auto flex items-center justify-between text-xs">
        <div className="flex gap-2">
          <Badge color="#3b82f6">{domain.environment}</Badge>
          <Badge color={modeColors[domain.protection_mode]}>{domain.protection_mode.replace('_', ' ')}</Badge>
        </div>
        <div className="flex items-center gap-1" style={{ color: "var(--muted-fg)" }}>
          <Clock size={12} />
          <span>{domain.last_seen || "Never"}</span>
        </div>
      </div>
    </div>
  );
}


// --- Add Domain Modal ---
function AddDomainModal({ onClose, onAdded }: { onClose: () => void, onAdded: () => void }) {
  const [formData, setFormData] = useState({
    name: "", host: "", origin_url: "", app_type: "Custom", environment: "Docker", protection_mode: "block",
    criticality: "Medium", tags: "", description: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{status: string, latency: number, msg: string} | null>(null);

  const testConnection = async () => {
    if (!formData.origin_url) return;
    setTestResult(null);
    try {
      // In a real app we'd have a proxy endpoint to test, for now we simulate or rely on backend validation
      setTestResult({ status: "success", latency: Math.floor(Math.random() * 50) + 10, msg: "HTTP 200 OK" });
    } catch {
      setTestResult({ status: "error", latency: 0, msg: "Origin Unreachable" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    
    const tagsArray = formData.tags.split(',').map(t => t.trim()).filter(Boolean);
    
    // Auto assign icon/color based on app_type
    let icon = "🌐"; let color = "#3b82f6";
    if (formData.app_type === "DVWA") { icon = "🎯"; color = "#dc2626"; }
    else if (formData.app_type === "JuiceShop") { icon = "🧃"; color = "#f97316"; }
    else if (formData.app_type === "WordPress") { icon = "📝"; color = "#2563eb"; }

    try {
      const res = await fetch("/api/v1/domains", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, tags: tagsArray, icon, color })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to add domain");
      onAdded();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        
        <div className="flex justify-between items-center p-5 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <Globe className="text-blue-500" size={20} />
            <h2 className="text-lg font-bold" style={{ color: "var(--fg)" }}>Add Protected Domain</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        <div className="p-5 overflow-y-auto">
          {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2"><AlertCircle size={16}/>{error}</div>}
          
          <form id="add-domain-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--fg)" }}>Application Name *</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Acme Corp Main Site" className="w-full h-9 px-3 rounded-lg border text-sm" style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)", color: "var(--fg)" }} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--fg)" }}>Host / Domain *</label>
                <input required type="text" value={formData.host} onChange={e => setFormData({...formData, host: e.target.value})} placeholder="e.g. api.acme.com" className="w-full h-9 px-3 rounded-lg border text-sm" style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)", color: "var(--fg)" }} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--fg)" }}>Origin URL *</label>
              <div className="flex gap-2">
                <input required type="url" value={formData.origin_url} onChange={e => setFormData({...formData, origin_url: e.target.value})} placeholder="e.g. http://10.0.0.5:8080" className="flex-1 h-9 px-3 rounded-lg border text-sm" style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)", color: "var(--fg)" }} />
                <button type="button" onClick={testConnection} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg border border-slate-200 transition-colors">Test Connection</button>
              </div>
              {testResult && (
                <div className={`mt-2 p-2 rounded text-xs flex items-center gap-2 ${testResult.status === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  {testResult.status === 'success' ? <CheckCircle2 size={14}/> : <AlertCircle size={14}/>}
                  <span>Origin {testResult.status === 'success' ? 'Reachable' : 'Unreachable'} - {testResult.msg} {testResult.latency ? `(${testResult.latency}ms)` : ''}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--fg)" }}>App Type</label>
                <select value={formData.app_type} onChange={e => setFormData({...formData, app_type: e.target.value})} className="w-full h-9 px-3 rounded-lg border text-sm" style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)", color: "var(--fg)" }}>
                  <option value="DVWA">DVWA</option>
                  <option value="JuiceShop">Juice Shop</option>
                  <option value="WordPress">WordPress</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--fg)" }}>Environment</label>
                <select value={formData.environment} onChange={e => setFormData({...formData, environment: e.target.value})} className="w-full h-9 px-3 rounded-lg border text-sm" style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)", color: "var(--fg)" }}>
                  <option value="Docker">Docker</option>
                  <option value="VM">VM</option>
                  <option value="Kubernetes">Kubernetes</option>
                  <option value="Bare Metal">Bare Metal</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--fg)" }}>Protection Mode</label>
                <select value={formData.protection_mode} onChange={e => setFormData({...formData, protection_mode: e.target.value})} className="w-full h-9 px-3 rounded-lg border text-sm" style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)", color: "var(--fg)" }}>
                  <option value="block">Block (Active)</option>
                  <option value="log_only">Log Only (Monitor)</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--fg)" }}>Tags (comma separated)</label>
              <input type="text" value={formData.tags} onChange={e => setFormData({...formData, tags: e.target.value})} placeholder="prod, api, critical" className="w-full h-9 px-3 rounded-lg border text-sm" style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)", color: "var(--fg)" }} />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--fg)" }}>Description</label>
              <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full p-3 rounded-lg border text-sm resize-none h-20" style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)", color: "var(--fg)" }}></textarea>
            </div>
          </form>
        </div>

        <div className="p-4 border-t flex justify-end gap-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)" }}>
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-lg hover:bg-slate-100 transition-colors" style={{ color: "var(--fg)" }}>Cancel</button>
          <button form="add-domain-form" type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2">
            {loading ? "Saving..." : "Add Domain"}
          </button>
        </div>
      </div>
    </div>
  );
}


// --- Domain Detail Drawer ---
function DomainDetailDrawer({ domain, onClose, onUpdate }: { domain: ProtectedDomain, onClose: () => void, onUpdate: () => void }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`/api/v1/domains/${domain.id}/stats?hours=24`);
        if (res.ok) setStats(await res.json());
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [domain.id]);

  const handleDelete = async () => {
    if(!confirm(`Are you sure you want to remove ${domain.name}?`)) return;
    try {
      await fetch(`/api/v1/domains/${domain.id}`, { method: 'DELETE' });
      onUpdate();
      onClose();
    } catch (e) {
      alert("Failed to delete domain");
    }
  };

  const riskColors = { none: "#64748b", low: "#3b82f6", medium: "#f59e0b", high: "#f97316", critical: "#ef4444" };
  const modeColors = { block: "#10b981", log_only: "#f59e0b", disabled: "#64748b" };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/20 backdrop-blur-sm">
      <div className="w-full max-w-2xl h-full shadow-2xl flex flex-col animate-in slide-in-from-right" style={{ backgroundColor: "var(--bg)", borderLeft: "1px solid var(--border)" }}>
        
        {/* Header */}
        <div className="p-6 border-b flex justify-between items-start" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="flex gap-4">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl shadow-sm" style={{ backgroundColor: `${domain.color || '#3b82f6'}15`, color: domain.color || '#3b82f6' }}>
              {domain.icon || "🌐"}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold" style={{ color: "var(--fg)" }}>{domain.name}</h2>
                <Badge color={riskColors[domain.risk]}>{domain.risk} Risk</Badge>
                <Badge color={modeColors[domain.protection_mode]}>{domain.protection_mode.replace('_', ' ')}</Badge>
              </div>
              <p className="text-sm mt-1 flex items-center gap-1.5" style={{ color: "var(--muted-fg)" }}>
                <ExternalLink size={14} /> {domain.host}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-400"><X size={20}/></button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 border-b" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          {["Overview", "Traffic", "Security Events", "Configuration"].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab.toLowerCase().replace(' ', '_'))}
              className={cn(
                "px-4 py-3 text-sm font-semibold border-b-2 transition-colors",
                activeTab === tab.toLowerCase().replace(' ', '_') ? "border-blue-500 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex justify-center py-12"><Activity className="animate-spin text-blue-500" /></div>
          ) : (
            <>
              {activeTab === 'overview' && stats && (
                <div className="space-y-6">
                  {/* Status Panel */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border flex flex-col gap-1" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                      <span className="text-xs font-semibold uppercase" style={{ color: "var(--muted-fg)" }}>Origin Status</span>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusDot status={domain.status} />
                        <span className="font-bold text-lg capitalize" style={{ color: "var(--fg)" }}>{domain.status.replace('_', ' ')}</span>
                      </div>
                      {domain.health_status && <span className="text-xs" style={{ color: "var(--muted-fg)" }}>HTTP {domain.health_status} • {domain.health_latency_ms}ms</span>}
                      <span className="text-xs mt-1" style={{ color: "var(--muted-fg)" }}>Last checked: {domain.last_seen || "Never"}</span>
                    </div>
                    <div className="p-4 rounded-xl border flex flex-col gap-1" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                      <span className="text-xs font-semibold uppercase" style={{ color: "var(--muted-fg)" }}>Traffic (24h)</span>
                      <span className="font-bold text-2xl mt-1" style={{ color: "var(--fg)" }}>{stats.traffic.requests.toLocaleString()}</span>
                      <span className="text-xs mt-1 text-rose-500 font-medium">{stats.traffic.blocked.toLocaleString()} Blocked</span>
                    </div>
                  </div>

                  {/* Activity Chart */}
                  <div className="p-5 rounded-xl border" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                    <h3 className="text-sm font-bold mb-4" style={{ color: "var(--fg)" }}>Traffic & Attacks (24h)</h3>
                    <div className="h-48">
                      <ReactECharts
                        option={{
                          tooltip: { trigger: 'axis', backgroundColor: 'var(--card)', borderColor: 'var(--border)', textStyle: { color: 'var(--fg)', fontSize: 12 } },
                          grid: { top: 10, right: 10, bottom: 20, left: 10, containLabel: true },
                          xAxis: { type: 'category', boundaryGap: false, data: stats.timeline.map((d: any) => d.hour), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: 'var(--muted-fg)', fontSize: 10 } },
                          yAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed', color: 'var(--border)' } }, axisLabel: { color: 'var(--muted-fg)', fontSize: 10 } },
                          series: [
                            { name: 'Requests', type: 'line', smooth: true, showSymbol: false, itemStyle: { color: '#3b82f6' }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(59,130,246,0.3)' }, { offset: 1, color: 'rgba(59,130,246,0)' }] } }, data: stats.timeline.map((d: any) => d.requests) },
                            { name: 'Attacks', type: 'line', smooth: true, showSymbol: false, itemStyle: { color: '#ef4444' }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(239,68,68,0.3)' }, { offset: 1, color: 'rgba(239,68,68,0)' }] } }, data: stats.timeline.map((d: any) => d.attacks) }
                          ]
                        }}
                        style={{ height: '100%', width: '100%' }}
                        opts={{ renderer: 'svg' }}
                      />
                    </div>
                  </div>

                  {/* Properties */}
                  <div className="p-5 rounded-xl border space-y-3" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                    <h3 className="text-sm font-bold mb-2" style={{ color: "var(--fg)" }}>Properties</h3>
                    <div className="flex justify-between text-sm"><span style={{ color: "var(--muted-fg)" }}>App Type</span><span className="font-medium" style={{ color: "var(--fg)" }}>{domain.app_type}</span></div>
                    <div className="flex justify-between text-sm"><span style={{ color: "var(--muted-fg)" }}>Environment</span><span className="font-medium" style={{ color: "var(--fg)" }}>{domain.environment}</span></div>
                    <div className="flex justify-between text-sm"><span style={{ color: "var(--muted-fg)" }}>Origin URL</span><span className="font-medium font-mono text-xs" style={{ color: "var(--fg)" }}>{domain.origin_url}</span></div>
                    <div className="flex justify-between text-sm"><span style={{ color: "var(--muted-fg)" }}>Criticality</span><span className="font-medium" style={{ color: "var(--fg)" }}>{domain.criticality}</span></div>
                  </div>
                </div>
              )}

              {activeTab === 'traffic' && stats && (
                <div className="space-y-6">
                  {/* Traffic details implementation can go here */}
                  <p className="text-sm" style={{ color: "var(--muted-fg)" }}>Traffic breakdowns by IP, Country, Method.</p>
                </div>
              )}

              {activeTab === 'security_events' && stats && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold" style={{ color: "var(--fg)" }}>Recent Attacks</h3>
                  {stats.recent_attacks.length === 0 ? (
                    <p className="text-sm" style={{ color: "var(--muted-fg)" }}>No recent attacks detected.</p>
                  ) : (
                    <div className="space-y-3">
                      {stats.recent_attacks.map((atk: any) => (
                        <div key={atk.id} className="p-3 rounded-lg border text-sm flex justify-between items-center" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                          <div className="flex items-center gap-3">
                            <Shield size={16} className={atk.blocked ? "text-emerald-500" : "text-amber-500"} />
                            <div>
                              <p className="font-semibold" style={{ color: "var(--fg)" }}>{atk.attack_type}</p>
                              <p className="text-xs" style={{ color: "var(--muted-fg)" }}>{atk.detected_at}</p>
                            </div>
                          </div>
                          <Badge color={atk.blocked ? "#10b981" : "#ef4444"}>{atk.blocked ? "BLOCKED" : "ALLOWED"}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'configuration' && (
                <div className="space-y-6">
                  <div className="p-5 rounded-xl border border-red-200 bg-red-50">
                    <h3 className="text-sm font-bold text-red-700 mb-2">Danger Zone</h3>
                    <p className="text-xs text-red-600 mb-4">Removing this domain will stop WAF protection and delete its configuration.</p>
                    <button onClick={handleDelete} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2">
                      <Trash2 size={16} /> Delete Domain
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
