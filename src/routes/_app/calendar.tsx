import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CalendarDays, Clock, Target, Wallet, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  clients as initialClients,
  expenses as initialExpenses,
  goals as initialGoals,
  sales as initialSales,
  services as initialServices,
  formatBRL,
} from "@/lib/mock-data";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { useSyncedReceivables } from "@/hooks/use-synced-receivables";
import { applyGoalMetrics } from "@/lib/goal-metrics";
import {
  calculateCommissionEntries,
  calculatePayableCommissions,
  commissionPaymentsKey,
  type CommissionPayment,
} from "@/lib/commissions";
import {
  calculatePendingServiceCosts,
  calculateServiceCostEntries,
} from "@/lib/service-costs";
import {
  defaultInvestmentContribution,
  investmentContributionKey,
  investmentItems,
  isCashInvestment,
  syncInvestmentCashItem,
  type InvestmentItem,
} from "@/lib/investment-data";
import {
  buildSmartEvents,
  daysLeftInMonth,
  daysUntil,
  getToday,
  parseGoalDeadline,
  toISODate,
  type SmartCalendarEvent,
} from "@/lib/smart-calendar";
import {
  bankTransactionsKey,
  initialBankTransactions,
  isBankInflow,
  isBankOutflow,
  type BankTransaction,
} from "@/lib/bank-data";
import { formatLocalDateBR, parseLocalDate } from "@/lib/date-utils";
export const Route = createFileRoute("/_app/calendar")({
  component: SmartCalendar,
  head: () => ({ meta: [{ title: "Calendário Inteligente - VA" }] }),
});

type Expense = (typeof initialExpenses)[number];
type Goal = (typeof initialGoals)[number];

const eventStyle: Record<SmartCalendarEvent["type"], string> = {
  expense: "bg-destructive/15 text-destructive border-destructive/25",
  receivable: "bg-success/15 text-success border-success/25",
  goal: "bg-primary/15 text-primary border-primary/25",
  sale: "bg-info/15 text-info border-info/25",
  investment: "bg-warning/15 text-warning border-warning/25",
  bank: "bg-primary/15 text-primary border-primary/25",
  "service-cost": "bg-warning/15 text-warning border-warning/25",
  commission: "bg-warning/15 text-warning border-warning/25",
};

