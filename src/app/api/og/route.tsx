import { ImageResponse } from "next/og";

import { siteConfig } from "@/lib/seo";

const WIDTH = 1200;
const HEIGHT = 630;

export const runtime = "edge";
export const alt = `${siteConfig.name} social image`;
export const contentType = "image/png";
export const size = {
  width: WIDTH,
  height: HEIGHT,
};

function formatOgDate(input: string | null) {
  if (!input) return null;
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawTitle = searchParams.get("title") ?? siteConfig.name;
  const rawTag = searchParams.get("tag");
  const rawSlug = searchParams.get("slug");
  const rawDate = searchParams.get("date");

  const title = rawTitle.slice(0, 160);
  const tag = rawTag?.slice(0, 48) ?? null;
  const slug = rawSlug?.slice(0, 80) ?? null;
  const formattedDate = formatOgDate(rawDate);

  try {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "64px 80px",
            background: "linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #0b1120 100%)",
            color: "#e2e8f0",
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
          }}
        >
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 40, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {siteConfig.name}
            </span>
            {slug ? (
              <span
                style={{
                  fontSize: 24,
                  color: "rgba(226, 232, 240, 0.7)",
                  fontFeatureSettings: '"tnum"',
                }}
              >
                /blog/{slug}
              </span>
            ) : null}
          </header>
          <main style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            <h1
              style={{
                fontSize: 88,
                lineHeight: 1.05,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                margin: 0,
                maxWidth: "960px",
              }}
            >
              {title}
            </h1>
          </main>
          <footer
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 26,
              color: "rgba(226, 232, 240, 0.8)",
            }}
          >
            <div style={{ display: "flex", gap: 24 }}>
              {tag ? (
                <span
                  style={{
                    backgroundColor: "rgba(148, 163, 184, 0.15)",
                    borderRadius: 999,
                    padding: "8px 20px",
                    fontSize: 24,
                  }}
                >
                  #{tag}
                </span>
              ) : null}
              {formattedDate ? <span>{formattedDate}</span> : null}
            </div>
            <span>{siteConfig.url.replace(/^https?:\/\//, "")}</span>
          </footer>
        </div>
      ),
      size,
    );
  } catch (error) {
    console.error("Failed to render OG image", error);
    const fallbackUrl = new URL("/og-default.png", request.url);
    const fallback = await fetch(fallbackUrl.toString());
    return new Response(fallback.body, {
      status: fallback.status,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": fallback.headers.get("Cache-Control") ?? "public, max-age=31536000, immutable",
      },
    });
  }
}
