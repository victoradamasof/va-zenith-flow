import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  CalendarDays,
  DollarSign,
  ShoppingCart,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { CollaboratorAvatar } from "@/components/collaborator-avatar";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card } from "@/components/ui/card";
import { AnimatedDashboardCard } from "@/components/ui/animated-dashboard-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InteractiveBrokerCard } from "@/components/ui/interactive-broker-card";
import { Progress } from "@/components/ui/progress";
import {
  clients as initialClients,
  expenses as initialExpenses,
  formatBRL,
  goals as initialGoals,
  insights,
  sales as initialSales,
  sellers as initialSellers,
} from "@/lib/mock-data";
import { buildCollaboratorMap, normalizeCollaboratorName } from "@/lib/collaborators";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { useSyncedReceivables } from "@/hooks/use-synced-receivables";
import { applyGoalMetrics } from "@/lib/goal-metrics";
import { filterSaleReceivables } from "@/lib/data-sync";
import {
  calculateCurrentCash,
  calculateReceivedRevenue,
  cashBalanceKey,
  defaultCashBalance,
} from "@/lib/cash-data";
import {
  bankTransactionsKey,
  calculateBankInflows,
  calculateBankOutflows,
  calculateScheduledBankInflows,
  calculateScheduledBankOutflows,
  initialBankTransactions,
  isBankInflow,
  isBankOutflow,
  isBankTransactionRealized,
  type BankTransaction,
} from "@/lib/bank-data";
import { formatLocalDateBR } from "@/lib/date-utils";
import { formatGoalDeadline } from "@/lib/smart-calendar";
import { generateSystemAlerts } from "@/lib/system-alerts";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard - VA Consultoria Manager" }] }),
});

const CHART_COLORS = [
  "hsl(28 95% 60%)",
  "hsl(152 55% 48%)",
  "hsl(240 60% 60%)",
  "hsl(45 85% 60%)",
  "hsl(305 55% 55%)",
  "hsl(0 0% 55%)",
];

type Collaborator = (typeof initialSellers)[number] & { role?: string; photoUrl?: string };

