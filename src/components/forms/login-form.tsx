"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const callbackUrl = searchParams.get("callbackUrl") ?? "/admin/dashboard";
  const authError = searchParams.get("error");

  const authErrorMessage = useMemo(
    () => (authError ? "Invalid email or password" : null),
    [authError],
  );
  const errorToShow = formError ?? authErrorMessage;

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const payload = {
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
      };

      const parseResult = loginSchema.safeParse(payload);
      if (!parseResult.success) {
        setFormError(parseResult.error.issues[0]?.message ?? "Invalid input");
        return;
      }

      setFormError(null);
      startTransition(async () => {
        const result = await signIn("credentials", {
          email: parseResult.data.email,
          password: parseResult.data.password,
          redirect: false,
          callbackUrl,
        });

        if (result?.error) {
          setFormError("Invalid email or password");
          return;
        }

        router.push(callbackUrl);
        router.refresh();
      });
    },
    [callbackUrl, router],
  );

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="space-y-2 text-center">
        <h1 className="text-xl font-semibold">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Enter your admin credentials to continue.
        </p>
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </div>
      </div>
      {errorToShow ? (
        <p className="text-sm text-red-500" role="alert">
          {errorToShow}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
