import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { CategoriesProvider } from "@/hooks/use-categories";
import { SubscriptionProvider } from "@/hooks/use-subscription";
import { TrialExpiredGuard } from "@/components/TrialExpiredGuard";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <Link to="/" className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand text-brand-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>
        </span>
        <span className="text-lg font-semibold tracking-tight text-brand">Archivai</span>
      </Link>

      <div className="mt-10 max-w-md text-center">
        <h1 className="text-7xl font-bold tracking-tight text-brand sm:text-8xl">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground sm:text-2xl">
          Ez az oldal nem található
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          A keresett oldal nem létezik vagy áthelyezték.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand/90"
          >
            Vissza a főoldalra
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Belépés
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  // Auto-retry once on mount: route errors after a back-button popstate are
  // usually transient (stale loader / cache). Silently invalidate + reset so
  // the user doesn't see the fallback flicker for a navigation that should
  // just work.
  const retried = React.useRef(false);
  React.useEffect(() => {
    if (retried.current) return;
    retried.current = true;
    const t = setTimeout(() => {
      router.invalidate();
      reset();
    }, 50);
    return () => clearTimeout(t);
  }, [router, reset]);

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/";
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Ez az oldal nem töltődött be
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Valami félresikerült. Próbáld újra, vagy térj vissza az előző oldalra.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Újrapróbálom
          </button>
          <button
            onClick={goBack}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Vissza
          </button>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Főoldal
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Archivai" },
      { name: "description", content: "Archivai — Biztonságos dokumentum archiválás és kezelés." },
      { name: "author", content: "Lovable" },
      { name: "theme-color", content: "#1A2B4A" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Archivai" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { property: "og:title", content: "Archivai" },
      { property: "og:description", content: "Archivai — Biztonságos dokumentum archiválás és kezelés." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Archivai" },
      { name: "twitter:description", content: "Archivai — Biztonságos dokumentum archiválás és kezelés." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/300eced4-d693-4523-a4a0-4ceb504df7b0/id-preview-5186e45e--081bf057-7077-4cad-ac17-702a07a325d3.lovable.app-1779138291787.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/300eced4-d693-4523-a4a0-4ceb504df7b0/id-preview-5186e45e--081bf057-7077-4cad-ac17-702a07a325d3.lovable.app-1779138291787.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", href: "/icon-512.png" },
      { rel: "icon", href: "/icon-512.png", type: "image/png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hu" translate="no">
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

  return (
    <QueryClientProvider client={queryClient}>
      <SubscriptionProvider>
        <CategoriesProvider>
          <TrialExpiredGuard />
          <Outlet />
          <Toaster richColors position="top-right" />
        </CategoriesProvider>
      </SubscriptionProvider>
    </QueryClientProvider>
  );
}
