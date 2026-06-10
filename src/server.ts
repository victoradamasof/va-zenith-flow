import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

type KvNamespace = {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>;
};

type CloudEnv = {
  VA_MANAGER_DATA?: KvNamespace;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
  OPENAI_API_KEY?: string;
  OPENAI_CREDIT_MODEL?: string;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;
const cloudDataKey = "va-manager:primary-state";
const signingLinkPrefix = "va-manager:signing-link:";
const usersDataKey = "va-manager:users";
const signedContractsDataKey = "va-manager:signed-contracts";
const notificationEventsDataKey = "va-manager:notification-events";
const pushSubscriptionsDataKey = "va-manager:push-subscriptions";
const defaultVapidPublicKey =
  "BIhtr_sTP-63VxWZtX-faVbGNawjzZfZCuXICEU9ksAd-W-SDp799CJmOpjJU6Y91Ym6nNLqpz2CqhVGX2SbJjE";
const defaultVapidPrivateKey = "yvtjhKnLweyCoVEDW8k1L6F1R4ziPqyXVRU8tWUEvJ0";
const defaultVapidSubject = "mailto:victorexvendas@gmail.com";

type StoredPushSubscription = {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
  userAgent?: string;
  updatedAt?: string;
};

type PushNotificationPayload = {
  id?: string;
  type?: "sale" | "contract" | "bank" | "system";
  title?: string;
  body?: string;
  tag?: string;
  url?: string;
  createdAt?: string;
  expiresAt?: string;
};

type CreditAnalysisFile = {
  name?: string;
  type?: string;
  size?: number;
  dataUrl?: string;
  text?: string;
};

type CreditAnalysisRequest = {
  client?: unknown;
  objective?: string;
  requestedAmount?: number;
  operationType?: string;
  notes?: string;
  files?: CreditAnalysisFile[];
};

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} - try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });
}

type CloudPayload = {
  updatedAt: string;
  data: Record<string, unknown>;
};

function parseCloudPayload(stored: string | null): CloudPayload | null {
  if (!stored) return null;
  try {
    const payload = JSON.parse(stored) as Partial<CloudPayload>;
    if (!payload || typeof payload !== "object" || !payload.data || typeof payload.data !== "object") {
      return null;
    }

    return {
      updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : new Date(0).toISOString(),
      data: payload.data as Record<string, unknown>,
    };
  } catch {
    return null;
  }
}

function getUserIdentity(user: unknown) {
  if (!user || typeof user !== "object") return "";
  const record = user as Record<string, unknown>;
  const email = typeof record.email === "string" ? record.email.trim().toLowerCase() : "";
  const id = typeof record.id === "string" ? record.id.trim() : "";
  return email || id;
}

function mergeUsersPreservingCloud(existing: unknown, incoming: unknown) {
  const existingUsers = Array.isArray(existing) ? existing : [];
  const incomingUsers = Array.isArray(incoming) ? incoming : [];
  const merged = new Map<string, unknown>();

  for (const user of existingUsers) {
    const identity = getUserIdentity(user);
    if (identity) merged.set(identity, user);
  }

  for (const user of incomingUsers) {
    const identity = getUserIdentity(user);
    if (identity) merged.set(identity, user);
  }

  return Array.from(merged.values());
}

function getSignedContractId(record: unknown) {
  if (!record || typeof record !== "object") return "";
  const id = (record as Record<string, unknown>).id;
  return typeof id === "string" ? id.trim() : "";
}

function mergeSignedContractRecord(existing: unknown, incoming: unknown) {
  if (!incoming || typeof incoming !== "object") return existing;
  if (!existing || typeof existing !== "object") return incoming;

  const existingRecord = existing as Record<string, unknown>;
  const incomingRecord = incoming as Record<string, unknown>;
  const clientEvidence = incomingRecord.clientEvidence ?? existingRecord.clientEvidence;
  const sellerEvidence = incomingRecord.sellerEvidence ?? existingRecord.sellerEvidence;

  return {
    ...existingRecord,
    ...incomingRecord,
    clientEvidence,
    sellerEvidence,
    html: incomingRecord.html ?? existingRecord.html,
  };
}

function mergeSignedContractsPreservingEvidence(existing: unknown, incoming: unknown) {
  const existingContracts = Array.isArray(existing) ? existing : [];
  const incomingContracts = Array.isArray(incoming) ? incoming : [];
  const merged = new Map<string, unknown>();

  for (const record of existingContracts) {
    const id = getSignedContractId(record);
    if (id) merged.set(id, record);
  }

  for (const record of incomingContracts) {
    const id = getSignedContractId(record);
    if (!id) continue;
    merged.set(id, mergeSignedContractRecord(merged.get(id), record));
  }

  return Array.from(merged.values());
}

async function readCloudPayload(kv: KvNamespace): Promise<CloudPayload | null> {
  return parseCloudPayload(await kv.get(cloudDataKey));
}

async function writeCloudPayload(kv: KvNamespace, data: Record<string, unknown>) {
  const payload = {
    updatedAt: new Date().toISOString(),
    data,
  };

  await kv.put(cloudDataKey, JSON.stringify(payload));
  return payload;
}

function getVapidPublicKey(env: unknown) {
  return (env as CloudEnv).VAPID_PUBLIC_KEY || defaultVapidPublicKey;
}

function getVapidPrivateKey(env: unknown) {
  return (env as CloudEnv).VAPID_PRIVATE_KEY || defaultVapidPrivateKey;
}

