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
};

let serverEntryPromise: Promise<ServerEntry> | undefined;
const cloudDataKey = "va-manager:primary-state";
const signingLinkPrefix = "va-manager:signing-link:";
const usersDataKey = "va-manager:users";

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

    const payload = await writeCloudPayload(kv, nextData);
    return jsonResponse(payload);
  }

  return jsonResponse({ error: "Method not allowed." }, { status: 405 });
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
      const usersResponse = await handleUsersRequest(request, env);
      if (usersResponse) return usersResponse;

      const signingLinkResponse = await handleSigningLinkRequest(request, env);
      if (signingLinkResponse) return signingLinkResponse;

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
