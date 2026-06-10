import { createFileRoute } from "@tanstack/react-router";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DatePickerField } from "@/components/date-picker-field";
import { CollaboratorAvatar } from "@/components/collaborator-avatar";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Download,
  ShoppingCart,
  DollarSign,
  Target,
  TrendingUp,
  Search,
  RotateCcw,
  Wallet,
} from "lucide-react";
import {
  clients as initialClients,
  sales as initialSales,
  sellers,
  services as initialServices,
  formatBRL,
} from "@/lib/mock-data";
import {
  buildCollaboratorMap,
  collaboratorInitials,
  normalizeCollaboratorName,
} from "@/lib/collaborators";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { useSyncedReceivables } from "@/hooks/use-synced-receivables";
import {
  createReceivables,
  formatCurrencyInput,
  parseCurrencyInput,
  type PaymentMethod,
} from "@/lib/receivables";
import { getAuthSession, type AuthSession } from "@/lib/auth";
import { formatLocalDateBR, parseLocalDate, todayLocalISODate } from "@/lib/date-utils";
import { isAdmin, isOwnedBySession } from "@/lib/permissions";

export const Route = createFileRoute("/_app/sales")({
  component: Sales,
  head: () => ({ meta: [{ title: "Vendas - VA Consultoria" }] }),
});

const statusBadge = (status: string) =>
  ({
    pago: "bg-success/15 text-success",
    pendente: "bg-warning/15 text-warning",
    atrasado: "bg-destructive/15 text-destructive",
    parcial: "bg-info/15 text-info",
    "pago parcialmente": "bg-info/15 text-info",
  })[status] ?? "bg-muted";

const statusLabel = (status: string) => (status === "parcial" ? "pago parcialmente" : status);

const leadOrigins = ["Trafego pago", "Trafego organico", "Indicação"];
const installmentOptions = Array.from({ length: 12 }, (_, index) => String(index + 1));
const paymentMethodOptions: Array<{ value: PaymentMethod; label: string }> = [
  { value: "avista", label: "À vista" },
  { value: "prazo_pix", label: "Prazo Pix" },
  { value: "credito", label: "Cartão de crédito" },
];
type Sale = (typeof initialSales)[number] & {
  paymentMethod?: PaymentMethod;
  installments?: number;
};
type Collaborator = (typeof sellers)[number] & { role?: string; photoUrl?: string };
type Client = (typeof initialClients)[number] & {
  address?: string;
  seller?: string;
  paymentMethod?: PaymentMethod;
  installments?: number;
};

const emptySaleForm = {
  id: "",
  date: todayLocalISODate(),
  client: "",
  service: "",
  value: "0",
  seller: "",
  origin: "",
  paymentMethod: "avista" as PaymentMethod,
  installments: "1",
};

function sendSalePushNotification(sale: Sale) {
  return fetch("/api/push/notify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: `sale-${sale.id}`,
      type: "sale",
      title: "Nova venda registrada",
      body: `${sale.client} - ${sale.service} (${formatBRL(sale.value)}) por ${sale.seller}.`,
      tag: `sale-${sale.id}`,
      url: "/sales",
    }),
  }).catch((error) => {
    console.warn("Could not send sale push notification", error);
  });
}

