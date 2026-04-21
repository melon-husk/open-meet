import { ImageResponse } from "next/og";

export const size = {
  width: 32,
  height: 32,
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
          borderRadius: 8,
          border: "1px solid #e4e4e7",
          background: "#ffffff",
          color: "#18181b",
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          fontFamily: "Geist, Inter, sans-serif",
        }}
      >
        OM
      </div>
    ),
    {
      ...size,
    },
  );
}
