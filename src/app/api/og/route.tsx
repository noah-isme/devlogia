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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawTitle = searchParams.get("title") ?? siteConfig.name;
  const title = rawTitle.slice(0, 120);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          backgroundColor: "#0f172a",
          color: "#e2e8f0",
          fontFamily: "'Segoe UI', system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <span style={{ fontSize: 48, opacity: 0.75, letterSpacing: "0.04em" }}>{siteConfig.name}</span>
          <h1
            style={{
              fontSize: 86,
              lineHeight: 1.1,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              maxWidth: "960px",
              wordWrap: "break-word",
            }}
          >
            {title}
          </h1>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 28,
            opacity: 0.75,
          }}
        >
          <span>{siteConfig.url.replace(/^https?:\/\//, "")}</span>
          <span>{siteConfig.twitter}</span>
        </div>
      </div>
    ),
    size,
  );
}

