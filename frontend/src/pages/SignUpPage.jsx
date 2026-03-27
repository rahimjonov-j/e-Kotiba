import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { useAuthStore } from "../store/authStore";

export function SignUpPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const initialized = useAuthStore((state) => state.initialized);
  const signUp = useAuthStore((state) => state.signUp);
  const loading = useAuthStore((state) => state.loading);
  const restoreSession = useAuthStore((state) => state.restoreSession);

  const [form, setForm] = useState({ name: "", password: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!initialized) {
      restoreSession();
    }
  }, [initialized, restoreSession]);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    try {
      await signUp(form);
      navigate("/", { replace: true });
    } catch (submitError) {
      setError(submitError.message || "Ro'yxatdan o'tishda xatolik yuz berdi.");
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[radial-gradient(circle_at_top,#d8f4ed,transparent_45%),#f5f7fb] px-4 md:min-h-[calc(100vh-32px)]">
      <Card className="w-full max-w-md rounded-[28px] border-white/70 bg-white/95 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur">
        <CardTitle className="text-center text-2xl font-semibold text-slate-900">Akkaunt yaratish</CardTitle>
        <CardContent className="space-y-5">
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              type="text"
              placeholder="Ism"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              required
            />
            <Input
              type="password"
              placeholder="Parol"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              required
            />
            <Button type="submit" className="h-11 w-full rounded-xl" disabled={loading}>
              {loading ? "Yaratilmoqda..." : "Ro'yxatdan o'tish"}
            </Button>
          </form>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <p className="text-center text-sm text-slate-500">
            Akkauntingiz bormi?{" "}
            <Link to="/login" className="font-medium text-[#149B7A]">
              Kirish
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