function Sales() {
  const [sales, setSales] = usePersistentState<Sale[]>("va-manager:sales", initialSales);
  const [clients] = usePersistentState<Client[]>("va-manager:clients", initialClients);
  const [services] = usePersistentState("va-manager:services", initialServices);
  const [collaborators] = usePersistentState<Collaborator[]>("va-manager:collaborators", sellers);
  const [receivables, setReceivables] = useSyncedReceivables({ sales });
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptySaleForm);
  const [session, setSession] = useState<AuthSession | null>(null);

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

  const canManageAllSales = isAdmin(session);
  const salesScope = useMemo(
    () =>
      canManageAllSales ? sales : sales.filter((sale) => isOwnedBySession(sale.seller, session)),
    [canManageAllSales, sales, session],
  );

  const filteredSales = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return salesScope;

    return salesScope.filter((sale) =>
      [sale.date, sale.client, sale.service, sale.seller, sale.origin, sale.status]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [salesScope, query]);

  const saleIds = useMemo(() => new Set(salesScope.map((sale) => sale.id)), [salesScope]);
  const receivablesBySale = useMemo(
    () => receivables.filter((receivable) => saleIds.has(receivable.sourceId)),
    [receivables, saleIds],
  );
  const saleIdsWithReceivables = useMemo(
    () => new Set(receivablesBySale.map((receivable) => receivable.sourceId)),
    [receivablesBySale],
  );
  const totalMes = salesScope.reduce((sum, sale) => sum + sale.value, 0);
  const paidSales = salesScope.filter((sale) => sale.status === "pago");
  const paidRevenue =
    receivablesBySale
      .filter((receivable) => receivable.status === "recebido")
      .reduce((sum, receivable) => sum + receivable.amount, 0) +
    paidSales
      .filter((sale) => !saleIdsWithReceivables.has(sale.id))
      .reduce((sum, sale) => sum + sale.value, 0);
  const predictableRevenue = receivablesBySale
    .filter((receivable) => receivable.status === "previsto")
    .reduce((sum, receivable) => sum + receivable.amount, 0);
  const averageTicket = salesScope.length ? Math.round(totalMes / salesScope.length) : 0;
  const conversionRate = Math.min(100, Math.round((paidRevenue / Math.max(totalMes, 1)) * 100));
  const serviceOptions = useMemo(
    () => services.filter((service) => service.status !== "inativo"),
    [services],
  );
  const collaboratorOptions = useMemo(
    () => collaborators.filter((collaborator) => collaborator.name.trim()),
    [collaborators],
  );
  const currentSellerName = useMemo(() => {
    if (canManageAllSales) return "";
    return (
      collaboratorOptions.find((collaborator) => isOwnedBySession(collaborator.name, session))
        ?.name ||
      session?.name ||
      ""
    );
  }, [canManageAllSales, collaboratorOptions, session]);
  const collaboratorsByName = useMemo(
    () => buildCollaboratorMap(collaboratorOptions),
    [collaboratorOptions],
  );
  const clientOptions = useMemo(
    () =>
      clients.filter((client) => client.name.trim()).sort((a, b) => a.name.localeCompare(b.name)),
    [clients],
  );
  const paymentMethod = form.paymentMethod as PaymentMethod;
  const installmentCount = Number(form.installments) || 1;
  const currentSaleValue = parseCurrencyInput(form.value);
  const currentPaymentPreview = useMemo(() => {
    const schedule = createReceivables({
      sourceId: "preview",
      sourceType: "sale",
      client: form.client.trim() || "Cliente",
      service: form.service.trim() || "Serviço",
      seller: form.seller.trim() || "Vendedor",
      origin: form.origin.trim() || leadOrigins[0],
      total: currentSaleValue,
      method: paymentMethod,
      installments: installmentCount,
      saleDate: parseLocalDate(form.date),
    });
    return schedule.map((item) => `${item.label}: ${formatBRL(item.amount)}`).join(" | ");
  }, [
    currentSaleValue,
    form.client,
    form.date,
    form.origin,
    form.seller,
    form.service,
    installmentCount,
    paymentMethod,
  ]);

  const serviceRanking = useMemo(() => {
    const totals = new Map<string, { name: string; sales: number; revenue: number }>();
    for (const sale of salesScope) {
      const current = totals.get(sale.service) ?? { name: sale.service, sales: 0, revenue: 0 };
      current.sales += 1;
      current.revenue += sale.value;
      totals.set(sale.service, current);
    }
    return [...totals.values()].sort((a, b) => b.sales - a.sales);
  }, [salesScope]);

  const sellerRanking = useMemo(() => {
    const totals = new Map<
      string,
      { name: string; sales: number; revenue: number; avatar: string; photoUrl?: string }
    >();
    for (const sale of salesScope) {
      const collaborator = collaboratorsByName.get(normalizeCollaboratorName(sale.seller));
      const avatar = collaborator?.avatar || collaboratorInitials(sale.seller);
      const current = totals.get(sale.seller) ?? {
        name: sale.seller,
        sales: 0,
        revenue: 0,
        avatar,
        photoUrl: collaborator?.photoUrl,
      };
      current.avatar = avatar;
      current.photoUrl = collaborator?.photoUrl;
      current.sales += 1;
      current.revenue += sale.value;
      totals.set(sale.seller, current);
    }
    return [...totals.values()].sort((a, b) => b.revenue - a.revenue);
  }, [collaboratorsByName, salesScope]);

  const updateForm = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const canManageSale = (sale: Sale | undefined) =>
    Boolean(sale && (canManageAllSales || isOwnedBySession(sale.seller, session)));

  const openCreateSale = () => {
    setForm({
      ...emptySaleForm,
      seller: canManageAllSales ? "" : currentSellerName,
    });
    setOpen(true);
  };

  const openEditSale = (sale: Sale) => {
    if (!canManageSale(sale)) {
      toast.error("Você só pode editar vendas vinculadas ao seu usuário.");
      return;
    }

    const method =
      sale.paymentMethod ??
      (sale.status === "pago"
        ? "avista"
        : sale.status === "pago parcialmente"
          ? "prazo_pix"
          : "credito");
    setForm({
      id: sale.id,
      date: sale.date,
      client: sale.client,
      service: sale.service,
      value: formatCurrencyInput(sale.value),
      seller: sale.seller,
      origin: sale.origin,
      paymentMethod: method,
      installments: String(sale.installments ?? 1),
    });
    setOpen(true);
  };

  const closeSaleDialog = () => {
    setOpen(false);
    setForm(emptySaleForm);
  };

  const selectPaymentMethod = (method: string) => {
    const nextMethod = method as PaymentMethod;
    setForm((current) => ({
      ...current,
      paymentMethod: nextMethod,
      installments: nextMethod === "credito" ? current.installments : "1",
      value: nextMethod === "prazo_pix" ? "697,00" : current.value,
    }));
  };

  const selectService = (serviceName: string) => {
    const selectedService = serviceOptions.find((service) => service.name === serviceName);
    setForm((current) => ({
      ...current,
      service: serviceName,
      value: formatCurrencyInput(selectedService?.price ?? 0),
    }));
  };

  const selectClient = (clientName: string) => {
    const selectedClient = clientOptions.find((client) => client.name === clientName);
    setForm((current) => ({
      ...current,
      client: clientName,
      service: current.service || selectedClient?.service || current.service,
      origin: current.origin || selectedClient?.origin || current.origin,
      seller: current.seller || selectedClient?.seller || current.seller,
      value:
        (current.value === "0" || current.value.trim() === "") && selectedClient?.total
          ? formatCurrencyInput(selectedClient.total)
          : current.value,
    }));
  };

  const submitSale = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const client = form.client.trim();
    if (!client) return;
    const id = form.id || `vd-${Date.now()}`;
    const existingSale = form.id ? sales.find((sale) => sale.id === form.id) : undefined;
    if (form.id && !canManageSale(existingSale)) {
      toast.error("Você só pode alterar vendas vinculadas ao seu usuário.");
      return;
    }

    const saleDate = parseLocalDate(form.date);
    const service = form.service.trim() || serviceOptions[0]?.name || initialServices[0].name;
    const seller = canManageAllSales
      ? form.seller.trim() || collaboratorOptions[0]?.name || sellers[0].name
      : currentSellerName || session?.name || form.seller.trim();
    const origin = form.origin.trim() || leadOrigins[0];
    const value = parseCurrencyInput(form.value);
    const method = form.paymentMethod as PaymentMethod;
    const installments = Number(form.installments) || 1;
    const isEditing = Boolean(form.id);
    const status =
      method === "avista" ? "pago" : method === "prazo_pix" ? "pago parcialmente" : "pendente";
    const schedule = createReceivables({
      sourceId: id,
      sourceType: "sale",
      client,
      service,
      seller,
      origin,
      total: value,
      method,
      installments,
      saleDate,
    });

    const sale: Sale = {
      id,
      date: form.date,
      client,
      service,
      value,
      seller,
      origin,
      status,
      paymentMethod: method,
      installments: method === "credito" ? installments : 1,
    };

    setSales((current) =>
      form.id ? current.map((item) => (item.id === form.id ? sale : item)) : [sale, ...current],
    );
    setReceivables((current) => [...schedule, ...current.filter((item) => item.sourceId !== id)]);

    closeSaleDialog();
    toast.success(form.id ? "Venda atualizada." : "Venda registrada.");
    if (!isEditing) {
      void sendSalePushNotification(sale);
    }
  };

  const updateSaleStatus = (id: string, status: string) => {
    const targetSale = sales.find((sale) => sale.id === id);
    if (!canManageSale(targetSale)) {
      toast.error("Você só pode alterar o status das suas vendas.");
      return;
    }

    setSales((current) => current.map((sale) => (sale.id === id ? { ...sale, status } : sale)));
    setReceivables((current) =>
      current.map((receivable, index, list) => {
        if (receivable.sourceId !== id) return receivable;
        const sameSaleReceivables = list.filter((item) => item.sourceId === id);
        const isFirstReceivable = sameSaleReceivables[0]?.id === receivable.id;
        if (status === "pago") return { ...receivable, status: "recebido" };
        if (status === "pago parcialmente") {
          return { ...receivable, status: isFirstReceivable ? "recebido" : "previsto" };
        }
        return { ...receivable, status: "previsto" };
      }),
    );
    toast.success(`Venda marcada como ${status}.`);
  };

  const removeSale = (id: string) => {
    const targetSale = sales.find((sale) => sale.id === id);
    if (!canManageSale(targetSale)) {
      toast.error("Você só pode excluir vendas vinculadas ao seu usuário.");
      return;
    }

    setSales((current) => current.filter((sale) => sale.id !== id));
    setReceivables((current) => current.filter((receivable) => receivable.sourceId !== id));
    toast.success("Venda excluída.");
  };

  const exportCsv = () => {
    const header = ["Data", "Cliente", "Serviço", "Vendedor", "Origem", "Valor", "Status"];
    const rows = salesScope.map((sale) => [
      sale.date,
      sale.client,
      sale.service,
      sale.seller,
      sale.origin,
      String(sale.value),
      sale.status,
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "vendas-va-consultoria.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestão de Vendas"
        subtitle="Histórico, performance e conversão comercial"
        action={
          <>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
            {canManageAllSales && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSales(initialSales);
                  setReceivables([]);
                  toast.success("Vendas de demonstração restauradas.");
                }}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Restaurar demo
              </Button>
            )}
            <Dialog
              open={open}
              onOpenChange={(value) => {
                if (value) {
                  setOpen(true);
                } else {
                  closeSaleDialog();
                }
              }}
            >
              <DialogTrigger asChild>
                <PremiumActionButton
                  icon={<Plus />}
                  title="Nova venda"
                  subtitle="Registrar venda"
                  size="sm"
                  onClick={openCreateSale}
                />
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <form onSubmit={submitSale}>
                  <DialogHeader>
                    <DialogTitle>{form.id ? "Editar venda" : "Nova venda"}</DialogTitle>
                    <DialogDescription>
                      A venda fica persistida neste navegador e ja recalcula os indicadores
                      comerciais.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <DatePickerField
                      label="Data"
                      value={form.date}
                      onChange={(value) => updateForm("date", value)}
                      required
                    />
                    <SaleSelectField
                      label="Cliente"
                      value={form.client}
                      onChange={selectClient}
                      placeholder="Selecione um cliente do CRM"
                      options={[
                        ...new Set([
                          ...clientOptions.map((client) => client.name),
                          ...(form.client ? [form.client] : []),
                        ]),
                      ]}
                    />
                    <SaleSelectField
                      label="Serviço"
                      value={form.service}
                      onChange={selectService}
                      placeholder="Selecione um serviço"
                      options={serviceOptions.map((service) => service.name)}
                    />
                    <SaleField
                      label="Valor"
                      value={form.value}
                      onChange={(value) => updateForm("value", value)}
                      onBlur={() =>
                        updateForm("value", formatCurrencyInput(parseCurrencyInput(form.value)))
                      }
                    />
                    <SaleSelectField
                      label="Vendedor"
                      value={form.seller}
                      onChange={(value) =>
                        canManageAllSales ? updateForm("seller", value) : undefined
                      }
                      placeholder="Selecione o colaborador"
                      options={
                        canManageAllSales
                          ? collaboratorOptions.map((collaborator) => collaborator.name)
                          : [currentSellerName || session?.name || form.seller].filter(Boolean)
                      }
                      disabled={!canManageAllSales}
                    />
                    <SaleSelectField
                      label="Origem"
                      value={form.origin}
                      onChange={(value) => updateForm("origin", value)}
                      placeholder="Selecione a origem"
                      options={leadOrigins}
                    />
                    <SaleSelectField
                      label="Pagamento"
                      value={form.paymentMethod}
                      onChange={selectPaymentMethod}
                      placeholder="Selecione o pagamento"
                      options={paymentMethodOptions.map((method) => method.value)}
                      labels={Object.fromEntries(
                        paymentMethodOptions.map((method) => [method.value, method.label]),
                      )}
                    />
                    {paymentMethod === "credito" && (
                      <SaleSelectField
                        label="Parcelamento"
                        value={form.installments}
                        onChange={(value) => updateForm("installments", value)}
                        placeholder="Quantidade de parcelas"
                        options={installmentOptions}
                        labels={Object.fromEntries(
                          installmentOptions.map((option) => [option, `${option}x`]),
                        )}
                      />
                    )}
                  </div>
                  <div className="mt-4 rounded-lg border border-border/60 bg-background/40 p-3 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Previsão de recebimento: </span>
                    {currentPaymentPreview || "Informe o valor para calcular."}
                  </div>
                  <DialogFooter className="mt-6">
                    <Button type="button" variant="outline" onClick={closeSaleDialog}>
                      Cancelar
                    </Button>
                    <Button type="submit" className="gradient-primary text-primary-foreground">
                      {form.id ? "Atualizar venda" : "Salvar venda"}
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
          label="Vendas registradas"
          value={String(salesScope.length)}
          delta={22}
          icon={ShoppingCart}
          accent="primary"
        />
        <KpiCard
          label="Receita total contratada"
          value={formatBRL(totalMes)}
          delta={18}
          icon={DollarSign}
          accent="success"
        />
        <KpiCard
          label="Receita a receber"
          value={formatBRL(predictableRevenue)}
          icon={Wallet}
          accent="info"
          hint="parcelas futuras"
        />
        <KpiCard
          label="Ticket medio"
          value={formatBRL(averageTicket)}
          delta={4}
          icon={Target}
          accent="info"
        />
        <KpiCard
          label="Taxa de pagamento"
          value={`${conversionRate}%`}
          delta={6}
          icon={TrendingUp}
          accent="warning"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <AnimatedDashboardCard
          title="Receita comercial"
          totalLabel="Contratado"
          primaryLabel="Recebido"
          secondaryLabel="A receber"
          primaryValue={paidRevenue}
          secondaryValue={predictableRevenue}
          primaryDelta={`${conversionRate}% recebido`}
          secondaryDelta="parcelas futuras"
          actionLabel="Sincronizado com financeiro"
        />
        <Card className="border-border/60 bg-card/60 p-5 lg:col-span-2">
          <div className="grid h-full gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-primary/20 bg-primary/10 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Contratado
              </p>
              <p className="mt-3 font-display text-2xl font-semibold text-gradient-primary">
                {formatBRL(totalMes)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Soma das vendas visíveis para este usuário.
              </p>
            </div>
            <div className="rounded-xl border border-success/20 bg-success/10 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Recebido
              </p>
              <p className="mt-3 font-display text-2xl font-semibold text-success">
                {formatBRL(paidRevenue)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Vendas pagas e entradas de parcelas.
              </p>
            </div>
            <div className="rounded-xl border border-info/20 bg-info/10 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Recebível
              </p>
              <p className="mt-3 font-display text-2xl font-semibold text-info">
                {formatBRL(predictableRevenue)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Parcelas previstas para os próximos períodos.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/60 bg-card/60 p-5">
          <h3 className="font-display text-base font-semibold">Melhor vendedor</h3>
          <p className="text-xs text-muted-foreground">Base atual</p>
          <div className="mt-4 flex items-center gap-3">
            <CollaboratorAvatar
              person={sellerRanking[0]}
              className="h-12 w-12 text-sm shadow-glow"
            />
            <div>
              <p className="font-medium">{sellerRanking[0]?.name ?? "Sem vendas"}</p>
              <p className="text-xs text-muted-foreground">
                {sellerRanking[0]?.sales ?? 0} vendas - {formatBRL(sellerRanking[0]?.revenue ?? 0)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="border-border/60 bg-card/60 p-5">
          <h3 className="font-display text-base font-semibold">Serviço mais vendido</h3>
          <p className="text-xs text-muted-foreground">Base atual</p>
          <div className="mt-4">
            <p className="font-medium">{serviceRanking[0]?.name ?? "Sem vendas"}</p>
            <p className="text-xs text-muted-foreground">{serviceRanking[0]?.sales ?? 0} vendas</p>
            <p className="mt-2 font-display text-xl font-semibold text-primary">
              {formatBRL(serviceRanking[0]?.revenue ?? 0)}
            </p>
          </div>
        </Card>
        <Card className="border-border/60 bg-card/60 p-5">
          <h3 className="font-display text-base font-semibold">Receita recebida</h3>
          <p className="text-xs text-muted-foreground">Somente vendas pagas</p>
          <p className="mt-4 font-display text-3xl font-semibold text-gradient-primary">
            {formatBRL(paidRevenue)}
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full gradient-primary" style={{ width: `${conversionRate}%` }} />
          </div>
        </Card>
      </div>

      <Card className="border-border/60 bg-card/60 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-base font-semibold">Histórico recente</h3>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar venda..."
              className="h-9 w-64 pl-8"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-border/60">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Serviço</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSales.map((sale) => {
                const seller = collaboratorsByName.get(normalizeCollaboratorName(sale.seller)) ?? {
                  name: sale.seller,
                };

                return (
                  <TableRow key={sale.id} className="hover:bg-muted/30">
                    <TableCell className="text-muted-foreground">
                      {formatLocalDateBR(sale.date)}
                    </TableCell>
                    <TableCell className="font-medium">{sale.client}</TableCell>
                    <TableCell>{sale.service}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CollaboratorAvatar person={seller} className="h-7 w-7 text-[11px]" />
                        <span>{sale.seller}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-border/60 text-xs">
                        {sale.origin}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatBRL(sale.value)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`${statusBadge(sale.status)} hover:${statusBadge(sale.status)}`}
                      >
                        {statusLabel(sale.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditSale(sale)}>
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateSaleStatus(sale.id, "pago")}
                        >
                          Pago
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateSaleStatus(sale.id, "pago parcialmente")}
                        >
                          Parcial
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateSaleStatus(sale.id, "pendente")}
                        >
                          Pendente
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => removeSale(sale.id)}>
                          Excluir
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredSales.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    Nenhuma venda encontrada para a busca atual.
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

function SaleField({
  label,
  value,
  onChange,
  onBlur,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
    </div>
  );
}

function SaleSelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  labels,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
  labels?: Record<string, string>;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {labels?.[option] ?? option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
