import Cookies from "js-cookie";
import { getSession } from "next-auth/react";

/**
 * Gets the Rails JWT token from the most reliable source available.
 * Priority: 1) Cookies (for SSR/route protection), 2) localStorage (fallback), 3) NextAuth session
 */
export function getRailsToken(): string | null {
  // First try cookies (works in SSR and avoids race conditions)
  const fromCookie = Cookies.get("oops_jwt");
  if (fromCookie) return fromCookie;

  // Fallback to localStorage (client-side only)
  if (typeof window !== "undefined") {
    const fromStorage = localStorage.getItem("oops_jwt");
    if (fromStorage) return fromStorage;
  }
  return null;
}

/**
 * Gets Rails auth headers for API calls, checking cookies first
 */
export function getRailsAuthHeaders(): Record<string, string> {
  const token = getRailsToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Async version that can also check the NextAuth session as a last resort
 */
export async function getRailsTokenAsync(): Promise<string | null> {
  // Try synchronous methods first
  const syncToken = getRailsToken();
  if (syncToken) return syncToken;

  // Last resort: check NextAuth session (requires async)
  try {
    const session = await getSession();
    return session?.railsToken ?? null;
  } catch {
    return null;
  }
}

/**
 * Async version of auth headers
 */
export async function getRailsAuthHeadersAsync(): Promise<Record<string, string>> {
  const token = await getRailsTokenAsync();
  return token ? { Authorization: `Bearer ${token}` } : {};
}