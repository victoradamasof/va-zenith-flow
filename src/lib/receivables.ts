import { addLocalDays, addLocalMonths, toLocalISODate } from "@/lib/date-utils";

export type PaymentMethod = "avista" | "prazo_pix" | "credito";

export type Receivable = {
  id: string;
  sourceId: string;
  sourceType?: "sale" | "client";
  client: string;
  service: string;
  seller: string;
  origin: string;
  dueDate: string;
  amount: number;
  method: PaymentMethod;
  label: string;
  status: "recebido" | "previsto";
};

export const paymentMethods = [
  { value: "avista", label: "À vista" },
  { value: "prazo_pix", label: "Prazo Pix" },
  { value: "credito", label: "Cartão de crédito" },
] as const;

export function parseCurrencyInput(value: string) {
  const normalized = value.trim().replace(/[^\d,.]/g, "");
  if (!normalized) return 0;
  if (normalized.includes(",")) {
    return Number(normalized.replace(/\./g, "").replace(",", ".")) || 0;
  }
  return Number(normalized.replace(/\./g, "")) || 0;
}

export function formatCurrencyInput(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function addDays(date: Date, days: number) {
  return addLocalDays(date, days);
}

function addMonths(date: Date, months: number) {
  return addLocalMonths(date, months);
}

function toISODate(date: Date) {
  return toLocalISODate(date);
}

export function createReceivables({
  sourceId,
  client,
  service,
  seller,
  origin,
  total,
  method,
  installments,
  saleDate = new Date(),
  sourceType,
}: {
  sourceId: string;
  sourceType?: Receivable["sourceType"];
  client: string;
  service: string;
  seller: string;
  origin: string;
  total: number;
  method: PaymentMethod;
  installments: number;
  saleDate?: Date;
}) {
  const safeTotal = Math.max(total, 0);

  if (method === "prazo_pix") {
    const paidNow = Math.min(397, safeTotal);
    const pending = Math.max(safeTotal - paidNow, 0);
    return [
      {
        id: `${sourceId}-pix-entrada`,
        sourceId,
        sourceType,
        client,
        service,
        seller,
        origin,
        dueDate: toISODate(saleDate),
        amount: paidNow,
        method,
        label: "Pix pago na entrada",
        status: "recebido" as const,
      },
      ...(pending > 0
        ? [
            {
              id: `${sourceId}-pix-30d`,
              sourceId,
              sourceType,
              client,
              service,
              seller,
              origin,
              dueDate: toISODate(addDays(saleDate, 30)),
              amount: pending,
              method,
              label: "Pix a prazo - 30 dias",
              status: "previsto" as const,
            },
          ]
        : []),
    ];
  }

  if (method === "credito") {
    const count = Math.min(Math.max(installments, 1), 12);
    const base = Math.floor((safeTotal / count) * 100) / 100;
    return Array.from({ length: count }, (_, index) => {
      const isLast = index === count - 1;
      const amount = isLast ? Number((safeTotal - base * (count - 1)).toFixed(2)) : base;
      return {
        id: `${sourceId}-card-${index + 1}`,
        sourceId,
        sourceType,
        client,
        service,
        seller,
        origin,
        dueDate: toISODate(addMonths(saleDate, index)),
        amount,
        method,
        label: `Cartão ${index + 1}/${count}`,
        status: "previsto" as const,
      };
    });
  }

  return [
    {
      id: `${sourceId}-avista`,
      sourceId,
      sourceType,
      client,
      service,
      seller,
      origin,
      dueDate: toISODate(saleDate),
      amount: safeTotal,
      method,
      label: "Pagamento a vista",
      status: "recebido" as const,
    },
  ];
}
