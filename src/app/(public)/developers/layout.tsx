import type { Metadata } from "next";

import { DeveloperPortalLayoutClient } from "@/components/devportal/PortalLayoutClient";

export const metadata: Metadata = {
  title: "Devlogia Developer Portal",
  description:
    "Documentation, sandbox APIs, submission console, and webhook tooling for building on the Devlogia platform.",
};

type DevelopersLayoutProps = {
  children: React.ReactNode;
};

export default function DevelopersLayout({ children }: DevelopersLayoutProps) {
  return <DeveloperPortalLayoutClient>{children}</DeveloperPortalLayoutClient>;
}
