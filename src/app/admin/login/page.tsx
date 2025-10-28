import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/components/forms/login-form";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Admin Login",
  description: "Sign in to Devlogia admin dashboard.",
});

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-muted-foreground">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
