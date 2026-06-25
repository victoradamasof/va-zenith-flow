import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownCircle, ArrowUpCircle, Download, TrendingUp, Wallet } from "lucide-react";
import {
  expenses as initialExpenses,
  formatBRL,
  sales as initialSales,
  services as initialServices,
} from "@/lib/mock-data";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { useSyncedReceivables } from "@/hooks/use-synced-receivables";
import { filterSaleReceivables } from "@/lib/data-sync";
import {
  calculateCurrentCash,
  calculateExpensePaidAmount,
  calculateExpenseRemainingAmount,
  cashBalanceKey,
  defaultCashBalance,
} from "@/lib/cash-data";
import {
  commissionAdjustmentsKey,
  calculateCommissionEntries,
  commissionPaymentsKey,
  type CommissionAdjustment,
  type CommissionPayment,
} from "@/lib/commissions";
import { calculateServiceCostEntries } from "@/lib/service-costs";
import {
  bankTransactionsKey,
  initialBankTransactions,
  isBankInflow,
  isBankOutflow,
  isBankTransactionRealized,
  type BankTransaction,
} from "@/lib/bank-data";
import { getToday, toISODate } from "@/lib/smart-calendar";

export const Route = createFileRoute("/_app/cashflow")({
  component: CashFlow,
  head: () => ({ meta: [{ title: "Fluxo de Caixa - VA Consultoria" }] }),
});

const periods = { hoje: 1, semana: 7, mes: 30, tri: 90, ano: 365 };

function parseLocalDate(date: string) {
  return new Date(`${date}T12:00:00`);
}

function isPaid(status: string) {
  return status === "pago";
}

