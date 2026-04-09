import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Providers from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "VISION STUDIO — YEYESAYHELLO",
  description:
    "Avant-garde garment visualization system. Brutalist. Cinematic. Raw.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
        <body className="min-h-screen overflow-x-hidden flex flex-col bg-punk-halftone text-[#111111] antialiased lg:h-screen lg:w-screen lg:overflow-hidden" style={{ WebkitTapHighlightColor: "transparent" }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
