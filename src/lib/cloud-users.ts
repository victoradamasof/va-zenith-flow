import type { LoginUser } from "@/lib/auth";

type CloudUsersPayload = {
  updatedAt: string | null;
  users: LoginUser[];
};

function getUserIdentity(user: LoginUser) {
  return user.email.trim().toLowerCase() || user.id;
}

function normalizeUser(user: LoginUser): LoginUser {
  return {
    ...user,
    name: user.name.trim(),
    email: user.email.trim().toLowerCase(),
    status: user.status || "ativo",
  };
}

export function mergeUsers(localUsers: LoginUser[], cloudUsers: LoginUser[]) {
  const merged = new Map<string, LoginUser>();

  for (const user of localUsers) {
    const normalized = normalizeUser(user);
    const identity = getUserIdentity(normalized);
    if (identity) merged.set(identity, normalized);
  }

  for (const user of cloudUsers) {
    const normalized = normalizeUser(user);
    const identity = getUserIdentity(normalized);
    if (identity) merged.set(identity, normalized);
  }

  return Array.from(merged.values());
}

export function areUsersEqual(a: LoginUser[], b: LoginUser[]) {
  return JSON.stringify(a.map(normalizeUser)) === JSON.stringify(b.map(normalizeUser));
}

export async function fetchCloudUsers() {
  const response = await fetch("/api/users", {
    headers: { accept: "application/json" },
  });

  if (response.status === 404) return [] as LoginUser[];
  if (!response.ok) throw new Error(`Users fetch failed: ${response.status}`);

  const payload = (await response.json()) as CloudUsersPayload;
  return Array.isArray(payload.users) ? payload.users.map(normalizeUser) : [];
}

export async function saveCloudUsers(users: LoginUser[]) {
  const response = await fetch("/api/users", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ users: users.map(normalizeUser) }),
  });

  if (!response.ok) throw new Error(`Users save failed: ${response.status}`);
  return (await response.json()) as CloudUsersPayload;
}
