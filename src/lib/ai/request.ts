type RetryOptions = {
  timeoutMs?: number;
  retries?: number;
  backoffMs?: number;
  maxBackoffMs?: number;
  retryOn?: (response: Response | null, error: unknown | null) => boolean;
};

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_BACKOFF_MS = 400;
const DEFAULT_MAX_BACKOFF_MS = 4_000;
const DEFAULT_RETRY_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function defaultRetryOn(response: Response | null, error: unknown | null) {
  if (error) {
    return true;
  }
  if (!response) {
    return false;
  }
  return DEFAULT_RETRY_STATUS.has(response.status);
}

function createAbortSignal(signal: AbortSignal | null | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", onAbort, { once: true });
    }
  }

  return { controller, timeout, onAbort };
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  options: RetryOptions = {},
): Promise<Response> {
  const retries = Math.max(0, options.retries ?? 2);
  const timeoutMs = Math.max(1000, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const backoffMs = Math.max(0, options.backoffMs ?? DEFAULT_BACKOFF_MS);
  const maxBackoffMs = Math.max(backoffMs, options.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS);
  const retryOn = options.retryOn ?? defaultRetryOn;

  let attempt = 0;
  let lastError: unknown | null = null;

  while (attempt <= retries) {
    const { controller, timeout, onAbort } = createAbortSignal(init.signal, timeoutMs);

    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (retryOn(response, null) && attempt < retries) {
        response.body?.cancel?.();
        const delay = Math.min(maxBackoffMs, backoffMs * 2 ** attempt);
        const jitter = Math.floor(Math.random() * 100);
        await sleep(delay + jitter);
        attempt += 1;
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (!retryOn(null, error) || attempt >= retries) {
        throw error;
      }
      const delay = Math.min(maxBackoffMs, backoffMs * 2 ** attempt);
      const jitter = Math.floor(Math.random() * 100);
      await sleep(delay + jitter);
      attempt += 1;
    } finally {
      clearTimeout(timeout);
      if (init.signal) {
        init.signal.removeEventListener("abort", onAbort);
      }
    }
  }

  throw lastError ?? new Error("Request failed after retries");
}
