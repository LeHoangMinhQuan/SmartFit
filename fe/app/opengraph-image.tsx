import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "SmartFit Store";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        background: "#f8fafc", // Tailwind slate-50 background
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "400px",
          height: "400px",
          borderRadius: "100px", // Scaled up rounded-xl
          background: "linear-gradient(to bottom right, #6366f1, #3b82f6)", // indigo-500 to blue-500
          color: "white",
          fontSize: "180px",
          fontWeight: "bold",
          boxShadow:
            "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)", // shadow-lg
        }}
      >
        SF
      </div>
    </div>,
    { ...size },
  );
}
