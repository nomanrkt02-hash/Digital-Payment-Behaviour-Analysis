import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useLocation,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";

import { AppShell } from "@/features/rhythm/shell";
import { PreferencesProvider } from "@/features/rhythm/preferences";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";
import { reportAppError } from "../lib/error-reporting";
import { loadCurrentData } from "@/features/rhythm/api";
import { useDataLoaded } from "@/features/rhythm/data";
import { GlobalErrorState } from "@/features/rhythm/components";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportAppError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="stitch-root-error-wrap">
      <div className="stitch-root-error">
        <GlobalErrorState
          title="This page didn't load"
          message={
            error.message ||
            "Something went wrong on our end. You can try refreshing or head back home."
          }
        />
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
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
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Digital Payment Behaviour Analysis" },
      {
        name: "description",
        content: "Customer return likelihood, risk drivers and suggested retention actions.",
      },

      { property: "og:title", content: "Digital Payment Behaviour Analysis" },
      {
        property: "og:description",
        content: "Customer behaviour, return prediction and retention insights.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@400;600;700;800&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
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
  const location = useLocation();
  const dataAlreadyLoaded = useDataLoaded();
  const currentCheckStarted = useRef(false);
  useEffect(() => {
    if (location.pathname === "/" || dataAlreadyLoaded || currentCheckStarted.current) return;
    currentCheckStarted.current = true;
    // Restore a previously processed backend dataset once. The empty workspace renders
    // immediately while this lightweight state check runs.
    void loadCurrentData();
  }, [location.pathname, dataAlreadyLoaded]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <PreferencesProvider>
        <AppShell>
          <Outlet />
        </AppShell>
        <Toaster position="bottom-right" />
      </PreferencesProvider>
    </QueryClientProvider>
  );
}
