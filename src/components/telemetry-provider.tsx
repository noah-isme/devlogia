"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

type TelemetryProviderProps = {
  page: string;
  metadata?: Record<string, unknown>;
  children: ReactNode;
};

type LayoutVariant = "control" | "immersion";

const VARIANT_STORAGE_KEY = "devlogia-post-layout-variant";

function selectVariant(): LayoutVariant {
  if (typeof window === "undefined") {
    return "control";
  }

  try {
    const stored = window.localStorage.getItem(VARIANT_STORAGE_KEY);
    if (stored === "control" || stored === "immersion") {
      return stored;
    }
  } catch {
    // ignore access errors
  }

  const randomBuffer = new Uint32Array(1);
  crypto.getRandomValues(randomBuffer);
  const variant: LayoutVariant = randomBuffer[0] % 2 === 0 ? "control" : "immersion";

  try {
    window.localStorage.setItem(VARIANT_STORAGE_KEY, variant);
  } catch {
    // ignore quota errors
  }

  return variant;
}

function dispatchTelemetry(event: string, payload: Record<string, unknown>) {
  if (typeof window === "undefined") {
    return;
  }

  const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/telemetry", blob);
    return;
  }

  void fetch("/api/telemetry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  });
}

export function TelemetryProvider({ page, metadata, children }: TelemetryProviderProps) {
  const metadataRef = useRef(metadata ?? {});

  useEffect(() => {
    metadataRef.current = metadata ?? {};
  }, [metadata]);

  useEffect(() => {
    const pageKey = typeof window !== "undefined" ? window.location.pathname : page;
    const variant = selectVariant();
    document.documentElement.dataset.postLayoutVariant = variant;
    (window as typeof window & { __devlogiaTelemetry?: Record<string, unknown> }).__devlogiaTelemetry = {
      ...(window as typeof window & { __devlogiaTelemetry?: Record<string, unknown> }).__devlogiaTelemetry,
      postLayoutVariant: variant,
    };

    const start = performance.now();
    let maxScroll = 0;
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) {
        maxScroll = 100;
        return;
      }
      const progress = Math.min(100, Math.round((scrollTop / docHeight) * 100));
      if (progress > maxScroll) {
        maxScroll = progress;
      }
    };

    const flushEvent = (reason: string) => {
      const duration = Math.round((performance.now() - start) / 1000);
      dispatchTelemetry("page-session", {
        page: pageKey,
        reason,
        durationSeconds: duration,
        maxScrollPercent: maxScroll,
        variant,
        ...metadataRef.current,
      });
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        flushEvent("hidden");
      }
    };

    const handleBeforeUnload = () => {
      flushEvent("unload");
    };

    dispatchTelemetry("page-view", { page: pageKey, variant, ...metadataRef.current });

    window.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      flushEvent("cleanup");
    };
  }, [page]);

  return <>{children}</>;
}

export function usePostLayoutVariant(): LayoutVariant {
  if (typeof window === "undefined") {
    return "control";
  }

  const state = (window as typeof window & { __devlogiaTelemetry?: { postLayoutVariant?: LayoutVariant } }).__devlogiaTelemetry;
  return state?.postLayoutVariant === "immersion" ? "immersion" : "control";
}