function getVapidSubject(env: unknown) {
  return (env as CloudEnv).VAPID_SUBJECT || defaultVapidSubject;
}

function base64UrlToBytes(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlJson(payload: unknown) {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
}

function getPushAudience(endpoint: string) {
  const url = new URL(endpoint);
  return `${url.protocol}//${url.host}`;
}

async function createVapidJwt(audience: string, env: unknown) {
  const publicKeyBytes = base64UrlToBytes(getVapidPublicKey(env));
  const privateKey = getVapidPrivateKey(env);
  const x = bytesToBase64Url(publicKeyBytes.slice(1, 33));
  const y = bytesToBase64Url(publicKeyBytes.slice(33, 65));
  const key = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      x,
      y,
      d: privateKey,
      ext: true,
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const header = base64UrlJson({ typ: "JWT", alg: "ES256" });
  const payload = base64UrlJson({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: getVapidSubject(env),
  });
  const unsignedToken = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(unsignedToken),
  );

  return `${unsignedToken}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

function isPushSubscription(value: unknown): value is StoredPushSubscription {
  if (!value || typeof value !== "object") return false;
  const endpoint = (value as StoredPushSubscription).endpoint;
  return typeof endpoint === "string" && endpoint.startsWith("https://");
}

async function getPushSubscriptions(kv: KvNamespace) {
  try {
    const stored = await kv.get(pushSubscriptionsDataKey);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.filter(isPushSubscription) : [];
  } catch {
    return [];
  }
}

async function savePushSubscriptions(kv: KvNamespace, subscriptions: StoredPushSubscription[]) {
  await kv.put(pushSubscriptionsDataKey, JSON.stringify(subscriptions.slice(0, 250)));
}

function mergePushSubscription(
  subscriptions: StoredPushSubscription[],
  subscription: StoredPushSubscription,
  userAgent: string | null,
) {
  const endpoint = subscription.endpoint;
  if (!endpoint) return subscriptions;

  const next = subscriptions.filter((item) => item.endpoint !== endpoint);
  next.unshift({
    ...subscription,
    userAgent: userAgent ?? subscription.userAgent,
    updatedAt: new Date().toISOString(),
  });
  return next;
}

async function sendPushPing(subscription: StoredPushSubscription, env: unknown) {
  if (!subscription.endpoint) return { ok: false, remove: true };

  const audience = getPushAudience(subscription.endpoint);
  const jwt = await createVapidJwt(audience, env);
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      TTL: "86400",
      Urgency: "normal",
      Authorization: `vapid t=${jwt}, k=${getVapidPublicKey(env)}`,
    },
  });

  return {
    ok: response.ok,
    remove: response.status === 404 || response.status === 410,
  };
}

function normalizeNotificationPayload(payload: PushNotificationPayload): Required<PushNotificationPayload> {
  const now = new Date();
  const id =
    payload.id ||
    `${payload.type || "system"}-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    id,
    type: payload.type || "system",
    title: payload.title || "VA Consultoria Manager",
    body: payload.body || "Novo evento sincronizado no sistema.",
    tag: payload.tag || id,
    url: payload.url || "/dashboard",
    createdAt: payload.createdAt || now.toISOString(),
    expiresAt: payload.expiresAt || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

async function appendNotificationEvent(kv: KvNamespace, payload: PushNotificationPayload) {
  const event = normalizeNotificationPayload(payload);
  const stored = await readCloudPayload(kv);
  const currentEvents = Array.isArray(stored?.data?.[notificationEventsDataKey])
    ? (stored?.data?.[notificationEventsDataKey] as unknown[])
    : [];
  const now = Date.now();
  const activeEvents = currentEvents.filter((item) => {
    if (!item || typeof item !== "object") return false;
    const expiresAt = (item as PushNotificationPayload).expiresAt;
    return !expiresAt || Date.parse(expiresAt) > now;
  });

  await writeCloudPayload(kv, {
    ...(stored?.data ?? {}),
    [notificationEventsDataKey]: [
      event,
      ...activeEvents.filter((item) => (item as PushNotificationPayload).id !== event.id),
    ].slice(0, 100),
  });

  return event;
}

async function broadcastPushNotification(
  kv: KvNamespace,
  env: unknown,
  payload: PushNotificationPayload,
) {
  const event = await appendNotificationEvent(kv, payload);
  const subscriptions = await getPushSubscriptions(kv);
  if (!subscriptions.length) return { event, sent: 0, failed: 0 };

  const results = await Promise.allSettled(
    subscriptions.map(async (subscription) => ({
      subscription,
      result: await sendPushPing(subscription, env),
    })),
  );
  let sent = 0;
  let failed = 0;
  const activeSubscriptions: StoredPushSubscription[] = [];

  for (const result of results) {
    if (result.status === "rejected") {
      failed += 1;
      continue;
    }

    if (result.value.result.ok) sent += 1;
    else failed += 1;

    if (!result.value.result.remove) {
      activeSubscriptions.push(result.value.subscription);
    }
  }

  await savePushSubscriptions(kv, activeSubscriptions);
  return { event, sent, failed };
}

function getStringField(record: unknown, field: string) {
  if (!record || typeof record !== "object") return "";
  const value = (record as Record<string, unknown>)[field];
  return typeof value === "string" ? value.trim() : "";
}

function getEvidenceSignedAt(record: unknown, field: "clientEvidence" | "sellerEvidence") {
  if (!record || typeof record !== "object") return "";
  const evidence = (record as Record<string, unknown>)[field];
  if (!evidence || typeof evidence !== "object") return "";
  const signedAt = (evidence as Record<string, unknown>).signedAt;
  return typeof signedAt === "string" ? signedAt : "";
}

function getContractNotificationLabel(record: unknown) {
  const clientName =
    getStringField(record, "clientName") ||
    getStringField(record, "contractorName") ||
    "Cliente";
  const service = getStringField(record, "service") || "contrato";
  return `${clientName} - ${service}`;
}

async function notifySignedContractChanges(
  kv: KvNamespace,
  env: unknown,
  beforeRecord: unknown,
  afterRecord: unknown,
) {
  const recordId = getSignedContractId(afterRecord);
  const beforeClientSignedAt = getEvidenceSignedAt(beforeRecord, "clientEvidence");
  const beforeSellerSignedAt = getEvidenceSignedAt(beforeRecord, "sellerEvidence");
  const afterClientSignedAt = getEvidenceSignedAt(afterRecord, "clientEvidence");
  const afterSellerSignedAt = getEvidenceSignedAt(afterRecord, "sellerEvidence");
  const label = getContractNotificationLabel(afterRecord);
  const seller = getStringField(afterRecord, "seller");

  if (afterClientSignedAt && afterClientSignedAt !== beforeClientSignedAt) {
    await broadcastPushNotification(kv, env, {
      id: `contract-client-${recordId}-${afterClientSignedAt}`,
      type: "contract",
      title: "Contrato assinado pelo contratante",
      body: `${label} foi assinado pelo cliente.${seller ? ` Responsável: ${seller}.` : ""}`,
      tag: `contract-client-${recordId}`,
      url: "/contracts",
    });
  }

  if (afterSellerSignedAt && afterSellerSignedAt !== beforeSellerSignedAt) {
    await broadcastPushNotification(kv, env, {
      id: `contract-seller-${recordId}-${afterSellerSignedAt}`,
      type: "contract",
      title: "Contrato assinado pelo vendedor",
      body: `${seller || "Vendedor"} assinou ${label}.`,
      tag: `contract-seller-${recordId}`,
      url: "/contracts",
    });
  }

  const wasCompleted = Boolean(beforeClientSignedAt && beforeSellerSignedAt);
  const isCompleted = Boolean(afterClientSignedAt && afterSellerSignedAt);
  if (!wasCompleted && isCompleted) {
    await broadcastPushNotification(kv, env, {
      id: `contract-completed-${recordId}-${afterClientSignedAt}-${afterSellerSignedAt}`,
      type: "contract",
      title: "Contrato finalizado",
      body: `${label} foi assinado pelas duas partes.`,
      tag: `contract-completed-${recordId}`,
      url: "/contracts",
    });
  }
}

async function handleCloudDataRequest(request: Request, env: unknown): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/cloud-data") return null;

  const kv = (env as CloudEnv).VA_MANAGER_DATA;
  if (!kv) {
    return jsonResponse({ error: "Cloud storage is not configured." }, { status: 503 });
  }

  if (request.method === "GET") {
    const stored = await kv.get(cloudDataKey);
    if (!stored) return jsonResponse(null, { status: 404 });
    return new Response(stored, {
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  if (request.method === "PUT" || request.method === "POST") {
    const body = (await request.json()) as { data?: unknown };
    if (!body || typeof body !== "object" || !body.data || typeof body.data !== "object") {
      return jsonResponse({ error: "Invalid cloud data payload." }, { status: 400 });
    }

    const existingPayload = await readCloudPayload(kv);
    const incomingData = body.data as Record<string, unknown>;
    const nextData: Record<string, unknown> = {
      ...(existingPayload?.data ?? {}),
      ...incomingData,
    };

    if (incomingData[usersDataKey]) {
      nextData[usersDataKey] = mergeUsersPreservingCloud(
        existingPayload?.data?.[usersDataKey],
        incomingData[usersDataKey],
      );
    }

    if (incomingData[signedContractsDataKey]) {
      nextData[signedContractsDataKey] = mergeSignedContractsPreservingEvidence(
        existingPayload?.data?.[signedContractsDataKey],
        incomingData[signedContractsDataKey],
      );
    }

    const payload = await writeCloudPayload(kv, nextData);
    return jsonResponse(payload);
  }

  return jsonResponse({ error: "Method not allowed." }, { status: 405 });
}

async function handlePushRequest(request: Request, env: unknown): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/push")) return null;

  const kv = (env as CloudEnv).VA_MANAGER_DATA;
  if (!kv) {
    return jsonResponse({ error: "Cloud storage is not configured." }, { status: 503 });
  }

  if (url.pathname === "/api/push/public-key" && request.method === "GET") {
    return jsonResponse({ publicKey: getVapidPublicKey(env) });
  }

  if (url.pathname === "/api/push/events" && request.method === "GET") {
    const stored = await readCloudPayload(kv);
    const now = Date.now();
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 20, 1), 50);
    const events = Array.isArray(stored?.data?.[notificationEventsDataKey])
      ? (stored?.data?.[notificationEventsDataKey] as PushNotificationPayload[])
      : [];

    return jsonResponse({
      updatedAt: stored?.updatedAt ?? null,
      events: events
        .filter((event) => event?.id && (!event.expiresAt || Date.parse(event.expiresAt) > now))
        .slice(0, limit),
    });
  }

  if (url.pathname === "/api/push/subscribe" && request.method === "POST") {
    let body: { subscription?: unknown };
    try {
      body = (await request.json()) as { subscription?: unknown };
    } catch {
      return jsonResponse({ error: "Invalid JSON body." }, { status: 400 });
    }

    if (!isPushSubscription(body?.subscription)) {
      return jsonResponse({ error: "Invalid push subscription." }, { status: 400 });
    }

    const subscriptions = await getPushSubscriptions(kv);
    const nextSubscriptions = mergePushSubscription(
      subscriptions,
      body.subscription,
      request.headers.get("user-agent"),
    );
    await savePushSubscriptions(kv, nextSubscriptions);
    return jsonResponse({ ok: true, subscriptions: nextSubscriptions.length });
  }

  if (url.pathname === "/api/push/notify" && request.method === "POST") {
    let body: PushNotificationPayload;
    try {
      body = (await request.json()) as PushNotificationPayload;
    } catch {
      return jsonResponse({ error: "Invalid JSON body." }, { status: 400 });
    }

    const result = await broadcastPushNotification(kv, env, body);
    return jsonResponse({ ok: true, ...result });
  }

  return jsonResponse({ error: "Method not allowed." }, { status: 405 });
}

