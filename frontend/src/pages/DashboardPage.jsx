import { Bell, CheckCircle2, Clock3, PieChart, Sparkles, Wallet } from "lucide-react";
import { Card, CardContent, CardTitle } from "../components/ui/card";
import { useDashboard } from "../hooks/useApi";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";

const formatCurrency = (value) => `${Number(value || 0).toLocaleString("uz-UZ")} UZS`;

const StatCard = ({ title, value, icon: Icon, colorClass, subtitle }) => (
  <Card className="rounded-[20px] border-0 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.04)] transition-all">
    <CardContent className="p-5 flex items-center gap-4">
      <div className={`p-3 rounded-2xl ${colorClass} bg-opacity-10`}>
        <Icon className={`${colorClass.replace("bg-", "text-")} w-6 h-6`} />
      </div>
      <div>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{title}</p>
        <p className="text-xl font-bold text-slate-800 mt-0.5">{value}</p>
        {subtitle ? <p className="text-[10px] text-slate-500 mt-1 font-medium">{subtitle}</p> : null}
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
    <Card className="rounded-[24px] border-0 bg-white shadow-[0_14px_30px_rgba(15,23,42,0.06)] relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <Sparkles size={48} className="text-teal-500" />
      </div>
      <CardTitle className="px-5 pt-5 text-base font-bold text-slate-800 flex items-center gap-2">
        <div className="p-1.5 bg-teal-50 rounded-lg">
          <Sparkles size={16} className="text-[#149B7A]" />
        </div>
        AI tavsiyalar
      </CardTitle>
      <CardContent className="p-5 space-y-3">
        {list.map((item, idx) => (
          <div key={idx} className="flex items-start gap-3 bg-teal-50/40 p-3 rounded-2xl border border-teal-100/50">
            <div className="mt-1 h-1.5 w-1.5 rounded-full bg-[#149B7A] shrink-0" />
            <p className="text-sm text-slate-700 leading-relaxed font-medium">{item}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

const ExpenseBreakdown = ({ summary }) => {
  const categories = Object.entries(summary.by_category || {});
  const total = summary.total || 1;
  const palette = {
    transport: { bg: "bg-orange-500", text: "text-orange-600" },
    office: { bg: "bg-teal-500", text: "text-teal-600" },
    communication: { bg: "bg-blue-500", text: "text-blue-600" },
    other: { bg: "bg-slate-400", text: "text-slate-500" },
  };

  return (
    <Card className="rounded-[24px] border-0 bg-white shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
      <CardTitle className="px-5 pt-5 text-base font-bold text-slate-800 flex items-center gap-2">
        <div className="p-1.5 bg-orange-50 rounded-lg">
          <PieChart size={16} className="text-orange-600" />
        </div>
        Xarajatlar tahlili
      </CardTitle>
      <CardContent className="p-5 space-y-4">
        <p className="text-2xl font-bold text-slate-900 mb-2">{formatCurrency(summary.total)}</p>
        <div className="space-y-4">
          {categories.length > 0 ? categories.map(([cat, val]) => {
            const pct = (val / total) * 100;
            const style = palette[cat.toLowerCase()] || palette.other;
            return (
              <div key={cat} className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="capitalize text-slate-600">{cat}</span>
                  <span className={style.text}>{formatCurrency(val)} ({pct.toFixed(0)}%)</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${style.bg} rounded-full`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          }) : <p className="text-sm text-slate-500 italic">Hali xarajatlar kiritilmagan</p>}
        </div>
      </CardContent>
    </Card>
  );
};

export function DashboardPage() {
  const { data, isLoading, isError, error } = useDashboard();
  const dashboard = data || {};

  if (isLoading) return <LoadingState label="Dashboard yuklanmoqda..." />;
  if (isError) return <ErrorState message={error.message} />;

  const summary = dashboard.expenses_summary || { total: 0, by_category: {} };
  const upcoming = dashboard.upcoming_reminders?.length || 0;
  const completed = dashboard.completed_reminders?.length || 0;
  const overdue = dashboard.overdue_reminders?.length || 0;

  return (
    <div className="space-y-5 pb-20 md:pb-4 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Statistika</h1>
        <p className="text-sm text-slate-500 font-medium">Reminder holatlari va xarajatlar</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Upcoming" value={upcoming} icon={Clock3} colorClass="bg-blue-500" subtitle="Yaqin eslatmalar" />
        <StatCard title="Completed" value={completed} icon={CheckCircle2} colorClass="bg-emerald-500" subtitle="Bajarilganlar" />
        <StatCard title="Overdue" value={overdue} icon={Bell} colorClass="bg-amber-500" subtitle="Kechikkanlar" />
        <StatCard title="Umumiy Xarajat" value={formatCurrency(summary.total)} icon={Wallet} colorClass="bg-red-500" subtitle={`${summary.count || 0} ta yozuv`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-5">
        <RecommendationCard recommendations={dashboard.recommendations} />
        <ExpenseBreakdown summary={summary} />
      </div>
    </div>
  );
}
