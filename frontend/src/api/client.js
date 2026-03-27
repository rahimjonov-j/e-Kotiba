import { supabase } from "../lib/supabase";

const normalizeApiBaseUrl = (rawValue) => {
  const value = String(rawValue || "").trim().replace(/\/$/, "");
  if (!value) return "";
  if (/\/api$/i.test(value)) return value;
  return `${value}/api`;
};

const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

const request = async (path, options = {}) => {
  if (!API_BASE_URL) {
    throw new Error("VITE_API_BASE_URL is not configured. Set it to your Render backend URL.");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(options.headers || {}),
    },
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Invalid server response.");
  }

  if (!response.ok || !payload.success) {
    throw new Error(payload.message || "Request failed");
  }

  return payload.data;
};

export const api = {
  health: () => request("/health", { method: "GET" }),
  getProfile: () => request("/auth/me", { method: "GET" }),
  getSettings: () => request("/auth/settings", { method: "GET" }),
  updateSettings: (settings) => request("/auth/settings", { method: "PATCH", body: JSON.stringify(settings) }),
  processSecretary: (payload) => request("/secretary/process", { method: "POST", body: JSON.stringify(payload) }),
  transcribeSecretary: (payload) => request("/secretary/transcribe", { method: "POST", body: JSON.stringify(payload) }),
  listReminders: () => request("/reminders?page=1&limit=50", { method: "GET" }),
  createReminder: (payload) => request("/reminders", { method: "POST", body: JSON.stringify(payload) }),
  listMeetings: () => request("/meetings?page=1&limit=50", { method: "GET" }),
  createMeeting: (payload) => request("/meetings", { method: "POST", body: JSON.stringify(payload) }),
  updateMeeting: (id, payload) => request(`/meetings/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteMeeting: (id) => request(`/meetings/${id}`, { method: "DELETE" }),
  listClients: () => request("/clients", { method: "GET" }),
  createClient: (payload) => request("/clients", { method: "POST", body: JSON.stringify(payload) }),
  listExpenses: () => request("/expenses", { method: "GET" }),
  createExpense: (payload) => request("/expenses", { method: "POST", body: JSON.stringify(payload) }),
  listNotifications: () => request("/notifications", { method: "GET" }),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: "PATCH" }),
  getDashboard: () => request("/dashboard", { method: "GET" }),
  getAdminOverview: () => request("/admin/overview", { method: "GET" }),
};
