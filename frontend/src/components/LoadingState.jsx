import { useI18n } from "../hooks/useI18n";

export function LoadingState({ label }) {
  const { t } = useI18n();
  return <div className="animate-pulse rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">{label || t("loadingDefault")}</div>;
}