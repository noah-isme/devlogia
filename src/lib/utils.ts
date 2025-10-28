import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import readingTime from "reading-time";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string, locale = "en-US") {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(value);
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

export function estimateReadingTime(content: string) {
  const { text } = readingTime(content);
  return text;
}

export function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value) || Number.isNaN(min) || Number.isNaN(max)) {
    return min;
  }
  if (min > max) {
    return clamp(value, max, min);
  }
  return Math.min(Math.max(value, min), max);
}

