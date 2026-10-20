import { ImageResponse } from "next/og";

import { SITE } from "./lib/site";

// The preview card for links shared in iMessage, Instagram and Slack. There
// was none, so a shared link showed a bare URL.
export const alt = "Melange — where creative people find their next collaboration";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 64,
          padding: "0 96px",
          background: "linear-gradient(135deg, #F8FAFF 0%, #EEF2FF 55%, #E0E7FF 100%)",
        }}
      >
        <svg width="240" height="240" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="46" fill="#E0EBF8" stroke="#2B44C0" strokeWidth="2" />
          <path
            d="M50 10C55 25 75 40 90 50C75 60 55 75 50 90C45 75 25 60 10 50C25 40 45 25 50 10Z"
            fill="#C4D4F4"
            stroke="#2B44C0"
            strokeWidth="2"
          />
          <circle cx="50" cy="50" r="9" fill="#432391" />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 720 }}>
          <div style={{ fontSize: 96, fontWeight: 700, color: "#312E81", letterSpacing: -2 }}>
            Melange
          </div>
          <div style={{ fontSize: 44, lineHeight: 1.2, color: "#1E293B", marginTop: 12 }}>
            {SITE.tagline}
          </div>
          <div style={{ fontSize: 28, color: "#475569", marginTop: 24 }}>
            Photographers · Models · MUAs · Stylists · Filmmakers
          </div>
        </div>
      </div>
    ),
    size,
  );
}
