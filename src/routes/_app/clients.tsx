import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, UserPlus, AlertCircle, DollarSign, Search, Plus } from "lucide-react";
import { clients, formatBRL } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/clients")({
  component: Clients,
  head: () => ({ meta: [{ title: "CRM — Clientes — VA" }] }),
});

function Clients() {
  const ativos = clients.filter(c => c.status === "ativo").length;
  const inad = clients.filter(c => c.status === "inadimplente").length;
  const total = clients.reduce((a, c) => a + c.total, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM · Clientes"
        subtitle="Base completa de clientes e histórico de relacionamento"
        action={<Button className="gradient-primary text-primary-foreground"><Plus className="mr-2 h-4 w-4" />Novo cliente</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total de clientes" value={String(clients.length)} icon={Users} accent="primary" />
        <KpiCard label="Clientes ativos" value={String(ativos)} delta={12} icon={UserPlus} accent="success" />
        <KpiCard label="Inadimplentes" value={String(inad)} delta={-2} icon={AlertCircle} accent="destructive" />
        <KpiCard label="LTV total" value={formatBRL(total)} icon={DollarSign} accent="info" />
      </div>

      <Card className="border-border/60 bg-card/60 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold">Base de clientes</h3>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar cliente..." className="h-9 w-64 pl-8" />
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-border/60">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Cliente</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Serviço</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Entrada</TableHead>
                <TableHead className="text-right">LTV</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => (
                <TableRow key={c.id} className="hover:bg-muted/30">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-xs font-semibold">{c.name.split(" ").map(n => n[0]).slice(0,2).join("")}</div>
                      <span className="font-medium">{c.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">{c.doc}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.phone}<br />{c.email}</TableCell>
                  <TableCell>{c.service}</TableCell>
                  <TableCell><Badge variant="outline" className="border-border/60 text-xs">{c.origin}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{new Date(c.entryDate).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatBRL(c.total)}</TableCell>
                  <TableCell>
                    <Badge className={c.status === "ativo" ? "bg-success/15 text-success hover:bg-success/15" : "bg-destructive/15 text-destructive hover:bg-destructive/15"}>
                      {c.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
