import { useI18n } from "../hooks/useI18n";

export function ErrorState({ message }) {
  const { t } = useI18n();
  return <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{message || t("errorDefault")}</div>;
}