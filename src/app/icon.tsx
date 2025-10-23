import { ImageResponse } from "next/og";

export const size = {
  width: 64,
  height: 64,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0f172a",
          color: "#e2e8f0",
          fontSize: 40,
          fontWeight: 600,
          fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        }}
      >
        D
      </div>
    ),
    size,
  );
}
