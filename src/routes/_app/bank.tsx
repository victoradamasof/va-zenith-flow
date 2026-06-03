import { createFileRoute } from "@tanstack/react-router";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { DatePickerField } from "@/components/date-picker-field";
import { OptionSelectField } from "@/components/option-select-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { formatBRL } from "@/lib/mock-data";
import {
  bankConnectionKey,
  bankMethodLabels,
  bankStatusLabels,
  bankTransactionCategories,
  bankTransactionsKey,
  calculateBankInflows,
  calculateBankOutflows,
  calculateScheduledBankInflows,
  calculateScheduledBankOutflows,
  defaultBankConnection,
  initialBankTransactions,
  type BankConnection,
  type BankTransaction,
  type BankTransactionMethod,
  type BankTransactionStatus,
  type BankTransactionType,
} from "@/lib/bank-data";
import { parseCurrencyInput } from "@/lib/receivables";
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  CheckCircle2,
  Download,
  Link2,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  Upload,
  Wallet,
} from "lucide-react";

export const Route = createFileRoute("/_app/bank")({
  component: BankIntegration,
  head: () => ({ meta: [{ title: "Banco C6 PJ - VA Consultoria" }] }),
});

const transactionTypeOptions: BankTransactionType[] = ["entrada", "saida"];
const transactionStatusOptions: BankTransactionStatus[] = ["realizado", "agendado", "cancelado"];
const transactionMethodOptions: BankTransactionMethod[] = [
  "pix",
  "transferencia",
  "pagamento",
  "boleto",
  "cartao",
  "tarifa",
  "outro",
];

const typeLabels: Record<BankTransactionType, string> = {
  entrada: "Entrada",
  saida: "Saida",
};

const statusLabels: Record<BankTransactionStatus, string> = {
  realizado: "Realizado",
  agendado: "Agendado",
  cancelado: "Cancelado",
};

const emptyTransactionForm = {
  date: new Date().toISOString().slice(0, 10),
  description: "",
  type: "saida" as BankTransactionType,
  method: "pix" as BankTransactionMethod,
  category: "Operacional",
  amount: "",
  status: "realizado" as BankTransactionStatus,
  counterparty: "",
  document: "",
  notes: "",
};

