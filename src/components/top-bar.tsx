import { useEffect, useState } from "react";
import { Moon, Sun, Search, Bell } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export function TopBar() {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl md:px-6">
      <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
      <div className="hidden flex-1 md:block">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar clientes, vendas, relatórios..." className="h-9 border-border/60 bg-muted/40 pl-9 text-sm" />
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => setDark(!dark)} aria-label="Tema">
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificações">
          <Bell className="h-4 w-4" />
          <Badge className="absolute -right-0.5 -top-0.5 h-4 min-w-4 justify-center rounded-full bg-primary px-1 text-[10px] tabular-nums text-primary-foreground">6</Badge>
        </Button>
        <div className="ml-2 flex items-center gap-2 rounded-full border border-border/60 bg-card/60 py-1 pl-1 pr-3">
          <div className="grid h-7 w-7 place-items-center rounded-full gradient-primary text-xs font-semibold text-primary-foreground">VA</div>
          <div className="hidden text-left leading-tight md:block">
            <div className="text-xs font-medium">Vinícius A.</div>
            <div className="text-[10px] text-muted-foreground">Administrador</div>
          </div>
        </div>
      </div>
    </header>
  );
}
