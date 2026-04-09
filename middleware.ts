import { withAuth } from "next-auth/middleware";

// ── Auth gate for studio, admin, onboarding ──────────────────────────────────
// Onboarding completion is enforced client-side (studio + login) so we do not
// call Rails from Edge middleware (token/env/availability vary by deploy).

export default withAuth({
  callbacks: {
    authorized: ({ token, req }) => {
      const { pathname } = req.nextUrl;

      if (pathname.startsWith("/login")) {
        return true;
      }

      if (
        pathname.startsWith("/studio") ||
        pathname.startsWith("/onboarding") ||
        pathname.startsWith("/admin")
      ) {
        return !!token;
      }

      return true;
    },
  },
});

export const config = {
  matcher: ["/studio/:path*", "/admin/:path*", "/onboarding/:path*", "/login"],
};
