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

type ContractTemplate = "limpa_nome" | "rating";

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
  initialDeadline: "30 a 45 dias Ãºteis",
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
  notes: "",
};

const defaultRatingService = {
  id: "s6",
  name: "Rating BancÃ¡rio",
  price: 1200,
  cost: 360,
  commission: 180,
  category: "CrÃ©dito",
  status: "ativo",
  sold: 0,
};

const contractTemplateOptions: Array<{ value: ContractTemplate; label: string }> = [
  { value: "limpa_nome", label: "Limpa Nome" },
  { value: "rating", label: "Rating" },
];

const paymentLabels: Record<PaymentMethod, string> = {
  avista: "Ã€ vista/Pix",
  prazo_pix: "Prazo Pix",
  credito: "CartÃ£o de crÃ©dito",
};

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
  const [clientCepLoading, setClientCepLoading] = useState(false);
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
          isRatingService(service.name) ? { ...service, name: "Rating BancÃ¡rio" } : service,
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

  const searchClientCep = async () => {
    const cep = form.clientZip ?? "";
    if (formatCep(cep).length < 9) {
      toast.error("Informe um CEP do cliente com 8 dÃ­gitos.");
      return;
    }

    try {
      setClientCepLoading(true);
      const address = await lookupCepAddress(cep);
      setForm((current) => ({
        ...current,
        clientZip: formatCep(cep),
        clientAddress: formatAddressFromCep(address),
      }));
      toast.success("EndereÃ§o do cliente preenchido pelo CEP.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "NÃ£o foi possÃ­vel consultar o CEP.");
    } finally {
      setClientCepLoading(false);
    }
  };

  const searchCompanyCep = async () => {
    const cep = settings.companyCep ?? "";
    if (formatCep(cep).length < 9) {
      toast.error("Informe um CEP da empresa com 8 dÃ­gitos.");
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
      toast.success("EndereÃ§o da empresa preenchido pelo CEP.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "NÃ£o foi possÃ­vel consultar o CEP.");
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
      contractTemplate === "rating"
        ? isRatingService(service.name)
        : normalizeText(service.name).includes("limpa nome"),
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
    toast.success("Contrato salvo no histÃ³rico local.");
  };

  const copyContract = async () => {
    try {
      await navigator.clipboard.writeText(buildFullContractText(form, settings));
      toast.success("Contrato copiado.");
    } catch {
      toast.error("NÃ£o foi possÃ­vel copiar o contrato.");
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
    toast.success("Contrato excluÃ­do.");
  };

  const removeSignedContract = (id: string) => {
    setSignedContracts((current) => current.filter((contract) => contract.id !== id));
    toast.success("Contrato assinado excluÃ­do.");
  };

  const downloadSignedRecord = (contract: SignedContractRecord) => {
    if (!contract.html) {
      toast.error("Este contrato ainda nÃ£o foi assinado pelas duas partes.");
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
      toast.error("Selecione o vendedor responsÃ¡vel antes de gerar o link dele.");
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
      toast.error("NÃ£o foi possÃ­vel gerar o link curto. Tente novamente.");
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
      toast.error("NÃ£o foi possÃ­vel copiar o link.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contratos"
        subtitle="GeraÃ§Ã£o de contratos Limpa Nome e Rating com dados puxados do CRM e da venda"
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
        <KpiCard label="ResponsÃ¡vel" value={form.seller || "Equipe VA"} icon={Signature} />
        <KpiCard label="Campos prontos" value={`${completion}%`} icon={Settings} accent="success" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <form onSubmit={saveDraft} className="space-y-6">
          <Card className="border-border/60 bg-card/60 p-5">
            <div className="mb-5">
              <h3 className="font-display text-base font-semibold">Dados do contrato</h3>
              <p className="text-xs text-muted-foreground">
                Selecione um cliente do CRM. Os dados principais sÃ£o preenchidos automaticamente.
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
                label="ServiÃ§o contratado"
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
                label="ProfissÃ£o"
                value={form.profession}
                onChange={(value) => updateForm("profession", value)}
                placeholder="Ex: autÃ´noma"
              />
              <div>
                  <ContractField
                    label="CEP do cliente"
                    value={form.clientZip ?? ""}
                    onChange={(value) => updateForm("clientZip", formatCep(value))}
                    onBlur={() => updateForm("clientZip", formatCep(form.clientZip ?? ""))}
                    placeholder="00000-000"
                    inputMode="numeric"
                    maxLength={9}
                  />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={searchClientCep}
                  disabled={clientCepLoading}
                >
                  {clientCepLoading ? "Buscando..." : "Buscar CEP"}
                </Button>
              </div>
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
                  label="EndereÃ§o do cliente"
                  value={form.clientAddress}
                  onChange={(value) => updateForm("clientAddress", value)}
                  placeholder="Rua, nÃºmero, bairro, cidade/UF"
                />
              </div>
            </div>
          </Card>

          <Card className="border-border/60 bg-card/60 p-5">
            <div className="mb-5">
              <h3 className="font-display text-base font-semibold">Pagamento e responsÃ¡vel</h3>
              <p className="text-xs text-muted-foreground">
                O vendedor escolhido aparece como responsÃ¡vel pela assinatura interna.
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
                label="HonorÃ¡rios de consultoria"
                value={form.feeValue}
                onChange={(value) => updateForm("feeValue", value)}
                onBlur={() =>
                  updateForm("feeValue", formatCurrencyInput(parseCurrencyInput(form.feeValue)))
                }
              />
              <ContractSelect
                label="Forma de pagamento"
                value={form.paymentMethod}
                onChange={(value) => updateForm("paymentMethod", value)}
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
                  value={form.paymentMethod === "prazo_pix" ? "Entrada + 30 dias" : "Ã€ vista"}
                  onChange={() => undefined}
                  readOnly
                />
              )}
              <ContractSelect
                label="Vendedor responsÃ¡vel"
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
                label="Cargo/funÃ§Ã£o do vendedor"
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
                <Label>ObservaÃ§Ãµes internas</Label>
                <Textarea
                  value={form.notes}
                  onChange={(event) => updateForm("notes", event.target.value)}
                  placeholder="Use para registrar combinados internos. NÃ£o aparece no contrato impresso."
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
                Essas informaÃ§Ãµes ficam salvas e alimentam todos os contratos.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <ContractField
                label="RazÃ£o/nome da empresa"
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
                label="Sede/endereÃ§o"
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
                label="Local padrÃ£o"
                value={settings.defaultLocal}
                onChange={(value) => updateSettings("defaultLocal", value)}
              />
              <ContractField
                label="Garantia padrÃ£o"
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
                <h3 className="font-display text-base font-semibold">PrÃ©via do contrato</h3>
                <p className="text-xs text-muted-foreground">
                  A prÃ©via abaixo usa o texto-base do contrato enviado.
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
            description="Links enviados ao cliente e ainda nÃ£o finalizados."
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
                    <TableHead>ServiÃ§o</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">AÃ§Ãµes</TableHead>
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
              <TableHead>ServiÃ§o</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">AÃ§Ãµes</TableHead>
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

  return (
    <article className="max-h-[780px] overflow-auto rounded-xl border border-border/60 bg-background p-7 text-sm leading-7 text-foreground shadow-inner">
      <div className="mb-8 text-center">
        <h2 className="font-display text-xl font-bold uppercase">
          Contrato de PrestaÃ§Ã£o de ServiÃ§os de Consultoria e IntermediaÃ§Ã£o
        </h2>
        <p className="mt-2 text-xs text-muted-foreground">
          ServiÃ§os Administrativos e de ContestaÃ§Ã£o de Apontamentos em Cadastro de CrÃ©dito - "Limpa
          Nome"
        </p>
      </div>
      <p>
        Pelo presente instrumento particular de contrato, de um lado, <strong>CONTRATADA:</strong>{" "}
        {settings.companyName}, pessoa jurÃ­dica de direito privado, inscrita no CNPJ sob nÂº{" "}
        {settings.companyDoc || "[CNPJ da empresa]"}, com sede em {settings.companyAddress}, neste
        ato representada por {settings.legalRepresentative}, doravante denominada CONTRATADA.
      </p>
      <p className="mt-4">
        E, de outro lado, <strong>CONTRATANTE:</strong> {form.clientName || "[Nome do cliente]"},{" "}
        {form.nationality || "[nacionalidade]"}, {form.maritalStatus || "[estado civil]"},{" "}
        {form.profession || "[profissÃ£o]"}, portador(a) do CPF/CNPJ nÂº{" "}
        {form.clientDoc || "[CPF/CNPJ]"} e RG nÂº {form.clientRg || "[RG]"}, residente e
        domiciliado(a) em {form.clientAddress || "[endereÃ§o]"}, doravante denominado CONTRATANTE.
      </p>
      <ContractSection title="ClÃ¡usula Primeira - Do Objeto">
        O presente contrato tem por objeto a prestaÃ§Ã£o de consultoria e intermediaÃ§Ã£o de serviÃ§os
        administrativos relacionados Ã  contestaÃ§Ã£o de apontamentos restritivos em cadastros de
        crÃ©dito (SPC, Serasa, Boa Vista e Cenprot), referente ao serviÃ§o {form.service}.
      </ContractSection>
      <ContractSection title="ClÃ¡usula Segunda - Da Natureza do ServiÃ§o">
        O CONTRATANTE declara estar ciente de que o serviÃ§o contratado nÃ£o implica quitaÃ§Ã£o,
        renegociaÃ§Ã£o ou extinÃ§Ã£o da dÃ­vida originÃ¡ria; a CONTRATADA atua como consultoria, gestÃ£o
        administrativa e intermediaÃ§Ã£o, conectando o CONTRATANTE a parceiros especializados.
      </ContractSection>
      <ContractSection title="ClÃ¡usula Terceira - Do Prazo">
        O prazo estimado para conclusÃ£o inicial dos procedimentos Ã© de {settings.initialDeadline},
        prorrogÃ¡veis em caso de necessidade tÃ©cnica. ApÃ³s 120 dias Ãºteis sem documento comprobatÃ³rio
        de retirada do apontamento, poderÃ¡ ser solicitado reembolso dos valores pagos, desde que nÃ£o
        haja inadimplÃªncia.
      </ContractSection>
      <ContractSection title="ClÃ¡usula Quarta - Da Garantia">
        O CONTRATANTE terÃ¡ cobertura de {settings.warrantyMonths} meses contados a partir da entrega
        do documento comprobatÃ³rio de retirada do apontamento, conforme condiÃ§Ãµes previstas no
        contrato-base.
      </ContractSection>
      <ContractSection title="ClÃ¡usula Quinta - Do Valor e Forma de Pagamento">
        Pelo presente contrato, o CONTRATANTE pagarÃ¡ Ã  CONTRATADA: Taxa de Abertura de Processo
        (TAP): {formatBRL(parseCurrencyInput(form.tapValue))}; HonorÃ¡rios de Consultoria e
        IntermediaÃ§Ã£o: {formatBRL(parseCurrencyInput(form.feeValue))}. Valor total:{" "}
        {formatBRL(parseCurrencyInput(form.tapValue) + parseCurrencyInput(form.feeValue))}.
        <div className="mt-3 grid gap-2 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs">
          <PaymentMark active={form.paymentMethod === "avista"} label="Ã€ vista/Pix" />
          <PaymentMark active={form.paymentMethod === "prazo_pix"} label="Prazo Pix" />
          <PaymentMark
            active={form.paymentMethod === "credito"}
            label={`CartÃ£o de crÃ©dito${form.paymentMethod === "credito" ? ` - ${form.installments}x` : ""}`}
          />
        </div>
      </ContractSection>
      <ContractSection title="ClÃ¡usula Sexta - Da Multa Contratual">
        Em caso de descumprimento contratual pelo CONTRATANTE, incluindo fornecimento de informaÃ§Ãµes
        falsas, inadimplÃªncia nÃ£o regularizada, contrataÃ§Ã£o paralela ou desistÃªncia injustificada,
        serÃ¡ aplicada multa compensatÃ³ria de atÃ© R$ 5.000,00, proporcional ao valor contratado.
      </ContractSection>
      <ContractSection title="ClÃ¡usula SÃ©tima - Das Responsabilidades da Contratada">
        A CONTRATADA se compromete a realizar a consultoria e intermediaÃ§Ã£o de forma diligente,
        manter o CONTRATANTE informado e intermediar contato com parceiros especializados.
      </ContractSection>
      <ContractSection title="ClÃ¡usula Oitava - Das DeclaraÃ§Ãµes do Contratante">
        O CONTRATANTE declara estar ciente de que a CONTRATADA nÃ£o presta serviÃ§os jurÃ­dicos
        diretos, nÃ£o garante Ãªxito, nÃ£o extingue a dÃ­vida original e pode utilizar aÃ§Ãµes coletivas
        conduzidas por parceiros especializados.
      </ContractSection>
      <ContractSection title="ClÃ¡usula Nona - Do Foro">
        Fica eleito o foro da {settings.forum} para dirimir quaisquer litÃ­gios oriundos deste
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
          title="RESPONSÃVEL PELA VENDA"
          name={form.seller || "Vendedor responsÃ¡vel"}
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
        <h2 className="font-display text-xl font-bold uppercase">Contrato de PrestaÃ§Ã£o de ServiÃ§os</h2>
        <p className="mt-2 text-xs text-muted-foreground">
          Programa Rating de OrganizaÃ§Ã£o e Posicionamento CreditÃ­cio
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
        {form.clientAddress || "[endereÃ§o]"}, e-mail/contato conforme cadastro no CRM.
      </p>
      <ContractSection title="1. ClÃ¡usula geral">
        Considera-se Rating a metodologia prÃ³pria adotada pela CONTRATADA, consistente na anÃ¡lise,
        organizaÃ§Ã£o, estruturaÃ§Ã£o e direcionamento estratÃ©gico das informaÃ§Ãµes creditÃ­cias do
        CONTRATANTE, com objetivo de promover melhor posicionamento perante o mercado, sem se
        confundir com score, classificaÃ§Ã£o oficial de risco ou Ã­ndice atribuÃ­do por instituiÃ§Ãµes.
      </ContractSection>
      <ContractSection title="2. Do objeto do contrato">
        O presente contrato tem por objeto a prestaÃ§Ã£o de serviÃ§os especializados de Rating, com
        anÃ¡lise do perfil, organizaÃ§Ã£o cadastral, orientaÃ§Ã£o administrativa e direcionamento
        estratÃ©gico das informaÃ§Ãµes creditÃ­cias do CONTRATANTE. A parte administrativa serÃ¡ realizada
        em atÃ© 30 dias Ãºteis, e a atualizaÃ§Ã£o completa poderÃ¡ ocorrer em atÃ© 60 dias Ãºteis, conforme
        fatores sistÃªmicos de cada instituiÃ§Ã£o.
      </ContractSection>
      <ContractSection title="3. ObrigaÃ§Ãµes do contratante">
        O CONTRATANTE deverÃ¡ fornecer informaÃ§Ãµes completas e verdadeiras, seguir as orientaÃ§Ãµes da
        CONTRATADA, manter comportamento financeiro adequado, evitar solicitaÃ§Ãµes excessivas de
        crÃ©dito, atrasos em contas, consultas excessivas ao CPF/CNPJ e decisÃµes financeiras que
        prejudiquem o histÃ³rico durante a execuÃ§Ã£o do serviÃ§o.
      </ContractSection>
      <ContractSection title="4. ObrigaÃ§Ãµes da contratada">
        A CONTRATADA atuarÃ¡ com anÃ¡lise, orientaÃ§Ã£o e estratÃ©gia, sem garantia de aprovaÃ§Ã£o de
        crÃ©dito, aumento de score, retirada de registros ou resultado especÃ­fico. Sua eventual
        responsabilidade fica limitada ao valor efetivamente pago pelo CONTRATANTE neste contrato.
      </ContractSection>
      <ContractSection title="5. Inadimplemento, descumprimento e multa">
        Em caso de inadimplÃªncia ou descumprimento, incidirÃ¡ multa de 10% sobre o valor contratado,
        alÃ©m de juros de mora de 1% ao mÃªs e correÃ§Ã£o monetÃ¡ria quando aplicÃ¡vel. A inadimplÃªncia
        poderÃ¡ suspender o andamento do serviÃ§o atÃ© a regularizaÃ§Ã£o.
      </ContractSection>
      <ContractSection title="6. Compromisso com a execuÃ§Ã£o do serviÃ§o">
        A CONTRATADA assume compromisso de realizar o serviÃ§o dentro do prazo mÃ¡ximo de 60 dias Ãºteis,
        contado da assinatura e confirmaÃ§Ã£o de pagamento, podendo haver prorrogaÃ§Ã£o por forÃ§a maior,
        recesso, calamidade pÃºblica, prorrogaÃ§Ã£o de prazos ou impedimento operacional.
      </ContractSection>
      <ContractSection title="7. CondiÃ§Ãµes gerais e foro">
        NÃ£o hÃ¡ vÃ­nculo trabalhista entre as partes. O CONTRATANTE autoriza uso institucional de
        informaÃ§Ãµes de andamento ou conclusÃ£o de forma genÃ©rica e sem identificaÃ§Ã£o direta. Fica eleito
        o foro da {settings.forum} para dirimir controvÃ©rsias.
      </ContractSection>
      <ContractSection title="Valor e forma de pagamento">
        Custo do serviÃ§o:{" "}
        {formatBRL(parseCurrencyInput(form.tapValue) + parseCurrencyInput(form.feeValue))}. Forma de
        pagamento: {paymentLabels[form.paymentMethod]}
        {form.paymentMethod === "credito" ? ` em ${form.installments}x` : ""}.
      </ContractSection>
      <p className="mt-8">
        {form.local || settings.defaultLocal}, {formatLongDate(form.contractDate)}.
      </p>
      <div className="mt-12 grid gap-8 md:grid-cols-2">
        <SignatureLine title="CONTRATANTE" name={form.clientName || "Cliente"} />
        <SignatureLine title="CONTRATADA" name={settings.companyName} />
        <SignatureLine
          title="RESPONSÃVEL PELA VENDA"
          name={form.seller || "Vendedor responsÃ¡vel"}
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
  return isRatingService(serviceName) ? "rating" : "limpa_nome";
}

function isRatingService(serviceName = "") {
  return normalizeText(serviceName).includes("rating");
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
  const encoded = globalThis.btoa(unescape(encodeURIComponent(json)));
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
    const json = decodeURIComponent(escape(globalThis.atob(padded)));
    const parsed = JSON.parse(json) as ContractSigningPayload;
    if (!parsed.form || !parsed.settings || !parsed.createdAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

function buildContractText(form: ContractForm, settings: ContractSettings) {
  return [
    "CONTRATO DE PRESTAÃ‡ÃƒO DE SERVIÃ‡OS DE CONSULTORIA E INTERMEDIAÃ‡ÃƒO",
    "",
    `CONTRATADA: ${settings.companyName}, CNPJ ${settings.companyDoc || "[CNPJ]"}, com sede em ${settings.companyAddress}, representada por ${settings.legalRepresentative}.`,
    `CONTRATANTE: ${form.clientName}, ${form.nationality}, ${form.maritalStatus}, ${form.profession}, CPF/CNPJ ${form.clientDoc}, RG ${form.clientRg || "[RG]"}, residente em ${form.clientAddress}.`,
    "",
    `Objeto: consultoria e intermediaÃ§Ã£o de serviÃ§os administrativos relacionados Ã  contestaÃ§Ã£o de apontamentos restritivos em cadastros de crÃ©dito, serviÃ§o ${form.service}.`,
    `Valor: TAP ${formatBRL(parseCurrencyInput(form.tapValue))}; honorÃ¡rios ${formatBRL(parseCurrencyInput(form.feeValue))}; total ${formatBRL(parseCurrencyInput(form.tapValue) + parseCurrencyInput(form.feeValue))}.`,
    `Forma de pagamento: ${paymentLabels[form.paymentMethod]}${form.paymentMethod === "credito" ? ` em ${form.installments}x` : ""}.`,
    `Foro: ${settings.forum}.`,
    `${form.local}, ${formatLongDate(form.contractDate)}.`,
    "",
    "CONTRATANTE: ________________________________",
    "CONTRATADA: _________________________________",
    `RESPONSÃVEL PELA VENDA: ${form.seller || "________________"}`,
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

  const tap = formatBRL(parseCurrencyInput(form.tapValue));
  const fee = formatBRL(parseCurrencyInput(form.feeValue));
  const total = formatBRL(parseCurrencyInput(form.tapValue) + parseCurrencyInput(form.feeValue));
  const payment =
    form.paymentMethod === "credito"
      ? `CartÃ£o de CrÃ©dito em ${form.installments}x`
      : paymentLabels[form.paymentMethod];

  return [
    "CONTRATO DE PRESTAÃ‡ÃƒO DE SERVIÃ‡OS DE CONSULTORIA E INTERMEDIAÃ‡ÃƒO",
    '(ServiÃ§os Administrativos e de ContestaÃ§Ã£o de Apontamentos em Cadastro de CrÃ©dito - "Limpa Nome")',
    "",
    "Pelo presente instrumento particular de contrato, de um lado:",
    "",
    `CONTRATADA: ${settings.companyName}, pessoa jurÃ­dica de direito privado, inscrita no CNPJ sob nÂº ${settings.companyDoc || "[CNPJ da empresa]"}, com sede em ${settings.companyAddress}, neste ato representada por seu representante legal ${settings.legalRepresentative}, doravante denominada CONTRATADA.`,
    "",
    "E, de outro lado:",
    "",
    `CONTRATANTE: ${form.clientName || "[Nome do cliente]"}, ${form.nationality || "[nacionalidade]"}, ${form.maritalStatus || "[estado civil]"}, ${form.profession || "[profissÃ£o]"}, portador(a) do CPF/CNPJ nÂº ${form.clientDoc || "[CPF/CNPJ]"} e RG nÂº ${form.clientRg || "[RG]"}, residente e domiciliado(a) em ${form.clientAddress || "[endereÃ§o]"}, doravante denominado CONTRATANTE.`,
    "",
    "CLÃUSULA PRIMEIRA - DO OBJETO",
    "1.1 O presente contrato tem por objeto a prestaÃ§Ã£o de consultoria e intermediaÃ§Ã£o de serviÃ§os administrativos relacionados Ã  contestaÃ§Ã£o de apontamentos restritivos em cadastros de crÃ©dito (SPC, Serasa, Boa Vista e Cenprot).",
    "1.2 A CONTRATADA atua exclusivamente na funÃ§Ã£o de consultoria, gestÃ£o administrativa e intermediaÃ§Ã£o, conectando o CONTRATANTE a parceiros jurÃ­dicos regularmente habilitados, que sÃ£o os responsÃ¡veis tÃ©cnicos pela conduÃ§Ã£o dos procedimentos administrativos ou judiciais.",
    "1.3 A CONTRATADA nÃ£o executa serviÃ§os jurÃ­dicos prÃ³prios, nÃ£o atua como escritÃ³rio de advocacia e nÃ£o presta assessoria jurÃ­dica direta.",
    "",
    "CLÃUSULA SEGUNDA - DA NATUREZA DO SERVIÃ‡O",
    "2.1 O CONTRATANTE declara estar ciente de que:",
    "- O serviÃ§o contratado nÃ£o implica na quitaÃ§Ã£o, renegociaÃ§Ã£o ou extinÃ§Ã£o da dÃ­vida originÃ¡ria;",
    "- O objetivo Ã© questionar a legitimidade dos apontamentos restritivos com base no CÃ³digo de Defesa do Consumidor e normas aplicÃ¡veis;",
    "- Trata-se de medida administrativa ou judicial que pode incluir aÃ§Ãµes coletivas conduzidas por parceiros especializados;",
    "- Para resguardar dados sensÃ­veis de todos os envolvidos em aÃ§Ãµes coletivas, nÃ£o serÃ¡ fornecido nÃºmero individual de processo, mas a CONTRATADA garantirÃ¡ relatÃ³rios periÃ³dicos sobre o andamento.",
    "",
    "CLÃUSULA TERCEIRA - DO PRAZO",
    `3.1 O prazo estimado para conclusÃ£o inicial dos procedimentos Ã© de ${settings.initialDeadline}, prorrogÃ¡veis, por igual perÃ­odo, em caso de necessidade tÃ©cnica.`,
    "3.2 Caso, apÃ³s o prazo de 120 (cento e vinte) dias Ãºteis, nÃ£o seja possÃ­vel apresentar documento que comprove a retirada do apontamento (ex.: certidÃ£o ou consulta atualizada), poderÃ¡ ser solicitado pelo CONTRATANTE o reembolso dos valores pagos, desde que nÃ£o haja inadimplÃªncia.",
    "",
    "CLÃUSULA QUARTA - DA GARANTIA",
    `4.1 O CONTRATANTE terÃ¡ cobertura de ${settings.warrantyMonths} meses contados a partir da entrega do documento comprobatÃ³rio de retirada do apontamento.`,
    "4.2 Caso surjam novos apontamentos restritivos no mesmo perÃ­odo, a CONTRATADA providenciarÃ¡, sem custos adicionais, a intermediaÃ§Ã£o para retirada.",
    "4.3 Caso as restriÃ§Ãµes contestadas retornem em razÃ£o de eventual queda da liminar, o processo serÃ¡ refeito dentro do mesmo prazo previsto na ClÃ¡usula Terceira, estando o CONTRATANTE coberto pela garantia.",
    "4.4 Caso o CONTRATANTE opte por ingressar em novo processo sem aguardar o reprocessamento em curso, deverÃ¡ pagar novamente a Taxa de Abertura de Processo (TAP) vigente e terÃ¡ o seu novo Nada Consta no prazo mÃ©dio de 15 dias Ãºteis.",
    "",
    "CLÃUSULA QUINTA - DO VALOR E FORMA DE PAGAMENTO",
    "5.1 Pelo presente contrato, o CONTRATANTE pagarÃ¡ Ã  CONTRATADA:",
    `I - Taxa de Abertura de Processo (TAP): ${tap};`,
    `II - HonorÃ¡rios de Consultoria e IntermediaÃ§Ã£o: ${fee};`,
    `Valor total contratado: ${total}.`,
    `O valor acordado serÃ¡ pago por: ${payment}.`,
    "5.2 O pagamento deverÃ¡ ser realizado em atÃ© 15 (quinze) dias Ãºteis da assinatura.",
    "5.3 Em caso de inadimplÃªncia, os serviÃ§os ficarÃ£o suspensos temporariamente atÃ© a regularizaÃ§Ã£o. Durante esse perÃ­odo, a garantia contratual ficarÃ¡ suspensa, retomando seus efeitos com a quitaÃ§Ã£o.",
    "",
    "CLÃUSULA SEXTA - DA MULTA CONTRATUAL",
    "6.1 Em caso de descumprimento contratual pelo CONTRATANTE, incluindo, mas nÃ£o se limitando a fornecimento de informaÃ§Ãµes falsas, inadimplÃªncia nÃ£o regularizada, tentativa de contrataÃ§Ã£o paralela de serviÃ§os idÃªnticos ou desistÃªncia injustificada, serÃ¡ aplicada multa compensatÃ³ria de atÃ© R$ 5.000,00 (cinco mil reais), proporcional ao valor do contrato e limitada ao montante efetivamente contratado.",
    "",
    "CLÃUSULA SÃ‰TIMA - DAS RESPONSABILIDADES DA CONTRATADA",
    "7.1 A CONTRATADA se compromete a realizar a consultoria e intermediaÃ§Ã£o de forma diligente, manter o CONTRATANTE informado sobre o andamento e intermediar com parceiros especializados devidamente habilitados.",
    "7.2 A CONTRATADA nÃ£o se responsabiliza por decisÃ£o desfavorÃ¡vel judicial ou administrativa, eventual queda de liminar ou retorno de restriÃ§Ãµes, restriÃ§Ãµes novas e nÃ£o relacionadas ao objeto inicial ou expectativas de concessÃ£o de crÃ©dito nÃ£o atendidas.",
    "",
    "CLÃUSULA OITAVA - DAS DECLARAÃ‡Ã•ES DO CONTRATANTE",
    "8.1 O CONTRATANTE declara que estÃ¡ ciente de que a CONTRATADA nÃ£o presta serviÃ§os jurÃ­dicos diretos, reconhece que nÃ£o hÃ¡ garantia de Ãªxito, reconhece que o serviÃ§o nÃ£o extingue ou quita a dÃ­vida original e estÃ¡ informado sobre a possibilidade de uso de aÃ§Ãµes coletivas.",
    "",
    "CLÃUSULA NONA - DO FORO",
    `9.1 Fica eleito o foro da ${settings.forum} para dirimir quaisquer litÃ­gios oriundos deste contrato.`,
    "",
    `E por estarem justos e contratados, firmam o presente instrumento em 02 (duas) vias de igual teor, juntamente com 02 (duas) testemunhas, para que produza seus jurÃ­dicos e legais efeitos. ${form.local || settings.defaultLocal}, ${formatLongDate(form.contractDate)}.`,
    "",
    "CONTRATANTE: ________________________________",
    "CONTRATADA: _________________________________",
    `RESPONSÃVEL PELA VENDA: ${form.seller || "________________"}`,
  ].join("\n");
}

function buildRatingContractText(form: ContractForm, settings: ContractSettings) {
  const total = formatBRL(parseCurrencyInput(form.tapValue) + parseCurrencyInput(form.feeValue));
  const payment =
    form.paymentMethod === "credito"
      ? `CartÃ£o de CrÃ©dito em ${form.installments}x`
      : paymentLabels[form.paymentMethod];

  return [
    "CONTRATO DE PRESTAÃ‡ÃƒO DE SERVIÃ‡OS",
    "PROGRAMA RATING DE ORGANIZAÃ‡ÃƒO E POSICIONAMENTO CREDITÃCIO",
    "",
    `${form.local || settings.defaultLocal}, ${formatLongDate(form.contractDate)}.`,
    "",
    `CONTRATADA: ${settings.companyName}, CNPJ ${settings.companyDoc || "[CNPJ]"}, com sede em ${settings.companyAddress}, representada por ${settings.legalRepresentative}.`,
    `CONTRATANTE: ${form.clientName || "[Nome do cliente]"}, CPF/CNPJ ${form.clientDoc || "[CPF/CNPJ]"}, RG ${form.clientRg || "[RG]"}, residente em ${form.clientAddress || "[endereÃ§o]"}, doravante denominado CONTRATANTE.`,
    "",
    `DescriÃ§Ã£o do serviÃ§o: ${form.service || "Rating BancÃ¡rio"}.`,
    `Custo do serviÃ§o: ${total}. Forma de pagamento: ${payment}.`,
    "",
    "1. CLÃUSULA GERAL",
    "1.1 Considera-se Rating a metodologia prÃ³pria adotada pela CONTRATADA, consistente na anÃ¡lise, organizaÃ§Ã£o, estruturaÃ§Ã£o e direcionamento estratÃ©gico das informaÃ§Ãµes creditÃ­cias do CONTRATANTE, com objetivo de promover melhor posicionamento e conduÃ§Ã£o de sua situaÃ§Ã£o perante o mercado, nÃ£o se confundindo com pontuaÃ§Ã£o de score, classificaÃ§Ã£o oficial de risco ou qualquer Ã­ndice atribuÃ­do por instituiÃ§Ãµes financeiras ou Ã³rgÃ£os de proteÃ§Ã£o ao crÃ©dito.",
    "1.2 Em caso de nÃ£o cumprimento das obrigaÃ§Ãµes por parte da CONTRATADA dentro do prazo estipulado, poderÃ¡ o cliente optar pelo cancelamento do serviÃ§o somente em caso de atrasos que superem 60 dias Ãºteis a partir da data de depÃ³sito, podendo pleitear a devoluÃ§Ã£o do valor pago com multa de atÃ© 10% sobre o valor do contrato.",
    "1.3 Em caso de nÃ£o cumprimento do contrato por parte do CONTRATANTE e, ainda, em caso de serviÃ§o parcelado, serÃ¡ cobrada multa de 10% sobre o valor deste contrato.",
    "1.4 Esta proposta inclui o serviÃ§o de reestruturaÃ§Ã£o do Rating de CrÃ©dito, nÃ£o abrangendo BACEN e CCF, estando o CONTRATANTE ciente desta informaÃ§Ã£o.",
    "",
    "2. DO OBJETO DO CONTRATO",
    "2.1 O presente contrato tem por objeto a prestaÃ§Ã£o, pela CONTRATADA, de serviÃ§os especializados no Ã¢mbito da metodologia denominada Rating, consistente na anÃ¡lise do perfil, organizaÃ§Ã£o, estruturaÃ§Ã£o e direcionamento estratÃ©gico das informaÃ§Ãµes creditÃ­cias do CONTRATANTE.",
    "2.2 A CONTRATADA utiliza abordagem tÃ©cnica voltada ao aprimoramento do posicionamento do perfil do CONTRATANTE perante o mercado, incluindo identificaÃ§Ã£o de inconsistÃªncias cadastrais, orientaÃ§Ã£o quanto Ã s medidas administrativas cabÃ­veis e, quando necessÃ¡rio, intermediaÃ§Ã£o com parceiros habilitados.",
    "2.3 A CONTRATADA se compromete ao prazo de entrega de atÃ© 30 dias Ãºteis para a parte administrativa e de atÃ© 60 dias Ãºteis para a atualizaÃ§Ã£o completa do cadastro do CONTRATANTE, observados fatores sistÃªmicos de cada instituiÃ§Ã£o.",
    "2.4 As informaÃ§Ãµes passadas antes da assinatura, no momento do checklist, sÃ£o de total responsabilidade do CONTRATANTE.",
    "",
    "3. DAS OBRIGAÃ‡Ã•ES DO CONTRATANTE",
    "3.1 Fornecer informaÃ§Ãµes completas, verÃ­dicas e atualizadas, bem como documentos necessÃ¡rios Ã  anÃ¡lise de sua situaÃ§Ã£o creditÃ­cia.",
    "3.2 Seguir as orientaÃ§Ãµes da CONTRATADA, entendendo que o serviÃ§o funciona melhor quando hÃ¡ cooperaÃ§Ã£o entre as partes.",
    "3.3 Manter comportamento financeiro ilibado e evitar solicitaÃ§Ãµes excessivas de crÃ©dito, consultas excessivas ao CPF/CNPJ, atrasos de contas, decisÃµes financeiras prejudiciais e demais atos que possam comprometer o processo de Rating.",
    "3.4 O CONTRATANTE declara ciÃªncia de que o CONTRATADO nÃ£o se responsabiliza por cheques devolvidos, quitaÃ§Ã£o de dÃ­vidas, processos ou dÃ©bitos existentes em seu nome.",
    "",
    "4. DAS OBRIGAÃ‡Ã•ES DA CONTRATADA",
    "4.1 O CONTRATANTE estÃ¡ ciente de que o serviÃ§o Rating Ã© baseado em anÃ¡lise, orientaÃ§Ã£o e estratÃ©gia, nÃ£o havendo garantia de resultado especÃ­fico, como aprovaÃ§Ã£o de crÃ©dito, aumento de score ou retirada de registros.",
    "4.2 A CONTRATADA nÃ£o se responsabiliza por negativa de crÃ©dito por instituiÃ§Ãµes financeiras, manutenÃ§Ã£o ou inclusÃ£o de registros por terceiros, alteraÃ§Ãµes nas regras de anÃ¡lise de crÃ©dito ou existÃªncia de dÃ­vidas legÃ­timas.",
    "4.3 Eventual responsabilidade da CONTRATADA ficarÃ¡ limitada ao valor efetivamente pago pelo CONTRATANTE neste contrato.",
    "",
    "5. DO INADIMPLEMENTO, DESCUMPRIMENTO E MULTA",
    "5.1 Em caso de inadimplÃªncia do CONTRATANTE quanto ao pagamento do serviÃ§o, incidirÃ¡ multa de 10% sobre o valor total, juros de mora de 1% ao mÃªs e correÃ§Ã£o monetÃ¡ria.",
    "5.2 A inadimplÃªncia poderÃ¡ suspender temporariamente a execuÃ§Ã£o do serviÃ§o atÃ© a regularizaÃ§Ã£o e poderÃ¡ levar o dÃ©bito Ã  cobranÃ§a administrativa, protesto ou via judicial, conforme legislaÃ§Ã£o aplicÃ¡vel.",
    "5.3 NÃ£o poderÃ¡ o presente instrumento ser rescindido unilateralmente e sem motivo por nenhuma das partes, sob pena de responsabilizaÃ§Ã£o por danos materiais, lucros cessantes e multa.",
    "",
    "6. DO COMPROMISSO COM A EXECUÃ‡ÃƒO DO SERVIÃ‡O",
    "6.1 A CONTRATADA assume o compromisso de realizar o serviÃ§o em atÃ© 60 dias Ãºteis, tendo como marco inicial a assinatura e confirmaÃ§Ã£o do pagamento.",
    "6.2 O prazo poderÃ¡ ser prorrogado por motivo de forÃ§a maior, recesso, calamidade pÃºblica, prorrogaÃ§Ã£o de prazos ou qualquer outro motivo que impeÃ§a a atuaÃ§Ã£o da empresa.",
    "",
    "7. DAS CONDIÃ‡Ã•ES GERAIS",
    "7.1 Fica de comum acordo a inexistÃªncia de vÃ­nculo trabalhista entre as partes.",
    "7.2 O CONTRATANTE autoriza a CONTRATADA a utilizar, para fins institucionais e de divulgaÃ§Ã£o de resultados, informaÃ§Ãµes relacionadas ao andamento ou conclusÃ£o do serviÃ§o, desde que de forma genÃ©rica e sem identificaÃ§Ã£o direta.",
    "",
    "8. DO FORO",
    `8.1 As partes elegem o foro da ${settings.forum} para dirimir controvÃ©rsias inerentes ao presente contrato.`,
    "",
    "CONTRATADA: _________________________________",
    "CONTRATANTE: ________________________________",
    "TESTEMUNHA 1: _______________________________",
    "TESTEMUNHA 2: _______________________________",
    `RESPONSÃVEL PELA VENDA: ${form.seller || "________________"}`,
  ].join("\n");
}

function buildRatingPrintableHtml(
  form: ContractForm,
  settings: ContractSettings,
  evidence?: ContractPrintEvidence,
) {
  const total = formatBRL(parseCurrencyInput(form.tapValue) + parseCurrencyInput(form.feeValue));
  const payment =
    form.paymentMethod === "credito"
      ? `CartÃ£o de CrÃ©dito em ${form.installments}x`
      : paymentLabels[form.paymentMethod];
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
  <h1>Contrato de PrestaÃ§Ã£o de ServiÃ§os</h1>
  <p class="subtitle">Programa Rating de OrganizaÃ§Ã£o e Posicionamento CreditÃ­cio</p>
  <p class="party"><strong>CONTRATADA:</strong> ${escapeHtml(settings.companyName)}, CNPJ ${escapeHtml(settings.companyDoc || "[CNPJ]")}, com sede em ${escapeHtml(settings.companyAddress)}, representada por ${escapeHtml(settings.legalRepresentative)}.</p>
  <p class="party"><strong>CONTRATANTE:</strong> ${escapeHtml(form.clientName || "[Nome do cliente]")}, CPF/CNPJ ${escapeHtml(form.clientDoc || "[CPF/CNPJ]")}, RG ${escapeHtml(form.clientRg || "[RG]")}, residente em ${escapeHtml(form.clientAddress || "[endereÃ§o]")}.</p>
  <div class="highlight avoid-break">
    <p><strong>DescriÃ§Ã£o do serviÃ§o:</strong> ${escapeHtml(form.service || "Rating BancÃ¡rio")}</p>
    <p><strong>Custo do serviÃ§o:</strong> ${escapeHtml(total)}</p>
    <p><strong>Forma de pagamento:</strong> ${escapeHtml(payment)}</p>
  </div>

  <h2>1. ClÃ¡usula geral</h2>
  <p>1.1 Considera-se Rating a metodologia prÃ³pria adotada pela CONTRATADA, consistente na anÃ¡lise, organizaÃ§Ã£o, estruturaÃ§Ã£o e direcionamento estratÃ©gico das informaÃ§Ãµes creditÃ­cias do CONTRATANTE, com objetivo de promover melhor posicionamento e conduÃ§Ã£o de sua situaÃ§Ã£o perante o mercado, nÃ£o se confundindo com pontuaÃ§Ã£o de score, classificaÃ§Ã£o oficial de risco ou qualquer Ã­ndice atribuÃ­do por instituiÃ§Ãµes financeiras ou Ã³rgÃ£os de proteÃ§Ã£o ao crÃ©dito.</p>
  <p>1.2 Em caso de nÃ£o cumprimento das obrigaÃ§Ãµes por parte da CONTRATADA dentro do prazo estipulado, poderÃ¡ o cliente optar pelo cancelamento do serviÃ§o somente em caso de atrasos que superem 60 dias Ãºteis a partir da data de depÃ³sito, podendo pleitear a devoluÃ§Ã£o do valor pago com multa de atÃ© 10% sobre o valor do contrato.</p>
  <p>1.3 Em caso de nÃ£o cumprimento do contrato por parte do CONTRATANTE e, ainda, em caso de serviÃ§o parcelado, serÃ¡ cobrada multa de 10% sobre o valor deste contrato.</p>
  <p>1.4 Esta proposta inclui o serviÃ§o de reestruturaÃ§Ã£o do Rating de CrÃ©dito, nÃ£o abrangendo BACEN e CCF, estando o CONTRATANTE ciente desta informaÃ§Ã£o.</p>

  <h2>2. Do objeto do contrato</h2>
  <p>2.1 O presente contrato tem por objeto a prestaÃ§Ã£o, pela CONTRATADA, de serviÃ§os especializados no Ã¢mbito da metodologia denominada Rating, consistente na anÃ¡lise do perfil, organizaÃ§Ã£o, estruturaÃ§Ã£o e direcionamento estratÃ©gico das informaÃ§Ãµes creditÃ­cias do CONTRATANTE.</p>
  <p>2.2 A CONTRATADA utiliza abordagem tÃ©cnica voltada ao aprimoramento do posicionamento do perfil do CONTRATANTE perante o mercado, incluindo identificaÃ§Ã£o de inconsistÃªncias cadastrais, orientaÃ§Ã£o quanto Ã s medidas administrativas cabÃ­veis e, quando necessÃ¡rio, intermediaÃ§Ã£o com parceiros habilitados.</p>
  <p>2.3 A CONTRATADA se compromete ao prazo de entrega de atÃ© 30 dias Ãºteis para a parte administrativa e de atÃ© 60 dias Ãºteis para a atualizaÃ§Ã£o completa do cadastro do CONTRATANTE, observados fatores sistÃªmicos de cada instituiÃ§Ã£o.</p>
  <p>2.4 As informaÃ§Ãµes passadas antes da assinatura, no momento do checklist, sÃ£o de total responsabilidade do CONTRATANTE.</p>

  <h2>3. Das obrigaÃ§Ãµes do contratante</h2>
  <p>3.1 O CONTRATANTE deve fornecer informaÃ§Ãµes completas, verÃ­dicas e atualizadas, bem como todos os documentos necessÃ¡rios Ã  anÃ¡lise de sua situaÃ§Ã£o creditÃ­cia.</p>
  <p>3.2 O CONTRATANTE deve seguir as orientaÃ§Ãµes da CONTRATADA e manter comportamento financeiro adequado, evitando solicitaÃ§Ãµes excessivas de crÃ©dito, consultas excessivas ao CPF/CNPJ, atrasos em contas, decisÃµes financeiras prejudiciais e demais condutas que possam comprometer o processo de Rating.</p>
  <p>3.3 O CONTRATANTE declara ter ciÃªncia de que a CONTRATADA nÃ£o se responsabiliza por cheques devolvidos, quitaÃ§Ã£o de dÃ­vidas, processos ou dÃ©bitos existentes em seu nome.</p>

  <h2>4. Das obrigaÃ§Ãµes da contratada</h2>
  <p>4.1 O CONTRATANTE estÃ¡ ciente de que o serviÃ§o Rating Ã© baseado em anÃ¡lise, orientaÃ§Ã£o e estratÃ©gia, nÃ£o havendo garantia de resultado especÃ­fico, como aprovaÃ§Ã£o de crÃ©dito, aumento de score ou retirada de registros.</p>
  <p>4.2 A CONTRATADA nÃ£o se responsabiliza por negativa de crÃ©dito por instituiÃ§Ãµes financeiras, manutenÃ§Ã£o ou inclusÃ£o de registros por terceiros, alteraÃ§Ãµes nas regras de anÃ¡lise de crÃ©dito ou existÃªncia de dÃ­vidas legÃ­timas.</p>
  <p>4.3 Eventual responsabilidade da CONTRATADA ficarÃ¡ limitada ao valor efetivamente pago pelo CONTRATANTE neste contrato.</p>

  <h2>5. Do inadimplemento, descumprimento e multa</h2>
  <p>5.1 Em caso de inadimplÃªncia do CONTRATANTE quanto ao pagamento do serviÃ§o, incidirÃ¡ multa de 10% sobre o valor total, juros de mora de 1% ao mÃªs e correÃ§Ã£o monetÃ¡ria.</p>
  <p>5.2 A inadimplÃªncia poderÃ¡ suspender temporariamente a execuÃ§Ã£o do serviÃ§o atÃ© a regularizaÃ§Ã£o e poderÃ¡ levar o dÃ©bito Ã  cobranÃ§a administrativa, protesto ou via judicial, conforme legislaÃ§Ã£o aplicÃ¡vel.</p>
  <p>5.3 NÃ£o poderÃ¡ o presente instrumento ser rescindido unilateralmente e sem motivo por nenhuma das partes, sob pena de responsabilizaÃ§Ã£o por danos materiais, lucros cessantes e multa.</p>

  <h2>6. Do compromisso com a execuÃ§Ã£o do serviÃ§o</h2>
  <p>6.1 A CONTRATADA assume o compromisso de realizar o serviÃ§o em atÃ© 60 dias Ãºteis, tendo como marco inicial a assinatura e confirmaÃ§Ã£o do pagamento.</p>
  <p>6.2 O prazo poderÃ¡ ser prorrogado por motivo de forÃ§a maior, recesso, calamidade pÃºblica, prorrogaÃ§Ã£o de prazos ou qualquer outro motivo que impeÃ§a a atuaÃ§Ã£o da empresa.</p>

  <h2>7. Das condiÃ§Ãµes gerais</h2>
  <p>7.1 Fica de comum acordo a inexistÃªncia de vÃ­nculo trabalhista entre as partes.</p>
  <p>7.2 O CONTRATANTE autoriza a CONTRATADA a utilizar, para fins institucionais e de divulgaÃ§Ã£o de resultados, informaÃ§Ãµes relacionadas ao andamento ou conclusÃ£o do serviÃ§o, desde que de forma genÃ©rica e sem identificaÃ§Ã£o direta.</p>

  <h2>8. Do foro</h2>
  <p>8.1 As partes elegem o foro da ${escapeHtml(settings.forum)} para dirimir controvÃ©rsias inerentes ao presente contrato.</p>
  <p class="avoid-break">${escapeHtml(form.local || settings.defaultLocal)}, ${escapeHtml(formatLongDate(form.contractDate))}.</p>

  <section class="signatures">
    <div class="signature"><div class="line">CONTRATADA</div><div class="muted">${escapeHtml(settings.companyName)}</div></div>
    <div class="signature"><div class="line">CONTRATANTE</div><div class="muted">${escapeHtml(form.clientName || "Cliente")}</div></div>
    <div class="signature"><div class="line">TESTEMUNHA 1</div></div>
    <div class="signature"><div class="line">TESTEMUNHA 2</div></div>
    <div class="signature"><div class="line">RESPONSÃVEL PELA VENDA</div><div class="muted">${escapeHtml(form.seller || "Vendedor responsÃ¡vel")}${form.sellerRole ? ` - ${escapeHtml(form.sellerRole)}` : ""}</div></div>
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

  const tap = formatBRL(parseCurrencyInput(form.tapValue));
  const fee = formatBRL(parseCurrencyInput(form.feeValue));
  const total = formatBRL(parseCurrencyInput(form.tapValue) + parseCurrencyInput(form.feeValue));
  const mark = (active: boolean) => `<span class="checkbox">${active ? "X" : ""}</span>`;
  const creditLabel =
    form.paymentMethod === "credito"
      ? `CartÃ£o de CrÃ©dito - ${form.installments}x`
      : "CartÃ£o de CrÃ©dito";
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
  <h1>Contrato de PrestaÃ§Ã£o de ServiÃ§os de Consultoria e IntermediaÃ§Ã£o</h1>
  <p class="subtitle">(ServiÃ§os Administrativos e de ContestaÃ§Ã£o de Apontamentos em Cadastro de CrÃ©dito - "Limpa Nome")</p>

  <p>Pelo presente instrumento particular de contrato, de um lado:</p>
  <p class="party"><strong>CONTRATADA:</strong> ${escapeHtml(settings.companyName)}, pessoa jurÃ­dica de direito privado, inscrita no CNPJ sob nÂº ${escapeHtml(settings.companyDoc || "[CNPJ da empresa]")}, com sede em ${escapeHtml(settings.companyAddress)}, neste ato representada por seu representante legal ${escapeHtml(settings.legalRepresentative)}, doravante denominada CONTRATADA.</p>

  <p>E, de outro lado:</p>
  <p class="party"><strong>CONTRATANTE:</strong> ${escapeHtml(form.clientName || "[Nome do cliente]")}, ${escapeHtml(form.nationality || "[nacionalidade]")}, ${escapeHtml(form.maritalStatus || "[estado civil]")}, ${escapeHtml(form.profession || "[profissÃ£o]")}, portador(a) do CPF/CNPJ nÂº ${escapeHtml(form.clientDoc || "[CPF/CNPJ]")} e RG nÂº ${escapeHtml(form.clientRg || "[RG]")}, residente e domiciliado(a) em ${escapeHtml(form.clientAddress || "[endereÃ§o]")}, doravante denominado CONTRATANTE.</p>

  <h2>ClÃ¡usula Primeira - Do Objeto</h2>
  <p>1.1 O presente contrato tem por objeto a prestaÃ§Ã£o de consultoria e intermediaÃ§Ã£o de serviÃ§os administrativos relacionados Ã  contestaÃ§Ã£o de apontamentos restritivos em cadastros de crÃ©dito (SPC, Serasa, Boa Vista e Cenprot).</p>
  <p>1.2 A CONTRATADA atua exclusivamente na funÃ§Ã£o de consultoria, gestÃ£o administrativa e intermediaÃ§Ã£o, conectando o CONTRATANTE a parceiros jurÃ­dicos regularmente habilitados, que sÃ£o os responsÃ¡veis tÃ©cnicos pela conduÃ§Ã£o dos procedimentos administrativos ou judiciais.</p>
  <p>1.3 A CONTRATADA nÃ£o executa serviÃ§os jurÃ­dicos prÃ³prios, nÃ£o atua como escritÃ³rio de advocacia e nÃ£o presta assessoria jurÃ­dica direta.</p>

  <h2>ClÃ¡usula Segunda - Da Natureza do ServiÃ§o</h2>
  <p>2.1 O CONTRATANTE declara estar ciente de que:</p>
  <p>- O serviÃ§o contratado nÃ£o implica na quitaÃ§Ã£o, renegociaÃ§Ã£o ou extinÃ§Ã£o da dÃ­vida originÃ¡ria;</p>
  <p>- O objetivo Ã© questionar a legitimidade dos apontamentos restritivos com base no CÃ³digo de Defesa do Consumidor e normas aplicÃ¡veis;</p>
  <p>- Trata-se de medida administrativa ou judicial que pode incluir aÃ§Ãµes coletivas conduzidas por parceiros especializados;</p>
  <p>- Para resguardar dados sensÃ­veis de todos os envolvidos em aÃ§Ãµes coletivas, nÃ£o serÃ¡ fornecido nÃºmero individual de processo, mas a CONTRATADA garantirÃ¡ relatÃ³rios periÃ³dicos sobre o andamento.</p>

  <h2>ClÃ¡usula Terceira - Do Prazo</h2>
  <p>3.1 O prazo estimado para conclusÃ£o inicial dos procedimentos Ã© de ${escapeHtml(settings.initialDeadline)}, prorrogÃ¡veis, por igual perÃ­odo, em caso de necessidade tÃ©cnica.</p>
  <p>3.2 Caso, apÃ³s o prazo de 120 (cento e vinte) dias Ãºteis, nÃ£o seja possÃ­vel apresentar documento que comprove a retirada do apontamento (ex.: certidÃ£o ou consulta atualizada), poderÃ¡ ser solicitado pelo CONTRATANTE o reembolso dos valores pagos, desde que nÃ£o haja inadimplÃªncia.</p>

  <h2>ClÃ¡usula Quarta - Da Garantia</h2>
  <p>4.1 O CONTRATANTE terÃ¡ cobertura de ${escapeHtml(settings.warrantyMonths)} meses contados a partir da entrega do documento comprobatÃ³rio de retirada do apontamento.</p>
  <p>4.2 Caso surjam novos apontamentos restritivos no mesmo perÃ­odo, a CONTRATADA providenciarÃ¡, sem custos adicionais, a intermediaÃ§Ã£o para retirada.</p>
  <p>4.3 Caso as restriÃ§Ãµes contestadas retornem em razÃ£o de eventual queda da liminar, o processo serÃ¡ refeito dentro do mesmo prazo previsto na ClÃ¡usula Terceira, estando o CONTRATANTE coberto pela garantia.</p>
  <p>4.4 Caso o CONTRATANTE opte por ingressar em novo processo sem aguardar o reprocessamento em curso, deverÃ¡ pagar novamente a Taxa de Abertura de Processo (TAP) vigente e terÃ¡ o seu novo Nada Consta no prazo mÃ©dio de 15 dias Ãºteis.</p>

  <h2>ClÃ¡usula Quinta - Do Valor e Forma de Pagamento</h2>
  <p>5.1 Pelo presente contrato, o CONTRATANTE pagarÃ¡ Ã  CONTRATADA:</p>
  <p>I - Taxa de Abertura de Processo (TAP): ${escapeHtml(tap)}; II - HonorÃ¡rios de Consultoria e IntermediaÃ§Ã£o: ${escapeHtml(fee)}.</p>
  <p><strong>Valor total contratado:</strong> ${escapeHtml(total)}.</p>
  <p>O valor acordado serÃ¡ pago:</p>
  <div class="payment-box avoid-break">
    <span class="payment-row">${mark(form.paymentMethod === "avista")} Ã€ vista/Pix</span>
    <span class="payment-row">${mark(form.paymentMethod === "credito")} ${escapeHtml(creditLabel)}</span>
    <span class="payment-row">${mark(false)} Boleto bancÃ¡rio</span>
    <span class="payment-row">${mark(form.paymentMethod === "prazo_pix")} Prazo Pix - entrada de ${escapeHtml(tap)} e saldo de ${escapeHtml(fee)} em 30 dias</span>
  </div>
  <p>5.2 O pagamento deverÃ¡ ser realizado em atÃ© 15 (quinze) dias Ãºteis da assinatura.</p>
  <p>5.3 Em caso de inadimplÃªncia, os serviÃ§os ficarÃ£o suspensos temporariamente atÃ© a regularizaÃ§Ã£o. Durante esse perÃ­odo, a garantia contratual ficarÃ¡ suspensa, retomando seus efeitos com a quitaÃ§Ã£o.</p>

  <h2>ClÃ¡usula Sexta - Da Multa Contratual</h2>
  <p>6.1 Em caso de descumprimento contratual pelo CONTRATANTE, incluindo, mas nÃ£o se limitando a fornecimento de informaÃ§Ãµes falsas, inadimplÃªncia nÃ£o regularizada, tentativa de contrataÃ§Ã£o paralela de serviÃ§os idÃªnticos ou desistÃªncia injustificada, serÃ¡ aplicada multa compensatÃ³ria de atÃ© R$ 5.000,00 (cinco mil reais), proporcional ao valor do contrato e limitada ao montante efetivamente contratado.</p>

  <h2>ClÃ¡usula SÃ©tima - Das Responsabilidades da Contratada</h2>
  <p>7.1 A CONTRATADA se compromete a realizar a consultoria e intermediaÃ§Ã£o de forma diligente, manter o CONTRATANTE informado sobre o andamento e intermediar com parceiros especializados devidamente habilitados.</p>
  <p>7.2 A CONTRATADA nÃ£o se responsabiliza por decisÃ£o desfavorÃ¡vel judicial ou administrativa, eventual queda de liminar ou retorno de restriÃ§Ãµes, restriÃ§Ãµes novas e nÃ£o relacionadas ao objeto inicial ou expectativas de concessÃ£o de crÃ©dito nÃ£o atendidas.</p>

  <h2>ClÃ¡usula Oitava - Das DeclaraÃ§Ãµes do Contratante</h2>
  <p>8.1 O CONTRATANTE declara que estÃ¡ ciente de que a CONTRATADA nÃ£o presta serviÃ§os jurÃ­dicos diretos, reconhece que nÃ£o hÃ¡ garantia de Ãªxito, reconhece que o serviÃ§o nÃ£o extingue ou quita a dÃ­vida original e estÃ¡ informado sobre a possibilidade de uso de aÃ§Ãµes coletivas.</p>

  <h2>ClÃ¡usula Nona - Do Foro</h2>
  <p>9.1 Fica eleito o foro da ${escapeHtml(settings.forum)} para dirimir quaisquer litÃ­gios oriundos deste contrato.</p>

  <p class="avoid-break">E por estarem justos e contratados, firmam o presente instrumento em 02 (duas) vias de igual teor, juntamente com 02 (duas) testemunhas, para que produza seus jurÃ­dicos e legais efeitos. ${escapeHtml(form.local || settings.defaultLocal)}, ${escapeHtml(formatLongDate(form.contractDate))}.</p>

  <section class="signatures">
    <div class="signature"><div class="line">CONTRATANTE</div><div class="muted">${escapeHtml(form.clientName || "Cliente")}</div></div>
    <div class="signature"><div class="line">CONTRATADA</div><div class="muted">${escapeHtml(settings.companyName)}</div></div>
    <div class="signature"><div class="line">RESPONSÃVEL PELA VENDA</div><div class="muted">${escapeHtml(form.seller || "Vendedor responsÃ¡vel")}${form.sellerRole ? ` - ${escapeHtml(form.sellerRole)}` : ""}</div></div>
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
        <p class="muted">Assinatura ainda nÃ£o registrada.</p>
      </div>`;
    }

    return `
      <div>
        <p><strong>${title}</strong></p>
        <p>${escapeHtml(item.name)} - ${escapeHtml(new Date(item.signedAt).toLocaleString("pt-BR"))}</p>
        <p><strong>Selfie de validaÃ§Ã£o</strong></p>
        <img src="${item.selfie}" alt="Selfie de ${escapeHtml(item.name)}" />
        <p><strong>Assinatura digital</strong></p>
        <img src="${item.signature}" alt="Assinatura de ${escapeHtml(item.name)}" />
      </div>`;
  };

  return `
  <section class="signature-evidence">
    <h2>Registro de Assinaturas Digitais</h2>
    <p><strong>MÃ©todo:</strong> validaÃ§Ã£o por selfie, assinatura desenhada em tela e aceite eletrÃ´nico.</p>
    <div class="evidence-grid">
      ${evidenceCard("Contratante", evidence.client)}
      ${evidenceCard("ResponsÃ¡vel pela venda", evidence.seller)}
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

