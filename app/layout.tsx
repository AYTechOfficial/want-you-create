import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AdScope",
  description: "An on-demand, side-panel ad inspector for Chrome that gives developers and ad-operations teams a transparent, real-time enumeration of every ad slot and network firing on the current page.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
