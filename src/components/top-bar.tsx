import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, LogOut, Moon, Search, Sun } from "lucide-react";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { useSyncedReceivables } from "@/hooks/use-synced-receivables";
import {
  clients as initialClients,
  expenses as initialExpenses,
  goals as initialGoals,
  sales as initialSales,
} from "@/lib/mock-data";
import { applyGoalMetrics } from "@/lib/goal-metrics";
import { cashBalanceKey, defaultCashBalance } from "@/lib/cash-data";
import {
  bankTransactionsKey,
  initialBankTransactions,
  type BankTransaction,
} from "@/lib/bank-data";
import { generateSystemAlerts } from "@/lib/system-alerts";
import { clearAuthSession, getAuthSession, type AuthSession } from "@/lib/auth";
import { canAccessRoute, getDefaultRouteForSession, type AppRoutePath } from "@/lib/permissions";

export function TopBar() {
  const [dark, setDark] = useState(true);
  const [query, setQuery] = useState("");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [sales] = usePersistentState("va-manager:sales", initialSales);
  const [expenses] = usePersistentState("va-manager:expenses", initialExpenses);
  const [clients] = usePersistentState("va-manager:clients", initialClients);
  const [goals] = usePersistentState("va-manager:goals", initialGoals);
  const [cashBase] = usePersistentState(cashBalanceKey, defaultCashBalance);
  const [bankTransactions] = usePersistentState<BankTransaction[]>(
    bankTransactionsKey,
    initialBankTransactions,
  );
  const [readIds] = usePersistentState<string[]>("va-manager:read-alerts", []);
  const [receivables] = useSyncedReceivables({ sales });
  const navigate = useNavigate();

  const unreadAlerts = useMemo(() => {
    const syncedGoals = applyGoalMetrics(goals, { sales, expenses, clients });
    return generateSystemAlerts({
      sales,
      expenses,
      clients,
      goals: syncedGoals,
      receivables,
      cashBase,
      bankTransactions,
    }).filter((alert) => !readIds.includes(alert.id)).length;
  }, [bankTransactions, cashBase, clients, expenses, goals, readIds, receivables, sales]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    const refreshSession = () => setSession(getAuthSession());
    refreshSession();
    window.addEventListener("va-auth-change", refreshSession);
    window.addEventListener("storage", refreshSession);
    return () => {
      window.removeEventListener("va-auth-change", refreshSession);
      window.removeEventListener("storage", refreshSession);
    };
  }, []);

  const logout = () => {
    clearAuthSession();
    navigate({ to: "/login", replace: true });
    toast.success("Sessão encerrada.");
  };

  const runSearch = () => {
    const value = query.trim().toLowerCase();
    const homeRoute = getDefaultRouteForSession(session);
    if (!value) {
      navigate({ to: homeRoute });
      return;
    }

    const routes = [
      { terms: ["cliente", "crm", "cpf", "cnpj"], to: "/clients" },
      { terms: ["venda", "comercial", "vendedor", "lead"], to: "/sales" },
      { terms: ["financeiro", "despesa", "receita", "conta"], to: "/financial" },
      { terms: ["banco", "c6", "pix", "transferencia", "extrato"], to: "/bank" },
      { terms: ["caixa", "fluxo"], to: "/cashflow" },
      { terms: ["relatorio", "relatorio", "pdf", "excel"], to: "/reports" },
      { terms: ["alerta", "notificacao", "notificacao"], to: "/alerts" },
      { terms: ["meta", "indicador"], to: "/goals" },
      { terms: ["servico", "servico", "produto"], to: "/services" },
      { terms: ["usuario", "usuario", "permissao", "permissao"], to: "/users" },
    ] as const;

    const match = routes
      .filter((route) => canAccessRoute(session, route.to))
      .find((route) => route.terms.some((term) => value.includes(term)));
    navigate({ to: (match?.to ?? homeRoute) as AppRoutePath });
    toast.info(
      match ? "Busca direcionada para o módulo certo." : "Nenhum módulo específico encontrado.",
    );
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border/60 bg-background/85 px-3 backdrop-blur-xl sm:h-16 sm:gap-3 sm:px-4 md:px-6">
      <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
      <div className="hidden flex-1 md:block">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar clientes, vendas, relatórios..."
            className="h-9 border-border/60 bg-muted/40 pl-9 text-sm"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") runSearch();
            }}
          />
        </div>
      </div>
      <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
        <Button variant="ghost" size="icon" onClick={() => setDark(!dark)} aria-label="Tema">
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notificações"
          onClick={() =>
            navigate({
              to: canAccessRoute(session, "/alerts")
                ? "/alerts"
                : getDefaultRouteForSession(session),
            })
          }
        >
          <Bell className="h-4 w-4" />
          {unreadAlerts > 0 && (
            <Badge className="absolute -right-0.5 -top-0.5 h-4 min-w-4 justify-center rounded-full bg-primary px-1 text-[10px] tabular-nums text-primary-foreground">
              {unreadAlerts > 9 ? "9+" : unreadAlerts}
            </Badge>
          )}
        </Button>
        <div className="ml-1 flex min-w-0 items-center gap-2 rounded-full border border-border/60 bg-card/60 py-1 pl-1 pr-1 sm:ml-2 sm:pr-3">
          <div className="grid h-8 w-8 place-items-center overflow-hidden rounded-full border border-primary/30 bg-black shadow-glow">
            <img
              src="/va-consultoria-mark.png"
              alt="VA Consultoria"
              className="h-6 w-6 object-contain"
              draggable={false}
            />
          </div>
          <div className="hidden text-left leading-tight md:block">
            <div className="max-w-28 truncate text-xs font-medium">
              {session?.name ?? "VA Consultoria"}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {session?.role ?? "Acesso seguro"}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" aria-label="Sair" onClick={logout}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
