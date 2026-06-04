import type { Receivable } from "@/lib/receivables";

export type ServiceCostStatus = "realizado" | "previsto";

export type ServiceCostEntry = {
  id: string;
  saleId: string;
  date: string;
  seller: string;
  client: string;
  service: string;
  saleValue: number;
  amount: number;
  status: ServiceCostStatus;
};

type CostSale = {
  id: string;
  date: string;
  client: string;
  service: string;
  seller: string;
  status: string;
  value: number;
};

type CostService = {
  name: string;
  cost?: number;
};

function normalizeText(value = "") {
  return value
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getServiceCost(services: CostService[], serviceName: string) {
  const normalizedService = normalizeText(serviceName);
  const service = services.find((item) => normalizeText(item.name) === normalizedService);
  return Number(service?.cost ?? 0);
}

function saleHasReceivedRevenue(sale: CostSale, receivables: Receivable[]) {
  const saleReceivables = receivables.filter((receivable) => receivable.sourceId === sale.id);
  if (saleReceivables.length) {
    return saleReceivables.some((receivable) => receivable.status === "recebido");
  }

  return sale.status === "pago" || sale.status === "pago parcialmente";
}

export function calculateServiceCostEntries({
  sales,
  services,
  receivables,
}: {
  sales: CostSale[];
  services: CostService[];
  receivables?: Receivable[];
}) {
  const allReceivables = receivables ?? [];

  return sales
    .map((sale) => {
      const amount = getServiceCost(services, sale.service);
      return {
        id: `${sale.id}:service-cost`,
        saleId: sale.id,
        date: sale.date,
        seller: sale.seller,
        client: sale.client,
        service: sale.service,
        saleValue: sale.value,
        amount,
        status: saleHasReceivedRevenue(sale, allReceivables) ? "realizado" : "previsto",
      } satisfies ServiceCostEntry;
    })
    .filter((entry) => entry.amount > 0);
}

export function calculateRealizedServiceCosts(entries: ServiceCostEntry[]) {
  return entries
    .filter((entry) => entry.status === "realizado")
    .reduce((sum, entry) => sum + entry.amount, 0);
}

export function calculatePendingServiceCosts(entries: ServiceCostEntry[]) {
  return entries
    .filter((entry) => entry.status === "previsto")
    .reduce((sum, entry) => sum + entry.amount, 0);
}
