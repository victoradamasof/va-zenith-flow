import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line,
} from "recharts";
import {
  DollarSign, TrendingUp, TrendingDown, Wallet, Users, ShoppingCart,
  Target, AlertTriangle, ArrowRight, Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  monthlyRevenue, dailySales, expensesByCategory, services, sellers,
  alerts, insights, formatBRL, goals,
} from "@/lib/mock-data";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard — VA Consultoria Manager" }] }),
});

const CHART_COLORS = ["hsl(28 95% 60%)", "hsl(152 55% 48%)", "hsl(240 60% 60%)", "hsl(45 85% 60%)", "hsl(305 55% 55%)", "hsl(0 0% 55%)"];

function Dashboard() {
  const meta = goals[0];
  const pct = Math.round((meta.current / meta.target) * 100);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Executivo"
        subtitle="Visão consolidada da saúde financeira e operacional da VA Consultoria"
        action={
          <>
            <Badge variant="outline" className="border-border/60 text-muted-foreground">Maio / 2026</Badge>
            <Button className="gradient-primary text-primary-foreground shadow-glow">
              <Sparkles className="mr-2 h-4 w-4" /> Gerar insight
            </Button>
          </>
        }
      />

      {/* Alerta destaque */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="flex items-center gap-3 border-warning/30 bg-warning/5 p-4">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-warning/15 text-warning">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">2 alertas críticos exigem atenção</p>
            <p className="text-xs text-muted-foreground">Fluxo de caixa projeta saldo negativo em 18 dias · 1 conta vencida</p>
          </div>
          <Button variant="ghost" size="sm" className="text-warning">Ver alertas <ArrowRight className="ml-1 h-3 w-3" /></Button>
        </Card>
      </motion.div>

      {/* KPIs principais */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Faturamento do mês" value={formatBRL(234000)} delta={18.2} icon={DollarSign} accent="primary" hint="vs mês anterior" />
        <KpiCard label="Lucro líquido" value={formatBRL(119000)} delta={32.2} icon={TrendingUp} accent="success" hint="margem 50,8%" />
        <KpiCard label="Despesas totais" value={formatBRL(115000)} delta={6.5} icon={TrendingDown} accent="warning" hint="dentro da meta" />
        <KpiCard label="Saldo em caixa" value={formatBRL(186400)} delta={12.4} icon={Wallet} accent="info" hint="conta consolidada" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Vendas no mês" value="184" delta={22} icon={ShoppingCart} accent="primary" />
        <KpiCard label="Ticket médio" value={formatBRL(1645)} delta={4.1} icon={Target} accent="info" />
        <KpiCard label="Novos clientes" value="62" delta={-8} icon={Users} accent="warning" />
        <KpiCard label="Inadimplência" value="3,2%" delta={-1.5} icon={AlertTriangle} accent="destructive" />
      </div>

      {/* Gráficos principais */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/60 bg-card/60 p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-semibold">Evolução financeira</h3>
              <p className="text-xs text-muted-foreground">Receita, despesa e lucro nos últimos 7 meses</p>
            </div>
            <Badge variant="outline" className="border-success/30 bg-success/10 text-success">+18% no período</Badge>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={monthlyRevenue}>
              <defs>
                <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gLuc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS[1]} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={CHART_COLORS[1]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 100% / 0.06)" />
              <XAxis dataKey="month" stroke="hsl(0 0% 65%)" fontSize={12} />
              <YAxis stroke="hsl(0 0% 65%)" fontSize={12} tickFormatter={(v) => `${v/1000}k`} />
              <Tooltip contentStyle={{ background: "hsl(0 0% 12%)", border: "1px solid hsl(0 0% 20%)", borderRadius: 8 }} formatter={(v: number) => formatBRL(v)} />
              <Area type="monotone" dataKey="receita" stroke={CHART_COLORS[0]} strokeWidth={2} fill="url(#gRev)" name="Receita" />
              <Area type="monotone" dataKey="lucro" stroke={CHART_COLORS[1]} strokeWidth={2} fill="url(#gLuc)" name="Lucro" />
              <Line type="monotone" dataKey="despesa" stroke={CHART_COLORS[3]} strokeWidth={2} name="Despesa" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="border-border/60 bg-card/60 p-5">
          <h3 className="font-display text-base font-semibold">Despesas por categoria</h3>
          <p className="mb-2 text-xs text-muted-foreground">Composição de custos · Maio</p>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={expensesByCategory} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                {expensesByCategory.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "hsl(0 0% 12%)", border: "1px solid hsl(0 0% 20%)", borderRadius: 8 }} formatter={(v: number) => formatBRL(v)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5">
            {expensesByCategory.slice(0, 4).map((e, i) => (
              <div key={e.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS[i] }} />{e.name}</span>
                <span className="font-medium tabular-nums">{formatBRL(e.value)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/60 bg-card/60 p-5 lg:col-span-2">
          <h3 className="font-display text-base font-semibold">Vendas da semana</h3>
          <p className="mb-3 text-xs text-muted-foreground">Volume diário e valor acumulado</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dailySales}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 100% / 0.06)" />
              <XAxis dataKey="day" stroke="hsl(0 0% 65%)" fontSize={12} />
              <YAxis stroke="hsl(0 0% 65%)" fontSize={12} tickFormatter={(v) => `${v/1000}k`} />
              <Tooltip contentStyle={{ background: "hsl(0 0% 12%)", border: "1px solid hsl(0 0% 20%)", borderRadius: 8 }} formatter={(v: number) => formatBRL(v)} />
              <Bar dataKey="valor" fill={CHART_COLORS[0]} radius={[8, 8, 0, 0]} name="Faturamento" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="border-border/60 bg-card/60 p-5">
          <h3 className="font-display text-base font-semibold">Meta de faturamento</h3>
          <p className="text-xs text-muted-foreground">Vence em {meta.deadline}</p>
          <div className="my-5">
            <div className="flex items-baseline justify-between">
              <span className="font-display text-3xl font-semibold">{pct}%</span>
              <span className="text-xs text-muted-foreground">{formatBRL(meta.current)} / {formatBRL(meta.target)}</span>
            </div>
            <Progress value={pct} className="mt-3 h-2" />
          </div>
          <div className="space-y-2 border-t border-border/60 pt-4 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">Ritmo diário</span><span className="font-medium">{formatBRL(9750)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Projeção fim do mês</span><span className="font-medium text-success">{formatBRL(289500)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge className="h-5 bg-success/15 text-success hover:bg-success/15">No ritmo</Badge></div>
          </div>
        </Card>
      </div>

      {/* Rankings + Insights */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/60 bg-card/60 p-5">
          <h3 className="font-display text-base font-semibold">Top serviços</h3>
          <p className="mb-3 text-xs text-muted-foreground">Mais vendidos no mês</p>
          <div className="space-y-3">
            {services.slice().sort((a,b) => b.sold - a.sold).map((s, i) => (
              <div key={s.id} className="flex items-center gap-3">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">#{i+1}</div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.sold} vendas · {formatBRL(s.price)}</p>
                </div>
                <span className="text-sm font-medium tabular-nums">{formatBRL(s.sold * s.price)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="border-border/60 bg-card/60 p-5">
          <h3 className="font-display text-base font-semibold">Top vendedores</h3>
          <p className="mb-3 text-xs text-muted-foreground">Performance no mês</p>
          <div className="space-y-3">
            {sellers.map((v, i) => (
              <div key={v.id} className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-xs font-semibold">{v.avatar}</div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{v.name}</p>
                  <p className="text-xs text-muted-foreground">{v.sales} vendas</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium tabular-nums">{formatBRL(v.revenue)}</p>
                  {i === 0 && <Badge className="h-4 bg-primary/15 text-[10px] text-primary hover:bg-primary/15">Top</Badge>}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="border-border/60 bg-card/60 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-display text-base font-semibold">Insights inteligentes</h3>
          </div>
          <div className="space-y-2.5">
            {insights.slice(0, 4).map((it, i) => (
              <div key={i} className="rounded-lg border border-border/60 bg-background/40 p-3 text-xs leading-relaxed text-muted-foreground">
                <span className="text-foreground">{it.text}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Alertas + Feed */}
      <Card className="border-border/60 bg-card/60 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-semibold">Central de alertas</h3>
            <p className="text-xs text-muted-foreground">Eventos que precisam de sua atenção</p>
          </div>
          <Button variant="outline" size="sm">Ver todos</Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {alerts.slice(0, 4).map((a) => {
            const tone = {
              danger: "border-destructive/30 bg-destructive/5 text-destructive",
              warning: "border-warning/30 bg-warning/5 text-warning",
              info: "border-info/30 bg-info/5 text-info",
              success: "border-success/30 bg-success/5 text-success",
            }[a.type as "danger" | "warning" | "info" | "success"];
            return (
              <div key={a.id} className={`rounded-xl border p-3 ${tone}`}>
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{a.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{a.desc}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{a.time}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
