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
  ChevronLeft,
  ChevronRight,
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
import { isLimpaNomeService } from "@/lib/commissions";
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
const allSellersFilter = "__all_sellers__";
const paymentMethodOptions: Array<{ value: PaymentMethod; label: string }> = [
  { value: "avista", label: "À vista" },
  { value: "prazo_pix", label: "Prazo Pix" },
  { value: "credito", label: "Cartão de crédito" },
];

function splitCommissionByEntry(totalCommission: number, saleTotal: number, entryAmount: number) {
  if (totalCommission <= 0) return { entry: 0, pending: 0 };
  if (saleTotal <= 0 || entryAmount <= 0) return { entry: totalCommission, pending: 0 };
  const entry = Math.min(totalCommission, Math.round((totalCommission * entryAmount / saleTotal) * 100) / 100);
  return {
    entry,
    pending: Math.max(Number((totalCommission - entry).toFixed(2)), 0),
  };
}

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
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
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

function SalesMonthSelector({
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

type Sale = (typeof initialSales)[number] & {
  paymentMethod?: PaymentMethod;
  installments?: number;
  prazoPixEntryAmount?: number;
  prazoPixPendingAmount?: number;
  prazoPixDueDays?: number;
  commissionEntryAmount?: number;
  commissionPendingAmount?: number;
  commissionAmount?: number;
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
  prazoPixEntryAmount: "397,00",
  prazoPixPendingAmount: "300,00",
  prazoPixDueDays: "30",
  commissionEntryAmount: "50,00",
  commissionPendingAmount: "50,00",
  commissionAmount: "100,00",
};

function Sales() {
  const [sales, setSales] = usePersistentState<Sale[]>("va-manager:sales", initialSales);
  const [clients] = usePersistentState<Client[]>("va-manager:clients", initialClients);
  const [services] = usePersistentState("va-manager:services", initialServices);
  const [collaborators] = usePersistentState<Collaborator[]>("va-manager:collaborators", sellers);
  const [receivables, setReceivables] = useSyncedReceivables({ sales });
  const [query, setQuery] = useState("");
  const [selectedSalesMonth, setSelectedSalesMonth] = useState(todayLocalISODate().slice(0, 7));
  const [selectedSeller, setSelectedSeller] = useState(allSellersFilter);
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
  const serviceOptions = useMemo(
    () => services.filter((service) => service.status !== "inativo"),
    [services],
  );
  const collaboratorOptions = useMemo(
    () => collaborators.filter((collaborator) => collaborator.name.trim()),
    [collaborators],
  );
  const salesScope = useMemo(
    () =>
      canManageAllSales ? sales : sales.filter((sale) => isOwnedBySession(sale.seller, session)),
    [canManageAllSales, sales, session],
  );
  const sellerFilterOptions = useMemo(() => {
    const names = new Set<string>();

    if (canManageAllSales) {
      collaboratorOptions.forEach((collaborator) => names.add(collaborator.name));
    } else if (session?.name) {
      names.add(session.name);
    }

    salesScope.forEach((sale) => {
      if (sale.seller.trim()) names.add(sale.seller);
    });

    return [...names].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [canManageAllSales, collaboratorOptions, salesScope, session]);

  useEffect(() => {
    if (selectedSeller !== allSellersFilter && !sellerFilterOptions.includes(selectedSeller)) {
      setSelectedSeller(allSellersFilter);
    }
  }, [selectedSeller, sellerFilterOptions]);

  const selectedSales = useMemo(
    () =>
      salesScope.filter((sale) => {
        const isSelectedMonth = isDateInMonth(sale.date, selectedSalesMonth);
        const isSelectedSeller =
          selectedSeller === allSellersFilter || sale.seller === selectedSeller;

        return isSelectedMonth && isSelectedSeller;
      }),
    [salesScope, selectedSalesMonth, selectedSeller],
  );

  const filteredSales = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return selectedSales;

    return selectedSales.filter((sale) =>
      [sale.date, sale.client, sale.service, sale.seller, sale.origin, sale.status]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [selectedSales, query]);

  const saleIds = useMemo(() => new Set(selectedSales.map((sale) => sale.id)), [selectedSales]);
  const receivablesBySale = useMemo(
    () => receivables.filter((receivable) => saleIds.has(receivable.sourceId)),
    [receivables, saleIds],
  );
  const saleIdsWithReceivables = useMemo(
    () => new Set(receivablesBySale.map((receivable) => receivable.sourceId)),
    [receivablesBySale],
  );
  const totalMes = selectedSales.reduce((sum, sale) => sum + sale.value, 0);
  const paidSales = selectedSales.filter((sale) => sale.status === "pago");
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
  const averageTicket = selectedSales.length ? totalMes / selectedSales.length : 0;
  const conversionRate = Math.min(100, Math.round((paidRevenue / Math.max(totalMes, 1)) * 100));
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
  const selectedService = useMemo(
    () => serviceOptions.find((service) => service.name === form.service),
    [form.service, serviceOptions],
  );
  const paymentMethod = form.paymentMethod as PaymentMethod;
  const installmentCount = Number(form.installments) || 1;
  const currentSaleValue = parseCurrencyInput(form.value);
  const prazoPixEntryAmount = parseCurrencyInput(form.prazoPixEntryAmount);
  const prazoPixPendingAmount = parseCurrencyInput(form.prazoPixPendingAmount);
  const prazoPixDueDays = Math.max(1, Math.round(Number(form.prazoPixDueDays) || 30));
  const commissionEntryAmount = parseCurrencyInput(form.commissionEntryAmount);
  const commissionPendingAmount = parseCurrencyInput(form.commissionPendingAmount);
  const commissionAmount = parseCurrencyInput(form.commissionAmount);
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
      prazoPixEntryAmount,
      prazoPixPendingAmount,
      prazoPixDueDays,
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
    prazoPixDueDays,
    prazoPixEntryAmount,
    prazoPixPendingAmount,
  ]);

  const serviceRanking = useMemo(() => {
    const totals = new Map<string, { name: string; sales: number; revenue: number }>();
    for (const sale of selectedSales) {
      const current = totals.get(sale.service) ?? { name: sale.service, sales: 0, revenue: 0 };
      current.sales += 1;
      current.revenue += sale.value;
      totals.set(sale.service, current);
    }
    return [...totals.values()].sort((a, b) => b.sales - a.sales);
  }, [selectedSales]);

  const sellerRanking = useMemo(() => {
    const totals = new Map<
      string,
      { name: string; sales: number; revenue: number; avatar: string; photoUrl?: string }
    >();
    for (const sale of selectedSales) {
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
  }, [collaboratorsByName, selectedSales]);

  const updateForm = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateSaleValue = (value: string) => {
    setForm((current) => {
      if (current.paymentMethod !== "prazo_pix") return { ...current, value };
      const total = parseCurrencyInput(value);
      const entry = parseCurrencyInput(current.prazoPixEntryAmount);
      return {
        ...current,
        value,
        prazoPixPendingAmount: formatCurrencyInput(Math.max(total - entry, 0)),
      };
    });
  };

  const normalizeSaleValue = () => {
    setForm((current) => {
      const total = parseCurrencyInput(current.value);
      if (current.paymentMethod !== "prazo_pix") {
        return { ...current, value: formatCurrencyInput(total) };
      }
      const entry = parseCurrencyInput(current.prazoPixEntryAmount);
      return {
        ...current,
        value: formatCurrencyInput(total),
        prazoPixPendingAmount: formatCurrencyInput(Math.max(total - entry, 0)),
      };
    });
  };

  const normalizePrazoPixEntry = () => {
    setForm((current) => {
      const total = parseCurrencyInput(current.value);
      const entry = parseCurrencyInput(current.prazoPixEntryAmount);
      return {
        ...current,
        prazoPixEntryAmount: formatCurrencyInput(entry),
        prazoPixPendingAmount: formatCurrencyInput(Math.max(total - entry, 0)),
      };
    });
  };

  const normalizePrazoPixPending = () => {
    setForm((current) => {
      const entry = parseCurrencyInput(current.prazoPixEntryAmount);
      const pending = parseCurrencyInput(current.prazoPixPendingAmount);
      return {
        ...current,
        prazoPixPendingAmount: formatCurrencyInput(pending),
        value: formatCurrencyInput(entry + pending),
      };
    });
  };

  const normalizeCommissionEntry = () => {
    setForm((current) => {
      const entry = parseCurrencyInput(current.commissionEntryAmount);
      const pending = parseCurrencyInput(current.commissionPendingAmount);
      return {
        ...current,
        commissionEntryAmount: formatCurrencyInput(entry),
        commissionAmount: formatCurrencyInput(entry + pending),
      };
    });
  };

  const normalizeCommissionPending = () => {
    setForm((current) => {
      const entry = parseCurrencyInput(current.commissionEntryAmount);
      const pending = parseCurrencyInput(current.commissionPendingAmount);
      return {
        ...current,
        commissionPendingAmount: formatCurrencyInput(pending),
        commissionAmount: formatCurrencyInput(entry + pending),
      };
    });
  };

  const normalizeCommissionAmount = () => {
    setForm((current) => ({
      ...current,
      commissionAmount: formatCurrencyInput(parseCurrencyInput(current.commissionAmount)),
    }));
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
    const serviceDefaultCommission =
      serviceOptions.find((serviceItem) => serviceItem.name === sale.service)?.commission ?? 0;
    const savedTotalCommission =
      sale.commissionAmount ??
      sale.commissionEntryAmount ??
      (isLimpaNomeService(sale.service) ? 100 : serviceDefaultCommission);
    const splitDefault =
      isLimpaNomeService(sale.service)
        ? { entry: sale.commissionEntryAmount ?? 50, pending: sale.commissionPendingAmount ?? 50 }
        : splitCommissionByEntry(
            serviceDefaultCommission,
            sale.value,
            sale.prazoPixEntryAmount ?? Math.min(397, sale.value),
          );
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
      prazoPixEntryAmount: formatCurrencyInput(sale.prazoPixEntryAmount ?? Math.min(397, sale.value)),
      prazoPixPendingAmount: formatCurrencyInput(
        sale.prazoPixPendingAmount ?? Math.max(sale.value - Math.min(397, sale.value), 0),
      ),
      prazoPixDueDays: String(sale.prazoPixDueDays ?? 30),
      commissionEntryAmount: formatCurrencyInput(sale.commissionEntryAmount ?? splitDefault.entry),
      commissionPendingAmount: formatCurrencyInput(sale.commissionPendingAmount ?? splitDefault.pending),
      commissionAmount: formatCurrencyInput(
        sale.commissionAmount ??
          (method === "avista"
            ? savedTotalCommission
            : (sale.commissionEntryAmount ?? splitDefault.entry) +
              (sale.commissionPendingAmount ?? splitDefault.pending)),
      ),
    });
    setOpen(true);
  };

  const closeSaleDialog = () => {
    setOpen(false);
    setForm(emptySaleForm);
  };

  const selectPaymentMethod = (method: string) => {
    const nextMethod = method as PaymentMethod;
    setForm((current) => {
      const currentTotal = parseCurrencyInput(current.value);
      const nextValue =
        nextMethod === "prazo_pix" ? formatCurrencyInput(currentTotal || 697) : current.value;
      const entry = parseCurrencyInput(current.prazoPixEntryAmount || "397,00") || 397;
      const commissionEntry = parseCurrencyInput(current.commissionEntryAmount);
      const commissionPending = parseCurrencyInput(current.commissionPendingAmount);
      const serviceDefaultCommission =
        serviceOptions.find((service) => service.name === current.service)?.commission ?? 0;
      const currentCommissionTotal =
        parseCurrencyInput(current.commissionAmount) || commissionEntry + commissionPending || serviceDefaultCommission;
      const split =
        isLimpaNomeService(current.service)
          ? { entry: commissionEntry || 50, pending: commissionPending || 50 }
          : splitCommissionByEntry(currentCommissionTotal, parseCurrencyInput(nextValue), entry);

      return {
        ...current,
        paymentMethod: nextMethod,
        installments: nextMethod === "credito" ? current.installments : "1",
        value: nextValue,
        prazoPixEntryAmount:
          nextMethod === "prazo_pix"
            ? formatCurrencyInput(entry)
            : current.prazoPixEntryAmount,
        prazoPixPendingAmount:
          nextMethod === "prazo_pix"
            ? formatCurrencyInput(Math.max(parseCurrencyInput(nextValue) - entry, 0))
            : current.prazoPixPendingAmount,
        prazoPixDueDays:
          nextMethod === "prazo_pix" ? current.prazoPixDueDays || "30" : current.prazoPixDueDays,
        commissionEntryAmount:
          nextMethod === "avista" ? current.commissionEntryAmount : formatCurrencyInput(split.entry),
        commissionPendingAmount:
          nextMethod === "avista" ? current.commissionPendingAmount : formatCurrencyInput(split.pending),
        commissionAmount:
          nextMethod === "avista"
            ? formatCurrencyInput(currentCommissionTotal)
            : formatCurrencyInput(split.entry + split.pending),
      };
    });
  };

  const selectService = (serviceName: string) => {
    const selectedService = serviceOptions.find((service) => service.name === serviceName);
    const nextValue = formatCurrencyInput(selectedService?.price ?? 0);
    const isLimpaNome = isLimpaNomeService(serviceName);
    setForm((current) => ({
      ...current,
      service: serviceName,
      value: nextValue,
      ...(() => {
        const defaultCommission = Number(selectedService?.commission ?? 0);
        const split =
          isLimpaNome
            ? { entry: 50, pending: 50 }
            : current.paymentMethod === "prazo_pix"
              ? splitCommissionByEntry(
                  defaultCommission,
                  parseCurrencyInput(nextValue),
                  parseCurrencyInput(current.prazoPixEntryAmount),
                )
              : current.paymentMethod === "credito"
                ? { entry: 0, pending: defaultCommission }
                : { entry: defaultCommission, pending: 0 };

        return {
          commissionEntryAmount: formatCurrencyInput(split.entry),
          commissionPendingAmount: formatCurrencyInput(split.pending),
          commissionAmount: formatCurrencyInput(split.entry + split.pending),
        };
      })(),
      prazoPixPendingAmount:
        current.paymentMethod === "prazo_pix"
          ? formatCurrencyInput(
              Math.max(parseCurrencyInput(nextValue) - parseCurrencyInput(current.prazoPixEntryAmount), 0),
            )
          : current.prazoPixPendingAmount,
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
    const method = form.paymentMethod as PaymentMethod;
    const installments = Number(form.installments) || 1;
    const entryAmount = method === "prazo_pix" ? parseCurrencyInput(form.prazoPixEntryAmount) : 0;
    const pendingAmount =
      method === "prazo_pix" ? parseCurrencyInput(form.prazoPixPendingAmount) : 0;
    const dueDays = Math.max(1, Math.round(Number(form.prazoPixDueDays) || 30));
    const entryCommission = parseCurrencyInput(form.commissionEntryAmount);
    const pendingCommission = parseCurrencyInput(form.commissionPendingAmount);
    const singleCommission = parseCurrencyInput(form.commissionAmount);
    const value =
      method === "prazo_pix"
        ? Number((entryAmount + pendingAmount).toFixed(2))
        : parseCurrencyInput(form.value);
    const status =
      method === "avista" || (method === "prazo_pix" && pendingAmount <= 0)
        ? "pago"
        : method === "prazo_pix"
          ? "pago parcialmente"
          : "pendente";
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
      prazoPixEntryAmount: entryAmount,
      prazoPixPendingAmount: pendingAmount,
      prazoPixDueDays: dueDays,
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
      prazoPixEntryAmount: method === "prazo_pix" ? entryAmount : undefined,
      prazoPixPendingAmount: method === "prazo_pix" ? pendingAmount : undefined,
      prazoPixDueDays: method === "prazo_pix" ? dueDays : undefined,
      commissionEntryAmount: method === "avista" ? undefined : entryCommission,
      commissionPendingAmount: method === "avista" ? undefined : pendingCommission,
      commissionAmount:
        method === "avista" ? singleCommission || entryCommission + pendingCommission : undefined,
    };

    setSales((current) =>
      form.id ? current.map((item) => (item.id === form.id ? sale : item)) : [sale, ...current],
    );
    setReceivables((current) => [...schedule, ...current.filter((item) => item.sourceId !== id)]);

    closeSaleDialog();
    toast.success(form.id ? "Venda atualizada." : "Venda registrada.");
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
    const rows = selectedSales.map((sale) => [
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
                      onChange={updateSaleValue}
                      onBlur={normalizeSaleValue}
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
                    {paymentMethod === "prazo_pix" && (
                      <>
                        <SaleField
                          label="Entrada Pix"
                          value={form.prazoPixEntryAmount}
                          onChange={(value) => updateForm("prazoPixEntryAmount", value)}
                          onBlur={normalizePrazoPixEntry}
                        />
                        <SaleField
                          label="Valor a receber"
                          value={form.prazoPixPendingAmount}
                          onChange={(value) => updateForm("prazoPixPendingAmount", value)}
                          onBlur={normalizePrazoPixPending}
                        />
                        <SaleField
                          label="Prazo para receber (dias)"
                          value={form.prazoPixDueDays}
                          onChange={(value) =>
                            updateForm("prazoPixDueDays", value.replace(/\D/g, ""))
                          }
                          onBlur={() =>
                            updateForm(
                              "prazoPixDueDays",
                              String(Math.max(1, Math.round(Number(form.prazoPixDueDays) || 30))),
                            )
                          }
                          type="number"
                        />
                      </>
                    )}
                    {paymentMethod === "avista" ? (
                      <SaleField
                        label="Comissão total à vista"
                        value={form.commissionAmount}
                        onChange={(value) => updateForm("commissionAmount", value)}
                        onBlur={normalizeCommissionAmount}
                      />
                    ) : (
                      <>
                        <SaleField
                          label="Comissão da entrada"
                          value={form.commissionEntryAmount}
                          onChange={(value) => updateForm("commissionEntryAmount", value)}
                          onBlur={normalizeCommissionEntry}
                        />
                        <SaleField
                          label="Comissão prevista/final"
                          value={form.commissionPendingAmount}
                          onChange={(value) => updateForm("commissionPendingAmount", value)}
                          onBlur={normalizeCommissionPending}
                        />
                      </>
                    )}
                  </div>
                  <div className="mt-4 rounded-lg border border-border/60 bg-background/40 p-3 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Previsão de recebimento: </span>
                    {currentPaymentPreview || "Informe o valor para calcular."}
                    <div className="mt-1">
                      <span className="font-medium text-foreground">Comissão: </span>
                      {paymentMethod !== "avista"
                        ? `${formatBRL(commissionEntryAmount)} na entrada + ${formatBRL(commissionPendingAmount)} prevista`
                        : `${formatBRL(commissionAmount)} ao liberar a venda`}
                      {selectedService?.commission ? (
                        <span> · padrão do serviço: {formatBRL(selectedService.commission)}</span>
                      ) : null}
                    </div>
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
          value={String(selectedSales.length)}
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
                Soma das vendas da competência e vendedor selecionados.
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
          <p className="text-xs text-muted-foreground">{formatMonthLabel(selectedSalesMonth)}</p>
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
          <p className="text-xs text-muted-foreground">{formatMonthLabel(selectedSalesMonth)}</p>
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
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-semibold">Histórico recente</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatMonthLabel(selectedSalesMonth)} · {selectedSales.length} vendas no filtro
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <SalesMonthSelector month={selectedSalesMonth} onMonthChange={setSelectedSalesMonth} />
            <Select value={selectedSeller} onValueChange={setSelectedSeller}>
              <SelectTrigger className="h-9 w-52" aria-label="Selecionar vendedor">
                <SelectValue placeholder="Todos os vendedores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={allSellersFilter}>Todos os vendedores</SelectItem>
                {sellerFilterOptions.map((seller) => (
                  <SelectItem key={seller} value={seller}>
                    {seller}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                    Nenhuma venda encontrada para os filtros atuais.
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
