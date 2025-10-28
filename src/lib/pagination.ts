import { Prisma } from "@prisma/client";

export type EncodedCursor = string;
export type CursorStack = (EncodedCursor | null)[];

type CursorPayload = {
  sortKey: string;
  id: string;
};

const STACK_NULL_TOKEN = "_";

export function encodeCursor(payload: CursorPayload): EncodedCursor {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeCursor(value: string | null | undefined): CursorPayload | null {
  if (!value) {
    return null;
  }

  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as CursorPayload;
    if (typeof parsed.id === "string" && typeof parsed.sortKey === "string") {
      return parsed;
    }
    return null;
  } catch (error) {
    console.error("Failed to decode cursor", error);
    return null;
  }
}

export function parseCursorParam(param: string | string[] | undefined): EncodedCursor | null {
  if (!param) {
    return null;
  }
  const value = Array.isArray(param) ? param[0] : param;
  if (!value || value === "null" || value === STACK_NULL_TOKEN) {
    return null;
  }
  return value;
}

export function parseStackParam(param: string | string[] | undefined): CursorStack {
  if (!param) {
    return [];
  }
  const value = Array.isArray(param) ? param[0] : param;
  if (!value) {
    return [];
  }

  return value
    .split(".")
    .map((entry) => (entry === STACK_NULL_TOKEN ? null : entry))
    .filter((entry) => entry === null || typeof entry === "string");
}

export function serializeStack(stack: CursorStack): string | undefined {
  if (!stack.length) {
    return undefined;
  }

  return stack
    .map((entry) => (entry === null ? STACK_NULL_TOKEN : entry))
    .join(".");
}

export function serializeCursorValue(value: EncodedCursor | null): string | undefined {
  if (!value) {
    return undefined;
  }
  return value;
}

export function appendToStack(stack: CursorStack, value: EncodedCursor | null): CursorStack {
  return [...stack, value ?? null];
}

export function popStack(stack: CursorStack): CursorStack {
  if (!stack.length) {
    return [];
  }
  return stack.slice(0, -1);
}

export function clampLimit(
  raw: string | string[] | undefined,
  defaultValue: number,
  options: { min?: number; max?: number } = {},
) {
  const min = options.min ?? 1;
  const max = options.max ?? 50;

  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }

  return Math.min(Math.max(parsed, min), max);
}

export function buildCursorCondition(
  sortField: Prisma.Sql,
  cursor: CursorPayload | null,
) {
  if (!cursor) {
    return null;
  }

  return Prisma.sql`(${sortField} < ${new Date(cursor.sortKey)} OR (${sortField} = ${new Date(cursor.sortKey)} AND p."id" < ${
    cursor.id
  }))`;
}
