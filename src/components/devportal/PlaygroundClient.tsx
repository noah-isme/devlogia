"use client";

import "swagger-ui-dist/swagger-ui.css";

import { useCallback, useEffect, useRef, useState } from "react";

type SwaggerRequest = {
  headers?: Record<string, string>;
  [key: string]: unknown;
};

type SwaggerUIInstance = {
  destroy: () => void;
};

type SwaggerUIBundleType = ((options: {
  domNode: HTMLElement;
  url: string;
  presets: unknown[];
  docExpansion: string;
  displayRequestDuration: boolean;
  requestInterceptor(request: SwaggerRequest): SwaggerRequest;
}) => SwaggerUIInstance) & {
  presets: { apis: unknown };
};

type PlaygroundClientProps = {
  schemaUrl: string;
  tokenEndpoint: string;
  sandboxKey?: string;
};

type TokenResponse = {
  token: string;
  expiresAt?: string;
};

export function PlaygroundClient({ schemaUrl, tokenEndpoint, sandboxKey }: PlaygroundClientProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const uiRef = useRef<SwaggerUIInstance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const bootstrap = useCallback(async () => {
    if (!containerRef.current || !token) {
      return;
    }

    const [{ default: swaggerBundle }, { default: SwaggerUIStandalonePreset }] = await Promise.all([
      import("swagger-ui-dist/swagger-ui-bundle.js"),
      import("swagger-ui-dist/swagger-ui-standalone-preset.js"),
    ]);

    const SwaggerUIBundle = swaggerBundle as unknown as SwaggerUIBundleType;

    if (uiRef.current) {
      uiRef.current.destroy();
      uiRef.current = null;
    }

    uiRef.current = SwaggerUIBundle({
      domNode: containerRef.current,
      url: schemaUrl,
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
      docExpansion: "none",
      displayRequestDuration: true,
      requestInterceptor(request: SwaggerRequest) {
        if (token) {
          request.headers = {
            ...(request.headers ?? {}),
            Authorization: `Bearer ${token}`,
          };
        }
        if (sandboxKey) {
          request.headers = {
            ...(request.headers ?? {}),
            "X-Devportal-Sandbox-Key": sandboxKey,
          };
        }
        return request;
      },
    });
  }, [schemaUrl, sandboxKey, token]);

  const fetchToken = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch(tokenEndpoint, {
        method: "POST",
        headers: sandboxKey ? { "X-Devportal-Sandbox-Key": sandboxKey } : undefined,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? `Token request failed (${response.status})`);
      }
      const payload = (await response.json()) as TokenResponse;
      setToken(payload.token);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch sandbox token", err);
      setError(err instanceof Error ? err.message : "Unable to mint sandbox token");
    } finally {
      setIsRefreshing(false);
    }
  }, [sandboxKey, tokenEndpoint]);

  useEffect(() => {
    fetchToken().catch((err) => console.error(err));
  }, [fetchToken]);

  useEffect(() => {
    bootstrap().catch((err) => {
      console.error("Failed to bootstrap Swagger UI", err);
      setError(err instanceof Error ? err.message : "Unable to load playground");
    });

    return () => {
      if (uiRef.current) {
        uiRef.current.destroy();
        uiRef.current = null;
      }
    };
  }, [bootstrap]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
        <div>
          <p className="font-medium text-foreground">Sandbox auth</p>
          <p className="text-xs text-muted-foreground">
            Requests automatically include the latest sandbox token. Regenerate whenever scopes change.
          </p>
        </div>
        <button
          type="button"
          onClick={() => fetchToken()}
          className="rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted"
          disabled={isRefreshing}
        >
          {isRefreshing ? "Refreshing…" : "Refresh token"}
        </button>
      </div>
      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      <div ref={containerRef} className="min-h-[600px] overflow-hidden rounded-lg border border-border bg-background" />
    </div>
  );
}
