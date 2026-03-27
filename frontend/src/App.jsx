import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { DashboardPage } from "./pages/DashboardPage";
import { SecretaryPage } from "./pages/SecretaryPage";
import { RemindersPage } from "./pages/RemindersPage";
import { MeetingsPage } from "./pages/MeetingsPage";
import { ClientsPage } from "./pages/ClientsPage";
import { ExpensesPage } from "./pages/ExpensesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AdminPage } from "./pages/AdminPage";
import { LoginPage } from "./pages/LoginPage";

function ProtectedShell({ children }) {
  // Login flow bypassed temporarily
  return (
    <AppLayout>{children}</AppLayout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/" element={<ProtectedShell><SecretaryPage /></ProtectedShell>} />
        <Route path="/dashboard" element={<ProtectedShell><DashboardPage /></ProtectedShell>} />
        <Route path="/reminders" element={<ProtectedShell><RemindersPage /></ProtectedShell>} />
        <Route path="/meetings" element={<ProtectedShell><MeetingsPage /></ProtectedShell>} />
        <Route path="/clients" element={<ProtectedShell><ClientsPage /></ProtectedShell>} />
        <Route path="/expenses" element={<ProtectedShell><ExpensesPage /></ProtectedShell>} />
        <Route path="/settings" element={<ProtectedShell><SettingsPage /></ProtectedShell>} />
        <Route path="/admin" element={<ProtectedShell><AdminPage /></ProtectedShell>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}