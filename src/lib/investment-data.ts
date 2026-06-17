import { parseCurrencyInput, roundCurrency } from "@/lib/currency";

export type InvestmentItem = {
  id: string;
  item: string;
  description?: string;
  category: string;
  quantity: number;
  unitValue: number;
  planned: number;
  spent: number;
  status:
    | "A pagar"
    | "Pendente"
    | "Pago"
    | "Parcial"
    | "Reservado"
    | "Cancelado"
    | "Passou do planejado";
};

export const defaultInvestmentContribution = 30000;
export const investmentContribution = defaultInvestmentContribution;
export const investmentContributionKey = "va-manager:investment-contribution";
export const cashInvestmentId = "inv-cash";

export const investmentStatuses: InvestmentItem["status"][] = [
  "A pagar",
  "Pendente",
  "Pago",
  "Parcial",
  "Reservado",
  "Cancelado",
  "Passou do planejado",
];

function parseMoney(value: unknown) {
  return parseCurrencyInput(value);
}

function normalizeStatus(status: unknown): InvestmentItem["status"] {
  if (investmentStatuses.includes(status as InvestmentItem["status"])) {
    return status as InvestmentItem["status"];
  }

  const normalized = String(status ?? "")
    .trim()
    .toLowerCase();
  if (normalized === "pago") return "Pago";
  if (normalized === "parcial") return "Parcial";
  if (normalized === "pendente") return "Pendente";
  if (normalized === "reservado") return "Reservado";
  if (normalized === "cancelado") return "Cancelado";
  if (normalized.includes("passou")) return "Passou do planejado";
  return "A pagar";
}

function normalizeInvestmentText(value: unknown, fallback: string) {
  const text = String(value || fallback).trim();
  const normalized = text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  const directMap: Record<string, string> = {
    "gestao de trafego": "Gestão de tráfego",
    "gestao de tráfego": "Gestão de tráfego",
    "gestão de tráfego": "Gestão de tráfego",
    trafego: "Tráfego",
    "calcao/aluguel": "Caução/aluguel",
    "calção/aluguel": "Caução/aluguel",
    "espaco fisico": "Espaço físico",
    "espaço fisico": "Espaço físico",
    operacao: "Operação",
    "operaçao": "Operação",
    decoracao: "Decoração",
    "decoraçao": "Decoração",
    macbook: "MacBook",
    "acessorios cel/limpeza": "Acessórios celular/limpeza",
    "acessórios cel/limpeza": "Acessórios celular/limpeza",
  };

  return directMap[normalized] ?? directMap[text.toLowerCase()] ?? text;
}

