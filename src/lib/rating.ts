export const ratingIntakesKey = "va-manager:rating-intakes";
export const ratingLinksKey = "va-manager:rating-links";

export type RatingIntakeStatus = "pendente" | "enviado" | "concluido";

export const ratingStatusOptions: { value: RatingIntakeStatus; label: string }[] = [
  { value: "pendente", label: "Pendente" },
  { value: "enviado", label: "Enviado" },
  { value: "concluido", label: "Concluído" },
];

export type RatingFileInfo = {
  name: string;
  type: string;
  size: number;
  updatedAt: string;
};

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

export type RatingIntake = {
  id: string;
  token: string;
  saleId: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  service: string;
  seller: string;
  type: "pf";
  status: RatingIntakeStatus;
  createdAt: string;
  submittedAt?: string;
  data: RatingPFForm;
};

export type RatingLinkRecord = {
  token: string;
  saleId: string;
  clientName: string;
  service: string;
  seller: string;
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
  type: "pf";
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
      merged.set(item.id || item.token, { ...item, status: normalizeRatingStatus(item.status) });
    }
  }
  for (const item of incoming) {
    if (!item?.id && !item?.token) continue;
    const key = item.id || item.token;
    merged.set(key, { ...merged.get(key), ...item, status: normalizeRatingStatus(item.status) });
  }
  return Array.from(merged.values()).sort((a, b) =>
    String(b.submittedAt ?? b.createdAt).localeCompare(String(a.submittedAt ?? a.createdAt)),
  );
}
