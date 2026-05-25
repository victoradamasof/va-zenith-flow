import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Download, ShoppingCart, DollarSign, Target, TrendingUp } from "lucide-react";
import { sales, sellers, services, formatBRL } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/sales")({
  component: Sales,
  head: () => ({ meta: [{ title: "Vendas — VA Consultoria" }] }),
});

const statusBadge = (s: string) => ({
  pago: "bg-success/15 text-success",
  pendente: "bg-warning/15 text-warning",
  atrasado: "bg-destructive/15 text-destructive",
  parcial: "bg-info/15 text-info",
}[s] ?? "bg-muted");

function Sales() {
  const totalMes = sales.reduce((a, s) => a + s.value, 0);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestão de Vendas"
        subtitle="Histórico, performance e conversão comercial"
        action={
          <>
            <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Exportar</Button>
            <Button className="gradient-primary text-primary-foreground"><Plus className="mr-2 h-4 w-4" />Nova venda</Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Vendas no mês" value="184" delta={22} icon={ShoppingCart} accent="primary" />
        <KpiCard label="Receita total" value={formatBRL(totalMes * 18)} delta={18} icon={DollarSign} accent="success" />
        <KpiCard label="Ticket médio" value={formatBRL(1645)} delta={4} icon={Target} accent="info" />
        <KpiCard label="Taxa de conversão" value="38,4%" delta={6} icon={TrendingUp} accent="warning" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/60 bg-card/60 p-5">
          <h3 className="font-display text-base font-semibold">Melhor vendedor</h3>
          <p className="text-xs text-muted-foreground">Mês atual</p>
          <div className="mt-4 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full gradient-primary text-sm font-bold text-primary-foreground">{sellers[0].avatar}</div>
            <div>
              <p className="font-medium">{sellers[0].name}</p>
              <p className="text-xs text-muted-foreground">{sellers[0].sales} vendas · {formatBRL(sellers[0].revenue)}</p>
            </div>
          </div>
        </Card>
        <Card className="border-border/60 bg-card/60 p-5">
          <h3 className="font-display text-base font-semibold">Serviço mais vendido</h3>
          <p className="text-xs text-muted-foreground">Mês atual</p>
          <div className="mt-4">
            <p className="font-medium">{services.slice().sort((a,b) => b.sold - a.sold)[0].name}</p>
            <p className="text-xs text-muted-foreground">{services.slice().sort((a,b) => b.sold - a.sold)[0].sold} vendas</p>
            <p className="mt-2 font-display text-xl font-semibold text-primary">{formatBRL(services[1].sold * services[1].price)}</p>
          </div>
        </Card>
        <Card className="border-border/60 bg-card/60 p-5">
          <h3 className="font-display text-base font-semibold">Conversão por origem</h3>
          <div className="mt-4 space-y-2">
            {[
              { o: "Indicação", v: 38 }, { o: "Instagram", v: 24 }, { o: "Google Ads", v: 18 }, { o: "LinkedIn", v: 12 },
            ].map((row) => (
              <div key={row.o}>
                <div className="flex justify-between text-xs"><span>{row.o}</span><span className="tabular-nums">{row.v}%</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full gradient-primary" style={{ width: `${row.v * 2.5}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="border-border/60 bg-card/60 p-5">
        <h3 className="mb-3 font-display text-base font-semibold">Histórico recente</h3>
        <div className="overflow-hidden rounded-lg border border-border/60">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Serviço</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((s) => (
                <TableRow key={s.id} className="hover:bg-muted/30">
                  <TableCell className="text-muted-foreground">{new Date(s.date).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="font-medium">{s.client}</TableCell>
                  <TableCell>{s.service}</TableCell>
                  <TableCell>{s.seller}</TableCell>
                  <TableCell><Badge variant="outline" className="border-border/60 text-xs">{s.origin}</Badge></TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatBRL(s.value)}</TableCell>
                  <TableCell><Badge className={`${statusBadge(s.status)} hover:${statusBadge(s.status)}`}>{s.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
