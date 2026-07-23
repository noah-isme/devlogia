"use client";

import React, { useState, useTransition } from "react";

type LogEntry = {
  type: "log" | "warn" | "error" | "result";
  text: string;
};

type ExecutionState = {
  status: "idle" | "running" | "success" | "error";
  logs: LogEntry[];
  executionTimeMs: number;
  errorMessage?: string;
};

function formatConsoleArg(arg: unknown): string {
  if (typeof arg === "string") return arg;
  if (typeof arg === "number" || typeof arg === "boolean") return String(arg);
  if (arg === null) return "null";
  if (arg === undefined) return "undefined";
  try {
    return JSON.stringify(arg, null, 2);
  } catch {
    return String(arg);
  }
}

export function InteractiveCodeBlock({ children, ...props }: React.ComponentPropsWithoutRef<"pre">) {
  const [copied, setCopied] = useState(false);
  const [execution, setExecution] = useState<ExecutionState>({
    status: "idle",
    logs: [],
    executionTimeMs: 0,
  });
  const [, startTransition] = useTransition();

  // Extract raw text and language from children structure
  let codeString = "";
  let language = "code";

  if (React.isValidElement(children)) {
    const childProps = children.props as { className?: string; children?: React.ReactNode };
    const classMatch = childProps?.className?.match(/language-(\w+)/);
    if (classMatch?.[1]) {
      language = classMatch[1].toLowerCase();
    }
    if (typeof childProps?.children === "string") {
      codeString = childProps.children;
    } else if (Array.isArray(childProps?.children)) {
      codeString = childProps.children.join("");
    }
  } else if (typeof children === "string") {
    codeString = children;
  }

  const isExecutable = ["js", "javascript", "ts", "typescript"].includes(language);

  const handleCopy = async () => {
    const textToCopy = codeString.trim();
    if (!textToCopy) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleRunCode = () => {
    if (!codeString.trim()) return;

    setExecution({ status: "running", logs: [], executionTimeMs: 0 });
    const started = performance.now();
    const capturedLogs: LogEntry[] = [];

    const mockConsole = {
      log: (...args: unknown[]) => {
        capturedLogs.push({ type: "log", text: args.map(formatConsoleArg).join(" ") });
      },
      info: (...args: unknown[]) => {
        capturedLogs.push({ type: "log", text: args.map(formatConsoleArg).join(" ") });
      },
      warn: (...args: unknown[]) => {
        capturedLogs.push({ type: "warn", text: args.map(formatConsoleArg).join(" ") });
      },
      error: (...args: unknown[]) => {
        capturedLogs.push({ type: "error", text: args.map(formatConsoleArg).join(" ") });
      },
    };

    startTransition(() => {
      try {
        // Strip TS type annotations broadly if TS snippet
        let executableCode = codeString;
        if (language === "ts" || language === "typescript") {
          executableCode = executableCode
            .replace(/:\s*(string|number|boolean|any|void|unknown|never|object|Array<[^>]+>|Record<[^>]+>)/g, "")
            .replace(/interface\s+\w+\s*\{[^}]*\}/g, "")
            .replace(/type\s+\w+\s*=[^;]+;/g, "");
        }

        // Execute in sandboxed Function
        const runner = new Function("console", `
          "use strict";
          try {
            ${executableCode}
          } catch (err) {
            console.error(err.message || String(err));
          }
        `);

        runner(mockConsole);
        const elapsed = Math.round((performance.now() - started) * 10) / 10;

        setExecution({
          status: "success",
          logs: capturedLogs,
          executionTimeMs: elapsed,
        });
      } catch (err) {
        const elapsed = Math.round((performance.now() - started) * 10) / 10;
        setExecution({
          status: "error",
          logs: capturedLogs,
          executionTimeMs: elapsed,
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }
    });
  };

  const handleClearOutput = () => {
    setExecution({ status: "idle", logs: [], executionTimeMs: 0 });
  };

  return (
    <div className="group relative my-6 overflow-hidden rounded-2xl border border-border/80 bg-muted/40 shadow-md transition hover:border-border">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/70 px-4 py-2.5 text-xs">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-red-400/80" />
          <span className="flex h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
          <span className="ml-2 font-mono font-semibold uppercase tracking-wider text-muted-foreground">
            {language}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isExecutable ? (
            <button
              type="button"
              onClick={handleRunCode}
              disabled={execution.status === "running"}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-500/25 dark:text-emerald-400"
            >
              <span>{execution.status === "running" ? "⏳ Running…" : "▶ Run Code"}</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 rounded-lg border border-border/70 bg-background/80 px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:border-primary/50 hover:text-foreground shadow-sm"
          >
            <span>{copied ? "✓ Copied!" : "📋 Copy"}</span>
          </button>
        </div>
      </div>

      {/* Code Content View */}
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-foreground" {...props}>
        {children}
      </pre>

      {/* Console Execution Output Drawer */}
      {execution.status !== "idle" ? (
        <div className="border-t border-border/80 bg-black/90 p-4 font-mono text-xs text-emerald-400 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 text-[11px] text-gray-400">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white">Console Output</span>
              <span>· {execution.executionTimeMs}ms</span>
            </div>
            <button
              type="button"
              onClick={handleClearOutput}
              className="text-gray-400 hover:text-white"
            >
              ✕ Clear
            </button>
          </div>

          <div className="mt-3 space-y-1.5 max-h-48 overflow-y-auto">
            {execution.logs.length === 0 && !execution.errorMessage ? (
              <p className="text-gray-500 italic">Code executed with no console logs.</p>
            ) : null}

            {execution.logs.map((log, index) => (
              <div
                key={index}
                className={`flex gap-2 whitespace-pre-wrap break-all ${
                  log.type === "error"
                    ? "text-red-400"
                    : log.type === "warn"
                      ? "text-amber-300"
                      : "text-emerald-300"
                }`}
              >
                <span className="select-none text-gray-600">&gt;</span>
                <span>{log.text}</span>
              </div>
            ))}

            {execution.errorMessage ? (
              <div className="text-red-400 font-semibold mt-1">
                ✕ Error: {execution.errorMessage}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
