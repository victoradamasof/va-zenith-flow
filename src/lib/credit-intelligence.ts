export const creditAnalysesKey = "va-manager:credit-analyses";

export type CreditIssue = {
  title: string;
  impact: "baixo" | "medio" | "alto" | "critico";
  priority: "baixa" | "media" | "alta" | "urgente";
  recommendation: string;
};

export type CreditAction = {
  area: "Cadastro" | "Bancario" | "Financeiro" | "Dividas" | "Relacionamento" | "Documentos";
  action: string;
  deadline: string;
  expectedGain: string;
};

export type CreditConsultingStep = {
  title: string;
  actions: string[];
  expectedResult: string;
};

export type CreditBankStrategy = {
  bank: string;
  fit: string;
  reason: string;
  firstMove: string;
};

export type CreditAdvancedStrategy = {
  title: string;
  category:
    | "Produto bancario"
    | "Protecao"
    | "Relacionamento"
    | "Cadastro positivo"
    | "Movimentacao"
    | "Garantia";
  directScoreImpact: "baixo" | "medio" | "alto" | "incerto";
  bankAnalysisImpact: "baixo" | "medio" | "alto" | "incerto";
  whenItHelps: string;
  howToApply: string;
  caution: string;
};

export type CreditAnalysisRecord = {
  id: string;
  clientId?: string;
  clientName: string;
  createdAt: string;
  objective: string;
  requestedAmount: number;
  operationType: string;
  sourceFiles: Array<{
    name: string;
    type: string;
    size: number;
  }>;
  extracted: {
    name?: string;
    cpf?: string;
    birthDate?: string;
    address?: string;
    phones?: string[];
    score?: number | null;
    rating?: string;
    debts?: string[];
    protests?: string[];
    lawsuits?: string[];
    recentInquiries?: number | null;
    banks?: string[];
    averageBalance?: number | null;
    estimatedIncome?: number | null;
    incomeCommitment?: number | null;
  };
  diagnosis: {
    summary: string;
    customerProfile: string;
    approvalProbabilityNow: number;
    approvalProbabilityAfterPlan: number;
    probabilityRationale?: string;
    confidenceLevel?: "baixa" | "media" | "alta";
    estimatedTimeToGoal: string;
    mainBlockers: string[];
    opportunities: string[];
    missingData?: string[];
    immediatePlan?: CreditConsultingStep;
    plan30Days?: CreditConsultingStep;
    plan60Days?: CreditConsultingStep;
    plan90Days?: CreditConsultingStep;
    bankStrategies?: CreditBankStrategy[];
    advancedStrategies?: CreditAdvancedStrategy[];
    requiredDocuments?: string[];
    dontDo?: string[];
    consultantNotes?: string[];
    issues: CreditIssue[];
    actions: CreditAction[];
  };
  result?: {
    status?: "nao_informado" | "aprovado" | "reprovado";
    approvedAmount?: number;
    approvingBank?: string;
    notes?: string;
  };
};

export const emptyCreditAnalysis: CreditAnalysisRecord = {
  id: "empty",
  clientName: "",
  createdAt: new Date(0).toISOString(),
  objective: "",
  requestedAmount: 0,
  operationType: "",
  sourceFiles: [],
  extracted: {},
  diagnosis: {
    summary: "",
    customerProfile: "",
    approvalProbabilityNow: 0,
    approvalProbabilityAfterPlan: 0,
    probabilityRationale: "",
    confidenceLevel: "baixa",
    estimatedTimeToGoal: "",
    mainBlockers: [],
    opportunities: [],
    missingData: [],
    requiredDocuments: [],
    dontDo: [],
    consultantNotes: [],
    bankStrategies: [],
    advancedStrategies: [],
    issues: [],
    actions: [],
  },
};

export function normalizeCreditAnalysis(value: unknown): CreditAnalysisRecord {
  if (!value || typeof value !== "object") return emptyCreditAnalysis;
  const record = value as Partial<CreditAnalysisRecord>;

  return {
    ...emptyCreditAnalysis,
    ...record,
    id: record.id || `ci-${Date.now()}`,
    clientName: record.clientName || "Cliente",
    createdAt: record.createdAt || new Date().toISOString(),
    sourceFiles: Array.isArray(record.sourceFiles) ? record.sourceFiles : [],
    extracted: {
      ...emptyCreditAnalysis.extracted,
      ...(record.extracted ?? {}),
    },
    diagnosis: {
      ...emptyCreditAnalysis.diagnosis,
      ...(record.diagnosis ?? {}),
      mainBlockers: Array.isArray(record.diagnosis?.mainBlockers)
        ? record.diagnosis.mainBlockers
        : [],
      opportunities: Array.isArray(record.diagnosis?.opportunities)
        ? record.diagnosis.opportunities
        : [],
      missingData: Array.isArray(record.diagnosis?.missingData)
        ? record.diagnosis.missingData
        : [],
      requiredDocuments: Array.isArray(record.diagnosis?.requiredDocuments)
        ? record.diagnosis.requiredDocuments
        : [],
      dontDo: Array.isArray(record.diagnosis?.dontDo) ? record.diagnosis.dontDo : [],
      consultantNotes: Array.isArray(record.diagnosis?.consultantNotes)
        ? record.diagnosis.consultantNotes
        : [],
      bankStrategies: Array.isArray(record.diagnosis?.bankStrategies)
        ? record.diagnosis.bankStrategies
        : [],
      advancedStrategies: Array.isArray(record.diagnosis?.advancedStrategies)
        ? record.diagnosis.advancedStrategies
        : [],
      issues: Array.isArray(record.diagnosis?.issues) ? record.diagnosis.issues : [],
      actions: Array.isArray(record.diagnosis?.actions) ? record.diagnosis.actions : [],
    },
  };
}

export function getCreditScoreLabel(probability: number) {
  if (probability >= 75) return "Alto potencial";
  if (probability >= 50) return "Aprovável com ajustes";
  if (probability >= 30) return "Em recuperação";
  return "Crítico";
}