function CashFlow() {
  const [period, setPeriod] = useState<keyof typeof periods>("mes");
  const [sales] = usePersistentState("va-manager:sales", initialSales);
  const [expenses] = usePersistentState("va-manager:expenses", initialExpenses);
  const [services] = usePersistentState("va-manager:services", initialServices);
  const [commissionPayments] = usePersistentState<CommissionPayment[]>(
    commissionPaymentsKey,
    [],
  );
  const [commissionAdjustments] = usePersistentState<CommissionAdjustment[]>(
    commissionAdjustmentsKey,
    [],
  );
  const [receivables] = useSyncedReceivables({ sales });
  const [bankTransactions] = usePersistentState<BankTransaction[]>(
    bankTransactionsKey,
    initialBankTransactions,
  );
  const [cashBase] = usePersistentState(cashBalanceKey, defaultCashBalance);

  const days = periods[period];
  const today = useMemo(() => getToday(), []);
  const start = useMemo(() => {
    const date = new Date(today);
    date.setDate(today.getDate() - days + 1);
    return date;
  }, [days, today]);

  const filteredSales = sales.filter((sale) => parseLocalDate(sale.date) >= start);
  const filteredExpenses = expenses.filter((expense) => parseLocalDate(expense.date) >= start);
  const filteredBankTransactions = bankTransactions.filter(
    (transaction) => parseLocalDate(transaction.date) >= start,
  );
  const filteredReceivables = receivables.filter(
    (receivable) => parseLocalDate(receivable.dueDate) >= start,
  );
  const saleReceivables = useMemo(
    () => filterSaleReceivables(receivables, sales),
    [receivables, sales],
  );
  const saleIdsWithReceivables = useMemo(
    () => new Set(saleReceivables.map((receivable) => receivable.sourceId)),
    [saleReceivables],
  );
  const commissionEntries = useMemo(
    () =>
      calculateCommissionEntries({
        sales,
        services,
        receivables,
        payments: commissionPayments,
        adjustments: commissionAdjustments,
      }),
    [commissionAdjustments, commissionPayments, receivables, sales, services],
  );
  const serviceCostEntries = useMemo(
    () => calculateServiceCostEntries({ sales, services, receivables }),
    [receivables, sales, services],
  );

  const paidSalesInPeriod = filteredSales.filter(
    (sale) => isPaid(sale.status) && !saleIdsWithReceivables.has(sale.id),
  );
  const receivedInPeriod = filteredReceivables.filter(
    (receivable) => receivable.status === "recebido",
  );
  const paidExpensesInPeriod = filteredExpenses.filter(
    (expense) => calculateExpensePaidAmount(expense) > 0,
  );
  const pendingSalesInPeriod = filteredSales.filter(
    (sale) => !isPaid(sale.status) && !saleIdsWithReceivables.has(sale.id),
  );
  const pendingReceivablesInPeriod = filteredReceivables.filter(
    (receivable) => receivable.status === "previsto",
  );
  const pendingExpensesInPeriod = filteredExpenses.filter(
    (expense) => calculateExpenseRemainingAmount(expense) > 0,
  );
  const realizedBankInflows = filteredBankTransactions.filter(
    (transaction) => isBankTransactionRealized(transaction) && isBankInflow(transaction),
  );
  const realizedBankOutflows = filteredBankTransactions.filter(
    (transaction) => isBankTransactionRealized(transaction) && isBankOutflow(transaction),
  );
  const scheduledBankInflows = filteredBankTransactions.filter(
    (transaction) => transaction.status === "agendado" && isBankInflow(transaction),
  );
  const scheduledBankOutflows = filteredBankTransactions.filter(
    (transaction) => transaction.status === "agendado" && isBankOutflow(transaction),
  );
  const paidCommissionsInPeriod = commissionEntries.filter(
    (commission) =>
      commission.status === "paga" &&
      parseLocalDate(commission.paidAt ?? commission.dueDate) >= start,
  );
  const payableCommissionsInPeriod = commissionEntries.filter(
    (commission) => commission.status === "a_pagar" && parseLocalDate(commission.dueDate) >= start,
  );
  const realizedServiceCostsInPeriod = serviceCostEntries.filter(
    (cost) => cost.status === "realizado" && parseLocalDate(cost.date) >= start,
  );
  const pendingServiceCostsInPeriod = serviceCostEntries.filter(
    (cost) => cost.status === "previsto" && parseLocalDate(cost.date) >= start,
  );

  const entradas =
    paidSalesInPeriod.reduce((sum, sale) => sum + sale.value, 0) +
    receivedInPeriod.reduce((sum, receivable) => sum + receivable.amount, 0) +
    realizedBankInflows.reduce((sum, transaction) => sum + transaction.amount, 0);
  const saidas =
    paidExpensesInPeriod.reduce((sum, expense) => sum + calculateExpensePaidAmount(expense), 0) +
    realizedBankOutflows.reduce((sum, transaction) => sum + transaction.amount, 0) +
    paidCommissionsInPeriod.reduce((sum, commission) => sum + commission.amount, 0) +
    realizedServiceCostsInPeriod.reduce((sum, cost) => sum + cost.amount, 0);
  const currentCash = calculateCurrentCash(
    cashBase,
    sales,
    expenses,
    receivables,
    bankTransactions,
    commissionEntries,
    serviceCostEntries,
  );
  const saldoInicial = currentCash - entradas + saidas;
  const saldoFinal = saldoInicial + entradas - saidas;

  const entradasPrevistas =
    pendingSalesInPeriod.reduce((sum, sale) => sum + sale.value, 0) +
    pendingReceivablesInPeriod.reduce((sum, receivable) => sum + receivable.amount, 0) +
    scheduledBankInflows.reduce((sum, transaction) => sum + transaction.amount, 0);
  const saidasPrevistas =
    pendingExpensesInPeriod.reduce((sum, expense) => sum + calculateExpenseRemainingAmount(expense), 0) +
    scheduledBankOutflows.reduce((sum, transaction) => sum + transaction.amount, 0) +
    payableCommissionsInPeriod.reduce((sum, commission) => sum + commission.amount, 0) +
    pendingServiceCostsInPeriod.reduce((sum, cost) => sum + cost.amount, 0);
  const saldoProjetado = saldoFinal + entradasPrevistas - saidasPrevistas;
  const safeMinimum = Math.max(3000, Math.round(Math.max(currentCash, 1) * 0.2));

  const biggestEntry = Math.max(
    0,
    ...paidSalesInPeriod.map((sale) => sale.value),
    ...receivedInPeriod.map((receivable) => receivable.amount),
    ...realizedBankInflows.map((transaction) => transaction.amount),
  );
  const biggestOutflow = Math.max(
    0,
    ...paidExpensesInPeriod.map((expense) => expense.value),
    ...realizedBankOutflows.map((transaction) => transaction.amount),
    ...paidCommissionsInPeriod.map((commission) => commission.amount),
    ...realizedServiceCostsInPeriod.map((cost) => cost.amount),
  );

  const chartData = useMemo(() => {
    return Array.from({ length: Math.min(days, 30) }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = toISODate(date);
      const realizedSales = sales
        .filter(
          (sale) =>
            isPaid(sale.status) &&
            !saleIdsWithReceivables.has(sale.id) &&
            sale.date <= key &&
            parseLocalDate(sale.date) >= start,
        )
        .reduce((sum, sale) => sum + sale.value, 0);
      const realizedReceivables = receivables
        .filter(
          (receivable) =>
            receivable.status === "recebido" &&
            receivable.dueDate <= key &&
            parseLocalDate(receivable.dueDate) >= start,
        )
        .reduce((sum, receivable) => sum + receivable.amount, 0);
      const realizedExpenses = expenses
        .filter(
          (expense) =>
            calculateExpensePaidAmount(expense) > 0 &&
            expense.date <= key &&
            parseLocalDate(expense.date) >= start,
        )
        .reduce((sum, expense) => sum + calculateExpensePaidAmount(expense), 0);
      const realizedCommissions = commissionEntries
        .filter(
          (commission) =>
            commission.status === "paga" &&
            (commission.paidAt ?? commission.dueDate) <= key &&
            parseLocalDate(commission.paidAt ?? commission.dueDate) >= start,
        )
        .reduce((sum, commission) => sum + commission.amount, 0);
      const realizedServiceCosts = serviceCostEntries
        .filter(
          (cost) =>
            cost.status === "realizado" &&
            cost.date <= key &&
            parseLocalDate(cost.date) >= start,
        )
        .reduce((sum, cost) => sum + cost.amount, 0);
      const realizedBank = bankTransactions
        .filter(
          (transaction) =>
            isBankTransactionRealized(transaction) &&
            transaction.date <= key &&
            parseLocalDate(transaction.date) >= start,
        )
        .reduce(
          (sum, transaction) =>
            sum + (isBankInflow(transaction) ? transaction.amount : -transaction.amount),
          0,
        );
      const saldo =
        saldoInicial +
        realizedSales +
        realizedReceivables +
        realizedBank -
        realizedExpenses -
        realizedCommissions -
        realizedServiceCosts;

      const projectedSales = sales
        .filter(
          (sale) =>
            !isPaid(sale.status) &&
            !saleIdsWithReceivables.has(sale.id) &&
            sale.date <= key &&
            parseLocalDate(sale.date) >= start,
        )
        .reduce((sum, sale) => sum + sale.value, 0);
      const projectedReceivables = receivables
        .filter(
          (receivable) =>
            receivable.status === "previsto" &&
            receivable.dueDate <= key &&
            parseLocalDate(receivable.dueDate) >= start,
        )
        .reduce((sum, receivable) => sum + receivable.amount, 0);
      const projectedExpenses = expenses
        .filter(
          (expense) =>
            calculateExpenseRemainingAmount(expense) > 0 &&
            expense.date <= key &&
            parseLocalDate(expense.date) >= start,
        )
        .reduce((sum, expense) => sum + calculateExpenseRemainingAmount(expense), 0);
      const projectedCommissions = commissionEntries
        .filter(
          (commission) =>
            commission.status === "a_pagar" &&
            commission.dueDate <= key &&
            parseLocalDate(commission.dueDate) >= start,
        )
        .reduce((sum, commission) => sum + commission.amount, 0);
      const projectedServiceCosts = serviceCostEntries
        .filter(
          (cost) =>
            cost.status === "previsto" && cost.date <= key && parseLocalDate(cost.date) >= start,
        )
        .reduce((sum, cost) => sum + cost.amount, 0);
      const projectedBank = bankTransactions
        .filter(
          (transaction) =>
            transaction.status === "agendado" &&
            transaction.date <= key &&
            parseLocalDate(transaction.date) >= start,
        )
        .reduce(
          (sum, transaction) =>
            sum + (isBankInflow(transaction) ? transaction.amount : -transaction.amount),
          0,
        );
      return {
        day: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        saldo,
        entradas:
          sales
            .filter(
              (sale) =>
                isPaid(sale.status) && !saleIdsWithReceivables.has(sale.id) && sale.date === key,
            )
            .reduce((sum, sale) => sum + sale.value, 0) +
          receivables
            .filter((receivable) => receivable.status === "recebido" && receivable.dueDate === key)
            .reduce((sum, receivable) => sum + receivable.amount, 0) +
          bankTransactions
            .filter(
              (transaction) =>
                isBankTransactionRealized(transaction) &&
                isBankInflow(transaction) &&
                transaction.date === key,
            )
            .reduce((sum, transaction) => sum + transaction.amount, 0),
        saidas:
          expenses
            .filter((expense) => calculateExpensePaidAmount(expense) > 0 && expense.date === key)
            .reduce((sum, expense) => sum + calculateExpensePaidAmount(expense), 0) +
          bankTransactions
            .filter(
              (transaction) =>
                isBankTransactionRealized(transaction) &&
                isBankOutflow(transaction) &&
                transaction.date === key,
            )
            .reduce((sum, transaction) => sum + transaction.amount, 0) +
          commissionEntries
            .filter(
              (commission) =>
                commission.status === "paga" &&
                (commission.paidAt ?? commission.dueDate) === key,
            )
            .reduce((sum, commission) => sum + commission.amount, 0) +
          serviceCostEntries
            .filter((cost) => cost.status === "realizado" && cost.date === key)
            .reduce((sum, cost) => sum + cost.amount, 0),
        projecao:
          saldo +
          projectedSales +
          projectedReceivables -
          projectedExpenses -
          projectedCommissions -
          projectedServiceCosts +
          projectedBank,
      };
    });
  }, [
    bankTransactions,
    commissionEntries,
    days,
    expenses,
    receivables,
    saleIdsWithReceivables,
    sales,
    serviceCostEntries,
    saldoInicial,
    start,
  ]);

  const exportCsv = () => {
    const rows = [
      ["Dia", "Saldo realizado", "Entradas realizadas", "Saidas realizadas", "Projecao"],
      ...chartData.map((item) => [
        item.day,
        String(item.saldo),
        String(item.entradas),
        String(item.saidas),
        String(item.projecao),
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "fluxo-caixa-va.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fluxo de Caixa"
        subtitle="Entradas, saidas e projecao conectadas a financeiro, CRM e vendas"
        action={
          <>
            <Tabs
              value={period}
              onValueChange={(value) => setPeriod(value as keyof typeof periods)}
            >
              <TabsList>
                <TabsTrigger value="hoje">Hoje</TabsTrigger>
                <TabsTrigger value="semana">Semana</TabsTrigger>
                <TabsTrigger value="mes">Mes</TabsTrigger>
                <TabsTrigger value="tri">Trimestre</TabsTrigger>
                <TabsTrigger value="ano">Ano</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Saldo inicial"
          value={formatBRL(saldoInicial)}
          icon={Wallet}
          accent="info"
          hint="aporte de investimentos + saldo anterior"
        />
        <KpiCard
          label="Entradas realizadas"
          value={formatBRL(entradas)}
          delta={18}
          icon={ArrowUpCircle}
          accent="success"
        />
        <KpiCard
          label="Saidas realizadas"
          value={formatBRL(saidas)}
          delta={6}
          icon={ArrowDownCircle}
          accent="warning"
        />
        <KpiCard
          label="Saldo final"
          value={formatBRL(saldoFinal)}
          delta={saldoFinal >= saldoInicial ? 26 : -12}
          icon={TrendingUp}
          accent="primary"
        />
      </div>

      <Card className="border-border/60 bg-card/60 p-5">
        <div className="mb-4">
          <h3 className="font-display text-base font-semibold">Evolucao diaria do caixa</h3>
          <p className="text-xs text-muted-foreground">
            Linha laranja: realizado. Linha verde: projecao com recebiveis e pagamentos previstos.
          </p>
        </div>
        <ResponsiveContainer width="100%" height={340}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="cf1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(28 95% 60%)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="hsl(28 95% 60%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="cf2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(152 55% 48%)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="hsl(152 55% 48%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 100% / 0.06)" />
            <XAxis dataKey="day" stroke="hsl(0 0% 65%)" fontSize={11} />
            <YAxis
              stroke="hsl(0 0% 65%)"
              fontSize={11}
              tickFormatter={(value) => `${(value as number) / 1000}k`}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(0 0% 12%)",
                border: "1px solid hsl(0 0% 20%)",
                borderRadius: 8,
              }}
              formatter={(value: number) => formatBRL(value)}
            />
            <ReferenceLine
              y={safeMinimum}
              stroke="hsl(0 80% 60%)"
              strokeDasharray="4 4"
              label={{
                value: "Minimo seguro",
                position: "right",
                fill: "hsl(0 80% 60%)",
                fontSize: 11,
              }}
            />
            <Area
              type="monotone"
              dataKey="saldo"
              stroke="hsl(28 95% 60%)"
              strokeWidth={2.5}
              fill="url(#cf1)"
              name="Saldo realizado"
            />
            <Area
              type="monotone"
              dataKey="projecao"
              stroke="hsl(152 55% 48%)"
              strokeWidth={2}
              strokeDasharray="5 5"
              fill="url(#cf2)"
              name="Projecao"
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <CashCard
          title="Maior entrada"
          value={biggestEntry}
          subtitle={`${paidSalesInPeriod.length + receivedInPeriod.length + realizedBankInflows.length} entradas recebidas`}
        />
        <CashCard
          title="Maior saida"
          value={biggestOutflow}
          subtitle={`${paidExpensesInPeriod.length + realizedBankOutflows.length + paidCommissionsInPeriod.length + realizedServiceCostsInPeriod.length} saidas realizadas`}
        />
        <CashCard
          title="Saldo projetado"
          value={saldoProjetado}
          subtitle={`${formatBRL(entradasPrevistas)} a receber e ${formatBRL(saidasPrevistas)} a pagar`}
        />
        <Card className="border-border/60 bg-card/60 p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Risco de caixa</p>
          <p className="mt-1 font-display text-xl font-semibold">
            {saldoProjetado < safeMinimum ? "Alto" : "Controlado"}
          </p>
          <p
            className={
              saldoProjetado < safeMinimum ? "text-xs text-destructive" : "text-xs text-success"
            }
          >
            {saldoProjetado < safeMinimum
              ? "Projecao abaixo do minimo seguro"
              : "Projecao acima do minimo seguro"}
          </p>
        </Card>
      </div>
    </div>
  );
}

function CashCard({ title, value, subtitle }: { title: string; value: number; subtitle: string }) {
  return (
    <Card className="border-border/60 bg-card/60 p-5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{title}</p>
      <p className="mt-1 font-display text-xl font-semibold">{formatBRL(value)}</p>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </Card>
  );
}
