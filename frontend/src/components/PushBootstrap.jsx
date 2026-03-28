import { useEffect } from "react";
import { useAuthStore } from "../store/authStore";
import { ensurePushSubscription, registerAppServiceWorker } from "../lib/pwa";

export function PushBootstrap() {
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    registerAppServiceWorker().catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return undefined;

    let cancelled = false;

    const setupPush = async (forcePermission = false) => {
      try {
        if (cancelled) return;
        await ensurePushSubscription({ forcePermission });
      } catch {
        // push setup should never break app flow
      }
    };

    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      setupPush(false);
      return undefined;
    }

    const onFirstInteraction = () => {
      setupPush(true);
    };

    const onVisibilityReturn = () => {
      if (document.visibilityState === "visible" && Notification.permission === "granted") {
        setupPush(false);
      }
    };

    window.addEventListener("pointerdown", onFirstInteraction, { once: true });
    document.addEventListener("visibilitychange", onVisibilityReturn);
    return () => {
      cancelled = true;
      window.removeEventListener("pointerdown", onFirstInteraction);
      document.removeEventListener("visibilitychange", onVisibilityReturn);
    };
  }, [user?.id]);

  return null;
}
