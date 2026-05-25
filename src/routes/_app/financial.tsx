import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowDownCircle, ArrowUpCircle, Wallet, AlertCircle, Plus, Search, Download, Filter } from "lucide-react";
import { expenses, expenseCategories, sales, formatBRL } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/financial")({
  component: Financial,
  head: () => ({ meta: [{ title: "Gestão Financeira — VA Consultoria" }] }),
});

const statusBadge = (s: string) => {
  const m: Record<string, string> = {
    pago: "bg-success/15 text-success",
    pendente: "bg-warning/15 text-warning",
    atrasado: "bg-destructive/15 text-destructive",
    parcial: "bg-info/15 text-info",
  };
  return m[s] ?? "bg-muted text-muted-foreground";
};

function Financial() {
  const totalReceitas = sales.reduce((acc, s) => acc + (s.status === "pago" ? s.value : 0), 0);
  const totalDespesas = expenses.reduce((acc, e) => acc + (e.status === "pago" ? e.value : 0), 0);
  const aPagar = expenses.filter(e => e.status === "pendente").reduce((acc, e) => acc + e.value, 0);
  const aReceber = sales.filter(s => s.status !== "pago").reduce((acc, s) => acc + s.value, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestão Financeira"
        subtitle="Receitas, despesas, contas a pagar e a receber"
        action={
          <>
            <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Exportar</Button>
            <Button className="gradient-primary text-primary-foreground"><Plus className="mr-2 h-4 w-4" />Novo lançamento</Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Receitas (pago)" value={formatBRL(totalReceitas)} delta={18} icon={ArrowUpCircle} accent="success" />
        <KpiCard label="Despesas (pago)" value={formatBRL(totalDespesas)} delta={6} icon={ArrowDownCircle} accent="warning" />
        <KpiCard label="A receber" value={formatBRL(aReceber)} icon={Wallet} accent="info" hint={`${sales.filter(s => s.status !== "pago").length} títulos`} />
        <KpiCard label="A pagar" value={formatBRL(aPagar)} icon={AlertCircle} accent="destructive" hint={`${expenses.filter(e => e.status === "pendente").length} títulos`} />
      </div>

      <Card className="border-border/60 bg-card/60 p-5">
        <Tabs defaultValue="despesas">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="despesas">Despesas</TabsTrigger>
              <TabsTrigger value="receitas">Receitas</TabsTrigger>
              <TabsTrigger value="categorias">Categorias</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar..." className="h-9 w-56 pl-8" />
              </div>
              <Button variant="outline" size="sm"><Filter className="mr-2 h-4 w-4" />Filtros</Button>
            </div>
          </div>

          <TabsContent value="despesas" className="mt-0">
            <div className="overflow-hidden rounded-lg border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((e) => (
                    <TableRow key={e.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{e.desc}</TableCell>
                      <TableCell><Badge variant="outline" className="border-border/60">{e.category}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{new Date(e.date).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{e.recurring ? "Recorrente" : "Avulsa"}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatBRL(e.value)}</TableCell>
                      <TableCell><Badge className={`${statusBadge(e.status)} hover:${statusBadge(e.status)}`}>{e.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="receitas" className="mt-0">
            <div className="overflow-hidden rounded-lg border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Cliente</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((s) => (
                    <TableRow key={s.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{s.client}</TableCell>
                      <TableCell className="text-muted-foreground">{s.service}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(s.date).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-success">{formatBRL(s.value)}</TableCell>
                      <TableCell><Badge className={`${statusBadge(s.status)} hover:${statusBadge(s.status)}`}>{s.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="categorias" className="mt-0">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {expenseCategories.map((c) => (
                <div key={c} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 p-3">
                  <span className="text-sm font-medium">{c}</span>
                  <Badge variant="outline" className="border-border/60 text-xs">Padrão</Badge>
                </div>
              ))}
              <button className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background/20 p-3 text-sm text-muted-foreground hover:border-primary hover:text-primary">
                <Plus className="h-4 w-4" /> Nova categoria
              </button>
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
