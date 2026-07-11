import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Wallet,
  TrendingUp,
  ShoppingCart,
  Users,
  Target,
  FileBarChart,
  Bell,
  Lightbulb,
  UserCog,
  Briefcase,
  Settings,
  CalendarDays,
  Landmark,
  Trophy,
  FileText,
  Banknote,
  BadgeDollarSign,
  BrainCircuit,
  Gauge,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { getAuthSession, type AuthSession } from "@/lib/auth";
import { canAccessRoute, getDefaultRouteForSession, type AppRoutePath } from "@/lib/permissions";

const groups = [
  {
    label: "Visão geral",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Calendário", url: "/calendar", icon: CalendarDays },
      { title: "Insights", url: "/insights", icon: Lightbulb },
      { title: "Alertas", url: "/alerts", icon: Bell },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Gestão Financeira", url: "/financial", icon: Wallet },
      { title: "Banco C6 PJ", url: "/bank", icon: Banknote },
      { title: "Fluxo de Caixa", url: "/cashflow", icon: TrendingUp },
      { title: "Investimentos", url: "/investments", icon: Landmark },
    ],
  },
  {
    label: "Comercial",
    items: [
      { title: "Vendas", url: "/sales", icon: ShoppingCart },
      { title: "Clientes", url: "/clients", icon: Users },
      { title: "Contratos", url: "/contracts", icon: FileText },
      { title: "Credit Intelligence", url: "/credit-intelligence", icon: BrainCircuit },
      { title: "Rating", url: "/rating", icon: Gauge },
      { title: "Ranking", url: "/ranking", icon: Trophy },
      { title: "Comissões", url: "/commissions", icon: BadgeDollarSign },
      { title: "Serviços", url: "/services", icon: Briefcase },
      { title: "Metas", url: "/goals", icon: Target },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Relatórios", url: "/reports", icon: FileBarChart },
      { title: "Usuários", url: "/users", icon: UserCog },
      { title: "Configurações", url: "/settings", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const [session, setSession] = useState<AuthSession | null>(null);

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

  const visibleGroups = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => canAccessRoute(session, item.url)),
        }))
        .filter((group) => group.items.length > 0),
    [session],
  );
  const homeRoute = getDefaultRouteForSession(session);

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-5">
        <Link to={homeRoute} className={collapsed ? "flex justify-center" : "flex flex-col gap-2"}>
          <div
            className={
              collapsed
                ? "grid h-10 w-10 place-items-center overflow-hidden rounded-xl border border-sidebar-border bg-white shadow-sm transition hover:border-primary/35 hover:shadow-glow dark:bg-black"
                : "flex h-16 items-center overflow-hidden rounded-2xl border border-sidebar-border bg-white px-3 shadow-sm transition hover:border-primary/30 hover:shadow-[0_0_35px_hsl(24_100%_57%/0.14)] dark:bg-black/70 dark:shadow-[0_18px_38px_-32px_rgba(0,0,0,0.9)]"
            }
          >
            <img
              src={collapsed ? "/va-consultoria-mark.png" : "/va-consultoria-logo-cropped.png"}
              alt="VA Consultoria"
              className={collapsed ? "h-8 w-8 object-contain" : "h-14 w-full object-contain"}
              draggable={false}
            />
          </div>
          {!collapsed && (
            <div className="flex items-center justify-between gap-2 px-1 leading-tight">
              <span className="text-[10px] uppercase tracking-widest text-sidebar-foreground/50">
                Manager
              </span>
              <span className="rounded-full border border-sidebar-border bg-sidebar-accent/40 px-2 py-0.5 text-[10px] font-medium text-sidebar-foreground/70 transition hover:border-primary/25 hover:bg-primary/10 hover:text-primary">
                ERP & CRM
              </span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        {visibleGroups.map((group) => (
          <SidebarGroup key={group.label}>
            {!collapsed && (
              <SidebarGroupLabel className="text-[10px] font-medium uppercase tracking-widest text-sidebar-foreground/40">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = path === item.url;
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        className="text-sidebar-foreground/90 hover:bg-sidebar-accent/60 hover:text-sidebar-primary data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-primary"
                      >
                        <Link
                          to={item.url as AppRoutePath}
                          className="flex items-center gap-3"
                          onClick={() => {
                            if (isMobile) setOpenMobile(false);
                          }}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          {!collapsed && <span className="text-sm">{item.title}</span>}
                          {active && !collapsed && (
                            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-glow" />
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
