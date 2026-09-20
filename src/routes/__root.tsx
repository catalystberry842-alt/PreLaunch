import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { SiteShell } from "@/components/site-shell";
import { AuthProvider } from "@/lib/auth/provider";
import { getPreStocksFn } from "@/lib/prestocks.functions";
import { setPreStockCatalog } from "@/lib/prestocks";
import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/seo";
import { THEME_BOOTSTRAP } from "@/lib/theme";
import { ThemeProvider, useTheme } from "@/components/theme-provider";
import type { PreStock } from "@/lib/types";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  loader: async () => {
    try {
      const stocks = await getPreStocksFn();
      return { stocks, stocksError: null as string | null };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The PreStocks catalog could not be reached.";
      return { stocks: [] as PreStock[], stocksError: message };
    }
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: SITE_TITLE },
      { name: "description", content: SITE_DESCRIPTION },
      { name: "theme-color", content: "#09090b" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&display=swap",
      },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  const { stocks } = Route.useLoaderData();
  setPreStockCatalog(stocks);

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <ThemeProvider>
            <SiteShell>
              <Outlet />
            </SiteShell>
            <ThemedToaster />
          </ThemeProvider>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}

function ThemedToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      theme={theme}
      position="top-center"
      offset={{ top: "calc(env(safe-area-inset-top, 0px) + 4.25rem)" }}
      mobileOffset={{ top: "calc(env(safe-area-inset-top, 0px) + 3.75rem)" }}
      toastOptions={{
        className: "border border-border bg-popover text-popover-foreground",
      }}
    />
  );
}
