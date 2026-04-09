"use client";

import { useSession } from "next-auth/react";
import { useEffect } from "react";
import Cookies from "js-cookie";

/**
 * Invisible bridge: keeps both cookies["oops_jwt"] and localStorage["oops_jwt"] 
 * in sync with the NextAuth session's railsToken. Cookies fix race conditions
 * in route protection; localStorage maintains backward compatibility.
 */
export default function SessionSync() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") {
      // Clear both storage methods when not authenticated
      Cookies.remove("oops_jwt");
      localStorage.removeItem("oops_jwt");
      return;
    }

    if (session?.railsToken) {
      // Set cookie with 7-day expiry, secure in production, explicit root path
      Cookies.set("oops_jwt", session.railsToken, { 
        expires: 7,
        path: "/",
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax"
      });
      
      // Also keep localStorage for backward compatibility with existing studio code
      localStorage.setItem("oops_jwt", session.railsToken);
    } else {
      // Session exists but token is empty — clear stale values
      Cookies.remove("oops_jwt");
      localStorage.removeItem("oops_jwt");
    }
  }, [session?.railsToken, status]);

  return null;
}
