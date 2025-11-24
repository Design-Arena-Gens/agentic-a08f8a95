import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Monocular Camera - Robot Dog",
  description: "In-browser monocular vision using OpenCV.js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

