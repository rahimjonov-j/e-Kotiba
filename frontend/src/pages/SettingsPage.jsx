import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardTitle } from "../components/ui/card";
import { Select } from "../components/ui/select";
import { Button } from "../components/ui/button";
import { useI18n } from "../hooks/useI18n";
import { useSettings, useUpdateSettings } from "../hooks/useApi";
import { useSettingsStore } from "../store/settingsStore";
import { useUiStore } from "../store/uiStore";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { getTimezoneList } from "../lib/timezones";
import { useAuthStore } from "../store/authStore";
import { useNavigate } from "react-router-dom";

const allowedUnits = ["minute", "hour", "day", "week", "custom"];
const allowedIntervals = ["1min", "5min", "15min", "1hour"];
const allowedChannels = ["in_app"];
const allowedLanguages = ["uz", "en", "ru"];
const allowedTimezones = getTimezoneList();
const verifiedVoiceOptions = [
  { value: "lola", label: "Lola" },
  { value: "shoira", label: "Shoira" },
  { value: "Fotima-angry", label: "Fotima-angry" },
];

export function SettingsPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const globalSettings = useSettingsStore((state) => state.settings);
  const setSettings = useSettingsStore((state) => state.setSettings);
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);
  const logout = useAuthStore((state) => state.logout);

  const settingsQuery = useSettings();
  const updateMutation = useUpdateSettings();

  const [form, setForm] = useState(globalSettings);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (settingsQuery.data?.settings) {
      setSettings(settingsQuery.data.settings);
      setForm(settingsQuery.data.settings);
    }
  }, [settingsQuery.data, setSettings]);

  const isValid = useMemo(
    () =>
      allowedUnits.includes(form.default_reminder_unit) &&
      allowedIntervals.includes(form.reminder_interval || "1min") &&
      allowedChannels.includes(form.preferred_channel) &&
      allowedLanguages.includes(form.language) &&
      allowedTimezones.includes(form.timezone) &&
      verifiedVoiceOptions.some((voice) => voice.value === form.tts_voice),
    [form]
  );

  const save = async () => {
    setMessage("");

    if (!isValid) {
      setMessage(t("settings_saveError"));
      return;
    }

    try {
      const data = await updateMutation.mutateAsync({ ...form, theme });
      setLanguage(data.settings.language);
      setTheme(data.settings.theme || theme);
      setMessage(t("settings_saved"));
    } catch {
      setMessage(t("settings_saveError"));
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  if (settingsQuery.isLoading) return <LoadingState label={t("settings_loading")} />;
  if (settingsQuery.isError) return <ErrorState message={t("settings_loadError")} />;

  return (
    <div className="space-y-4 pb-20 md:pb-4">
      <h1 className="text-xl font-semibold">{t("settings_title")}</h1>
      <Card className="rounded-2xl">
        <CardTitle>{t("settings_preferences")}</CardTitle>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{t("settings_theme")}</p>
            <Select value={theme} onChange={(e) => setTheme(e.target.value)}>
              <option value="light">{t("settings_themeLight")}</option>
              <option value="dark">{t("settings_themeDark")}</option>
              <option value="system">System</option>
            </Select>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{t("settings_voice")}</p>
            <Select
              value={form.tts_voice || "lola"}
              onChange={(e) => setForm({ ...form, tts_voice: e.target.value })}
              disabled={updateMutation.isPending}
            >
              {verifiedVoiceOptions.map((voice) => (
                <option key={voice.value} value={voice.value}>
                  {voice.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{t("settings_defaultUnit")}</p>
            <Select
              value={form.default_reminder_unit}
              onChange={(e) => setForm({ ...form, default_reminder_unit: e.target.value })}
              disabled={updateMutation.isPending}
            >
              <option value="minute">{t("common_minute")}</option>
              <option value="hour">{t("common_hour")}</option>
              <option value="day">{t("common_day")}</option>
              <option value="week">{t("common_week")}</option>
              <option value="custom">{t("common_custom")}</option>
            </Select>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Bildirishnoma Vaqti (Har safar)</p>
            <Select
              value={form.reminder_interval || "1min"}
              onChange={(e) => setForm({ ...form, reminder_interval: e.target.value })}
              disabled={updateMutation.isPending}
            >
              <option value="1min">Har daqiqa</option>
              <option value="5min">Har 5 daqiqa</option>
              <option value="15min">Har 15 daqiqa</option>
              <option value="1hour">Har 1 soat</option>
            </Select>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{t("settings_channel")}</p>
            <Select
              value={form.preferred_channel}
              onChange={(e) => setForm({ ...form, preferred_channel: e.target.value })}
              disabled={updateMutation.isPending}
            >
              <option value="in_app">{t("channel_in_app")}</option>
            </Select>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{t("settings_language")}</p>
            <Select
              value={form.language}
              onChange={(e) => {
                setForm({ ...form, language: e.target.value });
                setLanguage(e.target.value);
              }}
              disabled={updateMutation.isPending}
            >
              <option value="uz">{t("lang_uz")}</option>
              <option value="en">{t("lang_en")}</option>
              <option value="ru">{t("lang_ru")}</option>
            </Select>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{t("settings_timezone")}</p>
            <Select
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              disabled={updateMutation.isPending}
            >
              {allowedTimezones.map((zone) => (
                <option key={zone} value={zone}>{zone}</option>
              ))}
            </Select>
          </div>

          <Button onClick={save} disabled={updateMutation.isPending || !isValid}>
            {updateMutation.isPending ? t("settings_saving") : t("settings_save")}
          </Button>
          <Button onClick={handleLogout} variant="outline">
            Logout
          </Button>

          {message && <p className="text-sm text-emerald-600">{message}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
