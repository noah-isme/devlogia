import type { ReactNode } from "react";

import { SkipLink } from "@/components/ui/skip-link";
import { buildMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";
import "@/styles/globals.css";

export const metadata = buildMetadata();

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("bg-background text-foreground antialiased font-sans")}> 
        <SkipLink />
        {children}
      </body>
    </html>
  );
}
