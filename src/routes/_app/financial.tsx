import { createFileRoute } from "@tanstack/react-router";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DatePickerField } from "@/components/date-picker-field";
import { CollaboratorAvatar } from "@/components/collaborator-avatar";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { OptionSelectField } from "@/components/option-select-field";
import { Card } from "@/components/ui/card";
import { AnimatedDashboardCard } from "@/components/ui/animated-dashboard-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PremiumActionButton } from "@/components/ui/premium-action-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Wallet,
  AlertCircle,
  CreditCard,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Download,
  Filter,
  RotateCcw,
  Pencil,
} from "lucide-react";
import {
  expenses as initialExpenses,
  expenseCategories,
  sales as initialSales,
  sellers as initialSellers,
  services as initialServices,
  formatBRL,
} from "@/lib/mock-data";
import { buildCollaboratorMap, normalizeCollaboratorName } from "@/lib/collaborators";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { useSyncedReceivables } from "@/hooks/use-synced-receivables";
import { filterSaleReceivables } from "@/lib/data-sync";
import {
  commissionAdjustmentsKey,
  calculateCommissionEntries,
  calculatePayableCommissions,
  commissionPaymentsKey,
  getCommissionPaidAmount,
  type CommissionAdjustment,
  type CommissionPayment,
} from "@/lib/commissions";
import { calculatePendingServiceCosts, calculateServiceCostEntries } from "@/lib/service-costs";
import {
  calculateCurrentCash,
  calculateExpensePaidAmount,
  calculateExpenseRemainingAmount,
  calculatePaidExpenses,
  calculateReceivedRevenue,
  cashBalanceKey,
  defaultCashBalance,
} from "@/lib/cash-data";
import {
  formatLocalDateBR,
  parseLocalDate,
  todayLocalISODate,
  toLocalISODate,
} from "@/lib/date-utils";
import {
  bankMethodLabels,
  bankTransactionsKey,
  calculateBankInflows,
  calculateBankOutflows,
  calculateScheduledBankInflows,
  calculateScheduledBankOutflows,
  initialBankTransactions,
  type BankTransaction,
  type BankTransactionStatus,
} from "@/lib/bank-data";
import type { Receivable } from "@/lib/receivables";
import { classifyTransactionText } from "@/lib/transaction-intelligence";
import { formatCurrencyInput, parseCurrencyInput } from "@/lib/currency";

export const Route = createFileRoute("/_app/financial")({
  component: Financial,
  head: () => ({ meta: [{ title: "Gestão Financeira - VA Consultoria" }] }),
});

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    pago: "bg-success/15 text-success",
    pendente: "bg-warning/15 text-warning",
    atrasado: "bg-destructive/15 text-destructive",
    parcial: "bg-info/15 text-info",
    "pago parcialmente": "bg-info/15 text-info",
    recebido: "bg-success/15 text-success",
    previsto: "bg-info/15 text-info",
    realizado: "bg-success/15 text-success",
    agendado: "bg-info/15 text-info",
    cancelado: "bg-muted text-muted-foreground",
    paga: "bg-success/15 text-success",
    a_pagar: "bg-warning/15 text-warning",
    prevista: "bg-info/15 text-info",
  };
  return map[status] ?? "bg-muted text-muted-foreground";
};

const statusLabel = (status: string) => (status === "parcial" ? "pago parcialmente" : status);

const bankStatusLabels: Record<BankTransactionStatus, string> = {
  realizado: "Realizado",
  agendado: "Agendado",
  cancelado: "Cancelado",
};

type Expense = (typeof initialExpenses)[number] & {
  paidAmount?: number;
  paidAt?: string;
  notes?: string;
  recurringSourceId?: string;
  paymentMethod?: ExpensePaymentMethod;
  purchaseDate?: string;
  cardBillDueDate?: string;
};
type MonthlyExpenseRow = Expense & {
  displayId: string;
  sourceId: string;
  isProjectedRecurring?: boolean;
};
type CreditCardBill = {
  dueDate: string;
  expenses: MonthlyExpenseRow[];
  total: number;
  paid: number;
  remaining: number;
};
type Collaborator = (typeof initialSellers)[number] & { role?: string; photoUrl?: string };
type PaymentHistoryEntry = {
  id: string;
  date: string;
  type: string;
  direction: "entrada" | "saida";
  description: string;
  category: string;
  amount: number;
  status: string;
  notes?: string;
};

const emptyExpenseForm = {
  date: todayLocalISODate(),
  desc: "",
  category: "Marketing",
  value: "",
  paidAmount: "",
  status: "pendente",
  recurring: "true",
  notes: "",
  paymentMethod: "direct" as ExpensePaymentMethod,
};

type ExpensePaymentMethod = "direct" | "credit_card";

const expenseStatusOptions = ["pendente", "pago", "atrasado", "parcial"];
const recurringOptions = ["true", "false"];
const expensePaymentMethodOptions: ExpensePaymentMethod[] = ["direct", "credit_card"];
const expensePaymentMethodLabels: Record<ExpensePaymentMethod, string> = {
  direct: "Pagamento direto",
  credit_card: "Cartão de crédito",
};
const recurringLabels: Record<string, string> = {
  true: "Recorrente",
  false: "Avulsa",
};

function getMonthKey(date: string) {
  return date.slice(0, 7);
}

function getMonthDate(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1, 12);
}

function shiftMonthKey(monthKey: string, offset: number) {
  const date = getMonthDate(monthKey);
  date.setMonth(date.getMonth() + offset);
  return toLocalISODate(date).slice(0, 7);
}

function formatMonthLabel(monthKey: string) {
  const label = getMonthDate(monthKey).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  return label.charAt(0).toLocaleUpperCase("pt-BR") + label.slice(1);
}

function isDateInMonth(date: string | undefined, monthKey: string) {
  return Boolean(date) && getMonthKey(date ?? "") === monthKey;
}

function dateInSelectedMonth(originalDate: string, monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const original = parseLocalDate(originalDate);
  const lastDay = new Date(year, month, 0, 12).getDate();
  const day = Math.min(original.getDate(), lastDay);
  return toLocalISODate(new Date(year, month - 1, day, 12));
}

function isCreditCardExpense(expense: Pick<Expense, "paymentMethod">) {
  return expense.paymentMethod === "credit_card";
}

function getCreditCardBillDueDate(purchaseDate: string) {
  const safePurchaseDate = /^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)
    ? purchaseDate
    : todayLocalISODate();
  const purchase = parseLocalDate(safePurchaseDate);
  return toLocalISODate(new Date(purchase.getFullYear(), purchase.getMonth() + 1, 1, 12));
}

function getProjectedCardPurchaseDate(sourcePurchaseDate: string, billMonth: string) {
  const purchaseMonth = shiftMonthKey(billMonth, -1);
  return dateInSelectedMonth(sourcePurchaseDate, purchaseMonth);
}

function getExpensePaymentMethod(expense: Pick<Expense, "paymentMethod">): ExpensePaymentMethod {
  return expense.paymentMethod === "credit_card" ? "credit_card" : "direct";
}

function buildMonthlyExpenseRows(expenses: Expense[], selectedMonth: string): MonthlyExpenseRow[] {
  const concreteRows = expenses
    .filter((expense) => getMonthKey(expense.date) === selectedMonth)
    .map((expense) => ({
      ...expense,
      displayId: expense.id,
      sourceId: expense.recurringSourceId ?? expense.id,
    }));

  const concreteRecurringSourceIds = new Set(
    concreteRows.map((expense) => expense.recurringSourceId).filter(Boolean),
  );

  const projectedRows = expenses
    .filter((expense) => {
      if (!expense.recurring || expense.recurringSourceId) return false;
      const expenseMonth = getMonthKey(expense.date);
      return expenseMonth < selectedMonth && !concreteRecurringSourceIds.has(expense.id);
    })
    .map((expense) => ({
      ...expense,
      id: `${expense.id}:${selectedMonth}`,
      displayId: `${expense.id}:${selectedMonth}`,
      sourceId: expense.id,
      recurringSourceId: expense.id,
      date: dateInSelectedMonth(expense.date, selectedMonth),
      purchaseDate: isCreditCardExpense(expense)
        ? getProjectedCardPurchaseDate(expense.purchaseDate ?? expense.date, selectedMonth)
        : expense.purchaseDate,
      cardBillDueDate: isCreditCardExpense(expense)
        ? dateInSelectedMonth(expense.cardBillDueDate ?? expense.date, selectedMonth)
        : expense.cardBillDueDate,
      status: "pendente",
      paidAmount: undefined,
      paidAt: undefined,
      isProjectedRecurring: true,
    }));

  return [...concreteRows, ...projectedRows].sort((a, b) => {
    const dateDiff = a.date.localeCompare(b.date);
    return dateDiff || a.desc.localeCompare(b.desc, "pt-BR");
  });
}

