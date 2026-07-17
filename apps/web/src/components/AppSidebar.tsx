import { useState, useEffect } from "react";
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
  Moon,
  Sun,
  Stethoscope,
  HelpCircle,
} from "lucide-react";
import { HelpWikiSheet } from "./HelpWikiSheet";
import { cn } from "@/lib/utils";
import { serverLogout } from "@/lib/apollo";

const baseNavItems = [
  { title: "Início", url: "/", icon: LayoutDashboard },
  { title: "Leads", url: "/leads", icon: Users },
  { title: "Agenda", url: "/schedule", icon: CalendarDays },
  { title: "Pacientes", url: "/patients", icon: UserCircle },
];

function ThemeToggle({ collapsed }: { collapsed: boolean }) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark') return 'dark';
    if (stored === 'light') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }, [theme]);

  const toggle = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    window.dispatchEvent(new CustomEvent('theme-transition'));
  };

  return (
    <button
      data-theme-toggle
      onClick={toggle}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 w-full",
        theme === 'dark'
          ? "text-yellow-400 hover:bg-white/5"
          : "text-slate-700 hover:bg-slate-200/50"
      )}
    >
      {theme === 'dark' ? (
        <Sun className="h-5 w-5 shrink-0" />
      ) : (
        <Moon className="h-5 w-5 shrink-0" />
      )}
      {!collapsed && <span className="whitespace-nowrap">{theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>}
    </button>
  );
}

interface AppSidebarProps {
  /** Called after a navigation action (used to close mobile drawer) */
  onNavigate?: () => void;
  /** Whether rendered inside a mobile drawer (forces expanded state, hides collapse toggle) */
  isMobileDrawer?: boolean;
}

export function AppSidebar({ onNavigate, isMobileDrawer }: AppSidebarProps) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => {
    if (isMobileDrawer) return false;
    return localStorage.getItem("sidebar-collapsed") === "true";
  });
  const [wikiOpen, setWikiOpen] = useState(false);
  const location = useLocation();

  // In mobile drawer, always expanded
  const isCollapsed = isMobileDrawer ? false : collapsed;

  const handleLogout = async () => {
    await serverLogout();
    localStorage.removeItem('user');
    window.location.href = '/login'; // Use window.location instead of navigate because the AppSidebar is outside Routes context maybe, or just to reset state fully
  };

  useEffect(() => {
    if (!isMobileDrawer) {
      localStorage.setItem("sidebar-collapsed", String(collapsed));
    }
  }, [collapsed, isMobileDrawer]);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user?.role === 'ADMIN';
  const isStaff = ['ADMIN', 'SURGEON', 'RECEPTION', 'SALES', 'CALL_CENTER'].includes(user?.role);
  
  const navItems = [...baseNavItems];
  if (isStaff) {
    navItems.push({ title: "Corpo Clínico", url: "/surgeons", icon: Stethoscope });
  }
  if (isAdmin) {
    navItems.push({ title: "Configurações", url: "/settings", icon: Settings });
  }

  const handleNavClick = () => {
    onNavigate?.();
  };

  return (
    <>
    <aside
      className={cn(
        "flex flex-col h-full border-r transition-all duration-300 ease-in-out shrink-0 overflow-hidden",
        "bg-sidebar-background/80 backdrop-blur-xl text-sidebar-foreground border-sidebar-border/50",
        isMobileDrawer ? "w-full" : (isCollapsed ? "w-16" : "w-60")
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-center h-16 px-4 border-b border-sidebar-border">
        <button
          onClick={() => navigate("/")}
          className="focus:outline-none"
          title="Ir para o Início"
        >
          <img src="/logo.svg" alt="Hospital São Rafael" className={isCollapsed ? "h-8 w-auto object-contain" : "h-9 w-auto object-contain"} />
        </button>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
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
                  ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
              activeClassName="bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-sidebar-primary"
              onClick={handleNavClick}
            >
              <item.icon className={cn("h-5 w-5 shrink-0", isActive && "text-sidebar-primary")} />
              {!isCollapsed && <span className="whitespace-nowrap">{item.title}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Theme Toggle */}
      <div className="px-2 py-1 overflow-x-hidden">
        <ThemeToggle collapsed={isCollapsed} />
      </div>

      {/* Help Wiki Button */}
      <div className="px-2 py-1 overflow-x-hidden">
        <button
          id="help-wiki-button"
          onClick={() => setWikiOpen(true)}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 w-full",
            "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          )}
        >
          <HelpCircle className="h-5 w-5 shrink-0" />
          {!isCollapsed && <span className="whitespace-nowrap">Como usar</span>}
        </button>
      </div>

      {/* Logout Button */}
      <div className="px-2 pb-2 overflow-x-hidden">
        <button
          onClick={handleLogout}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 w-full",
            "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          )}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!isCollapsed && <span className="whitespace-nowrap">Sair</span>}
        </button>
      </div>

      {/* Collapse Toggle — hidden in mobile drawer */}
      {!isMobileDrawer && (
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center h-12 border-t border-sidebar-border hover:bg-sidebar-accent transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4 text-sidebar-foreground/60" />
          ) : (
            <ChevronLeft className="h-4 w-4 text-sidebar-foreground/60" />
          )}
        </button>
      )}
    </aside>

    <HelpWikiSheet
      open={wikiOpen}
      onOpenChange={setWikiOpen}
      userRole={user?.role}
    />
    </>
  );
}
