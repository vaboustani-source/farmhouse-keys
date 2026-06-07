import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AuthProvider } from "@/lib/useAuth";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 font-sans">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-7xl font-medium text-primary">404</h1>
        <h2 className="mt-4 font-serif text-2xl text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm tracking-wide text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Return to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Reservations · Gilbertsville Farmhouse" },
      { name: "description", content: "Lodging Reservations for Gilbertsville Farmhouse" },
      { name: "author", content: "Gilbertsville Farmhouse" },
      { property: "og:title", content: "Reservations · Gilbertsville Farmhouse" },
      { property: "og:description", content: "Lodging Reservations for Gilbertsville Farmhouse" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Reservations · Gilbertsville Farmhouse" },
      { name: "twitter:description", content: "Lodging Reservations for Gilbertsville Farmhouse" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/10009fb2-86a0-459c-9c6b-4ba1b18fd07f/id-preview-25a26953--a9cf7512-d53e-4e93-be25-666d375c693f.lovable.app-1780025729719.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/10009fb2-86a0-459c-9c6b-4ba1b18fd07f/id-preview-25a26953--a9cf7512-d53e-4e93-be25-666d375c693f.lovable.app-1780025729719.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Jost:wght@300;400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
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
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
  }));
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <Outlet />
        <Toaster position="top-right" richColors closeButton />
      </AuthProvider>
    </QueryClientProvider>
  );
}