function buildCreditCardBills(expenses: MonthlyExpenseRow[]): CreditCardBill[] {
  const grouped = new Map<string, MonthlyExpenseRow[]>();

  expenses.filter(isCreditCardExpense).forEach((expense) => {
    const dueDate = expense.cardBillDueDate ?? expense.date;
    grouped.set(dueDate, [...(grouped.get(dueDate) ?? []), expense]);
  });

  return Array.from(grouped.entries())
    .map(([dueDate, billExpenses]) => {
      const total = billExpenses.reduce((sum, expense) => sum + expense.value, 0);
      const paid = billExpenses.reduce(
        (sum, expense) => sum + calculateExpensePaidAmount(expense),
        0,
      );

      return {
        dueDate,
        expenses: billExpenses,
        total,
        paid,
        remaining: Math.max(total - paid, 0),
      };
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

function getPaymentHistoryStatus(paid: number, total: number, fallback = "Pago") {
  if (paid > 0 && paid < total) return "Parcial";
  return fallback;
}

function MonthSelector({
  month,
  onMonthChange,
}: {
  month: string;
  onMonthChange: (month: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => onMonthChange(shiftMonthKey(month, -1))}
        aria-label="Mês anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Input
        type="month"
        value={month}
        onChange={(event) => {
          if (event.target.value) onMonthChange(event.target.value);
        }}
        className="h-9 w-40"
        aria-label="Selecionar mês"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => onMonthChange(shiftMonthKey(month, 1))}
        aria-label="Próximo mês"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onMonthChange(todayLocalISODate().slice(0, 7))}
      >
        Mês atual
      </Button>
    </div>
  );
}

function Financial() {
  const [sales, setSales] = usePersistentState("va-manager:sales", initialSales);
  const [expenses, setExpenses] = usePersistentState<Expense[]>(
    "va-manager:expenses",
    initialExpenses,
  );
  const [collaborators] = usePersistentState<Collaborator[]>(
    "va-manager:collaborators",
    initialSellers,
  );
  const [services] = usePersistentState("va-manager:services", initialServices);
  const [commissionPayments, setCommissionPayments] = usePersistentState<CommissionPayment[]>(
    commissionPaymentsKey,
    [],
  );
  const [commissionAdjustments] = usePersistentState<CommissionAdjustment[]>(
    commissionAdjustmentsKey,
    [],
  );
  const [receivables, setReceivables] = useSyncedReceivables({ sales });
  const [bankTransactions, setBankTransactions] = usePersistentState<BankTransaction[]>(
    bankTransactionsKey,
    initialBankTransactions,
  );
  const [cashBase, setCashBase] = usePersistentState(cashBalanceKey, defaultCashBalance);
  const [categories, setCategories] = usePersistentState(
    "va-manager:expense-categories",
    expenseCategories,
  );
  const [query, setQuery] = useState("");
  const [activeFinancialTab, setActiveFinancialTab] = useState("despesas");
  const [open, setOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editingRecurringSourceId, setEditingRecurringSourceId] = useState<string | null>(null);
  const [selectedExpenseMonth, setSelectedExpenseMonth] = useState(todayLocalISODate().slice(0, 7));
  const [form, setForm] = useState(emptyExpenseForm);
  const [cashForm, setCashForm] = useState(formatCurrencyInput(defaultCashBalance));
  const smartExpenseSuggestion = useMemo(
    () =>
      classifyTransactionText({
        description: form.desc,
        amount: -parseCurrencyInput(form.value),
        fallbackType: "saida",
        fallbackMethod: "pagamento",
        fallbackCategory: form.category,
      }),
    [form.category, form.desc, form.value],
  );

  const monthlyExpenses = useMemo(
    () => buildMonthlyExpenseRows(expenses, selectedExpenseMonth),
    [expenses, selectedExpenseMonth],
  );
  const selectedMonthCreditCardBills = useMemo(
    () => buildCreditCardBills(monthlyExpenses),
    [monthlyExpenses],
  );
  const persistedCreditCardBills = useMemo(() => {
    const rows = expenses.map((expense) => ({
      ...expense,
      displayId: expense.id,
      sourceId: expense.recurringSourceId ?? expense.id,
    }));
    return buildCreditCardBills(rows);
  }, [expenses]);
  const nextOpenCreditCardBill = useMemo(
    () =>
      persistedCreditCardBills.find(
        (bill) => bill.remaining > 0 && bill.dueDate >= todayLocalISODate(),
      ) ?? persistedCreditCardBills.find((bill) => bill.remaining > 0),
    [persistedCreditCardBills],
  );

  const filteredExpenses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return monthlyExpenses;

    return monthlyExpenses.filter((expense) =>
      [
        expense.date,
        expense.desc,
        expense.category,
        expense.status,
        expense.recurring || expense.recurringSourceId ? "recorrente" : "avulsa",
        expense.notes ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [monthlyExpenses, query]);

  const filteredSales = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const monthSales = sales.filter((sale) => isDateInMonth(sale.date, selectedExpenseMonth));
    if (!normalizedQuery) return monthSales;

    return monthSales.filter((sale) =>
      [sale.date, sale.client, sale.service, sale.status, sale.origin, sale.seller]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [query, sales, selectedExpenseMonth]);

  const filteredReceivables = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const monthReceivables = receivables.filter((item) =>
      isDateInMonth(item.dueDate, selectedExpenseMonth),
    );
    if (!normalizedQuery) return monthReceivables;

    return monthReceivables.filter((item) =>
      [item.client, item.service, item.seller, item.origin, item.label, item.status, item.dueDate]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [query, receivables, selectedExpenseMonth]);
  const filteredBankTransactions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const monthTransactions = bankTransactions.filter((transaction) =>
      isDateInMonth(transaction.date, selectedExpenseMonth),
    );
    if (!normalizedQuery) return monthTransactions;

    return monthTransactions.filter((transaction) =>
      [
        transaction.date,
        transaction.description,
        transaction.category,
        transaction.status,
        transaction.method,
        transaction.counterparty,
        transaction.document,
        transaction.notes,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [bankTransactions, query, selectedExpenseMonth]);
  const collaboratorsByName = useMemo(() => buildCollaboratorMap(collaborators), [collaborators]);

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
  const filteredCommissions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const monthCommissions = commissionEntries.filter((entry) =>
      isDateInMonth(entry.dueDate, selectedExpenseMonth),
    );
    if (!normalizedQuery) return monthCommissions;

    return monthCommissions.filter((entry) =>
      [
        entry.saleDate,
        entry.dueDate,
        entry.client,
        entry.seller,
        entry.service,
        entry.label,
        entry.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [commissionEntries, query, selectedExpenseMonth]);
  const filteredServiceCosts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const monthServiceCosts = serviceCostEntries.filter((entry) =>
      isDateInMonth(entry.date, selectedExpenseMonth),
    );
    if (!normalizedQuery) return monthServiceCosts;

    return monthServiceCosts.filter((entry) =>
      [entry.date, entry.client, entry.seller, entry.service, entry.status]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [query, selectedExpenseMonth, serviceCostEntries]);
  const payableCommissions = calculatePayableCommissions(commissionEntries);
  const pendingServiceCosts = calculatePendingServiceCosts(serviceCostEntries);
  const bankInflows = calculateBankInflows(bankTransactions);
  const bankOutflows = calculateBankOutflows(bankTransactions);
  const scheduledBankInflows = calculateScheduledBankInflows(bankTransactions);
  const scheduledBankOutflows = calculateScheduledBankOutflows(bankTransactions);
  const bankCashImpact = bankInflows - bankOutflows;
  const totalReceitas = calculateReceivedRevenue(sales, receivables) + bankInflows;
  const totalDespesas =
    calculatePaidExpenses(expenses, commissionEntries, serviceCostEntries) + bankOutflows;
  const currentCash = calculateCurrentCash(
    cashBase,
    sales,
    expenses,
    receivables,
    bankTransactions,
    commissionEntries,
    serviceCostEntries,
  );
  const aPagar =
    expenses
      .filter((expense) => ["pendente", "atrasado", "parcial"].includes(expense.status))
      .reduce((sum, expense) => sum + calculateExpenseRemainingAmount(expense), 0) +
    scheduledBankOutflows +
    payableCommissions +
    pendingServiceCosts;
  const aReceber =
    receivables
      .filter((receivable) => receivable.status === "previsto")
      .reduce((sum, receivable) => sum + receivable.amount, 0) +
    sales
      .filter((sale) => sale.status !== "pago" && !saleIdsWithReceivables.has(sale.id))
      .reduce((sum, sale) => sum + sale.value, 0) +
    scheduledBankInflows;
  const projectedCash = currentCash + aReceber - aPagar;
  const selectedMonthTotal = monthlyExpenses.reduce((sum, expense) => sum + expense.value, 0);
  const selectedMonthPaid = monthlyExpenses.reduce(
    (sum, expense) => sum + calculateExpensePaidAmount(expense),
    0,
  );
  const selectedMonthPending = monthlyExpenses.reduce(
    (sum, expense) => sum + calculateExpenseRemainingAmount(expense),
    0,
  );
  const selectedMonthRecurringCount = monthlyExpenses.filter(
    (expense) => expense.recurring || expense.recurringSourceId,
  ).length;
  const selectedMonthSalesTotal = filteredSales.reduce((sum, sale) => sum + sale.value, 0);
  const selectedMonthReceivablesTotal = filteredReceivables.reduce(
    (sum, receivable) => sum + receivable.amount,
    0,
  );
  const selectedMonthCommissionsTotal = filteredCommissions.reduce(
    (sum, entry) => sum + entry.amount,
    0,
  );
  const selectedMonthServiceCostsTotal = filteredServiceCosts.reduce(
    (sum, entry) => sum + entry.amount,
    0,
  );
  const selectedMonthBankInflows = filteredBankTransactions
    .filter((transaction) => transaction.status === "realizado" && transaction.type === "entrada")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const selectedMonthBankOutflows = filteredBankTransactions
    .filter((transaction) => transaction.status === "realizado" && transaction.type === "saida")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const selectedMonthScheduledBankInflows = filteredBankTransactions
    .filter((transaction) => transaction.status === "agendado" && transaction.type === "entrada")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const selectedMonthScheduledBankOutflows = filteredBankTransactions
    .filter((transaction) => transaction.status === "agendado" && transaction.type === "saida")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const selectedMonthBankImpact = filteredBankTransactions.reduce(
    (sum, transaction) =>
      transaction.status === "cancelado"
        ? sum
        : sum + (transaction.type === "entrada" ? transaction.amount : -transaction.amount),
    0,
  );
  const paymentHistory = useMemo<PaymentHistoryEntry[]>(() => {
    const adjustmentById = new Map(
      commissionAdjustments.map((adjustment) => [adjustment.id, adjustment]),
    );
    const saleIdsWithReceivablesForHistory = new Set(
      receivables.map((receivable) => receivable.sourceId).filter(Boolean),
    );

    const expensePayments = expenses.flatMap((expense) => {
      const paidAmount = calculateExpensePaidAmount(expense);
      if (paidAmount <= 0) return [];

      return [
        {
          id: `expense:${expense.id}`,
          date: expense.paidAt ?? expense.date,
          type: "Despesa",
          direction: "saida" as const,
          description: expense.desc,
          category: expense.category,
          amount: paidAmount,
          status: getPaymentHistoryStatus(paidAmount, expense.value),
          notes: expense.notes,
        },
      ];
    });

    const commissionPaymentsHistory = commissionEntries.flatMap((entry) => {
      const paidAmount = getCommissionPaidAmount(entry);
      if (paidAmount <= 0) return [];
      const adjustment = adjustmentById.get(entry.id);

      return [
        {
          id: `commission:${entry.id}`,
          date: entry.paidAt ?? adjustment?.updatedAt ?? entry.dueDate,
          type: "Comissão",
          direction: "saida" as const,
          description: `${entry.seller} - ${entry.client}`,
          category: entry.label,
          amount: paidAmount,
          status: getPaymentHistoryStatus(paidAmount, entry.amount, "Paga"),
          notes: adjustment?.description ?? entry.triggerLabel,
        },
      ];
    });

    const receivablePayments = receivables.flatMap((receivable) => {
      if (receivable.status !== "recebido") return [];

      return [
        {
          id: `receivable:${receivable.id}`,
          date: receivable.receivedAt ?? receivable.dueDate,
          type: "Receita",
          direction: "entrada" as const,
          description: `${receivable.client} - ${receivable.label}`,
          category: receivable.service,
          amount: receivable.amount,
          status: "Recebido",
          notes: `Vendedor: ${receivable.seller}`,
        },
      ];
    });

    const directSalePayments = sales.flatMap((sale) => {
      if (sale.status !== "pago" || saleIdsWithReceivablesForHistory.has(sale.id)) return [];

      return [
        {
          id: `sale:${sale.id}`,
          date: sale.date,
          type: "Venda",
          direction: "entrada" as const,
          description: sale.client,
          category: sale.service,
          amount: sale.value,
          status: "Recebido",
          notes: `Vendedor: ${sale.seller}`,
        },
      ];
    });

    const serviceCostPayments = serviceCostEntries.flatMap((entry) => {
      if (entry.status !== "realizado") return [];

      return [
        {
          id: `service-cost:${entry.id}`,
          date: entry.date,
          type: "Custo do serviço",
          direction: "saida" as const,
          description: `${entry.service} - ${entry.client}`,
          category: entry.seller,
          amount: entry.amount,
          status: "Realizado",
          notes: `Venda: ${formatBRL(entry.saleValue)}`,
        },
      ];
    });

    const bankPayments = bankTransactions.flatMap((transaction) => {
      if (transaction.status !== "realizado") return [];

      return [
        {
          id: `bank:${transaction.id}`,
          date: transaction.date,
          type: transaction.type === "entrada" ? "Banco - entrada" : "Banco - saída",
          direction: transaction.type,
          description: transaction.description,
          category: transaction.category,
          amount: transaction.amount,
          status: "Realizado",
          notes: transaction.notes ?? transaction.counterparty,
        },
      ];
    });

    return [
      ...expensePayments,
      ...commissionPaymentsHistory,
      ...receivablePayments,
      ...directSalePayments,
      ...serviceCostPayments,
      ...bankPayments,
    ].sort((a, b) => {
      const dateDiff = b.date.localeCompare(a.date);
      return dateDiff || a.description.localeCompare(b.description, "pt-BR");
    });
  }, [
    bankTransactions,
    commissionAdjustments,
    commissionEntries,
    expenses,
    receivables,
    sales,
    serviceCostEntries,
  ]);
  const filteredPaymentHistory = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    const monthHistory = paymentHistory.filter((entry) =>
      isDateInMonth(entry.date, selectedExpenseMonth),
    );
    if (!normalizedQuery) return monthHistory;

    return monthHistory.filter((entry) =>
      [entry.date, entry.type, entry.description, entry.category, entry.status, entry.notes ?? ""]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(normalizedQuery),
    );
  }, [paymentHistory, query, selectedExpenseMonth]);
  const paymentHistoryInflow = filteredPaymentHistory
    .filter((entry) => entry.direction === "entrada")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const paymentHistoryOutflow = filteredPaymentHistory
    .filter((entry) => entry.direction === "saida")
    .reduce((sum, entry) => sum + entry.amount, 0);

  useEffect(() => {
    setCashForm(formatCurrencyInput(currentCash));
  }, [currentCash]);

  const updateForm = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const hasCategory = (category: string) =>
    categories.some(
      (item) =>
        item.trim().toLocaleLowerCase("pt-BR") === category.trim().toLocaleLowerCase("pt-BR"),
    );

  const saveCategoryIfMissing = (category: string) => {
    const normalizedCategory = category.trim() || "Outros";
    setCategories((current) => {
      const alreadyExists = current.some(
        (item) =>
          item.trim().toLocaleLowerCase("pt-BR") === normalizedCategory.toLocaleLowerCase("pt-BR"),
      );

      return alreadyExists ? current : [...current, normalizedCategory];
    });
    return normalizedCategory;
  };

  const applySuggestedCategory = (category: string, notify = true) => {
    const normalizedCategory = category.trim() || "Outros";
    const categoryAlreadyExists = hasCategory(normalizedCategory);

    saveCategoryIfMissing(normalizedCategory);
    updateForm("category", normalizedCategory);

    if (notify) {
      toast.success(
        categoryAlreadyExists
          ? `Categoria "${normalizedCategory}" aplicada.`
          : `Categoria "${normalizedCategory}" criada e aplicada.`,
      );
    }
  };

  const openCreateExpense = () => {
    setEditingExpenseId(null);
    setEditingRecurringSourceId(null);
    setForm(emptyExpenseForm);
    setOpen(true);
  };

  const openEditExpense = (expense: MonthlyExpenseRow) => {
    setEditingExpenseId(expense.isProjectedRecurring ? null : expense.id);
    setEditingRecurringSourceId(
      expense.isProjectedRecurring ? expense.sourceId : (expense.recurringSourceId ?? null),
    );
    setForm({
      date: isCreditCardExpense(expense) ? (expense.purchaseDate ?? expense.date) : expense.date,
      desc: expense.desc,
      category: expense.category,
      value: formatCurrencyInput(expense.value),
      paidAmount: expense.paidAmount ? formatCurrencyInput(expense.paidAmount) : "",
      status: expense.status,
      recurring: String(expense.isProjectedRecurring ? false : expense.recurring),
      notes: expense.notes ?? "",
      paymentMethod: getExpensePaymentMethod(expense),
    });
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
    setEditingExpenseId(null);
    setEditingRecurringSourceId(null);
    setForm(emptyExpenseForm);
  };

  const submitExpense = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const desc = form.desc.trim();
    if (!desc) return;
    const category = saveCategoryIfMissing(form.category);
    const value = parseCurrencyInput(form.value);
    const existingExpense = editingExpenseId
      ? expenses.find((item) => item.id === editingExpenseId)
      : undefined;
    const isCardPayment = form.paymentMethod === "credit_card";
    const typedPaidAmount = parseCurrencyInput(form.paidAmount);
    const cardPaymentWasSettled = Boolean(
      isCardPayment && existingExpense && calculateExpenseRemainingAmount(existingExpense) === 0,
    );
    const paidAmount = isCardPayment
      ? cardPaymentWasSettled
        ? value
        : 0
      : form.status === "pago"
        ? value
        : Math.min(Math.max(typedPaidAmount, 0), value);
    const status =
      isCardPayment && !cardPaymentWasSettled
        ? "pendente"
        : value > 0 && paidAmount >= value
          ? "pago"
          : paidAmount > 0
            ? "parcial"
            : form.status === "parcial"
              ? "pendente"
              : form.status;
    const expense: Expense = {
      id: editingExpenseId ?? `e-${Date.now()}`,
      date: isCardPayment ? getCreditCardBillDueDate(form.date) : form.date,
      desc,
      category,
      value,
      paidAmount: paidAmount > 0 ? paidAmount : undefined,
      paidAt: paidAmount > 0 ? (existingExpense?.paidAt ?? todayLocalISODate()) : undefined,
      status,
      recurring: editingRecurringSourceId ? false : form.recurring === "true",
      recurringSourceId: editingRecurringSourceId ?? undefined,
      notes: form.notes.trim() || undefined,
      paymentMethod: form.paymentMethod,
      purchaseDate: isCardPayment ? form.date : undefined,
      cardBillDueDate: isCardPayment ? getCreditCardBillDueDate(form.date) : undefined,
    };

    setExpenses((current) =>
      editingExpenseId
        ? current.map((item) => (item.id === editingExpenseId ? expense : item))
        : [expense, ...current],
    );

    if (isCardPayment && expense.cardBillDueDate) {
      setSelectedExpenseMonth(expense.cardBillDueDate.slice(0, 7));
    }

    closeDialog();
    toast.success(editingExpenseId ? "Despesa atualizada." : "Despesa cadastrada.");
  };

  const materializeRecurringExpense = (expense: MonthlyExpenseRow, status: string) => {
    const paidAmount = status === "pago" ? expense.value : undefined;
    const nextExpense: Expense = {
      id: `e-${Date.now()}-${expense.sourceId}`,
      date: expense.date,
      desc: expense.desc,
      category: expense.category,
      value: expense.value,
      paidAmount,
      paidAt: (paidAmount ?? 0) > 0 ? todayLocalISODate() : undefined,
      status,
      recurring: false,
      recurringSourceId: expense.sourceId,
      notes: expense.notes,
      paymentMethod: expense.paymentMethod,
      purchaseDate: expense.purchaseDate,
      cardBillDueDate: expense.cardBillDueDate,
    };
    setExpenses((current) => [nextExpense, ...current]);
  };

  const updateExpenseStatus = (expenseOrId: MonthlyExpenseRow | string, status: string) => {
    if (typeof expenseOrId !== "string" && isCreditCardExpense(expenseOrId)) {
      setActiveFinancialTab("cartao");
      toast.info("Despesas no cartão são baixadas pela fatura para não duplicar a saída do caixa.");
      return;
    }

    if (typeof expenseOrId !== "string" && expenseOrId.isProjectedRecurring) {
      if (status === "pendente") {
        toast.info("Essa despesa recorrente já está pendente neste mês.");
        return;
      }
      materializeRecurringExpense(expenseOrId, status);
      toast.success(
        `Despesa recorrente de ${formatMonthLabel(selectedExpenseMonth)} marcada como ${status}.`,
      );
      return;
    }

    const id = typeof expenseOrId === "string" ? expenseOrId : expenseOrId.id;
    setExpenses((current) =>
      current.map((expense) => {
        if (expense.id !== id) return expense;
        if (status === "pago") {
          return { ...expense, status, paidAmount: expense.value, paidAt: todayLocalISODate() };
        }
        if (status === "pendente" || status === "atrasado") {
          return { ...expense, status, paidAmount: undefined, paidAt: undefined };
        }
        return { ...expense, status };
      }),
    );
    toast.success(`Despesa marcada como ${status}.`);
  };

  const updateCreditCardBillStatus = (bill: CreditCardBill, paid: boolean) => {
    const paymentDate = todayLocalISODate();
    const concreteIds = new Set(
      bill.expenses.filter((expense) => !expense.isProjectedRecurring).map((expense) => expense.id),
    );
    const projectedExpenses = bill.expenses.filter((expense) => expense.isProjectedRecurring);

    setExpenses((current) => {
      const updated = current.map((expense) => {
        if (!concreteIds.has(expense.id)) return expense;
        return paid
          ? { ...expense, status: "pago", paidAmount: expense.value, paidAt: paymentDate }
          : { ...expense, status: "pendente", paidAmount: undefined, paidAt: undefined };
      });

      if (!paid || projectedExpenses.length === 0) return updated;

      const materialized = projectedExpenses.map(
        (expense, index): Expense => ({
          id: `e-${Date.now()}-${index}-${expense.sourceId}`,
          date: expense.date,
          desc: expense.desc,
          category: expense.category,
          value: expense.value,
          status: "pago",
          paidAmount: expense.value,
          paidAt: paymentDate,
          recurring: false,
          recurringSourceId: expense.sourceId,
          notes: expense.notes,
          paymentMethod: "credit_card",
          purchaseDate: expense.purchaseDate,
          cardBillDueDate: expense.cardBillDueDate ?? expense.date,
        }),
      );

      return [...materialized, ...updated];
    });

    toast.success(
      paid
        ? `Fatura de ${formatMonthLabel(getMonthKey(bill.dueDate))} paga e descontada do caixa.`
        : `Fatura de ${formatMonthLabel(getMonthKey(bill.dueDate))} reaberta.`,
    );
  };

  const removeExpense = (expense: MonthlyExpenseRow) => {
    if (expense.isProjectedRecurring) {
      toast.info("Essa é uma recorrência projetada. Exclua ou edite a despesa original.");
      return;
    }
    const id = expense.id;
    setExpenses((current) => current.filter((expense) => expense.id !== id));
    toast.success("Despesa excluída.");
  };

  const saveCashBalance = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextCurrentCash = parseCurrencyInput(cashForm);
    if (nextCurrentCash < 0) {
      toast.error("Informe um caixa igual ou maior que zero.");
      return;
    }

    setCashBase(nextCurrentCash - totalReceitas + totalDespesas);
    setCashForm(formatCurrencyInput(nextCurrentCash));
    toast.success("Caixa atualizado.");
  };

  const updateReceivableStatus = (id: string, status: Receivable["status"]) => {
    const target = receivables.find((receivable) => receivable.id === id);
    if (!target) return;
    const nextReceivables = receivables.map((receivable) =>
      receivable.id === id
        ? {
            ...receivable,
            status,
            receivedAt:
              status === "recebido" ? (receivable.receivedAt ?? todayLocalISODate()) : undefined,
          }
        : receivable,
    );
    setReceivables(nextReceivables);

    const related = nextReceivables.filter((receivable) => receivable.sourceId === target.sourceId);
    if (related.length) {
      const nextSaleStatus = related.every((receivable) => receivable.status === "recebido")
        ? "pago"
        : related.some((receivable) => receivable.status === "recebido")
          ? "pago parcialmente"
          : "pendente";
      setSales((current) =>
        current.map((sale) =>
          sale.id === target.sourceId ? { ...sale, status: nextSaleStatus } : sale,
        ),
      );
    }

    toast.success(status === "recebido" ? "Receita marcada como recebida." : "Receita prevista.");
  };

  const markCommissionAsPaid = (id: string) => {
    const target = commissionEntries.find((entry) => entry.id === id);
    if (!target) return;
    if (target.status === "prevista") {
      toast.warning("Essa comissão ainda depende do recebimento do cliente.");
      return;
    }

    setCommissionPayments((current) => {
      if (current.some((payment) => payment.id === id)) return current;
      return [{ id, paidAt: todayLocalISODate() }, ...current];
    });
    toast.success("Comissão marcada como paga e abatida do caixa.");
  };

  const markCommissionAsPayable = (id: string) => {
    setCommissionPayments((current) => current.filter((payment) => payment.id !== id));
    toast.success("Comissão voltou para a pagar.");
  };

  const updateBankTransactionStatus = (id: string, status: BankTransactionStatus) => {
    setBankTransactions((current) =>
      current.map((transaction) =>
        transaction.id === id ? { ...transaction, status } : transaction,
      ),
    );
    toast.success(`Movimentação bancária marcada como ${bankStatusLabels[status].toLowerCase()}.`);
  };

  const removeBankTransaction = (id: string) => {
    setBankTransactions((current) => current.filter((transaction) => transaction.id !== id));
    toast.success("Movimentação bancária removida do financeiro e do banco.");
  };

  const addCategory = () => {
    const category = window.prompt("Nome da nova categoria financeira");
    if (!category?.trim()) return;
    setCategories((current) => [...new Set([...current, category.trim()])]);
    toast.success("Categoria criada.");
  };

  const exportCsv = () => {
    const rows = [
      [
        "Tipo",
        "Data",
        "Descrição",
        "Categoria/Serviço",
        "Valor",
        "Já pago",
        "Status",
        "Observações",
        "Forma de pagamento",
        "Data da compra",
        "Vencimento da fatura",
      ],
      [
        "Caixa",
        todayLocalISODate(),
        "Caixa atual",
        "Operacional",
        String(currentCash),
        "",
        "atual",
        "",
        "",
        "",
        "",
      ],
      ...expenses.map((expense) => [
        "Despesa",
        expense.date,
        expense.desc,
        expense.category,
        String(expense.value),
        String(calculateExpensePaidAmount(expense)),
        expense.status,
        expense.notes ?? "",
        expensePaymentMethodLabels[getExpensePaymentMethod(expense)],
        expense.purchaseDate ?? "",
        expense.cardBillDueDate ?? "",
      ]),
      ...sales.map((sale) => [
        "Receita",
        sale.date,
        sale.client,
        sale.service,
        String(sale.value),
        "",
        sale.status,
        "",
        "",
        "",
        "",
      ]),
      ...bankTransactions.map((transaction) => [
        transaction.type === "entrada" ? "Banco - entrada" : "Banco - saída",
        transaction.date,
        transaction.description,
        transaction.category,
        String(transaction.amount),
        "",
        transaction.status,
        transaction.notes ?? "",
        "",
        "",
        "",
      ]),
      ...paymentHistory.map((entry) => [
        `Histórico - ${entry.direction === "entrada" ? "entrada" : "saída"}`,
        entry.date,
        entry.description,
        entry.category,
        String(entry.amount),
        String(entry.amount),
        entry.status,
        entry.notes ?? "",
        "",
        "",
        "",
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "financeiro-va-consultoria.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestão Financeira"
        subtitle="Receitas, despesas, contas a pagar e a receber"
        action={
          <>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setExpenses(initialExpenses);
                toast.success("Despesas de demonstração restauradas.");
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Restaurar despesas
            </Button>
            <Dialog
              open={open}
              onOpenChange={(value) => {
                if (value) {
                  setOpen(true);
                } else {
                  closeDialog();
                }
              }}
            >
              <DialogTrigger asChild>
                <PremiumActionButton
                  icon={<Plus />}
                  title="Nova despesa"
                  subtitle="Adicionar lançamento"
                  size="sm"
                  onClick={openCreateExpense}
                />
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <form onSubmit={submitExpense}>
                  <DialogHeader>
                    <DialogTitle>
                      {editingExpenseId ? "Editar despesa" : "Nova despesa"}
                    </DialogTitle>
                    <DialogDescription>
                      Despesas ficam salvas neste navegador e recalculam os indicadores financeiros.
                      No valor, use 5000, 5.000 ou 5.000,50.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <DatePickerField
                      label={form.paymentMethod === "credit_card" ? "Data da compra" : "Data"}
                      value={form.date}
                      onChange={(value) => updateForm("date", value)}
                      required
                    />
                    <OptionSelectField
                      label="Forma de pagamento"
                      value={form.paymentMethod}
                      onChange={(value) => updateForm("paymentMethod", value)}
                      options={expensePaymentMethodOptions}
                      labels={expensePaymentMethodLabels}
                    />
                    <FinanceField
                      label="Descrição"
                      value={form.desc}
                      onChange={(value) => updateForm("desc", value)}
                      onBlur={() => {
                        if (smartExpenseSuggestion.confidence >= 0.78) {
                          applySuggestedCategory(smartExpenseSuggestion.category, false);
                        }
                      }}
                      required
                    />
                    {form.desc.trim() && (
                      <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 text-xs md:col-span-2">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <span className="text-muted-foreground">
                            Sugestão inteligente:{" "}
                            <span className="font-semibold text-foreground">
                              {smartExpenseSuggestion.category}
                            </span>{" "}
                            <span className="text-primary">
                              {Math.round(smartExpenseSuggestion.confidence * 100)}%
                            </span>
                            <span className="block">{smartExpenseSuggestion.reason}</span>
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => applySuggestedCategory(smartExpenseSuggestion.category)}
                          >
                            Aplicar categoria
                          </Button>
                        </div>
                      </div>
                    )}
                    <OptionSelectField
                      label="Categoria"
                      value={form.category}
                      onChange={(value) => updateForm("category", value)}
                      options={categories}
                    />
                    <FinanceField
                      label="Valor"
                      value={form.value}
                      onChange={(value) => updateForm("value", value)}
                      onBlur={() =>
                        updateForm("value", formatCurrencyInput(parseCurrencyInput(form.value)))
                      }
                      placeholder="Ex: 5000 ou 5.000,50"
                    />
                    {form.paymentMethod === "credit_card" ? (
                      <div className="rounded-lg border border-info/25 bg-info/10 p-3 md:col-span-2">
                        <div className="flex items-start gap-3">
                          <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-info" />
                          <div>
                            <p className="text-sm font-medium">Compra incluída na fatura</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Vencimento em {formatLocalDateBR(getCreditCardBillDueDate(form.date))}
                              . O caixa só será reduzido quando a fatura for marcada como paga na
                              aba Cartão.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <FinanceField
                          label="Já foi pago"
                          value={form.paidAmount}
                          onChange={(value) => updateForm("paidAmount", value)}
                          onBlur={() =>
                            updateForm(
                              "paidAmount",
                              form.paidAmount
                                ? formatCurrencyInput(parseCurrencyInput(form.paidAmount))
                                : "",
                            )
                          }
                          placeholder="Ex: 150,00"
                        />
                        <OptionSelectField
                          label="Status"
                          value={form.status}
                          onChange={(value) => updateForm("status", value)}
                          options={expenseStatusOptions}
                        />
                      </>
                    )}
                    <OptionSelectField
                      label="Recorrente"
                      value={form.recurring}
                      onChange={(value) => updateForm("recurring", value)}
                      options={recurringOptions}
                      labels={recurringLabels}
                    />
                    <div className="space-y-2 md:col-span-2">
                      <Label>Descrição complementar</Label>
                      <Textarea
                        value={form.notes}
                        onChange={(event) => updateForm("notes", event.target.value)}
                        placeholder="Ex: valor adiantado, pagamento parcial, detalhes do fornecedor, comprovante..."
                        className="min-h-24 resize-none"
                      />
                    </div>
                  </div>
                  <DialogFooter className="mt-6">
                    <Button type="button" variant="outline" onClick={closeDialog}>
                      Cancelar
                    </Button>
                    <Button type="submit" className="gradient-primary text-primary-foreground">
                      {editingExpenseId ? "Atualizar despesa" : "Salvar despesa"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Caixa atual"
          value={formatBRL(currentCash)}
          icon={Wallet}
          accent="info"
          hint="editável na aba Caixa"
        />
        <KpiCard
          label="Receitas pagas"
          value={formatBRL(totalReceitas)}
          delta={18}
          icon={ArrowUpCircle}
          accent="success"
        />
        <KpiCard
          label="Despesas pagas"
          value={formatBRL(totalDespesas)}
          delta={6}
          icon={ArrowDownCircle}
          accent="warning"
        />
        <KpiCard
          label="A receber"
          value={formatBRL(aReceber)}
          icon={Wallet}
          accent="info"
          hint={`${receivables.filter((item) => item.status === "previsto").length + bankTransactions.filter((item) => item.status === "agendado" && item.type === "entrada").length} parcelas`}
        />
        <KpiCard
          label="A pagar"
          value={formatBRL(aPagar)}
          icon={AlertCircle}
          accent="destructive"
          hint={`${expenses.filter((expense) => ["pendente", "atrasado", "parcial"].includes(expense.status)).length + bankTransactions.filter((item) => item.status === "agendado" && item.type === "saida").length} títulos`}
        />
        <KpiCard
          label="Próxima fatura"
          value={formatBRL(nextOpenCreditCardBill?.remaining ?? 0)}
          icon={CreditCard}
          accent="warning"
          hint={
            nextOpenCreditCardBill
              ? `vence ${formatLocalDateBR(nextOpenCreditCardBill.dueDate)}`
              : "nenhuma fatura aberta"
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <AnimatedDashboardCard
          title="Caixa e recebíveis"
          totalLabel="Disponibilidade"
          primaryLabel="Caixa"
          secondaryLabel="A receber"
          primaryValue={currentCash}
          secondaryValue={aReceber}
          primaryDelta="saldo atual"
          secondaryDelta="próximos recebimentos"
          actionLabel="Atualiza com vendas e despesas"
        />
        <Card className="border-border/60 bg-card/60 p-5 lg:col-span-2">
          <div className="grid h-full gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-success/20 bg-success/10 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Entradas realizadas
              </p>
              <p className="mt-3 font-display text-2xl font-semibold text-success">
                {formatBRL(totalReceitas)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Receitas pagas e parcelas recebidas.
              </p>
            </div>
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Saídas realizadas
              </p>
              <p className="mt-3 font-display text-2xl font-semibold text-destructive">
                {formatBRL(totalDespesas)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">Despesas marcadas como pagas.</p>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/10 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Caixa projetado
              </p>
              <p className="mt-3 font-display text-2xl font-semibold text-gradient-primary">
                {formatBRL(projectedCash)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Caixa atual + previsões - contas abertas.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="border-border/60 bg-card/60 p-5">
        <Tabs value={activeFinancialTab} onValueChange={setActiveFinancialTab}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="despesas">Despesas</TabsTrigger>
              <TabsTrigger value="cartao">Cartão</TabsTrigger>
              <TabsTrigger value="receitas">Receitas</TabsTrigger>
              <TabsTrigger value="previsivel">Receita previsível</TabsTrigger>
              <TabsTrigger value="comissoes">Comissões</TabsTrigger>
              <TabsTrigger value="custos-servicos">Custos dos serviços</TabsTrigger>
              <TabsTrigger value="caixa">Caixa</TabsTrigger>
              <TabsTrigger value="banco">Banco/C6</TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
              <TabsTrigger value="categorias">Categorias</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  className="h-9 w-56 pl-8"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  toast.info("Use a busca para filtrar por status, categoria, data ou descrição.")
                }
              >
                <Filter className="mr-2 h-4 w-4" />
                Filtros
              </Button>
            </div>
          </div>

          <TabsContent value="despesas" className="mt-0">
            <div className="mb-4 rounded-xl border border-border/60 bg-background/45 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <CalendarDays className="h-4 w-4" />
                    Competência
                  </div>
                  <h3 className="mt-1 font-display text-xl font-semibold">
                    {formatMonthLabel(selectedExpenseMonth)}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Avulsas do mês selecionado e recorrentes desde o mês de origem.
                  </p>
                </div>
                <MonthSelector
                  month={selectedExpenseMonth}
                  onMonthChange={setSelectedExpenseMonth}
                />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-border/50 bg-card/45 p-3">
                  <p className="text-xs text-muted-foreground">Total do mês</p>
                  <p className="mt-1 font-semibold tabular-nums">{formatBRL(selectedMonthTotal)}</p>
                </div>
                <div className="rounded-lg border border-success/20 bg-success/10 p-3">
                  <p className="text-xs text-muted-foreground">Pago no mês</p>
                  <p className="mt-1 font-semibold text-success tabular-nums">
                    {formatBRL(selectedMonthPaid)}
                  </p>
                </div>
                <div className="rounded-lg border border-warning/20 bg-warning/10 p-3">
                  <p className="text-xs text-muted-foreground">Pendente no mês</p>
                  <p className="mt-1 font-semibold text-warning tabular-nums">
                    {formatBRL(selectedMonthPending)}
                  </p>
                </div>
                <div className="rounded-lg border border-info/20 bg-info/10 p-3">
                  <p className="text-xs text-muted-foreground">Recorrentes visíveis</p>
                  <p className="mt-1 font-semibold text-info tabular-nums">
                    {selectedMonthRecurringCount}
                  </p>
                </div>
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Forma</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map((expense) => {
                    const paidAmount = calculateExpensePaidAmount(expense);
                    const remainingAmount = calculateExpenseRemainingAmount(expense);

                    return (
                      <TableRow key={expense.displayId} className="hover:bg-muted/30">
                        <TableCell className="font-medium">
                          <div>{expense.desc}</div>
                          {expense.isProjectedRecurring && (
                            <div className="mt-1 text-xs font-normal text-info">
                              Recorrência projetada para este mês
                            </div>
                          )}
                          {expense.notes && (
                            <div className="mt-1 max-w-sm text-xs font-normal text-muted-foreground">
                              {expense.notes}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-border/60">
                            {expense.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatLocalDateBR(expense.date)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {paidAmount > 0 ? formatLocalDateBR(expense.paidAt ?? expense.date) : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              isCreditCardExpense(expense)
                                ? "border-info/30 bg-info/10 text-info"
                                : "border-border/60"
                            }
                          >
                            {expensePaymentMethodLabels[getExpensePaymentMethod(expense)]}
                          </Badge>
                          {isCreditCardExpense(expense) && expense.purchaseDate && (
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              Compra em {formatLocalDateBR(expense.purchaseDate)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {expense.recurring || expense.recurringSourceId ? "Recorrente" : "Avulsa"}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          <div>{formatBRL(expense.value)}</div>
                          {paidAmount > 0 && expense.status !== "pago" && (
                            <div className="mt-1 text-[11px] font-normal text-success">
                              Pago {formatBRL(paidAmount)}
                            </div>
                          )}
                          {paidAmount > 0 && remainingAmount > 0 && (
                            <div className="text-[11px] font-normal text-warning">
                              Falta {formatBRL(remainingAmount)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`${statusBadge(expense.status)} hover:${statusBadge(expense.status)}`}
                          >
                            {statusLabel(expense.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditExpense(expense)}
                            >
                              <Pencil className="mr-1 h-3.5 w-3.5" />
                              Editar
                            </Button>
                            {isCreditCardExpense(expense) ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setActiveFinancialTab("cartao")}
                              >
                                Ver fatura
                              </Button>
                            ) : (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => updateExpenseStatus(expense, "pago")}
                                >
                                  Pago
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => updateExpenseStatus(expense, "pendente")}
                                >
                                  Pendente
                                </Button>
                              </>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeExpense(expense)}
                            >
                              Excluir
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredExpenses.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        Nenhuma despesa encontrada para a busca atual.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="cartao" className="mt-0 space-y-4">
            <div className="rounded-xl border border-border/60 bg-background/45 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <CreditCard className="h-4 w-4" />
                    Faturas do cartão
                  </div>
                  <h3 className="mt-1 font-display text-xl font-semibold">
                    {formatMonthLabel(selectedExpenseMonth)}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Vencimento no dia 1. Compras só saem do caixa quando a fatura é paga.
                  </p>
                </div>
                <MonthSelector
                  month={selectedExpenseMonth}
                  onMonthChange={setSelectedExpenseMonth}
                />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border/50 bg-card/45 p-3">
                  <p className="text-xs text-muted-foreground">Total faturado</p>
                  <p className="mt-1 font-semibold tabular-nums">
                    {formatBRL(
                      selectedMonthCreditCardBills.reduce((sum, bill) => sum + bill.total, 0),
                    )}
                  </p>
                </div>
                <div className="rounded-lg border border-success/20 bg-success/10 p-3">
                  <p className="text-xs text-muted-foreground">Faturas pagas</p>
                  <p className="mt-1 font-semibold text-success tabular-nums">
                    {formatBRL(
                      selectedMonthCreditCardBills.reduce((sum, bill) => sum + bill.paid, 0),
                    )}
                  </p>
                </div>
                <div className="rounded-lg border border-warning/20 bg-warning/10 p-3">
                  <p className="text-xs text-muted-foreground">A pagar no cartão</p>
                  <p className="mt-1 font-semibold text-warning tabular-nums">
                    {formatBRL(
                      selectedMonthCreditCardBills.reduce((sum, bill) => sum + bill.remaining, 0),
                    )}
                  </p>
                </div>
              </div>
            </div>

            {selectedMonthCreditCardBills.map((bill) => (
              <div
                key={bill.dueDate}
                className="overflow-hidden rounded-xl border border-border/60"
              >
                <div className="flex flex-col gap-3 border-b border-border/60 bg-muted/25 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-display text-lg font-semibold">
                        Fatura com vencimento em {formatLocalDateBR(bill.dueDate)}
                      </h4>
                      <Badge
                        className={
                          bill.remaining > 0 ? statusBadge("pendente") : statusBadge("pago")
                        }
                      >
                        {bill.remaining > 0 ? "a pagar" : "paga"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {bill.expenses.length} {bill.expenses.length === 1 ? "compra" : "compras"} ·
                      total {formatBRL(bill.total)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant={bill.remaining > 0 ? "default" : "outline"}
                    onClick={() => updateCreditCardBillStatus(bill, bill.remaining > 0)}
                  >
                    {bill.remaining > 0 ? "Pagar fatura" : "Reabrir fatura"}
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableHead>Compra</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bill.expenses.map((expense) => (
                        <TableRow key={expense.displayId}>
                          <TableCell className="text-muted-foreground">
                            {formatLocalDateBR(expense.purchaseDate ?? expense.date)}
                          </TableCell>
                          <TableCell className="font-medium">
                            <div>{expense.desc}</div>
                            {expense.notes && (
                              <div className="mt-1 max-w-sm text-xs font-normal text-muted-foreground">
                                {expense.notes}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>{expense.category}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {expense.recurring || expense.recurringSourceId
                              ? "Recorrente"
                              : "Avulsa"}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatBRL(expense.value)}
                          </TableCell>
                          <TableCell>
                            <Badge className={statusBadge(expense.status)}>
                              {expense.isProjectedRecurring
                                ? "projetada"
                                : statusLabel(expense.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditExpense(expense)}
                            >
                              <Pencil className="mr-1 h-3.5 w-3.5" />
                              Editar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}

            {selectedMonthCreditCardBills.length === 0 && (
              <div className="rounded-xl border border-dashed border-border/70 py-12 text-center">
                <CreditCard className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 font-medium">Nenhuma fatura neste mês</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cadastre uma despesa e selecione Cartão de crédito como forma de pagamento.
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="receitas" className="mt-0">
            <div className="mb-4 flex flex-col gap-3 rounded-xl border border-border/60 bg-background/45 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  Competência
                </div>
                <h3 className="mt-1 font-display text-lg font-semibold">
                  {formatMonthLabel(selectedExpenseMonth)}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Vendas registradas no mês selecionado.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="outline" className="border-border/60">
                  {formatBRL(selectedMonthSalesTotal)} no mês
                </Badge>
                <MonthSelector
                  month={selectedExpenseMonth}
                  onMonthChange={setSelectedExpenseMonth}
                />
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Cliente</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map((sale) => (
                    <TableRow key={sale.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{sale.client}</TableCell>
                      <TableCell className="text-muted-foreground">{sale.service}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatLocalDateBR(sale.date)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-success">
                        {formatBRL(sale.value)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`${statusBadge(sale.status)} hover:${statusBadge(sale.status)}`}
                        >
                          {statusLabel(sale.status)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredSales.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        Nenhuma receita encontrada para a busca atual.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="previsivel" className="mt-0">
            <div className="mb-4 flex flex-col gap-3 rounded-xl border border-border/60 bg-background/45 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  Competência
                </div>
                <h3 className="mt-1 font-display text-lg font-semibold">
                  {formatMonthLabel(selectedExpenseMonth)}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Parcelas com vencimento no mês selecionado. Ao marcar como recebido, o caixa,
                  recebíveis e status da venda são atualizados.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="outline" className="border-border/60">
                  {formatBRL(selectedMonthReceivablesTotal)} no mês
                </Badge>
                <MonthSelector
                  month={selectedExpenseMonth}
                  onMonthChange={setSelectedExpenseMonth}
                />
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Recebimento</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Parcela</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReceivables.map((item) => {
                    const seller = collaboratorsByName.get(
                      normalizeCollaboratorName(item.seller),
                    ) ?? {
                      name: item.seller,
                    };

                    return (
                      <TableRow key={item.id} className="hover:bg-muted/30">
                        <TableCell className="text-muted-foreground">
                          {formatLocalDateBR(item.dueDate)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.status === "recebido"
                            ? formatLocalDateBR(item.receivedAt ?? item.dueDate)
                            : "-"}
                        </TableCell>
                        <TableCell className="font-medium">{item.client}</TableCell>
                        <TableCell>{item.service}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <CollaboratorAvatar person={seller} className="h-7 w-7 text-[11px]" />
                            <span className="text-muted-foreground">{item.seller}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-border/60 text-xs">
                            {item.origin}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{item.label}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatBRL(item.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`${statusBadge(item.status)} hover:${statusBadge(item.status)}`}
                          >
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateReceivableStatus(item.id, "recebido")}
                            >
                              Recebido
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateReceivableStatus(item.id, "previsto")}
                            >
                              Previsto
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredReceivables.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={10}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        Nenhuma receita previsível encontrada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="comissoes" className="mt-0">
            <div className="mb-4 flex flex-col gap-3 rounded-xl border border-border/60 bg-background/45 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  Competência
                </div>
                <h3 className="mt-1 font-display text-lg font-semibold">
                  {formatMonthLabel(selectedExpenseMonth)}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Comissões com vencimento no mês selecionado. Comissões pagas reduzem o caixa
                  automaticamente.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="outline" className="border-border/60">
                  {formatBRL(selectedMonthCommissionsTotal)} no mês
                </Badge>
                <MonthSelector
                  month={selectedExpenseMonth}
                  onMonthChange={setSelectedExpenseMonth}
                />
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Gatilho</TableHead>
                    <TableHead className="text-right">Comissão</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCommissions.map((entry) => {
                    const seller = collaboratorsByName.get(
                      normalizeCollaboratorName(entry.seller),
                    ) ?? {
                      name: entry.seller,
                    };
                    const paidAmount = getCommissionPaidAmount(entry);

                    return (
                      <TableRow key={entry.id} className="hover:bg-muted/30">
                        <TableCell className="text-muted-foreground">
                          {formatLocalDateBR(entry.dueDate)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {paidAmount > 0 ? formatLocalDateBR(entry.paidAt ?? entry.dueDate) : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <CollaboratorAvatar person={seller} className="h-7 w-7 text-[11px]" />
                            <span className="text-muted-foreground">{entry.seller}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{entry.client}</TableCell>
                        <TableCell>{entry.service}</TableCell>
                        <TableCell className="text-muted-foreground">{entry.label}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums text-primary">
                          {formatBRL(entry.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`${statusBadge(entry.status)} hover:${statusBadge(entry.status)}`}
                          >
                            {entry.status === "a_pagar"
                              ? "A pagar"
                              : entry.status === "paga"
                                ? "Paga"
                                : "Prevista"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={entry.status === "prevista"}
                              onClick={() => markCommissionAsPaid(entry.id)}
                            >
                              Pagar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={entry.status !== "paga"}
                              onClick={() => markCommissionAsPayable(entry.id)}
                            >
                              Voltar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredCommissions.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        Nenhuma comissão encontrada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="custos-servicos" className="mt-0">
            <div className="mb-4 flex flex-col gap-3 rounded-xl border border-border/60 bg-background/45 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  Competência
                </div>
                <h3 className="mt-1 font-display text-lg font-semibold">
                  {formatMonthLabel(selectedExpenseMonth)}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Custos de serviços vinculados às vendas do mês selecionado.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="outline" className="border-border/60">
                  {formatBRL(selectedMonthServiceCostsTotal)} no mês
                </Badge>
                <MonthSelector
                  month={selectedExpenseMonth}
                  onMonthChange={setSelectedExpenseMonth}
                />
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Data</TableHead>
                    <TableHead>Realização</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-right">Venda</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredServiceCosts.map((entry) => {
                    const seller = collaboratorsByName.get(
                      normalizeCollaboratorName(entry.seller),
                    ) ?? {
                      name: entry.seller,
                    };

                    return (
                      <TableRow key={entry.id} className="hover:bg-muted/30">
                        <TableCell className="text-muted-foreground">
                          {formatLocalDateBR(entry.date)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {entry.status === "realizado" ? formatLocalDateBR(entry.date) : "-"}
                        </TableCell>
                        <TableCell className="font-medium">{entry.client}</TableCell>
                        <TableCell>{entry.service}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <CollaboratorAvatar person={seller} className="h-7 w-7 text-[11px]" />
                            <span className="text-muted-foreground">{entry.seller}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatBRL(entry.saleValue)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums text-warning">
                          {formatBRL(entry.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`${statusBadge(entry.status)} hover:${statusBadge(entry.status)}`}
                          >
                            {entry.status === "realizado" ? "Realizado" : "Previsto"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredServiceCosts.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        Nenhum custo de serviço encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="caixa" className="mt-0">
            <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
              <Card className="border-border/60 bg-background/40 p-5">
                <form className="space-y-5" onSubmit={saveCashBalance}>
                  <div>
                    <h3 className="font-display text-lg font-semibold">Caixa operacional</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Informe o dinheiro disponível hoje para a operação financeira.
                    </p>
                  </div>
                  <FinanceField
                    label="Caixa atual"
                    value={cashForm}
                    onChange={setCashForm}
                    onBlur={() => setCashForm(formatCurrencyInput(parseCurrencyInput(cashForm)))}
                    placeholder="Ex: 5000 ou 5.000,50"
                    required
                  />
                  <Button type="submit" className="gradient-primary text-primary-foreground">
                    Salvar caixa
                  </Button>
                </form>
              </Card>

              <div className="grid gap-3 sm:grid-cols-3">
                <Card className="border-border/60 bg-background/40 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Caixa informado
                  </p>
                  <p className="mt-2 font-display text-2xl font-bold">{formatBRL(currentCash)}</p>
                </Card>
                <Card className="border-border/60 bg-background/40 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Impacto bancário
                  </p>
                  <p
                    className={`mt-2 font-display text-2xl font-bold ${
                      bankCashImpact >= 0 ? "text-success" : "text-destructive"
                    }`}
                  >
                    {formatBRL(bankCashImpact)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Entradas C6 realizadas - saídas C6 realizadas.
                  </p>
                </Card>
                <Card className="border-border/60 bg-background/40 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Após receber
                  </p>
                  <p className="mt-2 font-display text-2xl font-bold text-success">
                    {formatBRL(currentCash + aReceber)}
                  </p>
                </Card>
                <Card className="border-border/60 bg-background/40 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Projetado</p>
                  <p
                    className={`mt-2 font-display text-2xl font-bold ${
                      projectedCash >= 0 ? "text-info" : "text-destructive"
                    }`}
                  >
                    {formatBRL(projectedCash)}
                  </p>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="banco" className="mt-0">
            <div className="mb-4 flex flex-col gap-3 rounded-xl border border-border/60 bg-background/45 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  Competência
                </div>
                <h3 className="mt-1 font-display text-lg font-semibold">
                  {formatMonthLabel(selectedExpenseMonth)}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Movimentações bancárias do mês selecionado.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="outline" className="border-border/60">
                  Impacto do mês: {formatBRL(selectedMonthBankImpact)}
                </Badge>
                <MonthSelector
                  month={selectedExpenseMonth}
                  onMonthChange={setSelectedExpenseMonth}
                />
              </div>
            </div>
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-border/60 bg-background/40 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Entradas realizadas
                </p>
                <p className="mt-2 font-display text-2xl font-bold text-success">
                  {formatBRL(selectedMonthBankInflows)}
                </p>
              </Card>
              <Card className="border-border/60 bg-background/40 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Saídas realizadas
                </p>
                <p className="mt-2 font-display text-2xl font-bold text-destructive">
                  {formatBRL(selectedMonthBankOutflows)}
                </p>
              </Card>
              <Card className="border-border/60 bg-background/40 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Entradas agendadas
                </p>
                <p className="mt-2 font-display text-2xl font-bold text-info">
                  {formatBRL(selectedMonthScheduledBankInflows)}
                </p>
              </Card>
              <Card className="border-border/60 bg-background/40 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Saídas agendadas
                </p>
                <p className="mt-2 font-display text-2xl font-bold text-warning">
                  {formatBRL(selectedMonthScheduledBankOutflows)}
                </p>
              </Card>
            </div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Movimentações cadastradas na aba Banco C6. Realizadas entram no caixa; agendadas
                entram em a receber ou a pagar; canceladas não afetam os totais.
              </p>
              <Badge variant="outline" className="border-border/60">
                Saldo bancário no sistema: {formatBRL(bankCashImpact)}
              </Badge>
            </div>
            <div className="overflow-hidden rounded-lg border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Data</TableHead>
                    <TableHead>Movimentação</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBankTransactions.map((transaction) => (
                    <TableRow key={transaction.id} className="hover:bg-muted/30">
                      <TableCell className="text-muted-foreground">
                        {formatLocalDateBR(transaction.date)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{transaction.description}</div>
                        {transaction.counterparty && (
                          <div className="text-xs text-muted-foreground">
                            {transaction.counterparty}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            transaction.type === "entrada"
                              ? "border-success/30 text-success"
                              : "border-destructive/30 text-destructive"
                          }
                        >
                          {transaction.type === "entrada" ? "Entrada" : "Saída"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {bankMethodLabels[transaction.method]}
                      </TableCell>
                      <TableCell>{transaction.category}</TableCell>
                      <TableCell
                        className={`text-right font-medium tabular-nums ${
                          transaction.type === "entrada" ? "text-success" : "text-destructive"
                        }`}
                      >
                        {transaction.type === "entrada" ? "+" : "-"}
                        {formatBRL(transaction.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`${statusBadge(transaction.status)} hover:${statusBadge(transaction.status)}`}
                        >
                          {bankStatusLabels[transaction.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateBankTransactionStatus(transaction.id, "realizado")}
                          >
                            Realizado
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateBankTransactionStatus(transaction.id, "agendado")}
                          >
                            Agendado
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateBankTransactionStatus(transaction.id, "cancelado")}
                          >
                            Cancelar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeBankTransaction(transaction.id)}
                          >
                            Excluir
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredBankTransactions.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        Nenhuma movimentação bancária encontrada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="historico" className="mt-0">
            <div className="mb-4 flex flex-col gap-3 rounded-xl border border-border/60 bg-background/45 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  Competência
                </div>
                <h3 className="mt-1 font-display text-lg font-semibold">
                  {formatMonthLabel(selectedExpenseMonth)}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pagamentos e recebimentos realizados no mês selecionado.
                </p>
              </div>
              <MonthSelector month={selectedExpenseMonth} onMonthChange={setSelectedExpenseMonth} />
            </div>
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <Card className="border-border/60 bg-background/40 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Registros pagos
                </p>
                <p className="mt-2 font-display text-2xl font-bold">
                  {filteredPaymentHistory.length}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Despesas, comissões, receitas, banco e custos realizados.
                </p>
              </Card>
              <Card className="border-border/60 bg-success/10 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Entradas no histórico
                </p>
                <p className="mt-2 font-display text-2xl font-bold text-success">
                  {formatBRL(paymentHistoryInflow)}
                </p>
              </Card>
              <Card className="border-border/60 bg-destructive/10 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Saídas no histórico
                </p>
                <p className="mt-2 font-display text-2xl font-bold text-destructive">
                  {formatBRL(paymentHistoryOutflow)}
                </p>
              </Card>
            </div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Linha do tempo de pagamentos e recebimentos já realizados. Lançamentos antigos sem
                data de pagamento usam a data do próprio registro como referência.
              </p>
              <Badge variant="outline" className="border-border/60">
                Saldo do filtro: {formatBRL(paymentHistoryInflow - paymentHistoryOutflow)}
              </Badge>
            </div>
            <div className="overflow-hidden rounded-lg border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Data do pagamento</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria/Origem</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPaymentHistory.map((entry) => (
                    <TableRow key={entry.id} className="hover:bg-muted/30">
                      <TableCell className="text-muted-foreground">
                        {formatLocalDateBR(entry.date)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            entry.direction === "entrada"
                              ? "border-success/30 text-success"
                              : "border-destructive/30 text-destructive"
                          }
                        >
                          {entry.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{entry.description}</div>
                        {entry.notes && (
                          <div className="mt-1 max-w-md text-xs text-muted-foreground">
                            {entry.notes}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{entry.category}</TableCell>
                      <TableCell>
                        <Badge className={`${statusBadge(entry.status.toLowerCase())}`}>
                          {entry.status}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium tabular-nums ${
                          entry.direction === "entrada" ? "text-success" : "text-destructive"
                        }`}
                      >
                        {entry.direction === "entrada" ? "+" : "-"}
                        {formatBRL(entry.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredPaymentHistory.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        Nenhum pagamento encontrado para a busca atual.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="categorias" className="mt-0">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((category) => (
                <div
                  key={category}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 p-3"
                >
                  <span className="text-sm font-medium">{category}</span>
                  <Badge variant="outline" className="border-border/60 text-xs">
                    Padrão
                  </Badge>
                </div>
              ))}
              <button
                className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background/20 p-3 text-sm text-muted-foreground hover:border-primary hover:text-primary"
                onClick={addCategory}
              >
                <Plus className="h-4 w-4" /> Nova categoria
              </button>
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}

function FinanceField({
  label,
  value,
  onChange,
  onBlur,
  type = "text",
  required = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
    </div>
  );
}
