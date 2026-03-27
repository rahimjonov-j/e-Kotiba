import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { useNotifications } from "../hooks/useApi";

const BROWSER_NOTIFICATION_KEY = "kotiba-browser-notifications";
const PLAYED_AUDIO_KEY = "kotiba-played-notification-audio";

const canUseBrowserNotifications = () =>
  typeof window !== "undefined" && "Notification" in window;

const getStoredShownIds = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(BROWSER_NOTIFICATION_KEY) || "[]"));
  } catch {
    return new Set();
  }
};

const persistShownIds = (ids) => {
  localStorage.setItem(BROWSER_NOTIFICATION_KEY, JSON.stringify(Array.from(ids)));
};

const getStoredPlayedIds = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(PLAYED_AUDIO_KEY) || "[]"));
  } catch {
    return new Set();
  }
};

const persistPlayedIds = (ids) => {
  localStorage.setItem(PLAYED_AUDIO_KEY, JSON.stringify(Array.from(ids)));
};

const normalizeNotificationText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

export function AudioReminderPlayer() {
  const { data } = useNotifications();
  const audioRef = useRef(null);
  const playedAudioRef = useRef(getStoredPlayedIds());
  const shownNotificationRef = useRef(getStoredShownIds());
  const [blockedNotification, setBlockedNotification] = useState(null);

  const playNotificationSound = async () => {
    const audio = new Audio("/notification.mp3");
    await audio.play();
  };

  useEffect(() => {
    if (!canUseBrowserNotifications()) return undefined;

    const requestPermission = () => {
      if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    };

    window.addEventListener("pointerdown", requestPermission, { once: true });
    return () => window.removeEventListener("pointerdown", requestPermission);
  }, []);

  useEffect(() => {
    const items = data?.items || [];
    const candidate = items.find((item) => !item.is_read && !playedAudioRef.current.has(item.id));
    if (!candidate) return;

    const playAudio = async () => {
      try {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }

        if (candidate.audio_url) {
          const audio = new Audio(candidate.audio_url);
          audioRef.current = audio;
          await audio.play();
        } else {
          await playNotificationSound();
        }

        playedAudioRef.current.add(candidate.id);
        persistPlayedIds(playedAudioRef.current);
      } catch {
        setBlockedNotification(candidate);
      }
    };

    playAudio();
  }, [data]);

  useEffect(() => {
    if (!canUseBrowserNotifications()) return;

    const items = data?.items || [];
    const candidate = items.find((item) => !item.is_read && !shownNotificationRef.current.has(item.id));
    if (!candidate) return;

    const shouldShowBrowserNotification =
      Notification.permission === "granted" &&
      (document.visibilityState !== "visible" || !document.hasFocus());

    if (!shouldShowBrowserNotification) return;

    const title = candidate.title || "Yangi eslatma";
    const body = candidate.message || candidate.body || "Sizda yangi bildirishnoma bor.";
    const normalizedTitle = normalizeNotificationText(title);
    const normalizedBody = normalizeNotificationText(body);

    const notification = new Notification(title, {
      body: normalizedTitle && normalizedTitle === normalizedBody ? "Sizda yangi bildirishnoma bor." : body,
      tag: `kotiba-${candidate.id}`,
      renotify: false,
    });

    notification.onclick = () => {
      window.focus();
      window.location.href = "/reminders";
      notification.close();
    };

    shownNotificationRef.current.add(candidate.id);
    persistShownIds(shownNotificationRef.current);
  }, [data]);

  const handleManualPlay = async () => {
    if (!blockedNotification) return;

    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      if (blockedNotification.audio_url) {
        const audio = new Audio(blockedNotification.audio_url);
        audioRef.current = audio;
        await audio.play();
      } else {
        await playNotificationSound();
      }

      playedAudioRef.current.add(blockedNotification.id);
      persistPlayedIds(playedAudioRef.current);
      setBlockedNotification(null);
    } catch {
      // keep button visible
    }
  };

  if (!blockedNotification) return null;

  return (
    <div className="fixed bottom-16 left-1/2 z-40 w-[min(340px,calc(100%-1.5rem))] -translate-x-1/2 rounded-xl border border-border bg-card p-3 shadow-soft">
      <p className="text-sm font-medium">Ovozli eslatma tayyor</p>
      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{blockedNotification.message}</p>
      <Button className="mt-2 w-full" onClick={handleManualPlay}>Ovozni chalish</Button>
    </div>
  );
}
