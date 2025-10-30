"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { DeveloperPortalLayout } from "@/components/devportal/PortalLayout";

type DeveloperPortalLayoutClientProps = {
  children: ReactNode;
};

export function DeveloperPortalLayoutClient({ children }: DeveloperPortalLayoutClientProps) {
  const pathname = usePathname();
  return <DeveloperPortalLayout activePath={pathname}>{children}</DeveloperPortalLayout>;
}
