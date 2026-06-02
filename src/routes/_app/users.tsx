import { createFileRoute } from "@tanstack/react-router";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { OptionSelectField } from "@/components/option-select-field";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PremiumActionButton } from "@/components/ui/premium-action-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, UserCog, Pencil, Trash2, RotateCcw, Search } from "lucide-react";
import { users as initialUsers } from "@/lib/mock-data";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { defaultUserPassword } from "@/lib/auth";
import { areUsersEqual, fetchCloudUsers, mergeUsers, saveCloudUsers } from "@/lib/cloud-users";

export const Route = createFileRoute("/_app/users")({
  component: UsersPage,
  head: () => ({ meta: [{ title: "Usuários - VA" }] }),
});

type UserItem = (typeof initialUsers)[number] & { password?: string };

const roles = ["Administrador", "Financeiro", "Comercial", "Operacional", "Somente leitura"];
const userStatusOptions = ["ativo", "inativo"];
const emptyForm = {
  id: "",
  name: "",
  email: "",
  password: defaultUserPassword,
  role: "Comercial",
  status: "ativo",
  lastAccess: "agora",
};

function UsersPage() {
  const [users, setUsers, usersReady] = usePersistentState<UserItem[]>(
    "va-manager:users",
    initialUsers,
  );
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!usersReady) return;

    let cancelled = false;

    const loadCloudUsers = async () => {
      try {
        const cloudUsers = await fetchCloudUsers();
        if (cancelled) return;

        const mergedUsers = mergeUsers(users, cloudUsers) as UserItem[];
        if (!areUsersEqual(users, mergedUsers)) {
          setUsers(mergedUsers);
        }
      } catch (error) {
        console.warn("Could not load cloud users", error);
      }
    };

    void loadCloudUsers();

    return () => {
      cancelled = true;
    };
  }, [setUsers, users, usersReady]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) =>
      [user.name, user.email, user.role, user.status].join(" ").toLowerCase().includes(q),
    );
  }, [query, users]);

  const updateForm = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const openCreate = () => {
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (user: UserItem) => {
    setForm({ ...user, password: user.password || defaultUserPassword });
    setOpen(true);
  };

  const persistUsers = (nextUsers: UserItem[]) => {
    setUsers(nextUsers);
    void saveCloudUsers(nextUsers).catch((error) => {
      console.warn("Could not save cloud users", error);
      toast.error("Usuário salvo neste navegador, mas a sincronização em nuvem falhou.");
    });
  };

  const submitUser = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const user: UserItem = {
      id: form.id || `u-${Date.now()}`,
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password.trim() || defaultUserPassword,
      role: form.role,
      status: form.status,
      lastAccess: form.lastAccess || "agora",
    };
    if (!user.name || !user.email) return;
    const nextUsers = form.id
      ? users.map((item) => (item.id === form.id ? user : item))
      : [user, ...users];
    persistUsers(nextUsers);
    toast.success(form.id ? "Usuário atualizado." : "Usuário criado.");
    setOpen(false);
  };

  const toggleStatus = (id: string) => {
    persistUsers(
      users.map((user) =>
        user.id === id
          ? { ...user, status: user.status === "ativo" ? "inativo" : "ativo" }
          : user,
      ),
    );
    toast.success("Status do usuário alterado.");
  };

  const removeUser = (id: string) => {
    persistUsers(users.filter((user) => user.id !== id));
    toast.success("Usuário excluído.");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuários e Permissões"
        subtitle="Gerencie acessos, níveis de permissão e status da equipe"
        action={
          <>
            <Button variant="outline" size="sm" onClick={() => persistUsers(initialUsers)}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Restaurar
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <PremiumActionButton
                  icon={<Plus />}
                  title="Novo usuário"
                  subtitle="Criar acesso"
                  size="sm"
                  onClick={openCreate}
                />
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <form onSubmit={submitUser}>
                  <DialogHeader>
                    <DialogTitle>{form.id ? "Editar usuário" : "Novo usuário"}</DialogTitle>
                    <DialogDescription>
                      Os perfis simulam a futura camada multiusuário com JWT e permissões reais.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <UserField
                      label="Nome"
                      value={form.name}
                      onChange={(v) => updateForm("name", v)}
                      required
                    />
                    <UserField
                      label="E-mail"
                      type="email"
                      value={form.email}
                      onChange={(v) => updateForm("email", v)}
                      required
                    />
                    <UserField
                      label="Senha de acesso"
                      type="password"
                      value={form.password}
                      onChange={(v) => updateForm("password", v)}
                      required
                    />
                    <OptionSelectField
                      label="Permissão"
                      value={form.role}
                      onChange={(v) => updateForm("role", v)}
                      options={roles}
                    />
                    <OptionSelectField
                      label="Status"
                      value={form.status}
                      onChange={(v) => updateForm("status", v)}
                      options={userStatusOptions}
                    />
                  </div>
                  <DialogFooter className="mt-6">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" className="gradient-primary text-primary-foreground">
                      Salvar usuário
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-5">
        {roles.map((r) => (
          <Card key={r} className="border-border/60 bg-card/60 p-4 text-center">
            <UserCog className="mx-auto h-5 w-5 text-primary" />
            <p className="mt-2 text-xs font-medium">{r}</p>
            <p className="font-display text-xl font-semibold">
              {users.filter((u) => u.role === r).length || 0}
            </p>
          </Card>
        ))}
      </div>

      <Card className="border-border/60 bg-card/60 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-base font-semibold">Equipe cadastrada</h3>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar usuário..."
              className="h-9 w-64 pl-8"
            />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Usuário</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Senha</TableHead>
              <TableHead>Permissão</TableHead>
              <TableHead>Último acesso</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((u) => (
              <TableRow key={u.id} className="hover:bg-muted/30">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-xs font-semibold">
                      {u.name
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                    </div>
                    <span className="font-medium">{u.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {u.password ? "Definida" : "Senha padrão"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="border-border/60">
                    {u.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{u.lastAccess}</TableCell>
                <TableCell>
                  <button onClick={() => toggleStatus(u.id)}>
                    <Badge
                      className={
                        u.status === "ativo"
                          ? "bg-success/15 text-success hover:bg-success/15"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {u.status}
                    </Badge>
                  </button>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEdit(u)}
                    aria-label="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeUser(u.id)}
                    aria-label="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function UserField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
