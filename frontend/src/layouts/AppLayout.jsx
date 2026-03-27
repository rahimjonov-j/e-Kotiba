import { useLocation, Link, NavLink } from "react-router-dom";
import { LayoutDashboard, Mic2, Bell, CalendarDays, Users, WalletCards, Settings, Shield, User2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { useI18n } from "../hooks/useI18n";
import { AudioReminderPlayer } from "../components/AudioReminderPlayer";
import { useNotifications, useProfile } from "../hooks/useApi";
import { useSettingsStore } from "../store/settingsStore";
import { useEffect } from "react";

const items = [
  { to: "/", labelKey: "nav_secretary", icon: Mic2 },
  { to: "/dashboard", labelKey: "nav_dashboard", icon: LayoutDashboard },
  { to: "/reminders", labelKey: "nav_reminders", icon: Bell },
  { to: "/meetings", labelKey: "nav_meetings", icon: CalendarDays },
  { to: "/clients", labelKey: "nav_clients", icon: Users },
  { to: "/expenses", labelKey: "nav_expenses", icon: WalletCards },
  { to: "/settings", labelKey: "nav_settings", icon: Settings },
  { to: "/admin", labelKey: "nav_admin", icon: Shield },
];

export function AppLayout({ children }) {
  const { t } = useI18n();
  const location = useLocation();
  const isSecretary = location.pathname === "/";
  const { data: notificationsData } = useNotifications();
  const { data: profileData } = useProfile();
  const loadSettings = useSettingsStore((state) => state.loadSettings);

  useEffect(() => {
    loadSettings().catch(console.error);
  }, [loadSettings]);
  const unreadCount = (notificationsData?.items || []).filter((item) => !item.is_read).length;
  const isAdmin = profileData?.profile?.role === "admin";
  const navItems = isAdmin ? items : items.filter((item) => item.to !== "/admin");
  const mobileOrder = ["/", "/meetings", "/expenses", "/dashboard"];
  const mobileItems = mobileOrder
    .map((path) => navItems.find((item) => item.to === path))
    .filter(Boolean);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold text-[#149B7A]">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-100/50 text-[#149B7A] overflow-hidden border border-teal-200 shadow-sm">
              <img src="/asalxon_avatar.png?v=3" alt="Asalxon" className="w-full h-full object-cover" />
            </div>
            Asalxon
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="h-10 w-10 p-0" aria-label={t("nav_reminders")}>
              <Link to="/reminders">
                <span className="relative inline-flex">
                  <Bell size={18} className="text-[#149B7A]" />
                  {unreadCount > 0 && <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm">{unreadCount}</span>}
                </span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-10 w-10 p-0" aria-label={t("nav_settings")}>
              <Link to="/settings">
                <Settings size={18} className="text-slate-600" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className={`mx-auto grid max-w-7xl grid-cols-1 gap-4 ${isSecretary ? "pt-0 md:pt-4 md:pb-4 pb-[72px]" : "p-4 pb-24 md:pb-4"} md:grid-cols-[220px_1fr]`}>
        <aside className="hidden md:block">
          <nav className={`space-y-1 rounded-xl border border-border/80 bg-card p-2 shadow-soft ${isSecretary ? "ml-4" : ""}`}>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`
                  }
                >
                  <span className="relative inline-flex">
                    <Icon size={16} />
                    {item.to === "/reminders" && unreadCount > 0 && (
                      <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm">{unreadCount}</span>
                    )}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    {t(item.labelKey)}
                    {item.to === "/reminders" && unreadCount > 0 && (
                      <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-medium text-white">{unreadCount}</span>
                    )}
                  </span>
                </NavLink>
              );
            })}
          </nav>
        </aside>

        <main className={`animate-fade-in ${isSecretary ? "h-[calc(100vh-138px)] md:h-[calc(100vh-100px)] min-h-0 relative" : "space-y-4"}`}>{children}</main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 p-2 backdrop-blur md:hidden">
        <div className="grid grid-cols-4 gap-1">
          {mobileItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex flex-col items-center rounded-xl px-1 py-1 text-[11px] ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`
                }
              >
                <span className="relative inline-flex">
                  <Icon size={14} />
                  {item.to === "/reminders" && unreadCount > 0 && (
                    <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm">{unreadCount}</span>
                  )}
                </span>
                <span>{t(item.labelKey)}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      <AudioReminderPlayer />
    </div>
  );
}
