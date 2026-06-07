import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileBarChart, Download, Printer } from "lucide-react";
import {
  clients as initialClients,
  expenses as initialExpenses,
  formatBRL,
  sales as initialSales,
  services as initialServices,
} from "@/lib/mock-data";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { useSyncedReceivables } from "@/hooks/use-synced-receivables";
import { calculatePaidExpenses, calculateReceivedRevenue } from "@/lib/cash-data";
import {
  calculateCommissionEntries,
  calculatePayableCommissions,
  commissionPaymentsKey,
  type CommissionPayment,
} from "@/lib/commissions";
import {
  calculatePendingServiceCosts,
  calculateServiceCostEntries,
} from "@/lib/service-costs";

export const Route = createFileRoute("/_app/reports")({
  component: Reports,
  head: () => ({ meta: [{ title: "Relatórios - VA" }] }),
});

const reports = [
  {
    id: "revenue",
    name: "Faturamento mensal",
    desc: "Receita total, recebidos e pendentes.",
    tag: "Financeiro",
  },
  {
    id: "profit",
    name: "Lucro e margem",
    desc: "Lucro liquido estimado e margem operacional.",
    tag: "Financeiro",
  },
  {
    id: "expenses",
    name: "Despesas por categoria",
    desc: "Composicao e variacao de despesas.",
    tag: "Financeiro",
  },
  {
    id: "cashflow",
    name: "Fluxo de caixa detalhado",
    desc: "Entradas, saidas e saldo projetado.",
    tag: "Financeiro",
  },
  {
    id: "seller-sales",
    name: "Vendas por vendedor",
    desc: "Performance comercial individual.",
    tag: "Comercial",
  },
  {
    id: "service-sales",
    name: "Vendas por serviço",
    desc: "Ranking de serviços e ticket médio.",
    tag: "Comercial",
  },
  {
    id: "payables",
    name: "Contas pagas e pendentes",
    desc: "Status de obrigacoes financeiras.",
    tag: "Financeiro",
  },
  {
    id: "delinquency",
    name: "Inadimplencia",
    desc: "Clientes em atraso e valor da carteira.",
    tag: "CRM",
  },
  {
    id: "monthly-result",
    name: "Resultado mensal consolidado",
    desc: "DRE simplificado.",
    tag: "Estrategico",
  },
  {
    id: "monthly-compare",
    name: "Comparativo mensal",
    desc: "Mes atual vs anterior em indicadores.",
    tag: "Estrategico",
  },
];

