import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoadingState } from "./components/LoadingState";

const DashboardPage = lazy(() => import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const SecretaryPage = lazy(() => import("./pages/SecretaryPage").then((module) => ({ default: module.SecretaryPage })));
const RemindersPage = lazy(() => import("./pages/RemindersPage").then((module) => ({ default: module.RemindersPage })));
const MeetingsPage = lazy(() => import("./pages/MeetingsPage").then((module) => ({ default: module.MeetingsPage })));
const ClientsPage = lazy(() => import("./pages/ClientsPage").then((module) => ({ default: module.ClientsPage })));
const ExpensesPage = lazy(() => import("./pages/ExpensesPage").then((module) => ({ default: module.ExpensesPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((module) => ({ default: module.SettingsPage })));
const AdminPage = lazy(() => import("./pages/AdminPage").then((module) => ({ default: module.AdminPage })));
const LoginPage = lazy(() => import("./pages/LoginPage").then((module) => ({ default: module.LoginPage })));
const SignUpPage = lazy(() => import("./pages/SignUpPage").then((module) => ({ default: module.SignUpPage })));

function ProtectedShell({ children }) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="mx-auto max-w-7xl p-4"><LoadingState label="Sahifa yuklanmoqda..." /></div>}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
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
      </Suspense>
    </BrowserRouter>
  );
}
