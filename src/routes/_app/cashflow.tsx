import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import { Wallet, ArrowUpCircle, ArrowDownCircle, TrendingUp } from "lucide-react";
import { cashFlowDaily, formatBRL } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/cashflow")({
  component: CashFlow,
  head: () => ({ meta: [{ title: "Fluxo de Caixa — VA Consultoria" }] }),
});

function CashFlow() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Fluxo de Caixa"
        subtitle="Entradas, saídas e projeção de saldo"
        action={
          <Tabs defaultValue="mes">
            <TabsList>
              <TabsTrigger value="hoje">Hoje</TabsTrigger>
              <TabsTrigger value="semana">Semana</TabsTrigger>
              <TabsTrigger value="mes">Mês</TabsTrigger>
              <TabsTrigger value="tri">Trimestre</TabsTrigger>
              <TabsTrigger value="ano">Ano</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Saldo inicial" value={formatBRL(80000)} icon={Wallet} accent="info" />
        <KpiCard label="Entradas do período" value={formatBRL(234000)} delta={18} icon={ArrowUpCircle} accent="success" />
        <KpiCard label="Saídas do período" value={formatBRL(115000)} delta={6} icon={ArrowDownCircle} accent="warning" />
        <KpiCard label="Saldo final" value={formatBRL(199000)} delta={26} icon={TrendingUp} accent="primary" />
      </div>

      <Card className="border-border/60 bg-card/60 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-semibold">Evolução diária do caixa</h3>
            <p className="text-xs text-muted-foreground">Saldo realizado e projeção</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={340}>
          <AreaChart data={cashFlowDaily}>
            <defs>
              <linearGradient id="cf1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(28 95% 60%)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="hsl(28 95% 60%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="cf2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(152 55% 48%)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="hsl(152 55% 48%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 100% / 0.06)" />
            <XAxis dataKey="day" stroke="hsl(0 0% 65%)" fontSize={11} />
            <YAxis stroke="hsl(0 0% 65%)" fontSize={11} tickFormatter={(v) => `${(v as number)/1000}k`} />
            <Tooltip contentStyle={{ background: "hsl(0 0% 12%)", border: "1px solid hsl(0 0% 20%)", borderRadius: 8 }} formatter={(v: number) => formatBRL(v)} />
            <ReferenceLine y={50000} stroke="hsl(0 80% 60%)" strokeDasharray="4 4" label={{ value: "Mínimo seguro", position: "right", fill: "hsl(0 80% 60%)", fontSize: 11 }} />
            <Area type="monotone" dataKey="saldo" stroke="hsl(28 95% 60%)" strokeWidth={2.5} fill="url(#cf1)" name="Saldo realizado" />
            <Area type="monotone" dataKey="projecao" stroke="hsl(152 55% 48%)" strokeWidth={2} strokeDasharray="5 5" fill="url(#cf2)" name="Projeção" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/60 bg-card/60 p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Maior entrada</p>
          <p className="mt-1 font-display text-xl font-semibold">{formatBRL(31600)}</p>
          <p className="text-xs text-muted-foreground">Quinta-feira · 22 vendas</p>
        </Card>
        <Card className="border-border/60 bg-card/60 p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Maior saída</p>
          <p className="mt-1 font-display text-xl font-semibold">{formatBRL(42000)}</p>
          <p className="text-xs text-muted-foreground">Salários equipe · 15/05</p>
        </Card>
        <Card className="border-border/60 bg-card/60 p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Dias com saldo positivo</p>
          <p className="mt-1 font-display text-xl font-semibold">30 / 30</p>
          <p className="text-xs text-success">100% do período</p>
        </Card>
      </div>
    </div>
  );
}
