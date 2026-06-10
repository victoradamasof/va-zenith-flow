import { createFileRoute } from "@tanstack/react-router";
import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  FileSearch,
  LineChart,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";
import { clients as initialClients, formatBRL } from "@/lib/mock-data";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { formatCurrencyInput, parseCurrencyInput } from "@/lib/receivables";
import {
  creditAnalysesKey,
  getCreditScoreLabel,
  normalizeCreditAnalysis,
  type CreditAnalysisRecord,
} from "@/lib/credit-intelligence";

export const Route = createFileRoute("/_app/credit-intelligence")({
  component: CreditIntelligence,
  head: () => ({ meta: [{ title: "VA Credit Intelligence" }] }),
});

type Client = (typeof initialClients)[number] & {
  address?: string;
  zip?: string;
};

type UploadFilePayload = {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
};

const operationTypes = [
  "Financiamento de veículo",
  "Financiamento imobiliário",
  "Empréstimo pessoal",
  "Capital de giro PJ",
  "Cartão de crédito",
  "Consórcio",
  "Crédito PJ",
];

const resultStatusLabels = {
  nao_informado: "Não informado",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
};

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function probabilityColor(value: number) {
  if (value >= 75) return "text-success";
  if (value >= 50) return "text-primary";
  if (value >= 30) return "text-warning";
  return "text-destructive";
}

function impactClass(value: string) {
  if (value === "critico") return "bg-destructive/15 text-destructive";
  if (value === "alto") return "bg-warning/15 text-warning";
  if (value === "medio") return "bg-info/15 text-info";
  return "bg-success/15 text-success";
}

