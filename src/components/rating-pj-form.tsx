import { ChangeEvent, useEffect, useRef, useState, type ReactNode } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  type RatingBankAccount,
  type RatingFileInfo,
  type RatingLogin,
  type RatingPJForm,
  type RatingReference,
  type RatingVehicle,
} from "@/lib/rating";
import { formatBrazilianPhone, formatCep, lookupCepAddress } from "@/lib/br-inputs";

type RatingPJFormProps = {
  value: RatingPJForm;
  onChange: (value: RatingPJForm) => void;
  readOnly?: boolean;
};

type CepLookupState = "idle" | "loading" | "found" | "not-found";

const taxRegimeOptions = [
  "MEI",
  "Simples Nacional",
  "Lucro Presumido",
  "Lucro Real",
  "Isento",
  "Outro",
];

export function RatingPJFormFields({ value, onChange, readOnly = false }: RatingPJFormProps) {
  const latestValueRef = useRef(value);
  const lastCepLookupRef = useRef("");
  const [cepLookupState, setCepLookupState] = useState<CepLookupState>("idle");

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (readOnly) return;

    const cepDigits = value.cep.replace(/\D/g, "");
    if (cepDigits.length !== 8) {
      lastCepLookupRef.current = "";
      setCepLookupState("idle");
      return;
    }

    if (lastCepLookupRef.current === cepDigits) return;

    const timeout = window.setTimeout(async () => {
      lastCepLookupRef.current = cepDigits;
      setCepLookupState("loading");

      try {
        const address = await lookupCepAddress(cepDigits);
        const current = latestValueRef.current;
        onChange({
          ...current,
          cep: formatCep(cepDigits),
          street: address.street || current.street,
          district: address.neighborhood || current.district,
          city: address.city || current.city,
          uf: address.state || current.uf,
        });
        setCepLookupState("found");
      } catch {
        setCepLookupState("not-found");
      }
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [onChange, readOnly, value.cep]);

  const update = <K extends keyof RatingPJForm>(field: K, nextValue: RatingPJForm[K]) => {
    onChange({ ...value, [field]: nextValue });
  };

  const updateArray = <T,>(
    field: keyof Pick<RatingPJForm, "bankAccounts" | "logins" | "vehicles" | "references">,
    index: number,
    patch: Partial<T>,
  ) => {
    const next = [...(value[field] as T[])];
    next[index] = { ...next[index], ...patch };
    onChange({ ...value, [field]: next });
  };

  const addArrayItem = <T,>(
    field: keyof Pick<RatingPJForm, "bankAccounts" | "logins" | "vehicles" | "references">,
    item: T,
  ) => {
    onChange({ ...value, [field]: [...(value[field] as T[]), item] });
  };

  const removeArrayItem = (
    field: keyof Pick<RatingPJForm, "bankAccounts" | "logins" | "vehicles" | "references">,
    index: number,
  ) => {
    const current = value[field] as unknown[];
    if (current.length <= 1) return;
    onChange({ ...value, [field]: current.filter((_, itemIndex) => itemIndex !== index) });
  };

  const setDocument = (field: keyof RatingPJForm["documents"], file?: File) => {
    if (!file) return;
    const info: RatingFileInfo = {
      name: file.name,
      type: file.type || "arquivo",
      size: file.size,
      updatedAt: new Date().toISOString(),
    };

    if (field === "custom") {
      onChange({
        ...value,
        documents: { ...value.documents, custom: [...value.documents.custom, info] },
      });
      return;
    }

    onChange({ ...value, documents: { ...value.documents, [field]: info } });
  };

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Section title="Dados da empresa e responsável" subtitle="Dados da empresa">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nome Fantasia *" value={value.tradeName} onChange={(v) => update("tradeName", v)} placeholder="Nome fantasia" readOnly={readOnly} />
          <Field label="Inscrição Estadual *" value={value.stateRegistration} onChange={(v) => update("stateRegistration", v)} placeholder="Inscrição estadual" readOnly={readOnly} />
          <Field label="Inscrição Municipal *" value={value.municipalRegistration} onChange={(v) => update("municipalRegistration", v)} placeholder="Inscrição municipal" readOnly={readOnly} />
          <Field label="CNAE *" value={value.cnae} onChange={(v) => update("cnae", v)} placeholder="00.00-0-00" readOnly={readOnly} />
          <SelectField label="Regime Tributário *" value={value.taxRegime} onChange={(v) => update("taxRegime", v)} options={taxRegimeOptions} readOnly={readOnly} />
          <Field label="Site" value={value.website} onChange={(v) => update("website", v)} placeholder="https://..." readOnly={readOnly} />
          <Field label="Celular / WhatsApp" value={value.companyPhone} onChange={(v) => update("companyPhone", formatBrazilianPhone(v))} placeholder="(00) 00000-0000" readOnly={readOnly} />
          <Field label="E-mail de Contato" type="email" value={value.contactEmail} onChange={(v) => update("contactEmail", v)} placeholder="email@empresa.com" readOnly={readOnly} />
        </div>

        <Divider title="Responsável / administrador" />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nome Completo *" value={value.responsibleName} onChange={(v) => update("responsibleName", v)} placeholder="Nome completo" readOnly={readOnly} className="md:col-span-2" />
          <Field label="RG *" value={value.responsibleRg} onChange={(v) => update("responsibleRg", v)} placeholder="RG" readOnly={readOnly} />
          <Field label="CPF *" value={value.responsibleCpf} onChange={(v) => update("responsibleCpf", v)} placeholder="000.000.000-00" readOnly={readOnly} />
          <Field label="Cargo *" value={value.responsibleRole} onChange={(v) => update("responsibleRole", v)} placeholder="Sócio administrador" readOnly={readOnly} />
          <Field label="Telefone *" value={value.responsiblePhone} onChange={(v) => update("responsiblePhone", formatBrazilianPhone(v))} placeholder="(00) 00000-0000" readOnly={readOnly} />
          <Field label="E-mail *" type="email" value={value.responsibleEmail} onChange={(v) => update("responsibleEmail", v)} placeholder="email@dominio.com" readOnly={readOnly} className="md:col-span-2" />
        </div>
      </Section>

      <Section title="Endereço, dados bancários e documentos" subtitle="Endereço">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Field label="CEP *" value={value.cep} onChange={(v) => update("cep", formatCep(v))} placeholder="00000-000" readOnly={readOnly} />
            {cepLookupState === "loading" ? <p className="text-xs text-muted-foreground">Buscando endereço pelo CEP...</p> : null}
            {cepLookupState === "found" ? <p className="text-xs text-success">Endereço preenchido automaticamente.</p> : null}
            {cepLookupState === "not-found" ? <p className="text-xs text-warning">Não foi possível localizar este CEP. Preencha manualmente.</p> : null}
          </div>
          <Field label="UF *" value={value.uf} onChange={(v) => update("uf", v.toUpperCase().slice(0, 2))} placeholder="SP" readOnly={readOnly} />
          <Field label="Logradouro *" value={value.street} onChange={(v) => update("street", v)} placeholder="Rua / Av." readOnly={readOnly} className="md:col-span-2" />
          <Field label="Número *" value={value.number} onChange={(v) => update("number", v)} placeholder="Nº" readOnly={readOnly} />
          <Field label="Complemento" value={value.complement} onChange={(v) => update("complement", v)} placeholder="Apto, sala..." readOnly={readOnly} />
          <Field label="Bairro *" value={value.district} onChange={(v) => update("district", v)} placeholder="Bairro" readOnly={readOnly} />
          <Field label="Cidade *" value={value.city} onChange={(v) => update("city", v)} placeholder="Cidade" readOnly={readOnly} />
        </div>

        <Divider
          title="Dados bancários"
          action={!readOnly ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => addArrayItem<RatingBankAccount>("bankAccounts", { bank: "", agency: "", account: "", pixKey: "" })}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar conta
            </Button>
          ) : null}
        />
        {value.bankAccounts.map((account, index) => (
          <div key={index} className="rounded-lg border border-border/60 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-muted-foreground">Conta {index + 1}</p>
              {!readOnly && value.bankAccounts.length > 1 ? (
                <Button type="button" variant="ghost" size="icon" onClick={() => removeArrayItem("bankAccounts", index)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nome do Banco" value={account.bank} onChange={(v) => updateArray<RatingBankAccount>("bankAccounts", index, { bank: v })} placeholder="Banco" readOnly={readOnly} />
              <Field label="Agência" value={account.agency} onChange={(v) => updateArray<RatingBankAccount>("bankAccounts", index, { agency: v })} placeholder="0000" readOnly={readOnly} />
              <Field label="Número da Conta" value={account.account} onChange={(v) => updateArray<RatingBankAccount>("bankAccounts", index, { account: v })} placeholder="00000-0" readOnly={readOnly} />
              <Field label="Chave PIX" value={account.pixKey} onChange={(v) => updateArray<RatingBankAccount>("bankAccounts", index, { pixKey: v })} placeholder="CPF, CNPJ, e-mail ou telefone" readOnly={readOnly} />
            </div>
          </div>
        ))}

        <Divider title="Documentos" />
        <div className="grid gap-3">
          <FileField label="Cartão CNPJ" file={value.documents.cnpjCard} onChange={(file) => setDocument("cnpjCard", file)} readOnly={readOnly} />
          <FileField label="Faturamento dos últimos 12 meses" file={value.documents.revenueLast12Months} onChange={(file) => setDocument("revenueLast12Months", file)} readOnly={readOnly} />
          <FileField label="Contrato Social" file={value.documents.articlesOfAssociation} onChange={(file) => setDocument("articlesOfAssociation", file)} readOnly={readOnly} />
          <FileField label="Declaração de Imposto de Renda (opcional)" file={value.documents.incomeTax} onChange={(file) => setDocument("incomeTax", file)} readOnly={readOnly} />
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">Documentos personalizados</span>
            {!readOnly && (
              <label className="inline-flex cursor-pointer items-center gap-2 text-primary">
                <Plus className="h-3.5 w-3.5" /> Adicionar
                <input type="file" className="hidden" onChange={(event) => setDocument("custom", event.target.files?.[0])} />
              </label>
            )}
          </div>
          {value.documents.custom.length ? (
            <div className="text-sm text-muted-foreground">
              {value.documents.custom.map((file) => file.name).join(", ")}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum documento personalizado adicionado.</p>
          )}
        </div>
      </Section>

      <Section title="Faturamento e Serasa">
        <Divider title="Faturamento" />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Faturamento Mensal (R$) *" value={value.monthlyRevenue} onChange={(v) => update("monthlyRevenue", v)} placeholder="R$ 0,00" readOnly={readOnly} />
          <Field label="Faturamento Anual (R$) *" value={value.annualRevenue} onChange={(v) => update("annualRevenue", v)} placeholder="R$ 0,00" readOnly={readOnly} />
        </div>
        <Divider title="Serasa" />
        <label className="flex items-center gap-3 text-sm font-medium">
          <Checkbox checked={value.serasaChecked} disabled={readOnly} onCheckedChange={(checked) => update("serasaChecked", Boolean(checked))} />
          Consulta Serasa realizada
        </label>
        <Field label="Score Serasa (0-1000) *" value={value.serasaScore} onChange={(v) => update("serasaScore", v)} placeholder="0 - 1000" readOnly={readOnly} />

        <Divider
          title="Logins e senhas (Serasa etc.)"
          action={!readOnly ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => addArrayItem<RatingLogin>("logins", { name: "", login: "", password: "" })}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar
            </Button>
          ) : null}
        />
        {value.logins.map((login, index) => (
          <div key={index} className="grid gap-4 rounded-lg border border-border/60 p-3 md:grid-cols-4">
            <Field label="Nome (ex: Serasa) *" value={login.name} onChange={(v) => updateArray<RatingLogin>("logins", index, { name: v })} placeholder="Serasa" readOnly={readOnly} />
            <Field label="Login *" value={login.login} onChange={(v) => updateArray<RatingLogin>("logins", index, { login: v })} placeholder="E-mail, CNPJ ou CPF" readOnly={readOnly} />
            <Field label="Senha *" value={login.password} onChange={(v) => updateArray<RatingLogin>("logins", index, { password: v })} placeholder="Senha" readOnly={readOnly} />
            {!readOnly && (
              <Button type="button" variant="ghost" className="mt-6" onClick={() => removeArrayItem("logins", index)}>
                <Trash2 className="mr-1 h-4 w-4" /> Remover
              </Button>
            )}
          </div>
        ))}
      </Section>

      <Section title="Bens, patrimônio e referências">
        <Divider
          title="Veículos"
          action={!readOnly ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => addArrayItem<RatingVehicle>("vehicles", { value: "", year: "", plate: "", uf: "" })}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar veículo
            </Button>
          ) : null}
        />
        {value.vehicles.map((vehicle, index) => (
          <div key={index} className="grid gap-4 rounded-lg border border-border/60 p-3 md:grid-cols-5">
            <Field label="Valor (R$)" value={vehicle.value} onChange={(v) => updateArray<RatingVehicle>("vehicles", index, { value: v })} placeholder="0" readOnly={readOnly} />
            <Field label="Ano" value={vehicle.year} onChange={(v) => updateArray<RatingVehicle>("vehicles", index, { year: v })} placeholder="2023" readOnly={readOnly} />
            <Field label="Placa" value={vehicle.plate} onChange={(v) => updateArray<RatingVehicle>("vehicles", index, { plate: v.toUpperCase() })} placeholder="ABC-1234" readOnly={readOnly} />
            <Field label="UF Lic." value={vehicle.uf} onChange={(v) => updateArray<RatingVehicle>("vehicles", index, { uf: v.toUpperCase().slice(0, 2) })} placeholder="SP" readOnly={readOnly} />
            {!readOnly && (
              <Button type="button" variant="ghost" className="mt-6" onClick={() => removeArrayItem("vehicles", index)}>
                <Trash2 className="mr-1 h-4 w-4" /> Remover
              </Button>
            )}
          </div>
        ))}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Máquinas e equipamentos</Label>
            <Textarea value={value.machinery} onChange={(event) => update("machinery", event.target.value)} readOnly={readOnly} placeholder="Descreva máquinas e equipamentos..." rows={4} />
          </div>
          <div className="space-y-2">
            <Label>Outros bens</Label>
            <Textarea value={value.otherAssets} onChange={(event) => update("otherAssets", event.target.value)} readOnly={readOnly} placeholder="Outros bens patrimoniais..." rows={4} />
          </div>
        </div>

        <Divider
          title="Referências pessoais"
          action={!readOnly ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => addArrayItem<RatingReference>("references", { name: "", phone: "", relationship: "" })}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar
            </Button>
          ) : null}
        />
        {value.references.map((reference, index) => (
          <div key={index} className="grid gap-4 rounded-lg border border-border/60 p-3 md:grid-cols-4">
            <Field label="Nome" value={reference.name} onChange={(v) => updateArray<RatingReference>("references", index, { name: v })} placeholder="Nome" readOnly={readOnly} />
            <Field label="Celular" value={reference.phone} onChange={(v) => updateArray<RatingReference>("references", index, { phone: formatBrazilianPhone(v) })} placeholder="(00) 00000-0000" readOnly={readOnly} />
            <Field label="Grau de Relacionamento" value={reference.relationship} onChange={(v) => updateArray<RatingReference>("references", index, { relationship: v })} placeholder="Sócio, fornecedor, familiar..." readOnly={readOnly} />
            {!readOnly && (
              <Button type="button" variant="ghost" className="mt-6" onClick={() => removeArrayItem("references", index)}>
                <Trash2 className="mr-1 h-4 w-4" /> Remover
              </Button>
            )}
          </div>
        ))}
        <div className="space-y-2">
          <Label>Observações adicionais</Label>
          <Textarea value={value.notes} onChange={(event) => update("notes", event.target.value)} readOnly={readOnly} placeholder="Informações complementares para análise de rating PJ..." rows={4} />
        </div>
      </Section>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Card className="space-y-4 border-border/70 bg-card p-4 shadow-sm sm:p-5">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
        {subtitle ? (
          <p className="mt-3 border-b border-border/60 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {subtitle}
          </p>
        ) : null}
      </div>
      {children}
    </Card>
  );
}

function Divider({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 pt-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      {action}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  readOnly,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  readOnly?: boolean;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  readOnly,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={readOnly}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function FileField({
  label,
  file,
  onChange,
  readOnly,
}: {
  label: string;
  file?: RatingFileInfo;
  onChange: (file?: File) => void;
  readOnly?: boolean;
}) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.files?.[0]);
  };

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="min-w-56 font-medium">{label}</span>
      {!readOnly && (
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium transition hover:border-primary/40 hover:text-primary">
          <Upload className="h-3.5 w-3.5" /> Fazer upload
          <input type="file" className="hidden" onChange={handleChange} />
        </label>
      )}
      <span className="text-muted-foreground">{file?.name ?? "Nenhum arquivo"}</span>
    </div>
  );
}
