import { useMemo } from "react";
import { Bell, ChevronRight, Clock3, MapPin, MoveRight, User2, Wallet, Calendar, PieChart, Sparkles } from "lucide-react";
import { Card, CardContent, CardTitle } from "../components/ui/card";
import { useDashboard } from "../hooks/useApi";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";

const formatCurrency = (value) => `${Number(value || 0).toLocaleString("uz-UZ")} UZS`;

const StatCard = ({ title, value, icon: Icon, colorClass, subtitle }) => (
  <Card className="rounded-[20px] border-0 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.04)] dark:bg-slate-800 transition-all hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
    <CardContent className="p-5 flex items-center gap-4">
      <div className={`p-3 rounded-2xl ${colorClass} bg-opacity-10`}>
        <Icon className={`${colorClass.replace('bg-', 'text-')} w-6 h-6`} />
      </div>
      <div>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{title}</p>
        <p className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-0.5">{value}</p>
        {subtitle && <p className="text-[10px] text-slate-500 mt-1 font-medium">{subtitle}</p>}
      </div>
    </CardContent>
  </Card>
);

const RecommendationCard = ({ recommendations }) => {
  let list = [];
  try {
    const parsed = typeof recommendations === 'string' ? JSON.parse(recommendations) : recommendations;
    list = parsed.recommendations || [];
  } catch (e) {
    list = typeof recommendations === 'string' && recommendations !== "AI recommendations are currently unavailable." 
      ? [recommendations] 
      : ["Ma'lumotlar yetarli bo'lganda bu yerda maslahatlar paydo bo'ladi."];
  }

  return (
    <Card className="rounded-[24px] border-0 bg-white shadow-[0_14px_30px_rgba(15,23,42,0.06)] dark:bg-slate-800 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <Sparkles size={48} className="text-teal-500" />
      </div>
      <CardTitle className="px-5 pt-5 text-base font-bold text-slate-800 flex items-center gap-2">
        <div className="p-1.5 bg-teal-50 rounded-lg">
          <Sparkles size={16} className="text-[#149B7A]" />
        </div>
        Asalxon Maslahatlari
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
    other: { bg: "bg-slate-400", text: "text-slate-500" }
  };

  return (
    <Card className="rounded-[24px] border-0 bg-white shadow-[0_14px_30px_rgba(15,23,42,0.06)] dark:bg-slate-800">
      <CardTitle className="px-5 pt-5 text-base font-bold text-slate-800 flex items-center gap-2">
        <div className="p-1.5 bg-orange-50 rounded-lg">
          <PieChart size={16} className="text-orange-600" />
        </div>
        Xarajatlar Tahliili
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
          }) : (
             <p className="text-sm text-slate-500 italic">Hali xarajatlar kiritilmagan</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export function DashboardPage() {
  const { data, isLoading, isError, error } = useDashboard();
  const dashboard = data || {};

  const todayCount = dashboard.today_reminders?.length || 0;
  const missedCount = dashboard.missed_reminders?.length || 0;
  const activeCount = dashboard.active_reminders_count || 0;
  const upcomingMeetings = dashboard.upcoming_meetings || [];
  const upcomingCount = upcomingMeetings.length;
  const summary = dashboard.expenses_summary || { total: 0, by_category: {} };

  if (isLoading) return <LoadingState label="Dashboard yuklanmoqda..." />;
  if (isError) return <ErrorState message={error.message} />;

  return (
    <div className="space-y-5 pb-20 md:pb-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Statistika</h1>
          <p className="text-sm text-slate-500 font-medium">Bugun: {new Date().toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long' })}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard 
          title="Umumiy Xarajat" 
          value={formatCurrency(summary.total)} 
          icon={Wallet} 
          colorClass="bg-red-500" 
          subtitle={`${summary.count || 0} ta o'tkazma`}
        />
        <StatCard 
          title="Uchrashuvlar" 
          value={upcomingCount} 
          icon={Calendar} 
          colorClass="bg-[#22c55e]" 
          subtitle="Yaqin orada"
        />
        <StatCard 
          title="Faol Vazifalar" 
          value={activeCount} 
          icon={Bell} 
          colorClass="bg-blue-500" 
          subtitle={`${todayCount} ta bugun`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-5">
        <div className="space-y-5">
           <RecommendationCard recommendations={dashboard.recommendations} />
           
           <Card className="rounded-[24px] border-0 bg-white shadow-[0_14px_30px_rgba(15,23,42,0.06)] dark:bg-slate-800">
            <CardTitle className="px-5 pt-5 text-base font-bold text-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 rounded-lg">
                  <Clock3 size={16} className="text-blue-600" />
                </div>
                Keyingi Uchrashuvlar
              </div>
              {upcomingCount > 3 && (
                <span className="text-xs text-primary font-semibold hover:underline cursor-pointer">Barchasi</span>
              )}
            </CardTitle>
            <CardContent className="p-5 space-y-4">
              {upcomingMeetings.length > 0 ? upcomingMeetings.slice(0, 3).map((meeting) => (
                <div key={meeting.id} className="group flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:border-teal-100 hover:bg-teal-50/30 transition-all cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center justify-center h-12 w-12 rounded-2xl bg-slate-50 group-hover:bg-white border border-slate-100">
                       <span className="text-[10px] font-bold text-slate-400 uppercase">{new Date(meeting.meeting_datetime).toLocaleDateString('uz', { month: 'short' })}</span>
                       <span className="text-lg font-bold text-slate-800 leading-none">{new Date(meeting.meeting_datetime).getDate()}</span>
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm group-hover:text-[#149B7A] transition-colors">{meeting.title}</p>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 font-medium">
                        <span className="flex items-center gap-1"><Clock3 size={12} /> {new Date(meeting.meeting_datetime).toLocaleTimeString('uz', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="flex items-center gap-1"><User2 size={12} /> {meeting.clients?.name || 'Noma\'lum'}</span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-300 group-hover:text-[#149B7A] group-hover:translate-x-1 transition-all" />
                </div>
              )) : (
                <div className="py-8 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                  <Calendar size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-sm text-slate-500 font-medium">Yaqin orada uchrashuvlar yo'q</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <ExpenseBreakdown summary={summary} />
      </div>
    </div>
  );
}