function CreditIntelligence() {
  const [clients] = usePersistentState<Client[]>("va-manager:clients", initialClients);
  const [analyses, setAnalyses] = usePersistentState<CreditAnalysisRecord[]>(
    creditAnalysesKey,
    [],
  );
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [form, setForm] = useState({
    clientId: "",
    objective: "",
    requestedAmount: "",
    operationType: operationTypes[0],
    notes: "",
  });

  const normalizedAnalyses = useMemo(
    () => analyses.map(normalizeCreditAnalysis).filter((analysis) => analysis.id !== "empty"),
    [analyses],
  );
  const selectedAnalysis = useMemo(
    () => normalizedAnalyses.find((analysis) => analysis.id === selectedId) ?? normalizedAnalyses[0],
    [normalizedAnalyses, selectedId],
  );
  const selectedClient = useMemo(
    () => clients.find((client) => client.id === form.clientId),
    [clients, form.clientId],
  );
  const analyzedClients = new Set(normalizedAnalyses.map((analysis) => analysis.clientName)).size;
  const scoreValues = normalizedAnalyses
    .map((analysis) => Number(analysis.extracted.score))
    .filter((score) => Number.isFinite(score) && score > 0);
  const averageScore = scoreValues.length
    ? Math.round(scoreValues.reduce((sum, score) => sum + score, 0) / scoreValues.length)
    : 0;
  const highPotential = normalizedAnalyses.filter(
    (analysis) => analysis.diagnosis.approvalProbabilityAfterPlan >= 75,
  ).length;
  const recovery = normalizedAnalyses.filter(
    (analysis) => analysis.diagnosis.approvalProbabilityNow < 50,
  ).length;

  const updateForm = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    const acceptedFiles = selectedFiles.filter((file) =>
      ["application/pdf", "image/jpeg", "image/png"].includes(file.type),
    );

    if (acceptedFiles.length !== selectedFiles.length) {
      toast.error("Envie somente PDF, JPG ou PNG.");
    }

    const totalSize = acceptedFiles.reduce((sum, file) => sum + file.size, 0);
    if (acceptedFiles.length > 6 || totalSize > 18 * 1024 * 1024) {
      toast.error("Envie no máximo 6 arquivos e até 18 MB por análise.");
      return;
    }

    setFiles(acceptedFiles);
  };

  const submitAnalysis = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const client = selectedClient;
    if (!client) {
      toast.error("Selecione um cliente do CRM.");
      return;
    }

    setLoading(true);
    try {
      const filePayloads: UploadFilePayload[] = await Promise.all(
        files.map(async (file) => ({
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl: await readFileAsDataUrl(file),
        })),
      );

      const requestedAmount = parseCurrencyInput(form.requestedAmount);
      const response = await fetch("/api/credit-intelligence/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client,
          objective: form.objective,
          requestedAmount,
          operationType: form.operationType,
          notes: form.notes,
          files: filePayloads,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Não foi possível analisar os arquivos.");
      }

      const payload = await response.json();
      const analysis = normalizeCreditAnalysis({
        id: `ci-${Date.now()}`,
        clientId: client.id,
        clientName: client.name,
        createdAt: new Date().toISOString(),
        objective: form.objective || form.operationType,
        requestedAmount,
        operationType: form.operationType,
        sourceFiles: filePayloads.map(({ name, type, size }) => ({ name, type, size })),
        extracted: payload.extracted,
        diagnosis: payload.diagnosis,
        result: { status: "nao_informado" },
      });

      setAnalyses((current) => [analysis, ...current]);
      setSelectedId(analysis.id);
      toast.success(
        payload.provider === "openai"
          ? "Análise gerada com IA."
          : "Análise gerada pelo motor interno. Configure a OpenAI para análise profunda.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao gerar análise.");
    } finally {
      setLoading(false);
    }
  };

  const removeAnalysis = (id: string) => {
    setAnalyses((current) => current.filter((analysis) => analysis.id !== id));
    if (selectedId === id) setSelectedId("");
    toast.success("Análise excluída.");
  };

  const updateResult = (id: string, field: string, value: string) => {
    setAnalyses((current) =>
      current.map((analysis) =>
        analysis.id === id
          ? {
              ...analysis,
              result: {
                ...analysis.result,
                [field]: field === "approvedAmount" ? parseCurrencyInput(value) : value,
              },
            }
          : analysis,
      ),
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="VA Credit Intelligence"
        subtitle="Análise inteligente de crédito, score, rating bancário e plano de ação"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Clientes analisados" value={String(analyzedClients)} icon={Users} />
        <KpiCard label="Score médio" value={averageScore ? String(averageScore) : "Sem dados"} icon={LineChart} />
        <KpiCard label="Alto potencial" value={String(highPotential)} icon={ShieldCheck} accent="success" />
        <KpiCard label="Em recuperação" value={String(recovery)} icon={AlertTriangle} accent="warning" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.35fr]">
        <Card className="border-border/60 bg-card/70 p-5">
          <div className="mb-5">
            <h2 className="font-display text-lg font-semibold">Nova análise</h2>
            <p className="text-sm text-muted-foreground">
              Vincule ao cliente, anexe relatórios e gere o diagnóstico.
            </p>
          </div>

          <form className="space-y-4" onSubmit={submitAnalysis}>
            <div className="space-y-2">
              <Label>Cliente do CRM</Label>
              <Select value={form.clientId} onValueChange={(value) => updateForm("clientId", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo de operação</Label>
                <Select
                  value={form.operationType}
                  onValueChange={(value) => updateForm("operationType", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {operationTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor desejado</Label>
                <Input
                  value={form.requestedAmount}
                  placeholder="Ex: 80.000"
                  onChange={(event) => updateForm("requestedAmount", event.target.value)}
                  onBlur={() =>
                    updateForm(
                      "requestedAmount",
                      formatCurrencyInput(parseCurrencyInput(form.requestedAmount)),
                    )
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Objetivo do cliente</Label>
              <Input
                value={form.objective}
                placeholder="Ex: aprovar financiamento de veículo em até 90 dias"
                onChange={(event) => updateForm("objective", event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Observações internas</Label>
              <Textarea
                value={form.notes}
                placeholder="Contexto comercial, banco desejado, renda informada, urgência, restrições conhecidas..."
                onChange={(event) => updateForm("notes", event.target.value)}
              />
            </div>

            <div className="rounded-xl border border-dashed border-border/70 bg-background/40 p-4">
              <Label className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Relatórios PDF, JPG ou PNG
              </Label>
              <Input
                className="mt-3"
                type="file"
                multiple
                accept="application/pdf,image/png,image/jpeg"
                onChange={handleFiles}
              />
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                {files.length ? (
                  files.map((file) => (
                    <p key={`${file.name}-${file.size}`}>
                      {file.name} - {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  ))
                ) : (
                  <p>Você pode anexar Serasa, SPC, Quod, Boa Vista, Registrato e extratos.</p>
                )}
              </div>
            </div>

            <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={loading}>
              <BrainCircuit className="mr-2 h-4 w-4" />
              {loading ? "Analisando..." : "Gerar diagnóstico"}
            </Button>
          </form>
        </Card>

        <Card className="border-border/60 bg-card/70 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold">Histórico de análises</h2>
              <p className="text-sm text-muted-foreground">
                Cada análise fica vinculada ao cliente e pode receber resultado real.
              </p>
            </div>
            <Badge variant="outline">{normalizedAnalyses.length} salvas</Badge>
          </div>

          <div className="overflow-hidden rounded-xl border border-border/60">
            <div className="grid grid-cols-[1.1fr_0.8fr_0.55fr_0.6fr] bg-muted/40 px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <span>Cliente</span>
              <span>Operação</span>
              <span>Chance</span>
              <span className="text-right">Ações</span>
            </div>
            <div className="max-h-[360px] divide-y divide-border/60 overflow-auto">
              {normalizedAnalyses.map((analysis) => (
                <button
                  key={analysis.id}
                  type="button"
                  className="grid w-full grid-cols-[1.1fr_0.8fr_0.55fr_0.6fr] items-center px-4 py-3 text-left transition hover:bg-muted/30"
                  onClick={() => setSelectedId(analysis.id)}
                >
                  <span>
                    <span className="block font-medium">{analysis.clientName}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(analysis.createdAt)}</span>
                  </span>
                  <span className="text-sm text-muted-foreground">{analysis.operationType}</span>
                  <span className={`font-semibold ${probabilityColor(analysis.diagnosis.approvalProbabilityNow)}`}>
                    {analysis.diagnosis.approvalProbabilityNow}%
                  </span>
                  <span className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeAnalysis(analysis.id);
                      }}
                    >
                      Excluir
                    </Button>
                  </span>
                </button>
              ))}
              {!normalizedAnalyses.length && (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Nenhuma análise gerada ainda.
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {selectedAnalysis && (
        <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
          <Card className="border-border/60 bg-card/70 p-5">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold">{selectedAnalysis.clientName}</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedAnalysis.operationType} - {formatBRL(selectedAnalysis.requestedAmount)}
                </p>
              </div>
              <Badge className="bg-primary/15 text-primary">
                {getCreditScoreLabel(selectedAnalysis.diagnosis.approvalProbabilityAfterPlan)}
              </Badge>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <MetricCard
                label="Probabilidade atual"
                value={`${selectedAnalysis.diagnosis.approvalProbabilityNow}%`}
                progress={selectedAnalysis.diagnosis.approvalProbabilityNow}
              />
              <MetricCard
                label="Após plano de ação"
                value={`${selectedAnalysis.diagnosis.approvalProbabilityAfterPlan}%`}
                progress={selectedAnalysis.diagnosis.approvalProbabilityAfterPlan}
              />
            </div>

            <div className="mt-5 rounded-xl border border-border/60 bg-background/40 p-4">
              <h3 className="font-medium">Diagnóstico executivo</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {selectedAnalysis.diagnosis.summary}
              </p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {selectedAnalysis.diagnosis.customerProfile}
              </p>
              <p className="mt-3 text-sm font-medium">
                Prazo estimado: {selectedAnalysis.diagnosis.estimatedTimeToGoal}
              </p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <InfoLine label="Score" value={String(selectedAnalysis.extracted.score ?? "Não identificado")} />
              <InfoLine label="Rating" value={selectedAnalysis.extracted.rating || "Não identificado"} />
              <InfoLine label="CPF/CNPJ" value={selectedAnalysis.extracted.cpf || "Não identificado"} />
              <InfoLine
                label="Renda estimada"
                value={
                  selectedAnalysis.extracted.estimatedIncome
                    ? formatBRL(selectedAnalysis.extracted.estimatedIncome)
                    : "Não identificada"
                }
              />
              <InfoLine
                label="Consultas recentes"
                value={String(selectedAnalysis.extracted.recentInquiries ?? "Não identificado")}
              />
              <InfoLine
                label="Saldo médio"
                value={
                  selectedAnalysis.extracted.averageBalance
                    ? formatBRL(selectedAnalysis.extracted.averageBalance)
                    : "Não identificado"
                }
              />
            </div>
          </Card>

          <Card className="border-border/60 bg-card/70 p-5">
            <h2 className="font-display text-lg font-semibold">Impedimentos e plano de ação</h2>
            <div className="mt-4 space-y-3">
              {selectedAnalysis.diagnosis.issues.map((issue, index) => (
                <div key={`${issue.title}-${index}`} className="rounded-xl border border-border/60 bg-background/40 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{issue.title}</h3>
                    <Badge className={impactClass(issue.impact)}>{issue.impact}</Badge>
                    <Badge variant="outline">{issue.priority}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{issue.recommendation}</p>
                </div>
              ))}
              {!selectedAnalysis.diagnosis.issues.length && (
                <p className="text-sm text-muted-foreground">Nenhum impedimento crítico identificado.</p>
              )}
            </div>

            <div className="mt-5 space-y-3">
              {selectedAnalysis.diagnosis.actions.map((action, index) => (
                <div key={`${action.action}-${index}`} className="rounded-xl border border-border/60 bg-background/40 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{action.area}</Badge>
                    <span className="text-xs text-muted-foreground">{action.deadline}</span>
                  </div>
                  <p className="mt-2 font-medium">{action.action}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{action.expectedGain}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="border-border/60 bg-card/70 p-5 xl:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <FileSearch className="h-5 w-5 text-primary" />
              <h2 className="font-display text-lg font-semibold">Aprendizado contínuo</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Resultado real</Label>
                <Select
                  value={selectedAnalysis.result?.status || "nao_informado"}
                  onValueChange={(value) => updateResult(selectedAnalysis.id, "status", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(resultStatusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor liberado</Label>
                <Input
                  defaultValue={
                    selectedAnalysis.result?.approvedAmount
                      ? formatCurrencyInput(selectedAnalysis.result.approvedAmount)
                      : ""
                  }
                  placeholder="R$ 0,00"
                  onBlur={(event) =>
                    updateResult(selectedAnalysis.id, "approvedAmount", event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Banco aprovador</Label>
                <Input
                  defaultValue={selectedAnalysis.result?.approvingBank || ""}
                  placeholder="Ex: C6, Itaú, Santander..."
                  onBlur={(event) =>
                    updateResult(selectedAnalysis.id, "approvingBank", event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Arquivos analisados</Label>
                <div className="rounded-md border border-border/60 px-3 py-2 text-sm text-muted-foreground">
                  {selectedAnalysis.sourceFiles.length} arquivo(s)
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-success/20 bg-success/10 p-4 text-sm text-muted-foreground">
              <CheckCircle2 className="mr-2 inline h-4 w-4 text-success" />
              Esses resultados ficam salvos para treinar futuramente um modelo preditivo próprio da VA.
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, progress }: { label: string; value: string; progress: number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-2 font-display text-3xl font-semibold ${probabilityColor(progress)}`}>{value}</p>
      <Progress value={progress} className="mt-3" />
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
