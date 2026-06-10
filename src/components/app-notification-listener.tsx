import { useEffect } from "react";
import { toast } from "sonner";
import {
  bankConnectionKey,
  bankMethodLabels,
  bankTransactionsKey,
  type BankConnection,
  type BankTransaction,
} from "@/lib/bank-data";
import { formatBRL } from "@/lib/mock-data";
import {
  getNotificationPermission,
  requestAppNotificationPermission,
  showAppNotification,
  subscribeDeviceToPush,
} from "@/lib/app-notifications";

type StoredSale = {
  id?: string;
  client?: string;
  service?: string;
  seller?: string;
  value?: number;
};

type StoredNotificationEvent = {
  id?: string;
  type?: "sale" | "contract" | "bank" | "system";
  title?: string;
  body?: string;
  url?: string;
  createdAt?: string;
  expiresAt?: string;
};

type StoredSignatureEvidence = {
  signedAt?: string;
  name?: string;
};

type StoredSignedContract = {
  id?: string;
  clientName?: string;
  service?: string;
  seller?: string;
  clientEvidence?: StoredSignatureEvidence;
  sellerEvidence?: StoredSignatureEvidence;
};

const seenSalesKey = "va-local:seen-sale-notifications";
const seenClientSignaturesKey = "va-local:seen-client-signature-notifications";
const seenSellerSignaturesKey = "va-local:seen-seller-signature-notifications";
const seenCompletedContractsKey = "va-local:seen-completed-contract-notifications";
const seenBankTransactionsKey = "va-local:seen-bank-transaction-notifications";
const seenBankSyncKey = "va-local:seen-bank-sync-notifications";
const notificationEventsKey = "va-manager:notification-events";
const seenNotificationEventsKey = "va-local:seen-notification-events";

