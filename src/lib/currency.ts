export function roundCurrency(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function parseCurrencyInput(value: unknown) {
  if (typeof value === "number") return roundCurrency(value);
  if (typeof value !== "string") return 0;

  const normalized = value.trim().replace(/[^\d,.-]/g, "");
  if (!normalized) return 0;

  const isNegative = normalized.startsWith("-");
  const clean = normalized.replace(/-/g, "");
  const lastComma = clean.lastIndexOf(",");
  const lastDot = clean.lastIndexOf(".");
  const separatorIndex = Math.max(lastComma, lastDot);

  let integerPart = clean;
  let decimalPart = "";

  if (separatorIndex >= 0) {
    const separator = clean[separatorIndex];
    const beforeSeparator = clean.slice(0, separatorIndex);
    const afterSeparator = clean.slice(separatorIndex + 1);
    const hasCommaAndDot = lastComma >= 0 && lastDot >= 0;
    const isDecimalSeparator =
      hasCommaAndDot || separator === "," || afterSeparator.length <= 2;

    if (isDecimalSeparator) {
      integerPart = beforeSeparator.replace(/[.,]/g, "");
      decimalPart = afterSeparator.replace(/[.,]/g, "").slice(0, 2);
    } else {
      integerPart = clean.replace(/[.,]/g, "");
    }
  }

  const parsed = Number(
    `${isNegative ? "-" : ""}${integerPart || "0"}${decimalPart ? `.${decimalPart}` : ""}`,
  );

  return roundCurrency(Number.isFinite(parsed) ? parsed : 0);
}

export function formatCurrencyInput(value: unknown) {
  return parseCurrencyInput(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatBRLCurrency(value: unknown) {
  return parseCurrencyInput(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
