import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Wallet, TrendingUp, LineChart, ShoppingCart, Users,
  Target, FileBarChart, Bell, Lightbulb, UserCog, Briefcase, Settings, PiggyBank, Calculator,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";

const groups = [
  {
    label: "Visão geral",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Insights", url: "/insights", icon: Lightbulb },
      { title: "Alertas", url: "/alerts", icon: Bell },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Gestão Financeira", url: "/financial", icon: Wallet },
      { title: "Fluxo de Caixa", url: "/cashflow", icon: TrendingUp },
      { title: "Previsibilidade", url: "/forecast", icon: LineChart },
      { title: "Simulador", url: "/simulator", icon: Calculator },
      { title: "Gestão Pessoal", url: "/personal", icon: PiggyBank },
    ],
  },
  {
    label: "Comercial",
    items: [
      { title: "Vendas", url: "/sales", icon: ShoppingCart },
      { title: "CRM / Clientes", url: "/clients", icon: Users },
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
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-5">
        <Link to="/dashboard" className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg gradient-primary font-display text-base font-bold text-primary-foreground shadow-glow">
            VA
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-display text-sm font-semibold text-sidebar-foreground">VA Consultoria</span>
              <span className="text-[10px] uppercase tracking-widest text-sidebar-foreground/50">Manager</span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        {groups.map((group) => (
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
                      <SidebarMenuButton asChild isActive={active} className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-primary data-[active=true]:font-medium hover:bg-sidebar-accent/60">
                        <Link to={item.url} className="flex items-center gap-3">
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
