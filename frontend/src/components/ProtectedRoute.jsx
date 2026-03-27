import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { LoadingState } from "../components/LoadingState";
import { useSettingsStore } from "../store/settingsStore";
import { useI18n } from "../hooks/useI18n";
import { useAuthStore } from "../store/authStore";

export function ProtectedRoute({ children }) {
  const user = useAuthStore((state) => state.user);
  const initialized = useAuthStore((state) => state.initialized);
  const loading = useAuthStore((state) => state.loading);
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const settingsInitialized = useSettingsStore((state) => state.initialized);
  const { t } = useI18n();

  useEffect(() => {
    if (!initialized) {
      restoreSession();
    }
  }, [initialized, restoreSession]);

  useEffect(() => {
    if (!user || settingsInitialized) return;
    loadSettings().catch(() => {
      // Keep protected shell accessible even if settings request fails.
    });
  }, [user, settingsInitialized, loadSettings]);

  if (!initialized || loading) {
    return <LoadingState label={t("loadingDefault")} />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

