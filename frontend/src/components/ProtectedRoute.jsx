import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { LoadingState } from "../components/LoadingState";
import { useSettingsStore } from "../store/settingsStore";
import { useI18n } from "../hooks/useI18n";

export function ProtectedRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const initialized = useSettingsStore((state) => state.initialized);
  const { t } = useI18n();

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session || initialized) return;
    loadSettings().catch(() => {
      // Keep app accessible even if settings fetch fails.
    });
  }, [session, initialized, loadSettings]);

  if (loading) return <LoadingState label={t("loadingDefault")} />;
  if (!session) return <Navigate to="/login" replace />;

  return children;
}
