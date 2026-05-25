import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Target } from "lucide-react";
import { goals, formatBRL } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/goals")({
  component: Goals,
  head: () => ({ meta: [{ title: "Metas — VA" }] }),
});

function fmt(g: typeof goals[number], v: number) {
  if (g.type === "currency") return formatBRL(v);
  if (g.type === "percent") return `${v}%`;
  return String(v);
}

function Goals() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Metas e Indicadores"
        subtitle="Acompanhamento de objetivos estratégicos"
        action={<Button className="gradient-primary text-primary-foreground"><Plus className="mr-2 h-4 w-4" />Nova meta</Button>}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {goals.map((g) => {
          const pct = Math.min(100, Math.round((g.current / g.target) * 100));
          const risk = pct < 70;
          return (
            <Card key={g.id} className="group border-border/60 bg-card/60 p-5 transition hover:border-primary/30">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary"><Target className="h-4 w-4" /></div>
                  <div>
                    <p className="text-sm font-medium">{g.name}</p>
                    <p className="text-xs text-muted-foreground">Prazo: {g.deadline}</p>
                  </div>
                </div>
                <Badge className={risk ? "bg-warning/15 text-warning hover:bg-warning/15" : "bg-success/15 text-success hover:bg-success/15"}>
                  {risk ? "Atenção" : "No ritmo"}
                </Badge>
              </div>
              <div className="mt-4">
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-2xl font-semibold">{pct}%</span>
                  <span className="text-xs text-muted-foreground">{fmt(g, g.current)} / {fmt(g, g.target)}</span>
                </div>
                <Progress value={pct} className="mt-2 h-2" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/60 pt-4 text-xs">
                <div>
                  <p className="text-muted-foreground">Falta</p>
                  <p className="font-medium">{fmt(g, g.target - g.current)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Ritmo necessário</p>
                  <p className="font-medium">{fmt(g, Math.round((g.target - g.current) / 7))} / dia</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
