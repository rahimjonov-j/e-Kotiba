import { useEffect, useMemo, useState } from "react";
import { Download, Share2, Smartphone, X } from "lucide-react";
import { Button } from "./ui/button";
import { dismissInstallPrompt, isIosDevice, isStandaloneMode, wasInstallPromptDismissedRecently } from "../lib/pwa";

export function InstallAppPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);

  const iosManualInstall = useMemo(() => isIosDevice() && !isStandaloneMode(), []);

  useEffect(() => {
    if (isStandaloneMode() || wasInstallPromptDismissedRecently()) return undefined;

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    if (iosManualInstall) {
      setVisible(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, [iosManualInstall]);

  const handleClose = () => {
    dismissInstallPrompt();
    setVisible(false);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return handleClose();
    deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => null);
    setDeferredPrompt(null);
    setVisible(false);
  };

  if (!visible || isStandaloneMode()) return null;

  return (
    <div className="fixed inset-x-0 top-4 z-50 mx-auto w-[min(360px,calc(100%-1.5rem))] rounded-[28px] border border-white/70 bg-white/96 p-4 shadow-[0_22px_60px_rgba(15,23,42,0.16)] backdrop-blur">
      <button
        type="button"
        onClick={handleClose}
        className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        aria-label="Yopish"
      >
        <X size={16} />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-[#149B7A]">
          <Smartphone size={20} />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-900">Ilovani yuklab oling</p>
          <p className="text-xs leading-relaxed text-slate-500">
            Online Kotiba’ni telefoningizga o‘rnating va bildirishnomalarni ilova ko‘rinishida oling.
          </p>
        </div>
      </div>

      {deferredPrompt ? (
        <div className="mt-4 flex gap-2">
          <Button type="button" className="h-10 flex-1 rounded-2xl" onClick={handleInstall}>
            <Download size={16} className="mr-2" />
            Yuklab olish
          </Button>
          <Button type="button" variant="outline" className="h-10 rounded-2xl" onClick={handleClose}>
            Keyinroq
          </Button>
        </div>
      ) : iosManualInstall ? (
        <div className="mt-4 rounded-2xl bg-slate-50 px-3 py-3 text-xs leading-relaxed text-slate-600">
          Safari’da <span className="inline-flex items-center gap-1 font-semibold text-slate-800"><Share2 size={14} /> Share</span> ni bosing, keyin
          {" "} <span className="font-semibold text-slate-800">Add to Home Screen</span> tanlang.
        </div>
      ) : null}
    </div>
  );
}