function readJsonArray<T>(key: string): T[] {
  try {
    const stored = window.localStorage.getItem(key);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readJsonObject<T>(key: string): T | null {
  try {
    const stored = window.localStorage.getItem(key);
    const parsed = stored ? JSON.parse(stored) : null;
    return parsed && typeof parsed === "object" ? (parsed as T) : null;
  } catch {
    return null;
  }
}

function writeStringArray(key: string, values: string[]) {
  window.localStorage.setItem(key, JSON.stringify(Array.from(new Set(values)).slice(0, 800)));
}

function readStringSet(key: string) {
  return new Set(readJsonArray<string>(key));
}

function getRecordId(record: { id?: string }, fallback: string) {
  return String(record.id || fallback).trim();
}

function getContractLabel(contract: StoredSignedContract) {
  return `${contract.clientName || "Cliente"} - ${contract.service || "contrato"}`;
}

function getClientSignatureId(contract: StoredSignedContract) {
  if (!contract.id || !contract.clientEvidence?.signedAt) return "";
  return `${contract.id}:client:${contract.clientEvidence.signedAt}`;
}

function getSellerSignatureId(contract: StoredSignedContract) {
  if (!contract.id || !contract.sellerEvidence?.signedAt) return "";
  return `${contract.id}:seller:${contract.sellerEvidence.signedAt}`;
}

function getCompletedContractId(contract: StoredSignedContract) {
  if (!contract.id || !contract.clientEvidence?.signedAt || !contract.sellerEvidence?.signedAt) {
    return "";
  }
  return `${contract.id}:completed:${contract.clientEvidence.signedAt}:${contract.sellerEvidence.signedAt}`;
}

function getBankTransactionNotificationId(transaction: BankTransaction, fallback: string) {
  return [
    getRecordId(transaction, fallback),
    transaction.status,
    transaction.type,
    transaction.amount,
    transaction.date,
    transaction.externalId || "",
  ].join(":");
}

function describeBankTransaction(transaction: BankTransaction) {
  const direction = transaction.type === "entrada" ? "Entrada" : "Saída";
  const method = bankMethodLabels[transaction.method] || "Movimentação";
  const status =
    transaction.status === "realizado"
      ? "realizada"
      : transaction.status === "agendado"
        ? "agendada"
        : "cancelada";

  return `${direction} ${status}: ${transaction.description || method} (${formatBRL(transaction.amount)}).`;
}

export function AppNotificationListener() {
  useEffect(() => {
    if (window.location.pathname === "/login" || window.location.pathname.startsWith("/sign/")) {
      return;
    }

    let booted = false;
    let permissionToastShown = false;
    let checking = false;

    const offerPermission = () => {
      if (permissionToastShown || getNotificationPermission() !== "default") return;
      permissionToastShown = true;

      toast.info("Ative notificações da VA Consultoria", {
        description:
          "Você será avisado sobre vendas, assinaturas de contrato e movimentações do C6.",
        duration: 12000,
        action: {
          label: "Ativar",
          onClick: async () => {
            const permission = await requestAppNotificationPermission();
            if (permission === "granted") {
              const subscription = await subscribeDeviceToPush();
              toast.success(
                subscription.ok
                  ? "Notificações ativadas neste aparelho."
                  : "Permissão ativada. Abra o app instalado no celular para concluir o push.",
              );
            } else if (permission === "denied") {
              toast.error("Notificações bloqueadas pelo navegador.");
            } else if (permission === "unsupported") {
              toast.info("Este navegador não suporta notificações web.");
            }
          },
        },
      });
    };

    if (getNotificationPermission() === "granted") {
      void subscribeDeviceToPush().catch((error) => {
        console.warn("Could not register push subscription", error);
      });
    }

    const checkNotificationEvents = async () => {
      const now = Date.now();
      const events = readJsonArray<StoredNotificationEvent>(notificationEventsKey).filter(
        (event) => event.id && (!event.expiresAt || Date.parse(event.expiresAt) > now),
      );
      const eventIds = events.map((event, index) => getRecordId(event, `event-${index}`));
      const seen = readStringSet(seenNotificationEventsKey);
      const newEvents = events.filter((event, index) => {
        const eventId = getRecordId(event, `event-${index}`);
        if (seen.has(eventId)) return false;
        if (!event.createdAt) return true;

        const createdAt = Date.parse(event.createdAt);
        return Number.isNaN(createdAt) || now - createdAt < 30 * 60 * 1000;
      });

      for (const event of newEvents.slice(0, 6)) {
        const title = event.title || "Notificacao VA Consultoria";
        const body = event.body || "Novo evento sincronizado no sistema.";
        const url = event.url || "/dashboard";

        if (event.type === "sale") {
          toast.success(title, { description: body });
        } else if (event.type === "bank") {
          toast.info(title, { description: body });
        } else {
          toast.success(title, { description: body });
        }

        await showAppNotification({
          title,
          body,
          tag: `event-${event.id}`,
          url,
        });
      }

      writeStringArray(seenNotificationEventsKey, eventIds);
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

    const checkContractSignatures = async () => {
      const contracts = readJsonArray<StoredSignedContract>("va-manager:signed-contracts");
      const clientSignatureIds = contracts.map(getClientSignatureId).filter(Boolean);
      const sellerSignatureIds = contracts.map(getSellerSignatureId).filter(Boolean);
      const completedContractIds = contracts.map(getCompletedContractId).filter(Boolean);

      const hasClientSeenState = window.localStorage.getItem(seenClientSignaturesKey) !== null;
      const hasSellerSeenState = window.localStorage.getItem(seenSellerSignaturesKey) !== null;
      const hasCompletedSeenState = window.localStorage.getItem(seenCompletedContractsKey) !== null;

      if (!hasClientSeenState) writeStringArray(seenClientSignaturesKey, clientSignatureIds);
      if (!hasSellerSeenState) writeStringArray(seenSellerSignaturesKey, sellerSignatureIds);
      if (!hasCompletedSeenState) writeStringArray(seenCompletedContractsKey, completedContractIds);
      if (!hasClientSeenState || !hasSellerSeenState || !hasCompletedSeenState) return;

      const seenClients = readStringSet(seenClientSignaturesKey);
      const seenSellers = readStringSet(seenSellerSignaturesKey);
      const seenCompleted = readStringSet(seenCompletedContractsKey);

      const newClientSignatures = contracts.filter((contract) => {
        const id = getClientSignatureId(contract);
        return id && !seenClients.has(id);
      });
      const newSellerSignatures = contracts.filter((contract) => {
        const id = getSellerSignatureId(contract);
        return id && !seenSellers.has(id);
      });
      const newCompletedContracts = contracts.filter((contract) => {
        const id = getCompletedContractId(contract);
        return id && !seenCompleted.has(id);
      });

      for (const contract of newClientSignatures.slice(0, 4)) {
        const title = "Contrato assinado pelo contratante";
        const body = `${getContractLabel(contract)} foi assinado pelo cliente.`;
        toast.success(title, { description: body });
        await showAppNotification({
          title,
          body: `${body}${contract.seller ? ` Responsável: ${contract.seller}.` : ""}`,
          tag: `contract-client-${contract.id}`,
          url: "/contracts",
        });
      }

      for (const contract of newSellerSignatures.slice(0, 4)) {
        const title = "Contrato assinado pelo vendedor";
        const signer = contract.sellerEvidence?.name || contract.seller || "Vendedor";
        const body = `${signer} assinou ${getContractLabel(contract)}.`;
        toast.success(title, { description: body });
        await showAppNotification({
          title,
          body,
          tag: `contract-seller-${contract.id}`,
          url: "/contracts",
        });
      }

      for (const contract of newCompletedContracts.slice(0, 4)) {
        const title = "Contrato finalizado";
        const body = `${getContractLabel(contract)} foi assinado pelas duas partes.`;
        toast.success(title, { description: body });
        await showAppNotification({
          title,
          body,
          tag: `contract-completed-${contract.id}`,
          url: "/contracts",
        });
      }

      if (newClientSignatures.length > 4) {
        toast.info(`${newClientSignatures.length} contratos foram assinados por contratantes.`);
      }
      if (newSellerSignatures.length > 4) {
        toast.info(`${newSellerSignatures.length} contratos foram assinados por vendedores.`);
      }
      if (newCompletedContracts.length > 4) {
        toast.info(`${newCompletedContracts.length} contratos foram finalizados.`);
      }

      writeStringArray(seenClientSignaturesKey, clientSignatureIds);
      writeStringArray(seenSellerSignaturesKey, sellerSignatureIds);
      writeStringArray(seenCompletedContractsKey, completedContractIds);
    };

    const checkBankTransactions = async () => {
      const transactions = readJsonArray<BankTransaction>(bankTransactionsKey).filter(
        (transaction) => transaction.id,
      );
      const transactionIds = transactions.map(getBankTransactionNotificationId);
      const hasSeenState = window.localStorage.getItem(seenBankTransactionsKey) !== null;

      if (!hasSeenState) {
        writeStringArray(seenBankTransactionsKey, transactionIds);
        return;
      }

      const seen = readStringSet(seenBankTransactionsKey);
      const newOrUpdatedTransactions = transactions.filter((transaction, index) => {
        const id = getBankTransactionNotificationId(transaction, `bank-${index}`);
        return !seen.has(id);
      });

      for (const transaction of newOrUpdatedTransactions.slice(0, 5)) {
        const title =
          transaction.source === "api" || transaction.source === "open-finance"
            ? "Movimentação C6 sincronizada"
            : "Movimentação C6 atualizada";
        const body = describeBankTransaction(transaction);
        toast.info(title, { description: body });
        await showAppNotification({
          title,
          body,
          tag: `bank-${transaction.id}-${transaction.status}`,
          url: "/bank",
        });
      }

      if (newOrUpdatedTransactions.length > 5) {
        toast.info(`${newOrUpdatedTransactions.length} movimentações C6 foram sincronizadas.`);
      }

      writeStringArray(seenBankTransactionsKey, transactionIds);
    };

    const checkBankSync = async () => {
      const connection = readJsonObject<BankConnection>(bankConnectionKey);
      const syncId = connection?.lastSyncAt ? `${connection.status}:${connection.lastSyncAt}` : "";
      const hasSeenState = window.localStorage.getItem(seenBankSyncKey) !== null;

      if (!hasSeenState) {
        writeStringArray(seenBankSyncKey, syncId ? [syncId] : []);
        return;
      }
      if (!syncId) return;

      const seen = readStringSet(seenBankSyncKey);
      if (seen.has(syncId)) return;

      const title = "Banco C6 sincronizado";
      const body = `${connection?.accountName || "Conta PJ VA Consultoria"} teve os dados atualizados.`;
      toast.success(title, { description: body });
      await showAppNotification({
        title,
        body,
        tag: `bank-sync-${connection?.lastSyncAt}`,
        url: "/bank",
      });

      writeStringArray(seenBankSyncKey, [syncId]);
    };

    const checkAll = () => {
      if (checking) return;
      checking = true;
      Promise.all([
        checkNotificationEvents(),
        checkSales(),
        checkContractSignatures(),
        checkBankTransactions(),
        checkBankSync(),
      ]).finally(() => {
        booted = true;
        checking = false;
      });
    };

    const watchedKeys = new Set([
      "va-manager:sales",
      "va-manager:signed-contracts",
      notificationEventsKey,
      bankTransactionsKey,
      bankConnectionKey,
    ]);

    const handleLocalWrite = (event: Event) => {
      const key = (event as CustomEvent<{ key?: string }>).detail?.key;
      if (!booted || !key || !watchedKeys.has(key)) return;
      checkAll();
    };

    const handleStorage = (event: StorageEvent) => {
      if (!booted || !event.key || !watchedKeys.has(event.key)) return;
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