function BankIntegration() {
  const [connection, setConnection] = usePersistentState<BankConnection>(
    bankConnectionKey,
    defaultBankConnection,
  );
  const [transactions, setTransactions] = usePersistentState<BankTransaction[]>(
    bankTransactionsKey,
    initialBankTransactions,
  );
  const [query, setQuery] = useState("");
  const [openTransaction, setOpenTransaction] = useState(false);
  const [openConnection, setOpenConnection] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyTransactionForm);
  const [connectionForm, setConnectionForm] = useState(connection);

  const realizedInflows = calculateBankInflows(transactions);
  const realizedOutflows = calculateBankOutflows(transactions);
  const scheduledInflows = calculateScheduledBankInflows(transactions);
  const scheduledOutflows = calculateScheduledBankOutflows(transactions);
  const bankBalance = realizedInflows - realizedOutflows;
  const projectedBalance = bankBalance + scheduledInflows - scheduledOutflows;
  const connectionProgress =
    connection.status === "conectado" ? 100 : connection.status === "sandbox" ? 70 : 35;

  const filteredTransactions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return transactions;
    return transactions.filter((transaction) =>
      [
        transaction.date,
        transaction.description,
        transaction.category,
        transaction.status,
        transaction.method,
        transaction.counterparty,
        transaction.document,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [query, transactions]);

  const openCreateTransaction = () => {
    setEditingId(null);
    setForm(emptyTransactionForm);
    setOpenTransaction(true);
  };

  const openEditTransaction = (transaction: BankTransaction) => {
    setEditingId(transaction.id);
    setForm({
      date: transaction.date,
      description: transaction.description,
      type: transaction.type,
      method: transaction.method,
      category: transaction.category,
      amount: String(transaction.amount).replace(".", ","),
      status: transaction.status,
      counterparty: transaction.counterparty ?? "",
      document: transaction.document ?? "",
      notes: transaction.notes ?? "",
    });
    setOpenTransaction(true);
  };

  const submitTransaction = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const description = form.description.trim();
    const amount = parseCurrencyInput(form.amount);
    if (!description || amount <= 0) {
      toast.error("Informe uma descricao e um valor valido.");
      return;
    }

    const nextTransaction: BankTransaction = {
      id: editingId ?? `bank-${Date.now()}`,
      date: form.date,
      description,
      type: form.type,
      method: form.method,
      category: form.category,
      amount,
      status: form.status,
      counterparty: form.counterparty.trim(),
      document: form.document.trim(),
      notes: form.notes.trim(),
      source: "manual",
    };

    setTransactions((current) =>
      editingId
        ? current.map((item) => (item.id === editingId ? nextTransaction : item))
        : [nextTransaction, ...current],
    );
    setOpenTransaction(false);
    setEditingId(null);
    setForm(emptyTransactionForm);
    toast.success("Movimentacao bancaria salva e sincronizada ao sistema.");
  };

  const submitConnection = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextConnection = {
      ...connectionForm,
      provider: "C6 Bank" as const,
      lastSyncAt: new Date().toISOString(),
    };
    setConnection(nextConnection);
    setOpenConnection(false);
    toast.success("Configuracao do C6 PJ salva.");
  };

  const deleteTransaction = (id: string) => {
    setTransactions((current) => current.filter((transaction) => transaction.id !== id));
    toast.success("Movimentacao removida.");
  };

  const markAsRealized = (id: string) => {
    setTransactions((current) =>
      current.map((transaction) =>
        transaction.id === id ? { ...transaction, status: "realizado" } : transaction,
      ),
    );
    toast.success("Agendamento marcado como realizado.");
  };

  const importCsv = (file: File | null) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const rows = text
        .split(/\r?\n/)
        .map((row) => row.trim())
        .filter(Boolean);

      const parsed = rows.slice(1).flatMap((row, index) => {
        const columns = row.split(";").map((column) => column.replace(/^"|"$/g, "").trim());
        const [date, description, amountRaw, typeRaw, methodRaw, categoryRaw, statusRaw] = columns;
        const amount = parseCurrencyInput(amountRaw ?? "");
        if (!date || !description || !amount) return [];
        const type = normalizeOption(typeRaw, transactionTypeOptions, amount >= 0 ? "entrada" : "saida");
        return [
          {
            id: `bank-csv-${Date.now()}-${index}`,
            date,
            description,
            amount: Math.abs(amount),
            type,
            method: normalizeOption(methodRaw, transactionMethodOptions, "outro"),
            category: categoryRaw || "Outros",
            status: normalizeOption(statusRaw, transactionStatusOptions, "realizado"),
            source: "csv" as const,
          },
        ];
      });

      if (!parsed.length) {
        toast.error("Nenhuma movimentacao valida encontrada no CSV.");
        return;
      }

      setTransactions((current) => [...parsed, ...current]);
      setConnection((current) => ({ ...current, lastSyncAt: new Date().toISOString() }));
      toast.success(`${parsed.length} movimentacoes importadas.`);
    };
    reader.readAsText(file, "utf-8");
  };

  const exportCsv = () => {
    const rows = [
      ["Data", "Descricao", "Valor", "Tipo", "Metodo", "Categoria", "Status", "Contraparte"],
      ...transactions.map((transaction) => [
        transaction.date,
        transaction.description,
        String(transaction.amount),
        transaction.type,
        transaction.method,
        transaction.category,
        transaction.status,
        transaction.counterparty ?? "",
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "c6-pj-movimentacoes-va.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const fakeSync = () => {
    setConnection((current) => ({ ...current, lastSyncAt: new Date().toISOString() }));
    toast.info("Estrutura pronta. Quando o C6 liberar credenciais, este botao fara a sincronizacao real.");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Banco C6 PJ"
        subtitle="Movimentacoes bancarias conectadas ao caixa, financeiro, calendario e alertas"
        action={
          <>
            <Button variant="outline" onClick={fakeSync}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Sincronizar
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setConnectionForm(connection);
                setOpenConnection(true);
              }}
            >
              <Link2 className="mr-2 h-4 w-4" />
              Configurar C6
            </Button>
            <Button onClick={openCreateTransaction}>
              <Plus className="mr-2 h-4 w-4" />
              Nova movimentacao
            </Button>
          </>
        }
      />

      <Card className="border-primary/25 bg-primary/5 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-primary/15 text-primary">{connection.provider}</Badge>
              <Badge variant="outline">{bankStatusLabels[connection.status]}</Badge>
              <Badge variant="outline">{connection.mode === "api" ? "API oficial" : "Modo manual/API-ready"}</Badge>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              A integracao ja esta preparada para credenciais C6. Ate a liberacao, registre ou importe
              extratos para manter o controle real no sistema.
            </p>
          </div>
          <div className="min-w-[220px] space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Prontidao da conexao</span>
              <span>{connectionProgress}%</span>
            </div>
            <Progress value={connectionProgress} />
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Saldo C6 no sistema" value={formatBRL(bankBalance)} icon={Wallet} accent="info" />
        <KpiCard label="Entradas bancarias" value={formatBRL(realizedInflows)} icon={Banknote} accent="success" />
        <KpiCard label="Saidas bancarias" value={formatBRL(realizedOutflows)} icon={AlertTriangle} accent="warning" />
        <KpiCard label="Agendamentos" value={formatBRL(scheduledOutflows)} icon={CalendarClock} accent="primary" />
        <KpiCard label="Saldo projetado" value={formatBRL(projectedBalance)} icon={CheckCircle2} accent="success" />
      </div>

      <Card className="border-border/60 bg-card/70 p-5">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold">Extrato e agendamentos</h2>
            <p className="text-sm text-muted-foreground">
              Tudo aqui impacta automaticamente caixa, fluxo, dashboard, calendario e alertas.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent">
              <Upload className="mr-2 h-4 w-4" />
              Importar CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => importCsv(event.target.files?.[0] ?? null)}
              />
            </label>
            <Button variant="outline" onClick={exportCsv}>
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-2 rounded-xl border border-border/60 px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar movimentacao, Pix, categoria, contraparte..."
            className="border-0 bg-transparent focus-visible:ring-0"
          />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Descricao</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Metodo</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Acoes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  Nenhuma movimentacao bancaria cadastrada ainda.
                </TableCell>
              </TableRow>
            ) : (
              filteredTransactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>{transaction.date}</TableCell>
                  <TableCell>
                    <div className="font-medium text-foreground">{transaction.description}</div>
                    <div className="text-xs text-muted-foreground">{transaction.counterparty}</div>
                  </TableCell>
                  <TableCell>{typeLabels[transaction.type]}</TableCell>
                  <TableCell>{bankMethodLabels[transaction.method]}</TableCell>
                  <TableCell>{transaction.category}</TableCell>
                  <TableCell
                    className={
                      transaction.type === "entrada"
                        ? "text-right font-semibold text-success"
                        : "text-right font-semibold text-destructive"
                    }
                  >
                    {transaction.type === "entrada" ? "+" : "-"}
                    {formatBRL(transaction.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{statusLabels[transaction.status]}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {transaction.status === "agendado" && (
                        <Button variant="ghost" size="sm" onClick={() => markAsRealized(transaction.id)}>
                          Realizar
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => openEditTransaction(transaction)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteTransaction(transaction.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={openTransaction} onOpenChange={setOpenTransaction}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar movimentacao" : "Nova movimentacao bancaria"}</DialogTitle>
            <DialogDescription>
              Lancamentos realizados afetam o caixa imediatamente. Agendamentos entram nas previsoes.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitTransaction} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <DatePickerField
                label="Data"
                value={form.date}
                onChange={(value) => setForm((current) => ({ ...current, date: value }))}
                required
              />
              <OptionSelectField
                label="Tipo"
                value={form.type}
                onChange={(value) =>
                  setForm((current) => ({ ...current, type: value as BankTransactionType }))
                }
                options={transactionTypeOptions}
                labels={typeLabels}
              />
              <div className="space-y-2 md:col-span-2">
                <Label>Descricao</Label>
                <Input
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, description: event.target.value }))
                  }
                  required
                />
              </div>
              <OptionSelectField
                label="Metodo"
                value={form.method}
                onChange={(value) =>
                  setForm((current) => ({ ...current, method: value as BankTransactionMethod }))
                }
                options={transactionMethodOptions}
                labels={bankMethodLabels}
              />
              <OptionSelectField
                label="Status"
                value={form.status}
                onChange={(value) =>
                  setForm((current) => ({ ...current, status: value as BankTransactionStatus }))
                }
                options={transactionStatusOptions}
                labels={statusLabels}
              />
              <OptionSelectField
                label="Categoria"
                value={form.category}
                onChange={(value) => setForm((current) => ({ ...current, category: value }))}
                options={bankTransactionCategories}
              />
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input
                  value={form.amount}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, amount: event.target.value }))
                  }
                  placeholder="Ex: 397,00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Contraparte</Label>
                <Input
                  value={form.counterparty}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, counterparty: event.target.value }))
                  }
                  placeholder="Cliente, fornecedor ou favorecido"
                />
              </div>
              <div className="space-y-2">
                <Label>CPF/CNPJ ou identificador</Label>
                <Input
                  value={form.document}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, document: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Observacoes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, notes: event.target.value }))
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenTransaction(false)}>
                Cancelar
              </Button>
              <Button type="submit">Salvar movimentacao</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={openConnection} onOpenChange={setOpenConnection}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar C6 PJ</DialogTitle>
            <DialogDescription>
              Guarde aqui os dados operacionais da conta. As credenciais da API devem entrar depois via
              segredo seguro no Cloudflare, nunca no codigo.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitConnection} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Nome da conta</Label>
                <Input
                  value={connectionForm.accountName}
                  onChange={(event) =>
                    setConnectionForm((current) => ({ ...current, accountName: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input
                  value={connectionForm.document}
                  onChange={(event) =>
                    setConnectionForm((current) => ({ ...current, document: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Agencia</Label>
                <Input
                  value={connectionForm.agency}
                  onChange={(event) =>
                    setConnectionForm((current) => ({ ...current, agency: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Conta</Label>
                <Input
                  value={connectionForm.account}
                  onChange={(event) =>
                    setConnectionForm((current) => ({ ...current, account: event.target.value }))
                  }
                />
              </div>
              <OptionSelectField
                label="Status"
                value={connectionForm.status}
                onChange={(value) =>
                  setConnectionForm((current) => ({
                    ...current,
                    status: value as BankConnection["status"],
                  }))
                }
                options={["aguardando_credenciais", "sandbox", "conectado", "erro", "nao_configurado"]}
                labels={bankStatusLabels}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenConnection(false)}>
                Cancelar
              </Button>
              <Button type="submit">Salvar configuracao</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function normalizeOption<T extends string>(value: string | undefined, options: readonly T[], fallback: T) {
  const clean = (value ?? "").trim().toLowerCase();
  return options.find((option) => option.toLowerCase() === clean) ?? fallback;
}
