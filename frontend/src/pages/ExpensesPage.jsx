import { useState } from "react";
import { useCreateExpense, useExpenses } from "../hooks/useApi";
import { Card, CardContent, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { useI18n } from "../hooks/useI18n";

export function ExpensesPage() {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const { t } = useI18n();

  const expensesQuery = useExpenses();
  const createExpense = useCreateExpense();

  const onSubmit = (e) => {
    e.preventDefault();
    createExpense.mutate(
      {
        amount: Number(amount),
        category,
        date,
      },
      {
        onSuccess: () => {
          setAmount("");
          setCategory("");
        },
      }
    );
  };

  if (expensesQuery.isLoading) return <LoadingState label={t("expenses_loading")} />;
  if (expensesQuery.isError) return <ErrorState message={expensesQuery.error.message} />;

  return (
    <div className="space-y-4 pb-20 md:pb-4">
      <h1 className="text-xl font-semibold">{t("expenses_title")}</h1>
      <Card>
        <CardTitle>{t("expenses_addTitle")}</CardTitle>
        <CardContent>
          <form className="space-y-2" onSubmit={onSubmit}>
            <Input type="number" placeholder={t("expenses_amount")} value={amount} onChange={(e) => setAmount(e.target.value)} required />
            <Input placeholder={t("expenses_category")} value={category} onChange={(e) => setCategory(e.target.value)} required />
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            <Button type="submit" disabled={createExpense.isPending}>{createExpense.isPending ? t("expenses_saving") : t("expenses_save")}</Button>
          </form>
        </CardContent>
      </Card>

      {(expensesQuery.data?.items || []).map((expense) => (
        <Card key={expense.id}>
          <CardTitle>{expense.category}</CardTitle>
          <CardContent className="text-sm text-muted-foreground flex items-center gap-2 font-medium">
            <span>{Number(expense.amount).toLocaleString()} UZS</span>
            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
            <span>{expense.date}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
