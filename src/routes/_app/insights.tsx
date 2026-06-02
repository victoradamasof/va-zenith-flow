import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Target,
  Star,
  Users,
  Wallet,
  TrendingDown,
  RefreshCw,
} from "lucide-react";
import {
  clients as initialClients,
  expenses as initialExpenses,
  formatBRL,
  sales as initialSales,
} from "@/lib/mock-data";
import { usePersistentState } from "@/hooks/use-persistent-state";

export const Route = createFileRoute("/_app/insights")({
  component: Insights,
  head: () => ({ meta: [{ title: "Insights - VA" }] }),
});

const iconMap = {
  up: TrendingUp,
  alert: AlertTriangle,
  target: Target,
  star: Star,
  users: Users,
  wallet: Wallet,
  down: TrendingDown,
};

type Insight = {
  icon: keyof typeof iconMap;
  text: string;
  action: string;
};

function Insights() {
  const [sales] = usePersistentState("va-manager:sales", initialSales);
  const [expenses] = usePersistentState("va-manager:expenses", initialExpenses);
  const [clients] = usePersistentState("va-manager:clients", initialClients);
  const generatedInsights = useMemo<Insight[]>(() => {
    const revenue = sales.reduce((sum, sale) => sum + sale.value, 0);
    const paidRevenue = sales
      .filter((sale) => sale.status === "pago")
      .reduce((sum, sale) => sum + sale.value, 0);
    const costs = expenses.reduce((sum, expense) => sum + expense.value, 0);
    const profit = paidRevenue - costs;
    const overdue = sales
      .filter((sale) => sale.status === "atrasado")
      .reduce((sum, sale) => sum + sale.value, 0);
    const delinquentClients = clients.filter((client) => client.status === "inadimplente").length;
    const topService = bestBy(sales.map((sale) => sale.service));
    const topOrigin = bestBy(sales.map((sale) => sale.origin));
    const topCost = expenses.reduce(
      (acc, expense) => {
        acc[expense.category] = (acc[expense.category] ?? 0) + expense.value;
        return acc;
      },
      {} as Record<string, number>,
    );
    const topCostCategory = Object.entries(topCost).sort((a, b) => b[1] - a[1])[0];
    const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

    return [
      {
        icon: revenue >= costs ? "up" : "down",
        text: `Seu faturamento registrado é ${formatBRL(revenue)} e a receita recebida é ${formatBRL(paidRevenue)}.`,
        action: revenue >= costs ? "Manter ritmo comercial" : "Revisar aquisição",
      },
      {
        icon: margin >= 30 ? "star" : "alert",
        text: `A margem operacional estimada está em ${margin}%.`,
        action: margin >= 30 ? "Escalar oferta principal" : "Reduzir custos ou elevar ticket",
      },
      {
        icon: "wallet",
        text: topCostCategory
          ? `Seu maior custo atual está em ${topCostCategory[0]} (${formatBRL(topCostCategory[1])}).`
          : "Ainda não há custos cadastrados para análise.",
        action: "Abrir gestão financeira",
      },
      {
        icon: "target",
        text: topService
          ? `O serviço com maior volume é ${topService}, indicando boa tração comercial.`
          : "Cadastre vendas para identificar os serviços mais fortes.",
        action: "Ver vendas",
      },
      {
        icon: "users",
        text: topOrigin
          ? `A origem com mais vendas é ${topOrigin}. Vale reforçar esse canal.`
          : "Ainda faltam origens de lead para análise comercial.",
        action: "Planejar campanha",
      },
      {
        icon: overdue > 0 || delinquentClients > 0 ? "alert" : "up",
        text: `${delinquentClients} clientes inadimplentes e ${formatBRL(overdue)} em vendas atrasadas.`,
        action: overdue > 0 ? "Priorizar cobrança" : "Carteira saudável",
      },
    ];
  }, [clients, expenses, sales]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Insights e Recomendações"
        subtitle="Análises automáticas geradas a partir dos seus dados atuais"
        action={
          <Button
            variant="outline"
            onClick={() => {
              toast.success("Insights recalculados.");
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Recalcular
          </Button>
        }
      />

      <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-card/80 to-primary/5 p-6 shadow-glow">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl gradient-primary text-primary-foreground">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold">Resumo executivo</h3>
            <p className="text-sm text-muted-foreground">
              {generatedInsights.length} recomendações calculadas com vendas, despesas e clientes.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {generatedInsights.map((it, i) => {
          const Icon = iconMap[it.icon] ?? Sparkles;
          return (
            <Card
              key={`${it.text}-${i}`}
              className="group flex items-start gap-3 border-border/60 bg-card/60 p-4 transition hover:border-primary/30"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm leading-relaxed">{it.text}</p>
                <Button
                  variant="link"
                  className="mt-2 h-auto p-0 text-xs text-primary"
                  onClick={() => toast.info(it.action)}
                >
                  {it.action}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function bestBy(values: string[]) {
  const counts = values.reduce(
    (acc, value) => {
      acc[value] = (acc[value] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
}
