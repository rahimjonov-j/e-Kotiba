import { api } from "../api/client";

const PUSH_PERMISSION_KEY = "kotiba-push-permission-requested";
const INSTALL_PROMPT_DISMISS_KEY = "kotiba-install-dismissed-at";
const INSTALL_PROMPT_TTL_MS = 24 * 60 * 60 * 1000;

let registrationPromise = null;

export const isStandaloneMode = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true);

export const isIosDevice = () =>
  typeof window !== "undefined" &&
  /iphone|ipad|ipod/i.test(window.navigator.userAgent || "");

export const wasInstallPromptDismissedRecently = () => {
  if (typeof window === "undefined") return false;
  const raw = localStorage.getItem(INSTALL_PROMPT_DISMISS_KEY);
  const ts = Number(raw || 0);
  return Number.isFinite(ts) && ts > 0 && Date.now() - ts < INSTALL_PROMPT_TTL_MS;
};

export const dismissInstallPrompt = () => {
  if (typeof window === "undefined") return;
  localStorage.setItem(INSTALL_PROMPT_DISMISS_KEY, String(Date.now()));
};

export const registerAppServiceWorker = async () => {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  if (!registrationPromise) {
    registrationPromise = navigator.serviceWorker.register("/sw.js");
  }
  return registrationPromise;
};

const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
};

export const ensurePushSubscription = async ({ forcePermission = false } = {}) => {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return { enabled: false, reason: "unsupported" };
  }

  let permission = Notification.permission;
  if (permission === "default" && (forcePermission || !localStorage.getItem(PUSH_PERMISSION_KEY))) {
    localStorage.setItem(PUSH_PERMISSION_KEY, "1");
    permission = await Notification.requestPermission();
  }

  if (permission !== "granted") {
    return { enabled: false, reason: permission };
  }

  const registration = await registerAppServiceWorker();
  if (!registration) return { enabled: false, reason: "unavailable" };

  const { publicKey, enabled } = await api.getPushPublicKey();
  if (!enabled || !publicKey) {
    return { enabled: false, reason: "disabled" };
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  await api.subscribePush(subscription.toJSON());
  return { enabled: true, subscription };
};

export const unregisterPushSubscription = async () => {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const registration = await registerAppServiceWorker();
  if (!registration) return;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  try {
    await api.unsubscribePush({ endpoint: subscription.endpoint });
  } catch {
    // continue cleanup locally even if server call fails
  }

  try {
    await subscription.unsubscribe();
  } catch {
    // ignore browser unsubscribe failures
  }
};
