import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

const RAILS_URL = process.env.RAILS_API_URL ?? "http://localhost:3001";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    CredentialsProvider({
      name: "Email & Password",
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const res = await fetch(`${RAILS_URL}/api/v1/users/sign_in`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user: {
                email:    credentials.email,
                password: credentials.password,
              },
            }),
          });

          if (!res.ok) return null;

          const data = await res.json() as { data?: { id: number; email: string } };
          const authHeader = res.headers.get("authorization") ?? "";
          const railsToken = authHeader.startsWith("Bearer ")
            ? authHeader.slice(7)
            : "";

          if (!data.data?.id) return null;

          return {
            id:         String(data.data.id),
            email:      data.data.email,
            railsToken,
          };
        } catch {
          return null;
        }
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      console.log("[NextAuth] signIn callback:", { provider: account?.provider, email: user.email });
      
      if (account?.provider !== "google") return true;

      try {
        console.log("[NextAuth] Calling Rails google_login:", `${RAILS_URL}/api/v1/auth/google_login`);
        
        const res = await fetch(`${RAILS_URL}/api/v1/auth/google_login`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profile: {
              email: user.email,
              name:  user.name,
              sub:   account.providerAccountId,
            },
          }),
        });

        console.log("[NextAuth] Rails response status:", res.status);

        if (res.ok) {
          const data = await res.json() as { token?: string };
          console.log("[NextAuth] Rails token received:", data.token ? "YES" : "NO");
          (user as { railsToken?: string }).railsToken = data.token ?? "";
        } else {
          const errorText = await res.text();
          console.error("[NextAuth] Rails error:", res.status, errorText);
        }
      } catch (error) {
        console.error("[NextAuth] Rails request failed:", error);
        // Rails offline — still allow login with an empty token
      }

      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        const railsToken = (user as { railsToken?: string }).railsToken ?? "";
        console.log("[NextAuth] JWT callback - storing token:", railsToken ? "YES" : "NO");
        token.railsToken = railsToken;
        token.userId     = user.id;
      }
      return token;
    },

    async session({ session, token }) {
      const railsToken = token.railsToken ?? "";
      console.log("[NextAuth] Session callback - token available:", railsToken ? "YES" : "NO");
      session.railsToken = railsToken;
      session.user.id    = token.userId ?? "";
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error:  "/login",
  },

  session: { strategy: "jwt" },

  secret: process.env.NEXTAUTH_SECRET,
};
