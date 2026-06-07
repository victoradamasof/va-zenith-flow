import type { Receivable } from "@/lib/receivables";

export const commissionPaymentsKey = "va-manager:commission-payments";

export type CommissionPayment = {
  id: string;
  paidAt: string;
};

export type CommissionStatus = "prevista" | "a_pagar" | "paga";

export type CommissionEntry = {
  id: string;
  saleId: string;
  saleDate: string;
  dueDate: string;
  paidAt?: string;
  seller: string;
  client: string;
  service: string;
  saleValue: number;
  amount: number;
  label: string;
  trigger: "venda" | "entrada_limpa_nome" | "entrega_limpa_nome";
  triggerLabel: string;
  status: CommissionStatus;
  sourceReceivableId?: string;
};

type CommissionSale = {
  id: string;
  date: string;
  client: string;
  service: string;
  seller: string;
  status: string;
  value: number;
};

type CommissionService = {
  name: string;
  commission?: number;
};

export type CommissionSummary = {
  total: number;
  paid: number;
  payable: number;
  forecast: number;
  count: number;
};

function normalizeText(value = "") {
  return value
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function isLimpaNomeService(service = "") {
  const normalized = normalizeText(service);
  return normalized.includes("limpa") && normalized.includes("nome");
}

function getPayment(payments: CommissionPayment[], entryId: string) {
  return payments.find((payment) => payment.id === entryId);
}

function getServiceCommission(services: CommissionService[], serviceName: string) {
  const normalizedService = normalizeText(serviceName);
  const service = services.find((item) => normalizeText(item.name) === normalizedService);
  return Number(service?.commission ?? 0);
}

function receivedAmount(receivables: Receivable[]) {
  return receivables
    .filter((receivable) => receivable.status === "recebido")
    .reduce((sum, receivable) => sum + receivable.amount, 0);
}

function sortReceivablesByDueDate(receivables: Receivable[]) {
  return [...receivables].sort((a, b) => {
    const dateDiff = Date.parse(a.dueDate) - Date.parse(b.dueDate);
    if (dateDiff !== 0) return dateDiff;
    return a.id.localeCompare(b.id);
  });
}

function getLimpaNomeReceivables(receivables: Receivable[]) {
  const sorted = sortReceivablesByDueDate(receivables);
  const entryReceivable =
    sorted.find((receivable) => normalizeText(receivable.label).includes("entrada")) ??
    sorted[0];
  const finalReceivable =
    sorted.find((receivable) => receivable.id !== entryReceivable?.id) ??
    sorted[sorted.length - 1];

  return { entryReceivable, finalReceivable };
}

function getEntryStatus({
  entryId,
  earned,
  payments,
}: {
  entryId: string;
  earned: boolean;
  payments: CommissionPayment[];
}): { status: CommissionStatus; paidAt?: string } {
  const payment = getPayment(payments, entryId);
  if (payment) return { status: "paga", paidAt: payment.paidAt };
  return { status: earned ? "a_pagar" : "prevista" };
}

export function calculateCommissionEntries({
  sales,
  services,
  receivables,
  payments,
}: {
  sales: CommissionSale[];
  services: CommissionService[];
  receivables?: Receivable[];
  payments?: CommissionPayment[];
}) {
  const allReceivables = receivables ?? [];
  const allPayments = payments ?? [];

  return sales.flatMap((sale) => {
    const saleReceivables = allReceivables.filter((receivable) => receivable.sourceId === sale.id);
    const saleReceived = receivedAmount(saleReceivables);
    const hasReceivables = saleReceivables.length > 0;

    if (isLimpaNomeService(sale.service)) {
      const { entryReceivable, finalReceivable } = getLimpaNomeReceivables(saleReceivables);
      const entryThreshold = Math.min(397, sale.value);
      const finalThreshold = Math.max(sale.value, entryThreshold);
      const entryEarned = hasReceivables
        ? saleReceived >= entryThreshold || entryReceivable?.status === "recebido"
        : sale.status === "pago" || sale.status === "pago parcialmente";
      const finalEarned = hasReceivables
        ? saleReceived >= finalThreshold ||
          Boolean(finalReceivable && finalReceivable.id !== entryReceivable?.id && finalReceivable.status === "recebido")
        : sale.status === "pago";

      const entryId = `${sale.id}:limpa-nome-entrada`;
      const finalId = `${sale.id}:limpa-nome-entrega`;
      const entryStatus = getEntryStatus({ entryId, earned: entryEarned, payments: allPayments });
      const finalStatus = getEntryStatus({ entryId: finalId, earned: finalEarned, payments: allPayments });

      return [
        {
          id: entryId,
          saleId: sale.id,
          saleDate: sale.date,
          dueDate: firstReceivable?.dueDate ?? sale.date,
          paidAt: entryStatus.paidAt,
          seller: sale.seller,
          client: sale.client,
          service: sale.service,
          saleValue: sale.value,
          amount: 50,
          label: "Entrada Limpa Nome",
          trigger: "entrada_limpa_nome" as const,
          triggerLabel: "R$ 50 pela entrada paga",
          status: entryStatus.status,
          sourceReceivableId: entryReceivable?.id,
        },
        {
          id: finalId,
          saleId: sale.id,
          saleDate: sale.date,
          dueDate: finalReceivable?.dueDate ?? sale.date,
          paidAt: finalStatus.paidAt,
          seller: sale.seller,
          client: sale.client,
          service: sale.service,
          saleValue: sale.value,
          amount: 50,
          label: "Entrega Limpa Nome",
          trigger: "entrega_limpa_nome" as const,
          triggerLabel: "R$ 50 após cobrança final recebida",
          status: finalStatus.status,
          sourceReceivableId: finalReceivable?.id,
        },
      ];
    }

    const entryId = `${sale.id}:service-commission`;
    const payment = getPayment(allPayments, entryId);
    const amount = getServiceCommission(services, sale.service);

    return [
      {
        id: entryId,
        saleId: sale.id,
        saleDate: sale.date,
        dueDate: sale.date,
        paidAt: payment?.paidAt,
        seller: sale.seller,
        client: sale.client,
        service: sale.service,
        saleValue: sale.value,
        amount,
        label: "Comissão de venda",
        trigger: "venda" as const,
        triggerLabel: "Liberada ao registrar a venda",
        status: payment ? "paga" : "a_pagar",
      },
    ];
  });
}

export function calculateCommissionSummary(entries: CommissionEntry[]): CommissionSummary {
  return entries.reduce(
    (summary, entry) => {
      summary.count += 1;
      summary.total += entry.amount;
      if (entry.status === "paga") summary.paid += entry.amount;
      if (entry.status === "a_pagar") summary.payable += entry.amount;
      if (entry.status === "prevista") summary.forecast += entry.amount;
      return summary;
    },
    { total: 0, paid: 0, payable: 0, forecast: 0, count: 0 },
  );
}

export function calculatePaidCommissions(entries: CommissionEntry[]) {
  return entries
    .filter((entry) => entry.status === "paga")
    .reduce((sum, entry) => sum + entry.amount, 0);
}

export function calculatePayableCommissions(entries: CommissionEntry[]) {
  return entries
    .filter((entry) => entry.status === "a_pagar")
    .reduce((sum, entry) => sum + entry.amount, 0);
}
