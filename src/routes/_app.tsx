import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { TopBar } from "@/components/top-bar";
import { AuroraBackground } from "@/components/ui/holographic-interface";
import { getAuthSession } from "@/lib/auth";
import { canAccessRoute, getDefaultRouteForSession } from "@/lib/permissions";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [checkedAuth, setCheckedAuth] = useState(false);

  useEffect(() => {
    setCheckedAuth(false);
    const session = getAuthSession();

    if (!session) {
      navigate({
        to: "/login",
        search: { redirect: location.pathname },
        replace: true,
      });
      return;
    }

    if (!canAccessRoute(session, location.pathname)) {
      navigate({
        to: getDefaultRouteForSession(session),
        replace: true,
      });
      return;
    }

    setCheckedAuth(true);
  }, [location.pathname, navigate]);

  if (!checkedAuth) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Validando acesso...
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen>
      <div className="relative flex min-h-screen w-full overflow-hidden bg-background">
        <AuroraBackground />
        <AppSidebar />
        <div className="relative z-10 flex min-h-screen min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="min-w-0 flex-1 px-3 py-5 sm:px-4 sm:py-6 md:px-8 md:py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
