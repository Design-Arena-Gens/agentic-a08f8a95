/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { makeCameraMatrix, parseIntrinsics } from "@/lib/opencv";

type Props = {
  mode: "raw" | "grayscale" | "canny" | "corners" | "opticalflow";
  intrinsicsJson?: string;
};

declare global {
  interface Window {
    cv?: any;
  }
}

export default function CameraFeed({ mode, intrinsicsJson }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fps, setFps] = useState<number>(0);
  const rafRef = useRef<number | null>(null);

  // Optical flow state
  const ofPrevGrayRef = useRef<any | null>(null);
  const ofPrevPtsRef = useRef<any | null>(null);
  const ofTrackAgeRef = useRef<number>(0);

  const stopStream = useCallback(() => {
    const v = videoRef.current;
    if (v && v.srcObject) {
      (v.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      v.srcObject = null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    async function init() {
      setError(null);
      try {
        stopStream();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (!mounted) return;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (e) {
        setError("Camera access failed. Allow permissions and ensure a webcam is present.");
      }
    }
    init();
    return () => {
      mounted = false;
      stopStream();
    };
  }, [stopStream]);

  useEffect(() => {
    let lastTime = performance.now();
    let frames = 0;
    let lastFpsUpdate = lastTime;

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      const now = performance.now();
      frames++;
      if (now - lastFpsUpdate >= 500) {
        setFps(Math.round((frames * 1000) / (now - lastFpsUpdate)));
        frames = 0;
        lastFpsUpdate = now;
      }
      renderFrame();
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, intrinsicsJson]);

  const renderFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (!video.videoWidth || !video.videoHeight) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // If OpenCV is not ready, just draw raw frame
    const cv = window.cv;
    if (!cv || !cv.Mat) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return;
    }

    // Prepare Mats
    const src = new cv.Mat(video.videoHeight, video.videoWidth, cv.CV_8UC4);
    const frame = new cv.Mat(video.videoHeight, video.videoWidth, cv.CV_8UC4);
    const gray = new cv.Mat();
    const undist = new cv.Mat();
    try {
      // read frame to RGBA
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      src.data.set(imageData.data);

      let working = src;
      // Undistort if intrinsics provided
      const intr = parseIntrinsics(intrinsicsJson || localStorage.getItem("intrinsics") || "");
      if (intr) {
        const { K, dist } = makeCameraMatrix(cv, intr);
        cv.undistort(src, undist, K, dist);
        K.delete(); dist.delete();
        working = undist;
      }

      if (mode === "raw") {
        working.copyTo(frame);
      } else if (mode === "grayscale") {
        cv.cvtColor(working, gray, cv.COLOR_RGBA2GRAY);
        cv.cvtColor(gray, frame, cv.COLOR_GRAY2RGBA);
      } else if (mode === "canny") {
        cv.cvtColor(working, gray, cv.COLOR_RGBA2GRAY);
        cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 1.2, 1.2, cv.BORDER_DEFAULT);
        cv.Canny(gray, gray, 80, 150, 3, false);
        cv.cvtColor(gray, frame, cv.COLOR_GRAY2RGBA);
      } else if (mode === "corners") {
        cv.cvtColor(working, gray, cv.COLOR_RGBA2GRAY);
        const corners = new cv.Mat();
        const maxCorners = 500;
        const quality = 0.01;
        const minDist = 8;
        cv.goodFeaturesToTrack(gray, corners, maxCorners, quality, minDist);
        working.copyTo(frame);
        for (let i = 0; i < corners.rows; i++) {
          const x = corners.data32F[i * 2];
          const y = corners.data32F[i * 2 + 1];
          cv.circle(frame, new cv.Point(x, y), 3, new cv.Scalar(0, 255, 0, 255), -1);
        }
        corners.delete();
      } else if (mode === "opticalflow") {
        cv.cvtColor(working, gray, cv.COLOR_RGBA2GRAY);
        if (ofPrevGrayRef.current == null || ofTrackAgeRef.current > 12) {
          // re-seed features
          if (ofPrevGrayRef.current) ofPrevGrayRef.current.delete();
          if (ofPrevPtsRef.current) ofPrevPtsRef.current.delete();
          ofPrevGrayRef.current = gray.clone();
          const pts = new cv.Mat();
          cv.goodFeaturesToTrack(ofPrevGrayRef.current, pts, 800, 0.01, 8);
          ofPrevPtsRef.current = pts;
          ofTrackAgeRef.current = 0;
          working.copyTo(frame);
        } else {
          const nextPts = new cv.Mat();
          const status = new cv.Mat();
          const err = new cv.Mat();
          const term = new cv.TermCriteria(cv.TERM_CRITERIA_EPS | cv.TERM_CRITERIA_COUNT, 20, 0.03);
          cv.calcOpticalFlowPyrLK(
            ofPrevGrayRef.current,
            gray,
            ofPrevPtsRef.current,
            nextPts,
            status,
            err,
            new cv.Size(21, 21),
            3,
            term
          );
          working.copyTo(frame);
          // draw tracks
          for (let i = 0; i < status.rows; i++) {
            if (status.data[i] === 1) {
              const x0 = ofPrevPtsRef.current.data32F[i * 2];
              const y0 = ofPrevPtsRef.current.data32F[i * 2 + 1];
              const x1 = nextPts.data32F[i * 2];
              const y1 = nextPts.data32F[i * 2 + 1];
              cv.circle(frame, new cv.Point(x1, y1), 2, new cv.Scalar(0, 255, 0, 255), -1);
              cv.line(frame, new cv.Point(x0, y0), new cv.Point(x1, y1), new cv.Scalar(255, 200, 0, 255), 1);
            }
          }
          // prepare next
          ofPrevGrayRef.current.delete();
          ofPrevGrayRef.current = gray.clone();
          ofPrevPtsRef.current.delete();
          ofPrevPtsRef.current = nextPts;
          status.delete();
          err.delete();
          ofTrackAgeRef.current += 1;
        }
      }

      // draw to canvas
      const out = new ImageData(new Uint8ClampedArray(frame.data), frame.cols, frame.rows);
      ctx.putImageData(out, 0, 0);
    } catch {
      // ignore per-frame errors
    } finally {
      src.delete();
      frame.delete();
      gray.delete();
      undist.delete();
    }
  };

  useEffect(() => {
    // persist intrinsics locally if valid
    const intr = parseIntrinsics(intrinsicsJson || "");
    if (intr) {
      localStorage.setItem("intrinsics", JSON.stringify(intr));
    }
  }, [intrinsicsJson]);

  useEffect(() => {
    return () => {
      if (ofPrevGrayRef.current) ofPrevGrayRef.current.delete();
      if (ofPrevPtsRef.current) ofPrevPtsRef.current.delete();
    };
  }, []);

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 12, color: "#9bb4ca" }}>
          Mode: <strong style={{ color: "#e6eef8", textTransform: "capitalize" }}>{mode}</strong>
        </span>
        <span style={{ fontSize: 12, color: "#9bb4ca" }}>
          FPS: <strong style={{ color: "#e6eef8" }}>{fps}</strong>
        </span>
      </div>
      <div style={{ position: "relative", width: "100%", maxWidth: 1280 }}>
        <video
          ref={videoRef}
          playsInline
          muted
          style={{ display: "none" }}
        />
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "auto", border: "1px solid #1c2a39", background: "#000" }}
        />
      </div>
      {error && <div style={{ color: "#e58e8e", fontSize: 12 }}>{error}</div>}
    </div>
  );
}

