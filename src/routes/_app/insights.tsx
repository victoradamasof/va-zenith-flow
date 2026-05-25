import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Sparkles, TrendingUp, AlertTriangle, Target, Star, Users, Wallet, TrendingDown } from "lucide-react";
import { insights } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/insights")({
  component: Insights,
  head: () => ({ meta: [{ title: "Insights — VA" }] }),
});

const iconMap: Record<string, typeof TrendingUp> = {
  "trending-up": TrendingUp, "alert-triangle": AlertTriangle, target: Target,
  star: Star, users: Users, wallet: Wallet, "trending-down": TrendingDown,
};

function Insights() {
  return (
    <div className="space-y-6">
      <PageHeader title="Insights e Recomendações" subtitle="Análises automáticas geradas a partir dos seus dados" />

      <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-card/80 to-primary/5 p-6 shadow-glow">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl gradient-primary text-primary-foreground">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold">Resumo executivo</h3>
            <p className="text-sm text-muted-foreground">Sua operação está saudável. 3 oportunidades identificadas para os próximos 30 dias.</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {insights.map((it, i) => {
          const Icon = iconMap[it.icon] ?? Sparkles;
          return (
            <Card key={i} className="group flex items-start gap-3 border-border/60 bg-card/60 p-4 transition hover:border-primary/30">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-sm leading-relaxed">{it.text}</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
