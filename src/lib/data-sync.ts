import type { Receivable } from "@/lib/receivables";

type RecordWithId = {
  id: string;
};

export function filterValidReceivables({
  receivables,
  sales,
}: {
  receivables: Receivable[];
  sales: RecordWithId[];
}) {
  const saleIds = new Set(sales.map((sale) => sale.id));

  return receivables.filter((receivable) => {
    if (receivable.sourceType === "sale") return saleIds.has(receivable.sourceId);
    if (receivable.sourceType === "client") return false;
    return saleIds.has(receivable.sourceId);
  });
}

export function filterSaleReceivables(receivables: Receivable[], sales: RecordWithId[]) {
  const saleIds = new Set(sales.map((sale) => sale.id));

  return receivables.filter((receivable) => {
    if (receivable.sourceType === "client") return false;
    return saleIds.has(receivable.sourceId);
  });
}

export function hasSameReceivables(current: Receivable[], next: Receivable[]) {
  return (
    current.length === next.length && current.every((item, index) => item.id === next[index].id)
  );
}