export function normalizeInvestmentByStatus(item: Partial<InvestmentItem>): InvestmentItem {
  const quantity = Math.max(1, Math.round(parseMoney(item.quantity)));
  const unitValue = parseMoney(item.unitValue);
  const planned = parseMoney(item.planned) || roundCurrency(quantity * unitValue);
  const rawSpent = parseMoney(item.spent);
  const status = normalizeStatus(item.status);
  const normalized: InvestmentItem = {
    id: String(item.id || `inv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
    item:
      String(item.item || "Investimento").trim() === "Vencedor"
        ? "Victor"
        : normalizeInvestmentText(item.item, "Investimento"),
    description: String(item.description || "").trim(),
    category: normalizeInvestmentText(item.category, "Outros"),
    quantity,
    unitValue,
    planned,
    spent: Math.max(rawSpent, 0),
    status,
  };

  if (normalized.status === "Reservado" || normalized.status === "Cancelado") {
    return { ...normalized, spent: 0 };
  }

  if (normalized.status === "Passou do planejado" || normalized.spent > normalized.planned) {
    return {
      ...normalized,
      status: "Passou do planejado",
      spent: Math.max(normalized.spent, normalized.planned),
    };
  }

  if (normalized.spent > 0 && normalized.spent < normalized.planned) {
    return { ...normalized, status: "Parcial" };
  }

  if (normalized.spent >= normalized.planned && normalized.planned > 0) {
    return { ...normalized, status: "Pago", spent: normalized.planned };
  }

  if (normalized.status === "Pago") {
    return { ...normalized, spent: normalized.planned };
  }

  if (normalized.status === "Parcial") {
    return { ...normalized, spent: Math.min(Math.max(normalized.spent, 0), normalized.planned) };
  }

  return { ...normalized, spent: 0 };
}

export function isCashInvestment(item: Partial<InvestmentItem>) {
  const name = String(item.item ?? "")
    .trim()
    .toLowerCase();
  return item.id === cashInvestmentId || name === "caixa";
}

export function syncInvestmentCashItem(
  items: Array<Partial<InvestmentItem>>,
  contribution = defaultInvestmentContribution,
) {
  const normalizedOperationalItems = items
    .map(normalizeInvestmentByStatus)
    .filter((item) => !isCashInvestment(item));
  const operationalPlanned = normalizedOperationalItems.reduce(
    (sum, item) => sum + item.planned,
    0,
  );
  const cashValue = Math.max(contribution - operationalPlanned, 0);
  const cashItem = normalizeInvestmentByStatus({
    id: cashInvestmentId,
    item: "Caixa",
    category: "Reserva",
    quantity: 1,
    unitValue: cashValue,
    planned: cashValue,
    spent: 0,
    status: "Reservado",
  });

  return [...normalizedOperationalItems, cashItem];
}

export const investmentItems: InvestmentItem[] = [
  {
    id: "inv-1",
    item: "Notebook",
    category: "Equipamentos",
    quantity: 1,
    unitValue: 2700,
    planned: 2700,
    spent: 0,
    status: "A pagar",
  },
  {
    id: "inv-2",
    item: "Celular",
    category: "Equipamentos",
    quantity: 1,
    unitValue: 593,
    planned: 593,
    spent: 593,
    status: "Pago",
  },
  {
    id: "inv-3",
    item: "Gestão de tráfego",
    category: "Marketing",
    quantity: 3,
    unitValue: 1667,
    planned: 5001,
    spent: 0,
    status: "A pagar",
  },
  {
    id: "inv-4",
    item: "Calcao/aluguel",
    category: "Espaco fisico",
    quantity: 3,
    unitValue: 2300,
    planned: 6900,
    spent: 6900,
    status: "Pago",
  },
  {
    id: "inv-5",
    item: "Ajuda de custo/Colaborador",
    category: "Pessoas",
    quantity: 2,
    unitValue: 1000,
    planned: 2000,
    spent: 0,
    status: "A pagar",
  },
  {
    id: "inv-6",
    item: "Cadeiras",
    category: "Estrutura",
    quantity: 2,
    unitValue: 389.86,
    planned: 779.72,
    spent: 779.72,
    status: "Pago",
  },
  {
    id: "inv-7",
    item: "Trafego",
    category: "Marketing",
    quantity: 2,
    unitValue: 2000,
    planned: 4000,
    spent: 0,
    status: "A pagar",
  },
  {
    id: "inv-8",
    item: "Frigobar",
    category: "Estrutura",
    quantity: 1,
    unitValue: 661.01,
    planned: 661.01,
    spent: 661.01,
    status: "Pago",
  },
  {
    id: "inv-9",
    item: "Victor",
    category: "Pessoas",
    quantity: 1,
    unitValue: 1800,
    planned: 1800,
    spent: 1800,
    status: "Pago",
  },
  {
    id: "inv-10",
    item: "Custos fixos",
    category: "Operacao",
    quantity: 1,
    unitValue: 1000,
    planned: 1000,
    spent: 0,
    status: "A pagar",
  },
  {
    id: "inv-11",
    item: "Ferramentas comerciais",
    category: "Comercial",
    quantity: 1,
    unitValue: 300,
    planned: 300,
    spent: 0,
    status: "A pagar",
  },
  {
    id: "inv-12",
    item: "Camisas",
    category: "Marca/Uniforme",
    quantity: 4,
    unitValue: 50,
    planned: 200,
    spent: 0,
    status: "A pagar",
  },
  {
    id: "inv-13",
    item: "Cadeira cliente",
    category: "Estrutura",
    quantity: 2,
    unitValue: 250,
    planned: 500,
    spent: 0,
    status: "Pago",
  },
  {
    id: "inv-14",
    item: "Decoracao",
    category: "Estrutura",
    quantity: 1,
    unitValue: 500,
    planned: 500,
    spent: 0,
    status: "Pago",
  },
  {
    id: "inv-15",
    item: "Caixa",
    category: "Reserva",
    quantity: 1,
    unitValue: 3066.27,
    planned: 3066.27,
    spent: 0,
    status: "Reservado",
  },
];

export function summarizeInvestments(
  items: Array<Partial<InvestmentItem>>,
  contribution = defaultInvestmentContribution,
) {
  const normalizedItems = syncInvestmentCashItem(items, contribution);
  const operationalItems = normalizedItems.filter((item) => !isCashInvestment(item));
  const cashItem = normalizedItems.find(isCashInvestment);
  const operationalPlanned = operationalItems.reduce((sum, item) => sum + item.planned, 0);
  const planned = operationalPlanned + (cashItem?.planned ?? 0);
  const spent = operationalItems.reduce((sum, item) => sum + item.spent, 0);
  const remaining = operationalItems.reduce(
    (sum, item) => sum + Math.max(item.planned - item.spent, 0),
    0,
  );
  const available = cashItem?.planned ?? 0;

  return {
    contribution,
    planned,
    operationalPlanned,
    cash: available,
    spent,
    remaining,
    available,
    overPlan: Math.max(operationalPlanned - contribution, 0),
    usagePct: Math.min(100, Math.round((spent / Math.max(contribution, 1)) * 100)),
  };
}

export function summarizeInvestmentsByCategory(
  items: Array<Partial<InvestmentItem>>,
  contribution = defaultInvestmentContribution,
) {
  const categories = new Map<
    string,
    { category: string; planned: number; spent: number; remaining: number }
  >();

  for (const item of syncInvestmentCashItem(items, contribution)) {
    const current = categories.get(item.category) ?? {
      category: item.category,
      planned: 0,
      spent: 0,
      remaining: 0,
    };
    current.planned += item.planned;
    current.spent += item.spent;
    current.remaining += Math.max(item.planned - item.spent, 0);
    categories.set(item.category, current);
  }

  return [...categories.values()].sort((a, b) => b.planned - a.planned);
}
