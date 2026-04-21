import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";
export const alt = "Open Meet - Private meeting notes and summaries";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "48px",
          color: "#18181b",
          background: "#fafafa",
          fontFamily: "Geist, Inter, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              fontSize: 36,
              fontWeight: 700,
              letterSpacing: "-0.02em",
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 50,
                height: 50,
                borderRadius: 12,
                border: "1px solid #e4e4e7",
                background: "#ffffff",
                color: "#18181b",
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              OM
            </span>
            Open Meet
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "8px 12px",
              borderRadius: "999px",
              border: "1px solid #e4e4e7",
              color: "#52525b",
              fontSize: 18,
              background: "#ffffff",
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "999px",
                background: "#ef4444",
              }}
            />
            New Meeting
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "18px",
            padding: "40px",
            border: "1px solid #e4e4e7",
            borderRadius: "22px",
            background: "#ffffff",
            boxShadow: "0 10px 30px rgba(24, 24, 27, 0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 72,
              fontWeight: 800,
              lineHeight: 1.02,
            }}
          >
            <span>Private Meeting</span>
            <span>Notes, Local-First</span>
          </div>
          <div style={{ fontSize: 31, color: "#52525b", maxWidth: "94%" }}>
            Live transcripts, AI summaries, and notes that stay in your browser.
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                padding: "7px 12px",
                borderRadius: "999px",
                background: "#ecfdf5",
                color: "#059669",
                fontSize: 17,
                fontWeight: 600,
              }}
            >
              Summarized
            </span>
            <span
              style={{
                padding: "7px 12px",
                borderRadius: "999px",
                background: "#fef2f2",
                color: "#ef4444",
                fontSize: 17,
                fontWeight: 600,
              }}
            >
              Recording
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 22,
            color: "#71717a",
          }}
        >
          <span>Everything runs locally in your browser</span>
          <span>open-meet</span>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
