"use client";

import { useState } from "react";
import { AVAILABLE_SCOPES, type ApiKeyRecord, type ApiKeyScope } from "@/lib/security/api-keys";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type ApiKeyManagerProps = {
  initialKeys: ApiKeyRecord[];
};

export function ApiKeyManager({ initialKeys }: ApiKeyManagerProps) {
  const [keys, setKeys] = useState<ApiKeyRecord[]>(initialKeys);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<ApiKeyScope[]>(["posts:read"]);
  const [expiresDays, setExpiresDays] = useState<number | null>(30);
  const [isGenerating, setIsGenerating] = useState(false);
  const [newlySecretKey, setNewlySecretKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const envKeys = keys.filter((k) => k.source === "env");
  const managedKeys = keys.filter((k) => k.source === "managed");

  function toggleScope(scope: ApiKeyScope) {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  }

  async function handleIssueKey(e: React.FormEvent) {
    e.preventDefault();
    if (!nameInput.trim()) {
      setError("Please provide a name for the API Key.");
      return;
    }
    if (selectedScopes.length === 0) {
      setError("Select at least one scope.");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nameInput,
          scopes: selectedScopes,
          expiresDays: expiresDays,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to issue key");
      }

      setKeys((prev) => [data.record, ...prev]);
      setNewlySecretKey(data.secretKey);
      setNameInput("");
      setSelectedScopes(["posts:read"]);
    } catch (err) {
      setError((err as Error).message || "Failed to issue key");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm("Are you sure you want to revoke this API key? Applications using it will lose access immediately.")) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/api-keys/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to revoke key");
      }

      setKeys((prev) =>
        prev.map((k) => (k.id === id ? { ...k, status: "revoked" } : k)),
      );
    } catch (err) {
      alert((err as Error).message || "Failed to revoke key");
    }
  }

  function handleCopySecret() {
    if (!newlySecretKey) return;
    navigator.clipboard.writeText(newlySecretKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-8">
      {/* Header Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            API Keys & Access Tokens
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage environment keys and issue granular scoped access tokens for APIs, SDKs, and automated workflows.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setIsModalOpen(true);
            setNewlySecretKey(null);
            setError(null);
          }}
          className="gap-2 rounded-xl text-xs font-semibold shadow-sm"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Issue Scoped API Key
        </Button>
      </div>

      {/* Secret Key One-Time Display Card */}
      {newlySecretKey ? (
        <div className="rounded-3xl border border-green-500/40 bg-gradient-to-r from-green-500/10 via-emerald-500/5 to-card p-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-green-500/20 text-green-500">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">API Key Issued Successfully</h3>
              <p className="text-xs text-muted-foreground">
                Copy your secret key now. It will not be shown again!
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 overflow-x-auto rounded-xl border border-border bg-foreground p-3 font-mono text-xs text-background font-semibold">
              {newlySecretKey}
            </code>
            <Button
              type="button"
              size="sm"
              onClick={handleCopySecret}
              className="gap-1.5 rounded-xl text-xs"
            >
              {copied ? "Copied!" : "Copy Key"}
            </Button>
          </div>
        </div>
      ) : null}

      {/* Section 1: Environment Keys */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Environment-Configured Keys ({envKeys.length})
        </h3>

        {envKeys.length === 0 ? (
          <p className="text-xs text-muted-foreground">No environment keys currently defined in process.env.</p>
        ) : (
          <div className="grid gap-3">
            {envKeys.map((key) => (
              <div
                key={key.id}
                className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card/60 p-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{key.name}</span>
                    <Badge variant="success">Active (ENV)</Badge>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">{key.displayKey}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {key.scopes.map((scope) => (
                    <span
                      key={scope}
                      className="rounded-md bg-muted/80 px-2 py-0.5 text-[10px] font-medium text-foreground/80"
                    >
                      {scope}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section 2: Managed Issued Tokens */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Issued Managed Tokens ({managedKeys.length})
        </h3>

        {managedKeys.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border/80 p-8 text-center">
            <p className="text-xs text-muted-foreground">No managed API keys issued yet. Click &quot;Issue Scoped API Key&quot; above to generate one.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {managedKeys.map((key) => (
              <div
                key={key.id}
                className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-card/80 p-4 shadow-xs transition hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{key.name}</span>
                    {key.status === "active" ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="warning">Revoked</Badge>
                    )}
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">{key.displayKey}</p>
                  <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground pt-1">
                    <span>Created: {new Date(key.createdAt).toLocaleDateString()}</span>
                    {key.expiresAt ? (
                      <span>Expires: {new Date(key.expiresAt).toLocaleDateString()}</span>
                    ) : (
                      <span>Expires: Never</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex flex-wrap gap-1">
                    {key.scopes.map((scope) => (
                      <span
                        key={scope}
                        className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary"
                      >
                        {scope}
                      </span>
                    ))}
                  </div>

                  {key.status === "active" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleRevoke(key.id)}
                      className="rounded-xl text-xs text-red-600 hover:bg-red-50 dark:text-red-400"
                    >
                      Revoke Key
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modal: Issue Key Dialog */}
      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg space-y-6 rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/80 pb-4">
              <h3 className="text-base font-semibold text-foreground">Issue Scoped API Key</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            {error ? <p className="text-xs text-red-500">{error}</p> : null}

            <form onSubmit={handleIssueKey} className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="key-name" className="block text-xs font-semibold text-foreground">
                  Key Name / Application Label
                </label>
                <input
                  id="key-name"
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="e.g. CI/CD Deployment Script, Mobile App SDK"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              {/* Scopes Selection */}
              <div className="space-y-2">
                <span className="block text-xs font-semibold text-foreground">
                  Select Granted Scopes
                </span>
                <div className="grid gap-2 sm:grid-cols-2">
                  {AVAILABLE_SCOPES.map(({ scope, label, description }) => {
                    const isChecked = selectedScopes.includes(scope);
                    return (
                      <label
                        key={scope}
                        className={`flex cursor-pointer items-start gap-2 rounded-xl border p-2.5 transition ${
                          isChecked
                            ? "border-primary bg-primary/5"
                            : "border-border/80 bg-background/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleScope(scope)}
                          className="mt-0.5 h-3.5 w-3.5 rounded border-border"
                        />
                        <div>
                          <p className="text-xs font-medium text-foreground">{label}</p>
                          <p className="text-[10px] text-muted-foreground line-clamp-1">{description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Expiration Selector */}
              <div className="space-y-1.5">
                <label htmlFor="key-expiration" className="block text-xs font-semibold text-foreground">
                  Expiration Timeframe
                </label>
                <select
                  id="key-expiration"
                  value={expiresDays === null ? "never" : String(expiresDays)}
                  onChange={(e) =>
                    setExpiresDays(e.target.value === "never" ? null : Number(e.target.value))
                  }
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="7">7 Days</option>
                  <option value="30">30 Days (Default)</option>
                  <option value="90">90 Days</option>
                  <option value="365">1 Year</option>
                  <option value="never">Never Expire</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border/80">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isGenerating}
                  className="rounded-xl text-xs font-semibold"
                >
                  {isGenerating ? "Generating Key…" : "Generate Scoped Key"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
