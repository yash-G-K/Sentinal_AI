// src/pages/ApiKeys.tsx
import { useState } from "react";
import { Key, Plus, Trash2, ShieldAlert, CheckCircle, Copy, X } from "lucide-react";

interface ApiKey {
  id: number;
  name: string;
  prefix: string;
  permissions: string[];
  created: string;
  status: "active" | "revoked";
}

export function ApiKeys() {
  const [keys, setKeys] = useState<ApiKey[]>([
    { id: 1, name: "SIEM Export Integration", prefix: "key_prod_7a2b...", permissions: ["read:traffic", "read:threats"], created: "2026-06-01", status: "active" },
    { id: 2, name: "Auto Rules Deploy Script", prefix: "key_prod_9a1d...", permissions: ["read:rules", "write:rules"], created: "2026-06-15", status: "active" },
    { id: 3, name: "Dev Staging Sandbox", prefix: "key_stag_3c1d...", permissions: ["read:*"], created: "2026-05-10", status: "revoked" },
  ]);

  const [newlyGeneratedKey, setNewlyGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const revokeKey = (id: number) => {
    setKeys(keys.map(k => k.id === id ? { ...k, status: "revoked" as const } : k));
  };

  const generateKey = () => {
    const newId = keys.length ? Math.max(...keys.map(k => k.id)) + 1 : 1;
    const fullHex = Array.from({length: 4}, () => Math.random().toString(16).substring(2, 10)).join("");
    const fullKey = `key_prod_${fullHex}`;
    
    const newKey: ApiKey = {
      id: newId,
      name: `Auto-Generated Key #${newId}`,
      prefix: `key_prod_${fullHex.substring(0, 8)}...`,
      permissions: ["read:*", "write:*"],
      created: new Date().toISOString().split("T")[0],
      status: "active"
    };
    setKeys([newKey, ...keys]);
    setNewlyGeneratedKey(fullKey);
    setCopied(false);
  };

  const handleCopy = () => {
    if (newlyGeneratedKey) {
      navigator.clipboard.writeText(newlyGeneratedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-4 max-w-screen-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--fg)" }}>API Credentials</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted-fg)" }}>
            Generate and manage API keys for automated integrations and pipeline deployments
          </p>
        </div>
        <button
          onClick={generateKey}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
        >
          <Plus size={14} /> Generate API Key
        </button>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr style={{ backgroundColor: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
                <th className="px-4 py-3 text-xs font-semibold" style={{ color: "var(--muted-fg)" }}>Key Name</th>
                <th className="px-4 py-3 text-xs font-semibold" style={{ color: "var(--muted-fg)" }}>Prefix</th>
                <th className="px-4 py-3 text-xs font-semibold" style={{ color: "var(--muted-fg)" }}>Scopes / Scopes</th>
                <th className="px-4 py-3 text-xs font-semibold" style={{ color: "var(--muted-fg)" }}>Created</th>
                <th className="px-4 py-3 text-xs font-semibold" style={{ color: "var(--muted-fg)" }}>Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-right" style={{ color: "var(--muted-fg)" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map(k => (
                <tr key={k.id} className="border-b" style={{ borderColor: "var(--border)" }}>
                  <td className="px-4 py-3 text-xs font-medium" style={{ color: "var(--fg)" }}>{k.name}</td>
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--muted-fg)" }}>{k.prefix}</td>
                  <td className="px-4 py-3 text-xs">
                    <div className="flex flex-wrap gap-1">
                      {k.permissions.map(p => (
                        <span key={p} className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono" style={{ color: "var(--fg)" }}>
                          {p}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--muted-fg)" }}>{k.created}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold"
                      style={{
                        backgroundColor: k.status === "active" ? "#f0fdf4" : "#fef2f2",
                        color: k.status === "active" ? "#15803d" : "#dc2626",
                      }}>
                      {k.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-right">
                    {k.status === "active" ? (
                      <button
                        onClick={() => revokeKey(k.id)}
                        className="text-xs font-medium text-red-500 hover:underline transition-colors"
                      >
                        Revoke Key
                      </button>
                    ) : (
                      <span className="text-[11px]" style={{ color: "var(--muted-fg)" }}>Inactive</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {newlyGeneratedKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl p-6 shadow-2xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="rounded-full p-1.5 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400">
                  <Key size={18} />
                </div>
                <h3 className="font-bold text-lg" style={{ color: "var(--fg)" }}>API Key Generated</h3>
              </div>
              <button onClick={() => setNewlyGeneratedKey(null)} className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors" style={{ color: "var(--muted-fg)" }}>
                <X size={18} />
              </button>
            </div>
            
            <p className="text-sm mb-4" style={{ color: "var(--muted-fg)" }}>
              Please copy this API key and store it somewhere safe. For security reasons, <strong>you will not be able to see it again</strong>. It is used to programmatically authenticate your scripts, SIEM integrations, and CI/CD pipelines with the Sentinel AI backend.
            </p>

            <div className="flex items-center gap-2 p-3 rounded-lg mb-6" style={{ backgroundColor: "var(--muted)", border: "1px solid var(--border)" }}>
              <code className="text-sm font-mono flex-1 break-all" style={{ color: "var(--fg)" }}>
                {newlyGeneratedKey}
              </code>
              <button 
                onClick={handleCopy}
                className="p-2 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex-shrink-0"
                style={{ color: copied ? "#10b981" : "var(--muted-fg)" }}
                title="Copy to clipboard"
              >
                {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
              </button>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setNewlyGeneratedKey(null)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                I have saved my key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
