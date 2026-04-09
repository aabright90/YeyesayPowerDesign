import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    /** Rails JWT — stored in localStorage as oops_jwt for API calls */
    railsToken: string;
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  interface User {
    railsToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    railsToken?: string;
    userId?: string;
  }
}
