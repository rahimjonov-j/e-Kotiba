import { create } from "zustand";
import { api } from "../api/client";
import { getLocalTimezone } from "../lib/timezones";
import { useUiStore } from "./uiStore";

const DEFAULT_SETTINGS = {
  default_reminder_unit: "hour",
  reminder_interval: "1min",
  preferred_channel: "in_app",
  language: "uz",
  timezone: getLocalTimezone(),
  theme: "light",
  audio_enabled: true,
  monthly_salary: 0,
  tts_voice: "lola",
  welcome_seen: false,
};

const STORAGE_KEY = "kotiba-language";

export const useSettingsStore = create((set, get) => ({
  settings: {
    ...DEFAULT_SETTINGS,
    language: localStorage.getItem(STORAGE_KEY) || DEFAULT_SETTINGS.language,
  },
  language: localStorage.getItem(STORAGE_KEY) || DEFAULT_SETTINGS.language,
  initialized: false,

  setLanguage: (language) => {
    localStorage.setItem(STORAGE_KEY, language);
    set((state) => ({
      language,
      settings: { ...state.settings, language },
    }));
  },

  setSettings: (settings) => {
    const merged = { ...DEFAULT_SETTINGS, ...(settings || {}) };
    localStorage.setItem(STORAGE_KEY, merged.language);
    useUiStore.getState().setTheme(merged.theme || "light");
    set({ settings: merged, language: merged.language, initialized: true });
  },

  loadSettings: async () => {
    const data = await api.getSettings();
    get().setSettings(data.settings);
    return data.settings;
  },
}));

export { DEFAULT_SETTINGS };
