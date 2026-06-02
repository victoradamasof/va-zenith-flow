import type { Receivable } from "@/lib/receivables";

export type SmartCalendarEvent = {
  id: string;
  date: string;
  title: string;
  subtitle: string;
  amount?: number;
  type: "expense" | "receivable" | "goal" | "sale" | "investment";
  status: string;
};

export function getToday() {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return today;
}

export function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function buildClampedDate(year: number, month: number, day: number) {
  const safeMonth = Math.min(Math.max(month, 1), 12);
  const safeDay = Math.min(Math.max(day, 1), daysInMonth(year, safeMonth));
  return new Date(year, safeMonth - 1, safeDay, 12);
}

export function daysUntil(date: Date, today = getToday()) {
  const target = new Date(date);
  target.setHours(12, 0, 0, 0);
  const base = new Date(today);
  base.setHours(12, 0, 0, 0);
  return Math.ceil((target.getTime() - base.getTime()) / 86400000);
}

export function daysLeftInMonth(today = getToday()) {
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 12);
  return Math.max(0, daysUntil(end, today));
}

export function parseGoalDeadline(deadline: string, today = getToday()) {
  const clean = deadline.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [year, month, day] = clean.split("-").map(Number);
    return buildClampedDate(year, month, day);
  }

  const parts = clean.split("/");
  if (parts.length >= 2) {
    const day = Number(parts[0]);
    const month = Number(parts[1]);
    const year = parts[2] ? Number(parts[2]) : today.getFullYear();
    if (day && month) return buildClampedDate(year, month, day);
  }

  return new Date(today.getFullYear(), today.getMonth() + 1, 0, 12);
}

export function formatGoalDeadline(deadline: string, today = getToday()) {
  const parsed = parseGoalDeadline(deadline, today);
  return `${pad(parsed.getDate())}/${pad(parsed.getMonth() + 1)}/${parsed.getFullYear()}`;
}

export function buildSmartEvents({
  expenses,
  receivables,
  goals,
  sales,
  investments = [],
}: {
  expenses: Array<{
    id: string;
    date: string;
    desc: string;
    category: string;
    value: number;
    status: string;
  }>;
  receivables: Receivable[];
  goals: Array<{
    id: string;
    name: string;
    target: number;
    current: number;
    deadline: string;
  }>;
  sales: Array<{
    id: string;
    date: string;
    client: string;
    service: string;
    value: number;
    status: string;
  }>;
  investments?: Array<{
    id: string;
    item: string;
    category: string;
    planned: number;
    spent: number;
    status: string;
  }>;
}) {
  const today = getToday();
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 12);

  return [
    ...expenses.map((expense) => ({
      id: expense.id,
      date: expense.date,
      title: expense.desc,
      subtitle: `${expense.category} · pagamento`,
      amount: expense.value,
      type: "expense" as const,
      status: expense.status,
    })),
    ...receivables.map((receivable) => ({
      id: receivable.id,
      date: receivable.dueDate,
      title: receivable.client,
      subtitle: `${receivable.label} · ${receivable.service}`,
      amount: receivable.amount,
      type: "receivable" as const,
      status: receivable.status,
    })),
    ...goals.map((goal) => ({
      id: goal.id,
      date: toISODate(parseGoalDeadline(goal.deadline, today)),
      title: goal.name,
      subtitle: `Meta: faltam ${Math.max(0, goal.target - goal.current).toLocaleString("pt-BR")}`,
      type: "goal" as const,
      status: goal.current >= goal.target ? "atingida" : "em andamento",
    })),
    ...sales.map((sale) => ({
      id: sale.id,
      date: sale.date,
      title: sale.client,
      subtitle: `${sale.service} · venda registrada`,
      amount: sale.value,
      type: "sale" as const,
      status: sale.status,
    })),
    ...investments
      .filter((investment) => Math.max(investment.planned - investment.spent, 0) > 0)
      .map((investment) => ({
        id: investment.id,
        date: toISODate(endOfMonth),
        title: investment.item,
        subtitle: `${investment.category} · investimento pendente`,
        amount: Math.max(investment.planned - investment.spent, 0),
        type: "investment" as const,
        status: investment.status,
      })),
  ].sort((a, b) => a.date.localeCompare(b.date));
}
