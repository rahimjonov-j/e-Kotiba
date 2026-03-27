import { useI18n } from "../hooks/useI18n";

export function EmptyState({ label }) {
  const { t } = useI18n();
  return <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">{label || t("emptyDefault")}</div>;
}