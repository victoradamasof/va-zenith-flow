export const ratingIntakesKey = "va-manager:rating-intakes";
export const ratingLinksKey = "va-manager:rating-links";

export type RatingIntakeStatus = "pendente" | "enviado" | "concluido";
export type RatingEntityType = "pf" | "pj";

export const ratingStatusOptions: { value: RatingIntakeStatus; label: string }[] = [
  { value: "pendente", label: "Pendente" },
  { value: "enviado", label: "Enviado" },
  { value: "concluido", label: "Concluído" },
];

export type RatingFileInfo = {
  id?: string;
  name: string;
  type: string;
  size: number;
  updatedAt: string;
};

export const ratingFileMaxBytes = 15 * 1024 * 1024;

export async function uploadRatingFile(token: string, file: File): Promise<RatingFileInfo> {
  if (!token) throw new Error("O link da ficha ainda não foi gerado.");
  if (file.size > ratingFileMaxBytes) throw new Error("O arquivo deve ter no máximo 15 MB.");

  const body = new FormData();
  body.append("file", file);
  const response = await fetch(`/api/rating-files/${encodeURIComponent(token)}`, {
    method: "POST",
    body,
  });
  const result = (await response.json().catch(() => null)) as
    | { file?: RatingFileInfo; error?: string }
    | null;
  if (!response.ok || !result?.file) {
    throw new Error(result?.error || "Não foi possível enviar o arquivo.");
  }
  return result.file;
}

export type RatingBankAccount = {
  bank: string;
  agency: string;
  account: string;
  pixKey: string;
};

export type RatingLogin = {
  name: string;
  login: string;
  password: string;
};

export type RatingProperty = {
  cep: string;
  street: string;
  type: string;
  district: string;
  city: string;
  uf: string;
  value: string;
};

export type RatingVehicle = {
  value: string;
  year: string;
  plate: string;
  uf: string;
};

export type RatingReference = {
  name: string;
  phone: string;
  relationship: string;
};

export type RatingDocuments = {
  identity?: RatingFileInfo;
  residence?: RatingFileInfo;
  selfie?: RatingFileInfo;
  incomeTax?: RatingFileInfo;
  custom: RatingFileInfo[];
};

export type RatingPFForm = {
  voterTitle: string;
  rg: string;
  rgIssueDate: string;
  birthDate: string;
  maritalStatus: string;
  homePhone: string;
  mobilePhone: string;
  email: string;
  fatherName: string;
  motherName: string;
  spouseName: string;
  spouseCpf: string;
  spouseRg: string;
  profession: string;
  admissionDate: string;
  incomeRange: string;
  salary: string;
  familyIncome: string;
  presumedIncome: string;
  serasaChecked: boolean;
  serasaScore: string;
  logins: RatingLogin[];
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  uf: string;
  bankAccounts: RatingBankAccount[];
  properties: RatingProperty[];
  vehicles: RatingVehicle[];
  ownsCompany: boolean;
  companyName: string;
  companyCnpj: string;
  documents: RatingDocuments;
  references: RatingReference[];
  notes: string;
};

export type RatingPJDocuments = {
  cnpjCard?: RatingFileInfo;
  revenueLast12Months?: RatingFileInfo;
  articlesOfAssociation?: RatingFileInfo;
  incomeTax?: RatingFileInfo;
  custom: RatingFileInfo[];
};

export type RatingPJForm = {
  tradeName: string;
  stateRegistration: string;
  municipalRegistration: string;
  cnae: string;
  taxRegime: string;
  website: string;
  companyPhone: string;
  contactEmail: string;
  responsibleName: string;
  responsibleRg: string;
  responsibleCpf: string;
  responsibleRole: string;
  responsiblePhone: string;
  responsibleEmail: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  uf: string;
  bankAccounts: RatingBankAccount[];
  monthlyRevenue: string;
  annualRevenue: string;
  serasaChecked: boolean;
  serasaScore: string;
  logins: RatingLogin[];
  vehicles: RatingVehicle[];
  machinery: string;
  otherAssets: string;
  documents: RatingPJDocuments;
  references: RatingReference[];
  notes: string;
};

export type RatingFormData = RatingPFForm | RatingPJForm;

export type RatingFormsByType = {
  pf?: RatingPFForm;
  pj?: RatingPJForm;
};

export type RatingIntake = {
  id: string;
  token: string;
  saleId: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  service: string;
  seller: string;
  type: RatingEntityType;
  status: RatingIntakeStatus;
  createdAt: string;
  submittedAt?: string;
  data: RatingFormData;
  forms?: RatingFormsByType;
};

export type RatingLinkRecord = {
  token: string;
  saleId: string;
  clientName: string;
  service: string;
  seller: string;
  type?: RatingEntityType;
  path: string;
  createdAt: string;
};

export type RatingLinkPayload = {
  saleId: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  service: string;
  seller: string;
  type: RatingEntityType;
};