function SmartCalendar() {
  const [expenses, setExpenses] = usePersistentState<Expense[]>(
    "va-manager:expenses",
    initialExpenses,
  );
  const [goals] = usePersistentState<Goal[]>("va-manager:goals", initialGoals);
  const [sales] = usePersistentState("va-manager:sales", initialSales);
  const [clients] = usePersistentState("va-manager:clients", initialClients);
  const [services] = usePersistentState("va-manager:services", initialServices);
  const [commissionPayments] = usePersistentState<CommissionPayment[]>(
    commissionPaymentsKey,
    [],
  );
  const [receivables, setReceivables] = useSyncedReceivables({ sales });
  const [investments] = usePersistentState<InvestmentItem[]>(
    "va-manager:investments",
    investmentItems,
  );
  const [bankTransactions] = usePersistentState<BankTransaction[]>(
    bankTransactionsKey,
    initialBankTransactions,
  );
  const [investmentContribution] = usePersistentState(
    investmentContributionKey,
    defaultInvestmentContribution,
  );

  const today = getToday();
  const todayKey = toISODate(today);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const monthLabel = today.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const monthDaysLeft = daysLeftInMonth(today);
  const commissionEntries = useMemo(
    () =>
      calculateCommissionEntries({
        sales,
        services,
        receivables,
        payments: commissionPayments,
      }),
    [commissionPayments, receivables, sales, services],
  );
  const serviceCostEntries = useMemo(
    () => calculateServiceCostEntries({ sales, services, receivables }),
    [receivables, sales, services],
  );
  const syncedGoals = useMemo(
    () =>
      applyGoalMetrics(goals, {
        sales,
        expenses,
        clients,
        receivables,
        commissions: commissionEntries,
        serviceCosts: serviceCostEntries,
      }),
    [clients, commissionEntries, expenses, goals, receivables, sales, serviceCostEntries],
  );

  const events = useMemo(
    () =>
      buildSmartEvents({
        expenses,
        goals: syncedGoals,
        investments: syncInvestmentCashItem(investments, investmentContribution).filter(
          (item) => !isCashInvestment(item),
        ),
        receivables,
        sales,
        bankTransactions,
        serviceCosts: serviceCostEntries,
        commissions: commissionEntries,
      }),
    [
      bankTransactions,
      commissionEntries,
      expenses,
      investmentContribution,
      investments,
      receivables,
      sales,
      serviceCostEntries,
      syncedGoals,
    ],
  );

  const selectedEvents = events.filter((event) => event.date === selectedDate);
  const currentMonthEvents = events.filter((event) => {
    const date = parseLocalDate(event.date);
    return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
  });
  const upcomingEvents = events
    .filter((event) => {
      const distance = daysUntil(parseLocalDate(event.date), today);
      return distance >= 0 && distance <= 30;
    })
    .slice(0, 8);

  const openPayments = expenses.filter((expense) => expense.status !== "pago");
  const openReceivables = receivables.filter((receivable) => receivable.status === "previsto");
  const openBankPayments = bankTransactions.filter(
    (transaction) => transaction.status === "agendado" && isBankOutflow(transaction),
  );
  const openBankReceivables = bankTransactions.filter(
    (transaction) => transaction.status === "agendado" && isBankInflow(transaction),
  );
  const payableAmount =
    openPayments.reduce((sum, expense) => sum + expense.value, 0) +
    openBankPayments.reduce((sum, transaction) => sum + transaction.amount, 0) +
    calculatePayableCommissions(commissionEntries) +
    calculatePendingServiceCosts(serviceCostEntries);
  const receivableAmount =
    openReceivables.reduce((sum, receivable) => sum + receivable.amount, 0) +
    openBankReceivables.reduce((sum, transaction) => sum + transaction.amount, 0);

  const goalInsights = syncedGoals.map((goal) => {
    const deadline = parseGoalDeadline(goal.deadline, today);
    const remainingDays = Math.max(daysUntil(deadline, today), 0);
    const missing = Math.max(goal.target - goal.current, 0);
    const pct = Math.min(100, Math.round((goal.current / Math.max(goal.target, 1)) * 100));
    return {
      ...goal,
      deadline,
      remainingDays,
      missing,
      pct,
      dailyRequired: missing / Math.max(remainingDays, 1),
    };
  });

  const markExpensePaid = (id: string) => {
    setExpenses((current) =>
      current.map((expense) => (expense.id === id ? { ...expense, status: "pago" } : expense)),
    );
    toast.success("Pagamento marcado como feito.");
  };

  const markReceivableReceived = (id: string) => {
    setReceivables((current) =>
      current.map((receivable) =>
        receivable.id === id ? { ...receivable, status: "recebido" } : receivable,
      ),
    );
    toast.success("Recebimento confirmado.");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendário Inteligente"
        subtitle="Hoje, metas, pagamentos, recebíveis e prazos conectados ao sistema inteiro"
        action={
          <Badge variant="outline" className="border-border/60 capitalize text-muted-foreground">
            {today.toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
            })}
          </Badge>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Hoje"
          value={today.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
          icon={CalendarDays}
          accent="primary"
          hint={monthLabel}
        />
        <KpiCard
          label="Dias para acabar o mês"
          value={String(monthDaysLeft)}
          icon={Clock}
          accent="info"
          hint="contando a partir de amanhã"
        />
        <KpiCard
          label="Pagamentos abertos"
          value={formatBRL(payableAmount)}
          icon={AlertTriangle}
          accent="destructive"
          hint={`${openPayments.length + openBankPayments.length} vencimentos`}
        />
        <KpiCard
          label="Recebíveis previstos"
          value={formatBRL(receivableAmount)}
          icon={Wallet}
          accent="success"
          hint={`${openReceivables.length + openBankReceivables.length} parcelas`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.85fr]">
        <Card className="border-border/60 bg-card/60 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-semibold capitalize">{monthLabel}</h3>
              <p className="text-xs text-muted-foreground">
                Clique em um dia para ver pagamentos, recebíveis, vendas e metas
              </p>
            </div>
            <Badge variant="outline" className="border-border/60">
              {currentMonthEvents.length} eventos
            </Badge>
          </div>
          <CalendarGrid
            today={today}
            selectedDate={selectedDate}
            events={currentMonthEvents}
            onSelectDate={setSelectedDate}
          />
        </Card>

        <Card className="border-border/60 bg-card/60 p-5">
          <div className="mb-4">
            <h3 className="font-display text-base font-semibold">
              {formatLocalDateBR(selectedDate, {
                day: "2-digit",
                month: "long",
              })}
            </h3>
            <p className="text-xs text-muted-foreground">Agenda operacional do dia selecionado</p>
          </div>
          <div className="space-y-3">
            {selectedEvents.map((event) => (
              <EventCard
                key={`${event.type}-${event.id}`}
                event={event}
                onPayExpense={markExpensePaid}
                onReceive={markReceivableReceived}
              />
            ))}
            {selectedEvents.length === 0 && (
              <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                Nenhum compromisso para este dia.
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60 bg-card/60 p-5">
          <div className="mb-4">
            <h3 className="font-display text-base font-semibold">Metas em ritmo diário</h3>
            <p className="text-xs text-muted-foreground">
              Quanto falta e quantos dias restam para cada meta
            </p>
          </div>
          <div className="space-y-4">
            {goalInsights.map((goal) => (
              <div
                key={goal.id}
                className="rounded-lg border border-border/60 bg-background/35 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{goal.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {goal.remainingDays} dias restantes · ritmo necessário{" "}
                      {formatGoalValue(goal, goal.dailyRequired)} / dia
                    </p>
                  </div>
                  <Badge
                    className={
                      goal.pct >= 100
                        ? "bg-success/15 text-success hover:bg-success/15"
                        : goal.remainingDays <= monthDaysLeft && goal.pct < 70
                          ? "bg-warning/15 text-warning hover:bg-warning/15"
                          : "bg-primary/15 text-primary hover:bg-primary/15"
                    }
                  >
                    {goal.pct}%
                  </Badge>
                </div>
                <Progress value={goal.pct} className="mt-3 h-2" />
                <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                  <span>Falta {formatGoalValue(goal, goal.missing)}</span>
                  <span>Prazo {goal.deadline.toLocaleDateString("pt-BR")}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="border-border/60 bg-card/60 p-5">
          <div className="mb-4">
            <h3 className="font-display text-base font-semibold">Próximos compromissos</h3>
            <p className="text-xs text-muted-foreground">
              Itens mais próximos dos próximos 30 dias
            </p>
          </div>
          <div className="space-y-3">
            {upcomingEvents.map((event) => (
              <EventCard
                key={`upcoming-${event.type}-${event.id}`}
                event={event}
                compact
                onPayExpense={markExpensePaid}
                onReceive={markReceivableReceived}
              />
            ))}
            {upcomingEvents.length === 0 && (
              <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                Nenhum prazo nos próximos 30 dias.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function CalendarGrid({
  today,
  selectedDate,
  events,
  onSelectDate,
}: {
  today: Date;
  selectedDate: string;
  events: SmartCalendarEvent[];
  onSelectDate: (date: string) => void;
}) {
  const first = new Date(today.getFullYear(), today.getMonth(), 1, 12);
  const last = new Date(today.getFullYear(), today.getMonth() + 1, 0, 12);
  const blanks = first.getDay();
  const days = Array.from({ length: last.getDate() }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), index + 1, 12);
    const key = toISODate(date);
    return { date, key, events: events.filter((event) => event.date === key) };
  });

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 pb-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground sm:gap-2 sm:text-[11px]">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {Array.from({ length: blanks }).map((_, index) => (
          <div key={`blank-${index}`} className="aspect-square" />
        ))}
        {days.map((day) => {
          const isToday = day.key === toISODate(today);
          const isSelected = day.key === selectedDate;
          return (
            <button
              key={day.key}
              className={`flex aspect-square min-h-10 flex-col rounded-lg border p-1 text-left transition hover:border-primary/60 sm:min-h-20 sm:p-2 ${
                isSelected
                  ? "border-primary bg-primary/10"
                  : isToday
                    ? "border-primary/50 bg-primary/5"
                    : "border-border/60 bg-background/35"
              }`}
              onClick={() => onSelectDate(day.key)}
            >
              <span className={isToday ? "text-xs font-semibold text-primary sm:text-sm" : "text-xs sm:text-sm"}>
                {day.date.getDate()}
              </span>
              <div className="mt-auto flex flex-wrap gap-0.5 sm:gap-1">
                {day.events.slice(0, 4).map((event) => (
                  <span
                    key={`${event.type}-${event.id}`}
                    className={`h-1 w-1 rounded-full sm:h-1.5 sm:w-1.5 ${dotClass(event.type)}`}
                  />
                ))}
                {day.events.length > 4 && (
                  <span className="text-[10px] text-muted-foreground">
                    +{day.events.length - 4}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EventCard({
  event,
  compact = false,
  onPayExpense,
  onReceive,
}: {
  event: SmartCalendarEvent;
  compact?: boolean;
  onPayExpense: (id: string) => void;
  onReceive: (id: string) => void;
}) {
  const isActionableExpense = event.type === "expense" && event.status !== "pago";
  const isActionableReceivable = event.type === "receivable" && event.status === "previsto";

  return (
    <div className={`rounded-lg border p-3 ${eventStyle[event.type]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{event.title}</p>
          <p className="text-xs opacity-80">{event.subtitle}</p>
          {!compact && (
            <p className="mt-1 text-[11px] opacity-75">
              {formatLocalDateBR(event.date)} · {event.status}
            </p>
          )}
        </div>
        {event.amount !== undefined && (
          <span className="shrink-0 text-sm font-semibold tabular-nums">
            {formatBRL(event.amount)}
          </span>
        )}
      </div>
      {(isActionableExpense || isActionableReceivable) && (
        <div className="mt-3">
          <Button
            size="sm"
            variant="outline"
            className="h-8 bg-background/70"
            onClick={() => (isActionableExpense ? onPayExpense(event.id) : onReceive(event.id))}
          >
            <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
            {isActionableExpense ? "Marcar pago" : "Confirmar recebimento"}
          </Button>
        </div>
      )}
    </div>
  );
}

function dotClass(type: SmartCalendarEvent["type"]) {
  if (type === "expense") return "bg-destructive";
  if (type === "receivable") return "bg-success";
  if (type === "goal") return "bg-primary";
  if (type === "investment") return "bg-warning";
  if (type === "service-cost" || type === "commission") return "bg-warning";
  if (type === "bank") return "bg-primary";
  return "bg-info";
}

function formatGoalValue(goal: Pick<Goal, "type">, value: number) {
  if (goal.type === "currency") return formatBRL(value);
  if (goal.type === "percent") return `${Math.round(value)}%`;
  return String(Math.round(value));
}
