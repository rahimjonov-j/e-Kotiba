import { create } from "zustand";
import { api } from "../api/client";
import { clearStoredAuthToken, setStoredAuthToken } from "../lib/session";
import { unregisterPushSubscription } from "../lib/pwa";

const getWelcomeKey = (userId) => `kotiba-welcome-shown:${userId}`;

export const useAuthStore = create((set, get) => ({
  user: null,
  initialized: false,
  loading: false,

  setUser: (user) => set({ user, initialized: true, loading: false }),

  restoreSession: async () => {
    if (get().loading) return get().user;
    set({ loading: true });
    try {
      const data = await api.getSession();
      set({ user: data.profile, initialized: true, loading: false });
      return data.profile;
    } catch {
      clearStoredAuthToken();
      set({ user: null, initialized: true, loading: false });
      return null;
    }
  },

  login: async (payload) => {
    set({ loading: true });
    try {
      const data = await api.login(payload);
      setStoredAuthToken(data.session?.token);
      set({ user: data.profile, initialized: true, loading: false });
      return data;
    } catch (error) {
      clearStoredAuthToken();
      set({ loading: false, initialized: true });
      throw error;
    }
  },

  signUp: async (payload) => {
    set({ loading: true });
    try {
      const data = await api.signUp(payload);
      setStoredAuthToken(data.session?.token);
      set({ user: data.profile, initialized: true, loading: false });
      return data;
    } catch (error) {
      clearStoredAuthToken();
      set({ loading: false, initialized: true });
      throw error;
    }
  },

  logout: async () => {
    set({ loading: true });
    const currentUser = get().user;
    try {
      try {
        await unregisterPushSubscription();
      } catch {
        // push cleanup should not block logout
      }
      await api.logout();
    } finally {
      clearStoredAuthToken();
      if (currentUser?.id) {
        localStorage.removeItem(getWelcomeKey(currentUser.id));
      }
      set({ user: null, initialized: true, loading: false });
    }
  },
}));