function Reports() {
  const [sales] = usePersistentState("va-manager:sales", initialSales);
  const [expenses] = usePersistentState("va-manager:expenses", initialExpenses);
  const [clients] = usePersistentState("va-manager:clients", initialClients);
  const [services] = usePersistentState("va-manager:services", initialServices);
  const [commissionPayments] = usePersistentState<CommissionPayment[]>(
    commissionPaymentsKey,
    [],
  );
  const [receivables] = useSyncedReceivables({ sales });
  const commissionEntries = calculateCommissionEntries({
    sales,
    services,
    receivables,
    payments: commissionPayments,
  });
  const serviceCostEntries = calculateServiceCostEntries({ sales, services, receivables });

  const paidRevenue = calculateReceivedRevenue(sales, receivables);
  const totalRevenue = sales.reduce((sum, sale) => sum + sale.value, 0);
  const paidExpenses = calculatePaidExpenses(expenses, commissionEntries, serviceCostEntries);
  const payableCommissions = calculatePayableCommissions(commissionEntries);
  const operationalCosts = paidExpenses + payableCommissions;
  const pendingExpenses =
    expenses
      .filter((expense) => expense.status !== "pago")
      .reduce((sum, expense) => sum + expense.value, 0) +
    payableCommissions +
    calculatePendingServiceCosts(serviceCostEntries);
  const profit = paidRevenue - operationalCosts;
  const delinquentClients = clients.filter((client) => client.status === "inadimplente");

  const summary = [
    ["Faturamento total", formatBRL(totalRevenue)],
    ["Receita recebida", formatBRL(paidRevenue)],
    ["Despesas operacionais", formatBRL(operationalCosts)],
    ["Despesas abertas", formatBRL(pendingExpenses)],
    ["Lucro estimado", formatBRL(profit)],
    ["Vendas registradas", String(sales.length)],
    ["Clientes cadastrados", String(clients.length)],
    ["Clientes inadimplentes", String(delinquentClients.length)],
  ];

  const exportCsv = (reportName: string) => {
    const rows = [
      ["Relatorio", reportName],
      ["Gerado em", new Date().toLocaleString("pt-BR")],
      [],
      ["Indicador", "Valor"],
      ...summary,
      [],
      ["Tipo", "Data", "Descrição", "Categoria/Serviço", "Valor", "Status"],
      ...sales.map((sale) => [
        "Receita",
        sale.date,
        sale.client,
        sale.service,
        String(sale.value),
        sale.status,
      ]),
      ...expenses.map((expense) => [
        "Despesa",
        expense.date,
        expense.desc,
        expense.category,
        String(expense.value),
        expense.status,
      ]),
      ...commissionEntries.map((commission) => [
        "Comissão",
        commission.paidAt ?? commission.dueDate,
        commission.seller,
        commission.service,
        String(commission.amount),
        commission.status,
      ]),
      ...serviceCostEntries.map((cost) => [
        "Custo de serviço",
        cost.date,
        cost.client,
        cost.service,
        String(cost.amount),
        cost.status,
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${slug(reportName)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const printPdf = (reportName: string) => {
    const win = window.open("", "_blank", "width=1000,height=800");
    if (!win) return;

    win.document.write(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>${reportName}</title>
          <style>
            body { font-family: Inter, Arial, sans-serif; color: #171717; margin: 32px; }
            h1 { margin: 0 0 4px; font-size: 28px; }
            .muted { color: #666; font-size: 13px; margin-bottom: 24px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #f5f5f5; }
            .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 24px 0; }
            .card { border: 1px solid #ddd; border-radius: 8px; padding: 12px; }
            .label { color: #666; font-size: 11px; text-transform: uppercase; }
            .value { font-size: 18px; font-weight: 700; margin-top: 4px; }
            @media print { button { display: none; } body { margin: 18px; } }
          </style>
        </head>
        <body>
          <button onclick="window.print()" style="float:right;padding:8px 12px">Salvar como PDF</button>
          <h1>${reportName}</h1>
          <div class="muted">VA Consultoria Manager - gerado em ${new Date().toLocaleString("pt-BR")}</div>
          <div class="grid">
            ${summary.map(([label, value]) => `<div class="card"><div class="label">${label}</div><div class="value">${value}</div></div>`).join("")}
          </div>
          <h2>Receitas</h2>
          <table>
          <thead><tr><th>Data</th><th>Cliente</th><th>Serviço</th><th>Valor</th><th>Status</th></tr></thead>
            <tbody>${sales.map((sale) => `<tr><td>${sale.date}</td><td>${sale.client}</td><td>${sale.service}</td><td>${formatBRL(sale.value)}</td><td>${sale.status}</td></tr>`).join("")}</tbody>
          </table>
          <h2>Despesas</h2>
          <table>
          <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Valor</th><th>Status</th></tr></thead>
            <tbody>${expenses.map((expense) => `<tr><td>${expense.date}</td><td>${expense.desc}</td><td>${expense.category}</td><td>${formatBRL(expense.value)}</td><td>${expense.status}</td></tr>`).join("")}</tbody>
          </table>
          <h2>Comissões</h2>
          <table>
          <thead><tr><th>Data</th><th>Vendedor</th><th>Serviço</th><th>Valor</th><th>Status</th></tr></thead>
            <tbody>${commissionEntries.map((commission) => `<tr><td>${commission.paidAt ?? commission.dueDate}</td><td>${commission.seller}</td><td>${commission.service}</td><td>${formatBRL(commission.amount)}</td><td>${commission.status}</td></tr>`).join("")}</tbody>
          </table>
          <h2>Custos dos serviços</h2>
          <table>
          <thead><tr><th>Data</th><th>Cliente</th><th>Serviço</th><th>Valor</th><th>Status</th></tr></thead>
            <tbody>${serviceCostEntries.map((cost) => `<tr><td>${cost.date}</td><td>${cost.client}</td><td>${cost.service}</td><td>${formatBRL(cost.amount)}</td><td>${cost.status}</td></tr>`).join("")}</tbody>
          </table>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatórios"
        subtitle="Gere relatórios detalhados em PDF imprimível ou CSV"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summary.slice(0, 4).map(([label, value]) => (
          <Card key={label} className="border-border/60 bg-card/60 p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-2 font-display text-xl font-semibold">{value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => (
          <Card
            key={report.id}
            className="group border-border/60 bg-card/60 p-5 transition hover:border-primary/40 hover:shadow-elegant"
          >
            <div className="flex items-start justify-between">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <FileBarChart className="h-5 w-5" />
              </div>
              <Badge variant="outline" className="border-border/60 text-xs">
                {report.tag}
              </Badge>
            </div>
            <h3 className="mt-4 font-display text-base font-semibold">{report.name}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{report.desc}</p>
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => printPdf(report.name)}
              >
                <Printer className="mr-2 h-3 w-3" />
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => exportCsv(report.name)}
              >
                <Download className="mr-2 h-3 w-3" />
                CSV
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