function getClientSummary(client: unknown) {
  if (!client || typeof client !== "object") return {};
  const record = client as Record<string, unknown>;
  return {
    id: typeof record.id === "string" ? record.id : "",
    name: typeof record.name === "string" ? record.name : "",
    doc: typeof record.doc === "string" ? record.doc : "",
    phone: typeof record.phone === "string" ? record.phone : "",
    email: typeof record.email === "string" ? record.email : "",
    address: typeof record.address === "string" ? record.address : "",
    service: typeof record.service === "string" ? record.service : "",
    status: typeof record.status === "string" ? record.status : "",
    total: typeof record.total === "number" ? record.total : 0,
  };
}

function getCreditPrompt(payload: CreditAnalysisRequest) {
  return `Você é um consultor sênior da VA Consultoria, especialista em análise de crédito no Brasil, score, rating bancário, relacionamento bancário, Registrato, birôs de crédito, capacidade de pagamento e estratégia real para aprovação.

Sua função NÃO é apenas resumir o relatório. O relatório já mostra problemas básicos. Você deve:
1. Extrair os dados objetivos do arquivo.
2. Separar o que foi comprovado do que é inferência consultiva.
3. Explicar o que impede aprovação hoje.
4. Dizer exatamente o que fazer, em qual ordem, com prazo, motivo e ganho esperado.
5. Estimar probabilidade atual e probabilidade após execução do plano, com justificativa clara.
6. Ser prático, específico e conservador. Não prometa aprovação.
7. Se faltar dado, liste o dado faltante e reduza a confiança da probabilidade.
8. Priorize ações que uma consultoria de crédito realmente executaria: atualização cadastral, redução de consultas, regularização de restrições, relacionamento bancário, movimentação, saldo médio, documentação, escolha de banco e timing de nova tentativa.
9. Inclua estratégias avançadas e pouco óbvias quando fizerem sentido, como seguro de vida, plano de proteção, plano de saúde, previdência privada, consórcio, Open Finance, portabilidade de salário, débito automático, pacote de relacionamento, cartão garantido, crédito com garantia e contas recorrentes pagas em dia.

Regras para estratégias avançadas:
- Não afirme que seguro, plano de saúde ou produto bancário aumenta diretamente o score público por si só.
- Explique como impacto indireto: relacionamento bancário, histórico de pagamentos, perfil de estabilidade, capacidade percebida, dados de Open Finance, consistência cadastral e análise interna do banco.
- Nunca recomende contratar produto inútil ou caro só para "subir score". Recomende somente quando couber no orçamento, fizer sentido para o cliente e puder ser mantido em dia.
- Diferencie impacto direto no score e impacto na análise interna do banco.
- Seja específico sobre como aplicar, por quanto tempo acompanhar e qual cuidado tomar.

Cliente vinculado no CRM:
${JSON.stringify(getClientSummary(payload.client), null, 2)}

Objetivo declarado: ${payload.objective || "Não informado"}
Valor desejado: ${payload.requestedAmount || 0}
Tipo de operação: ${payload.operationType || "Não informado"}
Observações internas: ${payload.notes || "Nenhuma"}

Critérios para probabilidade:
- Use 0 a 100.
- "approvalProbabilityNow" deve refletir chance de aprovação HOJE para o tipo e valor solicitados.
- "approvalProbabilityAfterPlan" deve refletir chance após executar o plano proposto, considerando o prazo estimado.
- Não use números genéricos. Justifique com score, renda, dívidas, consultas, rating, saldo médio, relacionamento, valor solicitado e tipo de operação.
- Quando houver poucos dados, use probabilidade mais baixa e "confidenceLevel": "baixa".
- A probabilidade após plano não deve passar de 85 sem evidência forte de renda, score, baixo endividamento e relacionamento bancário.

Tom de resposta:
- Linguagem simples, direta e consultiva.
- Escreva como se fosse entregar ao consultor da VA o roteiro de atendimento do cliente.
- Evite frases vagas como "melhorar score" sem explicar como.
- Não invente dados pessoais. Quando inferir, diga que é inferência.

Retorne somente um JSON válido com este formato:
{
  "extracted": {
    "name": "string",
    "cpf": "string",
    "birthDate": "string",
    "address": "string",
    "phones": ["string"],
    "score": 0,
    "rating": "string",
    "debts": ["string"],
    "protests": ["string"],
    "lawsuits": ["string"],
    "recentInquiries": 0,
    "banks": ["string"],
    "averageBalance": 0,
    "estimatedIncome": 0,
    "incomeCommitment": 0
  },
  "diagnosis": {
    "summary": "string",
    "customerProfile": "string",
    "approvalProbabilityNow": 0,
    "approvalProbabilityAfterPlan": 0,
    "probabilityRationale": "Explique por que a chance atual e a chance após o plano foram calculadas assim.",
    "confidenceLevel": "baixa|media|alta",
    "estimatedTimeToGoal": "string",
    "mainBlockers": ["string"],
    "opportunities": ["string"],
    "missingData": ["string"],
    "requiredDocuments": ["string"],
    "dontDo": ["string"],
    "consultantNotes": ["string"],
    "immediatePlan": {
      "title": "Primeiras 72 horas",
      "actions": ["string"],
      "expectedResult": "string"
    },
    "plan30Days": {
      "title": "Plano de 30 dias",
      "actions": ["string"],
      "expectedResult": "string"
    },
    "plan60Days": {
      "title": "Plano de 60 dias",
      "actions": ["string"],
      "expectedResult": "string"
    },
    "plan90Days": {
      "title": "Plano de 90 dias",
      "actions": ["string"],
      "expectedResult": "string"
    },
    "bankStrategies": [
      {
        "bank": "string",
        "fit": "baixo|medio|alto",
        "reason": "string",
        "firstMove": "string"
      }
    ],
    "advancedStrategies": [
      {
        "title": "string",
        "category": "Produto bancario|Protecao|Relacionamento|Cadastro positivo|Movimentacao|Garantia",
        "directScoreImpact": "baixo|medio|alto|incerto",
        "bankAnalysisImpact": "baixo|medio|alto|incerto",
        "whenItHelps": "string",
        "howToApply": "string",
        "caution": "string"
      }
    ],
    "issues": [
      {
        "title": "string",
        "impact": "baixo|medio|alto|critico",
        "priority": "baixa|media|alta|urgente",
        "recommendation": "string"
      }
    ],
    "actions": [
      {
        "area": "Cadastro|Bancario|Financeiro|Dividas|Relacionamento|Documentos",
        "action": "string",
        "deadline": "string",
        "expectedGain": "string"
      }
    ]
  }
}`;
}

