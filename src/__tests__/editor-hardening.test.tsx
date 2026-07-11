import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PostEditor } from "@/components/editor/Editor";
import type { EditorPost } from "@/components/editor/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/components/editor/ai/AssistantPanel", () => ({
  AssistantPanel: () => <div data-testid="assistant-panel" />,
}));

vi.mock("@/components/editor/ai/ToneStylePanel", () => ({
  ToneStylePanel: () => <div data-testid="tone-panel" />,
}));

vi.mock("@/components/editor/ai/SeoOptimizerPanel", () => ({
  SeoOptimizerPanel: () => <div data-testid="seo-panel" />,
}));

vi.mock("@/components/editor/ai/OutlineHeadlinePanel", () => ({
  OutlineHeadlinePanel: () => <div data-testid="outline-panel" />,
}));

const initialPost = {
  id: "post_1",
  title: "Original title",
  slug: "original-title",
  summary: "Original summary",
  contentMdx: "Original content",
  coverUrl: "",
  status: "DRAFT",
  tags: [],
  publishedAt: null,
  updatedAt: "2026-07-11T10:00:00.000Z",
} satisfies EditorPost;

describe("PostEditor hardening", () => {
  beforeEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("shows local draft recovery when the stored draft differs from the database even if it is older", () => {
    // Given: another tab left a different local draft whose timestamp is not newer than the server row.
    window.localStorage.setItem(
      "devlogia-editor-post_1",
      JSON.stringify({
        snapshot: { ...initialPost, title: "Local title", contentMdx: "Local content" },
        autosavedAt: "2026-07-11T09:59:59.000Z",
      }),
    );

    // When: the editor opens the database version.
    render(<PostEditor mode="edit" role="editor" aiEnabled={false} initialPost={initialPost} />);

    // Then: the user can recover the divergent local version instead of silently losing it.
    expect(screen.getByText(/Draf lokal ditemukan/i)).toBeVisible();
  });

  it("shows a conflict banner when autosave loses a two-tab update race", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "Post changed in another tab",
          post: { ...initialPost, title: "Server title", updatedAt: "2026-07-11T10:01:00.000Z" },
        }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    // Given: an editor has an older post snapshot loaded.
    render(<PostEditor mode="edit" role="editor" aiEnabled={false} initialPost={initialPost} />);

    // When: the draft autosaves after another tab has already changed the post.
    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Local title");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1700));
    });

    // Then: the conflict is visible and the local text remains available.
    await waitFor(() => expect(screen.getByRole("button", { name: /keep local draft/i })).toBeVisible());
    expect(screen.getByLabelText("Title")).toHaveValue("Local title");
  }, 7000);

  it("keeps draft content in place when manual publish fails over the network", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));

    // Given: a new post is ready to publish.
    render(<PostEditor mode="create" role="editor" aiEnabled={false} />);
    await user.type(screen.getByLabelText("Title"), "Network failure draft");
    await user.type(screen.getByLabelText("Content"), "Draft survives a failed publish.");

    // When: the publish request fails before the server responds.
    await user.click(screen.getByRole("button", { name: /publish/i }));

    // Then: the editor reports an error and preserves the unsaved draft fields.
    await waitFor(() => expect(screen.getByText(/Tidak tersambung/i)).toBeVisible());
    expect(screen.getByLabelText("Title")).toHaveValue("Network failure draft");
    expect(screen.getByLabelText("Content")).toHaveValue("Draft survives a failed publish.");
  });

  it("keeps media fields unchanged when upload fails over the network", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("upload network down")));

    render(<PostEditor mode="create" role="editor" aiEnabled={false} />);
    await user.type(screen.getByLabelText("Content"), "Upload should not mutate this draft.");
    const input = document.querySelector('input[type="file"]');

    expect(input).toBeInstanceOf(HTMLInputElement);
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Upload input missing");
    }
    await user.upload(input, new File(["image"], "cover.png", { type: "image/png" }));

    await waitFor(() => expect(screen.getByText(/Gagal mengunggah media/i)).toBeVisible());
    expect(screen.getByLabelText("Cover image URL")).toHaveValue("");
    expect(screen.getByLabelText("Content")).toHaveValue("Upload should not mutate this draft.");
  });
});
