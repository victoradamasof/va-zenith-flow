import type {
  BankTransactionMethod,
  BankTransactionType,
} from "@/lib/bank-data";

export type TransactionClassification = {
  category: string;
  type: BankTransactionType;
  method: BankTransactionMethod;
  confidence: number;
  reason: string;
};

type ClassificationRule = {
  category: string;
  keywords: string[];
  type?: BankTransactionType;
  method?: BankTransactionMethod;
  confidence?: number;
};

const rules: ClassificationRule[] = [
  {
    category: "Aluguel",
    keywords: ["aluguel", "locacao", "locação", "imobiliaria", "imobiliária", "sala comercial", "escritorio", "escritório"],
    type: "saida",
    method: "pagamento",
    confidence: 0.94,
  },
  {
    category: "Energia elétrica",
    keywords: ["energia", "luz", "neoenergia", "ceb", "enel", "equatorial", "cemig", "cpfl", "edp"],
    type: "saida",
    method: "pagamento",
    confidence: 0.95,
  },
  {
    category: "Água",
    keywords: ["agua", "água", "caesb", "sabesp", "saneago", "copasa", "saneamento", "cedae"],
    type: "saida",
    method: "pagamento",
    confidence: 0.95,
  },
  {
    category: "Internet",
    keywords: ["internet", "claro", "vivo", "tim", "oi", "net", "fibra", "telefonia", "telefone", "whatsapp"],
    type: "saida",
    method: "pagamento",
    confidence: 0.9,
  },
  {
    category: "Marketing",
    keywords: ["trafego", "tráfego", "google ads", "facebook ads", "meta ads", "instagram", "tiktok", "anuncio", "anúncio", "campanha", "midia paga", "mídia paga"],
    type: "saida",
    method: "pagamento",
    confidence: 0.9,
  },
  {
    category: "Ferramentas",
    keywords: ["software", "sistema", "assinatura", "notion", "clickup", "canva", "google workspace", "dominio", "domínio", "hostinger", "cloudflare", "openai", "chatgpt"],
    type: "saida",
    method: "cartao",
    confidence: 0.86,
  },
  {
    category: "Comissões",
    keywords: ["comissao", "comissão", "bonus vendedor", "bônus vendedor", "premiacao", "premiação"],
    type: "saida",
    method: "pix",
    confidence: 0.9,
  },
  {
    category: "Salários",
    keywords: ["salario", "salário", "folha", "pro labore", "pró-labore", "colaborador", "ajuda de custo"],
    type: "saida",
    method: "transferencia",
    confidence: 0.88,
  },
  {
    category: "Impostos",
    keywords: ["imposto", "das", "simples nacional", "gps", "inss", "fgts", "darf", "sefaz", "receita federal"],
    type: "saida",
    method: "boleto",
    confidence: 0.92,
  },
  {
    category: "Contabilidade",
    keywords: ["contador", "contabilidade", "contabil", "contábil", "honorario contabil", "honorário contábil"],
    type: "saida",
    method: "pagamento",
    confidence: 0.9,
  },
  {
    category: "Bancário",
    keywords: ["tarifa", "cesta", "iof", "juros", "multa", "encargo", "banco", "c6 bank"],
    type: "saida",
    method: "tarifa",
    confidence: 0.82,
  },
  {
    category: "Equipamentos",
    keywords: ["notebook", "macbook", "computador", "monitor", "celular", "cadeira", "mesa", "impressora", "equipamento"],
    type: "saida",
    method: "cartao",
    confidence: 0.86,
  },
  {
    category: "Alimentação",
    keywords: ["mercado", "restaurante", "ifood", "lanche", "almoco", "almoço", "jantar", "alimentacao", "alimentação"],
    type: "saida",
    method: "cartao",
    confidence: 0.82,
  },
  {
    category: "Transporte",
    keywords: ["uber", "99", "posto", "combustivel", "combustível", "gasolina", "estacionamento", "transporte"],
    type: "saida",
    method: "cartao",
    confidence: 0.84,
  },
  {
    category: "Receita de vendas",
    keywords: ["venda", "limpa nome", "rating", "score", "consultoria", "cliente", "recebimento", "entrada cliente", "honorarios", "honorários"],
    type: "entrada",
    method: "pix",
    confidence: 0.78,
  },
  {
    category: "Pix recebido",
    keywords: ["pix recebido", "credito pix", "crédito pix", "recebido pix", "ted recebida", "transferencia recebida", "transferência recebida"],
    type: "entrada",
    method: "pix",
    confidence: 0.86,
  },
];

export function classifyTransactionText({
  description,
  counterparty,
  amount,
  fallbackType = "saida",
  fallbackMethod = "pix",
  fallbackCategory = "Operacional",
}: {
  description?: string;
  counterparty?: string;
  amount?: number;
  fallbackType?: BankTransactionType;
  fallbackMethod?: BankTransactionMethod;
  fallbackCategory?: string;
}): TransactionClassification {
  const text = normalizeText([description, counterparty].filter(Boolean).join(" "));
  const typeFromAmount: BankTransactionType | undefined =
    amount === undefined ? undefined : amount >= 0 ? "entrada" : "saida";

  for (const rule of rules) {
    const keyword = rule.keywords.find((item) => text.includes(normalizeText(item)));
    if (!keyword) continue;

    return {
      category: rule.category,
      type: rule.type ?? typeFromAmount ?? fallbackType,
      method: inferMethod(text, rule.method ?? fallbackMethod),
      confidence: rule.confidence ?? 0.8,
      reason: `Identificado por "${keyword}".`,
    };
  }

  return {
    category: fallbackCategory,
    type: typeFromAmount ?? fallbackType,
    method: inferMethod(text, fallbackMethod),
    confidence: 0.35,
    reason: "Sem palavra-chave forte. Classificação padrão aplicada.",
  };
}

export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function inferMethod(text: string, fallback: BankTransactionMethod): BankTransactionMethod {
  if (text.includes("pix")) return "pix";
  if (text.includes("boleto") || text.includes("das") || text.includes("darf")) return "boleto";
  if (text.includes("cartao") || text.includes("credito") || text.includes("debito")) {
    return "cartao";
  }
  if (text.includes("ted") || text.includes("doc") || text.includes("transferencia")) {
    return "transferencia";
  }
  if (text.includes("tarifa") || text.includes("iof") || text.includes("juros")) return "tarifa";
  return fallback;
}
