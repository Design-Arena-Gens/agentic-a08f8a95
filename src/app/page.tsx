/* eslint-disable @next/next/no-img-element */
"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

const OpenCVLoader = dynamic(() => import("@/components/OpenCVLoader"), {
  ssr: false,
});
const CameraFeed = dynamic(() => import("@/components/CameraFeed"), {
  ssr: false,
});

type Mode =
  | "raw"
  | "grayscale"
  | "canny"
  | "corners"
  | "opticalflow";

export default function Page() {
  const [mode, setMode] = useState<Mode>("raw");
  const [intrinsicsJson, setIntrinsicsJson] = useState<string>("");

  const modes: Array<{ key: Mode; label: string }> = useMemo(
    () => [
      { key: "raw", label: "Raw" },
      { key: "grayscale", label: "Grayscale" },
      { key: "canny", label: "Canny" },
      { key: "corners", label: "Corners" },
      { key: "opticalflow", label: "Optical Flow" }
    ],
    []
  );

  return (
    <main style={{ minHeight: "100vh", display: "grid", gridTemplateRows: "auto 1fr", background: "#0b0f14", color: "#e6eef8" }}>
      <header style={{ padding: "16px 20px", borderBottom: "1px solid #14202b" }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Robot Dog Monocular Camera</h1>
        <p style={{ margin: "6px 0 0", color: "#9bb4ca" }}>In-browser OpenCV.js: edges, corners, optical flow. Load calibration for undistortion.</p>
      </header>
      <section style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16, padding: 16, alignItems: "start" }}>
        <aside style={{ background: "#0f1620", border: "1px solid #14202b", borderRadius: 8, padding: 12 }}>
          <h2 style={{ fontSize: 14, margin: "0 0 8px", color: "#bcd2e6" }}>Processing Mode</h2>
          <div style={{ display: "grid", gap: 8 }}>
            {modes.map((m) => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid #1c2a39",
                  background: mode === m.key ? "#1b2838" : "#0b111a",
                  color: "#e6eef8",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                {m.label}
              </button>
            ))}
          </div>

          <h2 style={{ fontSize: 14, margin: "16px 0 8px", color: "#bcd2e6" }}>Calibration (JSON)</h2>
          <textarea
            placeholder='{"fx":..., "fy":..., "cx":..., "cy":..., "k1":0,"k2":0,"p1":0,"p2":0,"k3":0}'
            value={intrinsicsJson}
            onChange={(e) => setIntrinsicsJson(e.target.value)}
            style={{
              width: "100%",
              minHeight: 140,
              borderRadius: 6,
              padding: 8,
              background: "#0b111a",
              color: "#e6eef8",
              border: "1px solid #1c2a39",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
              fontSize: 12
            }}
          />
          <p style={{ marginTop: 8, fontSize: 12, color: "#89a3ba" }}>
            Paste your camera intrinsics. Stored locally in browser for undistortion.
          </p>
        </aside>
        <div style={{ background: "#0f1620", border: "1px solid #14202b", borderRadius: 8, padding: 12 }}>
          <OpenCVLoader />
          <CameraFeed mode={mode} intrinsicsJson={intrinsicsJson} />
        </div>
      </section>
    </main>
  );
}

