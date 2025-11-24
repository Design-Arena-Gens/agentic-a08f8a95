/* eslint-disable @next/next/no-sync-scripts */
"use client";
import { useEffect, useState } from "react";

declare global {
  interface Window {
    cv?: any;
    __opencvLoaded?: boolean;
  }
}

export default function OpenCVLoader() {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.cv && window.__opencvLoaded) {
      setStatus("ready");
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>('script[data-opencv="true"]');
    if (existing) {
      const onReady = () => {
        window.__opencvLoaded = true;
        setStatus("ready");
      };
      if (window.cv) onReady();
      else existing.addEventListener("load", onReady, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.dataset["opencv"] = "true";
    script.src = "https://docs.opencv.org/4.x/opencv.js";
    script.onload = () => {
      // Wait until OpenCV's onRuntimeInitialized triggers
      const check = () => {
        if (window.cv && window.cv.Mat) {
          window.__opencvLoaded = true;
          setStatus("ready");
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    };
    script.onerror = () => setStatus("error");
    document.body.appendChild(script);
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, color: "#9bb4ca", fontSize: 12 }}>
      <span>OpenCV:</span>
      {status === "loading" && <span style={{ color: "#f0c36d" }}>loading?</span>}
      {status === "ready" && <span style={{ color: "#65d186" }}>ready</span>}
      {status === "error" && <span style={{ color: "#e58e8e" }}>failed to load</span>}
    </div>
  );
}

