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
import { Plus, Briefcase, RotateCcw, Pencil, Trash2, Search } from "lucide-react";
import { services as initialServices, formatBRL } from "@/lib/mock-data";
import { usePersistentState } from "@/hooks/use-persistent-state";

export const Route = createFileRoute("/_app/services")({
  component: Services,
  head: () => ({ meta: [{ title: "Serviços - VA" }] }),
});

type Service = (typeof initialServices)[number] & { cost?: number; description?: string };

const legacyCommissionValues: Record<string, { from: number; to: number }> = {
  "Limpa Nome": { from: 15, to: 180 },
  "Aumento de Score": { from: 12, to: 120 },
  "Consultoria Bancária": { from: 18, to: 450 },
  "Consultoria de Crédito": { from: 15, to: 270 },
  "Reabilitação Financeira": { from: 20, to: 640 },
};

const defaultServiceCosts: Record<string, number> = {
  "Limpa Nome": 360,
  "Aumento de Score": 210,
  "Consultoria Bancária": 780,
  "Consultoria de Crédito": 520,
  "Reabilitação Financeira": 980,
};

function parseCurrencyInput(value: string) {
  const normalized = value.trim().replace(/[^\d,.]/g, "");
  if (!normalized) return 0;
  if (normalized.includes(",")) {
    return Number(normalized.replace(/\./g, "").replace(",", ".")) || 0;
  }
  return Number(normalized.replace(/\./g, "")) || 0;
}

