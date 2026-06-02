import { createFileRoute } from "@tanstack/react-router";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { OptionSelectField } from "@/components/option-select-field";
import { KpiCard } from "@/components/kpi-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PremiumActionButton } from "@/components/ui/premium-action-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
import {
  Download,
  Landmark,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Wallet,
} from "lucide-react";
import { formatBRL } from "@/lib/mock-data";
import {
  defaultInvestmentContribution,
  investmentItems,
  investmentStatuses,
  investmentContributionKey,
  isCashInvestment,
  normalizeInvestmentByStatus,
  syncInvestmentCashItem,
  summarizeInvestments,
  summarizeInvestmentsByCategory,
  type InvestmentItem,
} from "@/lib/investment-data";
import { formatCurrencyInput, parseCurrencyInput } from "@/lib/receivables";
import { usePersistentState } from "@/hooks/use-persistent-state";

export const Route = createFileRoute("/_app/investments")({
  component: Investments,
  head: () => ({ meta: [{ title: "Investimentos - VA" }] }),
});

const emptyForm = {
  id: "",
  item: "",
  category: "",
  quantity: "1",
  unitValue: "",
  spent: "",
  status: "A pagar" as InvestmentItem["status"],
};

const statusClass: Record<InvestmentItem["status"], string> = {
  "A pagar": "bg-warning/15 text-warning",
  Pendente: "bg-warning/15 text-warning",
  Pago: "bg-success/15 text-success",
  Parcial: "bg-info/15 text-info",
  Reservado: "bg-primary/15 text-primary",
  Cancelado: "bg-muted text-muted-foreground",
  "Passou do planejado": "bg-destructive/15 text-destructive",
};

