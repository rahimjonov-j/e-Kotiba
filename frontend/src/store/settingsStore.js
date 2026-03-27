import { create } from "zustand";
import { api } from "../api/client";
import { getLocalTimezone } from "../lib/timezones";

const DEFAULT_SETTINGS = {
  default_reminder_unit: "hour",
  reminder_interval: "1min",
  preferred_channel: "in_app",
  language: "uz",
  timezone: getLocalTimezone(),
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
    set({ settings: merged, language: merged.language, initialized: true });
  },

  loadSettings: async () => {
    const data = await api.getSettings();
    get().setSettings(data.settings);
    return data.settings;
  },
}));

export { DEFAULT_SETTINGS };
