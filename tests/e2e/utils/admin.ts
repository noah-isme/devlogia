import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

const NEW_POST_URL = "/admin/posts/new";
const NEW_POST_URL_PATTERN = /\/admin\/posts\/new(?:[/?]|$)/;
const MAX_HTML_SNAPSHOT = 4000;

async function clickIfVisible(page: Page, locator: Locator) {
  const isVisible = await locator.isVisible().catch(() => false);

  if (!isVisible) {
    return false;
  }

  try {
    await Promise.all([
      page.waitForURL(NEW_POST_URL_PATTERN, { timeout: 10_000 }),
      locator.click(),
    ]);
    await page.waitForLoadState("networkidle");
    return true;
  } catch {
    return false;
  }
}

async function ensureVisible(locator: Locator) {
  try {
    await locator.first().waitFor({ state: "attached", timeout: 5_000 });
    await expect(locator.first()).toBeVisible({ timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

async function waitForEditor(page: Page) {
  await page.waitForURL(NEW_POST_URL_PATTERN, { timeout: 15_000 });
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle");

  await logEditorStatus(page);

  const candidates: Locator[] = [
    page.getByTestId("post-editor"),
    page.getByTestId("post-title"),
    page.getByLabel(/title/i),
    page.getByTestId("post-save-draft"),
    page.getByTestId("post-publish"),
    page.locator("input[name='title']").first(),
  ];

  for (const candidate of candidates) {
    if (await ensureVisible(candidate)) {
      return;
    }
  }

  await dumpEditorDiagnostics(page, "post-editor-missing");
  await expect(page.getByTestId("post-editor")).toBeVisible({ timeout: 15_000 });
}

async function logEditorStatus(page: Page) {
  try {
    const response = await page.request.get(NEW_POST_URL, {
      failOnStatusCode: false,
    });
    const status = response.status();
    const contentType = response.headers()["content-type"] ?? "";

    console.log(
      `[e2e:editor-status] url=${page.url()} status=${status} content-type=${contentType}`,
    );
  } catch (error) {
    console.log(
      `[e2e:editor-status] url=${page.url()} status=<request-error> error=${String(error)}`,
    );
  }
}

async function dumpEditorDiagnostics(page: Page, tag: string) {
  let html = "";
  try {
    html = await page.content();
  } catch (error) {
    html = `<error>${String(error)}`;
  }

  const snippet = html.slice(0, MAX_HTML_SNAPSHOT);

  console.log(`[e2e:${tag}] url=${page.url()}`);
  console.log(`[e2e:${tag}] snippet=${snippet}`);
}

export async function openNewPost(page: Page) {
  await page.waitForLoadState("domcontentloaded");

  if (await clickIfVisible(page, page.getByTestId("new-post"))) {
    await waitForEditor(page);
    return;
  }

  if (
    await clickIfVisible(
      page,
      page.locator('a[href="/admin/posts/new"]').first()
    )
  ) {
    await waitForEditor(page);
    return;
  }

  const fuzzyLabel = /new\s*post|new|create/i;

  if (
    await clickIfVisible(
      page,
      page.getByRole("link", { name: fuzzyLabel }).first()
    )
  ) {
    await waitForEditor(page);
    return;
  }

  if (
    await clickIfVisible(
      page,
      page.getByRole("button", { name: fuzzyLabel }).first()
    )
  ) {
    await waitForEditor(page);
    return;
  }

  await page.goto(NEW_POST_URL);
  await page.waitForLoadState("networkidle");
  await waitForEditor(page);
}