function parseOpenAIText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, unknown>;
  if (typeof record.output_text === "string") return record.output_text;

  const output = Array.isArray(record.output) ? record.output : [];
  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? ((item as Record<string, unknown>).content as unknown[])
      : [];
    for (const contentItem of content) {
      if (!contentItem || typeof contentItem !== "object") continue;
      const text = (contentItem as Record<string, unknown>).text;
      if (typeof text === "string") chunks.push(text);
    }
  }
  return chunks.join("\n").trim();
}

function parseMaybeJson(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizePercent(value: unknown, fallback: number) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function normalizeStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function normalizeRecordArray(value: unknown, fallback: unknown[]) {
  if (!Array.isArray(value)) return fallback;
  return value.filter((item) => item && typeof item === "object");
}

function buildFallbackCreditAnalysis(payload: CreditAnalysisRequest) {
  const client = getClientSummary(payload.client) as Record<string, unknown>;
  const requestedAmount = Number(payload.requestedAmount) || 0;
  const currentProbability = requestedAmount > 100000 ? 32 : requestedAmount > 30000 ? 44 : 58;

  return {
    extracted: {
      name: client.name || "",
      cpf: client.doc || "",
      birthDate: "",
      address: client.address || "",
      phones: client.phone ? [client.phone] : [],
      score: null,
      rating: "Não identificado",
      debts: [],
      protests: [],
      lawsuits: [],
      recentInquiries: null,
      banks: [],
      averageBalance: null,
      estimatedIncome: null,
      incomeCommitment: null,
    },
    diagnosis: {
      summary:
        "Análise gerada pelo motor interno. Configure a chave OPENAI_API_KEY para leitura inteligente dos arquivos e diagnóstico mais profundo.",
      customerProfile:
        "Perfil ainda incompleto. É necessário anexar relatório Serasa/SPC/Registrato ou extrato bancário para validar score, renda, consultas e impeditivos.",
      approvalProbabilityNow: currentProbability,
      approvalProbabilityAfterPlan: Math.min(92, currentProbability + 28),
      probabilityRationale:
        "Estimativa preliminar baseada apenas no valor desejado, tipo de operação e dados do CRM. Sem score, renda, restrições e relacionamento bancário, a confiança é baixa e a probabilidade deve ser tratada como referência inicial.",
      confidenceLevel: "baixa",
      estimatedTimeToGoal: "30 a 90 dias, conforme atualização cadastral, movimentação e regularização dos apontamentos.",
      mainBlockers: [
        "Documentação de crédito ainda não analisada por IA.",
        "Score, rating e comprometimento de renda não foram identificados automaticamente.",
      ],
      opportunities: [
        "Vincular relatórios do cliente ao CRM para criar histórico de evolução.",
        "Padronizar plano de relacionamento bancário e atualização cadastral.",
      ],
      missingData: [
        "Relatório completo de birô de crédito com score e apontamentos.",
        "Registrato atualizado.",
        "Extratos bancários dos últimos 90 dias.",
        "Renda comprovada e valor das parcelas pretendidas.",
      ],
      requiredDocuments: [
        "Documento pessoal ou contrato social, conforme PF/PJ.",
        "Comprovante de residência atualizado.",
        "Comprovante de renda ou faturamento.",
        "Relatórios Serasa/SPC/Boa Vista/Quod e Registrato.",
        "Extratos bancários recentes.",
      ],
      dontDo: [
        "Não fazer múltiplas simulações em vários bancos antes de organizar o perfil.",
        "Não pedir valor acima da capacidade de pagamento sem comprovação de renda.",
        "Não alterar endereço, renda ou profissão de forma inconsistente entre cadastros.",
      ],
      consultantNotes: [
        "Validar primeiro se há restrições, excesso de consultas e divergência cadastral.",
        "A probabilidade deve ser recalculada após anexar documentos reais.",
      ],
      immediatePlan: {
        title: "Primeiras 72 horas",
        actions: [
          "Coletar relatórios de crédito, Registrato e extratos.",
          "Conferir dados cadastrais do cliente nos birôs e no banco principal.",
          "Mapear objetivo, valor desejado, entrada disponível e prazo aceitável.",
        ],
        expectedResult: "Base mínima pronta para diagnóstico real e redução de tentativa errada.",
      },
      plan30Days: {
        title: "Plano de 30 dias",
        actions: [
          "Regularizar pendências simples e corrigir dados divergentes.",
          "Reduzir novas consultas de crédito.",
          "Concentrar entradas no banco com maior chance de relacionamento.",
        ],
        expectedResult: "Perfil mais coerente para nova análise e menor ruído cadastral.",
      },
      plan60Days: {
        title: "Plano de 60 dias",
        actions: [
          "Manter movimentação recorrente e saldo médio compatível com a parcela pretendida.",
          "Organizar comprovantes de renda e histórico bancário.",
          "Escolher banco e produto com base no perfil real do cliente.",
        ],
        expectedResult: "Aumento de consistência bancária e melhora da capacidade percebida.",
      },
      plan90Days: {
        title: "Plano de 90 dias",
        actions: [
          "Reavaliar score, consultas e relacionamento bancário.",
          "Simular somente nos canais com maior aderência.",
          "Ajustar valor, entrada ou prazo antes da proposta final.",
        ],
        expectedResult: "Tentativa de crédito com timing melhor e documentação completa.",
      },
      bankStrategies: [
        {
          bank: "Banco de relacionamento atual",
          fit: "medio",
          reason: "Sem dados suficientes para indicar outro banco com segurança.",
          firstMove: "Identificar onde o cliente já movimenta renda e há maior histórico.",
        },
      ],
      advancedStrategies: [
        {
          title: "Proteção financeira vinculada ao relacionamento bancário",
          category: "Protecao",
          directScoreImpact: "incerto",
          bankAnalysisImpact: "medio",
          whenItHelps:
            "Pode ajudar indiretamente quando o cliente já usa o banco, consegue manter o pagamento em dia e o produto faz sentido para o orçamento.",
          howToApply:
            "Avaliar seguro de vida, proteção financeira ou plano compatível somente se houver utilidade real; pagar por débito automático e manter histórico sem atrasos por pelo menos 60 a 90 dias.",
          caution:
            "Não contratar produto caro apenas para tentar aumentar score. O efeito direto no score público não é garantido.",
        },
        {
          title: "Contas recorrentes e débito automático",
          category: "Cadastro positivo",
          directScoreImpact: "baixo",
          bankAnalysisImpact: "medio",
          whenItHelps:
            "Ajuda a demonstrar rotina financeira, previsibilidade e pagamentos em dia quando os dados aparecem no cadastro positivo ou no Open Finance.",
          howToApply:
            "Concentrar contas fixas essenciais em uma conta principal, ativar débito automático quando fizer sentido e evitar atrasos por pelo menos 3 ciclos.",
          caution:
            "Não adianta concentrar despesas se a conta ficar sem saldo ou gerar atrasos. Priorize regularidade.",
        },
        {
          title: "Open Finance, salário e movimentação concentrada",
          category: "Movimentacao",
          directScoreImpact: "baixo",
          bankAnalysisImpact: "alto",
          whenItHelps:
            "É mais forte para análise interna de bancos, especialmente quando renda, entradas, saldo médio e histórico ficam claros.",
          howToApply:
            "Concentrar recebimentos no banco-alvo, autorizar Open Finance quando houver bom histórico e manter saldo médio compatível com a parcela pretendida.",
          caution:
            "Não compartilhar Open Finance antes de organizar extratos se houver muitas devoluções, atrasos ou movimentação inconsistente.",
        },
      ],
      issues: [
        {
          title: "Dados de crédito incompletos",
          impact: "alto",
          priority: "alta",
          recommendation:
            "Anexar relatório completo de birô de crédito, Registrato e extratos recentes para diagnóstico preciso.",
        },
        {
          title: "Histórico bancário não validado",
          impact: "medio",
          priority: "media",
          recommendation:
            "Mapear bancos utilizados, entradas mensais, saldo médio e recorrência de movimentação.",
        },
      ],
      actions: [
        {
          area: "Documentos",
          action: "Coletar Serasa/SPC/Boa Vista/Quod, Registrato e extratos dos últimos 90 dias.",
          deadline: "Imediato",
          expectedGain: "Permite identificar impeditivos reais e reduzir retrabalho na consultoria.",
        },
        {
          area: "Cadastro",
          action: "Conferir CPF/CNPJ, endereço, telefone, e-mail e profissão/renda declarada nos birôs.",
          deadline: "Até 7 dias",
          expectedGain: "Reduz divergências cadastrais e melhora consistência para análise bancária.",
        },
      ],
    },
  };
}

function normalizeCreditAnalysisResponse(payload: CreditAnalysisRequest, analysis: unknown) {
  const fallback = buildFallbackCreditAnalysis(payload);
  if (!analysis || typeof analysis !== "object") return fallback;
  const record = analysis as Record<string, unknown>;
  const diagnosis = (record.diagnosis && typeof record.diagnosis === "object"
    ? record.diagnosis
    : {}) as Record<string, unknown>;

  return {
    extracted: {
      ...fallback.extracted,
      ...((record.extracted && typeof record.extracted === "object" ? record.extracted : {}) as Record<
        string,
        unknown
      >),
    },
    diagnosis: {
      ...fallback.diagnosis,
      ...diagnosis,
      approvalProbabilityNow: normalizePercent(
        diagnosis.approvalProbabilityNow,
        fallback.diagnosis.approvalProbabilityNow,
      ),
      approvalProbabilityAfterPlan: normalizePercent(
        diagnosis.approvalProbabilityAfterPlan,
        fallback.diagnosis.approvalProbabilityAfterPlan,
      ),
      mainBlockers: Array.isArray(diagnosis.mainBlockers)
        ? diagnosis.mainBlockers
        : fallback.diagnosis.mainBlockers,
      opportunities: Array.isArray(diagnosis.opportunities)
        ? diagnosis.opportunities
        : fallback.diagnosis.opportunities,
      missingData: normalizeStringArray(diagnosis.missingData, fallback.diagnosis.missingData),
      requiredDocuments: normalizeStringArray(
        diagnosis.requiredDocuments,
        fallback.diagnosis.requiredDocuments,
      ),
      dontDo: normalizeStringArray(diagnosis.dontDo, fallback.diagnosis.dontDo),
      consultantNotes: normalizeStringArray(
        diagnosis.consultantNotes,
        fallback.diagnosis.consultantNotes,
      ),
      bankStrategies: normalizeRecordArray(
        diagnosis.bankStrategies,
        fallback.diagnosis.bankStrategies,
      ),
      advancedStrategies: normalizeRecordArray(
        diagnosis.advancedStrategies,
        fallback.diagnosis.advancedStrategies,
      ),
      confidenceLevel: ["baixa", "media", "alta"].includes(String(diagnosis.confidenceLevel))
        ? diagnosis.confidenceLevel
        : fallback.diagnosis.confidenceLevel,
      issues: Array.isArray(diagnosis.issues) ? diagnosis.issues : fallback.diagnosis.issues,
      actions: Array.isArray(diagnosis.actions) ? diagnosis.actions : fallback.diagnosis.actions,
    },
  };
}

async function runOpenAICreditAnalysis(payload: CreditAnalysisRequest, env: unknown) {
  const apiKey = (env as CloudEnv).OPENAI_API_KEY;
  if (!apiKey) {
    return { provider: "rules", ...buildFallbackCreditAnalysis(payload) };
  }

  const files = Array.isArray(payload.files) ? payload.files.slice(0, 6) : [];
  const content: Array<Record<string, unknown>> = [{ type: "input_text", text: getCreditPrompt(payload) }];

  for (const file of files) {
    if (file.text?.trim()) {
      content.push({
        type: "input_text",
        text: `Texto extraído de ${file.name || "arquivo"}:\n${file.text.slice(0, 50000)}`,
      });
      continue;
    }

    if (!file.dataUrl) continue;
    if (file.type?.startsWith("image/")) {
      content.push({ type: "input_image", image_url: file.dataUrl });
    } else if (file.type === "application/pdf") {
      content.push({
        type: "input_file",
        filename: file.name || "relatorio.pdf",
        file_data: file.dataUrl,
      });
    }
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: (env as CloudEnv).OPENAI_CREDIT_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content,
        },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`OpenAI credit analysis failed: ${response.status} ${errorText}`);
    return { provider: "rules", ...buildFallbackCreditAnalysis(payload) };
  }

  const openAiPayload = await response.json();
  const text = parseOpenAIText(openAiPayload);
  const parsed = parseMaybeJson(text);
  return {
    provider: "openai",
    ...normalizeCreditAnalysisResponse(payload, parsed),
  };
}

