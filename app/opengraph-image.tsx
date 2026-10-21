import { ImageResponse } from "next/og";

// The preview card for links shared in iMessage, Instagram and Slack:
// flat paper, ink type, the logo.
export const alt = "Melange: where creative people find their next collaboration";
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
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px 96px",
          background: "#FAFAF7",
          color: "#16161A",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <svg width="96" height="96" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="46" fill="#E0F2FE" stroke="#1E40AF" strokeWidth="2" />
            <path
              d="M50 10C55 25 75 40 90 50C75 60 55 75 50 90C45 75 25 60 10 50C25 40 45 25 50 10Z"
              fill="#BFDBFE"
              stroke="#1E40AF"
              strokeWidth="2"
            />
            <circle cx="50" cy="50" r="10" fill="#4C1D95" />
          </svg>
          <div style={{ fontSize: 56, fontWeight: 700, letterSpacing: -1 }}>Melange</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 980 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>
            Where creative people find their next collaboration.
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 28,
              color: "#5C5C63",
              marginTop: 32,
              paddingTop: 24,
              borderTop: "2px solid #16161A",
            }}
          >
            Invite-only · USC · UCSD · LA · free on iPhone
          </div>
        </div>
      </div>
    ),
    size,
  );
}
