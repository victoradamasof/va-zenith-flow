function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function toLocalISODate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayLocalISODate() {
  return toLocalISODate(new Date());
}

export function parseLocalDate(value: string | Date) {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12);
  }

  const clean = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [year, month, day] = clean.split("-").map(Number);
    return new Date(year, month - 1, day, 12);
  }

  const parsed = new Date(clean);
  if (Number.isNaN(parsed.getTime())) return new Date(NaN);
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12);
}

export function formatLocalDateBR(value: string | Date, options?: Intl.DateTimeFormatOptions) {
  const date = parseLocalDate(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("pt-BR", options);
}

export function addLocalDays(date: Date, days: number) {
  const nextDate = parseLocalDate(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

export function addLocalMonths(date: Date, months: number) {
  const nextDate = parseLocalDate(date);
  nextDate.setMonth(nextDate.getMonth() + months);
  return nextDate;
}
