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
  calculateCurrentCash,
  calculatePaidExpenses,
  calculateReceivedRevenue,
  cashBalanceKey,
  defaultCashBalance,
} from "@/lib/cash-data";
import { formatLocalDateBR, todayLocalISODate } from "@/lib/date-utils";
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

type Expense = (typeof initialExpenses)[number];
type Collaborator = (typeof initialSellers)[number] & { role?: string; photoUrl?: string };

const emptyExpenseForm = {
  date: todayLocalISODate(),
  desc: "",
  category: "Marketing",
  value: "",
  status: "pendente",
  recurring: "true",
};

const expenseStatusOptions = ["pendente", "pago", "atrasado", "parcial"];
const recurringOptions = ["true", "false"];
const recurringLabels: Record<string, string> = {
  true: "Recorrente",
  false: "Avulsa",
};

function Financial() {
  const [sales, setSales] = usePersistentState("va-manager:sales", initialSales);
  const [expenses, setExpenses] = usePersistentState("va-manager:expenses", initialExpenses);
  const [collaborators] = usePersistentState<Collaborator[]>(
    "va-manager:collaborators",
    initialSellers,
  );
  const [services] = usePersistentState("va-manager:services", initialServices);
  const [commissionPayments, setCommissionPayments] = usePersistentState<CommissionPayment[]>(
    commissionPaymentsKey,
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
  const [open, setOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
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

  const filteredExpenses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return expenses;

    return expenses.filter((expense) =>
      [
        expense.date,
        expense.desc,
        expense.category,
        expense.status,
        expense.recurring ? "recorrente" : "avulsa",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [expenses, query]);

  const filteredSales = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return sales;

    return sales.filter((sale) =>
      [sale.date, sale.client, sale.service, sale.status, sale.origin, sale.seller]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [query, sales]);

  const filteredReceivables = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return receivables;

    return receivables.filter((item) =>
      [item.client, item.service, item.seller, item.origin, item.label, item.status, item.dueDate]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [query, receivables]);
  const filteredBankTransactions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return bankTransactions;

    return bankTransactions.filter((transaction) =>
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
  }, [bankTransactions, query]);
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
      }),
    [commissionPayments, receivables, sales, services],
  );
  const serviceCostEntries = useMemo(
    () => calculateServiceCostEntries({ sales, services, receivables }),
    [receivables, sales, services],
  );
  const filteredCommissions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return commissionEntries;

    return commissionEntries.filter((entry) =>
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
  }, [commissionEntries, query]);
  const filteredServiceCosts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return serviceCostEntries;

    return serviceCostEntries.filter((entry) =>
      [entry.date, entry.client, entry.seller, entry.service, entry.status]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [query, serviceCostEntries]);
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
      .filter((expense) => expense.status === "pendente" || expense.status === "atrasado")
      .reduce((sum, expense) => sum + expense.value, 0) +
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

  useEffect(() => {
    setCashForm(formatCurrencyInput(currentCash));
  }, [currentCash]);

  const updateForm = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const hasCategory = (category: string) =>
    categories.some(
      (item) => item.trim().toLocaleLowerCase("pt-BR") === category.trim().toLocaleLowerCase("pt-BR"),
    );

  const saveCategoryIfMissing = (category: string) => {
    const normalizedCategory = category.trim() || "Outros";
    setCategories((current) => {
      const alreadyExists = current.some(
        (item) =>
          item.trim().toLocaleLowerCase("pt-BR") ===
          normalizedCategory.toLocaleLowerCase("pt-BR"),
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
    setForm(emptyExpenseForm);
    setOpen(true);
  };

  const openEditExpense = (expense: Expense) => {
    setEditingExpenseId(expense.id);
    setForm({
      date: expense.date,
      desc: expense.desc,
      category: expense.category,
      value: formatCurrencyInput(expense.value),
      status: expense.status,
      recurring: String(expense.recurring),
    });
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
    setEditingExpenseId(null);
    setForm(emptyExpenseForm);
  };

  const submitExpense = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const desc = form.desc.trim();
    if (!desc) return;
    const category = saveCategoryIfMissing(form.category);
    const expense: Expense = {
      id: editingExpenseId ?? `e-${Date.now()}`,
      date: form.date,
      desc,
      category,
      value: parseCurrencyInput(form.value),
      status: form.status,
      recurring: form.recurring === "true",
    };

    setExpenses((current) =>
      editingExpenseId
        ? current.map((item) => (item.id === editingExpenseId ? expense : item))
        : [expense, ...current],
    );

    closeDialog();
    toast.success(editingExpenseId ? "Despesa atualizada." : "Despesa cadastrada.");
  };

  const updateExpenseStatus = (id: string, status: string) => {
    setExpenses((current) =>
      current.map((expense) => (expense.id === id ? { ...expense, status } : expense)),
    );
    toast.success(`Despesa marcada como ${status}.`);
  };

  const removeExpense = (id: string) => {
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
      receivable.id === id ? { ...receivable, status } : receivable,
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
      ["Tipo", "Data", "Descrição", "Categoria/Serviço", "Valor", "Status"],
      [
        "Caixa",
        todayLocalISODate(),
        "Caixa atual",
        "Operacional",
        String(currentCash),
        "atual",
      ],
      ...expenses.map((expense) => [
        "Despesa",
        expense.date,
        expense.desc,
        expense.category,
        String(expense.value),
        expense.status,
      ]),
      ...sales.map((sale) => [
        "Receita",
        sale.date,
        sale.client,
        sale.service,
        String(sale.value),
        sale.status,
      ]),
      ...bankTransactions.map((transaction) => [
        transaction.type === "entrada" ? "Banco - entrada" : "Banco - saída",
        transaction.date,
        transaction.description,
        transaction.category,
        String(transaction.amount),
        transaction.status,
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
                      label="Data"
                      value={form.date}
                      onChange={(value) => updateForm("date", value)}
                      required
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
                    <OptionSelectField
                      label="Status"
                      value={form.status}
                      onChange={(value) => updateForm("status", value)}
                      options={expenseStatusOptions}
                    />
                    <OptionSelectField
                      label="Recorrente"
                      value={form.recurring}
                      onChange={(value) => updateForm("recurring", value)}
                      options={recurringOptions}
                      labels={recurringLabels}
                    />
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
          hint={`${expenses.filter((expense) => expense.status === "pendente" || expense.status === "atrasado").length + bankTransactions.filter((item) => item.status === "agendado" && item.type === "saida").length} títulos`}
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
        <Tabs defaultValue="despesas">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="despesas">Despesas</TabsTrigger>
              <TabsTrigger value="receitas">Receitas</TabsTrigger>
              <TabsTrigger value="previsivel">Receita previsível</TabsTrigger>
              <TabsTrigger value="comissoes">Comissões</TabsTrigger>
              <TabsTrigger value="custos-servicos">Custos dos serviços</TabsTrigger>
              <TabsTrigger value="caixa">Caixa</TabsTrigger>
              <TabsTrigger value="banco">Banco/C6</TabsTrigger>
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
            <div className="overflow-hidden rounded-lg border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map((expense) => (
                    <TableRow key={expense.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{expense.desc}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-border/60">
                          {expense.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatLocalDateBR(expense.date)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {expense.recurring ? "Recorrente" : "Avulsa"}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatBRL(expense.value)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`${statusBadge(expense.status)} hover:${statusBadge(expense.status)}`}
                        >
                          {expense.status}
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateExpenseStatus(expense.id, "pago")}
                          >
                            Pago
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateExpenseStatus(expense.id, "pendente")}
                          >
                            Pendente
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeExpense(expense.id)}
                          >
                            Excluir
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredExpenses.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
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

          <TabsContent value="receitas" className="mt-0">
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
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Parcelas e recebimentos futuros gerados por vendas e clientes. Ao marcar como
                recebido, o caixa, recebíveis e status da venda são atualizados.
              </p>
              <Badge variant="outline" className="border-border/60">
                {formatBRL(aReceber)} previsto
              </Badge>
            </div>
            <div className="overflow-hidden rounded-lg border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Vencimento</TableHead>
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
                        colSpan={9}
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
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Comissões liberadas entram em a pagar. Comissões pagas reduzem o caixa
                automaticamente.
              </p>
              <Badge variant="outline" className="border-border/60">
                {formatBRL(payableCommissions)} a pagar
              </Badge>
            </div>
            <div className="overflow-hidden rounded-lg border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Vencimento</TableHead>
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

                    return (
                      <TableRow key={entry.id} className="hover:bg-muted/30">
                        <TableCell className="text-muted-foreground">
                          {formatLocalDateBR(entry.dueDate)}
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
                        colSpan={8}
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
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Custos cadastrados em Serviços são aplicados automaticamente por venda. Se a venda
                já teve recebimento, o custo entra como realizado; caso contrário, entra como
                previsto.
              </p>
              <Badge variant="outline" className="border-border/60">
                {formatBRL(pendingServiceCosts)} previstos
              </Badge>
            </div>
            <div className="overflow-hidden rounded-lg border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Data</TableHead>
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
                        colSpan={7}
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
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-border/60 bg-background/40 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Entradas realizadas
                </p>
                <p className="mt-2 font-display text-2xl font-bold text-success">
                  {formatBRL(bankInflows)}
                </p>
              </Card>
              <Card className="border-border/60 bg-background/40 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Saídas realizadas
                </p>
                <p className="mt-2 font-display text-2xl font-bold text-destructive">
                  {formatBRL(bankOutflows)}
                </p>
              </Card>
              <Card className="border-border/60 bg-background/40 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Entradas agendadas
                </p>
                <p className="mt-2 font-display text-2xl font-bold text-info">
                  {formatBRL(scheduledBankInflows)}
                </p>
              </Card>
              <Card className="border-border/60 bg-background/40 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Saídas agendadas
                </p>
                <p className="mt-2 font-display text-2xl font-bold text-warning">
                  {formatBRL(scheduledBankOutflows)}
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
