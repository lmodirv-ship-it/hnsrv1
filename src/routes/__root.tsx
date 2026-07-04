import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  // Quiet dev mode: log to console only, auto-retry, no visible error UI.
  console.warn("[dev] suppressed route error:", error?.message);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
    const t = setTimeout(() => {
      router.invalidate();
      reset();
    }, 300);
    return () => clearTimeout(t);
  }, [error, reset, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-6 w-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "HN Service Hub — Central Intelligence & Orchestration" },
      {
        name: "description",
        content:
          "Central brain for the HN ecosystem: discover sites, register services, manage API keys, orchestrate requests, and monitor everything from one place.",
      },
      { property: "og:site_name", content: "HN Service Hub" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "HN Service Hub — Central Intelligence & Orchestration" },
      {
        property: "og:description",
        content:
          "Central brain for the HN ecosystem: discover sites, register services, manage API keys, and orchestrate requests.",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "HN Service Hub — Central Intelligence & Orchestration" },
      {
        name: "twitter:description",
        content:
          "Central brain for the HN ecosystem: discover sites, register services, manage API keys, and orchestrate requests.",
      },
      { name: "description", content: "Central brain for the HN ecosystem: discover sites, register services, manage API keys, orchestrate requests, and monitor everything from one place." },
      { property: "og:description", content: "Central brain for the HN ecosystem: discover sites, register services, manage API keys, orchestrate requests, and monitor everything from one place." },
      { name: "twitter:description", content: "Central brain for the HN ecosystem: discover sites, register services, manage API keys, orchestrate requests, and monitor everything from one place." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/34fd46f6-ae30-4392-b91c-005c8a0b528f/id-preview-18d785c2--2f7ab377-27cb-4da9-a1e0-2f669d85d939.lovable.app-1783192902278.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/34fd46f6-ae30-4392-b91c-005c8a0b528f/id-preview-18d785c2--2f7ab377-27cb-4da9-a1e0-2f669d85d939.lovable.app-1783192902278.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        router.invalidate();
        if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <Outlet />
        <Toaster richColors position="top-center" />
      </LanguageProvider>
    </QueryClientProvider>
  );
}
