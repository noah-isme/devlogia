import { vi } from "vitest";

export type MockResponse = {
  ok?: boolean;
  status?: number;
  statusText?: string;
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
};

export function createMockFetch() {
  return vi.fn() as unknown as ReturnType<typeof vi.fn> & typeof fetch;
}

export function mockFetchSuccess<T>(data: T): MockResponse {
  return {
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

export function mockFetchError(
  status = 500,
  message = "Internal Server Error",
): MockResponse {
  return {
    ok: false,
    status,
    statusText: message,
    text: async () => message,
  };
}
