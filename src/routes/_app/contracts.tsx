import { createFileRoute } from "@tanstack/react-router";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CollaboratorAvatar } from "@/components/collaborator-avatar";
import { DatePickerField } from "@/components/date-picker-field";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PremiumActionButton } from "@/components/ui/premium-action-button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Briefcase,
  Copy,
  Download,
  FileText,
  LinkIcon,
  Printer,
  Save,
  Settings,
  Signature,
  Trash2,
} from "lucide-react";
import {
  clients as initialClients,
  sales as initialSales,
  sellers as initialCollaborators,
  services as initialServices,
  formatBRL,
} from "@/lib/mock-data";
import { buildCollaboratorMap, normalizeCollaboratorName } from "@/lib/collaborators";
import { usePersistentState } from "@/hooks/use-persistent-state";
import {
  formatCurrencyInput,
  parseCurrencyInput,
  paymentMethods,
  type PaymentMethod,
} from "@/lib/receivables";
import { formatLocalDateBR, todayLocalISODate } from "@/lib/date-utils";
import { formatAddressFromCep, formatCep, lookupCepAddress } from "@/lib/br-inputs";

export const Route = createFileRoute("/_app/contracts")({
  component: Contracts,
  head: () => ({ meta: [{ title: "Contratos - VA Consultoria" }] }),
});

type Client = (typeof initialClients)[number] & {
  zip?: string;
  address?: string;
  seller?: string;
  paymentMethod?: PaymentMethod;
  installments?: number;
};
type Sale = (typeof initialSales)[number] & {
  paymentMethod?: PaymentMethod;
  installments?: number;
};
export type ContractSellerEvidence = {
  name: string;
  role?: string;
  document?: string;
  photoUrl?: string;
  signatureUrl?: string;
  selfieUrl?: string;
};

type Collaborator = (typeof initialCollaborators)[number] & ContractSellerEvidence;

type ContractTemplate = "limpa_nome" | "rating" | "consultoria_credito";

export type ContractSettings = {
  companyName: string;
  companyDoc: string;
  companyCep?: string;
  companyAddress: string;
  companyCity: string;
  legalRepresentative: string;
  forum: string;
  defaultLocal: string;
  warrantyMonths: string;
  initialDeadline: string;
};

export type ContractForm = {
  contractTemplate: ContractTemplate;
  clientId: string;
  clientName: string;
  clientDoc: string;
  clientRg: string;
  nationality: string;
  maritalStatus: string;
  profession: string;
  clientZip?: string;
  clientAddress: string;
  service: string;
  seller: string;
  sellerRole: string;
  sellerDocument: string;
  contractDate: string;
  local: string;
  tapValue: string;
  feeValue: string;
  paymentMethod: PaymentMethod;
  installments: string;
  paymentTerms: string;
  notes: string;
};

type ContractDraft = ContractForm & {
  id: string;
  createdAt: string;
  total: number;
  status?: ContractDraftStatus;
  signingUrl?: string;
};

type ContractDraftStatus = "rascunho" | "pendente_assinatura";

export type ContractSignatureRole = "client" | "seller";

export type ContractSignatureEvidence = {
  role: ContractSignatureRole;
  name: string;
  selfie: string;
  signature: string;
  signedAt: string;
};

export type ContractPrintEvidence = {
  client?: ContractSignatureEvidence;
  seller?: ContractSignatureEvidence;
};

export type SignedContractRecord = {
  id: string;
  clientName: string;
  service: string;
  seller: string;
  total: number;
  signedAt: string;
  signerIpNote: string;
  html?: string;
  clientEvidence?: ContractSignatureEvidence;
  sellerEvidence?: ContractSignatureEvidence;
};

export const defaultSettings: ContractSettings = {
  companyName: "VA Consultoria",
  companyDoc: "",
  companyCep: "",
  companyAddress: "Vicente Pires - DF",
  companyCity: "Vicente Pires",
  legalRepresentative: "Emmanuel Victor dos Reis Lopes",
  forum: "Comarca de Samambaia",
  defaultLocal: "Vicente Pires - DF",
  warrantyMonths: "03",
  initialDeadline: "30 a 45 dias úteis",
};

const emptyForm: ContractForm = {
  contractTemplate: "limpa_nome",
  clientId: "",
  clientName: "",
  clientDoc: "",
  clientRg: "",
  nationality: "",
  maritalStatus: "",
  profession: "",
  clientZip: "",
  clientAddress: "",
  service: "",
  seller: "",
  sellerRole: "Consultor comercial",
  sellerDocument: "",
  contractDate: todayLocalISODate(),
  local: "",
  tapValue: "",
  feeValue: "",
  paymentMethod: "avista",
  installments: "1",
  paymentTerms: "À vista",
  notes: "",
};

const defaultRatingService = {
  id: "s6",
  name: "Rating Bancário",
  price: 1200,
  cost: 360,
  commission: 180,
  category: "Crédito",
  status: "ativo",
  sold: 0,
};

const contractTemplateOptions: Array<{ value: ContractTemplate; label: string }> = [
  { value: "limpa_nome", label: "Limpa Nome" },
  { value: "rating", label: "Rating" },
  { value: "consultoria_credito", label: "Consultoria de Crédito" },
];

const paymentLabels: Record<PaymentMethod, string> = {
  avista: "À vista/Pix",
  prazo_pix: "Prazo Pix",
  credito: "Cartão de crédito",
};

function getDefaultPaymentTerms(paymentMethod: PaymentMethod, installments = "1") {
  if (paymentMethod === "credito") return `${installments || "1"}x`;
  if (paymentMethod === "prazo_pix") return "Entrada + 30 dias";
  return "À vista";
}

function getPaymentDescription(form: Pick<ContractForm, "paymentMethod" | "installments" | "paymentTerms">) {
  if (form.paymentMethod === "credito") {
    return `Cartão de Crédito em ${form.installments || "1"}x`;
  }

  const terms = form.paymentTerms?.trim() || getDefaultPaymentTerms(form.paymentMethod, form.installments);
  if (form.paymentMethod === "prazo_pix") return `Prazo Pix - ${terms}`;
  return terms;
}

export type ContractSigningPayload = {
  contractId?: string;
  signerRole?: ContractSignatureRole;
  form: ContractForm;
  settings: ContractSettings;
  createdAt: string;
};

