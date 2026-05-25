import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Briefcase } from "lucide-react";
import { services, formatBRL } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/services")({
  component: Services,
  head: () => ({ meta: [{ title: "Serviços — VA" }] }),
});

function Services() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Serviços e Produtos"
        subtitle="Catálogo da VA Consultoria"
        action={<Button className="gradient-primary text-primary-foreground"><Plus className="mr-2 h-4 w-4" />Novo serviço</Button>}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {services.map((s) => (
          <Card key={s.id} className="group border-border/60 bg-card/60 p-5 transition hover:border-primary/40 hover:shadow-elegant">
            <div className="flex items-start justify-between">
              <div className="grid h-11 w-11 place-items-center rounded-xl gradient-primary text-primary-foreground shadow-glow">
                <Briefcase className="h-5 w-5" />
              </div>
              <Badge className="bg-success/15 text-success hover:bg-success/15">{s.status}</Badge>
            </div>
            <h3 className="mt-4 font-display text-base font-semibold">{s.name}</h3>
            <p className="text-xs text-muted-foreground">{s.category}</p>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="font-display text-2xl font-semibold text-gradient-primary">{formatBRL(s.price)}</span>
              <span className="text-xs text-muted-foreground">Comissão {s.commission}%</span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3 text-xs">
              <span className="text-muted-foreground">Vendidos no mês</span>
              <span className="font-medium">{s.sold} un.</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
