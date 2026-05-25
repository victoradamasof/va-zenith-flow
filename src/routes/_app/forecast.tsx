import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { TrendingUp, TrendingDown, Sparkles, AlertTriangle } from "lucide-react";
import { monthlyRevenue, formatBRL } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/forecast")({
  component: Forecast,
  head: () => ({ meta: [{ title: "Previsibilidade Financeira — VA" }] }),
});

const projection = [
  ...monthlyRevenue,
  { month: "Jun", receita: 258000, despesa: 118000, lucro: 140000, projetado: true },
  { month: "Jul", receita: 278000, despesa: 122000, lucro: 156000, projetado: true },
  { month: "Ago", receita: 302000, despesa: 128000, lucro: 174000, projetado: true },
];

function Forecast() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Previsibilidade Financeira"
        subtitle="Projeções, tendências e cenários para os próximos 90 dias"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Projeção faturamento (90d)" value={formatBRL(838000)} delta={24} icon={TrendingUp} accent="success" />
        <KpiCard label="Projeção lucro (90d)" value={formatBRL(470000)} delta={28} icon={TrendingUp} accent="primary" />
        <KpiCard label="Tendência" value="Alta" icon={Sparkles} accent="info" hint="confiança 82%" />
        <KpiCard label="Risco fluxo de caixa" value="Baixo" icon={AlertTriangle} accent="warning" hint="próximos 60 dias" />
      </div>

      <Card className="border-border/60 bg-card/60 p-5">
        <div className="mb-4">
          <h3 className="font-display text-base font-semibold">Projeção de resultado</h3>
          <p className="text-xs text-muted-foreground">Histórico + 3 meses projetados</p>
        </div>
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={projection}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 100% / 0.06)" />
            <XAxis dataKey="month" stroke="hsl(0 0% 65%)" fontSize={12} />
            <YAxis stroke="hsl(0 0% 65%)" fontSize={12} tickFormatter={(v) => `${(v as number)/1000}k`} />
            <Tooltip contentStyle={{ background: "hsl(0 0% 12%)", border: "1px solid hsl(0 0% 20%)", borderRadius: 8 }} formatter={(v: number) => formatBRL(v)} />
            <Legend />
            <Line type="monotone" dataKey="receita" stroke="hsl(28 95% 60%)" strokeWidth={2.5} name="Receita" dot={{ r: 3 }} />
            <Line type="monotone" dataKey="lucro" stroke="hsl(152 55% 48%)" strokeWidth={2.5} name="Lucro" dot={{ r: 3 }} />
            <Line type="monotone" dataKey="despesa" stroke="hsl(45 85% 60%)" strokeWidth={2} name="Despesa" dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { name: "Cenário Otimista", desc: "Crescimento 30% a.m., +2 vendedores", color: "success", revenue: 920000, profit: 540000, tag: "+22%" },
          { name: "Cenário Conservador", desc: "Crescimento médio histórico (18%)", color: "primary", revenue: 838000, profit: 470000, tag: "base" },
          { name: "Cenário Pessimista", desc: "Queda 10% nas vendas, custos estáveis", color: "destructive", revenue: 680000, profit: 320000, tag: "-19%" },
        ].map((c) => (
          <Card key={c.name} className={`border-${c.color}/30 bg-card/60 p-5`}>
            <div className="flex items-center justify-between">
              <h4 className="font-display text-sm font-semibold">{c.name}</h4>
              <Badge className={`bg-${c.color}/15 text-${c.color} hover:bg-${c.color}/15`}>{c.tag}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{c.desc}</p>
            <div className="mt-4 space-y-2 border-t border-border/60 pt-4 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Receita</span><span className="font-medium tabular-nums">{formatBRL(c.revenue)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Lucro</span><span className="font-medium tabular-nums">{formatBRL(c.profit)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Margem</span><span className="font-medium">{Math.round(c.profit / c.revenue * 100)}%</span></div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
