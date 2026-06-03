export const bankTransactionsKey = "va-manager:bank-transactions";
export const bankConnectionKey = "va-manager:bank-connection";

export type BankTransactionType = "entrada" | "saida";
export type BankTransactionStatus = "realizado" | "agendado" | "cancelado";
export type BankTransactionMethod =
  | "pix"
  | "transferencia"
  | "pagamento"
  | "boleto"
  | "cartao"
  | "tarifa"
  | "outro";

export type BankConnection = {
  provider: "C6 Bank";
  accountName: string;
  document: string;
  agency: string;
  account: string;
  status: "nao_configurado" | "sandbox" | "aguardando_credenciais" | "conectado" | "erro";
  mode: "manual" | "api";
  lastSyncAt?: string;
  consentExpiresAt?: string;
};

export type BankTransaction = {
  id: string;
  date: string;
  description: string;
  type: BankTransactionType;
  method: BankTransactionMethod;
  category: string;
  amount: number;
  status: BankTransactionStatus;
  counterparty?: string;
  document?: string;
  externalId?: string;
  notes?: string;
  source: "manual" | "api" | "open-finance" | "csv";
  reconciledWith?: {
    type: "sale" | "expense" | "receivable" | "investment";
    id: string;
    label: string;
  };
};

export const defaultBankConnection: BankConnection = {
  provider: "C6 Bank",
  accountName: "Conta PJ VA Consultoria",
  document: "",
  agency: "",
  account: "",
  status: "aguardando_credenciais",
  mode: "manual",
};

export const initialBankTransactions: BankTransaction[] = [];

export const bankStatusLabels: Record<BankConnection["status"], string> = {
  nao_configurado: "Nao configurado",
  sandbox: "Sandbox",
  aguardando_credenciais: "Aguardando credenciais",
  conectado: "Conectado",
  erro: "Erro de conexao",
};

export const bankMethodLabels: Record<BankTransactionMethod, string> = {
  pix: "Pix",
  transferencia: "Transferencia",
  pagamento: "Pagamento",
  boleto: "Boleto",
  cartao: "Cartao",
  tarifa: "Tarifa",
  outro: "Outro",
};

export const bankTransactionCategories = [
  "Receita de vendas",
  "Pix recebido",
  "Transferencia recebida",
  "Marketing",
  "Ferramentas",
  "Aluguel",
  "Energia elétrica",
  "Água",
  "Comissoes",
  "Impostos",
  "Contabilidade",
  "Bancário",
  "Operacional",
  "Investimentos",
  "Internet",
  "Salários",
  "Alimentação",
  "Transporte",
  "Equipamentos",
  "Tarifas bancarias",
  "Outros",
];

export function isBankTransactionRealized(transaction: BankTransaction) {
  return transaction.status === "realizado";
}

export function isBankInflow(transaction: BankTransaction) {
  return transaction.type === "entrada";
}

export function isBankOutflow(transaction: BankTransaction) {
  return transaction.type === "saida";
}

export function calculateBankInflows(transactions: BankTransaction[]) {
  return transactions
    .filter((transaction) => isBankTransactionRealized(transaction) && isBankInflow(transaction))
    .reduce((sum, transaction) => sum + transaction.amount, 0);
}

export function calculateBankOutflows(transactions: BankTransaction[]) {
  return transactions
    .filter((transaction) => isBankTransactionRealized(transaction) && isBankOutflow(transaction))
    .reduce((sum, transaction) => sum + transaction.amount, 0);
}

export function calculateScheduledBankInflows(transactions: BankTransaction[]) {
  return transactions
    .filter((transaction) => transaction.status === "agendado" && isBankInflow(transaction))
    .reduce((sum, transaction) => sum + transaction.amount, 0);
}

export function calculateScheduledBankOutflows(transactions: BankTransaction[]) {
  return transactions
    .filter((transaction) => transaction.status === "agendado" && isBankOutflow(transaction))
    .reduce((sum, transaction) => sum + transaction.amount, 0);
}

export function calculateBankCashImpact(transactions: BankTransaction[]) {
  return calculateBankInflows(transactions) - calculateBankOutflows(transactions);
}

export function parseBankDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
}
