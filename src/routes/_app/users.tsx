import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, UserCog } from "lucide-react";
import { users } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/users")({
  component: UsersPage,
  head: () => ({ meta: [{ title: "Usuários — VA" }] }),
});

const roles = ["Administrador", "Financeiro", "Comercial", "Operacional", "Somente leitura"];

function UsersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuários e Permissões"
        subtitle="Gerencie acessos e níveis de permissão"
        action={<Button className="gradient-primary text-primary-foreground"><Plus className="mr-2 h-4 w-4" />Novo usuário</Button>}
      />

      <div className="grid gap-4 md:grid-cols-5">
        {roles.map((r) => (
          <Card key={r} className="border-border/60 bg-card/60 p-4 text-center">
            <UserCog className="mx-auto h-5 w-5 text-primary" />
            <p className="mt-2 text-xs font-medium">{r}</p>
            <p className="text-xl font-display font-semibold">{users.filter(u => u.role === r).length || 0}</p>
          </Card>
        ))}
      </div>

      <Card className="border-border/60 bg-card/60 p-5">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Usuário</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Permissão</TableHead>
              <TableHead>Último acesso</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id} className="hover:bg-muted/30">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-xs font-semibold">{u.name.split(" ").map(n=>n[0]).slice(0,2).join("")}</div>
                    <span className="font-medium">{u.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell><Badge variant="outline" className="border-border/60">{u.role}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">{u.lastAccess}</TableCell>
                <TableCell>
                  <Badge className={u.status === "ativo" ? "bg-success/15 text-success hover:bg-success/15" : "bg-muted text-muted-foreground"}>{u.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
