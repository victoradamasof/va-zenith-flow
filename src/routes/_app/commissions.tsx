import { createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BadgeDollarSign,
  CheckCircle2,
  Clock3,
  Download,
  Pencil,
  Search,
  Undo2,
  WalletCards,
} from "lucide-react";
import { CollaboratorAvatar } from "@/components/collaborator-avatar";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  formatBRL,
  sales as initialSales,
  sellers as initialSellers,
  services as initialServices,
} from "@/lib/mock-data";
import { buildCollaboratorMap, normalizeCollaboratorName } from "@/lib/collaborators";
import {
  calculateCommissionEntries,
  calculateCommissionSummary,
  commissionAdjustmentsKey,
  commissionPaymentsKey,
  type CommissionAdjustment,
  type CommissionEntry,
  type CommissionPayment,
} from "@/lib/commissions";
import { formatCurrencyInput, parseCurrencyInput } from "@/lib/currency";
import { getAuthSession, type AuthSession } from "@/lib/auth";
import { isAdmin, isOwnedBySession, normalizePermissionText } from "@/lib/permissions";
import { formatLocalDateBR, todayLocalISODate } from "@/lib/date-utils";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { useSyncedReceivables } from "@/hooks/use-synced-receivables";

export const Route = createFileRoute("/_app/commissions")({
  component: Commissions,
  head: () => ({ meta: [{ title: "Comissões - VA Consultoria" }] }),
});

type Collaborator = (typeof initialSellers)[number] & { role?: string; photoUrl?: string };

const statusLabels: Record<CommissionEntry["status"], string> = {
  paga: "Paga",
  a_pagar: "A pagar",
  prevista: "Prevista",
};

const statusClasses: Record<CommissionEntry["status"], string> = {
  paga: "bg-success/15 text-success hover:bg-success/15",
  a_pagar: "bg-warning/15 text-warning hover:bg-warning/15",
  prevista: "bg-info/15 text-info hover:bg-info/15",
};

function hasFinancialAccess(session: AuthSession | null) {
  const role = normalizePermissionText(session?.role);
  return role === "administrador" || role === "financeiro";
}

function canViewEveryCommission(session: AuthSession | null) {
  return hasFinancialAccess(session);
}

