import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileBarChart, Download } from "lucide-react";

export const Route = createFileRoute("/_app/reports")({
  component: Reports,
  head: () => ({ meta: [{ title: "Relatórios — VA" }] }),
});

const reports = [
  { name: "Faturamento mensal", desc: "Receita total agrupada por mês, com comparativos.", tag: "Financeiro" },
  { name: "Lucro e margem", desc: "Lucro líquido, margem e evolução.", tag: "Financeiro" },
  { name: "Despesas por categoria", desc: "Composição e variação de despesas.", tag: "Financeiro" },
  { name: "Fluxo de caixa detalhado", desc: "Entradas, saídas e saldo dia a dia.", tag: "Financeiro" },
  { name: "Vendas por vendedor", desc: "Performance comercial individual.", tag: "Comercial" },
  { name: "Vendas por serviço", desc: "Ranking de serviços e ticket médio.", tag: "Comercial" },
  { name: "Contas pagas e pendentes", desc: "Status de obrigações financeiras.", tag: "Financeiro" },
  { name: "Inadimplência", desc: "Clientes em atraso e idade da dívida.", tag: "CRM" },
  { name: "Resultado mensal consolidado", desc: "DRE simplificado.", tag: "Estratégico" },
  { name: "Comparativo mensal", desc: "Mês atual vs anterior em todos os indicadores.", tag: "Estratégico" },
];

function Reports() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatórios"
        subtitle="Gere relatórios detalhados em PDF ou Excel"
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((r) => (
          <Card key={r.name} className="group border-border/60 bg-card/60 p-5 transition hover:border-primary/40 hover:shadow-elegant">
            <div className="flex items-start justify-between">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <FileBarChart className="h-5 w-5" />
              </div>
              <Badge variant="outline" className="border-border/60 text-xs">{r.tag}</Badge>
            </div>
            <h3 className="mt-4 font-display text-base font-semibold">{r.name}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{r.desc}</p>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" className="flex-1"><Download className="mr-2 h-3 w-3" />PDF</Button>
              <Button variant="outline" size="sm" className="flex-1"><Download className="mr-2 h-3 w-3" />Excel</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
