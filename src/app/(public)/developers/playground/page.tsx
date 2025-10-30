import Link from "next/link";

import { PlaygroundClient } from "@/components/devportal/PlaygroundClient";
import { Button } from "@/components/ui/button";

export default function PlaygroundPage() {
  const sandboxKey = process.env.DEVPORTAL_SANDBOX_API_KEY;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">OpenAPI explorer</h1>
        <p className="text-sm text-muted-foreground">
          Try Devlogia endpoints with automatic sandbox authentication. Tokens are minted via <code>/api/devportal/playground/token</code> and attached to every request.
        </p>
        <div className="flex flex-wrap gap-3 text-sm">
          <Button asChild size="sm" variant="outline">
            <Link href="/developers/docs/auth">Review auth guide</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/api/docs/openapi.json" target="_blank">Download schema</Link>
          </Button>
        </div>
      </header>
      <PlaygroundClient schemaUrl="/api/docs/openapi.json" tokenEndpoint="/api/devportal/playground/token" sandboxKey={sandboxKey} />
    </div>
  );
}
