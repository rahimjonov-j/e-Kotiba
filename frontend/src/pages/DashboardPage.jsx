import { Bell, CheckCircle2, Clock3, PieChart, Sparkles, TrendingUp, Wallet } from "lucide-react";
import { Card, CardContent, CardTitle } from "../components/ui/card";
import { useDashboard } from "../hooks/useApi";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";

const formatCurrency = (value) => `${Number(value || 0).toLocaleString("uz-UZ")} UZS`;
const CATEGORY_COLORS = ["#f97316", "#14b8a6", "#3b82f6", "#8b5cf6", "#e11d48", "#f59e0b"];

const buildExpenseSegments = (summary) => {
  const entries = Object.entries(summary.by_category || {})
    .filter(([, value]) => Number(value) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]));

  const total = Number(summary.total) || entries.reduce((sum, [, value]) => sum + Number(value || 0), 0);

  return entries.map(([name, value], index) => {
    const numericValue = Number(value || 0);
    const percent = total > 0 ? (numericValue / total) * 100 : 0;
    return {
      name,
      value: numericValue,
      percent,
      color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
    };
  });
};

const buildConicGradient = (segments) => {
  if (!segments.length) {
    return "conic-gradient(#e2e8f0 0deg 360deg)";
  }

  let offset = 0;
  const stops = segments.map((segment) => {
    const start = offset;
    const end = offset + segment.percent * 3.6;
    offset = end;
    return `${segment.color} ${start}deg ${end}deg`;
  });

  return `conic-gradient(${stops.join(", ")})`;
};

const StatCard = ({ title, value, icon: Icon, colorClass, subtitle }) => (
  <Card className="rounded-[24px] border-0 bg-white shadow-[0_12px_28px_rgba(15,23,42,0.05)] transition-all">
    <CardContent className="p-4">
      <div className="space-y-4">
        <div className={`inline-flex rounded-2xl p-3 ${colorClass} bg-opacity-10`}>
          <Icon className={`${colorClass.replace("bg-", "text-")} h-5 w-5`} />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">{title}</p>
          <p className="break-words text-2xl font-bold leading-tight text-slate-900">{value}</p>
          {subtitle ? <p className="text-xs font-medium leading-snug text-slate-500">{subtitle}</p> : null}
        </div>
      </div>
    </CardContent>
  </Card>
);

