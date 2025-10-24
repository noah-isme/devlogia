import { describe, expect, it } from "vitest";

import {
  appendToStack,
  clampLimit,
  decodeCursor,
  encodeCursor,
  parseCursorParam,
  parseStackParam,
  serializeStack,
} from "@/lib/pagination";

describe("pagination helpers", () => {
  it("encodes and decodes cursors", () => {
    const cursor = encodeCursor({ id: "abc", sortKey: new Date("2024-01-01T00:00:00Z").toISOString() });
    expect(cursor).toBeTypeOf("string");
    const decoded = decodeCursor(cursor);
    expect(decoded).toMatchObject({ id: "abc" });
  });

  it("parses cursor params", () => {
    expect(parseCursorParam(undefined)).toBeNull();
    expect(parseCursorParam("_")).toBeNull();
    const cursor = "sample";
    expect(parseCursorParam(cursor)).toBe(cursor);
  });

  it("serializes and parses stack values", () => {
    const stack = appendToStack([], null);
    const serialized = serializeStack(stack);
    expect(serialized).toBe("_");
    const parsed = parseStackParam(serialized);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toBeNull();
  });

  it("clamps limits", () => {
    expect(clampLimit("5", 10, { min: 1, max: 20 })).toBe(5);
    expect(clampLimit("100", 10, { min: 1, max: 20 })).toBe(20);
    expect(clampLimit(undefined, 10, { min: 1, max: 20 })).toBe(10);
  });
});