export function createEmptyRatingPFForm(overrides: Partial<RatingPFForm> = {}): RatingPFForm {
  return {
    voterTitle: "",
    rg: "",
    rgIssueDate: "",
    birthDate: "",
    maritalStatus: "",
    homePhone: "",
    mobilePhone: "",
    email: "",
    fatherName: "",
    motherName: "",
    spouseName: "",
    spouseCpf: "",
    spouseRg: "",
    profession: "",
    admissionDate: "",
    incomeRange: "",
    salary: "",
    familyIncome: "",
    presumedIncome: "",
    serasaChecked: false,
    serasaScore: "",
    logins: [{ name: "Serasa", login: "", password: "" }],
    cep: "",
    street: "",
    number: "",
    complement: "",
    district: "",
    city: "",
    uf: "",
    bankAccounts: [{ bank: "", agency: "", account: "", pixKey: "" }],
    properties: [
      {
        cep: "",
        street: "",
        type: "",
        district: "",
        city: "",
        uf: "",
        value: "",
      },
    ],
    vehicles: [{ value: "", year: "", plate: "", uf: "" }],
    ownsCompany: false,
    companyName: "",
    companyCnpj: "",
    documents: { custom: [] },
    references: [{ name: "", phone: "", relationship: "" }],
    notes: "",
    ...overrides,
  };
}

export function createEmptyRatingPJForm(overrides: Partial<RatingPJForm> = {}): RatingPJForm {
  return {
    tradeName: "",
    stateRegistration: "",
    municipalRegistration: "",
    cnae: "",
    taxRegime: "",
    website: "",
    companyPhone: "",
    contactEmail: "",
    responsibleName: "",
    responsibleRg: "",
    responsibleCpf: "",
    responsibleRole: "",
    responsiblePhone: "",
    responsibleEmail: "",
    cep: "",
    street: "",
    number: "",
    complement: "",
    district: "",
    city: "",
    uf: "",
    bankAccounts: [{ bank: "", agency: "", account: "", pixKey: "" }],
    monthlyRevenue: "",
    annualRevenue: "",
    serasaChecked: false,
    serasaScore: "",
    logins: [{ name: "Serasa", login: "", password: "" }],
    vehicles: [{ value: "", year: "", plate: "", uf: "" }],
    machinery: "",
    otherAssets: "",
    documents: { custom: [] },
    references: [{ name: "", phone: "", relationship: "" }],
    notes: "",
    ...overrides,
  };
}

export function createEmptyRatingForm(type: RatingEntityType, overrides: Partial<RatingFormData> = {}) {
  return type === "pj"
    ? createEmptyRatingPJForm(overrides as Partial<RatingPJForm>)
    : createEmptyRatingPFForm(overrides as Partial<RatingPFForm>);
}

export function inferRatingEntityType(document = ""): RatingEntityType {
  return document.replace(/\D/g, "").length > 11 ? "pj" : "pf";
}

export function normalizeRatingEntityType(type?: string): RatingEntityType {
  return type === "pj" ? "pj" : "pf";
}

export function getRatingFormSnapshot(
  intake: Pick<RatingIntake, "type" | "data" | "forms">,
  type: RatingEntityType,
): RatingFormData {
  const stored = intake.forms?.[type];
  if (stored) return stored;
  if (normalizeRatingEntityType(intake.type) === type && intake.data) return intake.data;
  return createEmptyRatingForm(type);
}

export function saveRatingFormSnapshot(
  intake: RatingIntake,
  type: RatingEntityType,
  data: RatingFormData,
): RatingIntake {
  return {
    ...intake,
    data,
    forms: {
      ...intake.forms,
      [type]: data,
    },
  };
}

export function normalizeRatingIntake(intake: RatingIntake): RatingIntake {
  const type = normalizeRatingEntityType(intake.type);
  return {
    ...intake,
    status: normalizeRatingStatus(intake.status),
    type,
    forms: {
      ...intake.forms,
      [type]: intake.forms?.[type] ?? intake.data,
    },
  };
}

export function getRatingEntityTypeLabel(type?: string) {
  return normalizeRatingEntityType(type) === "pj" ? "Pessoa Jurídica" : "Pessoa Física";
}

export function isRatingService(service = "") {
  const normalized = service
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return normalized.includes("rating");
}

export function normalizeRatingStatus(status?: string): RatingIntakeStatus {
  if (status === "enviado" || status === "concluido" || status === "pendente") return status;
  if (status === "preenchido") return "enviado";
  return "pendente";
}

export function getRatingStatusLabel(status?: string) {
  const normalized = normalizeRatingStatus(status);
  return ratingStatusOptions.find((option) => option.value === normalized)?.label ?? "Pendente";
}

export function mergeRatingIntakes(existing: RatingIntake[], incoming: RatingIntake[]) {
  const merged = new Map<string, RatingIntake>();
  for (const item of existing) {
    if (item.id || item.token) {
      merged.set(item.id || item.token, normalizeRatingIntake(item));
    }
  }
  for (const item of incoming) {
    if (!item?.id && !item?.token) continue;
    const key = item.id || item.token;
    merged.set(key, normalizeRatingIntake({
      ...merged.get(key),
      ...item,
      forms: {
        ...merged.get(key)?.forms,
        ...item.forms,
      },
    }));
  }
  return Array.from(merged.values()).sort((a, b) =>
    String(b.submittedAt ?? b.createdAt).localeCompare(String(a.submittedAt ?? a.createdAt)),
  );
}
