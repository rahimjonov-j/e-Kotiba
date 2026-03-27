import { useState } from "react";
import { useClients, useCreateClient } from "../hooks/useApi";
import { Card, CardContent, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Button } from "../components/ui/button";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { useI18n } from "../hooks/useI18n";

export function ClientsPage() {
  const [form, setForm] = useState({ name: "", phone: "", email: "", telegram_chat_id: "", notes: "" });
  const { t } = useI18n();

  const clientsQuery = useClients();
  const createClient = useCreateClient();

  const onSubmit = (e) => {
    e.preventDefault();
    createClient.mutate(form, {
      onSuccess: () => setForm({ name: "", phone: "", email: "", telegram_chat_id: "", notes: "" }),
    });
  };

  if (clientsQuery.isLoading) return <LoadingState label={t("clients_loading")} />;
  if (clientsQuery.isError) return <ErrorState message={clientsQuery.error.message} />;

  return (
    <div className="space-y-4 pb-20 md:pb-4">
      <h1 className="text-xl font-semibold">{t("clients_title")}</h1>
      <Card>
        <CardTitle>{t("clients_addTitle")}</CardTitle>
        <CardContent>
          <form className="space-y-2" onSubmit={onSubmit}>
            <Input placeholder={t("clients_name")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Input placeholder={t("clients_phone")} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input type="email" placeholder={t("clients_email")} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input placeholder={t("clients_telegramChatId")} value={form.telegram_chat_id} onChange={(e) => setForm({ ...form, telegram_chat_id: e.target.value })} />
            <Textarea placeholder={t("clients_notes")} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <Button type="submit" disabled={createClient.isPending}>{createClient.isPending ? t("clients_saving") : t("clients_save")}</Button>
          </form>
        </CardContent>
      </Card>

      {(clientsQuery.data?.items || []).map((client) => (
        <Card key={client.id}>
          <CardTitle>{client.name}</CardTitle>
          <CardContent className="text-sm text-muted-foreground">
            <p>{client.phone || t("clients_noPhone")}</p>
            <p>{client.email || t("clients_noEmail")}</p>
            <p>{client.telegram_chat_id || t("clients_noTelegram")}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}