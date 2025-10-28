import type { ReactNode } from "react";

import { ThemeProvider } from "@/components/theme/theme-provider";
import { ThemeScript } from "@/components/theme/theme-script";
import { SkipLink } from "@/components/ui/skip-link";
import { buildMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";
import "@/styles/globals.css";
import { Toaster } from "sonner";

export const metadata = buildMetadata();

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className={cn("bg-background text-foreground antialiased font-sans")}>
        <ThemeProvider>
          <SkipLink />
          {children}
          <Toaster richColors position="top-center" toastOptions={{ duration: 3200 }} />
        </ThemeProvider>
      </body>
    </html>
  );
}
