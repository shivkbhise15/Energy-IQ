import { NavLink, Outlet } from "react-router-dom";
import {
  Activity,
  Bell,
  Brain,
  Building2,
  Gauge,
  LayoutDashboard,
  Moon,
  RadioTower,
  Search,
  Settings,
  Sun
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/store/use-ui-store";
import { useAuthStore } from "@/store/use-auth-store";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/facilities", label: "Facilities", icon: Building2 },
  { to: "/devices", label: "Devices", icon: RadioTower },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/insights", label: "AI Insights", icon: Brain }
];

export function AppShell() {
  const darkMode = useUiStore((state) => state.darkMode);
  const toggleDarkMode = useUiStore((state) => state.toggleDarkMode);
  const signOut = useAuthStore((state) => state.signOut);

  return (
    <div className={cn(darkMode && "dark")}>
      <div className="min-h-screen bg-background text-foreground">
        <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-border bg-panel lg:block">
          <div className="flex h-16 items-center gap-3 border-b border-border px-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Gauge className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">EnergyIQ</p>
              <p className="truncate text-xs text-muted-foreground">Operations Command</p>
            </div>
          </div>
          <nav className="space-y-1 px-3 py-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground",
                    isActive && "bg-primary/10 text-primary"
                  )
                }
              >
                <item.icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="absolute bottom-0 left-0 right-0 border-t border-border p-3">
              <Button variant="ghost" className="w-full justify-start" onClick={() => void signOut()}>
              <Settings className="h-4 w-4" aria-hidden="true" />
                Sign out
            </Button>
          </div>
        </aside>

        <div className="lg:pl-64">
          <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
            <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground lg:hidden">
                  <Gauge className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="hidden min-w-0 items-center gap-2 rounded-lg border border-border bg-panel px-3 py-2 md:flex">
                  <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span className="text-sm text-muted-foreground">Search incidents, devices, manuals</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="icon" title="Live operations">
                  <Activity className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button variant="secondary" size="icon" title="Notifications">
                  <Bell className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button variant="secondary" size="icon" title="Toggle theme" onClick={toggleDarkMode}>
                  {darkMode ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
                </Button>
              </div>
            </div>
          </header>
          <main className="px-4 py-5 sm:px-6 lg:px-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
