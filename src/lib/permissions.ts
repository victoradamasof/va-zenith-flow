import type { AuthSession } from "@/lib/auth";

type PermissionSession = Pick<AuthSession, "name" | "role">;

export const appRoutes = [
  "/dashboard",
  "/calendar",
  "/insights",
  "/alerts",
  "/financial",
  "/bank",
  "/cashflow",
  "/investments",
  "/sales",
  "/clients",
  "/contracts",
  "/ranking",
  "/services",
  "/goals",
  "/reports",
  "/users",
  "/settings",
] as const;

export type AppRoutePath = (typeof appRoutes)[number];

const allRoutes = [...appRoutes];

const routesByRole: Record<string, AppRoutePath[]> = {
  Administrador: allRoutes,
  Comercial: ["/sales", "/clients", "/contracts", "/ranking", "/services", "/goals"],
  Financeiro: [
    "/dashboard",
    "/calendar",
    "/insights",
    "/alerts",
    "/financial",
    "/bank",
    "/cashflow",
    "/investments",
    "/reports",
  ],
  Operacional: ["/calendar", "/clients", "/contracts", "/services", "/reports"],
  "Somente leitura": ["/dashboard", "/calendar", "/insights", "/alerts", "/reports"],
};

const defaultRouteByRole: Record<string, AppRoutePath> = {
  Administrador: "/dashboard",
  Comercial: "/sales",
  Financeiro: "/dashboard",
  Operacional: "/calendar",
  "Somente leitura": "/dashboard",
};

export function normalizePermissionText(value = "") {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function isAdmin(session: PermissionSession | null | undefined) {
  return normalizePermissionText(session?.role) === "administrador";
}

export function getAllowedRoutes(session: PermissionSession | null | undefined) {
  if (!session) return [] as AppRoutePath[];
  return routesByRole[session.role] ?? routesByRole["Somente leitura"];
}

export function getDefaultRouteForSession(
  session: PermissionSession | null | undefined,
): AppRoutePath {
  if (!session) return "/dashboard";
  return defaultRouteByRole[session.role] ?? getAllowedRoutes(session)[0] ?? "/dashboard";
}

export function canAccessRoute(session: PermissionSession | null | undefined, pathname: string) {
  if (!session) return false;
  if (isAdmin(session)) return true;

  const cleanPath = pathname.replace(/\/$/, "") || "/dashboard";
  return getAllowedRoutes(session).some((route) => cleanPath === route);
}

export function isOwnedBySession(
  owner: string | null | undefined,
  session: PermissionSession | null | undefined,
) {
  if (!session) return false;
  if (isAdmin(session)) return true;

  const normalizedOwner = normalizePermissionText(owner ?? "");
  const normalizedUser = normalizePermissionText(session.name);

  return (
    normalizedOwner === normalizedUser ||
    normalizedOwner.includes(normalizedUser) ||
    normalizedUser.includes(normalizedOwner)
  );
}
