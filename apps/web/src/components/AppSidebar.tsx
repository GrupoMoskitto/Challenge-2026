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
      {!collapsed && <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>}
    </button>
  );
}

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
        "flex flex-col h-screen border-r transition-all duration-300 ease-in-out shrink-0",
        "bg-sidebar-background/80 backdrop-blur-xl text-sidebar-foreground border-sidebar-border/50",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-center h-16 px-4 border-b border-sidebar-border">
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
                  ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
              activeClassName="bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-sidebar-primary"
            >
              <item.icon className={cn("h-5 w-5 shrink-0", isActive && "text-sidebar-primary")} />
              {!collapsed && <span>{item.title}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Theme Toggle */}
      <div className="px-2 py-1">
        <ThemeToggle collapsed={collapsed} />
      </div>

      {/* Logout Button */}
      <div className="px-2 pb-2">
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
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
        className="flex items-center justify-center h-12 border-t border-sidebar-border hover:bg-sidebar-accent transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4 text-sidebar-foreground/60" />
        ) : (
          <ChevronLeft className="h-4 w-4 text-sidebar-foreground/60" />
        )}
      </button>
    </aside>
  );
}