function Dashboard() {
  const [sales] = usePersistentState("va-manager:sales", initialSales);
  const [receivables] = useSyncedReceivables({ sales });
  const [expenses] = usePersistentState("va-manager:expenses", initialExpenses);
  const [clients] = usePersistentState("va-manager:clients", initialClients);
  const [goals] = usePersistentState("va-manager:goals", initialGoals);
  const [collaborators] = usePersistentState<Collaborator[]>(
    "va-manager:collaborators",
    initialSellers,
  );
  const [cashBase] = usePersistentState(cashBalanceKey, defaultCashBalance);
  const [bankTransactions] = usePersistentState<BankTransaction[]>(
    bankTransactionsKey,
    initialBankTransactions,
  );
  const syncedGoals = applyGoalMetrics(goals, { sales, expenses, clients });
  const alerts = useMemo(
    () =>
      generateSystemAlerts({
        sales,
        expenses,
        clients,
        goals: syncedGoals,
        receivables,
        cashBase,
        bankTransactions,
      }),
    [bankTransactions, cashBase, clients, expenses, receivables, sales, syncedGoals],
  );
  const saleReceivables = useMemo(
    () => filterSaleReceivables(receivables, sales),
    [receivables, sales],
  );
  const saleIdsWithReceivables = useMemo(
    () => new Set(saleReceivables.map((receivable) => receivable.sourceId)),
    [saleReceivables],
  );

  const bankInflows = calculateBankInflows(bankTransactions);
  const bankOutflows = calculateBankOutflows(bankTransactions);
  const scheduledBankInflows = calculateScheduledBankInflows(bankTransactions);
  const scheduledBankOutflows = calculateScheduledBankOutflows(bankTransactions);
  const totalRevenue = sales.reduce((sum, sale) => sum + sale.value, 0);
  const paidRevenue = calculateReceivedRevenue(sales, receivables) + bankInflows;
  const pendingRevenue =
    receivables
      .filter((receivable) => receivable.status === "previsto")
      .reduce((sum, receivable) => sum + receivable.amount, 0) +
    sales
      .filter((sale) => sale.status !== "pago" && !saleIdsWithReceivables.has(sale.id))
      .reduce((sum, sale) => sum + sale.value, 0) +
    scheduledBankInflows;
  const paidExpenses = expenses
    .filter((expense) => expense.status === "pago")
    .reduce((sum, expense) => sum + expense.value, 0) + bankOutflows;
  const openExpenses = expenses
    .filter((expense) => expense.status !== "pago")
    .reduce((sum, expense) => sum + expense.value, 0) + scheduledBankOutflows;
  const profit = paidRevenue - paidExpenses;
  const currentCash = calculateCurrentCash(cashBase, sales, expenses, receivables, bankTransactions);
  const balance = currentCash + pendingRevenue - openExpenses;
  const averageTicket = sales.length ? Math.round(totalRevenue / sales.length) : 0;
  const delinquentClients = clients.filter((client) => client.status === "inadimplente").length;
  const meta = syncedGoals[0];
  const goalTarget = meta?.target ?? 0;
  const goalCurrent = meta?.current ?? 0;
  const goalPct = goalTarget ? Math.min(100, Math.round((goalCurrent / goalTarget) * 100)) : 0;

  const monthlyData = buildMonthlyData(sales, expenses, bankTransactions);
  const dailyData = buildDailyData(sales);
  const expenseData = buildExpenseData(expenses, bankTransactions);
  const serviceRanking = buildRanking(sales, "service");
  const collaboratorsByName = useMemo(() => buildCollaboratorMap(collaborators), [collaborators]);
  const sellerRanking = buildRanking(sales, "seller").map((row) => {
    const collaborator = collaboratorsByName.get(normalizeCollaboratorName(row.name));
    return {
      ...row,
      avatar: collaborator?.avatar,
      photoUrl: collaborator?.photoUrl,
    };
  });
  const margin = paidRevenue ? Math.round((profit / paidRevenue) * 100) : 0;

  const generatedInsights = [
    !meta
      ? "Crie uma meta para acompanhar o ritmo do faturamento no dashboard."
      : goalCurrent >= meta.target
        ? "A meta de faturamento ja foi batida com os dados registrados."
        : `Faltam ${formatBRL(Math.max(meta.target - goalCurrent, 0))} para bater a meta principal.`,
    paidExpenses > paidRevenue * 0.55
      ? "As despesas pagas estao acima de 55% da receita recebida. Revise custos fixos."
      : "A relacao entre receita recebida e despesas pagas esta saudavel.",
    serviceRanking[0]
      ? `${serviceRanking[0].name} e o servico mais vendido na base atual.`
      : "Registre vendas para gerar ranking de servicos.",
    sellerRanking[0]
      ? `${sellerRanking[0].name} lidera o ranking comercial por receita.`
      : "Registre vendedores nas vendas para medir performance.",
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Executivo"
        subtitle="Visao consolidada da saude financeira, comercial e operacional da VA Consultoria"
        action={
          <>
            <Badge variant="outline" className="border-border/60 text-muted-foreground">
              Dados locais persistidos
            </Badge>
            <Button className="gradient-primary text-primary-foreground shadow-glow">
              <Sparkles className="mr-2 h-4 w-4" /> Atualizado em tempo real
            </Button>
          </>
        }
      />

      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="flex items-center gap-3 border-warning/30 bg-warning/5 p-4">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-warning/15 text-warning">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">
              {alerts.filter((alert) => alert.type === "danger").length} alertas criticos exigem
              atencao
            </p>
            <p className="text-xs text-muted-foreground">
              {formatBRL(openExpenses)} em despesas/pagamentos abertos e {formatBRL(pendingRevenue)} em
              receitas a receber
            </p>
          </div>
        </Card>
      </motion.div>

      <InteractiveBrokerCard
        name="VA Consultoria Manager"
        logoSrc="/va-consultoria-logo-cropped.png"
        tradableAssets={["Financeiro", "Vendas", "Clientes", "Contratos"]}
        rating={5}
        ratingText="Operacional"
        reviewsCount={`${alerts.length} alertas monitorados`}
        accountsCount={`${clients.length} clientes na base`}
        learnMoreUrl="/financial"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Faturamento total"
          value={formatBRL(totalRevenue)}
          delta={18.2}
          icon={DollarSign}
          accent="primary"
          hint="base atual"
        />
        <KpiCard
          label="Lucro estimado"
          value={formatBRL(profit)}
          delta={margin}
          icon={TrendingUp}
          accent="success"
          hint={`${margin}% margem`}
        />
        <KpiCard
          label="Despesas operacionais"
          value={formatBRL(paidExpenses)}
          delta={6.5}
          icon={TrendingDown}
          accent="warning"
          hint={`${expenses.length} despesas + ${bankTransactions.length} movimentos C6`}
        />
        <KpiCard
          label="Saldo projetado"
          value={formatBRL(balance)}
          delta={12.4}
          icon={Wallet}
          accent="info"
          hint="caixa + previstos"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Vendas registradas"
          value={String(sales.length)}
          delta={22}
          icon={ShoppingCart}
          accent="primary"
        />
        <KpiCard
          label="Ticket medio"
          value={formatBRL(averageTicket)}
          delta={4.1}
          icon={Target}
          accent="info"
        />
        <KpiCard
          label="Clientes ativos"
          value={String(clients.filter((client) => client.status === "ativo").length)}
          delta={12}
          icon={Users}
          accent="success"
        />
        <KpiCard
          label="Inadimplencia"
          value={String(delinquentClients)}
          delta={-1.5}
          icon={AlertTriangle}
          accent="destructive"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <AnimatedDashboardCard
          title="Receita em movimento"
          totalLabel="Receita total"
          primaryLabel="Recebido"
          secondaryLabel="A receber"
          primaryValue={paidRevenue}
          secondaryValue={pendingRevenue}
          primaryDelta={paidRevenue > 0 ? "entrada no caixa" : "sem entrada"}
          secondaryDelta={pendingRevenue > 0 ? "previsível" : "sem parcelas"}
          actionLabel="Sincronizado com vendas"
        />
        <Card className="border-border/60 bg-card/60 p-5 lg:col-span-2">
          <div className="grid h-full gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-primary/20 bg-primary/10 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Caixa atual
              </p>
              <p className="mt-3 font-display text-2xl font-semibold text-gradient-primary">
                {formatBRL(currentCash)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Vendas recebidas entram e despesas pagas saem automaticamente.
              </p>
            </div>
            <div className="rounded-xl border border-success/20 bg-success/10 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Lucro operacional
              </p>
              <p className="mt-3 font-display text-2xl font-semibold">{formatBRL(profit)}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Margem atual de {margin}% sobre a receita recebida.
              </p>
            </div>
            <div className="rounded-xl border border-info/20 bg-info/10 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Projeção líquida
              </p>
              <p className="mt-3 font-display text-2xl font-semibold">{formatBRL(balance)}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Caixa somado às parcelas previstas, menos contas abertas.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/60 bg-card/60 p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-semibold">Evolucao financeira</h3>
              <p className="text-xs text-muted-foreground">
                Receita, despesa e lucro por mes com dados salvos
              </p>
            </div>
            <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
              {goalPct}% da meta
            </Badge>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gLuc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS[1]} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={CHART_COLORS[1]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 100% / 0.06)" />
              <XAxis dataKey="month" stroke="hsl(0 0% 65%)" fontSize={12} />
              <YAxis
                stroke="hsl(0 0% 65%)"
                fontSize={12}
                tickFormatter={(v) => `${Number(v) / 1000}k`}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(0 0% 12%)",
                  border: "1px solid hsl(0 0% 20%)",
                  borderRadius: 8,
                }}
                formatter={(v: number) => formatBRL(v)}
              />
              <Area
                type="monotone"
                dataKey="receita"
                stroke={CHART_COLORS[0]}
                strokeWidth={2}
                fill="url(#gRev)"
                name="Receita"
              />
              <Area
                type="monotone"
                dataKey="lucro"
                stroke={CHART_COLORS[1]}
                strokeWidth={2}
                fill="url(#gLuc)"
                name="Lucro"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="border-border/60 bg-card/60 p-5">
          <h3 className="font-display text-base font-semibold">Despesas por categoria</h3>
          <p className="mb-2 text-xs text-muted-foreground">Composicao dos custos registrados</p>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={expenseData}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
              >
                {expenseData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "hsl(0 0% 12%)",
                  border: "1px solid hsl(0 0% 20%)",
                  borderRadius: 8,
                }}
                formatter={(v: number) => formatBRL(v)}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5">
            {expenseData.slice(0, 4).map((expense, i) => (
              <div key={expense.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS[i] }} />
                  {expense.name}
                </span>
                <span className="font-medium tabular-nums">{formatBRL(expense.value)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/60 bg-card/60 p-5 lg:col-span-2">
          <h3 className="font-display text-base font-semibold">Vendas recentes</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Faturamento diario das vendas registradas
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 100% / 0.06)" />
              <XAxis dataKey="day" stroke="hsl(0 0% 65%)" fontSize={12} />
              <YAxis
                stroke="hsl(0 0% 65%)"
                fontSize={12}
                tickFormatter={(v) => `${Number(v) / 1000}k`}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(0 0% 12%)",
                  border: "1px solid hsl(0 0% 20%)",
                  borderRadius: 8,
                }}
                formatter={(v: number) => formatBRL(v)}
              />
              <Bar
                dataKey="valor"
                fill={CHART_COLORS[0]}
                radius={[8, 8, 0, 0]}
                name="Faturamento"
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="border-border/60 bg-card/60 p-5">
          <h3 className="font-display text-base font-semibold">Meta de faturamento</h3>
          <p className="text-xs text-muted-foreground">
            {meta ? `Vence em ${formatGoalDeadline(meta.deadline)}` : "Nenhuma meta cadastrada"}
          </p>
          <div className="my-5">
            <div className="flex items-baseline justify-between">
              <span className="font-display text-3xl font-semibold">{goalPct}%</span>
              <span className="text-xs text-muted-foreground">
                {formatBRL(goalCurrent)} / {formatBRL(goalTarget)}
              </span>
            </div>
            <Progress value={goalPct} className="mt-3 h-2" />
          </div>
          <div className="space-y-2 border-t border-border/60 pt-4 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Falta</span>
              <span className="font-medium">
                {formatBRL(Math.max(goalTarget - goalCurrent, 0))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge className="h-5 bg-success/15 text-success hover:bg-success/15">
                {goalPct >= 100 ? "Batida" : "Em andamento"}
              </Badge>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/60 bg-card/60 p-5">
          <h3 className="font-display text-base font-semibold">Top servicos</h3>
          <p className="mb-3 text-xs text-muted-foreground">Mais vendidos na base atual</p>
          <RankingList rows={serviceRanking} />
        </Card>

        <Card className="border-border/60 bg-card/60 p-5">
          <h3 className="font-display text-base font-semibold">Top vendedores</h3>
          <p className="mb-3 text-xs text-muted-foreground">Performance por receita</p>
          <RankingList rows={sellerRanking} showAvatar />
        </Card>

        <Card className="border-border/60 bg-card/60 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-display text-base font-semibold">Insights inteligentes</h3>
          </div>
          <div className="space-y-2.5">
            {[...generatedInsights, ...insights.map((item) => item.text)]
              .slice(0, 5)
              .map((text, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-border/60 bg-background/40 p-3 text-xs leading-relaxed"
                >
                  {text}
                </div>
              ))}
          </div>
        </Card>
      </div>

      <Card className="border-border/60 bg-card/60 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-semibold">
              Calendario financeiro executivo
            </h3>
            <p className="text-xs text-muted-foreground">
              Eventos criticos derivados dos dados atuais
            </p>
          </div>
          <CalendarDays className="h-5 w-5 text-primary" />
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          {[
            {
              day: "Hoje",
              title: "Receitas a receber",
              value: formatBRL(pendingRevenue),
              tone: "info",
            },
            {
              day: "Hoje",
              title: "Despesas abertas",
              value: formatBRL(openExpenses),
              tone: "warning",
            },
            {
              day: "Mes",
              title: "Meta comercial",
              value: `${goalPct}%`,
              tone: goalPct >= 80 ? "success" : "warning",
            },
            {
              day: "CRM",
              title: "Clientes inadimplentes",
              value: String(delinquentClients),
              tone: delinquentClients ? "danger" : "success",
            },
          ].map((item) => (
            <div
              key={`${item.day}-${item.title}`}
              className={`rounded-xl border p-3 ${toneClass(item.tone)}`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {item.day}
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">{item.title}</p>
              <p className="mt-2 text-sm font-semibold tabular-nums">{item.value}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function RankingList({
  rows,
  showAvatar = false,
}: {
  rows: Array<{ name: string; count: number; revenue: number; avatar?: string; photoUrl?: string }>;
  showAvatar?: boolean;
}) {
  if (!rows.length) {
    return <p className="text-sm text-muted-foreground">Sem dados suficientes.</p>;
  }

  return (
    <div className="space-y-3">
      {rows.slice(0, 5).map((row, index) => (
        <div key={row.name} className="flex items-center gap-3">
          {showAvatar ? (
            <CollaboratorAvatar person={row} className="h-8 w-8 text-xs" />
          ) : (
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
              #{index + 1}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{row.name}</p>
            <p className="text-xs text-muted-foreground">{row.count} vendas</p>
          </div>
          <span className="text-sm font-medium tabular-nums">{formatBRL(row.revenue)}</span>
        </div>
      ))}
    </div>
  );
}

function buildMonthlyData(
  sales: typeof initialSales,
  expenses: typeof initialExpenses,
  bankTransactions: BankTransaction[],
) {
  const months = new Map<
    string,
    { month: string; receita: number; despesa: number; lucro: number }
  >();

  for (const sale of sales) {
    const month = formatLocalDateBR(sale.date, { month: "short" });
    const current = months.get(month) ?? { month, receita: 0, despesa: 0, lucro: 0 };
    current.receita += sale.value;
    current.lucro = current.receita - current.despesa;
    months.set(month, current);
  }

  for (const expense of expenses) {
    const month = formatLocalDateBR(expense.date, { month: "short" });
    const current = months.get(month) ?? { month, receita: 0, despesa: 0, lucro: 0 };
    current.despesa += expense.value;
    current.lucro = current.receita - current.despesa;
    months.set(month, current);
  }

  for (const transaction of bankTransactions.filter(isBankTransactionRealized)) {
    const month = formatLocalDateBR(transaction.date, { month: "short" });
    const current = months.get(month) ?? { month, receita: 0, despesa: 0, lucro: 0 };
    if (isBankInflow(transaction)) {
      current.receita += transaction.amount;
    }
    if (isBankOutflow(transaction)) {
      current.despesa += transaction.amount;
    }
    current.lucro = current.receita - current.despesa;
    months.set(month, current);
  }

  return [...months.values()].slice(-7);
}

function buildDailyData(sales: typeof initialSales) {
  const days = new Map<string, { day: string; valor: number }>();

  for (const sale of sales) {
    const day = formatLocalDateBR(sale.date, {
      day: "2-digit",
      month: "2-digit",
    });
    const current = days.get(day) ?? { day, valor: 0 };
    current.valor += sale.value;
    days.set(day, current);
  }

  return [...days.values()].slice(-10);
}

function buildExpenseData(expenses: typeof initialExpenses, bankTransactions: BankTransaction[]) {
  const categories = new Map<string, { name: string; value: number }>();

  for (const expense of expenses) {
    const current = categories.get(expense.category) ?? { name: expense.category, value: 0 };
    current.value += expense.value;
    categories.set(expense.category, current);
  }

  for (const transaction of bankTransactions.filter(
    (item) => isBankTransactionRealized(item) && isBankOutflow(item),
  )) {
    const current = categories.get(transaction.category) ?? {
      name: transaction.category,
      value: 0,
    };
    current.value += transaction.amount;
    categories.set(transaction.category, current);
  }

  return [...categories.values()].sort((a, b) => b.value - a.value).slice(0, 6);
}

function buildRanking(sales: typeof initialSales, key: "service" | "seller") {
  const rows = new Map<string, { name: string; count: number; revenue: number }>();

  for (const sale of sales) {
    const name = sale[key] || "Não informado";
    const current = rows.get(name) ?? { name, count: 0, revenue: 0 };
    current.count += 1;
    current.revenue += sale.value;
    rows.set(name, current);
  }

  return [...rows.values()].sort((a, b) => b.revenue - a.revenue);
}

function toneClass(tone: string) {
  return (
    {
      danger: "border-destructive/30 bg-destructive/5 text-destructive",
      warning: "border-warning/30 bg-warning/5 text-warning",
      info: "border-info/30 bg-info/5 text-info",
      success: "border-success/30 bg-success/5 text-success",
    }[tone] ?? "border-border/60 bg-background/40"
  );
}
