import {
  alerts,
  clients,
  expenseCategories,
  expenses,
  goals,
  sales,
  sellers,
  services,
  users,
} from "@/lib/mock-data";
import {
  defaultInvestmentContribution,
  investmentContributionKey,
  investmentItems,
} from "@/lib/investment-data";
import { cashBalanceKey, defaultCashBalance } from "@/lib/cash-data";

export const dataKeys = [
  "va-manager:sales",
  "va-manager:expenses",
  "va-manager:clients",
  "va-manager:services",
  "va-manager:goals",
  "va-manager:alerts",
  "va-manager:users",
  "va-manager:collaborators",
  "va-manager:receivables",
  "va-manager:expense-categories",
  "va-manager:investments",
  cashBalanceKey,
  investmentContributionKey,
] as const;

export type DataKey = (typeof dataKeys)[number];

export const emptyData: Record<DataKey, unknown> = {
  "va-manager:sales": [],
  "va-manager:expenses": [],
  "va-manager:clients": [],
  "va-manager:services": [],
  "va-manager:goals": [],
  "va-manager:alerts": [],
  "va-manager:users": [],
  "va-manager:collaborators": [],
  "va-manager:receivables": [],
  "va-manager:expense-categories": [],
  "va-manager:investments": [],
  [cashBalanceKey]: defaultCashBalance,
  [investmentContributionKey]: defaultInvestmentContribution,
};

export const demoData: Partial<Record<DataKey, unknown>> = {
  "va-manager:sales": sales,
  "va-manager:expenses": expenses,
  "va-manager:clients": clients,
  "va-manager:services": services,
  "va-manager:goals": goals,
  "va-manager:alerts": alerts,
  "va-manager:users": users,
  "va-manager:collaborators": sellers,
  "va-manager:receivables": [],
  "va-manager:expense-categories": expenseCategories,
  "va-manager:investments": investmentItems,
  [cashBalanceKey]: defaultCashBalance,
  [investmentContributionKey]: defaultInvestmentContribution,
};

export function replaceLocalData(data: Partial<Record<DataKey, unknown>>) {
  for (const key of dataKeys) {
    window.localStorage.setItem(key, JSON.stringify(data[key] ?? demoData[key] ?? emptyData[key]));
  }
}

export function restoreDemoData() {
  for (const key of dataKeys) {
    if (key in demoData) {
      window.localStorage.setItem(key, JSON.stringify(demoData[key]));
    } else {
      window.localStorage.removeItem(key);
    }
  }
}

export function exportLocalData() {
  return dataKeys.reduce(
    (acc, key) => {
      const stored = window.localStorage.getItem(key);
      acc[key] = stored ? JSON.parse(stored) : (demoData[key] ?? []);
      return acc;
    },
    {} as Partial<Record<DataKey, unknown>>,
  );
}

const cloudIgnoredKeys = new Set(["va-manager:auth-session", "va-manager:cloud-updated-at"]);

export type CloudDataSnapshot = Record<string, unknown>;

function shouldSyncKey(key: string) {
  return key.startsWith("va-manager:") && !cloudIgnoredKeys.has(key);
}

export function exportAllLocalData(): CloudDataSnapshot {
  const snapshot: CloudDataSnapshot = {};

  for (const key of dataKeys) {
    const stored = window.localStorage.getItem(key);
    snapshot[key] = stored ? JSON.parse(stored) : (demoData[key] ?? emptyData[key]);
  }

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || !shouldSyncKey(key) || key in snapshot) continue;

    const stored = window.localStorage.getItem(key);
    if (!stored) continue;

    try {
      snapshot[key] = JSON.parse(stored);
    } catch {
      snapshot[key] = stored;
    }
  }

  return snapshot;
}

export function replaceAllLocalData(data: CloudDataSnapshot) {
  const keysToRemove: string[] = [];

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key && shouldSyncKey(key)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => window.localStorage.removeItem(key));

  for (const [key, value] of Object.entries(data)) {
    if (!shouldSyncKey(key)) continue;
    window.localStorage.setItem(key, JSON.stringify(value));
  }
}
