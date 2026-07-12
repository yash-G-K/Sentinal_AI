import { ReactNode } from "react";
import { SidebarShell } from "../navigation/Sidebar/Sidebar";
import { TopBar } from "../ui/TopBar";
import type { AuthUser } from "../../pages/Login";

interface AppLayoutProps {
  children: ReactNode;
  user?: AuthUser;
  onLogout?: () => void;
}

export function AppLayout({ children, user, onLogout }: AppLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <SidebarShell />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar user={user} onLogout={onLogout} />
        <main
          className="flex-1 overflow-y-auto p-6"
          style={{ backgroundColor: "var(--bg)" }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
