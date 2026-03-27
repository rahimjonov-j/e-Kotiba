import { useMemo, useState } from "react";
import { Card, CardContent, CardTitle } from "../components/ui/card";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";
import { useExpenses, useSettings } from "../hooks/useApi";
import { useI18n } from "../hooks/useI18n";

const formatMoney = (value) => `${Number(value || 0).toLocaleString("uz-UZ")} UZS`;
const formatOriginalMoney = (amount, currency) => `${Number(amount || 0).toLocaleString("uz-UZ")} ${currency || "UZS"}`;

const palette = [
  { bg: "bg-emerald-500", light: "bg-emerald-100", text: "text-emerald-700", color: "#10b981" },
  { bg: "bg-sky-500", light: "bg-sky-100", text: "text-sky-700", color: "#0ea5e9" },
  { bg: "bg-amber-500", light: "bg-amber-100", text: "text-amber-700", color: "#f59e0b" },
  { bg: "bg-rose-500", light: "bg-rose-100", text: "text-rose-700", color: "#f43f5e" },
  { bg: "bg-violet-500", light: "bg-violet-100", text: "text-violet-700", color: "#8b5cf6" },
  { bg: "bg-fuchsia-500", light: "bg-fuchsia-100", text: "text-fuchsia-700", color: "#d946ef" },
  { bg: "bg-red-400", light: "bg-red-100", text: "text-red-700", color: "#f87171" },
];

const periodOptions = [
  { value: "daily", label: "Kunlik" },
  { value: "weekly", label: "Haftalik" },
  { value: "monthly", label: "Oylik" },
];

const parseExpenseDate = (value) => new Date(`${value}T12:00:00`);

const getPeriodMeta = (period) => {
  const now = new Date();

  if (period === "daily") {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return {
      title: "Oxirgi 7 kun",
      start,
      summaryLabel: "Kunlik o'rtacha xarajat",
      divisor: 7,
      summaryType: "average",
    };
  }

  if (period === "weekly") {
    const start = new Date(now);
    start.setDate(now.getDate() - 27);
    start.setHours(0, 0, 0, 0);
    return {
      title: "Oxirgi 4 hafta",
      start,
      summaryLabel: "Haftalik o'rtacha xarajat",
      divisor: 4,
      summaryType: "average",
    };
  }

  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    title: "Joriy oy",
    start,
    summaryLabel: "Oylik jami xarajat",
    divisor: 1,
    summaryType: "total",
  };
};

const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

