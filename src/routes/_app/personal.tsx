import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Wallet, PiggyBank, TrendingDown, TrendingUp } from "lucide-react";
import { formatBRL } from "@/lib/mock-data";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

export const Route = createFileRoute("/_app/personal")({
  component: Personal,
  head: () => ({ meta: [{ title: "Gestão Pessoal — VA" }] }),
});

const personalData = [
  { mes: "Jan", entrada: 22000, saida: 14500 },
  { mes: "Fev", entrada: 24500, saida: 15200 },
  { mes: "Mar", entrada: 26000, saida: 16800 },
  { mes: "Abr", entrada: 28500, saida: 17400 },
  { mes: "Mai", entrada: 31000, saida: 18900 },
];

function Personal() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestão Pessoal Financeira"
        subtitle="Seu controle financeiro pessoal, separado da empresa"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Saldo pessoal" value={formatBRL(48500)} delta={14} icon={Wallet} accent="primary" />
        <KpiCard label="Reserva de emergência" value={formatBRL(120000)} icon={PiggyBank} accent="success" hint="6 meses cobertos" />
        <KpiCard label="Entradas no mês" value={formatBRL(31000)} delta={9} icon={TrendingUp} accent="info" />
        <KpiCard label="Gastos no mês" value={formatBRL(18900)} delta={8} icon={TrendingDown} accent="warning" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/60 bg-card/60 p-5 lg:col-span-2">
          <h3 className="font-display text-base font-semibold">Entradas vs gastos pessoais</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={personalData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 100% / 0.06)" />
              <XAxis dataKey="mes" stroke="hsl(0 0% 65%)" fontSize={12} />
              <YAxis stroke="hsl(0 0% 65%)" fontSize={12} tickFormatter={(v) => `${v/1000}k`} />
              <Tooltip contentStyle={{ background: "hsl(0 0% 12%)", border: "1px solid hsl(0 0% 20%)", borderRadius: 8 }} formatter={(v: number) => formatBRL(v)} />
              <Bar dataKey="entrada" fill="hsl(152 55% 48%)" radius={[6,6,0,0]} name="Entrada" />
              <Bar dataKey="saida" fill="hsl(28 95% 60%)" radius={[6,6,0,0]} name="Saída" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="border-border/60 bg-card/60 p-5">
          <h3 className="mb-3 font-display text-base font-semibold">Metas pessoais</h3>
          <div className="space-y-4">
            {[
              { name: "Casa nova", current: 85000, target: 250000 },
              { name: "Viagem família", current: 12000, target: 18000 },
              { name: "Investimentos", current: 240000, target: 500000 },
            ].map((g) => {
              const pct = Math.round(g.current/g.target*100);
              return (
                <div key={g.name}>
                  <div className="flex justify-between text-sm"><span>{g.name}</span><span className="text-muted-foreground tabular-nums">{pct}%</span></div>
                  <Progress value={pct} className="mt-1 h-2" />
                  <p className="mt-1 text-xs text-muted-foreground">{formatBRL(g.current)} de {formatBRL(g.target)}</p>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
