import { useState } from "react";
import { BellRing, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardTitle } from "../components/ui/card";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";
import { useMarkNotificationRead, useNotifications } from "../hooks/useApi";

const formatCreatedAt = (value) => new Date(value).toLocaleString("uz-UZ");
const normalizeNotificationText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

const isDuplicateNotificationText = (title, message) => {
  const normalizedTitle = normalizeNotificationText(title);
  const normalizedMessage = normalizeNotificationText(message);
  return normalizedTitle && normalizedMessage && normalizedTitle === normalizedMessage;
};

export function RemindersPage() {
  const { data, isLoading, isError, error } = useNotifications();
  const markNotificationRead = useMarkNotificationRead();
  const [message, setMessage] = useState("");

  const notifications = data?.items || [];

  if (isLoading) return <LoadingState label="Bildirishnomalar yuklanmoqda..." />;
  if (isError) return <ErrorState message={error.message} />;

  const showTempMessage = (text) => {
    setMessage(text);
    setTimeout(() => setMessage(""), 1600);
  };

  const handleOpenNotification = async (item) => {
    if (item.is_read) return;

    try {
      await markNotificationRead.mutateAsync(item.id);
      showTempMessage("Xabar o'qildi.");
    } catch (readError) {
      showTempMessage(readError?.message || "Xabarni yangilashda xatolik.");
    }
  };

  return (
    <div className="space-y-4 pb-20 md:pb-4">
      <h1 className="text-xl font-semibold">Eslatmalar</h1>

      {message ? <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{message}</p> : null}

      {notifications.length === 0 ? <EmptyState label="Hali bildirishnomalar yo'q" /> : null}

      <div className="space-y-3">
        {notifications.map((item) => (
          <button key={item.id} type="button" onClick={() => handleOpenNotification(item)} className="block w-full text-left">
            <Card className={`rounded-2xl border transition ${item.is_read ? "border-border/60 opacity-80" : "border-primary/35 shadow-soft"}`}>
              <CardTitle className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <BellRing size={16} className={item.is_read ? "text-muted-foreground" : "text-primary"} />
                  <span className="truncate">{item.title}</span>
                </span>
                {item.is_read ? (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                    <CheckCircle2 size={14} />
                    O'qilgan
                  </span>
                ) : (
                  <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-medium text-white">Yangi</span>
                )}
              </CardTitle>
              <CardContent className="space-y-2 text-sm">
                {!isDuplicateNotificationText(item.title, item.message || item.body) ? <p>{item.message || item.body}</p> : null}
                <p className="text-xs text-muted-foreground">{formatCreatedAt(item.created_at)}</p>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}