async function handleCreditIntelligenceRequest(request: Request, env: unknown): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/credit-intelligence/analyze") return null;

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, { status: 405 });
  }

  let payload: CreditAnalysisRequest;
  try {
    payload = (await request.json()) as CreditAnalysisRequest;
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, { status: 400 });
  }

  const files = Array.isArray(payload.files) ? payload.files : [];
  const totalSize = files.reduce((sum, file) => sum + (Number(file.size) || 0), 0);
  if (files.length > 6 || totalSize > 18 * 1024 * 1024) {
    return jsonResponse(
      { error: "Envie no máximo 6 arquivos e até 18 MB por análise." },
      { status: 413 },
    );
  }

  const analysis = await runOpenAICreditAnalysis(payload, env);
  return jsonResponse(analysis);
}

async function handleUsersRequest(request: Request, env: unknown): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/users") return null;

  const kv = (env as CloudEnv).VA_MANAGER_DATA;
  if (!kv) {
    return jsonResponse({ error: "Cloud storage is not configured." }, { status: 503 });
  }

  if (request.method === "GET") {
    const stored = await readCloudPayload(kv);
    return jsonResponse({
      updatedAt: stored?.updatedAt ?? null,
      users: Array.isArray(stored?.data?.[usersDataKey]) ? stored?.data?.[usersDataKey] : [],
    });
  }

  if (request.method === "PUT" || request.method === "POST") {
    const body = (await request.json()) as { users?: unknown };
    if (!Array.isArray(body?.users)) {
      return jsonResponse({ error: "Invalid users payload." }, { status: 400 });
    }

    const existingPayload = await readCloudPayload(kv);
    const nextData = {
      ...(existingPayload?.data ?? {}),
      [usersDataKey]: body.users,
    };
    const payload = await writeCloudPayload(kv, nextData);

    return jsonResponse({
      updatedAt: payload.updatedAt,
      users: payload.data[usersDataKey],
    });
  }

  return jsonResponse({ error: "Method not allowed." }, { status: 405 });
}

