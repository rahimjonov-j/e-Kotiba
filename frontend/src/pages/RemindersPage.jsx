import { useState, useEffect } from "react";
import { BellRing, CheckCircle2 } from "lucide-react";
import { useMarkNotificationRead, useNotifications } from "../hooks/useApi";
import { Card, CardContent, CardTitle } from "../components/ui/card";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";
import { useI18n } from "../hooks/useI18n";

export function RemindersPage() {
  const { t } = useI18n();
  const { data, isLoading, isError, error } = useNotifications();
  const markRead = useMarkNotificationRead();
  const [actionMessage, setActionMessage] = useState("");

  const [hasMarkedRead, setHasMarkedRead] = useState(false);

  const notifications = data?.items || [];
  // Auto-mark all unread as read sequentially and only once per mount
  useEffect(() => {
    if (hasMarkedRead || notifications.length === 0) return;
    
    const unread = notifications.filter((n) => !n.is_read);
    if (unread.length > 0) {
      setHasMarkedRead(true);
      
      const processSequential = async () => {
        for (const n of unread) {
          try {
            await markRead.mutateAsync(n.id);
          } catch (e) {
            console.error("Failed to mark read:", n.id, e);
          }
        }
      };
      
      processSequential();
    }
  }, [notifications, hasMarkedRead, markRead]);

  if (isLoading) return <LoadingState label={t("reminders_loading")} />;
  if (isError) return <ErrorState message={error.message} />;

  const handleRead = async (item) => {
    if (item.is_read) return;
    try {
      await markRead.mutateAsync(item.id);
      setActionMessage("Xabar o'qildi.");
      setTimeout(() => setActionMessage(""), 1200);
    } catch {
      setActionMessage("Xabarni o'qilgan qilishda xatolik.");
    }
  };

  return (
    <div className="space-y-4 pb-20 md:pb-4">
      <h1 className="text-xl font-semibold">{t("reminders_title")}</h1>

      {actionMessage && <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{actionMessage}</p>}

      {notifications.length === 0 && <EmptyState label={t("reminders_empty")} />}

      {notifications.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => handleRead(item)}
          className="w-full text-left"
        >
          <Card className={`rounded-2xl border transition ${item.is_read ? "border-border/50 opacity-80" : "border-primary/40 shadow-soft"}`}>
            <CardTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <BellRing size={16} className={item.is_read ? "text-muted-foreground" : "text-primary"} />
                {item.title}
              </span>
              {item.is_read ? (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 size={14} /> O'qilgan</span>
              ) : (
                <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-medium text-white">Yangi</span>
              )}
            </CardTitle>
            <CardContent className="space-y-2 text-sm">
              <p>{item.message}</p>
              <p className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</p>
            </CardContent>
          </Card>
        </button>
      ))}
    </div>
  );
}
