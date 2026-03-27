import { useLocation, Link, NavLink } from "react-router-dom";
import { LayoutDashboard, Mic2, Bell, CalendarDays, WalletCards, Settings, Shield } from "lucide-react";
import { Button } from "../components/ui/button";
import { useI18n } from "../hooks/useI18n";
import { AudioReminderPlayer } from "../components/AudioReminderPlayer";
import { useNotifications, useProfile } from "../hooks/useApi";
import { useEffect, useRef, useState } from "react";

const getWelcomeKey = (userId) => `kotiba-welcome-shown:${userId}`;

const items = [
  { to: "/", labelKey: "nav_secretary", icon: Mic2 },
  { to: "/dashboard", labelKey: "nav_dashboard", icon: LayoutDashboard },
  { to: "/reminders", labelKey: "nav_reminders", icon: Bell },
  { to: "/meetings", labelKey: "nav_meetings", icon: CalendarDays },
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
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const welcomeHandledRef = useRef(false);

  useEffect(() => {
    const profile = profileData?.profile;
    if (!profile || welcomeHandledRef.current) return undefined;

    const welcomeKey = getWelcomeKey(profile.id);
    if (localStorage.getItem(welcomeKey) === "1") return undefined;

    welcomeHandledRef.current = true;
    localStorage.setItem(welcomeKey, "1");
    setWelcomeMessage(`${profile.name || "Foydalanuvchi"}, xush kelibsiz!`);
  }, [profileData?.profile?.id, profileData?.profile?.name]);

  useEffect(() => {
    if (!welcomeMessage) return undefined;
    const timer = setTimeout(() => setWelcomeMessage(""), 1500);
    return () => clearTimeout(timer);
  }, [welcomeMessage]);

  const unreadCount = (notificationsData?.items || []).filter((item) => !item.is_read).length;
  const isAdmin = profileData?.profile?.role === "admin";
  const navItems = isAdmin ? items : items.filter((item) => item.to !== "/admin");
  const mobileOrder = ["/", "/meetings", "/expenses", "/dashboard", "/admin"];
  const mobileItems = mobileOrder
    .map((path) => navItems.find((item) => item.to === path))
    .filter(Boolean);

  return (
    <div className="app-shell-root min-h-[100dvh] md:min-h-[calc(100vh-32px)]">
      {welcomeMessage ? (
        <div className="fixed left-1/2 top-16 z-40 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-full border border-emerald-200 bg-white/95 px-4 py-2 text-sm font-medium text-emerald-700 shadow-[0_12px_30px_rgba(16,185,129,0.15)] backdrop-blur">
          {welcomeMessage}
        </div>
      ) : null}

      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="flex w-full items-center justify-between px-4 py-3">
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

      <div className={`w-full ${isSecretary ? "pt-0 pb-[72px]" : "p-4 pb-24"}`}>
        <main className={`min-w-0 animate-fade-in ${isSecretary ? "h-[calc(100dvh-138px)] md:h-[calc(100vh-170px)] min-h-0 relative" : "space-y-4"}`}>{children}</main>
      </div>

      <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-[460px] -translate-x-1/2 border-t border-border/70 bg-background/95 px-3 pb-3 pt-2 backdrop-blur">
        <div
          className="mx-auto grid w-full max-w-md gap-2"
          style={{ gridTemplateColumns: `repeat(${mobileItems.length || 1}, minmax(0, 1fr))` }}
        >
          {mobileItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex min-h-[60px] w-full flex-col items-center justify-center rounded-2xl px-2 py-2 text-[11px] font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-[0_12px_24px_rgba(20,155,122,0.24)]"
                      : "text-muted-foreground hover:bg-slate-100/80"
                  }`
                }
              >
                <span className="relative inline-flex">
                  <Icon size={15} />
                  {item.to === "/reminders" && unreadCount > 0 && (
                    <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm">{unreadCount}</span>
                  )}
                </span>
                <span className="mt-1 text-center leading-none">{t(item.labelKey)}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      <AudioReminderPlayer />
    </div>
  );
}
