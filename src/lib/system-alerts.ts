import { calculateCurrentCash } from "@/lib/cash-data";
import { formatBRL } from "@/lib/mock-data";
import {
  calculateScheduledBankInflows,
  calculateScheduledBankOutflows,
  isBankInflow,
  isBankOutflow,
  type BankTransaction,
} from "@/lib/bank-data";
import type { Receivable } from "@/lib/receivables";

type AlertType = "danger" | "warning" | "info" | "success";

export type SystemAlert = {
  id: string;
  type: AlertType;
  title: string;
  desc: string;
  time: string;
  target?: string;
};

type Sale = {
  id: string;
  date: string;
  client: string;
  service: string;
  value: number;
  seller: string;
  status: string;
};

type Expense = {
  id: string;
  date: string;
  desc: string;
  category: string;
  value: number;
  status: string;
};

type Client = {
  id: string;
  name: string;
  status: string;
  total?: number;
};

type Goal = {
  id: string;
  name: string;
  target: number;
  current: number;
  type: string;
  deadline: string;
};

type FinancialAdjustment = {
  status: string;
  amount: number;
};

export type AlertContext = {
  sales: Sale[];
  expenses: Expense[];
  clients: Client[];
  goals: Goal[];
  receivables: Receivable[];
  cashBase: number;
  bankTransactions?: BankTransaction[];
  commissions?: FinancialAdjustment[];
  serviceCosts?: FinancialAdjustment[];
  today?: Date;
};

const dayMs = 24 * 60 * 60 * 1000;

