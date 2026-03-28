import type { Metadata, Viewport } from "next";
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
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-studio-bg text-studio-fg min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
