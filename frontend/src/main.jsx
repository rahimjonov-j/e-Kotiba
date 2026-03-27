import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./styles/globals.css";
import { useUiStore } from "./store/uiStore";
import { useSettingsStore } from "./store/settingsStore";

const queryClient = new QueryClient();

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
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeSync>
        <App />
      </ThemeSync>
    </QueryClientProvider>
  </React.StrictMode>
);
