type Sale = {
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

type GoalLike = {
  name: string;
  current: number;
  type: string;
};

export type GoalMetricContext = {
  sales: Sale[];
  expenses: Expense[];
  clients: Client[];
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
  const receivedRevenue = context.sales
    .filter((sale) => sale.status === "pago")
    .reduce((sum, sale) => sum + sale.value, 0);
  const totalExpenses = context.expenses.reduce((sum, expense) => sum + expense.value, 0);
  const paidExpenses = context.expenses
    .filter((expense) => expense.status === "pago")
    .reduce((sum, expense) => sum + expense.value, 0);
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
