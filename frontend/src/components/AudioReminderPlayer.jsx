import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { useMarkNotificationRead, useNotifications } from "../hooks/useApi";

export function AudioReminderPlayer() {
  const { data } = useNotifications();
  const markRead = useMarkNotificationRead();
  const audioRef = useRef(null);
  const playedRef = useRef(new Set());
  const [blockedNotification, setBlockedNotification] = useState(null);
  const playNotificationSound = async () => {
    try {
      const audio = new Audio('/notification.mp3');
      await audio.play();
    } catch {
      return Promise.reject(new Error("notification sound failed"));
    }
  };

  useEffect(() => {
    const items = data?.items || [];
    const candidate = items.find((item) => !item.is_read && !playedRef.current.has(item.id));
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

        playedRef.current.add(candidate.id);
        // User strictly requested NOT to mark as read automatically here
      } catch {
        setBlockedNotification(candidate);
      }
    };

    playAudio();
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

      playedRef.current.add(blockedNotification.id);
      // Removed markRead.mutateAsync to ensure notifications remain unread
      setBlockedNotification(null);
    } catch {
      // keep button visible
    }
  };

  if (!blockedNotification) return null;

  return (
    <div className="fixed bottom-16 right-3 z-40 w-[min(340px,calc(100%-1.5rem))] rounded-xl border border-border bg-card p-3 shadow-soft md:bottom-4">
      <p className="text-sm font-medium">Audio reminder available</p>
      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{blockedNotification.message}</p>
      <Button className="mt-2 w-full" onClick={handleManualPlay}>Play reminder</Button>
    </div>
  );
}
