import { calculateBankCashImpact, type BankTransaction } from "@/lib/bank-data";

export const cashBalanceKey = "va-manager:cash-balance";
export const defaultCashBalance = 0;

type CashSale = {
  id: string;
  status: string;
  value: number;
};

type CashExpense = {
  status: string;
  value: number;
};

type CashReceivable = {
  sourceId?: string;
  status: string;
  amount: number;
};

export function calculateReceivedRevenue(sales: CashSale[], receivables: CashReceivable[] = []) {
  const saleIdsWithReceivables = new Set(
    receivables.map((receivable) => receivable.sourceId).filter(Boolean),
  );
  const receivedReceivables = receivables
    .filter((receivable) => receivable.status === "recebido")
    .reduce((sum, receivable) => sum + receivable.amount, 0);
  const paidSales = sales
    .filter((sale) => sale.status === "pago" && !saleIdsWithReceivables.has(sale.id))
    .reduce((sum, sale) => sum + sale.value, 0);

  return receivedReceivables + paidSales;
}

export function calculatePaidExpenses(expenses: CashExpense[]) {
  return expenses
    .filter((expense) => expense.status === "pago")
    .reduce((sum, expense) => sum + expense.value, 0);
}

export function calculateCurrentCash(
  baseCash: number,
  sales: CashSale[],
  expenses: CashExpense[],
  receivables: CashReceivable[] = [],
  bankTransactions: BankTransaction[] = [],
) {
  return (
    baseCash +
    calculateReceivedRevenue(sales, receivables) -
    calculatePaidExpenses(expenses) +
    calculateBankCashImpact(bankTransactions)
  );
}
