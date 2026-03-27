import { Card, CardContent, CardTitle } from "../components/ui/card";
import { useAdminOverview } from "../hooks/useApi";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { useI18n } from "../hooks/useI18n";

export function AdminPage() {
  const { t } = useI18n();
  const { data, isLoading, isError, error } = useAdminOverview();
  const overview = data || {};
  const isForbidden = String(error?.message || "").toLowerCase().includes("forbidden");

  if (isLoading) return <LoadingState label={t("admin_loading")} />;
  if (isError && isForbidden) {
    return (
      <div className="space-y-4 pb-20 md:pb-4">
        <h1 className="text-xl font-semibold">{t("admin_title")}</h1>
        <ErrorState message="Sizda admin bo'limiga kirish huquqi yo'q." />
      </div>
    );
  }
  if (isError) return <ErrorState message={error.message} />;

  return (
    <div className="space-y-4 pb-20 md:pb-4">
      <h1 className="text-xl font-semibold">{t("admin_title")}</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardTitle>{t("admin_users")}</CardTitle><CardContent>{overview?.users?.length || 0}</CardContent></Card>
        <Card><CardTitle>{t("admin_failedJobs")}</CardTitle><CardContent>{overview?.failed_jobs?.length || 0}</CardContent></Card>
        <Card><CardTitle>{t("admin_aiUsageEvents")}</CardTitle><CardContent>{overview?.ai_usage_stats?.secretary_events || 0}</CardContent></Card>
        <Card><CardTitle>{t("admin_remindersTracked")}</CardTitle><CardContent>{overview?.reminders_monitoring?.length || 0}</CardContent></Card>
      </div>

      <Card>
        <CardTitle>{t("admin_latestJobs")}</CardTitle>
        <CardContent className="space-y-2 text-sm">
          {(overview?.system_logs || []).slice(0, 10).map((job) => (
            <div key={job.id} className="rounded-md border border-border p-2">
              {job.job_type} • {job.status} • {new Date(job.scheduled_for).toLocaleString()}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
