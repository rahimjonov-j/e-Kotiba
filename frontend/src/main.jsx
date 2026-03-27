import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./styles/globals.css";
import { useUiStore } from "./store/uiStore";
import { useSettingsStore } from "./store/settingsStore";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

const ThemeSync = ({ children }) => {
  const theme = useUiStore((state) => state.theme);
  const language = useSettingsStore((state) => state.language);

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  React.useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return children;
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <QueryClientProvider client={queryClient}>
    <ThemeSync>
      <div className="app-phone-shell">
        <App />
      </div>
    </ThemeSync>
  </QueryClientProvider>
);