function Commissions() {
  const [sales] = usePersistentState("va-manager:sales", initialSales);
  const [services] = usePersistentState("va-manager:services", initialServices);
  const [collaborators] = usePersistentState<Collaborator[]>(
    "va-manager:collaborators",
    initialSellers,
  );
  const [commissionPayments, setCommissionPayments] = usePersistentState<CommissionPayment[]>(
    commissionPaymentsKey,
    [],
  );
  const [commissionAdjustments, setCommissionAdjustments] = usePersistentState<
    CommissionAdjustment[]
  >(commissionAdjustmentsKey, []);
  const [receivables] = useSyncedReceivables({ sales });
  const [session, setSession] = useState<AuthSession | null>(null);
  const [query, setQuery] = useState("");
  const [editingEntry, setEditingEntry] = useState<CommissionEntry | null>(null);
  const [editForm, setEditForm] = useState({
    amount: "",
    description: "",
    markAsPaid: false,
  });

  useEffect(() => {
    const refreshSession = () => setSession(getAuthSession());
    refreshSession();
    window.addEventListener("va-auth-change", refreshSession);
    window.addEventListener("storage", refreshSession);
    return () => {
      window.removeEventListener("va-auth-change", refreshSession);
      window.removeEventListener("storage", refreshSession);
    };
  }, []);

  const canManagePayments = hasFinancialAccess(session);
  const canViewAll = canViewEveryCommission(session);

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

  const visibleEntries = useMemo(() => {
    const scopedEntries = canViewAll
      ? commissionEntries
      : commissionEntries.filter((entry) => isOwnedBySession(entry.seller, session));
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalizedQuery) return scopedEntries;

    return scopedEntries.filter((entry) =>
      [
        entry.saleDate,
        entry.dueDate,
        entry.client,
        entry.seller,
        entry.service,
        entry.label,
        entry.description ?? "",
        statusLabels[entry.status],
      ]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(normalizedQuery),
    );
  }, [canViewAll, commissionEntries, query, session]);

  const summary = calculateCommissionSummary(visibleEntries);
  const collaboratorsByName = useMemo(() => buildCollaboratorMap(collaborators), [collaborators]);
  const sellerRows = useMemo(
    () => buildSellerRows(visibleEntries, collaboratorsByName),
    [collaboratorsByName, visibleEntries],
  );

  const markAsPaid = (entry: CommissionEntry) => {
    if (!canManagePayments) {
      toast.warning("Seu acesso permite visualizar apenas suas comissões.");
      return;
    }

    if (entry.status === "prevista") {
      toast.warning("Essa comissão ainda depende do recebimento do cliente.");
      return;
    }

    setCommissionPayments((current) => {
      if (current.some((payment) => payment.id === entry.id)) return current;
      return [{ id: entry.id, paidAt: todayLocalISODate() }, ...current];
    });
    toast.success("Comissão marcada como paga.");
  };

  const markAsPayable = (entry: CommissionEntry) => {
    if (!canManagePayments) {
      toast.warning("Seu acesso permite visualizar apenas suas comissões.");
      return;
    }

    setCommissionPayments((current) => current.filter((payment) => payment.id !== entry.id));
    toast.success("Comissão voltou para a pagar.");
  };

  const openEditor = (entry: CommissionEntry) => {
    const isPaid = commissionPayments.some((payment) => payment.id === entry.id);
    setEditingEntry(entry);
    setEditForm({
      amount: formatCurrencyInput(entry.amount),
      description: entry.description ?? "",
      markAsPaid: isPaid || entry.status === "paga",
    });
  };

  const saveCommissionEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingEntry) return;

    const amount = parseCurrencyInput(editForm.amount);
    if (amount < 0) {
      toast.warning("Informe uma comissão válida.");
      return;
    }

    const description = editForm.description.trim();
    const baseAmount = editingEntry.originalAmount ?? editingEntry.amount;
    const hasCustomAmount = amount !== baseAmount;

    setCommissionAdjustments((current) => {
      const withoutCurrent = current.filter((adjustment) => adjustment.id !== editingEntry.id);
      if (!hasCustomAmount && !description) return withoutCurrent;

      return [
        {
          id: editingEntry.id,
          amount: hasCustomAmount ? amount : undefined,
          description,
          updatedAt: todayLocalISODate(),
        },
        ...withoutCurrent,
      ];
    });

    setCommissionPayments((current) => {
      const withoutCurrent = current.filter((payment) => payment.id !== editingEntry.id);
      if (!editForm.markAsPaid) return withoutCurrent;
      return [
        {
          id: editingEntry.id,
          paidAt: editingEntry.paidAt ?? todayLocalISODate(),
        },
        ...withoutCurrent,
      ];
    });

    setEditingEntry(null);
    toast.success("Comissão atualizada.");
  };

  const exportCsv = () => {
    const rows = [
      [
        "Data da venda",
        "Vencimento",
        "Vendedor",
        "Cliente",
        "Serviço",
        "Gatilho",
        "Descrição",
        "Valor da venda",
        "Comissão",
        "Status",
      ],
      ...visibleEntries.map((entry) => [
        entry.saleDate,
        entry.dueDate,
        entry.seller,
        entry.client,
        entry.service,
        entry.label,
        entry.description ?? "",
        String(entry.saleValue),
        String(entry.amount),
        statusLabels[entry.status],
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "comissoes-va-consultoria.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comissionamento"
        subtitle={
          canManagePayments
            ? "Comissões por vendedor conectadas a vendas, recebíveis e financeiro"
            : "Acompanhe somente suas próprias comissões e recebimentos liberados"
        }
        action={
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        }
      />

      <Dialog open={Boolean(editingEntry)} onOpenChange={(open) => !open && setEditingEntry(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar comissão</DialogTitle>
            <DialogDescription>
              Ajuste o valor, registre uma descrição e marque como paga quando houver adiantamento.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={saveCommissionEdit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="commission-client">Cliente</Label>
                <Input id="commission-client" value={editingEntry?.client ?? ""} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="commission-seller">Vendedor</Label>
                <Input id="commission-seller" value={editingEntry?.seller ?? ""} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="commission-service">Serviço</Label>
                <Input id="commission-service" value={editingEntry?.service ?? ""} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="commission-amount">Valor da comissão</Label>
                <Input
                  id="commission-amount"
                  value={editForm.amount}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, amount: event.target.value }))
                  }
                  onBlur={() =>
                    setEditForm((current) => ({
                      ...current,
                      amount: formatCurrencyInput(parseCurrencyInput(current.amount)),
                    }))
                  }
                  inputMode="decimal"
                  placeholder="0,00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="commission-description">Descrição</Label>
              <Textarea
                id="commission-description"
                value={editForm.description}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="Ex: comissão adiantada, desconto combinado, pagamento parcial..."
                rows={4}
              />
            </div>

            <label className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/40 p-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-primary"
                checked={editForm.markAsPaid}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, markAsPaid: event.target.checked }))
                }
              />
              <span>
                <span className="block font-medium">Marcar como paga/adiantada</span>
                <span className="text-muted-foreground">
                  Use quando a comissão foi antecipada mesmo antes do recebimento final.
                </span>
              </span>
            </label>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingEntry(null)}>
                Cancelar
              </Button>
              <Button type="submit">Salvar comissão</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Comissões liberadas"
          value={formatBRL(summary.payable + summary.paid)}
          icon={BadgeDollarSign}
          accent="primary"
          hint="paga + a pagar"
        />
        <KpiCard
          label="Comissões pagas"
          value={formatBRL(summary.paid)}
          icon={CheckCircle2}
          accent="success"
          hint={canManagePayments ? "pagamento registrado" : "já registradas"}
        />
        <KpiCard
          label="A pagar"
          value={formatBRL(summary.payable)}
          icon={WalletCards}
          accent="warning"
          hint="liberadas"
        />
        <KpiCard
          label="Previstas"
          value={formatBRL(summary.forecast)}
          icon={Clock3}
          accent="info"
          hint="aguardam recebimento"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Card className="border-border/60 bg-card/60 p-5">
          <div className="mb-4">
            <h3 className="font-display text-lg font-semibold">Regras de comissão</h3>
            <p className="text-sm text-muted-foreground">
              {canManagePayments
                ? "O cálculo usa vendas e recebíveis em tempo real. Ao registrar pagamento, o financeiro é atualizado automaticamente."
                : "O cálculo usa suas vendas e recebíveis em tempo real. Você visualiza apenas as comissões vinculadas ao seu usuário."}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-primary/25 bg-primary/10 p-4">
              <p className="text-sm font-semibold">Limpa Nome</p>
              <p className="mt-2 text-sm text-muted-foreground">
                R$ 50 quando a entrada de R$ 397 estiver recebida e mais R$ 50 quando a cobrança
                final for recebida após a entrega.
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/40 p-4">
              <p className="text-sm font-semibold">Demais serviços</p>
              <p className="mt-2 text-sm text-muted-foreground">
                A comissão é liberada no registro da venda, usando o valor cadastrado na aba
                Serviços.
              </p>
            </div>
          </div>
        </Card>

        <Card className="border-border/60 bg-card/60 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-semibold">
                {canViewAll ? "Resumo por vendedor" : "Meu resumo"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {canViewAll
                  ? "Ranking de comissões da base atual."
                  : "Totais calculados apenas sobre suas vendas."}
              </p>
            </div>
            <Badge variant="outline" className="border-border/60">
              {canViewAll ? `${sellerRows.length} vendedores` : "Acesso individual"}
            </Badge>
          </div>
          <div className="space-y-3">
            {sellerRows.slice(0, 5).map((row) => (
              <div
                key={row.name}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 p-3"
              >
                <CollaboratorAvatar person={row} className="h-10 w-10" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{row.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.salesCount} vendas com comissão
                  </p>
                </div>
                <div className="text-right text-xs">
                  <p className="font-semibold text-success">{formatBRL(row.paid)} pagas</p>
                  <p className="text-warning">{formatBRL(row.payable)} a pagar</p>
                </div>
              </div>
            ))}
            {sellerRows.length === 0 && (
              <p className="rounded-xl border border-border/60 bg-background/40 p-4 text-sm text-muted-foreground">
                Nenhuma comissão encontrada.
              </p>
            )}
          </div>
        </Card>
      </div>

      <Card className="border-border/60 bg-card/60 p-5">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-display text-lg font-semibold">Histórico de comissões</h3>
            <p className="text-sm text-muted-foreground">
              Cada linha representa um gatilho de comissão, não apenas uma venda.
            </p>
          </div>
          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar comissão..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
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
                <TableHead className="text-right">Venda</TableHead>
                <TableHead className="text-right">Comissão</TableHead>
                <TableHead>Status</TableHead>
                {canManagePayments && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleEntries.map((entry) => {
                const seller = collaboratorsByName.get(normalizeCollaboratorName(entry.seller)) ?? {
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
                        <span className="font-medium">{entry.seller}</span>
                      </div>
                    </TableCell>
                    <TableCell>{entry.client}</TableCell>
                    <TableCell className="text-muted-foreground">{entry.service}</TableCell>
                    <TableCell>
                      <div className="font-medium">{entry.label}</div>
                      <div className="text-xs text-muted-foreground">{entry.triggerLabel}</div>
                      {entry.description && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Obs: {entry.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatBRL(entry.saleValue)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-primary">
                      {formatBRL(entry.amount)}
                      {entry.adjusted && (
                        <div className="text-[11px] font-normal text-muted-foreground">
                          original {formatBRL(entry.originalAmount ?? 0)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusClasses[entry.status]}>
                        {statusLabels[entry.status]}
                      </Badge>
                    </TableCell>
                    {canManagePayments && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditor(entry)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </Button>
                          {entry.status === "paga" ? (
                            <Button variant="ghost" size="sm" onClick={() => markAsPayable(entry)}>
                              <Undo2 className="mr-2 h-4 w-4" />
                              Voltar
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={entry.status === "prevista"}
                              onClick={() => markAsPaid(entry)}
                            >
                              Pagar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {visibleEntries.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={canManagePayments ? 9 : 8}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    Nenhuma comissão encontrada para a busca atual.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function buildSellerRows(
  entries: CommissionEntry[],
  collaboratorsByName: ReturnType<typeof buildCollaboratorMap>,
) {
  const rows = new Map<
    string,
    {
      name: string;
      avatar?: string;
      photoUrl?: string;
      sales: Set<string>;
      paid: number;
      payable: number;
      forecast: number;
    }
  >();

  for (const entry of entries) {
    const normalizedName = normalizeCollaboratorName(entry.seller);
    const collaborator = collaboratorsByName.get(normalizedName);
    const current = rows.get(normalizedName) ?? {
      name: entry.seller,
      avatar: collaborator?.avatar,
      photoUrl: collaborator?.photoUrl,
      sales: new Set<string>(),
      paid: 0,
      payable: 0,
      forecast: 0,
    };

    current.sales.add(entry.saleId);
    if (entry.status === "paga") current.paid += entry.amount;
    if (entry.status === "a_pagar") current.payable += entry.amount;
    if (entry.status === "prevista") current.forecast += entry.amount;
    rows.set(normalizedName, current);
  }

  return [...rows.values()]
    .map((row) => ({
      ...row,
      salesCount: row.sales.size,
      total: row.paid + row.payable + row.forecast,
    }))
    .sort((a, b) => b.total - a.total);
}