function Contracts() {
  const [clients] = usePersistentState<Client[]>("va-manager:clients", initialClients);
  const [sales] = usePersistentState<Sale[]>("va-manager:sales", initialSales);
  const [services, setServices] = usePersistentState("va-manager:services", initialServices);
  const [collaborators] = usePersistentState<Collaborator[]>(
    "va-manager:collaborators",
    initialCollaborators,
  );
  const [settings, setSettings] = usePersistentState<ContractSettings>(
    "va-manager:contract-settings",
    defaultSettings,
  );
  const [drafts, setDrafts] = usePersistentState<ContractDraft[]>("va-manager:contract-drafts", []);
  const [signedContracts, setSignedContracts] = usePersistentState<SignedContractRecord[]>(
    "va-manager:signed-contracts",
    [],
  );
  const [form, setForm] = useState<ContractForm>({ ...emptyForm });
  const [currentContractId, setCurrentContractId] = useState("");
  const [companyCepLoading, setCompanyCepLoading] = useState(false);

  const activeClients = useMemo(
    () =>
      clients.filter((client) => client.name.trim()).sort((a, b) => a.name.localeCompare(b.name)),
    [clients],
  );
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
  const selectedSeller = useMemo(
    () => collaboratorsByName.get(normalizeCollaboratorName(form.seller)),
    [collaboratorsByName, form.seller],
  );
  const signedIds = useMemo(
    () =>
      new Set(
        signedContracts
          .filter((contract) => contract.clientEvidence && contract.sellerEvidence)
          .map((contract) => contract.id),
      ),
    [signedContracts],
  );
  const finalSignedContracts = useMemo(
    () => signedContracts.filter((contract) => contract.clientEvidence && contract.sellerEvidence),
    [signedContracts],
  );
  const pendingDrafts = useMemo(
    () =>
      drafts.filter(
        (draft) => draft.status === "pendente_assinatura" && !signedIds.has(draft.id),
      ),
    [drafts, signedIds],
  );
  const localDrafts = useMemo(
    () =>
      drafts.filter(
        (draft) => draft.status !== "pendente_assinatura" && !signedIds.has(draft.id),
      ),
    [drafts, signedIds],
  );
  const totalContract = parseCurrencyInput(form.tapValue) + parseCurrencyInput(form.feeValue);
  const filledFields = [
    form.clientName,
    form.clientDoc,
    form.clientAddress,
    form.service,
    form.seller,
    form.tapValue,
    form.feeValue,
  ].filter(Boolean).length;
  const completion = Math.round((filledFields / 7) * 100);

  useEffect(() => {
    setServices((current) => {
      const hasRatingBancario = current.some((service) => isRatingBancarioService(service.name));
      const hasAnyRating = current.some((service) => isRatingService(service.name));

      if (hasRatingBancario) {
        return current.filter((service) => !isLegacyRatingService(service.name));
      }

      if (hasAnyRating) {
        return current.map((service) =>
          isRatingService(service.name) ? { ...service, name: "Rating Bancário" } : service,
        );
      }

      return [...current, defaultRatingService];
    });
  }, [setServices]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const clientId = params.get("client");
    if (clientId) {
      fillFromClient(clientId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCloudSignedContracts() {
      try {
        const response = await fetch("/api/signed-contracts", {
          headers: { accept: "application/json" },
        });
        if (!response.ok) return;
        const data = (await response.json()) as { records?: SignedContractRecord[] };
        if (!cancelled && Array.isArray(data.records)) {
          setSignedContracts((current) => mergeSignedContractRecords(current, data.records ?? []));
        }
      } catch (error) {
        console.warn("Could not load cloud signed contracts", error);
      }
    }

    void loadCloudSignedContracts();

    return () => {
      cancelled = true;
    };
  }, [setSignedContracts]);

  const updateForm = (field: keyof ContractForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateSettings = (field: keyof ContractSettings, value: string) => {
    setSettings((current) => ({ ...current, [field]: value }));
  };

  const searchCompanyCep = async () => {
    const cep = settings.companyCep ?? "";
    if (formatCep(cep).length < 9) {
      toast.error("Informe um CEP da empresa com 8 dígitos.");
      return;
    }

    try {
      setCompanyCepLoading(true);
      const address = await lookupCepAddress(cep);
      setSettings((current) => ({
        ...current,
        companyCep: formatCep(cep),
        companyAddress: formatAddressFromCep(address),
        companyCity: address.city || current.companyCity,
      }));
      toast.success("Endereço da empresa preenchido pelo CEP.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível consultar o CEP.");
    } finally {
      setCompanyCepLoading(false);
    }
  };

  const fillFromClient = (clientId: string) => {
    const client = clients.find((item) => item.id === clientId);
    if (!client) return;
    setCurrentContractId("");

    const clientSales = sales
      .filter((sale) => normalizeText(sale.client) === normalizeText(client.name))
      .sort((a, b) => b.date.localeCompare(a.date));
    const latestSale = clientSales[0];
    const serviceName = latestSale?.service || client.service || "";
    const selectedService = serviceOptions.find((service) => service.name === serviceName);
    const total = latestSale?.value ?? client.total ?? selectedService?.price ?? 0;
    const paymentMethod = latestSale?.paymentMethod ?? client.paymentMethod ?? "avista";
    const tapValue = paymentMethod === "prazo_pix" || total >= 697 ? Math.min(397, total) : total;
    const feeValue = Math.max(total - tapValue, 0);
    const seller = latestSale?.seller || client.seller || collaboratorOptions[0]?.name || "";
    const sellerProfile = collaboratorsByName.get(normalizeCollaboratorName(seller));

    setForm((current) => ({
      ...current,
      clientId: client.id,
      clientName: client.name,
      clientDoc: client.doc,
      clientZip: formatCep(client.zip ?? ""),
      clientAddress: client.address || "",
      contractTemplate: inferContractTemplate(serviceName),
      service: serviceName,
      seller,
      sellerRole: sellerProfile?.role || current.sellerRole || "Consultor comercial",
      contractDate: latestSale?.date || current.contractDate,
      local: settings.defaultLocal || "",
      tapValue: total > 0 ? formatCurrencyInput(tapValue) : "",
      feeValue: total > 0 ? formatCurrencyInput(feeValue) : "",
      paymentMethod,
      installments: String(latestSale?.installments ?? client.installments ?? 1),
      paymentTerms: getDefaultPaymentTerms(
        paymentMethod,
        String(latestSale?.installments ?? client.installments ?? 1),
      ),
    }));
  };

  const selectService = (serviceName: string) => {
    const service = serviceOptions.find((item) => item.name === serviceName);
    const total = service?.price ?? totalContract;
    const tapValue = Math.min(397, total);
    setForm((current) => ({
      ...current,
      contractTemplate: inferContractTemplate(serviceName),
      service: serviceName,
      tapValue: formatCurrencyInput(tapValue),
      feeValue: formatCurrencyInput(Math.max(total - tapValue, 0)),
    }));
  };

  const selectContractTemplate = (template: string) => {
    const contractTemplate = template as ContractTemplate;
    const preferredService = serviceOptions.find((service) =>
      matchesContractTemplate(service.name, contractTemplate),
    );
    setForm((current) => ({
      ...current,
      contractTemplate,
      service: preferredService?.name || current.service,
    }));
    if (preferredService) {
      selectService(preferredService.name);
    }
  };

  const saveDraft = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.clientName.trim()) {
      toast.error("Selecione um cliente do CRM antes de salvar.");
      return;
    }
    const draft: ContractDraft = {
      ...form,
      id: currentContractId || `contract-${Date.now()}`,
      createdAt: new Date().toISOString(),
      total: totalContract,
      status: "rascunho",
    };
    setCurrentContractId(draft.id);
    setDrafts((current) => [draft, ...current].slice(0, 50));
    toast.success("Contrato salvo no histórico local.");
  };

  const copyContract = async () => {
    try {
      await navigator.clipboard.writeText(buildFullContractText(form, settings));
      toast.success("Contrato copiado.");
    } catch {
      toast.error("Não foi possível copiar o contrato.");
    }
  };

  const downloadHtml = () => {
    const html = buildFullPrintableHtml(form, settings);
    downloadHtmlFile(html, `contrato-${slugify(form.clientName || "cliente")}.html`);
  };

  const printContract = () => {
    const popup = window.open("", "_blank", "width=900,height=1000");
    if (!popup) {
      toast.error("Permita pop-ups para imprimir o contrato.");
      return;
    }
    popup.document.write(buildFullPrintableHtml(form, settings));
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const removeDraft = (id: string) => {
    setDrafts((current) => current.filter((draft) => draft.id !== id));
    toast.success("Contrato excluído.");
  };

  const removeSignedContract = (id: string) => {
    setSignedContracts((current) => current.filter((contract) => contract.id !== id));
    toast.success("Contrato assinado excluído.");
  };

  const downloadSignedRecord = (contract: SignedContractRecord) => {
    if (!contract.html) {
      toast.error("Este contrato ainda não foi assinado pelas duas partes.");
      return;
    }
    downloadHtmlFile(
      contract.html,
      `contrato-assinado-${slugify(contract.clientName || "cliente")}.html`,
    );
  };

  const copySigningLink = async (
    signerRole: ContractSignatureRole,
    contract: ContractForm | ContractDraft = form,
  ) => {
    if (!contract.clientName.trim()) {
      toast.error("Selecione um cliente antes de gerar o link.");
      return;
    }
    if (signerRole === "seller" && !contract.seller.trim()) {
      toast.error("Selecione o vendedor responsável antes de gerar o link dele.");
      return;
    }

    const contractId = "id" in contract ? contract.id : currentContractId || `contract-${Date.now()}`;
    setCurrentContractId(contractId);
    const payload: ContractSigningPayload = {
      contractId,
      signerRole,
      form: contract,
      settings,
      createdAt: new Date().toISOString(),
    };

    let url = "";
    try {
      url = await createShortSigningLink(payload);
    } catch {
      toast.error("Não foi possível gerar o link curto. Tente novamente.");
      return;
    }

    const pendingDraft: ContractDraft = {
      ...contract,
      id: contractId,
      createdAt: "createdAt" in contract ? contract.createdAt : new Date().toISOString(),
      total: parseCurrencyInput(contract.tapValue) + parseCurrencyInput(contract.feeValue),
      status: "pendente_assinatura",
      signingUrl: url,
    };

    setDrafts((current) => {
      const withoutCurrent = current.filter((draft) => draft.id !== contractId);
      return [pendingDraft, ...withoutCurrent].slice(0, 50);
    });

    try {
      await navigator.clipboard.writeText(url);
      toast.success(
        signerRole === "client"
          ? "Link de assinatura do contratante copiado."
          : "Link de assinatura do vendedor copiado.",
      );
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contratos"
        subtitle="Geração de contratos Limpa Nome, Rating e Consultoria de Crédito com dados puxados do CRM e da venda"
        action={
          <>
            <Button variant="outline" onClick={copyContract}>
              <Copy className="mr-2 h-4 w-4" />
              Copiar texto
            </Button>
            <Button variant="outline" onClick={downloadHtml}>
              <Download className="mr-2 h-4 w-4" />
              Baixar HTML
            </Button>
            <Button variant="outline" onClick={() => copySigningLink("client")}>
              <LinkIcon className="mr-2 h-4 w-4" />
              Link contratante
            </Button>
            <Button variant="outline" onClick={() => copySigningLink("seller")}>
              <LinkIcon className="mr-2 h-4 w-4" />
              Link vendedor
            </Button>
            <PremiumActionButton
              icon={<Printer />}
              title="Imprimir / PDF"
              subtitle="Gerar contrato"
              size="sm"
              onClick={printContract}
            />
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Cliente vinculado" value={form.clientName || "Selecione"} icon={FileText} />
        <KpiCard label="Valor do contrato" value={formatBRL(totalContract)} icon={Briefcase} />
        <KpiCard label="Responsável" value={form.seller || "Equipe VA"} icon={Signature} />
        <KpiCard label="Campos prontos" value={`${completion}%`} icon={Settings} accent="success" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <form onSubmit={saveDraft} className="space-y-6">
          <Card className="border-border/60 bg-card/60 p-5">
            <div className="mb-5">
              <h3 className="font-display text-base font-semibold">Dados do contrato</h3>
              <p className="text-xs text-muted-foreground">
                Selecione um cliente do CRM. Os dados principais são preenchidos automaticamente.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <ContractSelect
                label="Modelo do contrato"
                value={form.contractTemplate}
                onChange={selectContractTemplate}
                options={contractTemplateOptions}
              />
              <ContractSelect
                label="Cliente do CRM"
                value={form.clientId}
                onChange={fillFromClient}
                options={activeClients.map((client) => ({ value: client.id, label: client.name }))}
              />
              <ContractSelect
                label="Serviço contratado"
                value={form.service}
                onChange={selectService}
                options={serviceOptions.map((service) => ({
                  value: service.name,
                  label: `${service.name} - ${formatBRL(service.price)}`,
                }))}
              />
              <ContractField
                label="Nome do contratante"
                value={form.clientName}
                onChange={(value) => updateForm("clientName", value)}
              />
              <ContractField
                label="CPF/CNPJ"
                value={form.clientDoc}
                onChange={(value) => updateForm("clientDoc", value)}
              />
              <ContractField
                label="RG"
                value={form.clientRg}
                onChange={(value) => updateForm("clientRg", value)}
                placeholder="Opcional"
              />
              <ContractField
                label="Profissão"
                value={form.profession}
                onChange={(value) => updateForm("profession", value)}
                placeholder="Ex: autônoma"
              />
              <ContractField
                label="Nacionalidade"
                value={form.nationality}
                onChange={(value) => updateForm("nationality", value)}
              />
              <ContractField
                label="Estado civil"
                value={form.maritalStatus}
                onChange={(value) => updateForm("maritalStatus", value)}
                placeholder="Ex: solteiro(a)"
              />
              <div className="md:col-span-2">
                <ContractField
                  label="Endereço do cliente"
                  value={form.clientAddress}
                  onChange={(value) => updateForm("clientAddress", value)}
                  placeholder="Rua, número, bairro, cidade/UF"
                />
              </div>
            </div>
          </Card>

          <Card className="border-border/60 bg-card/60 p-5">
            <div className="mb-5">
              <h3 className="font-display text-base font-semibold">Pagamento e responsável</h3>
              <p className="text-xs text-muted-foreground">
                O vendedor escolhido aparece como responsável pela assinatura interna.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <ContractField
                label="Taxa de Abertura de Processo (TAP)"
                value={form.tapValue}
                onChange={(value) => updateForm("tapValue", value)}
                onBlur={() =>
                  updateForm("tapValue", formatCurrencyInput(parseCurrencyInput(form.tapValue)))
                }
              />
              <ContractField
                label="Honorários de consultoria"
                value={form.feeValue}
                onChange={(value) => updateForm("feeValue", value)}
                onBlur={() =>
                  updateForm("feeValue", formatCurrencyInput(parseCurrencyInput(form.feeValue)))
                }
              />
              <ContractSelect
                label="Forma de pagamento"
                value={form.paymentMethod}
                onChange={(value) => {
                  const paymentMethod = value as PaymentMethod;
                  setForm((current) => ({
                    ...current,
                    paymentMethod,
                    paymentTerms: getDefaultPaymentTerms(paymentMethod, current.installments),
                  }));
                }}
                options={paymentMethods.map((method) => ({
                  value: method.value,
                  label: method.label,
                }))}
              />
              {form.paymentMethod === "credito" ? (
                <ContractSelect
                  label="Parcelamento"
                  value={form.installments}
                  onChange={(value) => updateForm("installments", value)}
                  options={Array.from({ length: 12 }, (_, index) => ({
                    value: String(index + 1),
                    label: `${index + 1}x`,
                  }))}
                />
              ) : (
                <ContractField
                  label="Parcelamento"
                  value={form.paymentTerms || getDefaultPaymentTerms(form.paymentMethod)}
                  onChange={(value) => updateForm("paymentTerms", value)}
                  placeholder={getDefaultPaymentTerms(form.paymentMethod)}
                />
              )}
              <ContractSelect
                label="Vendedor responsável"
                value={form.seller}
                onChange={(value) => {
                  const sellerProfile = collaboratorsByName.get(normalizeCollaboratorName(value));
                  setForm((current) => ({
                    ...current,
                    seller: value,
                    sellerRole: sellerProfile?.role || current.sellerRole,
                  }));
                }}
                options={collaboratorOptions.map((collaborator) => ({
                  value: collaborator.name,
                  label: collaborator.name,
                }))}
              />
              <ContractField
                label="Cargo/função do vendedor"
                value={form.sellerRole}
                onChange={(value) => updateForm("sellerRole", value)}
              />
              <ContractField
                label="CPF/documento do vendedor"
                value={form.sellerDocument}
                onChange={(value) => updateForm("sellerDocument", value)}
                placeholder="Opcional"
              />
              <DatePickerField
                label="Data do contrato"
                value={form.contractDate}
                onChange={(value) => updateForm("contractDate", value)}
              />
              <ContractField
                label="Local de assinatura"
                value={form.local}
                onChange={(value) => updateForm("local", value)}
              />
              <div className="md:col-span-2">
                <Label>Observações internas</Label>
                <Textarea
                  value={form.notes}
                  onChange={(event) => updateForm("notes", event.target.value)}
                  placeholder="Use para registrar combinados internos. Não aparece no contrato impresso."
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <Button type="submit" className="gradient-primary text-primary-foreground">
                <Save className="mr-2 h-4 w-4" />
                Salvar contrato
              </Button>
            </div>
          </Card>

          <Card className="border-border/60 bg-card/60 p-5">
            <div className="mb-5">
              <h3 className="font-display text-base font-semibold">Dados da VA Consultoria</h3>
              <p className="text-xs text-muted-foreground">
                Essas informações ficam salvas e alimentam todos os contratos.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <ContractField
                label="Razão/nome da empresa"
                value={settings.companyName}
                onChange={(value) => updateSettings("companyName", value)}
              />
              <ContractField
                label="CNPJ"
                value={settings.companyDoc}
                onChange={(value) => updateSettings("companyDoc", value)}
                placeholder="Informe o CNPJ"
              />
              <div>
                  <ContractField
                    label="CEP da empresa"
                    value={settings.companyCep ?? ""}
                    onChange={(value) => updateSettings("companyCep", formatCep(value))}
                    onBlur={() => updateSettings("companyCep", formatCep(settings.companyCep ?? ""))}
                    placeholder="00000-000"
                    inputMode="numeric"
                    maxLength={9}
                  />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={searchCompanyCep}
                  disabled={companyCepLoading}
                >
                  {companyCepLoading ? "Buscando..." : "Buscar CEP"}
                </Button>
              </div>
              <ContractField
                label="Sede/endereço"
                value={settings.companyAddress}
                onChange={(value) => updateSettings("companyAddress", value)}
              />
              <ContractField
                label="Cidade da sede"
                value={settings.companyCity}
                onChange={(value) => updateSettings("companyCity", value)}
              />
              <ContractField
                label="Representante legal"
                value={settings.legalRepresentative}
                onChange={(value) => updateSettings("legalRepresentative", value)}
              />
              <ContractField
                label="Foro"
                value={settings.forum}
                onChange={(value) => updateSettings("forum", value)}
              />
              <ContractField
                label="Local padrão"
                value={settings.defaultLocal}
                onChange={(value) => updateSettings("defaultLocal", value)}
              />
              <ContractField
                label="Garantia padrão"
                value={settings.warrantyMonths}
                onChange={(value) => updateSettings("warrantyMonths", value)}
              />
            </div>
          </Card>
        </form>

        <div className="space-y-6">
          <Card className="border-border/60 bg-card/60 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-semibold">Prévia do contrato</h3>
                <p className="text-xs text-muted-foreground">
                  A prévia abaixo usa o texto-base do contrato enviado.
                </p>
              </div>
              <Badge variant="outline" className="border-primary/30 text-primary">
                {paymentLabels[form.paymentMethod]}
              </Badge>
            </div>
            <ContractPreview form={form} settings={settings} seller={selectedSeller} />
          </Card>

          <ContractHistoryTable
            title="Pendentes de assinatura"
            description="Links enviados ao cliente e ainda não finalizados."
            badge={`${pendingDrafts.length} pendentes`}
            emptyText="Nenhum contrato pendente de assinatura."
            rows={pendingDrafts.map((draft) => ({
              id: draft.id,
              clientName: draft.clientName,
              service: draft.service,
              seller: draft.seller,
              value: formatBRL(draft.total),
              date: new Date(draft.createdAt).toLocaleString("pt-BR"),
              status: getContractSignatureStatus(draft.id, signedContracts),
              actions: (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setForm(draft);
                      setCurrentContractId(draft.id);
                      toast.success("Contrato carregado.");
                    }}
                  >
                    Abrir
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => copySigningLink("client", draft)}>
                    <LinkIcon className="mr-1 h-3.5 w-3.5" />
                    Contratante
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => copySigningLink("seller", draft)}>
                    <Signature className="mr-1 h-3.5 w-3.5" />
                    Vendedor
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => removeDraft(draft.id)}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Excluir
                  </Button>
                </>
              ),
            }))}
          />

          <ContractHistoryTable
            title="Contratos finalizados"
            description="Contratos assinados pelo cliente e pela VA Consultoria, prontos para baixar."
            badge={`${finalSignedContracts.length} finalizados`}
            emptyText="Nenhum contrato finalizado ainda."
            rows={finalSignedContracts.map((contract) => ({
              id: contract.id,
              clientName: contract.clientName,
              service: contract.service,
              seller: contract.seller,
              value: formatBRL(contract.total),
              date: new Date(contract.signedAt).toLocaleString("pt-BR"),
              status: "Finalizado",
              actions: (
                <>
                  <Button variant="ghost" size="sm" onClick={() => downloadSignedRecord(contract)}>
                    <Download className="mr-1 h-3.5 w-3.5" />
                    Baixar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => removeSignedContract(contract.id)}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Excluir
                  </Button>
                </>
              ),
            }))}
          />

          <Card className="border-border/60 bg-card/60 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-semibold">Rascunhos locais</h3>
                <p className="text-xs text-muted-foreground">
                  Contratos salvos para ajuste antes do envio para assinatura.
                </p>
              </div>
              <Badge variant="outline" className="border-border/60">
                {localDrafts.length} salvos
              </Badge>
            </div>
            <div className="overflow-hidden rounded-lg border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Cliente</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {localDrafts.map((draft) => (
                    <TableRow key={draft.id}>
                      <TableCell>
                        <p className="font-medium">{draft.clientName}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(draft.createdAt).toLocaleString("pt-BR")}
                        </p>
                      </TableCell>
                      <TableCell>{draft.service}</TableCell>
                      <TableCell>{draft.seller}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatBRL(draft.total)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setForm(draft);
                              setCurrentContractId(draft.id);
                              toast.success("Contrato carregado.");
                            }}
                          >
                            Abrir
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => copySigningLink("client", draft)}>
                            <LinkIcon className="mr-1 h-3.5 w-3.5" />
                            Contratante
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => copySigningLink("seller", draft)}>
                            <Signature className="mr-1 h-3.5 w-3.5" />
                            Vendedor
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => removeDraft(draft.id)}
                          >
                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                            Excluir
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {localDrafts.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        Nenhum contrato salvo ainda.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ContractField({
  label,
  value,
  onChange,
  placeholder,
  onBlur,
  readOnly,
  inputMode,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onBlur?: () => void;
  readOnly?: boolean;
  inputMode?: "none" | "text" | "tel" | "url" | "email" | "numeric" | "decimal" | "search";
  maxLength?: number;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

type ContractHistoryRow = {
  id: string;
  clientName: string;
  service: string;
  seller: string;
  value: string;
  date: string;
  status: string;
  actions: React.ReactNode;
};

function ContractHistoryTable({
  title,
  description,
  badge,
  emptyText,
  rows,
}: {
  title: string;
  description: string;
  badge: string;
  emptyText: string;
  rows: ContractHistoryRow[];
}) {
  return (
    <Card className="border-border/60 bg-card/60 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Badge variant="outline" className="border-border/60">
          {badge}
        </Badge>
      </div>
      <div className="overflow-hidden rounded-lg border border-border/60">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Cliente</TableHead>
              <TableHead>Serviço</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <p className="font-medium">{row.clientName}</p>
                  <p className="text-xs text-muted-foreground">{row.date}</p>
                </TableCell>
                <TableCell>{row.service || "-"}</TableCell>
                <TableCell>{row.seller || "-"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="border-primary/30 text-primary">
                    {row.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium">{row.value}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">{row.actions}</div>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  {emptyText}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

function ContractSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ContractPreview({
  form,
  settings,
  seller,
}: {
  form: ContractForm;
  settings: ContractSettings;
  seller?: Collaborator;
}) {
  if (form.contractTemplate === "rating") {
    return <RatingContractPreview form={form} settings={settings} seller={seller} />;
  }
  if (form.contractTemplate === "consultoria_credito") {
    return <ConsultoriaCreditoContractPreview form={form} settings={settings} seller={seller} />;
  }

  return (
    <article className="max-h-[780px] overflow-auto rounded-xl border border-border/60 bg-background p-7 text-sm leading-7 text-foreground shadow-inner">
      <div className="mb-8 text-center">
        <h2 className="font-display text-xl font-bold uppercase">
          Contrato de Prestação de Serviços de Consultoria e Intermediação
        </h2>
        <p className="mt-2 text-xs text-muted-foreground">
          Serviços Administrativos e de Contestação de Apontamentos em Cadastro de Crédito - "Limpa
          Nome"
        </p>
      </div>
      <p>
        Pelo presente instrumento particular de contrato, de um lado, <strong>CONTRATADA:</strong>{" "}
        {settings.companyName}, pessoa jurídica de direito privado, inscrita no CNPJ sob nº{" "}
        {settings.companyDoc || "[CNPJ da empresa]"}, com sede em {settings.companyAddress}, neste
        ato representada por {settings.legalRepresentative}, doravante denominada CONTRATADA.
      </p>
      <p className="mt-4">
        E, de outro lado, <strong>CONTRATANTE:</strong> {form.clientName || "[Nome do cliente]"},{" "}
        {form.nationality || "[nacionalidade]"}, {form.maritalStatus || "[estado civil]"},{" "}
        {form.profession || "[profissão]"}, portador(a) do CPF/CNPJ nº{" "}
        {form.clientDoc || "[CPF/CNPJ]"} e RG nº {form.clientRg || "[RG]"}, residente e
        domiciliado(a) em {form.clientAddress || "[endereço]"}, doravante denominado CONTRATANTE.
      </p>
      <ContractSection title="Cláusula Primeira - Do Objeto">
        O presente contrato tem por objeto a prestação de consultoria e intermediação de serviços
        administrativos relacionados à contestação de apontamentos restritivos em cadastros de
        crédito (SPC, Serasa, Boa Vista), referente ao serviço {form.service}.
      </ContractSection>
      <ContractSection title="Cláusula Segunda - Da Natureza do Serviço">
        O CONTRATANTE declara estar ciente de que o serviço contratado não implica quitação,
        renegociação ou extinção da dívida originária; a CONTRATADA atua como consultoria, gestão
        administrativa e intermediação, conectando o CONTRATANTE a parceiros especializados.
      </ContractSection>
      <ContractSection title="Cláusula Terceira - Do Prazo">
        O prazo estimado para conclusão inicial dos procedimentos é de {settings.initialDeadline},
        prorrogáveis em caso de necessidade técnica. Após 120 dias úteis sem documento comprobatório
        de retirada do apontamento, poderá ser solicitado reembolso dos valores pagos, desde que não
        haja inadimplência.
      </ContractSection>
      <ContractSection title="Cláusula Quarta - Da Garantia">
        O CONTRATANTE terá cobertura de {settings.warrantyMonths} meses contados a partir da entrega
        do documento comprobatório de retirada do apontamento, conforme condições previstas no
        contrato-base.
      </ContractSection>
      <ContractSection title="Cláusula Quinta - Do Valor e Forma de Pagamento">
        Pelo presente contrato, o CONTRATANTE pagará à CONTRATADA: Taxa de Abertura de Processo
        (TAP): {formatBRL(parseCurrencyInput(form.tapValue))}; Honorários de Consultoria e
        Intermediação: {formatBRL(parseCurrencyInput(form.feeValue))}. Valor total:{" "}
        {formatBRL(parseCurrencyInput(form.tapValue) + parseCurrencyInput(form.feeValue))}.
        <div className="mt-3 grid gap-2 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs">
          <PaymentMark
            active={form.paymentMethod === "avista"}
            label={form.paymentMethod === "avista" ? getPaymentDescription(form) : "À vista/Pix"}
          />
          <PaymentMark
            active={form.paymentMethod === "prazo_pix"}
            label={form.paymentMethod === "prazo_pix" ? getPaymentDescription(form) : "Prazo Pix"}
          />
          <PaymentMark
            active={form.paymentMethod === "credito"}
            label={`Cartão de crédito${form.paymentMethod === "credito" ? ` - ${form.installments}x` : ""}`}
          />
        </div>
      </ContractSection>
      <ContractSection title="Cláusula Sexta - Da Multa Contratual">
        Em caso de descumprimento contratual pelo CONTRATANTE, incluindo fornecimento de informações
        falsas, inadimplência não regularizada, contratação paralela ou desistência injustificada,
        será aplicada multa compensatória de até R$ 5.000,00, proporcional ao valor contratado.
      </ContractSection>
      <ContractSection title="Cláusula Sétima - Das Responsabilidades da Contratada">
        A CONTRATADA se compromete a realizar a consultoria e intermediação de forma diligente,
        manter o CONTRATANTE informado e intermediar contato com parceiros especializados.
      </ContractSection>
      <ContractSection title="Cláusula Oitava - Das Declarações do Contratante">
        O CONTRATANTE declara estar ciente de que a CONTRATADA não presta serviços jurídicos
        diretos, não garante êxito, não extingue a dívida original e pode utilizar ações coletivas
        conduzidas por parceiros especializados.
      </ContractSection>
      <ContractSection title="Cláusula Nona - Do Foro">
        Fica eleito o foro da {settings.forum} para dirimir quaisquer litígios oriundos deste
        contrato.
      </ContractSection>
      <p className="mt-8">
        E por estarem justos e contratados, firmam o presente instrumento em 02 vias de igual teor.
        {` ${form.local || settings.defaultLocal}, ${formatLongDate(form.contractDate)}.`}
      </p>
      <div className="mt-12 grid gap-8 md:grid-cols-2">
        <SignatureLine title="CONTRATANTE" name={form.clientName || "Cliente"} />
        <SignatureLine title="CONTRATADA" name={settings.companyName} />
        <SignatureLine
          title="RESPONSÁVEL PELA VENDA"
          name={form.seller || "Vendedor responsável"}
          subtitle={seller?.role || form.sellerRole}
          person={seller}
        />
      </div>
    </article>
  );
}

function RatingContractPreview({
  form,
  settings,
  seller,
}: {
  form: ContractForm;
  settings: ContractSettings;
  seller?: Collaborator;
}) {
  return (
    <article className="max-h-[780px] overflow-auto rounded-xl border border-border/60 bg-background p-7 text-sm leading-7 text-foreground shadow-inner">
      <div className="mb-8 text-center">
        <h2 className="font-display text-xl font-bold uppercase">Contrato de Prestação de Serviços</h2>
        <p className="mt-2 text-xs text-muted-foreground">
          Programa Rating de Organização e Posicionamento Creditício
        </p>
      </div>
      <p>
        <strong>CONTRATADA:</strong> {settings.companyName}, CNPJ{" "}
        {settings.companyDoc || "[CNPJ]"}, com sede em {settings.companyAddress}, representada por{" "}
        {settings.legalRepresentative}.
      </p>
      <p className="mt-4">
        <strong>CONTRATANTE:</strong> {form.clientName || "[Nome do cliente]"},{" "}
        CPF/CNPJ {form.clientDoc || "[CPF/CNPJ]"}, RG {form.clientRg || "[RG]"}, residente em{" "}
        {form.clientAddress || "[endereço]"}, e-mail/contato conforme cadastro no CRM.
      </p>
      <ContractSection title="1. Cláusula geral">
        Considera-se Rating a metodologia própria adotada pela CONTRATADA, consistente na análise,
        organização, estruturação e direcionamento estratégico das informações creditícias do
        CONTRATANTE, com objetivo de promover melhor posicionamento perante o mercado, sem se
        confundir com score, classificação oficial de risco ou índice atribuído por instituições.
      </ContractSection>
      <ContractSection title="2. Do objeto do contrato">
        O presente contrato tem por objeto a prestação de serviços especializados de Rating, com
        análise do perfil, organização cadastral, orientação administrativa e direcionamento
        estratégico das informações creditícias do CONTRATANTE. A parte administrativa será realizada
        em até 30 dias úteis, e a atualização completa poderá ocorrer em até 60 dias úteis, conforme
        fatores sistêmicos de cada instituição.
      </ContractSection>
      <ContractSection title="3. Obrigações do contratante">
        O CONTRATANTE deverá fornecer informações completas e verdadeiras, seguir as orientações da
        CONTRATADA, manter comportamento financeiro adequado, evitar solicitações excessivas de
        crédito, atrasos em contas, consultas excessivas ao CPF/CNPJ e decisões financeiras que
        prejudiquem o histórico durante a execução do serviço.
      </ContractSection>
      <ContractSection title="4. Obrigações da contratada">
        A CONTRATADA atuará com análise, orientação e estratégia, sem garantia de aprovação de
        crédito, aumento de score, retirada de registros ou resultado específico. Sua eventual
        responsabilidade fica limitada ao valor efetivamente pago pelo CONTRATANTE neste contrato.
      </ContractSection>
      <ContractSection title="5. Inadimplemento, descumprimento e multa">
        Em caso de inadimplência ou descumprimento, incidirá multa de 10% sobre o valor contratado,
        além de juros de mora de 1% ao mês e correção monetária quando aplicável. A inadimplência
        poderá suspender o andamento do serviço até a regularização.
      </ContractSection>
      <ContractSection title="6. Compromisso com a execução do serviço">
        A CONTRATADA assume compromisso de realizar o serviço dentro do prazo máximo de 60 dias úteis,
        contado da assinatura e confirmação de pagamento, podendo haver prorrogação por força maior,
        recesso, calamidade pública, prorrogação de prazos ou impedimento operacional.
      </ContractSection>
      <ContractSection title="7. Condições gerais e foro">
        Não há vínculo trabalhista entre as partes. O CONTRATANTE autoriza uso institucional de
        informações de andamento ou conclusão de forma genérica e sem identificação direta. Fica eleito
        o foro da {settings.forum} para dirimir controvérsias.
      </ContractSection>
      <ContractSection title="Valor e forma de pagamento">
        Custo do serviço:{" "}
        {formatBRL(parseCurrencyInput(form.tapValue) + parseCurrencyInput(form.feeValue))}. Forma de
        pagamento: {getPaymentDescription(form)}.
      </ContractSection>
      <p className="mt-8">
        {form.local || settings.defaultLocal}, {formatLongDate(form.contractDate)}.
      </p>
      <div className="mt-12 grid gap-8 md:grid-cols-2">
        <SignatureLine title="CONTRATANTE" name={form.clientName || "Cliente"} />
        <SignatureLine title="CONTRATADA" name={settings.companyName} />
        <SignatureLine
          title="RESPONSÁVEL PELA VENDA"
          name={form.seller || "Vendedor responsável"}
          subtitle={seller?.role || form.sellerRole}
          person={seller}
        />
        <SignatureLine title="TESTEMUNHA" name="" />
      </div>
    </article>
  );
}

function ConsultoriaCreditoContractPreview({
  form,
  settings,
  seller,
}: {
  form: ContractForm;
  settings: ContractSettings;
  seller?: Collaborator;
}) {
  return (
    <article className="max-h-[780px] overflow-auto rounded-xl border border-border/60 bg-background p-7 text-sm leading-7 text-foreground shadow-inner">
      <div className="mb-8 text-center">
        <h2 className="font-display text-xl font-bold uppercase">
          Contrato de Prestação de Serviços de Consultoria em Crédito
        </h2>
        <p className="mt-2 text-xs text-muted-foreground">
          Consultoria, intermediação administrativa, rating de crédito e atualização cadastral
        </p>
      </div>
      <p>
        Pelo presente instrumento particular de contrato, de um lado,{" "}
        <strong>CONTRATADA:</strong> {settings.companyName}, pessoa jurídica de direito privado,
        inscrita no CNPJ sob nº {settings.companyDoc || "[CNPJ]"}, com sede em{" "}
        {settings.companyAddress || "[endereço da empresa]"}, neste ato representada por{" "}
        {settings.legalRepresentative || "[representante legal]"}.
      </p>
      <p className="mt-4">
        <strong>CONTRATANTE:</strong> {form.clientName || "[Nome do cliente]"}, CPF/CNPJ nº{" "}
        {form.clientDoc || "[CPF/CNPJ]"}, RG nº {form.clientRg || "[RG]"}, residente e domiciliado(a)
        em {form.clientAddress || "[endereço]"}.
      </p>
      <ContractSection title="Cláusula Primeira - Do Objeto">
        O presente contrato tem por objeto a prestação de serviços de Consultoria em Crédito,
        incluindo consultoria e intermediação administrativa relacionada à contestação de apontamentos
        restritivos em cadastros de crédito, reestruturação de rating, atualização cadastral,
        atualização de classificação e pontuação de crédito.
      </ContractSection>
      <ContractSection title="Cláusula Segunda - Da Natureza do Serviço">
        O CONTRATANTE declara estar ciente de que o serviço não implica quitação, renegociação ou
        extinção de dívida originária, não garante aprovação de crédito e será acompanhado por
        relatórios e informações fornecidas pela CONTRATADA.
      </ContractSection>
      <ContractSection title="Cláusula Terceira - Do Prazo">
        O prazo estimado para conclusão inicial dos procedimentos é de {settings.initialDeadline},
        prorrogáveis por igual período em caso de necessidade técnica. Após 120 dias úteis, poderá ser
        solicitado reembolso nos termos do contrato, desde que não haja inadimplência.
      </ContractSection>
      <ContractSection title="Cláusula Quarta - Da Garantia">
        O CONTRATANTE terá cobertura de {settings.warrantyMonths} meses contados a partir da entrega
        do documento comprobatório de conclusão do serviço, respeitadas as condições do contrato.
      </ContractSection>
      <ContractSection title="Cláusula Quinta - Do Valor e Forma de Pagamento">
        Taxa de Abertura de Processo: {formatBRL(parseCurrencyInput(form.tapValue))}. Honorários de
        Consultoria em Crédito: {formatBRL(parseCurrencyInput(form.feeValue))}. Total:{" "}
        {formatBRL(parseCurrencyInput(form.tapValue) + parseCurrencyInput(form.feeValue))}. Forma de
        pagamento: {getPaymentDescription(form)}.
      </ContractSection>
      <ContractSection title="Cláusulas complementares">
        O contrato completo contempla obrigações do contratante, responsabilidades da contratada,
        declarações do contratante, ausência de garantia de aprovação de crédito e foro eleito em{" "}
        {settings.forum}.
      </ContractSection>
      <p className="mt-8">
        {form.local || settings.defaultLocal}, {formatLongDate(form.contractDate)}.
      </p>
      <div className="mt-12 grid gap-8 md:grid-cols-2">
        <SignatureLine title="CONTRATANTE" name={form.clientName || "Cliente"} />
        <SignatureLine title="CONTRATADA" name={settings.companyName} />
        <SignatureLine
          title="RESPONSÁVEL PELA VENDA"
          name={form.seller || "Vendedor responsável"}
          subtitle={seller?.role || form.sellerRole}
          person={seller}
        />
        <SignatureLine title="TESTEMUNHA" name="" />
      </div>
    </article>
  );
}

function ContractSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="font-display text-sm font-bold uppercase text-primary">{title}</h3>
      <div className="mt-1">{children}</div>
    </section>
  );
}

function PaymentMark({ active, label }: { active: boolean; label: string }) {
  return (
    <span>
      ({active ? "X" : " "}) {label}
    </span>
  );
}

function SignatureLine({
  title,
  name,
  subtitle,
  person,
}: {
  title: string;
  name: string;
  subtitle?: string;
  person?: Collaborator;
}) {
  return (
    <div className="pt-8 text-center">
      <div className="mx-auto mb-2 h-px w-56 bg-border" />
      <p className="text-xs font-semibold uppercase tracking-wide">{title}</p>
      <div className="mt-2 flex items-center justify-center gap-2">
        {person && <CollaboratorAvatar person={person} className="h-7 w-7 text-[11px]" />}
        <span className="font-medium">{name}</span>
      </div>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function mergeSignedContractRecords(
  current: SignedContractRecord[],
  incoming: SignedContractRecord[],
) {
  const merged = new Map<string, SignedContractRecord>();

  for (const record of current) {
    merged.set(record.id, record);
  }

  for (const record of incoming) {
    const existing = merged.get(record.id);
    merged.set(record.id, {
      ...existing,
      ...record,
      clientEvidence: record.clientEvidence ?? existing?.clientEvidence,
      sellerEvidence: record.sellerEvidence ?? existing?.sellerEvidence,
      html: record.html ?? existing?.html,
    });
  }

  return Array.from(merged.values()).slice(0, 50);
}

function normalizeText(value = "") {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function inferContractTemplate(serviceName = ""): ContractTemplate {
  if (isConsultoriaCreditoService(serviceName)) return "consultoria_credito";
  return isRatingService(serviceName) ? "rating" : "limpa_nome";
}

function matchesContractTemplate(serviceName: string, template: ContractTemplate) {
  if (template === "rating") return isRatingService(serviceName);
  if (template === "consultoria_credito") return isConsultoriaCreditoService(serviceName);
  return normalizeText(serviceName).includes("limpa nome");
}

function isRatingService(serviceName = "") {
  return normalizeText(serviceName).includes("rating");
}

function isConsultoriaCreditoService(serviceName = "") {
  const normalized = normalizeText(serviceName);
  return normalized.includes("consultoria") && normalized.includes("credito");
}

function isRatingBancarioService(serviceName = "") {
  const normalized = normalizeText(serviceName);
  return normalized.includes("rating") && normalized.includes("bancario");
}

function isLegacyRatingService(serviceName = "") {
  const normalized = normalizeText(serviceName);
  return normalized.includes("atualizacao") && normalized.includes("rating");
}

export function formatLongDate(date: string) {
  if (!date) return "[Data]";
  return formatLocalDateBR(date, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function slugify(value: string) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function downloadHtmlFile(html: string, filename: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function getContractSignatureStatus(id: string, signedContracts: SignedContractRecord[]) {
  const record = signedContracts.find((contract) => contract.id === id);
  if (!record) return "Aguardando ambos";
  if (record.clientEvidence && record.sellerEvidence) return "Finalizado";
  if (record.clientEvidence) return "Falta vendedor";
  if (record.sellerEvidence) return "Falta contratante";
  return "Aguardando ambos";
}

export function encodeSigningPayload(payload: ContractSigningPayload) {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  const encoded = globalThis.btoa(binary);
  return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function createShortSigningLink(payload: ContractSigningPayload) {
  const roleLabel = payload.signerRole === "seller" ? "vendedor" : "cliente";
  const slugBase = `vaconsultoria-${slugify(payload.form.clientName || "contrato")}-${roleLabel}`;
  const response = await fetch("/api/signing-links", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ payload, slugBase }),
  });

  if (!response.ok) {
    throw new Error(`Signing link failed: ${response.status}`);
  }

  const data = (await response.json()) as { path?: string };
  if (!data.path) throw new Error("Signing link path missing.");
  return `${window.location.origin}${data.path}`;
}

export function decodeSigningPayload(token: string): ContractSigningPayload | null {
  try {
    const normalized = token.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = globalThis.atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as ContractSigningPayload;
    if (!parsed.form || !parsed.settings || !parsed.createdAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

function buildContractText(form: ContractForm, settings: ContractSettings) {
  return [
    "CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE CONSULTORIA E INTERMEDIAÇÃO",
    "",
    `CONTRATADA: ${settings.companyName}, CNPJ ${settings.companyDoc || "[CNPJ]"}, com sede em ${settings.companyAddress}, representada por ${settings.legalRepresentative}.`,
    `CONTRATANTE: ${form.clientName}, ${form.nationality}, ${form.maritalStatus}, ${form.profession}, CPF/CNPJ ${form.clientDoc}, RG ${form.clientRg || "[RG]"}, residente em ${form.clientAddress}.`,
    "",
    `Objeto: consultoria e intermediação de serviços administrativos relacionados à contestação de apontamentos restritivos em cadastros de crédito, serviço ${form.service}.`,
    `Valor: TAP ${formatBRL(parseCurrencyInput(form.tapValue))}; honorários ${formatBRL(parseCurrencyInput(form.feeValue))}; total ${formatBRL(parseCurrencyInput(form.tapValue) + parseCurrencyInput(form.feeValue))}.`,
    `Forma de pagamento: ${getPaymentDescription(form)}.`,
    `Foro: ${settings.forum}.`,
    `${form.local}, ${formatLongDate(form.contractDate)}.`,
    "",
    "CONTRATANTE: ________________________________",
    "CONTRATADA: _________________________________",
    `RESPONSÁVEL PELA VENDA: ${form.seller || "________________"}`,
  ].join("\n");
}

function buildPrintableHtml(form: ContractForm, settings: ContractSettings) {
  const body = buildContractText(form, settings)
    .split("\n")
    .map((line) => `<p>${escapeHtml(line) || "&nbsp;"}</p>`)
    .join("");
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Contrato - ${escapeHtml(form.clientName || "Cliente")}</title>
<style>
body{font-family:Arial,sans-serif;max-width:820px;margin:40px auto;color:#111;line-height:1.55}
h1{font-size:20px;text-align:center;text-transform:uppercase}
p{margin:8px 0}
@media print{body{margin:24mm;max-width:none}}
</style>
</head>
<body><h1>Contrato VA Consultoria</h1>${body}</body>
</html>`;
}

export function buildFullContractText(form: ContractForm, settings: ContractSettings) {
  if (form.contractTemplate === "rating") {
    return buildRatingContractText(form, settings);
  }
  if (form.contractTemplate === "consultoria_credito") {
    return buildConsultoriaCreditoContractText(form, settings);
  }

  const tap = formatBRL(parseCurrencyInput(form.tapValue));
  const fee = formatBRL(parseCurrencyInput(form.feeValue));
  const total = formatBRL(parseCurrencyInput(form.tapValue) + parseCurrencyInput(form.feeValue));
  const payment = getPaymentDescription(form);

  return [
    "CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE CONSULTORIA E INTERMEDIAÇÃO",
    '(Serviços Administrativos e de Contestação de Apontamentos em Cadastro de Crédito - "Limpa Nome")',
    "",
    "Pelo presente instrumento particular de contrato, de um lado:",
    "",
    `CONTRATADA: ${settings.companyName}, pessoa jurídica de direito privado, inscrita no CNPJ sob nº ${settings.companyDoc || "[CNPJ da empresa]"}, com sede em ${settings.companyAddress}, neste ato representada por seu representante legal ${settings.legalRepresentative}, doravante denominada CONTRATADA.`,
    "",
    "E, de outro lado:",
    "",
    `CONTRATANTE: ${form.clientName || "[Nome do cliente]"}, ${form.nationality || "[nacionalidade]"}, ${form.maritalStatus || "[estado civil]"}, ${form.profession || "[profissão]"}, portador(a) do CPF/CNPJ nº ${form.clientDoc || "[CPF/CNPJ]"} e RG nº ${form.clientRg || "[RG]"}, residente e domiciliado(a) em ${form.clientAddress || "[endereço]"}, doravante denominado CONTRATANTE.`,
    "",
    "CLÁUSULA PRIMEIRA - DO OBJETO",
    "1.1 O presente contrato tem por objeto a prestação de consultoria e intermediação de serviços administrativos relacionados à contestação de apontamentos restritivos em cadastros de crédito (SPC, Serasa, Boa Vista).",
    "1.2 A CONTRATADA atua exclusivamente na função de consultoria, gestão administrativa e intermediação, conectando o CONTRATANTE a parceiros jurídicos regularmente habilitados, que são os responsáveis técnicos pela condução dos procedimentos administrativos ou judiciais.",
    "1.3 A CONTRATADA não executa serviços jurídicos próprios, não atua como escritório de advocacia e não presta assessoria jurídica direta.",
    "",
    "CLÁUSULA SEGUNDA - DA NATUREZA DO SERVIÇO",
    "2.1 O CONTRATANTE declara estar ciente de que:",
    "- O serviço contratado não implica na quitação, renegociação ou extinção da dívida originária;",
    "- O objetivo é questionar a legitimidade dos apontamentos restritivos com base no Código de Defesa do Consumidor e normas aplicáveis;",
    "- Trata-se de medida administrativa ou judicial que pode incluir ações coletivas conduzidas por parceiros especializados;",
    "- Para resguardar dados sensíveis de todos os envolvidos em ações coletivas, não será fornecido número individual de processo, mas a CONTRATADA garantirá relatórios periódicos sobre o andamento.",
    "",
    "CLÁUSULA TERCEIRA - DO PRAZO",
    `3.1 O prazo estimado para conclusão inicial dos procedimentos é de ${settings.initialDeadline}, prorrogáveis, por igual período, em caso de necessidade técnica.`,
    "3.2 Caso, após o prazo de 120 (cento e vinte) dias úteis, não seja possível apresentar documento que comprove a retirada do apontamento (ex.: certidão ou consulta atualizada), poderá ser solicitado pelo CONTRATANTE o reembolso dos valores pagos, desde que não haja inadimplência.",
    "",
    "CLÁUSULA QUARTA - DA GARANTIA",
    `4.1 O CONTRATANTE terá cobertura de ${settings.warrantyMonths} meses contados a partir da entrega do documento comprobatório de retirada do apontamento.`,
    "4.2 Caso surjam novos apontamentos restritivos no mesmo período, a CONTRATADA providenciará, sem custos adicionais, a intermediação para retirada.",
    "4.3 Caso as restrições contestadas retornem em razão de eventual queda da liminar, o processo será refeito dentro do mesmo prazo previsto na Cláusula Terceira, estando o CONTRATANTE coberto pela garantia.",
    "4.4 Caso o CONTRATANTE opte por ingressar em novo processo sem aguardar o reprocessamento em curso, deverá pagar novamente a Taxa de Abertura de Processo (TAP) vigente e terá o seu novo Nada Consta no prazo médio de 15 dias úteis.",
    "",
    "CLÁUSULA QUINTA - DO VALOR E FORMA DE PAGAMENTO",
    "5.1 Pelo presente contrato, o CONTRATANTE pagará à CONTRATADA:",
    `I - Taxa de Abertura de Processo (TAP): ${tap};`,
    `II - Honorários de Consultoria e Intermediação: ${fee};`,
    `Valor total contratado: ${total}.`,
    `O valor acordado será pago por: ${payment}.`,
    "5.2 O pagamento deverá ser realizado em até 15 (quinze) dias úteis da assinatura.",
    "5.3 Em caso de inadimplência, os serviços ficarão suspensos temporariamente até a regularização. Durante esse período, a garantia contratual ficará suspensa, retomando seus efeitos com a quitação.",
    "",
    "CLÁUSULA SEXTA - DA MULTA CONTRATUAL",
    "6.1 Em caso de descumprimento contratual pelo CONTRATANTE, incluindo, mas não se limitando a fornecimento de informações falsas, inadimplência não regularizada, tentativa de contratação paralela de serviços idênticos ou desistência injustificada, será aplicada multa compensatória de até R$ 5.000,00 (cinco mil reais), proporcional ao valor do contrato e limitada ao montante efetivamente contratado.",
    "",
    "CLÁUSULA SÉTIMA - DAS RESPONSABILIDADES DA CONTRATADA",
    "7.1 A CONTRATADA se compromete a realizar a consultoria e intermediação de forma diligente, manter o CONTRATANTE informado sobre o andamento e intermediar com parceiros especializados devidamente habilitados.",
    "7.2 A CONTRATADA não se responsabiliza por decisão desfavorável judicial ou administrativa, eventual queda de liminar ou retorno de restrições, restrições novas e não relacionadas ao objeto inicial ou expectativas de concessão de crédito não atendidas.",
    "",
    "CLÁUSULA OITAVA - DAS DECLARAÇÕES DO CONTRATANTE",
    "8.1 O CONTRATANTE declara que está ciente de que a CONTRATADA não presta serviços jurídicos diretos, reconhece que não há garantia de êxito, reconhece que o serviço não extingue ou quita a dívida original e está informado sobre a possibilidade de uso de ações coletivas.",
    "",
    "CLÁUSULA NONA - DO FORO",
    `9.1 Fica eleito o foro da ${settings.forum} para dirimir quaisquer litígios oriundos deste contrato.`,
    "",
    `E por estarem justos e contratados, firmam o presente instrumento em 02 (duas) vias de igual teor, juntamente com 02 (duas) testemunhas, para que produza seus jurídicos e legais efeitos. ${form.local || settings.defaultLocal}, ${formatLongDate(form.contractDate)}.`,
    "",
    "CONTRATANTE: ________________________________",
    "CONTRATADA: _________________________________",
    `RESPONSÁVEL PELA VENDA: ${form.seller || "________________"}`,
  ].join("\n");
}

function buildConsultoriaCreditoContractText(form: ContractForm, settings: ContractSettings) {
  const tap = formatBRL(parseCurrencyInput(form.tapValue));
  const fee = formatBRL(parseCurrencyInput(form.feeValue));
  const total = formatBRL(parseCurrencyInput(form.tapValue) + parseCurrencyInput(form.feeValue));
  const payment = getPaymentDescription(form);

  return [
    "CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE CONSULTORIA EM CRÉDITO",
    "",
    "Pelo presente instrumento particular de contrato, de um lado:",
    "",
    `CONTRATADA: ${settings.companyName}, pessoa jurídica de direito privado, inscrita no CNPJ sob nº ${settings.companyDoc || "[CNPJ]"}, com sede em ${settings.companyAddress || "[endereço da empresa]"}, neste ato representada por seu representante legal ${settings.legalRepresentative || "[representante legal]"}, doravante denominada CONTRATADA.`,
    "",
    `CONTRATANTE: ${form.clientName || "[Nome do cliente]"}, CPF/CNPJ nº ${form.clientDoc || "[CPF/CNPJ]"}, RG nº ${form.clientRg || "[RG]"}, residente e domiciliado(a) em ${form.clientAddress || "[endereço]"}, doravante denominado(a) CONTRATANTE.`,
    "",
    "CLÁUSULA PRIMEIRA - DO OBJETO",
    "1.1 O presente contrato tem por objeto a prestação de serviços de Consultoria em Crédito.",
    "1.2 Os serviços compreendem consultoria e intermediação administrativa relacionada à contestação de apontamentos restritivos em cadastros de crédito (SPC, Serasa, Boa Vista, Cenprot e similares), reestruturação de Rating de Crédito, atualização cadastral, atualização de classificação e pontuação de crédito.",
    "1.3 A CONTRATADA atua exclusivamente na função de consultoria, gestão administrativa e intermediação, conectando o CONTRATANTE a parceiros habilitados quando necessário.",
    "1.4 A CONTRATADA não executa serviços jurídicos próprios, não atua como escritório de advocacia e não presta assessoria jurídica direta.",
    "",
    "CLÁUSULA SEGUNDA - DA NATUREZA DO SERVIÇO",
    "2.1 O CONTRATANTE declara estar ciente de que:",
    "I - O serviço contratado não implica na quitação, renegociação ou extinção da dívida originária;",
    "II - O objetivo é melhorar o perfil creditício e/ou questionar a legitimidade de apontamentos restritivos quando aplicável;",
    "III - Não há garantia de aprovação de crédito;",
    "IV - O acompanhamento será realizado por meio de relatórios e informações fornecidas pela CONTRATADA.",
    "",
    "CLÁUSULA TERCEIRA - DO PRAZO",
    `3.1 O prazo estimado para conclusão inicial dos procedimentos é de ${settings.initialDeadline}, prorrogáveis por igual período em caso de necessidade técnica.`,
    "3.2 Caso, após o prazo de 120 (cento e vinte) dias úteis, não seja possível apresentar documento que comprove a retirada do apontamento ou conclusão do serviço contratado, poderá ser solicitado pelo CONTRATANTE o reembolso dos valores pagos, desde que não haja inadimplência.",
    "",
    "CLÁUSULA QUARTA - DA GARANTIA",
    `4.1 O CONTRATANTE terá cobertura de ${settings.warrantyMonths} meses contados a partir da entrega do documento comprobatório de conclusão do serviço.`,
    "4.2 Caso surjam novos apontamentos restritivos dentro deste período, a CONTRATADA providenciará, sem custos adicionais, a intermediação para novo protocolo.",
    "4.3 Caso as restrições contestadas retornem durante a garantia, o processo será refeito dentro do prazo previsto na Cláusula Terceira.",
    "4.4 Caso o CONTRATANTE opte por ingressar em novo processo sem aguardar o reprocessamento em curso, deverá pagar novamente a Taxa de Abertura de Processo (TAP) vigente.",
    "",
    "CLÁUSULA QUINTA - DO VALOR E FORMA DE PAGAMENTO",
    "5.1 Pelo presente contrato, o CONTRATANTE pagará à CONTRATADA:",
    `I - Taxa de Abertura de Processo (TAP): ${tap};`,
    `II - Honorários de Consultoria em Crédito: ${fee};`,
    `Valor total contratado: ${total}.`,
    `Forma de pagamento: ${payment}.`,
    "5.2 O pagamento deverá ser realizado em até 15 (quinze) dias úteis da assinatura.",
    "5.3 Em caso de inadimplência, os serviços ficarão suspensos temporariamente até a regularização.",
    "",
    "CLÁUSULA SEXTA - DAS OBRIGAÇÕES DO CONTRATANTE",
    "6.1 Fornecer todas as informações e documentos solicitados.",
    "6.2 Não realizar múltiplas consultas de CPF durante a execução do serviço.",
    "6.3 Não atrasar pagamentos de contas de consumo, financiamentos, empréstimos, cartões ou demais obrigações financeiras.",
    "6.4 Seguir as orientações fornecidas pela consultoria para não prejudicar a recuperação do crédito.",
    "6.5 Fornecer informações verdadeiras.",
    "",
    "CLÁUSULA SÉTIMA - DAS RESPONSABILIDADES DA CONTRATADA",
    "7.1 A CONTRATADA se compromete a realizar a consultoria e intermediação de forma diligente.",
    "7.2 A CONTRATADA não se responsabiliza por:",
    "I - Decisão desfavorável judicial ou administrativa;",
    "II - Cheques devolvidos (CCF);",
    "III - Quitação de dívidas;",
    "IV - Aprovação de crédito por instituições financeiras;",
    "V - Restrições novas não relacionadas ao objeto inicial.",
    "",
    "CLÁUSULA OITAVA - DAS DECLARAÇÕES DO CONTRATANTE",
    "8.1 O CONTRATANTE declara que está ciente de que a CONTRATADA atua apenas como consultoria e intermediadora, que não há garantia de êxito ou aprovação de crédito e que o serviço não extingue dívidas existentes.",
    "",
    "CLÁUSULA NONA - DO FORO",
    `9.1 Fica eleito o foro da ${settings.forum} para dirimir quaisquer litígios oriundos deste contrato.`,
    "",
    `E por estarem justos e contratados, firmam o presente instrumento em 02 (duas) vias de igual teor, juntamente com 02 (duas) testemunhas, para que produza seus jurídicos e legais efeitos. ${form.local || settings.defaultLocal}, ${formatLongDate(form.contractDate)}.`,
    "",
    "CONTRATANTE: ________________________________",
    "CONTRATADA: _________________________________",
    "TESTEMUNHA 1: _______________________________ CPF: __________________",
    "TESTEMUNHA 2: _______________________________ CPF: __________________",
    `RESPONSÁVEL PELA VENDA: ${form.seller || "________________"}`,
  ].join("\n");
}

function buildRatingContractText(form: ContractForm, settings: ContractSettings) {
  const total = formatBRL(parseCurrencyInput(form.tapValue) + parseCurrencyInput(form.feeValue));
  const payment = getPaymentDescription(form);

  return [
    "CONTRATO DE PRESTAÇÃO DE SERVIÇOS",
    "PROGRAMA RATING DE ORGANIZAÇÃO E POSICIONAMENTO CREDITÍCIO",
    "",
    `${form.local || settings.defaultLocal}, ${formatLongDate(form.contractDate)}.`,
    "",
    `CONTRATADA: ${settings.companyName}, CNPJ ${settings.companyDoc || "[CNPJ]"}, com sede em ${settings.companyAddress}, representada por ${settings.legalRepresentative}.`,
    `CONTRATANTE: ${form.clientName || "[Nome do cliente]"}, CPF/CNPJ ${form.clientDoc || "[CPF/CNPJ]"}, RG ${form.clientRg || "[RG]"}, residente em ${form.clientAddress || "[endereço]"}, doravante denominado CONTRATANTE.`,
    "",
    `Descrição do serviço: ${form.service || "Rating Bancário"}.`,
    `Custo do serviço: ${total}. Forma de pagamento: ${payment}.`,
    "",
    "1. CLÁUSULA GERAL",
    "1.1 Considera-se Rating a metodologia própria adotada pela CONTRATADA, consistente na análise, organização, estruturação e direcionamento estratégico das informações creditícias do CONTRATANTE, com objetivo de promover melhor posicionamento e condução de sua situação perante o mercado, não se confundindo com pontuação de score, classificação oficial de risco ou qualquer índice atribuído por instituições financeiras ou órgãos de proteção ao crédito.",
    "1.2 Em caso de não cumprimento das obrigações por parte da CONTRATADA dentro do prazo estipulado, poderá o cliente optar pelo cancelamento do serviço somente em caso de atrasos que superem 60 dias úteis a partir da data de depósito, podendo pleitear a devolução do valor pago com multa de até 10% sobre o valor do contrato.",
    "1.3 Em caso de não cumprimento do contrato por parte do CONTRATANTE e, ainda, em caso de serviço parcelado, será cobrada multa de 10% sobre o valor deste contrato.",
    "1.4 Esta proposta inclui o serviço de reestruturação do Rating de Crédito, não abrangendo BACEN e CCF, estando o CONTRATANTE ciente desta informação.",
    "",
    "2. DO OBJETO DO CONTRATO",
    "2.1 O presente contrato tem por objeto a prestação, pela CONTRATADA, de serviços especializados no âmbito da metodologia denominada Rating, consistente na análise do perfil, organização, estruturação e direcionamento estratégico das informações creditícias do CONTRATANTE.",
    "2.2 A CONTRATADA utiliza abordagem técnica voltada ao aprimoramento do posicionamento do perfil do CONTRATANTE perante o mercado, incluindo identificação de inconsistências cadastrais, orientação quanto às medidas administrativas cabíveis e, quando necessário, intermediação com parceiros habilitados.",
    "2.3 A CONTRATADA se compromete ao prazo de entrega de até 30 dias úteis para a parte administrativa e de até 60 dias úteis para a atualização completa do cadastro do CONTRATANTE, observados fatores sistêmicos de cada instituição.",
    "2.4 As informações passadas antes da assinatura, no momento do checklist, são de total responsabilidade do CONTRATANTE.",
    "",
    "3. DAS OBRIGAÇÕES DO CONTRATANTE",
    "3.1 Fornecer informações completas, verídicas e atualizadas, bem como documentos necessários à análise de sua situação creditícia.",
    "3.2 Seguir as orientações da CONTRATADA, entendendo que o serviço funciona melhor quando há cooperação entre as partes.",
    "3.3 Manter comportamento financeiro ilibado e evitar solicitações excessivas de crédito, consultas excessivas ao CPF/CNPJ, atrasos de contas, decisões financeiras prejudiciais e demais atos que possam comprometer o processo de Rating.",
    "3.4 O CONTRATANTE declara ciência de que o CONTRATADO não se responsabiliza por cheques devolvidos, quitação de dívidas, processos ou débitos existentes em seu nome.",
    "",
    "4. DAS OBRIGAÇÕES DA CONTRATADA",
    "4.1 O CONTRATANTE está ciente de que o serviço Rating é baseado em análise, orientação e estratégia, não havendo garantia de resultado específico, como aprovação de crédito, aumento de score ou retirada de registros.",
    "4.2 A CONTRATADA não se responsabiliza por negativa de crédito por instituições financeiras, manutenção ou inclusão de registros por terceiros, alterações nas regras de análise de crédito ou existência de dívidas legítimas.",
    "4.3 Eventual responsabilidade da CONTRATADA ficará limitada ao valor efetivamente pago pelo CONTRATANTE neste contrato.",
    "",
    "5. DO INADIMPLEMENTO, DESCUMPRIMENTO E MULTA",
    "5.1 Em caso de inadimplência do CONTRATANTE quanto ao pagamento do serviço, incidirá multa de 10% sobre o valor total, juros de mora de 1% ao mês e correção monetária.",
    "5.2 A inadimplência poderá suspender temporariamente a execução do serviço até a regularização e poderá levar o débito à cobrança administrativa, protesto ou via judicial, conforme legislação aplicável.",
    "5.3 Não poderá o presente instrumento ser rescindido unilateralmente e sem motivo por nenhuma das partes, sob pena de responsabilização por danos materiais, lucros cessantes e multa.",
    "",
    "6. DO COMPROMISSO COM A EXECUÇÃO DO SERVIÇO",
    "6.1 A CONTRATADA assume o compromisso de realizar o serviço em até 60 dias úteis, tendo como marco inicial a assinatura e confirmação do pagamento.",
    "6.2 O prazo poderá ser prorrogado por motivo de força maior, recesso, calamidade pública, prorrogação de prazos ou qualquer outro motivo que impeça a atuação da empresa.",
    "",
    "7. DAS CONDIÇÕES GERAIS",
    "7.1 Fica de comum acordo a inexistência de vínculo trabalhista entre as partes.",
    "7.2 O CONTRATANTE autoriza a CONTRATADA a utilizar, para fins institucionais e de divulgação de resultados, informações relacionadas ao andamento ou conclusão do serviço, desde que de forma genérica e sem identificação direta.",
    "",
    "8. DO FORO",
    `8.1 As partes elegem o foro da ${settings.forum} para dirimir controvérsias inerentes ao presente contrato.`,
    "",
    "CONTRATADA: _________________________________",
    "CONTRATANTE: ________________________________",
    "TESTEMUNHA 1: _______________________________",
    "TESTEMUNHA 2: _______________________________",
    `RESPONSÁVEL PELA VENDA: ${form.seller || "________________"}`,
  ].join("\n");
}

function buildRatingPrintableHtml(
  form: ContractForm,
  settings: ContractSettings,
  evidence?: ContractPrintEvidence,
) {
  const total = formatBRL(parseCurrencyInput(form.tapValue) + parseCurrencyInput(form.feeValue));
  const payment = getPaymentDescription(form);
  const signatureEvidence = buildSignatureEvidenceHtml(evidence);

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Contrato Rating - ${escapeHtml(form.clientName || "Cliente")}</title>
<style>
  @page { size: A4; margin: 18mm 17mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #111; background: #fff; font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 1.52; }
  main { max-width: 780px; margin: 0 auto; }
  h1 { margin: 0 0 6px; text-align: center; font-size: 15px; line-height: 1.35; text-transform: uppercase; }
  .subtitle { margin: 0 0 18px; text-align: center; font-size: 11px; }
  h2 { margin: 16px 0 7px; font-size: 12px; text-transform: uppercase; }
  p { margin: 0 0 8px; text-align: justify; }
  .party { margin-bottom: 10px; }
  .highlight { border: 1px solid #d7d7d7; padding: 8px 10px; margin: 10px 0; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 34px 44px; margin-top: 42px; page-break-inside: avoid; }
  .signature { text-align: center; }
  .line { border-top: 1px solid #111; padding-top: 5px; }
  .muted { color: #444; font-size: 11px; }
  .avoid-break { page-break-inside: avoid; }
  .signature-evidence { margin-top: 24px; padding-top: 14px; border-top: 1px solid #ddd; page-break-inside: avoid; }
  .signature-evidence h2 { margin-top: 0; }
  .evidence-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 10px; }
  .evidence-grid img { width: 100%; max-height: 150px; object-fit: contain; border: 1px solid #ddd; padding: 8px; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<main>
  <h1>Contrato de Prestação de Serviços</h1>
  <p class="subtitle">Programa Rating de Organização e Posicionamento Creditício</p>
  <p class="party"><strong>CONTRATADA:</strong> ${escapeHtml(settings.companyName)}, CNPJ ${escapeHtml(settings.companyDoc || "[CNPJ]")}, com sede em ${escapeHtml(settings.companyAddress)}, representada por ${escapeHtml(settings.legalRepresentative)}.</p>
  <p class="party"><strong>CONTRATANTE:</strong> ${escapeHtml(form.clientName || "[Nome do cliente]")}, CPF/CNPJ ${escapeHtml(form.clientDoc || "[CPF/CNPJ]")}, RG ${escapeHtml(form.clientRg || "[RG]")}, residente em ${escapeHtml(form.clientAddress || "[endereço]")}.</p>
  <div class="highlight avoid-break">
    <p><strong>Descrição do serviço:</strong> ${escapeHtml(form.service || "Rating Bancário")}</p>
    <p><strong>Custo do serviço:</strong> ${escapeHtml(total)}</p>
    <p><strong>Forma de pagamento:</strong> ${escapeHtml(payment)}</p>
  </div>

  <h2>1. Cláusula geral</h2>
  <p>1.1 Considera-se Rating a metodologia própria adotada pela CONTRATADA, consistente na análise, organização, estruturação e direcionamento estratégico das informações creditícias do CONTRATANTE, com objetivo de promover melhor posicionamento e condução de sua situação perante o mercado, não se confundindo com pontuação de score, classificação oficial de risco ou qualquer índice atribuído por instituições financeiras ou órgãos de proteção ao crédito.</p>
  <p>1.2 Em caso de não cumprimento das obrigações por parte da CONTRATADA dentro do prazo estipulado, poderá o cliente optar pelo cancelamento do serviço somente em caso de atrasos que superem 60 dias úteis a partir da data de depósito, podendo pleitear a devolução do valor pago com multa de até 10% sobre o valor do contrato.</p>
  <p>1.3 Em caso de não cumprimento do contrato por parte do CONTRATANTE e, ainda, em caso de serviço parcelado, será cobrada multa de 10% sobre o valor deste contrato.</p>
  <p>1.4 Esta proposta inclui o serviço de reestruturação do Rating de Crédito, não abrangendo BACEN e CCF, estando o CONTRATANTE ciente desta informação.</p>

  <h2>2. Do objeto do contrato</h2>
  <p>2.1 O presente contrato tem por objeto a prestação, pela CONTRATADA, de serviços especializados no âmbito da metodologia denominada Rating, consistente na análise do perfil, organização, estruturação e direcionamento estratégico das informações creditícias do CONTRATANTE.</p>
  <p>2.2 A CONTRATADA utiliza abordagem técnica voltada ao aprimoramento do posicionamento do perfil do CONTRATANTE perante o mercado, incluindo identificação de inconsistências cadastrais, orientação quanto às medidas administrativas cabíveis e, quando necessário, intermediação com parceiros habilitados.</p>
  <p>2.3 A CONTRATADA se compromete ao prazo de entrega de até 30 dias úteis para a parte administrativa e de até 60 dias úteis para a atualização completa do cadastro do CONTRATANTE, observados fatores sistêmicos de cada instituição.</p>
  <p>2.4 As informações passadas antes da assinatura, no momento do checklist, são de total responsabilidade do CONTRATANTE.</p>

  <h2>3. Das obrigações do contratante</h2>
  <p>3.1 O CONTRATANTE deve fornecer informações completas, verídicas e atualizadas, bem como todos os documentos necessários à análise de sua situação creditícia.</p>
  <p>3.2 O CONTRATANTE deve seguir as orientações da CONTRATADA e manter comportamento financeiro adequado, evitando solicitações excessivas de crédito, consultas excessivas ao CPF/CNPJ, atrasos em contas, decisões financeiras prejudiciais e demais condutas que possam comprometer o processo de Rating.</p>
  <p>3.3 O CONTRATANTE declara ter ciência de que a CONTRATADA não se responsabiliza por cheques devolvidos, quitação de dívidas, processos ou débitos existentes em seu nome.</p>

  <h2>4. Das obrigações da contratada</h2>
  <p>4.1 O CONTRATANTE está ciente de que o serviço Rating é baseado em análise, orientação e estratégia, não havendo garantia de resultado específico, como aprovação de crédito, aumento de score ou retirada de registros.</p>
  <p>4.2 A CONTRATADA não se responsabiliza por negativa de crédito por instituições financeiras, manutenção ou inclusão de registros por terceiros, alterações nas regras de análise de crédito ou existência de dívidas legítimas.</p>
  <p>4.3 Eventual responsabilidade da CONTRATADA ficará limitada ao valor efetivamente pago pelo CONTRATANTE neste contrato.</p>

  <h2>5. Do inadimplemento, descumprimento e multa</h2>
  <p>5.1 Em caso de inadimplência do CONTRATANTE quanto ao pagamento do serviço, incidirá multa de 10% sobre o valor total, juros de mora de 1% ao mês e correção monetária.</p>
  <p>5.2 A inadimplência poderá suspender temporariamente a execução do serviço até a regularização e poderá levar o débito à cobrança administrativa, protesto ou via judicial, conforme legislação aplicável.</p>
  <p>5.3 Não poderá o presente instrumento ser rescindido unilateralmente e sem motivo por nenhuma das partes, sob pena de responsabilização por danos materiais, lucros cessantes e multa.</p>

  <h2>6. Do compromisso com a execução do serviço</h2>
  <p>6.1 A CONTRATADA assume o compromisso de realizar o serviço em até 60 dias úteis, tendo como marco inicial a assinatura e confirmação do pagamento.</p>
  <p>6.2 O prazo poderá ser prorrogado por motivo de força maior, recesso, calamidade pública, prorrogação de prazos ou qualquer outro motivo que impeça a atuação da empresa.</p>

  <h2>7. Das condições gerais</h2>
  <p>7.1 Fica de comum acordo a inexistência de vínculo trabalhista entre as partes.</p>
  <p>7.2 O CONTRATANTE autoriza a CONTRATADA a utilizar, para fins institucionais e de divulgação de resultados, informações relacionadas ao andamento ou conclusão do serviço, desde que de forma genérica e sem identificação direta.</p>

  <h2>8. Do foro</h2>
  <p>8.1 As partes elegem o foro da ${escapeHtml(settings.forum)} para dirimir controvérsias inerentes ao presente contrato.</p>
  <p class="avoid-break">${escapeHtml(form.local || settings.defaultLocal)}, ${escapeHtml(formatLongDate(form.contractDate))}.</p>

  <section class="signatures">
    <div class="signature"><div class="line">CONTRATADA</div><div class="muted">${escapeHtml(settings.companyName)}</div></div>
    <div class="signature"><div class="line">CONTRATANTE</div><div class="muted">${escapeHtml(form.clientName || "Cliente")}</div></div>
    <div class="signature"><div class="line">TESTEMUNHA 1</div></div>
    <div class="signature"><div class="line">TESTEMUNHA 2</div></div>
    <div class="signature"><div class="line">RESPONSÁVEL PELA VENDA</div><div class="muted">${escapeHtml(form.seller || "Vendedor responsável")}${form.sellerRole ? ` - ${escapeHtml(form.sellerRole)}` : ""}</div></div>
  </section>
  ${signatureEvidence}
</main>
</body>
</html>`;
}

function buildConsultoriaCreditoPrintableHtml(
  form: ContractForm,
  settings: ContractSettings,
  evidence?: ContractPrintEvidence,
) {
  const tap = formatBRL(parseCurrencyInput(form.tapValue));
  const fee = formatBRL(parseCurrencyInput(form.feeValue));
  const total = formatBRL(parseCurrencyInput(form.tapValue) + parseCurrencyInput(form.feeValue));
  const payment = getPaymentDescription(form);
  const signatureEvidence = buildSignatureEvidenceHtml(evidence);

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Contrato Consultoria de Crédito - ${escapeHtml(form.clientName || "Cliente")}</title>
<style>
  @page { size: A4; margin: 18mm 17mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #111; background: #fff; font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 1.52; }
  main { max-width: 780px; margin: 0 auto; }
  h1 { margin: 0 0 18px; text-align: center; font-size: 15px; line-height: 1.35; text-transform: uppercase; }
  h2 { margin: 16px 0 7px; font-size: 12px; text-transform: uppercase; }
  p { margin: 0 0 8px; text-align: justify; }
  .party { margin-bottom: 10px; }
  .highlight { border: 1px solid #d7d7d7; padding: 8px 10px; margin: 10px 0; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 34px 44px; margin-top: 42px; page-break-inside: avoid; }
  .signature { text-align: center; }
  .line { border-top: 1px solid #111; padding-top: 5px; }
  .muted { color: #444; font-size: 11px; }
  .avoid-break { page-break-inside: avoid; }
  .signature-evidence { margin-top: 24px; padding-top: 14px; border-top: 1px solid #ddd; page-break-inside: avoid; }
  .signature-evidence h2 { margin-top: 0; }
  .evidence-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 10px; }
  .evidence-grid img { width: 100%; max-height: 150px; object-fit: contain; border: 1px solid #ddd; padding: 8px; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<main>
  <h1>Contrato de Prestação de Serviços de Consultoria em Crédito</h1>

  <p class="party">Pelo presente instrumento particular de contrato, de um lado:</p>
  <p class="party"><strong>CONTRATADA:</strong> ${escapeHtml(settings.companyName)}, pessoa jurídica de direito privado, inscrita no CNPJ sob nº ${escapeHtml(settings.companyDoc || "[CNPJ]")}, com sede em ${escapeHtml(settings.companyAddress || "[endereço da empresa]")}, neste ato representada por seu representante legal ${escapeHtml(settings.legalRepresentative || "[representante legal]")}, doravante denominada CONTRATADA.</p>
  <p class="party"><strong>CONTRATANTE:</strong> ${escapeHtml(form.clientName || "[Nome do cliente]")}, CPF/CNPJ nº ${escapeHtml(form.clientDoc || "[CPF/CNPJ]")}, RG nº ${escapeHtml(form.clientRg || "[RG]")}, residente e domiciliado(a) em ${escapeHtml(form.clientAddress || "[endereço]")}, doravante denominado(a) CONTRATANTE.</p>

  <div class="highlight avoid-break">
    <p><strong>Serviço contratado:</strong> ${escapeHtml(form.service || "Consultoria de Crédito")}</p>
    <p><strong>Taxa de Abertura de Processo (TAP):</strong> ${escapeHtml(tap)}</p>
    <p><strong>Honorários de Consultoria em Crédito:</strong> ${escapeHtml(fee)}</p>
    <p><strong>Valor total contratado:</strong> ${escapeHtml(total)}</p>
    <p><strong>Forma de pagamento:</strong> ${escapeHtml(payment)}</p>
  </div>

  <h2>Cláusula Primeira - Do Objeto</h2>
  <p>1.1 O presente contrato tem por objeto a prestação de serviços de Consultoria em Crédito.</p>
  <p>1.2 Os serviços compreendem consultoria e intermediação administrativa relacionada à contestação de apontamentos restritivos em cadastros de crédito (SPC, Serasa, Boa Vista, Cenprot e similares), reestruturação de Rating de Crédito, atualização cadastral, atualização de classificação e pontuação de crédito.</p>
  <p>1.3 A CONTRATADA atua exclusivamente na função de consultoria, gestão administrativa e intermediação, conectando o CONTRATANTE a parceiros habilitados quando necessário.</p>
  <p>1.4 A CONTRATADA não executa serviços jurídicos próprios, não atua como escritório de advocacia e não presta assessoria jurídica direta.</p>

  <h2>Cláusula Segunda - Da Natureza do Serviço</h2>
  <p>2.1 O CONTRATANTE declara estar ciente de que:</p>
  <p>I - O serviço contratado não implica na quitação, renegociação ou extinção da dívida originária;</p>
  <p>II - O objetivo é melhorar o perfil creditício e/ou questionar a legitimidade de apontamentos restritivos quando aplicável;</p>
  <p>III - Não há garantia de aprovação de crédito;</p>
  <p>IV - O acompanhamento será realizado por meio de relatórios e informações fornecidas pela CONTRATADA.</p>

  <h2>Cláusula Terceira - Do Prazo</h2>
  <p>3.1 O prazo estimado para conclusão inicial dos procedimentos é de ${escapeHtml(settings.initialDeadline)}, prorrogáveis por igual período em caso de necessidade técnica.</p>
  <p>3.2 Caso, após o prazo de 120 (cento e vinte) dias úteis, não seja possível apresentar documento que comprove a retirada do apontamento ou conclusão do serviço contratado, poderá ser solicitado pelo CONTRATANTE o reembolso dos valores pagos, desde que não haja inadimplência.</p>

  <h2>Cláusula Quarta - Da Garantia</h2>
  <p>4.1 O CONTRATANTE terá cobertura de ${escapeHtml(settings.warrantyMonths)} meses contados a partir da entrega do documento comprobatório de conclusão do serviço.</p>
  <p>4.2 Caso surjam novos apontamentos restritivos dentro deste período, a CONTRATADA providenciará, sem custos adicionais, a intermediação para novo protocolo.</p>
  <p>4.3 Caso as restrições contestadas retornem durante a garantia, o processo será refeito dentro do prazo previsto na Cláusula Terceira.</p>
  <p>4.4 Caso o CONTRATANTE opte por ingressar em novo processo sem aguardar o reprocessamento em curso, deverá pagar novamente a Taxa de Abertura de Processo (TAP) vigente.</p>

  <h2>Cláusula Quinta - Do Valor e Forma de Pagamento</h2>
  <p>5.1 Pelo presente contrato, o CONTRATANTE pagará à CONTRATADA a Taxa de Abertura de Processo (TAP) no valor de ${escapeHtml(tap)} e Honorários de Consultoria em Crédito no valor de ${escapeHtml(fee)}, totalizando ${escapeHtml(total)}.</p>
  <p>5.2 O pagamento deverá ser realizado em até 15 (quinze) dias úteis da assinatura.</p>
  <p>5.3 Em caso de inadimplência, os serviços ficarão suspensos temporariamente até a regularização.</p>

  <h2>Cláusula Sexta - Das Obrigações do Contratante</h2>
  <p>6.1 Fornecer todas as informações e documentos solicitados.</p>
  <p>6.2 Não realizar múltiplas consultas de CPF durante a execução do serviço.</p>
  <p>6.3 Não atrasar pagamentos de contas de consumo, financiamentos, empréstimos, cartões ou demais obrigações financeiras.</p>
  <p>6.4 Seguir as orientações fornecidas pela consultoria para não prejudicar a recuperação do crédito.</p>
  <p>6.5 Fornecer informações verdadeiras.</p>

  <h2>Cláusula Sétima - Das Responsabilidades da Contratada</h2>
  <p>7.1 A CONTRATADA se compromete a realizar a consultoria e intermediação de forma diligente.</p>
  <p>7.2 A CONTRATADA não se responsabiliza por decisão desfavorável judicial ou administrativa, cheques devolvidos (CCF), quitação de dívidas, aprovação de crédito por instituições financeiras ou restrições novas não relacionadas ao objeto inicial.</p>

  <h2>Cláusula Oitava - Das Declarações do Contratante</h2>
  <p>8.1 O CONTRATANTE declara que está ciente de que a CONTRATADA atua apenas como consultoria e intermediadora, que não há garantia de êxito ou aprovação de crédito e que o serviço não extingue dívidas existentes.</p>

  <h2>Cláusula Nona - Do Foro</h2>
  <p>9.1 Fica eleito o foro da ${escapeHtml(settings.forum)} para dirimir quaisquer litígios oriundos deste contrato.</p>

  <p class="avoid-break">E por estarem justos e contratados, firmam o presente instrumento em 02 (duas) vias de igual teor, juntamente com 02 (duas) testemunhas, para que produza seus jurídicos e legais efeitos.</p>
  <p class="avoid-break">${escapeHtml(form.local || settings.defaultLocal)}, ${escapeHtml(formatLongDate(form.contractDate))}.</p>

  <section class="signatures">
    <div class="signature"><div class="line">CONTRATANTE</div><div class="muted">${escapeHtml(form.clientName || "Cliente")}</div></div>
    <div class="signature"><div class="line">CONTRATADA</div><div class="muted">${escapeHtml(settings.companyName)}</div></div>
    <div class="signature"><div class="line">TESTEMUNHA 1</div><div class="muted">CPF: __________________</div></div>
    <div class="signature"><div class="line">TESTEMUNHA 2</div><div class="muted">CPF: __________________</div></div>
    <div class="signature"><div class="line">RESPONSÁVEL PELA VENDA</div><div class="muted">${escapeHtml(form.seller || "Vendedor responsável")}${form.sellerRole ? ` - ${escapeHtml(form.sellerRole)}` : ""}</div></div>
  </section>
  ${signatureEvidence}
</main>
</body>
</html>`;
}

export function buildFullPrintableHtml(
  form: ContractForm,
  settings: ContractSettings,
  evidence?: ContractPrintEvidence,
) {
  if (form.contractTemplate === "rating") {
    return buildRatingPrintableHtml(form, settings, evidence);
  }
  if (form.contractTemplate === "consultoria_credito") {
    return buildConsultoriaCreditoPrintableHtml(form, settings, evidence);
  }

  const tap = formatBRL(parseCurrencyInput(form.tapValue));
  const fee = formatBRL(parseCurrencyInput(form.feeValue));
  const total = formatBRL(parseCurrencyInput(form.tapValue) + parseCurrencyInput(form.feeValue));
  const mark = (active: boolean) => `<span class="checkbox">${active ? "X" : ""}</span>`;
  const avistaLabel = form.paymentMethod === "avista" ? getPaymentDescription(form) : "À vista/Pix";
  const creditLabel = form.paymentMethod === "credito" ? getPaymentDescription(form) : "Cartão de Crédito";
  const prazoPixLabel =
    form.paymentMethod === "prazo_pix" ? getPaymentDescription(form) : "Prazo Pix";
  const signatureEvidence = buildSignatureEvidenceHtml(evidence);

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Contrato - ${escapeHtml(form.clientName || "Cliente")}</title>
<style>
  @page { size: A4; margin: 18mm 17mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    color: #111;
    background: #fff;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    line-height: 1.52;
  }
  main { max-width: 780px; margin: 0 auto; }
  h1 {
    margin: 0 0 6px;
    text-align: center;
    font-size: 15px;
    line-height: 1.35;
    text-transform: uppercase;
  }
  .subtitle {
    margin: 0 0 18px;
    text-align: center;
    font-size: 11px;
  }
  h2 {
    margin: 16px 0 7px;
    font-size: 12px;
    text-transform: uppercase;
  }
  p { margin: 0 0 8px; text-align: justify; }
  .party { margin-bottom: 10px; }
  .payment-box {
    margin: 8px 0 10px;
    padding: 8px 10px;
    border: 1px solid #d7d7d7;
  }
  .payment-row { display: block; margin: 4px 0; }
  .checkbox {
    display: inline-block;
    width: 13px;
    height: 13px;
    margin-right: 6px;
    border: 1px solid #111;
    text-align: center;
    vertical-align: -2px;
    font-size: 10px;
    line-height: 12px;
    font-weight: 700;
  }
  .signatures {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 34px 44px;
    margin-top: 42px;
    page-break-inside: avoid;
  }
  .signature { text-align: center; }
  .line { border-top: 1px solid #111; padding-top: 5px; }
  .muted { color: #444; font-size: 11px; }
  .avoid-break { page-break-inside: avoid; }
  .signature-evidence {
    margin-top: 24px;
    padding-top: 14px;
    border-top: 1px solid #ddd;
    page-break-inside: avoid;
  }
  .signature-evidence h2 { margin-top: 0; }
  .evidence-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-top: 10px;
  }
  .evidence-grid img {
    width: 100%;
    max-height: 150px;
    object-fit: contain;
    border: 1px solid #ddd;
    padding: 8px;
  }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
<main>
  <h1>Contrato de Prestação de Serviços de Consultoria e Intermediação</h1>
  <p class="subtitle">(Serviços Administrativos e de Contestação de Apontamentos em Cadastro de Crédito - "Limpa Nome")</p>

  <p>Pelo presente instrumento particular de contrato, de um lado:</p>
  <p class="party"><strong>CONTRATADA:</strong> ${escapeHtml(settings.companyName)}, pessoa jurídica de direito privado, inscrita no CNPJ sob nº ${escapeHtml(settings.companyDoc || "[CNPJ da empresa]")}, com sede em ${escapeHtml(settings.companyAddress)}, neste ato representada por seu representante legal ${escapeHtml(settings.legalRepresentative)}, doravante denominada CONTRATADA.</p>

  <p>E, de outro lado:</p>
  <p class="party"><strong>CONTRATANTE:</strong> ${escapeHtml(form.clientName || "[Nome do cliente]")}, ${escapeHtml(form.nationality || "[nacionalidade]")}, ${escapeHtml(form.maritalStatus || "[estado civil]")}, ${escapeHtml(form.profession || "[profissão]")}, portador(a) do CPF/CNPJ nº ${escapeHtml(form.clientDoc || "[CPF/CNPJ]")} e RG nº ${escapeHtml(form.clientRg || "[RG]")}, residente e domiciliado(a) em ${escapeHtml(form.clientAddress || "[endereço]")}, doravante denominado CONTRATANTE.</p>

  <h2>Cláusula Primeira - Do Objeto</h2>
  <p>1.1 O presente contrato tem por objeto a prestação de consultoria e intermediação de serviços administrativos relacionados à contestação de apontamentos restritivos em cadastros de crédito (SPC, Serasa, Boa Vista).</p>
  <p>1.2 A CONTRATADA atua exclusivamente na função de consultoria, gestão administrativa e intermediação, conectando o CONTRATANTE a parceiros jurídicos regularmente habilitados, que são os responsáveis técnicos pela condução dos procedimentos administrativos ou judiciais.</p>
  <p>1.3 A CONTRATADA não executa serviços jurídicos próprios, não atua como escritório de advocacia e não presta assessoria jurídica direta.</p>

  <h2>Cláusula Segunda - Da Natureza do Serviço</h2>
  <p>2.1 O CONTRATANTE declara estar ciente de que:</p>
  <p>- O serviço contratado não implica na quitação, renegociação ou extinção da dívida originária;</p>
  <p>- O objetivo é questionar a legitimidade dos apontamentos restritivos com base no Código de Defesa do Consumidor e normas aplicáveis;</p>
  <p>- Trata-se de medida administrativa ou judicial que pode incluir ações coletivas conduzidas por parceiros especializados;</p>
  <p>- Para resguardar dados sensíveis de todos os envolvidos em ações coletivas, não será fornecido número individual de processo, mas a CONTRATADA garantirá relatórios periódicos sobre o andamento.</p>

  <h2>Cláusula Terceira - Do Prazo</h2>
  <p>3.1 O prazo estimado para conclusão inicial dos procedimentos é de ${escapeHtml(settings.initialDeadline)}, prorrogáveis, por igual período, em caso de necessidade técnica.</p>
  <p>3.2 Caso, após o prazo de 120 (cento e vinte) dias úteis, não seja possível apresentar documento que comprove a retirada do apontamento (ex.: certidão ou consulta atualizada), poderá ser solicitado pelo CONTRATANTE o reembolso dos valores pagos, desde que não haja inadimplência.</p>

  <h2>Cláusula Quarta - Da Garantia</h2>
  <p>4.1 O CONTRATANTE terá cobertura de ${escapeHtml(settings.warrantyMonths)} meses contados a partir da entrega do documento comprobatório de retirada do apontamento.</p>
  <p>4.2 Caso surjam novos apontamentos restritivos no mesmo período, a CONTRATADA providenciará, sem custos adicionais, a intermediação para retirada.</p>
  <p>4.3 Caso as restrições contestadas retornem em razão de eventual queda da liminar, o processo será refeito dentro do mesmo prazo previsto na Cláusula Terceira, estando o CONTRATANTE coberto pela garantia.</p>
  <p>4.4 Caso o CONTRATANTE opte por ingressar em novo processo sem aguardar o reprocessamento em curso, deverá pagar novamente a Taxa de Abertura de Processo (TAP) vigente e terá o seu novo Nada Consta no prazo médio de 15 dias úteis.</p>

  <h2>Cláusula Quinta - Do Valor e Forma de Pagamento</h2>
  <p>5.1 Pelo presente contrato, o CONTRATANTE pagará à CONTRATADA:</p>
  <p>I - Taxa de Abertura de Processo (TAP): ${escapeHtml(tap)}; II - Honorários de Consultoria e Intermediação: ${escapeHtml(fee)}.</p>
  <p><strong>Valor total contratado:</strong> ${escapeHtml(total)}.</p>
  <p>O valor acordado será pago:</p>
  <div class="payment-box avoid-break">
    <span class="payment-row">${mark(form.paymentMethod === "avista")} ${escapeHtml(avistaLabel)}</span>
    <span class="payment-row">${mark(form.paymentMethod === "credito")} ${escapeHtml(creditLabel)}</span>
    <span class="payment-row">${mark(false)} Boleto bancário</span>
    <span class="payment-row">${mark(form.paymentMethod === "prazo_pix")} ${escapeHtml(prazoPixLabel)}</span>
  </div>
  <p>5.2 O pagamento deverá ser realizado em até 15 (quinze) dias úteis da assinatura.</p>
  <p>5.3 Em caso de inadimplência, os serviços ficarão suspensos temporariamente até a regularização. Durante esse período, a garantia contratual ficará suspensa, retomando seus efeitos com a quitação.</p>

  <h2>Cláusula Sexta - Da Multa Contratual</h2>
  <p>6.1 Em caso de descumprimento contratual pelo CONTRATANTE, incluindo, mas não se limitando a fornecimento de informações falsas, inadimplência não regularizada, tentativa de contratação paralela de serviços idênticos ou desistência injustificada, será aplicada multa compensatória de até R$ 5.000,00 (cinco mil reais), proporcional ao valor do contrato e limitada ao montante efetivamente contratado.</p>

  <h2>Cláusula Sétima - Das Responsabilidades da Contratada</h2>
  <p>7.1 A CONTRATADA se compromete a realizar a consultoria e intermediação de forma diligente, manter o CONTRATANTE informado sobre o andamento e intermediar com parceiros especializados devidamente habilitados.</p>
  <p>7.2 A CONTRATADA não se responsabiliza por decisão desfavorável judicial ou administrativa, eventual queda de liminar ou retorno de restrições, restrições novas e não relacionadas ao objeto inicial ou expectativas de concessão de crédito não atendidas.</p>

  <h2>Cláusula Oitava - Das Declarações do Contratante</h2>
  <p>8.1 O CONTRATANTE declara que está ciente de que a CONTRATADA não presta serviços jurídicos diretos, reconhece que não há garantia de êxito, reconhece que o serviço não extingue ou quita a dívida original e está informado sobre a possibilidade de uso de ações coletivas.</p>

  <h2>Cláusula Nona - Do Foro</h2>
  <p>9.1 Fica eleito o foro da ${escapeHtml(settings.forum)} para dirimir quaisquer litígios oriundos deste contrato.</p>

  <p class="avoid-break">E por estarem justos e contratados, firmam o presente instrumento em 02 (duas) vias de igual teor, juntamente com 02 (duas) testemunhas, para que produza seus jurídicos e legais efeitos. ${escapeHtml(form.local || settings.defaultLocal)}, ${escapeHtml(formatLongDate(form.contractDate))}.</p>

  <section class="signatures">
    <div class="signature"><div class="line">CONTRATANTE</div><div class="muted">${escapeHtml(form.clientName || "Cliente")}</div></div>
    <div class="signature"><div class="line">CONTRATADA</div><div class="muted">${escapeHtml(settings.companyName)}</div></div>
    <div class="signature"><div class="line">RESPONSÁVEL PELA VENDA</div><div class="muted">${escapeHtml(form.seller || "Vendedor responsável")}${form.sellerRole ? ` - ${escapeHtml(form.sellerRole)}` : ""}</div></div>
    <div class="signature"><div class="line">TESTEMUNHA</div></div>
  </section>
  ${signatureEvidence}
</main>
</body>
</html>`;
}

function buildSignatureEvidenceHtml(evidence?: ContractPrintEvidence) {
  if (!evidence?.client && !evidence?.seller) return "";

  const evidenceCard = (title: string, item?: ContractSignatureEvidence) => {
    if (!item) {
      return `
      <div>
        <p><strong>${title}</strong></p>
        <p class="muted">Assinatura ainda não registrada.</p>
      </div>`;
    }

    return `
      <div>
        <p><strong>${title}</strong></p>
        <p>${escapeHtml(item.name)} - ${escapeHtml(new Date(item.signedAt).toLocaleString("pt-BR"))}</p>
        <p><strong>Selfie de validação</strong></p>
        <img src="${item.selfie}" alt="Selfie de ${escapeHtml(item.name)}" />
        <p><strong>Assinatura digital</strong></p>
        <img src="${item.signature}" alt="Assinatura de ${escapeHtml(item.name)}" />
      </div>`;
  };

  return `
  <section class="signature-evidence">
    <h2>Registro de Assinaturas Digitais</h2>
    <p><strong>Método:</strong> validação por selfie, assinatura desenhada em tela e aceite eletrônico.</p>
    <div class="evidence-grid">
      ${evidenceCard("Contratante", evidence.client)}
      ${evidenceCard("Responsável pela venda", evidence.seller)}
    </div>
  </section>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

