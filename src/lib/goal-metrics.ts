type Sale = {
  id?: string;
  value: number;
  status: string;
};

type Expense = {
  value: number;
  status: string;
};

type Client = {
  status: string;
};

type Receivable = {
  sourceId?: string;
  status: string;
  amount: number;
};

type FinancialAdjustment = {
  status: string;
  amount: number;
};

type GoalLike = {
  name: string;
  current: number;
  type: string;
};

export type GoalMetricContext = {
  sales: Sale[];
  expenses: Expense[];
  clients: Client[];
  receivables?: Receivable[];
  commissions?: FinancialAdjustment[];
  serviceCosts?: FinancialAdjustment[];
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function getGoalCurrent(goal: GoalLike, context: GoalMetricContext) {
  const name = normalize(goal.name);
  const totalRevenue = context.sales.reduce((sum, sale) => sum + sale.value, 0);
  const receivedRevenue = calculateReceivedRevenue(context.sales, context.receivables ?? []);
  const paidCommissions = (context.commissions ?? [])
    .filter((commission) => commission.status === "paga")
    .reduce((sum, commission) => sum + commission.amount, 0);
  const realizedServiceCosts = (context.serviceCosts ?? [])
    .filter((cost) => cost.status === "realizado" || cost.status === "pago" || cost.status === "paga")
    .reduce((sum, cost) => sum + cost.amount, 0);
  const totalExpenses =
    context.expenses.reduce((sum, expense) => sum + expense.value, 0) +
    (context.commissions ?? []).reduce((sum, commission) => sum + commission.amount, 0) +
    (context.serviceCosts ?? []).reduce((sum, cost) => sum + cost.amount, 0);
  const paidExpenses =
    context.expenses
      .filter((expense) => expense.status === "pago")
      .reduce((sum, expense) => sum + expense.value, 0) +
    paidCommissions +
    realizedServiceCosts;
  const averageTicket = context.sales.length ? Math.round(totalRevenue / context.sales.length) : 0;

  if (name.includes("faturamento") || name.includes("receita total")) return totalRevenue;
  if (name.includes("receita recebida") || name.includes("recebimento")) return receivedRevenue;
  if (name.includes("lucro")) return Math.max(0, receivedRevenue - paidExpenses);
  if (name.includes("ticket")) return averageTicket;
  if (name.includes("venda")) return context.sales.length;
  if (name.includes("cliente") || name.includes("captacao")) return context.clients.length;
  if (name.includes("despesa") || name.includes("custo")) {
    if (goal.type === "percent") return goal.current;
    return totalExpenses;
  }

  return goal.current;
}

export function applyGoalMetrics<T extends GoalLike>(goals: T[], context: GoalMetricContext) {
  return goals.map((goal) => ({
    ...goal,
    current: getGoalCurrent(goal, context),
  }));
}

function calculateReceivedRevenue(sales: Sale[], receivables: Receivable[]) {
  const saleIdsWithReceivables = new Set(
    receivables.map((receivable) => receivable.sourceId).filter(Boolean),
  );
  const receivedReceivables = receivables
    .filter((receivable) => receivable.status === "recebido")
    .reduce((sum, receivable) => sum + receivable.amount, 0);
  const paidSales = sales
    .filter((sale) => sale.status === "pago" && !saleIdsWithReceivables.has(sale.id))
    .reduce((sum, sale) => sum + sale.value, 0);

  return receivedReceivables + paidSales;
}
