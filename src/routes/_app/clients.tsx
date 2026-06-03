import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { CollaboratorAvatar } from "@/components/collaborator-avatar";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Camera,
  Users,
  UserPlus,
  AlertCircle,
  DollarSign,
  Search,
  Plus,
  RotateCcw,
  FileText,
} from "lucide-react";
import {
  clients as initialClients,
  sales as initialSales,
  services as initialServices,
  sellers as initialCollaborators,
  formatBRL,
} from "@/lib/mock-data";
import {
  buildCollaboratorMap,
  collaboratorInitials,
  normalizeCollaboratorName,
} from "@/lib/collaborators";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { useSyncedReceivables } from "@/hooks/use-synced-receivables";
import {
  createReceivables,
  formatCurrencyInput,
  parseCurrencyInput,
  paymentMethods,
  type PaymentMethod,
} from "@/lib/receivables";
import { formatLocalDateBR, toLocalISODate } from "@/lib/date-utils";

export const Route = createFileRoute("/_app/clients")({
  component: Clients,
  head: () => ({ meta: [{ title: "CRM - Clientes - VA" }] }),
});

const leadOrigins = ["Trafego pago", "Trafego organico", "Indicação"];
const clientStatusOptions = ["ativo", "inadimplente", "inativo"];
const collaboratorRoleOptions = ["Comercial", "Financeiro", "Operacional", "Administrativo"];
const installmentOptions = Array.from({ length: 12 }, (_, index) => String(index + 1));
type Client = (typeof initialClients)[number] & {
  address?: string;
  seller?: string;
  paymentMethod?: PaymentMethod;
  installments?: number;
};
type Collaborator = (typeof initialCollaborators)[number] & { role?: string; photoUrl?: string };

