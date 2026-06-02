import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, CheckCircle2, Info, AlertCircle, RotateCcw, Search } from "lucide-react";
import {
  clients as initialClients,
  expenses as initialExpenses,
  goals as initialGoals,
  sales as initialSales,
} from "@/lib/mock-data";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { useSyncedReceivables } from "@/hooks/use-synced-receivables";
import { applyGoalMetrics } from "@/lib/goal-metrics";
import { cashBalanceKey, defaultCashBalance } from "@/lib/cash-data";
import { generateSystemAlerts, type SystemAlert } from "@/lib/system-alerts";

export const Route = createFileRoute("/_app/alerts")({
  component: Alerts,
  head: () => ({ meta: [{ title: "Alertas - VA" }] }),
});

const cfg = {
  danger: {
    icon: AlertCircle,
    cls: "border-destructive/30 bg-destructive/5",
    text: "text-destructive",
  },
  warning: { icon: AlertTriangle, cls: "border-warning/30 bg-warning/5", text: "text-warning" },
  info: { icon: Info, cls: "border-info/30 bg-info/5", text: "text-info" },
  success: { icon: CheckCircle2, cls: "border-success/30 bg-success/5", text: "text-success" },
};

type AlertItem = SystemAlert & { read?: boolean };

function Alerts() {
  const [sales] = usePersistentState("va-manager:sales", initialSales);
  const [expenses] = usePersistentState("va-manager:expenses", initialExpenses);
  const [clients] = usePersistentState("va-manager:clients", initialClients);
  const [goals] = usePersistentState("va-manager:goals", initialGoals);
  const [cashBase] = usePersistentState(cashBalanceKey, defaultCashBalance);
  const [receivables] = useSyncedReceivables({ sales });
  const [readIds, setReadIds] = usePersistentState<string[]>("va-manager:read-alerts", []);
  const [query, setQuery] = useState("");

  const alerts = useMemo<AlertItem[]>(() => {
    const syncedGoals = applyGoalMetrics(goals, { sales, expenses, clients });
    const generated = generateSystemAlerts({
      sales,
      expenses,
      clients,
      goals: syncedGoals,
      receivables,
      cashBase,
    });
    return generated.map((alert) => ({ ...alert, read: readIds.includes(alert.id) }));
  }, [cashBase, clients, expenses, goals, readIds, receivables, sales]);

  const filteredAlerts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return alerts;
    return alerts.filter((alert) =>
      [
        alert.title,
        alert.desc,
        alert.type,
        alert.time,
        alert.target,
        alert.read ? "lido" : "aberto",
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [alerts, query]);

  const markRead = (id: string) => {
    setReadIds((current) => (current.includes(id) ? current : [...current, id]));
    toast.success("Alerta marcado como lido.");
  };

  const markAllRead = () => {
    setReadIds(alerts.map((alert) => alert.id));
    toast.success("Todos os alertas foram marcados como lidos.");
  };

  const openDetails = (alert: AlertItem) => {
    toast.info(alert.title, { description: alert.desc });
  };

  const unread = alerts.filter((alert) => !alert.read).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alertas Inteligentes"
        subtitle={`${unread} alertas abertos detectados automaticamente pelo sistema`}
        action={
          <>
            <Button variant="outline" size="sm" onClick={markAllRead}>
              Marcar todos como lidos
            </Button>
            <Button variant="outline" size="sm" onClick={() => setReadIds([])}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reabrir alertas
            </Button>
          </>
        }
      />

      <Card className="border-border/60 bg-card/60 p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por cliente, conta, meta ou status..."
            className="pl-8"
          />
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {filteredAlerts.map((a) => {
          const c = cfg[a.type as keyof typeof cfg] ?? cfg.info;
          const Icon = c.icon;
          return (
            <Card key={a.id} className={`border p-4 ${c.cls} ${a.read ? "opacity-60" : ""}`}>
              <div className="flex items-start gap-3">
                <div
                  className={`grid h-10 w-10 place-items-center rounded-xl bg-background/60 ${c.text}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-medium">{a.title}</h4>
                    <div className="flex items-center gap-2">
                      {a.read && (
                        <Badge variant="outline" className="border-border/60 text-[10px]">
                          Lido
                        </Badge>
                      )}
                      <Badge variant="outline" className="border-border/60 text-[10px]">
                        {a.time}
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{a.desc}</p>
                  {a.target && (
                    <p className="mt-1 text-xs text-muted-foreground/80">
                      Origem: <span className="text-foreground/80">{a.target}</span>
                    </p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => markRead(a.id)}>
                      Marcar como lido
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openDetails(a)}>
                      Detalhes
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
        {filteredAlerts.length === 0 && (
          <Card className="border-border/60 bg-card/60 p-8 text-center text-sm text-muted-foreground md:col-span-2">
            Nenhum alerta encontrado para a busca atual.
          </Card>
        )}
      </div>
    </div>
  );
}
