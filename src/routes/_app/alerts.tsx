import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Info, AlertCircle } from "lucide-react";
import { alerts } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/alerts")({
  component: Alerts,
  head: () => ({ meta: [{ title: "Alertas — VA" }] }),
});

const cfg = {
  danger: { icon: AlertCircle, cls: "border-destructive/30 bg-destructive/5", text: "text-destructive" },
  warning: { icon: AlertTriangle, cls: "border-warning/30 bg-warning/5", text: "text-warning" },
  info: { icon: Info, cls: "border-info/30 bg-info/5", text: "text-info" },
  success: { icon: CheckCircle2, cls: "border-success/30 bg-success/5", text: "text-success" },
};

function Alerts() {
  return (
    <div className="space-y-6">
      <PageHeader title="Alertas Inteligentes" subtitle="Eventos detectados automaticamente pelo sistema" />
      <div className="grid gap-3 md:grid-cols-2">
        {alerts.map((a) => {
          const c = cfg[a.type as keyof typeof cfg];
          const Icon = c.icon;
          return (
            <Card key={a.id} className={`border p-4 ${c.cls}`}>
              <div className="flex items-start gap-3">
                <div className={`grid h-10 w-10 place-items-center rounded-xl bg-background/60 ${c.text}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{a.title}</h4>
                    <Badge variant="outline" className="border-border/60 text-[10px]">{a.time}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{a.desc}</p>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline">Marcar como lido</Button>
                    <Button size="sm" variant="ghost">Detalhes</Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