function Clients() {
  const [clients, setClients] = usePersistentState<Client[]>("va-manager:clients", initialClients);
  const [sales] = usePersistentState("va-manager:sales", initialSales);
  const [services] = usePersistentState("va-manager:services", initialServices);
  const [collaborators, setCollaborators] = usePersistentState<Collaborator[]>(
    "va-manager:collaborators",
    initialCollaborators,
  );
  const [receivables, setReceivables] = useSyncedReceivables({ sales });
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [collaboratorOpen, setCollaboratorOpen] = useState(false);
  const [collaboratorForm, setCollaboratorForm] = useState({
    name: "",
    role: "Comercial",
    photoUrl: "",
  });
  const [form, setForm] = useState({
    name: "",
    doc: "",
    phone: "",
    email: "",
    address: "",
    service: "",
    origin: "",
    seller: "",
    paymentMethod: "avista" as PaymentMethod,
    installments: "1",
    status: "ativo",
    total: "0",
  });

  const filteredClients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return clients;

    return clients.filter((client) =>
      [
        client.name,
        client.doc,
        client.phone,
        client.email,
        "address" in client ? String(client.address) : "",
        client.service,
        client.origin,
        "seller" in client ? String(client.seller) : "",
        client.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [clients, query]);

  const ativos = clients.filter((client) => client.status === "ativo").length;
  const inad = clients.filter((client) => client.status === "inadimplente").length;
  const total = clients.reduce((sum, client) => sum + client.total, 0);
  const predictableRevenue = receivables
    .filter((item) => item.status === "previsto")
    .reduce((sum, item) => sum + item.amount, 0);
  const serviceOptions = useMemo(
    () => services.filter((service) => service.status !== "inativo"),
    [services],
  );
  const collaboratorOptions = useMemo(
    () => collaborators.filter((collaborator) => collaborator.name.trim()),
    [collaborators],
  );
  const collaboratorsByName = useMemo(
    () => buildCollaboratorMap(collaboratorOptions),
    [collaboratorOptions],
  );

  const updateForm = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const selectService = (serviceName: string) => {
    const selectedService = serviceOptions.find((service) => service.name === serviceName);
    setForm((current) => ({
      ...current,
      service: serviceName,
      total: formatCurrencyInput(selectedService?.price ?? 0),
    }));
  };

  const selectPaymentMethod = (method: string) => {
    const paymentMethod = method as PaymentMethod;
    setForm((current) => ({
      ...current,
      paymentMethod,
      installments: paymentMethod === "credito" ? current.installments : "1",
      total: paymentMethod === "prazo_pix" ? "697,00" : current.total,
    }));
  };

  const submitCollaborator = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = collaboratorForm.name.trim();
    if (!name) return;
    setCollaborators((current) => [
      {
        id: `col-${Date.now()}`,
        name,
        avatar: collaboratorInitials(name),
        role: collaboratorForm.role.trim() || "Comercial",
        photoUrl: collaboratorForm.photoUrl,
        sales: 0,
        revenue: 0,
      },
      ...current,
    ]);
    setCollaboratorForm({ name: "", role: "Comercial", photoUrl: "" });
    setCollaboratorOpen(false);
    toast.success("Colaborador cadastrado.");
  };

  const handleCollaboratorPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () =>
      setCollaboratorForm((current) => ({
        ...current,
        photoUrl: String(reader.result ?? ""),
      }));
    reader.readAsDataURL(file);
  };

  const submitClient = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) return;
    const id = `c-${Date.now()}`;
    const totalValue = parseCurrencyInput(form.total);
    const service = form.service.trim() || serviceOptions[0]?.name || "Consultoria de Credito";
    const seller = form.seller.trim() || collaboratorOptions[0]?.name || "Equipe VA";
    const origin = form.origin.trim() || leadOrigins[0];
    const paymentMethod = form.paymentMethod as PaymentMethod;
    const installments = Number(form.installments) || 1;
    const saleDate = new Date();

    setClients((current) => [
      {
        id,
        name,
        doc: form.doc.trim() || "Não informado",
        phone: form.phone.trim() || "Não informado",
        email: form.email.trim() || "sem-email@vaconsultoria.com",
        address: form.address.trim() || "Não informado",
        service,
        entryDate: toLocalISODate(saleDate),
        origin,
        seller,
        paymentMethod,
        installments: paymentMethod === "credito" ? installments : 1,
        status: form.status,
        total: totalValue,
      },
      ...current,
    ]);

    setForm({
      name: "",
      doc: "",
      phone: "",
      email: "",
      address: "",
      service: "",
      origin: "",
      seller: "",
      paymentMethod: "avista",
      installments: "1",
      status: "ativo",
      total: "0",
    });
    setOpen(false);
    toast.success("Cliente cadastrado. Registre uma venda para lançar receita.");
  };

  const toggleClientStatus = (id: string) => {
    setClients((current) =>
      current.map((client) =>
        client.id === id
          ? { ...client, status: client.status === "ativo" ? "inadimplente" : "ativo" }
          : client,
      ),
    );
    toast.success("Status do cliente alterado.");
  };

  const removeClient = (id: string) => {
    setClients((current) => current.filter((client) => client.id !== id));
    setReceivables((current) => current.filter((receivable) => receivable.sourceId !== id));
    toast.success("Cliente excluído.");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM - Clientes"
        subtitle="Base completa de clientes e historico de relacionamento"
        action={
          <>
            <Dialog open={collaboratorOpen} onOpenChange={setCollaboratorOpen}>
              <DialogTrigger asChild>
                <PremiumActionButton
                  icon={<UserPlus />}
                  title="Novo colaborador"
                  subtitle="Equipe comercial"
                  size="sm"
                />
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <form onSubmit={submitCollaborator}>
                  <DialogHeader>
                    <DialogTitle>Novo colaborador</DialogTitle>
                    <DialogDescription>
                      Colaboradores aparecem como responsáveis nas vendas e clientes.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="mt-5 grid gap-4">
                    <div className="flex items-center gap-3">
                      <CollaboratorAvatar
                        person={{
                          name: collaboratorForm.name || "VA",
                          photoUrl: collaboratorForm.photoUrl,
                        }}
                        className="h-14 w-14 text-sm"
                      />
                      <Label className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-xs hover:border-primary hover:text-primary">
                        <Camera className="h-3.5 w-3.5" />
                        Foto do colaborador
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleCollaboratorPhoto}
                        />
                      </Label>
                    </div>
                    <ClientField
                      label="Nome"
                      value={collaboratorForm.name}
                      onChange={(value) =>
                        setCollaboratorForm((current) => ({ ...current, name: value }))
                      }
                      required
                    />
                    <ClientSelectField
                      label="Função"
                      value={collaboratorForm.role}
                      onChange={(value) =>
                        setCollaboratorForm((current) => ({ ...current, role: value }))
                      }
                      options={collaboratorRoleOptions}
                      placeholder="Selecione a função"
                    />
                  </div>
                  <DialogFooter className="mt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCollaboratorOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" className="gradient-primary text-primary-foreground">
                      Salvar colaborador
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Button
              variant="outline"
              onClick={() => {
                setClients(initialClients);
                setReceivables([]);
                toast.success("Clientes de demonstração restaurados.");
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Restaurar demo
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <PremiumActionButton
                  icon={<Plus />}
                  title="Novo cliente"
                  subtitle="Cadastrar CRM"
                  size="sm"
                />
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <form onSubmit={submitClient}>
                  <DialogHeader>
                    <DialogTitle>Novo cliente</DialogTitle>
                    <DialogDescription>
                      O cadastro fica salvo neste navegador. Depois a mesma camada pode apontar para
                      API, Supabase ou PostgreSQL.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <ClientField
                      label="Nome"
                      value={form.name}
                      onChange={(value) => updateForm("name", value)}
                      required
                    />
                    <ClientField
                      label="CPF/CNPJ"
                      value={form.doc}
                      onChange={(value) => updateForm("doc", value)}
                    />
                    <ClientField
                      label="Telefone"
                      value={form.phone}
                      onChange={(value) => updateForm("phone", value)}
                    />
                    <ClientField
                      label="E-mail"
                      value={form.email}
                      onChange={(value) => updateForm("email", value)}
                      type="email"
                    />
                    <div className="md:col-span-2">
                      <ClientField
                        label="Endereço"
                        value={form.address}
                        onChange={(value) => updateForm("address", value)}
                        placeholder="Rua, número, bairro, cidade/UF"
                      />
                    </div>
                    <ClientSelectField
                      label="Serviço contratado"
                      value={form.service}
                      onChange={selectService}
                      placeholder="Selecione um serviço"
                      options={serviceOptions.map((service) => service.name)}
                    />
                    <ClientSelectField
                      label="Origem"
                      value={form.origin}
                      onChange={(value) => updateForm("origin", value)}
                      placeholder="Selecione a origem"
                      options={leadOrigins}
                    />
                    <ClientSelectField
                      label="Vendedor responsável"
                      value={form.seller}
                      onChange={(value) => updateForm("seller", value)}
                      placeholder="Selecione o responsável"
                      options={collaboratorOptions.map((collaborator) => collaborator.name)}
                    />
                    <ClientSelectField
                      label="Forma de pagamento"
                      value={form.paymentMethod}
                      onChange={selectPaymentMethod}
                      placeholder="Selecione a forma"
                      options={paymentMethods.map((method) => method.value)}
                      getLabel={(value) =>
                        paymentMethods.find((method) => method.value === value)?.label ?? value
                      }
                    />
                    {form.paymentMethod === "credito" && (
                      <ClientSelectField
                        label="Parcelamento no crédito"
                        value={form.installments}
                        onChange={(value) => updateForm("installments", value)}
                        placeholder="Quantidade de parcelas"
                        options={installmentOptions}
                        getLabel={(value) => `${value}x`}
                      />
                    )}
                    <ClientSelectField
                      label="Status"
                      value={form.status}
                      onChange={(value) => updateForm("status", value)}
                      options={clientStatusOptions}
                      placeholder="Selecione o status"
                    />
                    <ClientField
                      label="Valor total gerado"
                      value={form.total}
                      onChange={(value) => updateForm("total", value)}
                      onBlur={() =>
                        updateForm("total", formatCurrencyInput(parseCurrencyInput(form.total)))
                      }
                      placeholder="Ex: 697,00"
                    />
                    <div className="md:col-span-2">
                      <PaymentPreview
                        total={parseCurrencyInput(form.total)}
                        method={form.paymentMethod}
                        installments={Number(form.installments) || 1}
                      />
                    </div>
                  </div>
                  <DialogFooter className="mt-6">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" className="gradient-primary text-primary-foreground">
                      Salvar cliente
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <KpiCard
          label="Total de clientes"
          value={String(clients.length)}
          icon={Users}
          accent="primary"
        />
        <KpiCard
          label="Clientes ativos"
          value={String(ativos)}
          delta={12}
          icon={UserPlus}
          accent="success"
        />
        <KpiCard
          label="Inadimplentes"
          value={String(inad)}
          delta={-2}
          icon={AlertCircle}
          accent="destructive"
        />
        <KpiCard label="LTV total" value={formatBRL(total)} icon={DollarSign} accent="info" />
        <KpiCard
          label="Receita previsível"
          value={formatBRL(predictableRevenue)}
          icon={DollarSign}
          accent="primary"
          hint="parcelas futuras"
        />
      </div>

      <Card className="border-border/60 bg-card/60 p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold">Colaboradores comerciais</h3>
            <p className="text-xs text-muted-foreground">
              Responsáveis disponíveis no cadastro de clientes e vendas
            </p>
          </div>
          <Badge variant="outline" className="border-border/60">
            {collaboratorOptions.length} ativos
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {collaboratorOptions.map((collaborator) => (
            <Badge
              key={collaborator.id}
              variant="outline"
              className="gap-2 border-border/60 px-2 py-1"
            >
              <CollaboratorAvatar person={collaborator} className="h-5 w-5 text-[10px]" />
              {collaborator.name}
            </Badge>
          ))}
        </div>
      </Card>

      <Card className="border-border/60 bg-card/60 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-base font-semibold">Base de clientes</h3>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
              className="h-9 w-64 pl-8"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-border/60">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Cliente</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Endereço</TableHead>
                <TableHead>Serviço</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Entrada</TableHead>
                <TableHead className="text-right">LTV</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map((client) => {
                const responsibleName = client.seller ?? "Equipe VA";
                const responsible = collaboratorsByName.get(
                  normalizeCollaboratorName(responsibleName),
                ) ?? {
                  name: responsibleName,
                };

                return (
                  <TableRow key={client.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-xs font-semibold">
                          {client.name
                            .split(" ")
                            .map((part) => part[0])
                            .slice(0, 2)
                            .join("")}
                        </div>
                        <span className="font-medium">{client.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {client.doc}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {client.phone}
                      <br />
                      {client.email}
                    </TableCell>
                    <TableCell className="max-w-56 text-xs text-muted-foreground">
                      {"address" in client && client.address ? client.address : "Não informado"}
                    </TableCell>
                    <TableCell>{client.service}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-border/60 text-xs">
                        {client.origin}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CollaboratorAvatar person={responsible} className="h-7 w-7 text-[11px]" />
                        <span>{responsibleName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-border/60 text-xs">
                        {paymentMethods.find((method) => method.value === client.paymentMethod)
                          ?.label ?? "À vista"}
                        {client.paymentMethod === "credito" && client.installments
                          ? ` ${client.installments}x`
                          : ""}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatLocalDateBR(client.entryDate)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatBRL(client.total)}
                    </TableCell>
                    <TableCell>
                      <button onClick={() => toggleClientStatus(client.id)}>
                        <Badge
                          className={
                            client.status === "ativo"
                              ? "bg-success/15 text-success hover:bg-success/15"
                              : "bg-destructive/15 text-destructive hover:bg-destructive/15"
                          }
                        >
                          {client.status}
                        </Badge>
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to="/contracts" search={{ client: client.id }}>
                            <FileText className="mr-1 h-3.5 w-3.5" />
                            Contrato
                          </Link>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => removeClient(client.id)}>
                          Excluir
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredClients.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={12}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    Nenhum cliente encontrado para a busca atual.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function ClientField({
  label,
  value,
  onChange,
  onBlur,
  type = "text",
  required = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
    </div>
  );
}

function ClientSelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  getLabel = (option) => option,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
  getLabel?: (value: string) => string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {getLabel(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function PaymentPreview({
  total,
  method,
  installments,
}: {
  total: number;
  method: PaymentMethod;
  installments: number;
}) {
  const schedule = createReceivables({
    sourceId: "preview",
    sourceType: "client",
    client: "Cliente",
    service: "Serviço",
    seller: "Responsável",
    origin: "Origem",
    total,
    method,
    installments,
    saleDate: new Date(),
  });

  return (
    <div className="rounded-lg border border-border/60 bg-secondary/35 p-3">
      <p className="text-xs font-medium">Resumo do recebimento</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {schedule.map((item) => (
          <div key={item.id} className="rounded-md bg-background/50 px-3 py-2 text-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-medium tabular-nums">{formatBRL(item.amount)}</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {formatLocalDateBR(item.dueDate)} ·{" "}
              {item.status === "recebido" ? "receita recebida" : "receita prevista"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
