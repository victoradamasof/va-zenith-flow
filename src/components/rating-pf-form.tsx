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
  type RatingPFForm,
  type RatingProperty,
  type RatingReference,
  type RatingVehicle,
} from "@/lib/rating";
import { formatBrazilianPhone, formatCep } from "@/lib/br-inputs";

type RatingPFFormProps = {
  value: RatingPFForm;
  onChange: (value: RatingPFForm) => void;
  readOnly?: boolean;
};

type CepLookupState = "idle" | "loading" | "found" | "not-found";

type ViaCepResponse = {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

const maritalOptions = ["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "União estável"];
const incomeOptions = [
  "Até R$ 2.000",
  "R$ 2.001 a R$ 4.000",
  "R$ 4.001 a R$ 7.000",
  "R$ 7.001 a R$ 12.000",
  "Acima de R$ 12.000",
];

export function RatingPFFormFields({ value, onChange, readOnly = false }: RatingPFFormProps) {
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
        const response = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
        if (!response.ok) throw new Error("CEP lookup failed");

        const data = (await response.json()) as ViaCepResponse;
        if (data.erro) {
          setCepLookupState("not-found");
          return;
        }

        const current = latestValueRef.current;
        onChange({
          ...current,
          cep: formatCep(cepDigits),
          street: data.logradouro || current.street,
          district: data.bairro || current.district,
          city: data.localidade || current.city,
          uf: data.uf || current.uf,
        });
        setCepLookupState("found");
      } catch {
        setCepLookupState("not-found");
      }
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [onChange, readOnly, value.cep]);

  const update = <K extends keyof RatingPFForm>(field: K, nextValue: RatingPFForm[K]) => {
    onChange({ ...value, [field]: nextValue });
  };

  const updateArray = <T,>(
    field: keyof Pick<
      RatingPFForm,
      "bankAccounts" | "logins" | "properties" | "vehicles" | "references"
    >,
    index: number,
    patch: Partial<T>,
  ) => {
    const next = [...(value[field] as T[])];
    next[index] = { ...next[index], ...patch };
    onChange({ ...value, [field]: next });
  };

  const addArrayItem = <T,>(
    field: keyof Pick<
      RatingPFForm,
      "bankAccounts" | "logins" | "properties" | "vehicles" | "references"
    >,
    item: T,
  ) => {
    onChange({ ...value, [field]: [...(value[field] as T[]), item] });
  };

  const removeArrayItem = (
    field: keyof Pick<
      RatingPFForm,
      "bankAccounts" | "logins" | "properties" | "vehicles" | "references"
    >,
    index: number,
  ) => {
    const current = value[field] as unknown[];
    if (current.length <= 1) return;
    onChange({ ...value, [field]: current.filter((_, itemIndex) => itemIndex !== index) });
  };

  const setDocument = (field: keyof RatingPFForm["documents"], file?: File) => {
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
      <Section title="Dados pessoais e profissionais" subtitle="Dados pessoais">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Título de Eleitor *" value={value.voterTitle} onChange={(v) => update("voterTitle", v)} placeholder="Nº do título" readOnly={readOnly} />
          <Field label="RG *" value={value.rg} onChange={(v) => update("rg", v)} placeholder="RG" readOnly={readOnly} />
          <Field label="Data de Expedição (RG)" type="date" value={value.rgIssueDate} onChange={(v) => update("rgIssueDate", v)} readOnly={readOnly} />
          <Field label="Data de Nascimento *" type="date" value={value.birthDate} onChange={(v) => update("birthDate", v)} readOnly={readOnly} />
          <SelectField label="Estado Civil *" value={value.maritalStatus} onChange={(v) => update("maritalStatus", v)} options={maritalOptions} readOnly={readOnly} />
          <Field label="Telefone Residencial *" value={value.homePhone} onChange={(v) => update("homePhone", formatBrazilianPhone(v))} placeholder="(00) 00000-0000" readOnly={readOnly} />
          <Field label="Celular / WhatsApp" value={value.mobilePhone} onChange={(v) => update("mobilePhone", formatBrazilianPhone(v))} placeholder="(00) 00000-0000" readOnly={readOnly} />
          <Field label="E-mail" type="email" value={value.email} onChange={(v) => update("email", v)} placeholder="email@dominio.com" readOnly={readOnly} />
          <Field label="Nome do Pai *" value={value.fatherName} onChange={(v) => update("fatherName", v)} placeholder="Nome completo do pai" readOnly={readOnly} />
          <Field label="Nome da Mãe *" value={value.motherName} onChange={(v) => update("motherName", v)} placeholder="Nome completo da mãe" readOnly={readOnly} />
        </div>

        <Divider title="Cônjuge (se casado ou união estável)" />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nome do Cônjuge" value={value.spouseName} onChange={(v) => update("spouseName", v)} placeholder="Nome completo do cônjuge" readOnly={readOnly} className="md:col-span-2" />
          <Field label="CPF do Cônjuge" value={value.spouseCpf} onChange={(v) => update("spouseCpf", v)} placeholder="000.000.000-00" readOnly={readOnly} />
          <Field label="RG do Cônjuge" value={value.spouseRg} onChange={(v) => update("spouseRg", v)} placeholder="RG do cônjuge" readOnly={readOnly} />
        </div>

        <Divider title="Dados profissionais" />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Profissão *" value={value.profession} onChange={(v) => update("profession", v)} placeholder="Ex: Advogado, Comerciante, Autônomo..." readOnly={readOnly} className="md:col-span-2" />
          <Field label="Data de Admissão *" type="date" value={value.admissionDate} onChange={(v) => update("admissionDate", v)} readOnly={readOnly} />
          <SelectField label="Faixa de Renda *" value={value.incomeRange} onChange={(v) => update("incomeRange", v)} options={incomeOptions} readOnly={readOnly} />
          <Field label="Salário (R$) *" value={value.salary} onChange={(v) => update("salary", v)} placeholder="R$ 0,00" readOnly={readOnly} />
          <Field label="Renda Familiar (R$) *" value={value.familyIncome} onChange={(v) => update("familyIncome", v)} placeholder="R$ 0,00" readOnly={readOnly} />
          <Field label="Renda Presumida (automática)" value={value.presumedIncome} onChange={(v) => update("presumedIncome", v)} placeholder="Selecione a faixa de renda" readOnly={readOnly} />
        </div>

        <Divider title="Serasa" />
        <label className="flex items-center gap-3 text-sm font-medium">
          <Checkbox
            checked={value.serasaChecked}
            disabled={readOnly}
            onCheckedChange={(checked) => update("serasaChecked", Boolean(checked))}
          />
          Consulta Serasa realizada
        </label>
        <Field label="Score Serasa (0-1000) *" value={value.serasaScore} onChange={(v) => update("serasaScore", v)} placeholder="0 - 1000" readOnly={readOnly} />
      </Section>

      <Section title="Endereço, dados bancários e documentos" subtitle="Endereço">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Field label="CEP *" value={value.cep} onChange={(v) => update("cep", formatCep(v))} placeholder="00000-000" readOnly={readOnly} />
            {cepLookupState === "loading" ? (
              <p className="text-xs text-muted-foreground">Buscando endereço pelo CEP...</p>
            ) : null}
            {cepLookupState === "found" ? (
              <p className="text-xs text-success">Endereço preenchido automaticamente.</p>
            ) : null}
            {cepLookupState === "not-found" ? (
              <p className="text-xs text-warning">Não foi possível localizar este CEP. Preencha manualmente.</p>
            ) : null}
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
            <p className="mb-3 text-xs font-medium text-muted-foreground">Conta {index + 1}</p>
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
          <FileField label="CNH ou RG" file={value.documents.identity} onChange={(file) => setDocument("identity", file)} readOnly={readOnly} />
          <FileField label="Comprovante de Residência" file={value.documents.residence} onChange={(file) => setDocument("residence", file)} readOnly={readOnly} />
          <FileField label="Selfie com documento" file={value.documents.selfie} onChange={(file) => setDocument("selfie", file)} readOnly={readOnly} />
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

      <Section title="Bens e patrimônio">
        <Divider
          title="Imóveis"
          action={!readOnly ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => addArrayItem<RatingProperty>("properties", { cep: "", street: "", type: "", district: "", city: "", uf: "", value: "" })}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar imóvel
            </Button>
          ) : null}
        />
        {value.properties.map((property, index) => (
          <div key={index} className="rounded-lg border border-border/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Imóvel {index + 1}</p>
              {!readOnly && (
                <Button type="button" variant="ghost" size="icon" onClick={() => removeArrayItem("properties", index)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-6">
              <Field label="CEP" value={property.cep} onChange={(v) => updateArray<RatingProperty>("properties", index, { cep: formatCep(v) })} placeholder="00000" readOnly={readOnly} />
              <Field label="Logradouro" value={property.street} onChange={(v) => updateArray<RatingProperty>("properties", index, { street: v })} placeholder="Logradouro" readOnly={readOnly} className="md:col-span-3" />
              <Field label="Tipo" value={property.type} onChange={(v) => updateArray<RatingProperty>("properties", index, { type: v })} placeholder="Casa, Apto" readOnly={readOnly} />
              <Field label="Valor (R$)" value={property.value} onChange={(v) => updateArray<RatingProperty>("properties", index, { value: v })} placeholder="R$ 0,00" readOnly={readOnly} />
              <Field label="Bairro" value={property.district} onChange={(v) => updateArray<RatingProperty>("properties", index, { district: v })} placeholder="Bairro" readOnly={readOnly} className="md:col-span-2" />
              <Field label="Cidade" value={property.city} onChange={(v) => updateArray<RatingProperty>("properties", index, { city: v })} placeholder="Cidade" readOnly={readOnly} className="md:col-span-2" />
              <Field label="UF" value={property.uf} onChange={(v) => updateArray<RatingProperty>("properties", index, { uf: v.toUpperCase().slice(0, 2) })} placeholder="SP" readOnly={readOnly} />
            </div>
          </div>
        ))}

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
        <label className="flex items-center gap-3 text-sm font-medium">
          <Checkbox checked={value.ownsCompany} disabled={readOnly} onCheckedChange={(checked) => update("ownsCompany", Boolean(checked))} />
          Possui empresa
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nome da Empresa" value={value.companyName} onChange={(v) => update("companyName", v)} placeholder="Nome da empresa" readOnly={readOnly} />
          <Field label="CNPJ" value={value.companyCnpj} onChange={(v) => update("companyCnpj", v)} placeholder="00.000.000/0000-00" readOnly={readOnly} />
        </div>
      </Section>

      <Section title="Logins, senhas e referências">
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
            <Field label="Login *" value={login.login} onChange={(v) => updateArray<RatingLogin>("logins", index, { login: v })} placeholder="E-mail ou CPF" readOnly={readOnly} />
            <Field label="Senha *" value={login.password} onChange={(v) => updateArray<RatingLogin>("logins", index, { password: v })} placeholder="Senha" readOnly={readOnly} />
            {!readOnly && (
              <Button type="button" variant="ghost" className="mt-6" onClick={() => removeArrayItem("logins", index)}>
                <Trash2 className="mr-1 h-4 w-4" /> Remover
              </Button>
            )}
          </div>
        ))}

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
            <Field label="Grau de Relacionamento" value={reference.relationship} onChange={(v) => updateArray<RatingReference>("references", index, { relationship: v })} placeholder="Amigo, Familiar..." readOnly={readOnly} />
            {!readOnly && (
              <Button type="button" variant="ghost" className="mt-6" onClick={() => removeArrayItem("references", index)}>
                <Trash2 className="mr-1 h-4 w-4" /> Remover
              </Button>
            )}
          </div>
        ))}
        <div className="space-y-2">
          <Label>Observações adicionais</Label>
          <Textarea
            value={value.notes}
            onChange={(event) => update("notes", event.target.value)}
            readOnly={readOnly}
            placeholder="Informações complementares para análise de rating..."
            rows={4}
          />
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Card className="space-y-4 border-border/70 bg-card p-4 shadow-sm sm:p-5">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
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
