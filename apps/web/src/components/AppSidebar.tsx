import { useState } from "react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  UserCircle,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { removeAuthToken } from "@/lib/apollo";
import { Button } from "./ui/button";

const navItems = [
  { title: "Início", url: "/", icon: LayoutDashboard },
  { title: "Leads", url: "/leads", icon: Users },
  { title: "Agenda", url: "/schedule", icon: CalendarDays },
  { title: "Pacientes", url: "/patients", icon: UserCircle },
  { title: "Configurações", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    removeAuthToken();
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <aside
      className={cn(
        "flex flex-col h-screen text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 ease-in-out shrink-0",
        "bg-gradient-to-b from-[hsl(220,40%,10%)] via-[hsl(220,35%,12%)] to-[hsl(220,40%,10%)]",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-center h-16 px-4 border-b border-white/10">
        <img src="/logo.svg" alt="Hospital São Rafael" className={collapsed ? "h-8 w-auto object-contain" : "h-9 w-auto object-contain"} />
      </div>

      {/* Nav Items */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => {
          const isActive = location.pathname === item.url || 
            (item.url !== "/" && location.pathname.startsWith(item.url));

          return (
            <NavLink
              key={item.title}
              to={item.url}
              end={item.url === "/"}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-white border-l-2 border-cyan-400"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              )}
              activeClassName="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-white border-l-2 border-cyan-400"
            >
              <item.icon className={cn("h-5 w-5 shrink-0", isActive && "text-cyan-400")} />
              {!collapsed && <span>{item.title}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Logout Button */}
      <div className="px-2 pb-2">
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start text-white/60 hover:text-white hover:bg-white/10",
            collapsed && "justify-center px-0"
          )}
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span className="ml-3">Sair</span>}
        </Button>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-12 border-t border-white/10 hover:bg-white/5 transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4 text-white/60" />
        ) : (
          <ChevronLeft className="h-4 w-4 text-white/60" />
        )}
      </button>
    </aside>
  );
}
