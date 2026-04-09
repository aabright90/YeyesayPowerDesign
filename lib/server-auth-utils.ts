import { NextRequest } from "next/server";

/**
 * Server-side utility to check for Rails JWT token in cookies
 * Useful for middleware and server components
 */
export function getRailsTokenFromRequest(request: NextRequest): string | null {
  return request.cookies.get("oops_jwt")?.value ?? null;
}

/**
 * Check if user has a valid Rails token in cookies (server-side)
 */
export function hasRailsToken(request: NextRequest): boolean {
  const token = getRailsTokenFromRequest(request);
  return !!token && token.length > 0;
}