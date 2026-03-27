import { useEffect, useMemo, useState } from "react";
import { useClients, useCreateMeeting, useDeleteMeeting, useMeetings, useUpdateMeeting } from "../hooks/useApi";
import { Card, CardContent, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Button } from "../components/ui/button";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";
import { useI18n } from "../hooks/useI18n";
import { useSettingsStore } from "../store/settingsStore";

const toLocalDateTimeValue = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (v) => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function MeetingsPage() {
  const settings = useSettingsStore((state) => state.settings);
  const [title, setTitle] = useState("");
  const [meetingDatetime, setMeetingDatetime] = useState("");
  const [clientId, setClientId] = useState("");
  const [reminderInterval, setReminderInterval] = useState(settings?.reminder_interval || "1min");
  const [enableAudioReminder, setEnableAudioReminder] = useState(false);

  const [editingMeetingId, setEditingMeetingId] = useState(null);
  const [rescheduleValue, setRescheduleValue] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [deletingMeetingId, setDeletingMeetingId] = useState(null);
  const { t } = useI18n();

  const meetingsQuery = useMeetings();
  const clientsQuery = useClients();
  const createMeeting = useCreateMeeting();
  const updateMeeting = useUpdateMeeting();
  const deleteMeeting = useDeleteMeeting();

  const meetings = useMemo(() => meetingsQuery.data?.items || [], [meetingsQuery.data]);
  const scheduledMeetings = useMemo(
    () => meetings.filter((meeting) => (meeting.status || "scheduled") !== "cancelled"),
    [meetings]
  );
  const cancelledMeetings = useMemo(
    () => meetings.filter((meeting) => (meeting.status || "scheduled") === "cancelled"),
    [meetings]
  );

  useEffect(() => {
    if (settings?.reminder_interval) {
      setReminderInterval(settings.reminder_interval);
    }
  }, [settings?.reminder_interval]);

  useEffect(() => {
    if (!actionMessage) return;
    const timer = setTimeout(() => setActionMessage(""), 1500);
    return () => clearTimeout(timer);
  }, [actionMessage]);

  const onSubmit = (e) => {
    e.preventDefault();
    createMeeting.mutate(
      {
        title,
        meeting_datetime: new Date(meetingDatetime).toISOString(),
        client_id: clientId,
        auto_message_enabled: true,
        reminder_interval: enableAudioReminder ? reminderInterval : null,
        enable_audio_reminder: enableAudioReminder,
      },
      {
        onSuccess: () => {
          setTitle("");
          setMeetingDatetime("");
          setClientId("");
          setEnableAudioReminder(false);
          setReminderInterval("1min");
          setActionMessage("Uchrashuv yaratildi.");
        },
        onError: (err) => setActionMessage(err.message),
      }
    );
  };

  const startReschedule = (meeting) => {
    setEditingMeetingId(meeting.id);
    setRescheduleValue(toLocalDateTimeValue(meeting.meeting_datetime));
    setActionMessage("");
  };

  const saveReschedule = (meetingId) => {
    if (!rescheduleValue) return;

    updateMeeting.mutate(
      {
        id: meetingId,
        payload: { meeting_datetime: new Date(rescheduleValue).toISOString() },
      },
      {
        onSuccess: () => {
          setEditingMeetingId(null);
          setRescheduleValue("");
          setActionMessage("Uchrashuv vaqti yangilandi.");
        },
        onError: (err) => setActionMessage(err.message),
      }
    );
  };

  const cancelMeeting = (meeting) => {
    setDeletingMeetingId(meeting.id);
    deleteMeeting.mutate(meeting.id, {
      onSuccess: () => {
        setActionMessage("Uchrashuv bekor qilindi.");
      },
      onError: (err) => setActionMessage(err.message),
      onSettled: () => setDeletingMeetingId(null),
    });
  };

  if (meetingsQuery.isLoading || clientsQuery.isLoading) return <LoadingState label={t("meetings_loading")} />;
  if (meetingsQuery.isError) return <ErrorState message={meetingsQuery.error.message} />;

  return (
    <div className="space-y-4 pb-20 md:pb-4">
      <h1 className="text-xl font-semibold">{t("meetings_title")}</h1>

      <Card className="rounded-2xl">
        <CardTitle>{t("meetings_createTitle")}</CardTitle>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-2">
            <Input placeholder={t("meetings_titlePlaceholder")} value={title} onChange={(e) => setTitle(e.target.value)} required />
            <Input type="datetime-local" value={meetingDatetime} onChange={(e) => setMeetingDatetime(e.target.value)} required />
            <Select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
              <option value="">{t("meetings_selectClient")}</option>
              {(clientsQuery.data?.items || []).map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </Select>

            <label className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm">
              <input type="checkbox" checked={enableAudioReminder} onChange={(e) => setEnableAudioReminder(e.target.checked)} />
              Audio reminder yoqilsin
            </label>

            <Select value={reminderInterval} onChange={(e) => setReminderInterval(e.target.value)} disabled={!enableAudioReminder}>
              <option value="1min">Har 1 daqiqa</option>
              <option value="5min">Har 5 daqiqa</option>
              <option value="10min">Har 10 daqiqa</option>
            </Select>

            <Button type="submit" disabled={createMeeting.isPending}>
              {createMeeting.isPending ? t("meetings_creating") : t("meetings_create")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardTitle>{t("meetings_scheduledTitle")}</CardTitle>
        <CardContent className="space-y-2">
          {actionMessage && <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{actionMessage}</p>}
          {scheduledMeetings.length === 0 && <EmptyState label={t("meetings_empty")} />}
          {scheduledMeetings.map((meeting) => {
            const isEditing = editingMeetingId === meeting.id;
            return (
              <div key={meeting.id} className="rounded-xl border border-border/70 bg-background p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold">{meeting.title}</p>
                  <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] text-primary">{t("meetings_scheduledBadge")}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{new Date(meeting.meeting_datetime).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{t("meetings_clientLabel")}: {meeting.clients?.name || t("meetings_unknownClient")}</p>
                {meeting.enable_audio_reminder && (
                  <p className="mt-1 text-xs text-emerald-600">Audio reminder: {meeting.reminder_interval || "1min"}</p>
                )}

                {isEditing ? (
                  <div className="mt-3 space-y-2">
                    <Input type="datetime-local" value={rescheduleValue} onChange={(e) => setRescheduleValue(e.target.value)} />
                    <div className="flex gap-2">
                      <Button className="flex-1" onClick={() => saveReschedule(meeting.id)} disabled={updateMeeting.isPending || !rescheduleValue}>
                        {updateMeeting.isPending ? "Saqlanmoqda..." : "Saqlash"}
                      </Button>
                      <Button variant="outline" className="flex-1" onClick={() => setEditingMeetingId(null)}>
                        Bekor
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => startReschedule(meeting)}>
                      Ko'chirish
                    </Button>
                    <Button
                      variant="danger"
                      className="flex-1"
                      onClick={() => cancelMeeting(meeting)}
                      disabled={deletingMeetingId === meeting.id}
                    >
                      {deletingMeetingId === meeting.id ? "Bekor qilinmoqda..." : "Uchrashuvni bekor qilish"}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardTitle>Bekor qilingan uchrashuvlar</CardTitle>
        <CardContent className="space-y-2">
          {cancelledMeetings.length === 0 && <EmptyState label="Hali bekor qilingan uchrashuv yo'q." />}
          {cancelledMeetings.map((meeting) => (
            <div key={meeting.id} className="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm dark:border-red-900 dark:bg-red-950/40">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold">{meeting.title}</p>
                <span className="rounded-full bg-red-100 px-2 py-1 text-[11px] text-red-700 dark:bg-red-900/40 dark:text-red-300">
                  Bekor qilingan
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{new Date(meeting.meeting_datetime).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Mijoz: {meeting.clients?.name || t("meetings_unknownClient")}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