function formatCurrencyInput(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

const emptyForm = {
  id: "",
  name: "",
  price: "",
  cost: "",
  commission: "",
  category: "",
  status: "ativo",
  sold: "0",
  description: "",
};

const serviceStatusOptions = ["ativo", "inativo"];

function Services() {
  const [services, setServices] = usePersistentState<Service[]>(
    "va-manager:services",
    initialServices,
  );
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    setServices((current) => {
      let changed = false;
      const migrated = current.map((service) => {
        const legacy = legacyCommissionValues[service.name];
        const defaultCost = defaultServiceCosts[service.name];
        const nextService = { ...service };

        if (legacy && service.commission === legacy.from) {
          nextService.commission = legacy.to;
          changed = true;
        }

        if (typeof nextService.cost !== "number" && typeof defaultCost === "number") {
          nextService.cost = defaultCost;
          changed = true;
        }

        return nextService;
      });

      return changed ? migrated : current;
    });
  }, [setServices]);

  const filteredServices = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services;
    return services.filter((service) =>
      [service.name, service.category, service.status, service.description ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [query, services]);

  const updateForm = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const openCreate = () => {
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (service: Service) => {
    setForm({
      id: service.id,
      name: service.name,
      price: formatCurrencyInput(service.price),
      cost: formatCurrencyInput(service.cost ?? 0),
      commission: formatCurrencyInput(service.commission),
      category: service.category,
      status: service.status,
      sold: String(service.sold),
      description: service.description ?? "",
    });
    setOpen(true);
  };

  const submitService = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const service: Service = {
      id: form.id || `s-${Date.now()}`,
      name: form.name.trim(),
      price: parseCurrencyInput(form.price),
      cost: parseCurrencyInput(form.cost),
      commission: parseCurrencyInput(form.commission),
      category: form.category.trim() || "Consultoria",
      status: form.status.trim() || "ativo",
      sold: Number(form.sold) || 0,
      description: form.description.trim(),
    };
    if (!service.name) return;

    setServices((current) =>
      form.id
        ? current.map((item) => (item.id === form.id ? service : item))
        : [service, ...current],
    );
    toast.success(form.id ? "Serviço atualizado." : "Serviço cadastrado.");
    setOpen(false);
    setForm(emptyForm);
  };

  const removeService = (id: string) => {
    setServices((current) => current.filter((service) => service.id !== id));
    toast.success("Serviço removido.");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Serviços e Produtos"
        subtitle="Catálogo, valores, custos, comissão e histórico comercial"
        action={
          <>
            <Button variant="outline" size="sm" onClick={() => setServices(initialServices)}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Restaurar
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <PremiumActionButton
                  icon={<Plus />}
                  title="Novo serviço"
                  subtitle="Cadastrar oferta"
                  size="sm"
                  onClick={openCreate}
                />
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <form onSubmit={submitService}>
                  <DialogHeader>
                    <DialogTitle>{form.id ? "Editar serviço" : "Novo serviço"}</DialogTitle>
                    <DialogDescription>
                      O catálogo fica salvo neste navegador e alimenta vendas e relatórios. Use
                      valores como 5000, 5.000 ou 5.000,50.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <ServiceField
                      label="Nome"
                      value={form.name}
                      onChange={(v) => updateForm("name", v)}
                      required
                    />
                    <ServiceField
                      label="Categoria"
                      value={form.category}
                      onChange={(v) => updateForm("category", v)}
                    />
                    <ServiceField
                      label="Valor"
                      value={form.price}
                      onChange={(v) => updateForm("price", v)}
                      onBlur={() =>
                        updateForm("price", formatCurrencyInput(parseCurrencyInput(form.price)))
                      }
                      placeholder="Ex: 1.200"
                    />
                    <ServiceField
                      label="Custo do serviço (R$)"
                      value={form.cost}
                      onChange={(v) => updateForm("cost", v)}
                      onBlur={() =>
                        updateForm("cost", formatCurrencyInput(parseCurrencyInput(form.cost)))
                      }
                      placeholder="Ex: 360 ou 360,50"
                    />
                    <ServiceField
                      label="Comissão (R$)"
                      value={form.commission}
                      onChange={(v) => updateForm("commission", v)}
                      onBlur={() =>
                        updateForm(
                          "commission",
                          formatCurrencyInput(parseCurrencyInput(form.commission)),
                        )
                      }
                      placeholder="Ex: 250 ou 250,50"
                    />
                    <OptionSelectField
                      label="Status"
                      value={form.status}
                      onChange={(v) => updateForm("status", v)}
                      options={serviceStatusOptions}
                    />
                    <ServiceField
                      label="Vendidos no mês"
                      type="number"
                      value={form.sold}
                      onChange={(v) => updateForm("sold", v)}
                    />
                    <div className="md:col-span-2">
                      <ServiceField
                        label="Descrição"
                        value={form.description}
                        onChange={(v) => updateForm("description", v)}
                      />
                    </div>
                  </div>
                  <DialogFooter className="mt-6">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" className="gradient-primary text-primary-foreground">
                      Salvar serviço
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <Card className="border-border/60 bg-card/60 p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar serviço, categoria ou status..."
            className="pl-8"
          />
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredServices.map((s) => (
          <Card
            key={s.id}
            className="group border-border/60 bg-card/60 p-5 transition hover:border-primary/40 hover:shadow-elegant"
          >
            <div className="flex items-start justify-between">
              <div className="grid h-11 w-11 place-items-center rounded-xl gradient-primary text-primary-foreground shadow-glow">
                <Briefcase className="h-5 w-5" />
              </div>
              <Badge className="bg-success/15 text-success hover:bg-success/15">{s.status}</Badge>
            </div>
            <h3 className="mt-4 font-display text-base font-semibold">{s.name}</h3>
            <p className="text-xs text-muted-foreground">{s.category}</p>
            {s.description && (
              <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{s.description}</p>
            )}
            <div className="mt-4 flex items-baseline justify-between">
              <span className="font-display text-2xl font-semibold text-gradient-primary">
                {formatBRL(s.price)}
              </span>
              <span className="text-xs text-muted-foreground">
                Comissão {formatBRL(s.commission)}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <ServiceMetric label="Custo" value={formatBRL(s.cost ?? 0)} />
              <ServiceMetric
                label="Lucro estimado"
                value={formatBRL(Math.max(s.price - (s.cost ?? 0) - s.commission, 0))}
              />
              <ServiceMetric
                label="Margem"
                value={`${Math.max(
                  Math.round(
                    ((s.price - (s.cost ?? 0) - s.commission) / Math.max(s.price, 1)) * 100,
                  ),
                  0,
                )}%`}
              />
              <ServiceMetric label="Vendidos" value={`${s.sold} un.`} />
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => openEdit(s)}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Editar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => removeService(s.id)}>
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Excluir
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ServiceField({
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

function ServiceMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-secondary/35 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium text-foreground">{value}</p>
    </div>
  );
}