async function handleSignedContractsRequest(request: Request, env: unknown): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/signed-contracts")) return null;

  const kv = (env as CloudEnv).VA_MANAGER_DATA;
  if (!kv) {
    return jsonResponse({ error: "Cloud storage is not configured." }, { status: 503 });
  }

  if (request.method === "GET") {
    const stored = await readCloudPayload(kv);
    const records = Array.isArray(stored?.data?.[signedContractsDataKey])
      ? stored?.data?.[signedContractsDataKey]
      : [];
    const id = decodeURIComponent(url.pathname.replace("/api/signed-contracts/", "")).trim();

    if (id && id !== "/api/signed-contracts") {
      const record = records.find((item) => getSignedContractId(item) === id);
      return jsonResponse({ updatedAt: stored?.updatedAt ?? null, record: record ?? null });
    }

    return jsonResponse({ updatedAt: stored?.updatedAt ?? null, records });
  }

  if (request.method === "PUT" || request.method === "POST") {
    const body = (await request.json()) as { record?: unknown };
    const recordId = getSignedContractId(body?.record);
    if (!recordId) {
      return jsonResponse({ error: "Invalid signed contract payload." }, { status: 400 });
    }

    const existingPayload = await readCloudPayload(kv);
    const existingRecords = Array.isArray(existingPayload?.data?.[signedContractsDataKey])
      ? existingPayload?.data?.[signedContractsDataKey]
      : [];
    const previousRecord = existingRecords.find((item) => getSignedContractId(item) === recordId);
    const nextRecords = mergeSignedContractsPreservingEvidence(
      existingRecords,
      [body.record],
    );
    const savedRecord = nextRecords.find((item) => getSignedContractId(item) === recordId) ?? body.record;
    const payload = await writeCloudPayload(kv, {
      ...(existingPayload?.data ?? {}),
      [signedContractsDataKey]: nextRecords,
    });
    await notifySignedContractChanges(kv, env, previousRecord, savedRecord);

    return jsonResponse({
      updatedAt: payload.updatedAt,
      record: savedRecord,
      records: nextRecords,
    });
  }

  return jsonResponse({ error: "Method not allowed." }, { status: 405 });
}