const RecommendationCard = ({ recommendations }) => {
  let list = [];

  if (Array.isArray(recommendations)) {
    list = recommendations;
  } else if (typeof recommendations === "string") {
    const lines = recommendations
      .split("\n")
      .map((line) => line.replace(/^[-*\d.\s]+/, "").trim())
      .filter(Boolean);
    list = lines.length > 0 ? lines : [recommendations];
  }

  if (list.length === 0) {
    list = ["Ma'lumotlar yetarli bo'lganda bu yerda maslahatlar paydo bo'ladi."];
  }

  return (
    <Card className="relative overflow-hidden rounded-[24px] border-0 bg-white shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
      <div className="absolute right-0 top-0 p-4 opacity-10">
        <Sparkles size={52} className="text-teal-500" />
      </div>
      <CardTitle className="flex items-center gap-2 px-5 pt-5 text-base font-bold text-slate-800">
        <div className="rounded-lg bg-teal-50 p-1.5">
          <Sparkles size={16} className="text-[#149B7A]" />
        </div>
        AI tavsiyalar
      </CardTitle>
      <CardContent className="space-y-3 p-5">
        {list.map((item, idx) => (
          <div key={idx} className="rounded-[20px] border border-slate-100 bg-slate-50/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-[#149B7A]">
                {String(idx + 1).padStart(2, "0")}
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Insight</p>
                <p className="text-sm font-medium leading-relaxed text-slate-700">{item}</p>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

const ExpenseSummaryStrip = ({ summary }) => {
  const count = summary.count || 0;

  return (
    <Card className="rounded-[24px] border-0 bg-white shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Expense pulse</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{formatCurrency(summary.total)}</p>
          <p className="mt-1 text-xs font-medium text-slate-500">{count} ta xarajat yozuvi</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
          <TrendingUp size={20} />
        </div>
      </CardContent>
    </Card>
  );
};

const ExpenseBreakdown = ({ summary }) => {
  const segments = buildExpenseSegments(summary);
  const gradient = buildConicGradient(segments);

  return (
    <Card className="rounded-[24px] border-0 bg-white shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
      <CardTitle className="flex items-center gap-2 px-5 pt-5 text-base font-bold text-slate-800">
        <div className="rounded-lg bg-orange-50 p-1.5">
          <PieChart size={16} className="text-orange-600" />
        </div>
        Xarajatlar tahlili
      </CardTitle>
      <CardContent className="p-5">
        {segments.length > 0 ? (
          <div className="space-y-5">
            <div className="rounded-[24px] bg-[radial-gradient(circle_at_top,#fff7ed,transparent_58%),linear-gradient(180deg,#ffffff,#fffaf5)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
              <div
                className="relative mx-auto flex aspect-square w-full max-w-[160px] shrink-0 items-center justify-center rounded-full sm:max-w-[180px]"
                style={{ background: gradient }}
              >
                <div className="absolute inset-[10%] rounded-full bg-white/18 blur-xl" />
                <div className="relative flex h-[86px] w-[86px] flex-col items-center justify-center rounded-full border border-white/70 bg-white shadow-[0_14px_30px_rgba(15,23,42,0.08)] sm:h-[100px] sm:w-[100px]">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Jami</span>
                  <span className="mt-1 text-center text-sm font-bold leading-tight text-slate-900 sm:text-base">{formatCurrency(summary.total)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {segments.map((segment) => (
                <div key={segment.name} className="rounded-[18px] border border-slate-100 bg-slate-50/80 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2">
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold leading-snug text-slate-700">{segment.name}</p>
                        <p className="mt-1 text-xs font-medium text-slate-500">{formatCurrency(segment.value)}</p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-500 shadow-sm">
                      {segment.percent.toFixed(0)}%
                    </span>
                  </div>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${segment.percent}%`, backgroundColor: segment.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50/70 p-5 text-center text-sm font-medium text-slate-500">
            Hali xarajatlar kiritilmagan
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export function DashboardPage() {
  const { data, isLoading, isError, error } = useDashboard();
  const dashboard = data || {};

  if (isLoading) return <LoadingState label="Dashboard yuklanmoqda..." />;
  if (isError) return <ErrorState message={error.message} />;

  const summary = dashboard.expenses_summary || { total: 0, by_category: {}, count: 0 };
  const upcoming = dashboard.upcoming_reminders?.length || 0;
  const completed = dashboard.completed_reminders?.length || 0;
  const overdue = dashboard.overdue_reminders?.length || 0;

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-20 md:pb-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Statistika</h1>
        <p className="text-sm font-medium text-slate-500">Reminder holatlari va xarajatlar</p>
      </div>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
        <StatCard title="Upcoming" value={upcoming} icon={Clock3} colorClass="bg-blue-500" subtitle="Yaqin eslatmalar" />
        <StatCard title="Completed" value={completed} icon={CheckCircle2} colorClass="bg-emerald-500" subtitle="Bajarilganlar" />
        <StatCard title="Overdue" value={overdue} icon={Bell} colorClass="bg-amber-500" subtitle="Kechikkanlar" />
        <StatCard title="Umumiy Xarajat" value={formatCurrency(summary.total)} icon={Wallet} colorClass="bg-red-500" subtitle={`${summary.count || 0} ta yozuv`} />
      </div>

      <ExpenseSummaryStrip summary={summary} />

      <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
        <ExpenseBreakdown summary={summary} />
        <RecommendationCard recommendations={dashboard.recommendations} />
      </div>
    </div>
  );
}
