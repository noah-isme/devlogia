import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ThemeProvider } from "@/components/theme/theme-provider";
import { ThemeToggle } from "@/components/theme/theme-toggle";

const STORAGE_KEY = "devlogia-theme";

describe("ThemeProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.dataset.theme = "light";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: undefined,
    });
  });

  test("initializes from localStorage and toggles", async () => {
    window.localStorage.setItem(STORAGE_KEY, "dark");

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(screen.getByText(/Dark mode/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /dark mode/i }));

    await waitFor(() => {
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe("light");
      expect(document.documentElement.dataset.theme).toBe("light");
    });

    expect(screen.getByText(/Light mode/i)).toBeInTheDocument();
  });

  test("respects prefers-color-scheme when no stored preference", async () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    });

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("dark");
    });

    expect(screen.getByText(/Dark mode/i)).toBeInTheDocument();
  });
});