function Investments() {
  const [items, setItems] = usePersistentState<InvestmentItem[]>(
    "va-manager:investments",
    investmentItems,
  );
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [contributionOpen, setContributionOpen] = useState(false);
  const [contribution, setContribution] = usePersistentState(
    investmentContributionKey,
    defaultInvestmentContribution,
  );
  const [contributionForm, setContributionForm] = useState(
    formatCurrencyInput(defaultInvestmentContribution),
  );
  const [form, setForm] = useState(emptyForm);

  const normalizedItems = useMemo(
    () => syncInvestmentCashItem(items, contribution),
    [contribution, items],
  );
  const summary = useMemo(
    () => summarizeInvestments(normalizedItems, contribution),
    [contribution, normalizedItems],
  );
  const categorySummary = useMemo(
    () => summarizeInvestmentsByCategory(normalizedItems, contribution),
    [contribution, normalizedItems],
  );
  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return normalizedItems;
    return normalizedItems.filter((item) =>
      [item.item, item.category, item.status].join(" ").toLowerCase().includes(normalized),
    );
  }, [normalizedItems, query]);

  const openCreate = () => {
    setForm(emptyForm);
    setOpen(true);
  };

  const openContribution = () => {
    setContributionForm(formatCurrencyInput(contribution));
    setContributionOpen(true);
  };

  const saveContribution = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextContribution = parseCurrencyInput(contributionForm);
    if (nextContribution <= 0) {
      toast.error("Informe um aporte maior que zero.");
      return;
    }

    setContribution(nextContribution);
    setContributionOpen(false);
    toast.success("Aporte total atualizado.");
  };

  const openEdit = (item: InvestmentItem) => {
    const normalizedItem = normalizeInvestmentByStatus(item);
    setForm({
      id: normalizedItem.id,
      item: normalizedItem.item,
      category: normalizedItem.category,
      quantity: String(normalizedItem.quantity),
      unitValue: formatCurrencyInput(normalizedItem.unitValue),
      spent: formatCurrencyInput(normalizedItem.spent),
      status: normalizedItem.status,
    });
    setOpen(true);
  };

  const updateForm = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateStatusForm = (status: InvestmentItem["status"]) => {
    setForm((current) => {
      const planned = (Number(current.quantity) || 1) * parseCurrencyInput(current.unitValue);
      const spent =
        status === "Pago"
          ? formatCurrencyInput(planned)
          : status === "Reservado" || status === "Cancelado"
            ? "0"
            : current.spent;

      return { ...current, status, spent };
    });
  };

  const submitInvestment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const quantity = Number(form.quantity) || 1;
    const unitValue = parseCurrencyInput(form.unitValue);
    const planned = Number((quantity * unitValue).toFixed(2));
    const investment = normalizeInvestmentByStatus({
      id: form.id || `inv-${Date.now()}`,
      item: form.item.trim(),
      category: form.category.trim() || "Outros",
      quantity,
      unitValue,
      planned,
      spent: parseCurrencyInput(form.spent),
      status: form.status,
    });
    if (!investment.item || investment.planned <= 0) return;
    if (isCashInvestment(investment)) {
      toast.error("O Caixa é calculado automaticamente pelo aporte total.");
      return;
    }

    setItems((current) =>
      form.id
        ? current.map((item) => (item.id === form.id ? investment : item))
        : [investment, ...current],
    );
    setOpen(false);
    setForm(emptyForm);
    toast.success(form.id ? "Investimento atualizado." : "Investimento adicionado.");
  };

  const updateStatus = (id: string, status: InvestmentItem["status"]) => {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        return normalizeInvestmentByStatus({
          ...item,
          spent: status === "A pagar" || status === "Pendente" ? 0 : item.spent,
          status,
        });
      }),
    );
    toast.success("Status do investimento atualizado.");
  };

  const removeItem = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    toast.success("Investimento removido.");
  };

  const exportCsv = () => {
    const rows = [
      ["Item", "Categoria", "Qtd", "Valor unitario", "Planejado", "Ja gasto", "Saldo", "Status"],
      ...normalizedItems.map((item) => [
        item.item,
        item.category,
        String(item.quantity),
        String(item.unitValue),
        String(item.planned),
        String(item.spent),
        String(Math.max(item.planned - item.spent, 0)),
        item.status,
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "investimentos-va-consultoria.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Investimentos"
        subtitle="Controle do aporte, gastos planejados, saldo disponível e itens pendentes"
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
                setItems(investmentItems);
                setContribution(defaultInvestmentContribution);
                toast.success("Investimentos da planilha restaurados.");
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Restaurar planilha
            </Button>
            <Dialog open={contributionOpen} onOpenChange={setContributionOpen}>
              <PremiumActionButton
                icon={<Settings />}
                title="Alterar aporte"
                subtitle="Atualizar caixa"
                size="sm"
                onClick={openContribution}
              />
              <DialogContent className="sm:max-w-md">
                <form onSubmit={saveContribution}>
                  <DialogHeader>
                    <DialogTitle>Alterar aporte total</DialogTitle>
                    <DialogDescription>
                      O Caixa será recalculado como aporte total menos todos os itens planejados.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="mt-5">
                    <InvestmentField
                      label="Aporte total"
                      value={contributionForm}
                      onChange={setContributionForm}
                      onBlur={() =>
                        setContributionForm(
                          formatCurrencyInput(parseCurrencyInput(contributionForm)),
                        )
                      }
                      placeholder="Ex: 30000 ou 30.000"
                      required
                    />
                  </div>
                  <DialogFooter className="mt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setContributionOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" className="gradient-primary text-primary-foreground">
                      Salvar aporte
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <PremiumActionButton
                  icon={<Plus />}
                  title="Novo investimento"
                  subtitle="Adicionar item"
                  size="sm"
                  onClick={openCreate}
                />
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <form onSubmit={submitInvestment}>
                  <DialogHeader>
                    <DialogTitle>
                      {form.id ? "Editar investimento" : "Novo investimento"}
                    </DialogTitle>
                    <DialogDescription>
                      Dados sincronizam com financeiro, fluxo de caixa, dashboard e calendário.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <InvestmentField
                      label="Item"
                      value={form.item}
                      onChange={(v) => updateForm("item", v)}
                      required
                    />
                    <InvestmentField
                      label="Categoria"
                      value={form.category}
                      onChange={(v) => updateForm("category", v)}
                    />
                    <InvestmentField
                      label="Qtd"
                      type="number"
                      value={form.quantity}
                      onChange={(v) => updateForm("quantity", v)}
                    />
                    <InvestmentField
                      label="Valor unitário"
                      value={form.unitValue}
                      onChange={(v) => updateForm("unitValue", v)}
                      onBlur={() =>
                        updateForm(
                          "unitValue",
                          formatCurrencyInput(parseCurrencyInput(form.unitValue)),
                        )
                      }
                      placeholder="Ex: 2700 ou 2.700,50"
                    />
                    <InvestmentField
                      label="Já gasto"
                      value={form.spent}
                      onChange={(v) => updateForm("spent", v)}
                      onBlur={() =>
                        updateForm("spent", formatCurrencyInput(parseCurrencyInput(form.spent)))
                      }
                      placeholder="Ex: 593,00"
                    />
                    <OptionSelectField
                      label="Status"
                      value={form.status}
                      onChange={(v) => updateStatusForm(v as InvestmentItem["status"])}
                      options={investmentStatuses}
                    />
                  </div>
                  <DialogFooter className="mt-6">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" className="gradient-primary text-primary-foreground">
                      Salvar investimento
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
          label="Aporte recebido"
          value={formatBRL(summary.contribution)}
          icon={Landmark}
          accent="primary"
        />
        <KpiCard
          label="Total planejado"
          value={formatBRL(summary.planned)}
          icon={Wallet}
          accent="info"
          hint={summary.overPlan > 0 ? `${formatBRL(summary.overPlan)} acima` : "dentro do aporte"}
        />
        <KpiCard
          label="Já gasto"
          value={formatBRL(summary.spent)}
          icon={Wallet}
          accent="warning"
          hint={`${summary.usagePct}% do aporte`}
        />
        <KpiCard
          label="Saldo disponível"
          value={formatBRL(summary.available)}
          icon={Wallet}
          accent="success"
        />
        <KpiCard
          label="Ainda falta pagar"
          value={formatBRL(summary.remaining)}
          icon={Wallet}
          accent="destructive"
        />
      </div>

      <Card className="border-border/60 bg-card/60 p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-semibold">Uso do aporte</h3>
            <p className="text-xs text-muted-foreground">
              Caixa calculado por aporte total menos itens planejados.
            </p>
          </div>
          <Badge variant="outline" className="border-border/60">
            {summary.usagePct}% utilizado
          </Badge>
        </div>
        <Progress value={summary.usagePct} className="h-2" />
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {categorySummary.map((category) => (
          <Card key={category.category} className="border-border/60 bg-card/60 p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {category.category}
            </p>
            <p className="mt-1 font-display text-xl font-semibold">{formatBRL(category.planned)}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <span className="text-muted-foreground">Gasto</span>
              <span className="text-right font-medium">{formatBRL(category.spent)}</span>
              <span className="text-muted-foreground">Saldo</span>
              <span className="text-right font-medium">{formatBRL(category.remaining)}</span>
            </div>
          </Card>
        ))}
      </div>

      <Card className="border-border/60 bg-card/60 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-base font-semibold">Controle dos gastos</h3>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar item, categoria ou status..."
              className="h-9 w-72 pl-8"
            />
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-border/60">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Item</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Valor un.</TableHead>
                <TableHead className="text-right">Planejado</TableHead>
                <TableHead className="text-right">Já gasto</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => (
                <TableRow key={item.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium">{item.item}</TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBRL(item.unitValue)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBRL(item.planned)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatBRL(item.spent)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBRL(Math.max(item.planned - item.spent, 0))}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={`${statusClass[item.status]} hover:${statusClass[item.status]}`}
                    >
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {isCashInvestment(item) ? (
                        <span className="px-2 text-xs text-muted-foreground">
                          Automático pelo aporte
                        </span>
                      ) : (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                            <Pencil className="mr-1 h-3.5 w-3.5" />
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateStatus(item.id, "Pago")}
                          >
                            Pago
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateStatus(item.id, "A pagar")}
                          >
                            A pagar
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => removeItem(item.id)}>
                            Excluir
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function InvestmentField({
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
