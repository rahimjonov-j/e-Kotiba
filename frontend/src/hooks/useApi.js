import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useSettingsStore } from "../store/settingsStore";

export const useDashboard = () => useQuery({ queryKey: ["dashboard"], queryFn: api.getDashboard });

export const useReminders = () => useQuery({ queryKey: ["reminders"], queryFn: api.listReminders });

export const useCreateReminder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createReminder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
};

export const useProcessSecretary = () => useMutation({ mutationFn: api.processSecretary });
export const useTranscribeSecretary = () => useMutation({ mutationFn: api.transcribeSecretary });

export const useClients = () => useQuery({ queryKey: ["clients"], queryFn: api.listClients });
export const useProfile = () => useQuery({ queryKey: ["profile"], queryFn: api.getProfile, staleTime: 5 * 60 * 1000 });

export const useCreateClient = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createClient,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients"] }),
  });
};

export const useMeetings = () => useQuery({ queryKey: ["meetings"], queryFn: api.listMeetings });

export const useCreateMeeting = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createMeeting,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
};

export const useUpdateMeeting = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => api.updateMeeting(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
};

export const useDeleteMeeting = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.deleteMeeting(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
};

export const useExpenses = () => useQuery({ queryKey: ["expenses"], queryFn: api.listExpenses });

export const useCreateExpense = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
};

export const useNotifications = () =>
  useQuery({
    queryKey: ["notifications"],
    queryFn: api.listNotifications,
    refetchInterval: 60000,
  });

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
};

export const useAdminOverview = () =>
  useQuery({
    queryKey: ["admin"],
    queryFn: api.getAdminOverview,
    retry: (failureCount, error) => {
      const message = String(error?.message || "").toLowerCase();
      if (message.includes("forbidden")) return false;
      return failureCount < 2;
    },
  });

export const useSettings = () => {
  return useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
    staleTime: 5 * 60 * 1000,
  });
};

export const useUpdateSettings = () => {
  const queryClient = useQueryClient();
  const setSettings = useSettingsStore((state) => state.setSettings);

  return useMutation({
    mutationFn: api.updateSettings,
    onSuccess: (data) => {
      setSettings(data.settings);
      queryClient.setQueryData(["settings"], data);
    },
  });
};
