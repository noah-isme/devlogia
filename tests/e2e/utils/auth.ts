import type { ConsoleMessage, Page, Response } from "@playwright/test";

type LoginOptions = {
  email: string;
  password: string;
  successUrl?: RegExp | string;
  timeout?: number;
};

const DEFAULT_SUCCESS_URL = /\/admin\/dashboard(?:\?.*)?$/;

export async function loginAs(page: Page, options: LoginOptions) {
  const {
    email,
    password,
    successUrl = DEFAULT_SUCCESS_URL,
    timeout = 15_000,
  } = options;

  const consoleErrors: string[] = [];
  const consoleListener = (msg: ConsoleMessage) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  };

  page.on("console", consoleListener);

  try {
    await page.goto("/admin/login", { waitUntil: "domcontentloaded" });

    const emailInput = page
      .getByLabel(/email/i)
      .or(page.getByPlaceholder(/email/i));
    const passwordInput = page
      .getByLabel(/password/i)
      .or(page.getByPlaceholder(/password/i));

    await emailInput.fill(email);
    await passwordInput.fill(password);

    const loginResponsePromise = page.waitForResponse(
      (response) => {
        const url = response.url();
        return (
          /\/api\/auth\/callback\/credentials/.test(url) ||
          /\/auth\/login/.test(url) ||
          /\/api\/login/.test(url)
        );
      },
      { timeout }
    );

    await page
      .getByRole("button", { name: /sign in|login|masuk/i })
      .click();

    let loginResponse: Response | undefined;

    try {
      loginResponse = await loginResponsePromise;
    } catch {
      // ignore: not all implementations expose a distinct login response
    }

    if (loginResponse) {
      const status = loginResponse.status();
      const maybeJson = await safeJson(loginResponse);

      if (status >= 400) {
        await dumpDiagnostics(page, "login-bad-status", {
          status,
          body: maybeJson,
          consoleErrors,
        });
        throw new Error(`Login failed with HTTP ${status}`);
      }

      if (maybeJson && typeof maybeJson.url === "string") {
        await page.goto(maybeJson.url);
      }
    }

    try {
      await page.waitForURL(successUrl, { timeout });
    } catch (error) {
      const currentUrl = page.url();

      if (/\/admin\/login/.test(currentUrl)) {
        const cookies = await page.context().cookies();
        const sessionCookies = cookies.filter((cookie) =>
          /session|next-auth/i.test(cookie.name)
        );

        await dumpDiagnostics(page, "still-on-login", {
          currentUrl,
          cookies,
          sessionCookies,
          consoleErrors,
        });
        throw new Error(
          `Login did not navigate away from the login page: ${currentUrl}`
        );
      }

      await dumpDiagnostics(page, "unexpected-url", {
        currentUrl,
        consoleErrors,
      });

      throw error;
    }
  } finally {
    page.off("console", consoleListener);
  }
}

async function safeJson(response: Response) {
  const contentType = response.headers()["content-type"] ?? "";

  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      // ignore malformed json
    }
  }

  return null;
}

async function dumpDiagnostics(
  page: Page,
  tag: string,
  extra: Record<string, unknown>
) {
  await page.screenshot({
    path: `test-results/${tag}.png`,
    fullPage: true,
  });

  console.log(`[diagnostics:${tag}] url=${page.url()}`);
  console.log(`[diagnostics:${tag}] extra=${JSON.stringify(extra, null, 2)}`);
}
