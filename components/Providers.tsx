"use client";

import { SessionProvider } from "next-auth/react";
import SessionSync from "./SessionSync";
import type { ReactNode } from "react";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <SessionSync />
      {children}
    </SessionProvider>
  );
}
