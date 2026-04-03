"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// DEV MODE: mock credential table — swap for Supabase auth when ready
const MOCK_USERS: Record<string, { password: string; destination: string }> = {
  user:  { password: "pass", destination: "/studio" },
  admin: { password: "pass", destination: "/admin"  },
};

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");

  const attempt = (requiredRole: "user" | "admin") => {
    setError("");
    const key   = username.trim().toLowerCase();
    const match = MOCK_USERS[key];

    if (!match || match.password !== password) {
      setError("WRONG SIGNAL. KEEP LOOKING.");
      return;
    }

    if (requiredRole === "admin" && key !== "admin") {
      setError("NOT AN ADMIN. USE THE YELLOW DOOR.");
      return;
    }

    router.push(match.destination);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-12 normal-case">

      {/* Faint paper watermark */}
      <p
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 flex select-none items-center justify-center px-8 text-center font-mono text-xs leading-loose tracking-widest text-[#111111]/[0.04]"
      >
        the world already has enough clothing — we take what exists and make it yours.
      </p>

      {/* ── Login Card ──────────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-md -rotate-1 border-4 border-[#111111] bg-white shadow-[12px_12px_0px_#111111]">

        {/* Yellow header block */}
        <div className="border-b-4 border-[#111111] bg-[#facc15] px-6 py-5">
          <h1 className="font-mono text-2xl font-black tracking-[0.14em] text-[#111111] sm:text-3xl">
            OOPS // STUDIO ACCESS
          </h1>
          <p className="mt-1.5 font-mono text-xs font-bold tracking-[0.18em] text-[#111111]/70">
            CLOTHING IS JUST WRAPPING. LOG IN TO BEGIN DECONSTRUCTION.
          </p>
        </div>

        {/* Form body */}
        <div className="flex flex-col gap-6 px-6 py-7">

          {/* Identity input */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-xs font-black tracking-[0.2em] text-[#111111]">
              IDENTITY [ USERNAME ]
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(""); }}
              placeholder="WHO ARE YOU"
              autoComplete="username"
              className="border-2 border-[#111111] bg-white px-4 py-3 font-mono text-sm tracking-[0.12em] text-[#111111] placeholder:text-[#111111]/20 focus:outline-none focus:border-[#111111] focus:shadow-[3px_3px_0_0_#111111] transition-shadow duration-75 normal-case"
            />
          </div>

          {/* Key input */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-xs font-black tracking-[0.2em] text-[#111111]">
              KEY [ PASSWORD ]
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              placeholder="THE SECRET KNOCK"
              autoComplete="current-password"
              className="border-2 border-[#111111] bg-white px-4 py-3 font-mono text-sm tracking-[0.12em] text-[#111111] placeholder:text-[#111111]/20 focus:outline-none focus:border-[#111111] focus:shadow-[3px_3px_0_0_#111111] transition-shadow duration-75 normal-case"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="border-2 border-[#dc2626] bg-[#dc2626]/5 px-4 py-3">
              <p className="font-mono text-xs font-black tracking-[0.15em] text-[#dc2626]">
                ⚠ {error}
              </p>
            </div>
          )}

          {/* Divider rule */}
          <div className="h-[3px] w-full bg-[#111111]" />

          {/* Client entry — big yellow */}
          <button
            type="button"
            onClick={() => attempt("user")}
            className="w-full border-4 border-[#111111] bg-[#facc15] px-6 py-5 font-mono text-base font-black tracking-[0.18em] text-[#111111] shadow-[6px_6px_0_0_#111111] transition-all duration-75 hover:bg-[#111111] hover:text-[#facc15] hover:shadow-[8px_8px_0_0_#facc15] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none sm:text-lg"
          >
            [ ENTER THE WORKSHOP ]
          </button>

          {/* Admin entry — red stamp */}
          <button
            type="button"
            onClick={() => attempt("admin")}
            className="w-full rotate-1 border-4 border-[#111111] bg-[#dc2626] px-6 py-4 font-mono text-sm font-black tracking-[0.18em] text-white shadow-[4px_4px_0_0_#111111] transition-all duration-75 hover:rotate-0 hover:bg-[#111111] hover:shadow-[6px_6px_0_0_#dc2626] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
          >
            [ INITIATE ADMIN OVERRIDE ]
          </button>

          {/* Dev footnote */}
          <p className="text-center font-mono text-[0.44rem] tracking-[0.16em] text-[#111111]/20">
            SUPABASE AUTH // PENDING INTEGRATION
          </p>
        </div>
      </div>

      {/* Footer */}
      <p className="relative z-10 mt-8 text-center font-mono text-[0.46rem] tracking-wider text-[#111111]/25">
        leave it better than you found it.
      </p>
    </div>
  );
}
