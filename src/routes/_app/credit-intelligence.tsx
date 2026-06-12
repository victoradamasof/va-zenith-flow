import { createFileRoute } from "@tanstack/react-router";
import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  Download,
  FileSearch,
  LineChart,
  Route as RouteIcon,
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
  type CreditConsultingStep,
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

function asList(value?: string[]) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderPdfList(items?: string[]) {
  const validItems = asList(items);
  if (!validItems.length) return "<p class=\"muted\">Sem itens informados.</p>";
  return `<ul>${validItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderCreditAnalysisPdf(analysis: CreditAnalysisRecord) {
  const steps = [
    analysis.diagnosis.immediatePlan,
    analysis.diagnosis.plan30Days,
    analysis.diagnosis.plan60Days,
    analysis.diagnosis.plan90Days,
  ].filter(Boolean) as CreditConsultingStep[];
  const score = analysis.extracted.score ? String(analysis.extracted.score) : "Não identificado";
  const rating = analysis.extracted.rating || "Não identificado";
  const income = analysis.extracted.estimatedIncome
    ? formatBRL(analysis.extracted.estimatedIncome)
    : "Não identificada";
  const balance = analysis.extracted.averageBalance
    ? formatBRL(analysis.extracted.averageBalance)
    : "Não identificado";
  const createdAt = formatDateTime(analysis.createdAt);
  const chanceNow = Math.max(0, Math.min(100, analysis.diagnosis.approvalProbabilityNow));
  const chanceAfter = Math.max(0, Math.min(100, analysis.diagnosis.approvalProbabilityAfterPlan));
  const gain = Math.max(chanceAfter - chanceNow, 0);

  const html = `<!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Diagnóstico de Crédito - ${escapeHtml(analysis.clientName)}</title>
        <style>
          @page { size: A4; margin: 0; }
          * { box-sizing: border-box; }
          html, body {
            margin: 0;
            min-height: 100%;
            background: #050505;
            color: #fff8f2;
            font-family: Inter, Arial, Helvetica, sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body { counter-reset: page; }
          .print-toolbar {
            position: sticky;
            top: 0;
            z-index: 99;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            padding: 10px 14px;
            background: #090604;
            border-bottom: 1px solid rgba(255, 111, 24, .28);
            color: #f4e7dd;
            font-size: 12px;
          }
          .print-toolbar button {
            border: 0;
            border-radius: 999px;
            background: linear-gradient(135deg, #ff7a1a, #ff5a00);
            color: #140805;
            font-weight: 900;
            padding: 9px 16px;
            cursor: pointer;
          }
          .page {
            position: relative;
            isolation: isolate;
            width: 210mm;
            height: 295mm;
            max-height: 295mm;
            margin: 0 auto;
            padding: 12mm 14mm 10mm;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            break-after: page;
            page-break-after: always;
            background:
              radial-gradient(circle at 78% 14%, rgba(255, 122, 26, .44), transparent 30%),
              radial-gradient(circle at 12% 86%, rgba(255, 122, 26, .18), transparent 33%),
              linear-gradient(135deg, #160804 0%, #050505 48%, #0f0603 100%);
          }
          .page::before {
            content: "";
            position: absolute;
            inset: 0;
            z-index: -2;
            background-image:
              linear-gradient(rgba(255, 122, 26, .07) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 122, 26, .07) 1px, transparent 1px);
            background-size: 18mm 18mm;
            mask-image: linear-gradient(to bottom, rgba(0,0,0,.95), rgba(0,0,0,.2));
          }
          .page::after {
            content: "";
            position: absolute;
            inset: 5mm;
            z-index: -1;
            border: 1px solid rgba(255, 122, 26, .24);
            border-radius: 7mm;
            box-shadow: inset 0 0 70px rgba(255, 122, 26, .08);
            pointer-events: none;
          }
          .page:last-of-type { break-after: auto; page-break-after: auto; }
          .brand {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 18px;
          }
          .logo-wrap {
            width: 39mm;
            height: 24mm;
            display: grid;
            place-items: center;
            border-radius: 5mm;
            background: #030303;
            border: 1px solid rgba(255, 122, 26, .38);
            box-shadow: 0 20px 70px rgba(255, 92, 0, .18);
          }
          .brand img { width: 31mm; height: auto; display: block; }
          .tag {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            border: 1px solid rgba(255, 122, 26, .36);
            border-radius: 999px;
            color: #ff8a2a;
            background: rgba(255, 122, 26, .08);
            padding: 8px 13px;
            font-size: 10px;
            font-weight: 900;
            letter-spacing: .16em;
            text-transform: uppercase;
          }
          .tag::before {
            content: "";
            width: 7px;
            height: 7px;
            border-radius: 999px;
            background: #ff7a1a;
            box-shadow: 0 0 18px #ff7a1a;
          }
          h1 {
            margin: 17mm 0 5mm;
            max-width: 172mm;
            font-size: 15mm;
            line-height: .96;
            letter-spacing: -.04em;
          }
          h2 { margin: 0 0 4mm; font-size: 6.7mm; line-height: 1.05; letter-spacing: -.02em; }
          h3 { margin: 0 0 2mm; font-size: 4.15mm; line-height: 1.25; color: #fff; }
          p { margin: 0; line-height: 1.42; color: #d8c9be; font-size: 3.35mm; }
          .lead { max-width: 158mm; font-size: 4.8mm; line-height: 1.38; color: #f2e8df; }
          .muted { color: #9f9188; }
          .accent { color: #ff8426; }
          .section { margin-top: 5mm; }
          .small-section { margin-top: 3mm; }
          .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 3.5mm; }
          .grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 3.5mm; }
          .card {
            position: relative;
            overflow: hidden;
            border: 1px solid rgba(255,255,255,.11);
            border-radius: 4.5mm;
            background:
              linear-gradient(145deg, rgba(255,255,255,.082), rgba(255,255,255,.026)),
              rgba(10, 7, 5, .72);
            padding: 4mm;
            box-shadow: 0 16px 48px rgba(0,0,0,.34);
            break-inside: avoid;
          }
          .card::before {
            content: "";
            position: absolute;
            inset: 0;
            background: radial-gradient(circle at 82% 10%, rgba(255, 122, 26, .14), transparent 36%);
            pointer-events: none;
          }
          .hero-panel {
            margin-top: 10mm;
            display: grid;
            grid-template-columns: 1.05fr .95fr;
            gap: 4mm;
            align-items: stretch;
          }
          .kpi { min-height: 25mm; }
          .kpi .label {
            color: #a99b92;
            font-size: 2.75mm;
            text-transform: uppercase;
            letter-spacing: .14em;
            font-weight: 800;
          }
          .kpi .value {
            margin-top: 2mm;
            color: #fff;
            font-size: 7.7mm;
            line-height: 1;
            font-weight: 950;
            letter-spacing: -.03em;
          }
          .bar { height: 2.2mm; margin-top: 3mm; border-radius: 999px; background: rgba(255,255,255,.1); overflow: hidden; }
          .bar span { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, #ff6f18, #ffc078); }
          .probability {
            display: grid;
            place-items: center;
            min-height: 61mm;
            text-align: center;
            background:
              radial-gradient(circle, rgba(255, 122, 26, .18) 0 46%, transparent 47%),
              linear-gradient(145deg, rgba(255,255,255,.07), rgba(255,255,255,.02));
          }
          .probability .big { font-size: 19mm; font-weight: 950; line-height: .95; letter-spacing: -.06em; color: #ff8426; }
          .probability .sub { margin-top: 2mm; font-size: 3.2mm; color: #d8c9be; text-transform: uppercase; letter-spacing: .18em; }
          .pill-row { display: flex; flex-wrap: wrap; gap: 2mm; margin-top: 4mm; }
          .pill {
            border: 1px solid rgba(255, 122, 26, .28);
            border-radius: 999px;
            padding: 2.2mm 3.2mm;
            color: #f7ded1;
            background: rgba(255, 122, 26, .08);
            font-size: 3mm;
            font-weight: 800;
          }
          ul { margin: 2.4mm 0 0; padding-left: 4.2mm; color: #dccfc6; line-height: 1.38; font-size: 3.05mm; }
          li { margin: 1mm 0; }
          .issue { border-left: 1.2mm solid #ff7a1a; }
          .step-number {
            width: 9mm;
            height: 9mm;
            display: inline-grid;
            place-items: center;
            margin-right: 2.5mm;
            border-radius: 99px;
            background: #ff7a1a;
            color: #120704;
            font-weight: 950;
          }
          .page-footer {
            margin-top: auto;
            padding-top: 4mm;
            display: flex;
            align-items: center;
            justify-content: space-between;
            color: #8d8078;
            font-size: 2.55mm;
          }
          .page-footer::after { counter-increment: page; content: "Página " counter(page); }
          .cover-mark {
            position: absolute;
            right: -12mm;
            bottom: 6mm;
            font-size: 58mm;
            line-height: 1;
            font-weight: 950;
            color: rgba(255, 122, 26, .08);
            letter-spacing: -.08em;
          }
          @media print {
            .print-toolbar { display: none; }
            html, body { width: 210mm; background: #050505; }
            .page { margin: 0; box-shadow: none; break-inside: avoid; page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="print-toolbar">
          <span>Para sair sem bordas brancas: destino "Salvar como PDF", margens "Nenhuma" e cabeçalhos/rodapés desativados.</span>
          <button type="button" onclick="window.print()">Salvar PDF</button>
        </div>

        <section class="page">
          <div class="cover-mark">VA</div>
          <div class="brand">
            <div class="logo-wrap"><img src="/va-consultoria-logo-cropped.png" alt="VA Consultoria" /></div>
            <span class="tag">VA Credit Intelligence</span>
          </div>
          <h1>Diagnóstico consultivo de crédito</h1>
          <p class="lead">${escapeHtml(analysis.clientName)} recebeu uma análise estratégica para ${escapeHtml(
            analysis.operationType,
          )}, com plano prático para melhorar score, relacionamento bancário e probabilidade de aprovação.</p>
          <div class="hero-panel">
            <div class="card">
              <h2>Resumo executivo</h2>
              <p>${escapeHtml(analysis.diagnosis.summary)}</p>
              <div class="pill-row">
                <span class="pill">Objetivo: ${escapeHtml(analysis.operationType)}</span>
                <span class="pill">Valor: ${formatBRL(analysis.requestedAmount)}</span>
                <span class="pill">Prazo: ${escapeHtml(analysis.diagnosis.estimatedTimeToGoal)}</span>
              </div>
            </div>
            <div class="card probability">
              <div>
                <div class="big">${chanceAfter}%</div>
                <div class="sub">Potencial após plano</div>
                <p class="small-section">Ganho estimado de <strong class="accent">${gain} pontos</strong> na probabilidade.</p>
              </div>
            </div>
          </div>
          <div class="section grid-3">
            <div class="card kpi"><div class="label">Chance atual</div><div class="value">${chanceNow}%</div><div class="bar"><span style="width:${chanceNow}%"></span></div></div>
            <div class="card kpi"><div class="label">Após o plano</div><div class="value">${chanceAfter}%</div><div class="bar"><span style="width:${chanceAfter}%"></span></div></div>
            <div class="card kpi"><div class="label">Score</div><div class="value">${escapeHtml(score)}</div></div>
          </div>
          <div class="page-footer"><span>VA Consultoria · ${escapeHtml(createdAt)}</span></div>
        </section>

        <section class="page">
          <div class="brand"><span class="tag">Perfil do cliente</span><div class="logo-wrap"><img src="/va-consultoria-logo-cropped.png" alt="VA Consultoria" /></div></div>
          <div class="section grid">
            <div class="card kpi"><div class="label">Rating bancário</div><div class="value">${escapeHtml(rating)}</div></div>
            <div class="card kpi"><div class="label">Renda estimada</div><div class="value">${escapeHtml(income)}</div></div>
            <div class="card kpi"><div class="label">Saldo médio</div><div class="value">${escapeHtml(balance)}</div></div>
            <div class="card kpi"><div class="label">Capacidade projetada</div><div class="value">${chanceAfter}%</div></div>
          </div>
          <div class="section card">
            <h2>Leitura consultiva</h2>
            <p>${escapeHtml(analysis.diagnosis.customerProfile)}</p>
          </div>
          <div class="section card">
            <h2>Racional da aprovação</h2>
            <p>${escapeHtml(analysis.diagnosis.probabilityRationale || "Não informado.")}</p>
          </div>
          <div class="section grid">
            <div class="card"><h3>Principais bloqueios</h3>${renderPdfList(analysis.diagnosis.mainBlockers)}</div>
            <div class="card"><h3>Oportunidades de virada</h3>${renderPdfList(analysis.diagnosis.opportunities)}</div>
          </div>
          <div class="page-footer"><span>Diagnóstico gerado pela VA Consultoria · ${escapeHtml(analysis.clientName)}</span></div>
        </section>

        <section class="page">
          <div class="brand"><span class="tag">Impedimentos e prioridades</span><div class="logo-wrap"><img src="/va-consultoria-logo-cropped.png" alt="VA Consultoria" /></div></div>
          <div class="section grid">
            ${analysis.diagnosis.issues
              .map(
                (issue, index) => `<div class="card issue">
                  <h3><span class="step-number">${index + 1}</span>${escapeHtml(issue.title)}</h3>
                  <p><strong class="accent">Impacto:</strong> ${escapeHtml(issue.impact)} · <strong class="accent">Prioridade:</strong> ${escapeHtml(issue.priority)}</p>
                  <p class="small-section">${escapeHtml(issue.recommendation)}</p>
                </div>`,
              )
              .join("") || "<div class=\"card\"><p class=\"muted\">Nenhum impedimento crítico identificado.</p></div>"}
          </div>
          <div class="page-footer"><span>VA Credit Intelligence · Prioridades para aprovação</span></div>
        </section>

        <section class="page">
          <div class="brand"><span class="tag">Plano de ação</span><div class="logo-wrap"><img src="/va-consultoria-logo-cropped.png" alt="VA Consultoria" /></div></div>
          <div class="section grid">
            ${steps
              .map(
                (step, index) => `<div class="card">
                  <h3><span class="step-number">${index + 1}</span>${escapeHtml(step.title)}</h3>
                  ${renderPdfList(step.actions)}
                  <p class="small-section"><strong class="accent">Resultado esperado:</strong> ${escapeHtml(step.expectedResult)}</p>
                </div>`,
              )
              .join("")}
          </div>
          <div class="section card">
            <h2>Ações práticas da consultoria</h2>
            ${analysis.diagnosis.actions
              .map(
                (action) => `<div class="small-section">
                  <h3>${escapeHtml(action.area)} · ${escapeHtml(action.deadline)}</h3>
                  <p>${escapeHtml(action.action)}</p>
                  <p class="accent">${escapeHtml(action.expectedGain)}</p>
                </div>`,
              )
              .join("")}
          </div>
          <div class="page-footer"><span>Roteiro consultivo · ${escapeHtml(analysis.operationType)}</span></div>
        </section>

        <section class="page">
          <div class="brand"><span class="tag">Estratégia avançada</span><div class="logo-wrap"><img src="/va-consultoria-logo-cropped.png" alt="VA Consultoria" /></div></div>
          <div class="section grid">
            <div class="card">
              <h2>Estratégia bancária</h2>
              ${analysis.diagnosis.bankStrategies
                ?.map(
                  (strategy) => `<div class="small-section">
                    <h3>${escapeHtml(strategy.bank)} · aderência ${escapeHtml(strategy.fit)}</h3>
                    <p>${escapeHtml(strategy.reason)}</p>
                    <p><strong class="accent">Primeiro movimento:</strong> ${escapeHtml(strategy.firstMove)}</p>
                  </div>`,
                )
                .join("") || "<p class=\"muted\">Sem estratégia bancária informada.</p>"}
            </div>
            <div class="card">
              <h2>Checklist do consultor</h2>
              <h3>Documentos necessários</h3>${renderPdfList(analysis.diagnosis.requiredDocuments)}
              <h3 class="small-section">Não fazer agora</h3>${renderPdfList(analysis.diagnosis.dontDo)}
              <h3 class="small-section">Notas da consultoria</h3>${renderPdfList(analysis.diagnosis.consultantNotes)}
            </div>
          </div>
          <div class="section card">
            <h2>Diferenciais e sinais indiretos</h2>
            ${analysis.diagnosis.advancedStrategies
              ?.map(
                (strategy) => `<div class="small-section">
                  <h3>${escapeHtml(strategy.title)} · ${escapeHtml(strategy.category)}</h3>
                  <p><strong class="accent">Quando ajuda:</strong> ${escapeHtml(strategy.whenItHelps)}</p>
                  <p><strong class="accent">Como aplicar:</strong> ${escapeHtml(strategy.howToApply)}</p>
                  <p class="muted">Cuidado: ${escapeHtml(strategy.caution)}</p>
                </div>`,
              )
              .join("") || "<p class=\"muted\">Sem estratégias avançadas informadas.</p>"}
          </div>
          <div class="page-footer"><span>Documento consultivo confidencial · VA Consultoria</span></div>
        </section>
        <script>
          window.addEventListener("load", () => setTimeout(() => window.print(), 450));
        </script>
      </body>
    </html>`;

  const printWindow = window.open("", "_blank", "width=1100,height=900");
  if (!printWindow) {
    toast.error("Permita pop-ups para gerar o PDF.");
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
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
          ? "Consultoria gerada com IA."
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

  const consultingSteps = selectedAnalysis
    ? [
        selectedAnalysis.diagnosis.immediatePlan,
        selectedAnalysis.diagnosis.plan30Days,
        selectedAnalysis.diagnosis.plan60Days,
        selectedAnalysis.diagnosis.plan90Days,
      ].filter(Boolean)
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="VA Credit Intelligence"
        subtitle="Consultoria inteligente de crédito, score, rating bancário e plano de ação"
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
            <h2 className="font-display text-lg font-semibold">Nova análise consultiva</h2>
            <p className="text-sm text-muted-foreground">
              Vincule ao cliente, anexe relatórios e gere uma estratégia prática de aprovação.
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
                placeholder="Banco desejado, renda informada, urgência, restrições conhecidas, entrada disponível, parcela máxima..."
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
              {loading ? "Analisando..." : "Gerar consultoria"}
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
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-primary/15 text-primary">
                  {getCreditScoreLabel(selectedAnalysis.diagnosis.approvalProbabilityAfterPlan)}
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => renderCreditAnalysisPdf(selectedAnalysis)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Baixar PDF
                </Button>
              </div>
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
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-medium">Diagnóstico consultivo</h3>
                <Badge variant="outline">Confiança: {selectedAnalysis.diagnosis.confidenceLevel || "baixa"}</Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {selectedAnalysis.diagnosis.summary}
              </p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {selectedAnalysis.diagnosis.customerProfile}
              </p>
              {selectedAnalysis.diagnosis.probabilityRationale && (
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  <span className="font-medium text-foreground">Probabilidade:</span>{" "}
                  {selectedAnalysis.diagnosis.probabilityRationale}
                </p>
              )}
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
            <h2 className="font-display text-lg font-semibold">Impedimentos e prioridades</h2>
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
          </Card>

          <Card className="border-border/60 bg-card/70 p-5 xl:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <RouteIcon className="h-5 w-5 text-primary" />
              <h2 className="font-display text-lg font-semibold">Roteiro de consultoria</h2>
            </div>
            <div className="grid gap-4 lg:grid-cols-4">
              {consultingSteps.map((step, index) => (
                <ConsultingStepCard key={`${step?.title}-${index}`} step={step as CreditConsultingStep} />
              ))}
              {!consultingSteps.length && (
                <p className="text-sm text-muted-foreground">Gere uma nova análise para receber o roteiro completo.</p>
              )}
            </div>
          </Card>

          <Card className="border-border/60 bg-card/70 p-5">
            <h2 className="font-display text-lg font-semibold">Estratégia bancária</h2>
            <div className="mt-4 space-y-3">
              {selectedAnalysis.diagnosis.bankStrategies?.map((strategy, index) => (
                <div key={`${strategy.bank}-${index}`} className="rounded-xl border border-border/60 bg-background/40 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{strategy.bank}</h3>
                    <Badge variant="outline">Aderência: {strategy.fit}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{strategy.reason}</p>
                  <p className="mt-2 text-sm">
                    <span className="font-medium">Primeiro movimento:</span> {strategy.firstMove}
                  </p>
                </div>
              ))}
              {!selectedAnalysis.diagnosis.bankStrategies?.length && (
                <p className="text-sm text-muted-foreground">Nenhuma estratégia bancária disponível.</p>
              )}
            </div>
          </Card>

          <Card className="border-border/60 bg-card/70 p-5">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <div>
                <h2 className="font-display text-lg font-semibold">Estratégias avançadas</h2>
                <p className="text-sm text-muted-foreground">
                  Sinais indiretos que podem fortalecer relacionamento e análise interna quando fizerem sentido.
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {selectedAnalysis.diagnosis.advancedStrategies?.map((strategy, index) => (
                <div
                  key={`${strategy.title}-${index}`}
                  className="rounded-xl border border-border/60 bg-background/40 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{strategy.title}</h3>
                    <Badge variant="outline">{strategy.category}</Badge>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <InfoLine label="Impacto no score" value={strategy.directScoreImpact} />
                    <InfoLine label="Impacto bancário" value={strategy.bankAnalysisImpact} />
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Quando ajuda:</span> {strategy.whenItHelps}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Como aplicar:</span> {strategy.howToApply}
                  </p>
                  <p className="mt-2 text-sm text-warning">
                    <span className="font-medium">Cuidado:</span> {strategy.caution}
                  </p>
                </div>
              ))}
              {!selectedAnalysis.diagnosis.advancedStrategies?.length && (
                <p className="text-sm text-muted-foreground">Nenhuma estratégia avançada disponível.</p>
              )}
            </div>
          </Card>

          <Card className="border-border/60 bg-card/70 p-5">
            <h2 className="font-display text-lg font-semibold">Checklist do consultor</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <ListPanel title="Dados faltantes" items={asList(selectedAnalysis.diagnosis.missingData)} />
              <ListPanel title="Documentos necessários" items={asList(selectedAnalysis.diagnosis.requiredDocuments)} />
              <ListPanel title="Não fazer agora" items={asList(selectedAnalysis.diagnosis.dontDo)} />
              <ListPanel title="Notas da consultoria" items={asList(selectedAnalysis.diagnosis.consultantNotes)} />
            </div>
          </Card>

          <Card className="border-border/60 bg-card/70 p-5 xl:col-span-2">
            <h2 className="font-display text-lg font-semibold">Ações práticas</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
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

function ConsultingStepCard({ step }: { step: CreditConsultingStep }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-4">
      <h3 className="font-medium">{step.title}</h3>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        {step.actions.map((action, index) => (
          <li key={`${action}-${index}`} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span>{action}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Resultado esperado:</span> {step.expectedResult}
      </p>
    </div>
  );
}

function ListPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-4">
      <h3 className="font-medium">{title}</h3>
      {items.length ? (
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          {items.map((item, index) => (
            <li key={`${item}-${index}`} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Sem itens informados.</p>
      )}
    </div>
  );
}
