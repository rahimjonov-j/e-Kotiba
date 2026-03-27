import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { useI18n } from "../hooks/useI18n";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { t } = useI18n();
  const navigate = useNavigate();

  const signIn = async (e) => {
    e.preventDefault();
    setError("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      return;
    }

    if (data?.session) {
      navigate("/", { replace: true });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardTitle>{t("login_signIn")}</CardTitle>
        <CardContent>
          <form onSubmit={signIn} className="space-y-2">
            <Input type="email" placeholder={t("clients_email")} value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input type="password" placeholder={t("login_password")} value={password} onChange={(e) => setPassword(e.target.value)} required />
            <Button type="submit" className="w-full">{t("login_signIn")}</Button>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
