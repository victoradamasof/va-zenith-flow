import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SignInPage } from "@/components/ui/sign-in-flow-1";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { getAuthSession, setAuthSession, type LoginUser } from "@/lib/auth";
import { areUsersEqual, fetchCloudUsers, mergeUsers } from "@/lib/cloud-users";
import { users as initialUsers } from "@/lib/mock-data";
import { canAccessRoute, getDefaultRouteForSession } from "@/lib/permissions";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : "/dashboard",
  }),
  component: LoginRoute,
  head: () => ({ meta: [{ title: "Login - VA Consultoria Manager" }] }),
});

function LoginRoute() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [users, setUsers, usersReady] = usePersistentState<LoginUser[]>(
    "va-manager:users",
    initialUsers,
  );
  const [loginUsers, setLoginUsers] = useState<LoginUser[]>(initialUsers);

  useEffect(() => {
    const session = getAuthSession();
    if (session) {
      navigate({
        to: canAccessRoute(session, search.redirect)
          ? search.redirect
          : getDefaultRouteForSession(session),
        replace: true,
      });
    }
  }, [navigate, search.redirect]);

  useEffect(() => {
    if (!usersReady) return;

    let cancelled = false;

    const loadUsers = async () => {
      let nextUsers = users;

      try {
        const cloudUsers = await fetchCloudUsers();
        nextUsers = mergeUsers(users, cloudUsers);
        if (!areUsersEqual(users, nextUsers)) {
          setUsers(nextUsers);
        }
      } catch (error) {
        console.warn("Could not load cloud users", error);
      }

      if (!cancelled) {
        setLoginUsers(nextUsers);
      }
    };

    void loadUsers();

    return () => {
      cancelled = true;
    };
  }, [setUsers, users, usersReady]);

  return (
    <SignInPage
      users={loginUsers}
      onAuthenticated={(user) => {
        setAuthSession(user);
        navigate({
          to: canAccessRoute(user, search.redirect)
            ? search.redirect
            : getDefaultRouteForSession(user),
          replace: true,
        });
      }}
    />
  );
}
