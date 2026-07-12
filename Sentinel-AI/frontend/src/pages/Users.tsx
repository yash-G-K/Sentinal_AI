// src/pages/Users.tsx
import { useState, useEffect } from "react";
import { Users as UsersIcon, UserPlus, Shield, CheckCircle, XCircle, Loader2, X, Mail, Lock, ChevronDown } from "lucide-react";
import type { AuthUser } from "./Login";

interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: string;
  status: "active" | "suspended";
  lastLogin: string;
  mfaEnabled: boolean;
}

const ROLES = ["Super Admin", "Security Admin", "SOC Analyst", "Viewer", "API Developer"];

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  "Super Admin":    { bg: "#fce7f3", color: "#be185d" },
  "Security Admin": { bg: "#ede9fe", color: "#7c3aed" },
  "SOC Analyst":    { bg: "#dbeafe", color: "#1d4ed8" },
  "Viewer":         { bg: "#f0fdf4", color: "#15803d" },
  "API Developer":  { bg: "#fff7ed", color: "#c2410c" },
};

interface UsersProps {
  currentUser?: AuthUser;
}

export function Users({ currentUser }: UsersProps) {
  const [users,   setUsers]   = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");

  // Add user form state
  const [newEmail,    setNewEmail]    = useState("");
  const [newName,     setNewName]     = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole,     setNewRole]     = useState("SOC Analyst");

  const isSuperAdmin = currentUser?.role === "Super Admin";

  // ── Fetch users ──────────────────────────────────────────────────────────────
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/v1/users");
      const data = await res.json();
      setUsers(data.data ?? []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  // ── Toggle user status ────────────────────────────────────────────────────────
  const toggleStatus = async (id: number) => {
    try {
      const res  = await fetch(`/api/v1/users/${id}/status`, { method: "PUT" });
      const data = await res.json();
      setUsers(prev => prev.map(u => u.id === id ? { ...u, status: data.status } : u));
    } catch {}
  };

  // ── Add user ─────────────────────────────────────────────────────────────────
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newName || !newPassword) { setError("All fields are required."); return; }
    setError(""); setSaving(true);
    try {
      const res  = await fetch("/api/v1/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, full_name: newName, password: newPassword, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || "Failed to create user."); return; }
      setUsers(prev => [data, ...prev]);
      setShowAdd(false);
      setNewEmail(""); setNewName(""); setNewPassword(""); setNewRole("SOC Analyst");
    } catch {
      setError("Server error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const card = { backgroundColor: "var(--card)", border: "1px solid var(--border)" };

  return (
    <div className="space-y-4 max-w-screen-2xl">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--fg)" }}>User Management</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted-fg)" }}>
            {loading ? "Loading…" : `${users.length} team members · RBAC enabled`}
          </p>
        </div>
        {isSuperAdmin && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)" }}
          >
            <UserPlus size={14} /> Add User
          </button>
        )}
      </div>

      {/* RBAC Role Legend */}
      <div className="flex items-center gap-2 flex-wrap">
        {ROLES.map(r => {
          const s = ROLE_COLORS[r] ?? { bg: "#f1f5f9", color: "#475569" };
          return (
            <span key={r} className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
              style={{ backgroundColor: s.bg, color: s.color }}>
              <Shield size={9} />{r}
            </span>
          );
        })}
      </div>

      {/* Users table */}
      <div className="rounded-xl overflow-hidden" style={card}>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={20} className="animate-spin" style={{ color: "var(--primary)" }} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr style={{ backgroundColor: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
                  {["Name", "Email", "Role", "Last Login", "MFA", "Status", "Actions"].map(h => (
                    <th key={h} className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wide ${h === "Actions" ? "text-right" : ""}`}
                      style={{ color: "var(--muted-fg)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const roleStyle = ROLE_COLORS[u.role] ?? { bg: "#f1f5f9", color: "#475569" };
                  const isMe = currentUser?.email === u.email;
                  return (
                    <tr key={u.id} className="border-b transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                      style={{ borderColor: "var(--border)" }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                            style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)" }}>
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs font-medium" style={{ color: "var(--fg)" }}>
                            {u.name}{isMe && <span className="ml-1 text-[10px] text-blue-500">(you)</span>}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--fg)" }}>{u.email}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                          style={{ backgroundColor: roleStyle.bg, color: roleStyle.color }}>
                          <Shield size={9} />{u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--muted-fg)" }}>{u.lastLogin}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold"
                          style={{
                            backgroundColor: u.mfaEnabled ? "#f0fdf4" : "#fef2f2",
                            color: u.mfaEnabled ? "#15803d" : "#dc2626",
                          }}>
                          {u.mfaEnabled ? <CheckCircle size={10} /> : <XCircle size={10} />}
                          {u.mfaEnabled ? "Enabled" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: u.status === "active" ? "#10b981" : "#dc2626" }} />
                          <span className="capitalize" style={{ color: "var(--fg)" }}>{u.status}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isSuperAdmin && !isMe ? (
                          <button
                            onClick={() => toggleStatus(u.id)}
                            className="text-xs font-medium hover:underline transition-colors"
                            style={{ color: u.status === "active" ? "#dc2626" : "#15803d" }}
                          >
                            {u.status === "active" ? "Suspend" : "Activate"}
                          </button>
                        ) : (
                          <span className="text-xs" style={{ color: "var(--muted-fg)" }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && (
                  <tr><td colSpan={7} className="py-16 text-center text-sm" style={{ color: "var(--muted-fg)" }}>No users found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-md rounded-2xl shadow-2xl" style={card}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <h2 className="text-sm font-bold" style={{ color: "var(--fg)" }}>Add New User</h2>
              <button onClick={() => setShowAdd(false)}><X size={16} style={{ color: "var(--muted-fg)" }} /></button>
            </div>
            <form onSubmit={handleAddUser} className="px-6 py-5 space-y-4">
              {error && (
                <div className="rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
                  {error}
                </div>
              )}
              {[
                { label: "Full Name", value: newName, set: setNewName, type: "text", placeholder: "Alice Vance", icon: <UsersIcon size={13} /> },
                { label: "Email",     value: newEmail, set: setNewEmail, type: "email", placeholder: "alice@sentinel.ai", icon: <Mail size={13} /> },
                { label: "Password",  value: newPassword, set: setNewPassword, type: "password", placeholder: "••••••••", icon: <Lock size={13} /> },
              ].map(f => (
                <div key={f.label}>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--fg)" }}>{f.label}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-fg)" }}>{f.icon}</span>
                    <input type={f.type} value={f.value} onChange={e => f.set(e.target.value)}
                      placeholder={f.placeholder}
                      className="w-full h-9 pl-9 pr-3 rounded-lg border text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      style={{ backgroundColor: "var(--muted)", borderColor: "var(--border)", color: "var(--fg)" }} />
                  </div>
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--fg)" }}>Role</label>
                <select value={newRole} onChange={e => setNewRole(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ backgroundColor: "var(--muted)", borderColor: "var(--border)", color: "var(--fg)" }}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowAdd(false)}
                  className="flex-1 h-9 rounded-lg text-xs font-medium border"
                  style={{ borderColor: "var(--border)", color: "var(--fg)" }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 h-9 rounded-lg text-xs font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-1.5"
                  style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)" }}>
                  {saving ? <><Loader2 size={12} className="animate-spin" /> Creating…</> : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
