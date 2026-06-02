import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type DateFormat = "iso" | "br";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toISO(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toBR(date: Date) {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function buildClampedDate(year: number, month: number, day: number) {
  const safeMonth = Math.min(Math.max(month, 1), 12);
  const safeDay = Math.min(Math.max(day, 1), daysInMonth(year, safeMonth));
  return new Date(year, safeMonth - 1, safeDay, 12);
}

function parseDate(value: string) {
  const clean = value.trim();
  if (!clean) return undefined;

  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [year, month, day] = clean.split("-").map(Number);
    const date = buildClampedDate(year, month, day);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  const parts = clean.split("/");
  if (parts.length >= 2) {
    const day = Number(parts[0]);
    const month = Number(parts[1]);
    const year = parts[2] ? Number(parts[2]) : new Date().getFullYear();
    if (day && month && year) {
      const date = buildClampedDate(year, month, day);
      return Number.isNaN(date.getTime()) ? undefined : date;
    }
  }

  return undefined;
}

function formatDate(date: Date, outputFormat: DateFormat) {
  return outputFormat === "iso" ? toISO(date) : toBR(date);
}

export function DatePickerField({
  label,
  value,
  onChange,
  required = false,
  outputFormat = "iso",
  placeholder = "dd/mm/aaaa",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  outputFormat?: DateFormat;
  placeholder?: string;
}) {
  const selected = parseDate(value);

  const commitTypedDate = () => {
    const date = parseDate(value);
    if (date) onChange(formatDate(date, outputFormat));
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={value}
          required={required}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onBlur={commitTypedDate}
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="icon" aria-label={`Selecionar ${label}`}>
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto p-0">
            <Calendar
              mode="single"
              selected={selected}
              onSelect={(date) => {
                if (date) onChange(formatDate(date, outputFormat));
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
