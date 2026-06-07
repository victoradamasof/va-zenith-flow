import { useEffect } from "react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/mock-data";
import {
  getNotificationPermission,
  requestAppNotificationPermission,
  showAppNotification,
} from "@/lib/app-notifications";

type StoredSale = {
  id?: string;
  client?: string;
  service?: string;
  seller?: string;
  value?: number;
};

type StoredSignedContract = {
  id?: string;
  clientName?: string;
  service?: string;
  seller?: string;
  clientEvidence?: { signedAt?: string };
};

const seenSalesKey = "va-local:seen-sale-notifications";
const seenClientSignaturesKey = "va-local:seen-client-signature-notifications";

function readJsonArray<T>(key: string): T[] {
  try {
    const stored = window.localStorage.getItem(key);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStringArray(key: string, values: string[]) {
  window.localStorage.setItem(key, JSON.stringify(Array.from(new Set(values)).slice(0, 500)));
}

function readStringSet(key: string) {
  return new Set(readJsonArray<string>(key));
}

function getRecordId(record: { id?: string }, fallback: string) {
  return String(record.id || fallback).trim();
}

export function AppNotificationListener() {
  useEffect(() => {
    if (window.location.pathname === "/login" || window.location.pathname.startsWith("/sign/")) {
      return;
    }

    let booted = false;
    let permissionToastShown = false;

    const offerPermission = () => {
      if (permissionToastShown || getNotificationPermission() !== "default") return;
      permissionToastShown = true;

      toast.info("Ative notificações da VA Consultoria", {
        description: "Você será avisado sobre novas vendas e contratos assinados por clientes.",
        duration: 12000,
        action: {
          label: "Ativar",
          onClick: async () => {
            const permission = await requestAppNotificationPermission();
            if (permission === "granted") {
              toast.success("Notificações ativadas.");
            } else if (permission === "denied") {
              toast.error("Notificações bloqueadas pelo navegador.");
            } else if (permission === "unsupported") {
              toast.info("Este navegador não suporta notificações web.");
            }
          },
        },
      });
    };

    const checkSales = async () => {
      const sales = readJsonArray<StoredSale>("va-manager:sales").filter((sale) => sale.id);
      const saleIds = sales.map((sale, index) => getRecordId(sale, `sale-${index}`));
      const hasSeenState = window.localStorage.getItem(seenSalesKey) !== null;

      if (!hasSeenState) {
        writeStringArray(seenSalesKey, saleIds);
        return;
      }

      const seen = readStringSet(seenSalesKey);
      const newSales = sales.filter((sale, index) => !seen.has(getRecordId(sale, `sale-${index}`)));

      for (const sale of newSales.slice(0, 4)) {
        const title = "Nova venda registrada";
        const body = `${sale.client || "Cliente"} - ${sale.service || "Serviço"} (${formatBRL(sale.value || 0)})`;
        toast.success(title, { description: body });
        await showAppNotification({
          title,
          body: `${body}${sale.seller ? ` por ${sale.seller}` : ""}`,
          tag: `sale-${sale.id}`,
          url: "/sales",
        });
      }

      if (newSales.length > 4) {
        toast.info(`${newSales.length} novas vendas sincronizadas.`);
      }

      writeStringArray(seenSalesKey, saleIds);
    };

    const checkClientSignatures = async () => {
      const contracts = readJsonArray<StoredSignedContract>("va-manager:signed-contracts");
      const signatureIds = contracts
        .filter((contract) => contract.id && contract.clientEvidence?.signedAt)
        .map((contract) => `${contract.id}:${contract.clientEvidence?.signedAt}`);
      const hasSeenState = window.localStorage.getItem(seenClientSignaturesKey) !== null;

      if (!hasSeenState) {
        writeStringArray(seenClientSignaturesKey, signatureIds);
        return;
      }

      const seen = readStringSet(seenClientSignaturesKey);
      const newSignatures = contracts.filter((contract) => {
        if (!contract.id || !contract.clientEvidence?.signedAt) return false;
        return !seen.has(`${contract.id}:${contract.clientEvidence.signedAt}`);
      });

      for (const contract of newSignatures.slice(0, 4)) {
        const title = "Contrato assinado pelo cliente";
        const body = `${contract.clientName || "Cliente"} assinou ${contract.service || "o contrato"}.`;
        toast.success(title, { description: body });
        await showAppNotification({
          title,
          body: `${body}${contract.seller ? ` Responsável: ${contract.seller}.` : ""}`,
          tag: `contract-client-${contract.id}`,
          url: "/contracts",
        });
      }

      if (newSignatures.length > 4) {
        toast.info(`${newSignatures.length} contratos foram assinados por clientes.`);
      }

      writeStringArray(seenClientSignaturesKey, signatureIds);
    };

    const checkAll = () => {
      void checkSales();
      void checkClientSignatures();
      booted = true;
    };

    const handleLocalWrite = (event: Event) => {
      const key = (event as CustomEvent<{ key?: string }>).detail?.key;
      if (!booted || (key !== "va-manager:sales" && key !== "va-manager:signed-contracts")) return;
      checkAll();
    };

    const handleStorage = (event: StorageEvent) => {
      if (!booted || (event.key !== "va-manager:sales" && event.key !== "va-manager:signed-contracts")) {
        return;
      }
      checkAll();
    };

    const timeout = window.setTimeout(checkAll, 1200);
    const permissionTimeout = window.setTimeout(offerPermission, 2600);
    const interval = window.setInterval(checkAll, 15000);
    window.addEventListener("va-manager:local-write", handleLocalWrite);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("va-manager:cloud-data-applied", checkAll);

    return () => {
      window.clearTimeout(timeout);
      window.clearTimeout(permissionTimeout);
      window.clearInterval(interval);
      window.removeEventListener("va-manager:local-write", handleLocalWrite);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("va-manager:cloud-data-applied", checkAll);
    };
  }, []);

  return null;
}
