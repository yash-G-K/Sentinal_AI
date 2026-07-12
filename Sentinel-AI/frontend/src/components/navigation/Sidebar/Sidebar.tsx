import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Activity, Shield, FileText, Settings, Globe,
  Users, BarChart2, Bell, Key, ChevronLeft, ChevronRight, Brain,
} from "lucide-react";
import { cn } from "../../utils";
import type { NavSection } from "./types";

const sections: NavSection[] = [
  {
    title: "Core",
    items: [
      { label: "Dashboard",         path: "/dashboard",    icon: <LayoutDashboard size={16} /> },
      { label: "Domains",           path: "/domains",      icon: <Globe size={16} /> },
      { label: "Traffic",           path: "/traffic",      icon: <Activity size={16} /> },
      { label: "Threat Intel",      path: "/threats",      icon: <Shield size={16} /> },
      { label: "Requests",          path: "/requests",     icon: <FileText size={16} /> },
      { label: "SOC Copilot",       path: "/assistant",    icon: <Brain size={16} /> },
    ],
  },
  {
    title: "Manage",
    items: [
      { label: "Firewall Rules",    path: "/firewall",     icon: <Shield size={16} /> },
      { label: "Analytics",         path: "/analytics",    icon: <BarChart2 size={16} /> },
      { label: "Audit Logs",        path: "/audit-logs",   icon: <FileText size={16} /> },
      { label: "Alerts",            path: "/alerts",       icon: <Bell size={16} /> },
      { label: "Users",             path: "/users",        icon: <Users size={16} /> },
      { label: "API Keys",          path: "/api-keys",     icon: <Key size={16} /> },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Settings",          path: "/settings",     icon: <Settings size={16} /> },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
}

function SidebarNavItem({
  item,
  collapsed,
}: {
  item: NavSection["items"][number];
  collapsed: boolean;
}) {
  const location = useLocation();
  const isActive = location.pathname.startsWith(item.path);

  return (
    <NavLink
      to={item.path}
      title={collapsed ? item.label : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        "select-none outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
        isActive
          ? "bg-blue-600 text-white"
          : "text-slate-300 hover:bg-white/10 hover:text-white"
      )}
    >
      <span className="flex-shrink-0">{item.icon}</span>
      {!collapsed && (
        <span className="truncate flex-1">{item.label}</span>
      )}
      {!collapsed && item.badge !== undefined && item.badge > 0 && (
        <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white leading-none">
          {item.badge}
        </span>
      )}
    </NavLink>
  );
}

export function Sidebar({ collapsed }: SidebarProps) {
  return (
    <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-6">
      {sections.map((section) => (
        <div key={section.title}>
          {!collapsed && (
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {section.title}
            </p>
          )}
          <ul className="space-y-0.5">
            {section.items.map((item) => (
              <li key={item.path}>
                <SidebarNavItem item={item} collapsed={collapsed} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function SidebarShell() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      style={{ backgroundColor: "var(--sidebar)", borderRight: "1px solid var(--border)" }}
      className={cn(
        "flex flex-col h-full transition-all duration-200",
        collapsed ? "w-14" : "w-56"
      )}
    >
      {/* Logo row */}
      <div
        className="flex items-center justify-between px-3 py-4 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        {!collapsed && (
          <span className="text-white font-bold text-sm tracking-tight">
            Sentinel<span className="text-blue-400">AI</span>
          </span>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="rounded-md p-1 text-slate-400 hover:text-white hover:bg-white/10 transition-colors ml-auto"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav items */}
      <Sidebar collapsed={collapsed} />

      {/* Footer */}
      <div
        className="border-t px-3 py-3"
        style={{ borderColor: "var(--border)" }}
      >
        {!collapsed && (
          <p className="text-[11px] text-slate-500">v1.0.0 · Production</p>
        )}
      </div>
    </aside>
  );
}
