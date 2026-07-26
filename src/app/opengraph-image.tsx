import { ImageResponse } from "next/og";

export const alt = "Finance & Habit Tracker — your whole life, in one calm place";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#FFFFFF",
          padding: "72px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              width: "80px",
              height: "80px",
              borderRadius: "22px",
              background: "#012269",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontSize: "50px",
              fontWeight: 700,
            }}
          >
            F
          </div>
          <div
            style={{
              marginLeft: "20px",
              fontSize: "40px",
              fontWeight: 600,
              color: "#0c1a33",
            }}
          >
            Finance & Habit Tracker
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              width: "80px",
              height: "8px",
              borderRadius: "99px",
              background: "#017DFE",
              marginBottom: "28px",
            }}
          />
          <div
            style={{
              fontSize: "82px",
              fontWeight: 700,
              color: "#012269",
              lineHeight: 1.05,
              maxWidth: "980px",
            }}
          >
            Your whole life, in one calm place.
          </div>
        </div>

        <div style={{ display: "flex", fontSize: "32px", color: "#017DFE", fontWeight: 500 }}>
          Money · Habits · Mood · Tasks · Focus
        </div>
      </div>
    ),
    { ...size },
  );
}