export function generateSystemAlerts({
  sales,
  expenses,
  clients,
  goals,
  receivables,
  cashBase,
  bankTransactions = [],
  commissions = [],
  serviceCosts = [],
  today = new Date(),
}: AlertContext) {
  const alerts: SystemAlert[] = [];
  const todayStart = startOfDay(today);
  const currentCash = calculateCurrentCash(
    cashBase,
    sales,
    expenses,
    receivables,
    bankTransactions,
    commissions,
    serviceCosts,
  );
  const openExpenses = expenses.filter((expense) => expense.status !== "pago");
  const pendingReceivables = receivables.filter((receivable) => receivable.status === "previsto");
  const payableCommissions = commissions
    .filter((commission) => commission.status !== "paga")
    .reduce((sum, commission) => sum + commission.amount, 0);
  const pendingServiceCosts = serviceCosts
    .filter((cost) => cost.status !== "realizado" && cost.status !== "pago" && cost.status !== "paga")
    .reduce((sum, cost) => sum + cost.amount, 0);
  const scheduledBankOutflows = bankTransactions.filter(
    (transaction) => transaction.status === "agendado" && isBankOutflow(transaction),
  );
  const scheduledBankInflows = bankTransactions.filter(
    (transaction) => transaction.status === "agendado" && isBankInflow(transaction),
  );
  const projectedBalance =
    currentCash +
    pendingReceivables.reduce((sum, receivable) => sum + receivable.amount, 0) -
    openExpenses.reduce((sum, expense) => sum + expense.value, 0) +
    calculateScheduledBankInflows(bankTransactions) -
    calculateScheduledBankOutflows(bankTransactions) -
    payableCommissions -
    pendingServiceCosts;

  for (const expense of openExpenses) {
    const dueDate = parseDate(expense.date, todayStart);
    const days = diffInDays(dueDate, todayStart);

    if (days < 0) {
      alerts.push({
        id: `expense-overdue-${expense.id}`,
        type: "danger",
        title: "Conta vencida",
        desc: `${expense.desc} - ${formatBRL(expense.value)} venceu ${formatRelativeDays(days)}`,
        time: formatRelativeDays(days),
        target: "Gestão Financeira",
      });
    } else if (days <= 3) {
      alerts.push({
        id: `expense-due-${expense.id}`,
        type: "warning",
        title: "Conta vencendo",
        desc: `${expense.desc} - ${formatBRL(expense.value)} vence ${formatRelativeDays(days)}`,
        time: formatRelativeDays(days),
        target: "Gestão Financeira",
      });
    }
  }

  for (const receivable of pendingReceivables) {
    const dueDate = parseDate(receivable.dueDate, todayStart);
    const days = diffInDays(dueDate, todayStart);

    if (days < 0) {
      alerts.push({
        id: `receivable-overdue-${receivable.id}`,
        type: "danger",
        title: "Receita atrasada",
        desc: `${receivable.client} - ${formatBRL(receivable.amount)} em aberto ${formatRelativeDays(days)}`,
        time: formatRelativeDays(days),
        target: "Receita previsível",
      });
    } else if (days <= 3) {
      alerts.push({
        id: `receivable-due-${receivable.id}`,
        type: "info",
        title: "Recebível próximo",
        desc: `${receivable.client} - ${formatBRL(receivable.amount)} previsto ${formatRelativeDays(days)}`,
        time: formatRelativeDays(days),
        target: "Receita previsível",
      });
    }
  }

  for (const transaction of scheduledBankOutflows) {
    const dueDate = parseDate(transaction.date, todayStart);
    const days = diffInDays(dueDate, todayStart);

    if (days < 0) {
      alerts.push({
        id: `bank-overdue-${transaction.id}`,
        type: "danger",
        title: "Pagamento bancario vencido",
        desc: `${transaction.description} - ${formatBRL(transaction.amount)} no C6 PJ venceu ${formatRelativeDays(days)}`,
        time: formatRelativeDays(days),
        target: "Banco C6 PJ",
      });
    } else if (days <= 3) {
      alerts.push({
        id: `bank-due-${transaction.id}`,
        type: "warning",
        title: "Pagamento bancario agendado",
        desc: `${transaction.description} - ${formatBRL(transaction.amount)} no C6 PJ vence ${formatRelativeDays(days)}`,
        time: formatRelativeDays(days),
        target: "Banco C6 PJ",
      });
    }
  }

  for (const transaction of scheduledBankInflows) {
    const dueDate = parseDate(transaction.date, todayStart);
    const days = diffInDays(dueDate, todayStart);

    if (days <= 3 && days >= 0) {
      alerts.push({
        id: `bank-inflow-${transaction.id}`,
        type: "info",
        title: "Entrada bancaria prevista",
        desc: `${transaction.description} - ${formatBRL(transaction.amount)} previsto no C6 PJ ${formatRelativeDays(days)}`,
        time: formatRelativeDays(days),
        target: "Banco C6 PJ",
      });
    }
  }

  for (const client of clients.filter((client) => client.status === "inadimplente")) {
    alerts.push({
      id: `client-delinquent-${client.id}`,
      type: "danger",
      title: "Cliente inadimplente",
      desc: `${client.name}${client.total ? ` - ${formatBRL(client.total)} em histórico` : ""}`,
      time: "agora",
      target: "Clientes",
    });
  }

  for (const goal of goals) {
    const pct = goal.target ? Math.round((goal.current / goal.target) * 100) : 0;
    const deadline = parseGoalDeadline(goal.deadline, todayStart);
    const daysLeft = diffInDays(deadline, todayStart);

    if (pct >= 100) {
      alerts.push({
        id: `goal-hit-${goal.id}`,
        type: "success",
        title: "Meta batida",
        desc: `${goal.name}: ${formatGoalValue(goal.current, goal.type)} de ${formatGoalValue(
          goal.target,
          goal.type,
        )}`,
        time: "hoje",
        target: "Metas",
      });
      continue;
    }

    if (daysLeft <= 7) {
      const remaining = Math.max(goal.target - goal.current, 0);
      const dailyNeed = Math.ceil(remaining / Math.max(daysLeft, 1));
      alerts.push({
        id: `goal-risk-${goal.id}`,
        type: pct < 50 ? "danger" : "warning",
        title: "Meta em risco",
        desc: `${goal.name}: ${pct}% atingido, faltam ${formatGoalValue(
          remaining,
          goal.type,
        )} em ${Math.max(daysLeft, 0)} dias (${formatGoalValue(dailyNeed, goal.type)}/dia)`,
        time: daysLeft <= 0 ? "hoje" : `${daysLeft} dias`,
        target: "Metas",
      });
    }
  }

  if (projectedBalance < 0) {
    alerts.push({
      id: "cashflow-negative-projection",
      type: "danger",
      title: "Fluxo de caixa em risco",
      desc: `Saldo projetado negativo de ${formatBRL(projectedBalance)} considerando receitas e despesas abertas`,
      time: "agora",
      target: "Fluxo de Caixa",
    });
  } else if (
    currentCash <
    openExpenses.reduce((sum, expense) => sum + expense.value, 0) +
      calculateScheduledBankOutflows(bankTransactions) +
      payableCommissions +
      pendingServiceCosts
  ) {
    const commitments =
      openExpenses.reduce((sum, expense) => sum + expense.value, 0) +
      calculateScheduledBankOutflows(bankTransactions) +
      payableCommissions +
      pendingServiceCosts;
    alerts.push({
      id: "cashflow-low-coverage",
      type: "warning",
      title: "Caixa abaixo dos compromissos",
      desc: `${formatBRL(currentCash)} em caixa para ${formatBRL(
        commitments,
      )} em despesas, custos, comissoes e pagamentos bancarios abertos`,
      time: "agora",
      target: "Fluxo de Caixa",
    });
  }

  const paidExpenses = expenses.filter((expense) => expense.status === "pago");
  const totalPaidExpenses = paidExpenses.reduce((sum, expense) => sum + expense.value, 0);
  const categoryTotals = new Map<string, number>();
  for (const expense of paidExpenses) {
    categoryTotals.set(
      expense.category,
      (categoryTotals.get(expense.category) ?? 0) + expense.value,
    );
  }
  const topCategory = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topCategory && totalPaidExpenses > 0 && topCategory[1] / totalPaidExpenses >= 0.4) {
    alerts.push({
      id: `category-heavy-${normalizeId(topCategory[0])}`,
      type: "warning",
      title: "Despesa concentrada",
      desc: `${topCategory[0]} representa ${Math.round(
        (topCategory[1] / totalPaidExpenses) * 100,
      )}% das despesas pagas (${formatBRL(topCategory[1])})`,
      time: "hoje",
      target: "Gestão Financeira",
    });
  }

  const recentSales = sales.filter(
    (sale) => diffInDays(todayStart, parseDate(sale.date, todayStart)) <= 7,
  );
  if (sales.length > 0 && recentSales.length === 0) {
    alerts.push({
      id: "sales-no-recent",
      type: "warning",
      title: "Vendas paradas",
      desc: "Nenhuma venda registrada nos últimos 7 dias",
      time: "hoje",
      target: "Vendas",
    });
  }

  return alerts.sort((a, b) => severityRank(a.type) - severityRank(b.type)).slice(0, 12);
}

function parseDate(value: string, fallback: Date) {
  if (!value) return fallback;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  if (/^\d{2}\/\d{2}(\/\d{4})?$/.test(value)) {
    const [day, month, maybeYear] = value.split("/").map(Number);
    return new Date(maybeYear ?? fallback.getFullYear(), month - 1, day);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : startOfDay(parsed);
}

function parseGoalDeadline(value: string, today: Date) {
  const date = parseDate(value, today);
  if (date < today && !value.includes(String(today.getFullYear()))) {
    return new Date(today.getFullYear() + 1, date.getMonth(), date.getDate());
  }
  return date;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function diffInDays(a: Date, b: Date) {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / dayMs);
}

function formatRelativeDays(days: number) {
  if (days === 0) return "hoje";
  if (days === 1) return "amanhã";
  if (days === -1) return "ontem";
  if (days > 1) return `em ${days} dias`;
  return `há ${Math.abs(days)} dias`;
}

function formatGoalValue(value: number, type: string) {
  if (type === "currency") return formatBRL(value);
  if (type === "percent") return `${Math.round(value)}%`;
  return String(Math.round(value));
}

function severityRank(type: AlertType) {
  return { danger: 0, warning: 1, info: 2, success: 3 }[type];
}

function normalizeId(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
