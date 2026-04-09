"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getRailsAuthHeaders } from "@/lib/auth-utils";

const RAILS_URL = process.env.NEXT_PUBLIC_RAILS_API_URL ?? "http://localhost:3001";

export default function RootPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const handleRedirect = async () => {
      if (status === "loading") return;

      if (!session) {
        router.push("/login");
        return;
      }

      // Check onboarding status for authenticated users
      setIsChecking(true);
      try {
        const authHeaders = getRailsAuthHeaders();
        const res = await fetch(`${RAILS_URL}/api/v1/me`, {
          headers: {
            ...authHeaders,
          },
        });

        if (res.ok) {
          const userData = await res.json();
          if (userData.onboarding_complete) {
            router.push("/studio");
          } else {
            router.push("/onboarding");
          }
        } else {
          console.warn(`Rails /api/v1/me returned ${res.status} - assuming new user`);
          // If Rails is down or returns an error, assume new user needs onboarding
          router.push("/onboarding");
        }
      } catch (error) {
        console.warn("Failed to check user status (Rails may be down):", error);
        // If we can't reach Rails at all, still let them proceed to onboarding
        router.push("/onboarding");
      } finally {
        setIsChecking(false);
      }
    };

    handleRedirect();
  }, [session, status, router]);

  if (status === "loading" || isChecking) {
    return (
      <div className="min-h-screen bg-punk-halftone flex items-center justify-center">
        <div className="text-center">
          <div className="border-4 border-[#111111] bg-white p-8">
            <p className="font-mono text-lg font-black tracking-[0.1em] text-[#111111]">
              OOPS // LOADING...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
