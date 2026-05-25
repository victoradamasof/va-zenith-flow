import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calculator } from "lucide-react";
import { formatBRL } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/simulator")({
  component: Simulator,
  head: () => ({ meta: [{ title: "Simulador Financeiro — VA" }] }),
});

function Simulator() {
  const [salesQty, setSalesQty] = useState(200);
  const [ticket, setTicket] = useState(1700);
  const [costReduction, setCostReduction] = useState([10]);
  const [newCosts, setNewCosts] = useState(5000);

  const baseCosts = 115000;
  const calc = useMemo(() => {
    const revenue = salesQty * ticket;
    const costs = baseCosts * (1 - costReduction[0] / 100) + newCosts;
    const profit = revenue - costs;
    const margin = (profit / revenue) * 100;
    return { revenue, costs, profit, margin };
  }, [salesQty, ticket, costReduction, newCosts]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Simulador Financeiro"
        subtitle="Modele cenários e veja o impacto em tempo real"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/60 bg-card/60 p-6">
          <div className="mb-5 flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />
            <h3 className="font-display text-base font-semibold">Parâmetros</h3>
          </div>
          <div className="space-y-6">
            <div>
              <div className="mb-2 flex justify-between"><Label>Quantidade de vendas</Label><span className="text-sm font-medium">{salesQty}</span></div>
              <Slider value={[salesQty]} min={50} max={500} step={10} onValueChange={(v) => setSalesQty(v[0])} />
            </div>
            <div>
              <div className="mb-2 flex justify-between"><Label>Ticket médio</Label><span className="text-sm font-medium">{formatBRL(ticket)}</span></div>
              <Slider value={[ticket]} min={500} max={4000} step={50} onValueChange={(v) => setTicket(v[0])} />
            </div>
            <div>
              <div className="mb-2 flex justify-between"><Label>Redução de custos</Label><span className="text-sm font-medium">{costReduction[0]}%</span></div>
              <Slider value={costReduction} min={0} max={40} step={1} onValueChange={setCostReduction} />
            </div>
            <div>
              <Label className="mb-2 block">Novos custos previstos</Label>
              <Input type="number" value={newCosts} onChange={(e) => setNewCosts(Number(e.target.value) || 0)} />
            </div>
          </div>
        </Card>

        <Card className="border-primary/30 bg-gradient-to-br from-card/80 to-primary/5 p-6 shadow-glow">
          <Badge className="bg-primary/15 text-primary hover:bg-primary/15">Resultado em tempo real</Badge>
          <div className="mt-6 space-y-6">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Faturamento estimado</p>
              <p className="font-display text-4xl font-bold text-gradient-primary">{formatBRL(calc.revenue)}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-border/60 pt-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Custos totais</p>
                <p className="font-display text-2xl font-semibold">{formatBRL(calc.costs)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Lucro líquido</p>
                <p className="font-display text-2xl font-semibold text-success">{formatBRL(calc.profit)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Margem</p>
                <p className="font-display text-2xl font-semibold">{calc.margin.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Caixa após operação</p>
                <p className="font-display text-2xl font-semibold">{formatBRL(80000 + calc.profit)}</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
