export const authSessionKey = "va-manager:auth-session";
export const defaultUserPassword = "va123456";

export type AuthSession = {
  id: string;
  name: string;
  email: string;
  role: string;
  loginAt: string;
};

export type LoginUser = {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: string;
  status: string;
};

export function getUserPassword(user: LoginUser) {
  return user.password?.trim() || defaultUserPassword;
}

export function getAuthSession(): AuthSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(authSessionKey);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

export function setAuthSession(user: LoginUser) {
  if (typeof window === "undefined") return;

  const session: AuthSession = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    loginAt: new Date().toISOString(),
  };

  window.localStorage.setItem(authSessionKey, JSON.stringify(session));
  window.dispatchEvent(new Event("va-auth-change"));
}

export function clearAuthSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(authSessionKey);
  window.dispatchEvent(new Event("va-auth-change"));
}