const describeSlice = (centerX, centerY, radius, startAngle, endAngle) => {
  const start = polarToCartesian(centerX, centerY, radius, endAngle);
  const end = polarToCartesian(centerX, centerY, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    `M ${centerX} ${centerY}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
};

const ExpensePieChart = ({ items, total }) => {
  const radius = 96;
  const center = 120;
  let currentAngle = 0;

  return (
    <div className="grid items-center gap-6 md:grid-cols-[240px_1fr]">
      <div className="mx-auto w-full max-w-[240px]">
        <svg viewBox="0 0 240 240" className="h-[240px] w-[240px] drop-shadow-[0_10px_20px_rgba(15,23,42,0.08)]">
          {items.map((item, index) => {
            const angle = total > 0 ? (item.amount / total) * 360 : 0;
            const startAngle = currentAngle;
            const endAngle = currentAngle + angle;
            currentAngle = endAngle;

            const midAngle = startAngle + angle / 2;
            const labelPosition = polarToCartesian(center, center, radius * 0.56, midAngle);
            const percent = total > 0 ? Math.round((item.amount / total) * 100) : 0;

            return (
              <g key={item.category}>
                <path
                  d={describeSlice(center, center, radius, startAngle, endAngle)}
                  fill={item.style.color}
                  stroke="#ffffff"
                  strokeWidth="2"
                />
                {percent >= 4 ? (
                  <text
                    x={labelPosition.x}
                    y={labelPosition.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-white text-[12px] font-semibold"
                  >
                    {percent}%
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="space-y-3">
        {items.map((item) => {
          const percent = total > 0 ? Math.round((item.amount / total) * 100) : 0;
          return (
            <div key={item.category} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50/90 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="h-3.5 w-3.5 rounded-sm" style={{ backgroundColor: item.style.color }} />
                <span className="truncate text-sm font-medium text-slate-700">{item.category}</span>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${item.style.text}`}>{percent}%</p>
                <p className="text-xs text-slate-500">{formatMoney(item.amount)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export function ExpensesPage() {
  const { t } = useI18n();
  const expensesQuery = useExpenses();
  const settingsQuery = useSettings();
  const [period, setPeriod] = useState("daily");

  const expenses = expensesQuery.data?.items || [];
  const savedSalary = Number(settingsQuery.data?.settings?.monthly_salary || 0);

  const periodMeta = useMemo(() => getPeriodMeta(period), [period]);
  const filteredExpenses = useMemo(
    () => expenses.filter((item) => parseExpenseDate(item.date) >= periodMeta.start),
    [expenses, periodMeta.start]
  );
  const total = useMemo(
    () => filteredExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [filteredExpenses]
  );
  const summaryAmount = periodMeta.summaryType === "average" ? total / periodMeta.divisor : total;

  const byCategory = useMemo(
    () =>
      Object.entries(
        filteredExpenses.reduce((acc, item) => {
          const key = item.category || "Boshqa";
          acc[key] = (acc[key] || 0) + Number(item.amount || 0);
          return acc;
        }, {})
      )
        .sort((a, b) => b[1] - a[1])
        .map(([category, amount], index) => ({
          category,
          amount,
          style: palette[index % palette.length],
        })),
    [filteredExpenses]
  );

  const currentMonthMeta = useMemo(() => getPeriodMeta("monthly"), []);
  const currentMonthTotal = useMemo(
    () =>
      expenses
        .filter((item) => parseExpenseDate(item.date) >= currentMonthMeta.start)
        .reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [expenses, currentMonthMeta.start]
  );
  const remainingSalary = savedSalary - currentMonthTotal;
  const maxValue = byCategory[0]?.amount || 1;

  if (expensesQuery.isLoading) return <LoadingState label={t("expenses_loading")} />;
  if (expensesQuery.isError) return <ErrorState message={expensesQuery.error.message} />;
  if (settingsQuery.isError) return <ErrorState message={settingsQuery.error.message} />;

  return (
    <div className="space-y-4 pb-20 md:pb-4">
      <h1 className="text-xl font-semibold">{t("expenses_title")}</h1>

      <Card className="rounded-[24px] border border-white/60 bg-white/95 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
        <CardTitle className="text-base font-semibold text-slate-900">{t("expenses_salaryTitle")}</CardTitle>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-emerald-50 px-4 py-3">
              <p className="text-xs text-emerald-700/80">{t("expenses_monthlySalary")}</p>
              <p className="mt-1 text-lg font-bold text-emerald-700">{formatMoney(savedSalary)}</p>
            </div>
            <div className="rounded-2xl bg-rose-50 px-4 py-3">
              <p className="text-xs text-rose-700/80">{t("expenses_monthSpent")}</p>
              <p className="mt-1 text-lg font-bold text-rose-700">{formatMoney(currentMonthTotal)}</p>
            </div>
            <div className="rounded-2xl bg-sky-50 px-4 py-3">
              <p className="text-xs text-sky-700/80">{t("expenses_remaining")}</p>
              <p className={`mt-1 text-lg font-bold ${remainingSalary < 0 ? "text-rose-700" : "text-sky-700"}`}>
                {formatMoney(remainingSalary)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[24px] border border-white/60 bg-white/95 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
        <CardTitle className="text-base font-semibold text-slate-900">Xarajatlar analizi</CardTitle>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {periodOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPeriod(option.value)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  period === option.value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">{periodMeta.summaryLabel}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{formatMoney(summaryAmount)}</p>
              <p className="mt-1 text-xs text-slate-500">{periodMeta.title}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right">
              <p className="text-xs text-slate-500">{t("expenses_records")}</p>
              <p className="text-lg font-semibold text-slate-900">{filteredExpenses.length}</p>
            </div>
          </div>

          {byCategory.length > 0 ? (
            <ExpensePieChart items={byCategory} total={total} />
          ) : (
            <EmptyState label={`${periodMeta.title} bo'yicha xarajat topilmadi`} />
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">Xarajatlar ro'yxati</h2>
        {filteredExpenses.length === 0 ? <EmptyState label={t("expenses_empty")} /> : null}

        {filteredExpenses.map((expense, index) => {
          const style = palette[index % palette.length];
          const width = `${Math.max(16, (Number(expense.amount || 0) / maxValue) * 100)}%`;
          const hasConversion = expense.currency && expense.currency !== "UZS";

          return (
            <Card key={expense.id} className="rounded-2xl border border-border/70 bg-white/95">
              <CardTitle className="flex items-center justify-between gap-3">
                <span className="truncate text-slate-900">{expense.category}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${style.light} ${style.text}`}>
                  {formatMoney(expense.amount)}
                </span>
              </CardTitle>
              <CardContent className="space-y-2 text-sm">
                <p className="text-slate-500">{expense.date}</p>
                {hasConversion ? (
                  <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <p>{formatOriginalMoney(expense.original_amount, expense.currency)} {"->"} {formatMoney(expense.amount)}</p>
                    <p className="mt-1 text-slate-500">
                      1 {expense.currency} = {Number(expense.exchange_rate || 0).toLocaleString("uz-UZ")} UZS
                      {expense.exchange_rate_date ? ` • ${expense.exchange_rate_date}` : ""}
                    </p>
                  </div>
                ) : null}
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${style.bg}`} style={{ width }} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
