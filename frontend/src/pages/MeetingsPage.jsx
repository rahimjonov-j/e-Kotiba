import { useEffect, useMemo, useState } from "react";
import { CalendarCheck2, Clock3, RotateCcw, XCircle } from "lucide-react";
import { useDeleteMeeting, useMeetings, useUpdateMeeting } from "../hooks/useApi";
import { Card, CardContent, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";
import { useI18n } from "../hooks/useI18n";

const toLocalDateTimeValue = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (value) => String(value).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const splitMeetingDateTime = (iso) => {
  const date = new Date(iso);
  const pad = (value) => String(value).padStart(2, "0");

  return {
    date: `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    day: date.toLocaleDateString("uz-UZ", { weekday: "long" }),
  };
};

function SectionHeader({ title, count, tone = "teal" }) {
  const badgeClasses =
    tone === "rose"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <CardTitle className="text-base text-slate-900 break-words">{title}</CardTitle>
        <p className="mt-1 text-sm text-slate-500">{count > 0 ? `${count} ta uchrashuv` : "Hozircha yozuv yo'q"}</p>
      </div>
      <span
        className={`inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full border px-2.5 text-sm font-semibold ${badgeClasses}`}
      >
        {count}
      </span>
    </div>
  );
}

function MeetingDateBlock({ label, value, helper, icon: Icon, tone = "slate" }) {
  const toneClasses =
    tone === "rose"
      ? "border-rose-100 bg-white/75 text-rose-300"
      : "border-slate-100 bg-slate-50/90 text-slate-400";

  return (
    <div className={`rounded-2xl border px-3 py-3 ${toneClasses}`}>
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em]">
        {Icon ? <Icon size={13} /> : null}
        {label}
      </div>
      <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
      <p className="mt-1 text-xs capitalize text-slate-500">{helper}</p>
    </div>
  );
}

export function MeetingsPage() {
  const { t } = useI18n();
  const [editingMeetingId, setEditingMeetingId] = useState(null);
  const [rescheduleValue, setRescheduleValue] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [deletingMeetingId, setDeletingMeetingId] = useState(null);

  const meetingsQuery = useMeetings();
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
    if (!actionMessage) return undefined;
    const timer = setTimeout(() => setActionMessage(""), 1500);
    return () => clearTimeout(timer);
  }, [actionMessage]);

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
        onError: (error) => setActionMessage(error.message),
      }
    );
  };

  const cancelMeeting = (meeting) => {
    setDeletingMeetingId(meeting.id);
    deleteMeeting.mutate(meeting.id, {
      onSuccess: () => setActionMessage("Uchrashuv bekor qilindi."),
      onError: (error) => setActionMessage(error.message),
      onSettled: () => setDeletingMeetingId(null),
    });
  };

  if (meetingsQuery.isLoading) return <LoadingState label={t("meetings_loading")} />;
  if (meetingsQuery.isError) return <ErrorState message={meetingsQuery.error.message} />;

  return (
    <div className="space-y-5 pb-20 md:pb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-slate-950">{t("meetings_title")}</h1>
          <p className="mt-1 max-w-[22rem] text-sm leading-6 text-slate-500">
            Kotiba orqali yaratilgan uchrashuvlar shu yerda jamlanadi.
          </p>
        </div>
        <div className="shrink-0 rounded-[24px] border border-white/70 bg-white/85 px-3 py-2 text-center shadow-[0_12px_30px_rgba(15,23,42,0.06)] sm:px-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Faol</p>
          <p className="text-xl font-semibold leading-none text-slate-900">{scheduledMeetings.length}</p>
        </div>
      </div>

      <Card className="rounded-[30px] border border-white/80 bg-white/95 shadow-[0_24px_50px_rgba(15,23,42,0.07)]">
        <SectionHeader title={t("meetings_scheduledTitle")} count={scheduledMeetings.length} />
        <CardContent className="space-y-3">
          {actionMessage ? (
            <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 shadow-[0_8px_20px_rgba(16,185,129,0.08)]">
              {actionMessage}
            </p>
          ) : null}

          {scheduledMeetings.length === 0 ? <EmptyState label={t("meetings_empty")} /> : null}

          {scheduledMeetings.map((meeting) => {
            const isEditing = editingMeetingId === meeting.id;
            const dateTime = splitMeetingDateTime(meeting.meeting_datetime);

            return (
              <div
                key={meeting.id}
                className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(248,250,252,0.96)_100%)] shadow-[0_18px_38px_rgba(15,23,42,0.08)]"
              >
                <div className="h-1.5 bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-400" />
                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                        <CalendarCheck2 size={20} />
                      </div>
                      <div className="min-w-0">
                        <p className="break-words text-base font-semibold leading-6 text-slate-900">{meeting.title}</p>
                        <div className="mt-1 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          Rejalashtirilgan uchrashuv
                        </div>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full border border-teal-100 bg-teal-50 px-2.5 py-1 text-[10px] font-semibold text-teal-700 shadow-[0_4px_14px_rgba(20,184,166,0.12)] sm:px-3 sm:text-[11px]">
                      {t("meetings_scheduledBadge")}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <MeetingDateBlock label="Sana" value={dateTime.date} helper={dateTime.day} />
                    <MeetingDateBlock label="Vaqt" value={dateTime.time} helper="Aniq vaqt" icon={Clock3} />
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-100 bg-white/80 px-3 py-3">
                    <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">Holat</p>
                    <p className="mt-1 text-sm font-medium text-slate-700">
                      Uchrashuv reja bo'yicha kutilyapti. Vaqtni o'zgartirish yoki bekor qilish mumkin.
                    </p>
                  </div>

                  {isEditing ? (
                    <div className="mt-4 space-y-3 rounded-[24px] border border-emerald-100 bg-emerald-50/60 p-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                        <RotateCcw size={16} />
                        Yangi vaqtni tanlang
                      </div>
                      <Input
                        type="datetime-local"
                        value={rescheduleValue}
                        onChange={(e) => setRescheduleValue(e.target.value)}
                        className="h-11 rounded-2xl border-white bg-white"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          className="h-10 rounded-2xl"
                          onClick={() => saveReschedule(meeting.id)}
                          disabled={updateMeeting.isPending || !rescheduleValue}
                        >
                          {updateMeeting.isPending ? "Saqlanmoqda..." : "Saqlash"}
                        </Button>
                        <Button variant="outline" className="h-10 rounded-2xl" onClick={() => setEditingMeetingId(null)}>
                          Bekor
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Button
                        variant="outline"
                        className="h-10 gap-2 rounded-2xl border-slate-200 bg-white text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.04)]"
                        onClick={() => startReschedule(meeting)}
                      >
                        <RotateCcw size={15} />
                        Ko'chirish
                      </Button>
                      <Button
                        variant="danger"
                        className="h-10 gap-2 rounded-2xl shadow-[0_10px_24px_rgba(220,38,38,0.18)]"
                        onClick={() => cancelMeeting(meeting)}
                        disabled={deletingMeetingId === meeting.id}
                      >
                        <XCircle size={15} />
                        {deletingMeetingId === meeting.id ? "Bekor qilinmoqda..." : "Bekor qilish"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="rounded-[30px] border border-white/80 bg-white/95 shadow-[0_24px_50px_rgba(15,23,42,0.07)]">
        <SectionHeader title="Bekor qilingan uchrashuvlar" count={cancelledMeetings.length} tone="rose" />
        <CardContent className="space-y-3">
          {cancelledMeetings.length === 0 ? <EmptyState label="Hali bekor qilingan uchrashuv yo'q." /> : null}

          {cancelledMeetings.map((meeting) => {
            const dateTime = splitMeetingDateTime(meeting.meeting_datetime);

            return (
              <div
                key={meeting.id}
                className="overflow-hidden rounded-[28px] border border-rose-200/80 bg-[linear-gradient(180deg,rgba(255,250,250,1)_0%,rgba(255,241,242,0.94)_100%)] shadow-[0_16px_32px_rgba(244,63,94,0.10)]"
              >
                <div className="h-1.5 bg-gradient-to-r from-rose-300 via-rose-400 to-red-400" />
                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-rose-500 shadow-sm">
                        <XCircle size={20} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-slate-900">{meeting.title}</p>
                        <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.16em] text-rose-300">Bekor qilingan yozuv</p>
                      </div>
                    </div>
                    <span className="inline-flex shrink-0 items-center rounded-full border border-rose-200 bg-rose-100 px-2.5 py-1 text-[10px] font-semibold leading-none text-rose-700 sm:px-3 sm:text-[11px]">
                      Bekor qilingan
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <MeetingDateBlock label="Sana" value={dateTime.date} helper={dateTime.day} tone="rose" />
                    <MeetingDateBlock label="Vaqt" value={dateTime.time} helper="Bekor qilingan vaqt" icon={Clock3} tone="rose" />
                  </div>

                  <div className="mt-4 rounded-2xl border border-rose-100 bg-white/70 px-3 py-3 text-sm text-slate-600">
                    Bu uchrashuv faol ro'yxatdan olib tashlangan va faqat tarix sifatida saqlanadi.
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
