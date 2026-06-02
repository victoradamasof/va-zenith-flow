import { useEffect, useMemo } from "react";
import { filterValidReceivables, hasSameReceivables } from "@/lib/data-sync";
import type { Receivable } from "@/lib/receivables";
import { usePersistentState } from "@/hooks/use-persistent-state";

type RecordWithId = {
  id: string;
};

export function useSyncedReceivables({ sales }: { sales: RecordWithId[] }) {
  const [storedReceivables, setReceivables, ready] = usePersistentState<Receivable[]>(
    "va-manager:receivables",
    [],
  );

  const receivables = useMemo(
    () => filterValidReceivables({ receivables: storedReceivables, sales }),
    [sales, storedReceivables],
  );

  useEffect(() => {
    if (!ready || hasSameReceivables(storedReceivables, receivables)) return;
    setReceivables(receivables);
  }, [ready, receivables, setReceivables, storedReceivables]);

  return [receivables, setReceivables, ready] as const;
}