async function handleSigningLinkRequest(request: Request, env: unknown): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/signing-links")) return null;

  const kv = (env as CloudEnv).VA_MANAGER_DATA;
  if (!kv) {
    return jsonResponse({ error: "Cloud storage is not configured." }, { status: 503 });
  }

  if (request.method === "GET") {
    const token = decodeURIComponent(url.pathname.replace("/api/signing-links/", "")).trim();
    if (!token || token === "/api/signing-links") {
      return jsonResponse({ error: "Missing signing token." }, { status: 400 });
    }

    const stored = await kv.get(`${signingLinkPrefix}${token}`);
    if (!stored) return jsonResponse({ error: "Signing link not found." }, { status: 404 });

    return new Response(stored, {
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  if (request.method === "POST") {
    let body: { payload?: unknown; slugBase?: string };
    try {
      body = (await request.json()) as { payload?: unknown; slugBase?: string };
    } catch {
      return jsonResponse({ error: "Invalid JSON body." }, { status: 400 });
    }

    if (!body?.payload || typeof body.payload !== "object") {
      return jsonResponse({ error: "Invalid signing payload." }, { status: 400 });
    }

    const slugBase = slugifyToken(body.slugBase || "vaconsultoria");
    const random =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10);
    const token = `${slugBase}-${random}`;
    const payload = {
      createdAt: new Date().toISOString(),
      payload: body.payload,
    };

    await kv.put(`${signingLinkPrefix}${token}`, JSON.stringify(payload), {
      expirationTtl: 60 * 60 * 24 * 365,
    });

    return jsonResponse({ token, path: `/sign/${token}` });
  }

  return jsonResponse({ error: "Method not allowed." }, { status: 405 });
}

function slugifyToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 72) || "vaconsultoria";
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const creditIntelligenceResponse = await handleCreditIntelligenceRequest(request, env);
      if (creditIntelligenceResponse) return creditIntelligenceResponse;

      const pushResponse = await handlePushRequest(request, env);
      if (pushResponse) return pushResponse;

      const usersResponse = await handleUsersRequest(request, env);
      if (usersResponse) return usersResponse;

      const signingLinkResponse = await handleSigningLinkRequest(request, env);
      if (signingLinkResponse) return signingLinkResponse;

      const signedContractsResponse = await handleSignedContractsRequest(request, env);
      if (signedContractsResponse) return signedContractsResponse;

      const cloudDataResponse = await handleCloudDataRequest(request, env);
      if (cloudDataResponse) return cloudDataResponse;

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
