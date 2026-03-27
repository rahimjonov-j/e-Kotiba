import { create } from "zustand";

export const useUiStore = create((set) => ({
  theme: localStorage.getItem("kotiba-theme") || "light",
  setTheme: (theme) => {
    localStorage.setItem("kotiba-theme", theme);
    set({ theme });
  },
}));