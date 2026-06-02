import { createFileRoute } from "@tanstack/react-router";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { DatePickerField } from "@/components/date-picker-field";
import { OptionSelectField } from "@/components/option-select-field";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { PremiumActionButton } from "@/components/ui/premium-action-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Target, Pencil, Trash2, RotateCcw } from "lucide-react";
import {
  clients as initialClients,
  expenses as initialExpenses,
  goals as initialGoals,
  formatBRL,
  sales as initialSales,
} from "@/lib/mock-data";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { applyGoalMetrics } from "@/lib/goal-metrics";
import { daysUntil, formatGoalDeadline, getToday, parseGoalDeadline } from "@/lib/smart-calendar";

export const Route = createFileRoute("/_app/goals")({
  component: Goals,
  head: () => ({ meta: [{ title: "Metas - VA" }] }),
});

type Goal = (typeof initialGoals)[number];

const emptyForm = {
  id: "",
  name: "",
  target: "0",
  current: "0",
  type: "currency",
  deadline: "31/05",
};

const goalTypeOptions = ["currency", "number", "percent"];
const goalTypeLabels: Record<string, string> = {
  currency: "Valor em R$",
  number: "Número",
  percent: "Percentual",
};

function fmt(g: Pick<Goal, "type">, v: number) {
  if (g.type === "currency") return formatBRL(v);
  if (g.type === "percent") return `${v}%`;
  return String(v);
}

function Goals() {
  const [goals, setGoals] = usePersistentState<Goal[]>("va-manager:goals", initialGoals);
  const [sales] = usePersistentState("va-manager:sales", initialSales);
  const [expenses] = usePersistentState("va-manager:expenses", initialExpenses);
  const [clients] = usePersistentState("va-manager:clients", initialClients);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const today = useMemo(() => getToday(), []);
  const syncedGoals = useMemo(
    () => applyGoalMetrics(goals, { sales, expenses, clients }),
    [clients, expenses, goals, sales],
  );

  const updateForm = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const openCreate = () => {
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (goal: Goal) => {
    setForm({
      id: goal.id,
      name: goal.name,
      target: String(goal.target),
      current: String(goal.current),
      type: goal.type,
      deadline: formatGoalDeadline(goal.deadline, today),
    });
    setOpen(true);
  };

  const submitGoal = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const goal: Goal = {
      id: form.id || `g-${Date.now()}`,
      name: form.name.trim(),
      target: Number(form.target) || 0,
      current: Number(form.current) || 0,
      type: form.type as Goal["type"],
      deadline: formatGoalDeadline(form.deadline.trim() || "31/05", today),
    };
    if (!goal.name || goal.target <= 0) return;

    setGoals((current) =>
      form.id ? current.map((item) => (item.id === form.id ? goal : item)) : [goal, ...current],
    );
    toast.success(form.id ? "Meta atualizada." : "Meta criada.");
    setOpen(false);
    setForm(emptyForm);
  };

  const removeGoal = (id: string) => {
    setGoals((current) => current.filter((goal) => goal.id !== id));
    toast.success("Meta excluída.");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Metas e Indicadores"
        subtitle="Acompanhamento de objetivos estratégicos com ritmo diário e risco"
        action={
          <>
            <Button variant="outline" size="sm" onClick={() => setGoals(initialGoals)}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Restaurar
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <PremiumActionButton
                  icon={<Plus />}
                  title="Nova meta"
                  subtitle="Definir objetivo"
                  size="sm"
                  onClick={openCreate}
                />
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <form onSubmit={submitGoal}>
                  <DialogHeader>
                    <DialogTitle>{form.id ? "Editar meta" : "Nova meta"}</DialogTitle>
                    <DialogDescription>
                      Metas salvas atualizam automaticamente barras, falta e ritmo necessário.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <GoalField
                      label="Nome"
                      value={form.name}
                      onChange={(v) => updateForm("name", v)}
                      required
                    />
                    <OptionSelectField
                      label="Tipo"
                      value={form.type}
                      onChange={(v) => updateForm("type", v)}
                      options={goalTypeOptions}
                      labels={goalTypeLabels}
                    />
                    <GoalField
                      label="Meta"
                      type="number"
                      value={form.target}
                      onChange={(v) => updateForm("target", v)}
                    />
                    <GoalField
                      label="Atual"
                      type="number"
                      value={form.current}
                      onChange={(v) => updateForm("current", v)}
                    />
                    <DatePickerField
                      label="Prazo"
                      value={form.deadline}
                      onChange={(v) => updateForm("deadline", v)}
                      outputFormat="br"
                    />
                  </div>
                  <DialogFooter className="mt-6">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" className="gradient-primary text-primary-foreground">
                      Salvar meta
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {syncedGoals.map((g) => {
          const pct = Math.min(100, Math.round((g.current / g.target) * 100));
          const deadline = parseGoalDeadline(g.deadline, today);
          const remainingDays = Math.max(daysUntil(deadline, today), 0);
          const missing = Math.max(0, g.target - g.current);
          const dailyTarget = remainingDays > 0 ? Math.ceil(missing / remainingDays) : missing;
          const risk = pct < 70;
          return (
            <Card
              key={g.id}
              className="group border-border/60 bg-card/60 p-5 transition hover:border-primary/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Target className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{g.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Prazo: {formatGoalDeadline(g.deadline, today)}
                    </p>
                  </div>
                </div>
                <Badge
                  className={
                    risk
                      ? "bg-warning/15 text-warning hover:bg-warning/15"
                      : "bg-success/15 text-success hover:bg-success/15"
                  }
                >
                  {risk ? "Atenção" : "No ritmo"}
                </Badge>
              </div>
              <div className="mt-4">
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-2xl font-semibold">{pct}%</span>
                  <span className="text-xs text-muted-foreground">
                    {fmt(g, g.current)} / {fmt(g, g.target)}
                  </span>
                </div>
                <Progress value={pct} className="mt-2 h-2" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/60 pt-4 text-xs">
                <div>
                  <p className="text-muted-foreground">Falta</p>
                  <p className="font-medium">{fmt(g, missing)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Ritmo necessário</p>
                  <p className="font-medium">{fmt(g, dailyTarget)} / dia</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {remainingDays > 0 ? `${remainingDays} dias restantes` : "prazo encerrado"}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(g)}>
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Editar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => removeGoal(g.id)}>
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Excluir
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function GoalField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
