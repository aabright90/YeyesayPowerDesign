"use client";

import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";
import Cookies from "js-cookie";

type CardState = "login" | "signup";
type LoadingState = "idle" | "google" | "email" | "register";

const RAILS_URL = process.env.NEXT_PUBLIC_RAILS_API_URL ?? "http://localhost:3001";

export default function LoginPage() {
  const router = useRouter();

  const [card,     setCard]     = useState<CardState>("login");
  const [loading,  setLoading]  = useState<LoadingState>("idle");
  const [error,    setError]    = useState("");

  // ── Login fields ──────────────────────────────────────────────────────────
  const [loginEmail,    setLoginEmail]    = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // ── Sign-up fields ────────────────────────────────────────────────────────
  const [signupUsername,        setSignupUsername]        = useState("");
  const [signupEmail,           setSignupEmail]           = useState("");
  const [signupPassword,        setSignupPassword]        = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");

  const busy = loading !== "idle";

  const resetError = () => setError("");

  // ── Ensure Rails JWT reaches localStorage before any redirect ─────────
  //
  // THE BUG:
  //   signIn() resolves → NextAuth session updates internally → but
  //   SessionSync (a React component) hasn't re-rendered yet → so
  //   localStorage["oops_jwt"] is still empty when we call getSession()
  //   or when the next page mounts and tries railsAuthHeader().
  //
  // THE FIX:
  //   After signIn succeeds, we explicitly call getSession() to get the
  //   freshest token, write it to localStorage ourselves (same key
  //   SessionSync uses), and THEN redirect. This guarantees the token
  //   is in place before /onboarding or /studio ever reads it.

  const ensureTokenStored = async (): Promise<string | null> => {
    const freshSession = await getSession();
    const token = freshSession?.railsToken ?? null;
    if (token) {
      // CRITICAL: Set cookie first for immediate route protection access
      Cookies.set("oops_jwt", token, { 
        expires: 7,
        path: "/",
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax"
      });
      
      // Also set localStorage for backward compatibility
      localStorage.setItem("oops_jwt", token);
    }
    return token;
  };

  const checkOnboardingStatus = async () => {
    try {
      const token = await ensureTokenStored();

      if (!token) {
        // No Rails token at all — still let them in, onboarding will
        // show a clear "no API token" message if Rails calls fail.
        setTimeout(() => {
          router.push("/onboarding");
        }, 100);
        return;
      }

      const res = await fetch(`${RAILS_URL}/api/v1/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const userData = await res.json();
        setTimeout(() => {
          router.push(userData.onboarding_complete ? "/studio" : "/onboarding");
        }, 100);
      } else {
        setTimeout(() => {
          router.push("/onboarding");
        }, 100);
      }
    } catch (error) {
      console.error("Failed to check onboarding status:", error);
      setTimeout(() => {
        router.push("/onboarding");
      }, 100);
    }
  };

  // ── Google OAuth ──────────────────────────────────────────────────────────
  const handleGoogle = async () => {
    resetError();
    setLoading("google");
    
    const result = await signIn("google", { redirect: false });
    
    if (result?.error) {
      setError("GOOGLE SIGN-IN FAILED — TRY AGAIN.");
    } else {
      await checkOnboardingStatus();
    }
    
    setLoading("idle");
  };

  // ── Email / Password login ────────────────────────────────────────────────
  const handleEmailLogin = async (e: FormEvent) => {
    e.preventDefault();
    resetError();
    if (!loginEmail.trim() || !loginPassword) {
      setError("FILL IN BOTH FIELDS.");
      return;
    }
    setLoading("email");

    const result = await signIn("credentials", {
      email:    loginEmail.trim().toLowerCase(),
      password: loginPassword,
      redirect: false,
    });

    setLoading("idle");

    if (result?.error) {
      setError("WRONG SIGNAL — CHECK YOUR CREDENTIALS.");
    } else {
      // Check onboarding status before redirecting
      await checkOnboardingStatus();
    }
  };

  // ── Sign Up (registers via Rails, then logs in) ───────────────────────────
  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    resetError();

    if (!signupUsername.trim()) { setError("IDENTITY REQUIRED."); return; }
    if (!signupEmail.trim())    { setError("EMAIL REQUIRED.");    return; }
    if (signupPassword.length < 6) {
      setError("KEY MUST BE AT LEAST 6 CHARACTERS.");
      return;
    }
    if (signupPassword !== signupConfirmPassword) {
      setError("KEYS DO NOT MATCH.");
      return;
    }

    setLoading("register");

    try {
      const res = await fetch(`${RAILS_URL}/api/v1/users`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: {
            email:                 signupEmail.trim().toLowerCase(),
            password:              signupPassword,
            password_confirmation: signupConfirmPassword,
          },
        }),
      });

      const data = await res.json() as { message?: string; errors?: string[] };

      if (!res.ok) {
        setLoading("idle");
        setError(data.errors?.[0] ?? data.message ?? "REGISTRATION FAILED.");
        return;
      }

      // Auto-login after successful registration
      const loginResult = await signIn("credentials", {
        email:    signupEmail.trim().toLowerCase(),
        password: signupPassword,
        redirect: false,
      });

      setLoading("idle");

      if (loginResult?.error) {
        setError("REGISTERED — BUT AUTO-LOGIN FAILED. TRY SIGNING IN.");
        setCard("login");
      } else {
        // Check onboarding status for new users
        await checkOnboardingStatus();
      }
    } catch {
      setLoading("idle");
      setError("NETWORK ERROR — IS THE SERVER RUNNING?");
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-3 py-6 normal-case overflow-hidden sm:px-4 sm:py-0 sm:h-screen sm:min-h-0">

      {/* Faint paper watermark */}
      <p
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 flex select-none items-center justify-center px-8 text-center font-mono text-xs leading-loose tracking-widest text-[#111111]/[0.04]"
      >
        the world already has enough clothing — we take what exists and make it yours.
      </p>

      {/* ── Main Card ─────────────────────────────────────────────────────────
          flex flex-col + max-h-[90vh] keeps the card inside the viewport.
          overflow-hidden clips the shadow so the brutalist border stays intact.
      ──────────────────────────────────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-sm rotate-0 border-4 border-[#111111] bg-white shadow-[6px_6px_0px_#111111] flex flex-col max-h-[85vh] sm:-rotate-1 sm:max-w-sm sm:shadow-[8px_8px_0px_#111111] sm:max-h-[90vh]">

        {/* ── Tabs — pinned, never scrolls ── */}
        <div className="flex flex-shrink-0 border-b-4 border-[#111111]">
          <button
            type="button"
            onClick={() => { setCard("login"); resetError(); }}
            className={`flex-1 border-r-4 border-[#111111] px-3 py-2.5 font-mono text-[0.65rem] font-black tracking-[0.14em] transition-colors duration-75 ${
              card === "login"
                ? "bg-[#facc15] text-[#111111]"
                : "bg-white text-[#111111]/40 hover:bg-[#f4f4f0] hover:text-[#111111]"
            }`}
          >
            [ SIGN IN ]
          </button>
          <button
            type="button"
            onClick={() => { setCard("signup"); resetError(); }}
            className={`flex-1 px-3 py-2.5 font-mono text-[0.65rem] font-black tracking-[0.14em] transition-colors duration-75 ${
              card === "signup"
                ? "bg-[#111111] text-[#facc15]"
                : "bg-white text-[#111111]/40 hover:bg-[#f4f4f0] hover:text-[#111111]"
            }`}
          >
            [ CREATE ACCOUNT ]
          </button>
        </div>

        {/* ── Brand header — pinned, never scrolls ── */}
        <div className="flex-shrink-0 border-b-4 border-[#111111] bg-[#facc15] px-5 py-3">
          <h1 className="font-mono text-base font-black tracking-[0.12em] text-[#111111]">
            OOPS // {card === "login" ? "STUDIO ACCESS" : "JOIN THE CIRCLE"}
          </h1>
          <p className="mt-0.5 font-mono text-[0.58rem] font-bold tracking-[0.1em] text-[#111111]/70">
            {card === "login"
              ? "CLOTHING IS JUST WRAPPING. LOG IN TO BEGIN."
              : "REAL BEAUTY BEGINS FROM WITHIN. START HERE."}
          </p>
        </div>

        {/* ═══════════════════════════════════════
            LOGIN FORM
        ═══════════════════════════════════════ */}
        {card === "login" && (
          <form onSubmit={handleEmailLogin} className="flex flex-col flex-1 min-h-0 overflow-hidden">

            {/* Scrollable field area */}
            <div
              className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 px-5 pt-5 pb-3"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {/* Google button */}
              <button
                type="button"
                onClick={handleGoogle}
                disabled={busy}
                className="w-full border-4 border-[#111111] bg-white px-4 py-2.5 font-mono text-xs font-black tracking-[0.14em] text-[#111111] shadow-[4px_4px_0_0_#111111] transition-all duration-75 hover:bg-[#facc15] hover:shadow-[6px_6px_0_0_#111111] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="flex items-center justify-center gap-3">
                  <GoogleIcon />
                  {loading === "google" ? "CONNECTING TO GOOGLE..." : "[ ACCESS VIA GOOGLE ]"}
                </span>
              </button>

              {/* OR divider */}
              <div className="flex items-center gap-3">
                <div className="h-[3px] flex-1 bg-[#111111]" />
                <span className="font-mono text-[0.6rem] font-black tracking-[0.2em] text-[#111111]/40">OR</span>
                <div className="h-[3px] flex-1 bg-[#111111]" />
              </div>

              {/* Email */}
              <div className="flex flex-col gap-1">
                <label className="font-mono text-[0.65rem] font-black tracking-[0.18em] text-[#111111]">EMAIL</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => { setLoginEmail(e.target.value); resetError(); }}
                  placeholder="YOUR EMAIL ADDRESS"
                  autoComplete="email"
                  disabled={busy}
                  className="border-2 border-[#111111] bg-white px-3 py-2 font-mono text-xs tracking-[0.08em] text-[#111111] placeholder:normal-case placeholder:text-[#111111]/20 focus:bg-[#facc15]/20 focus:outline-none focus:shadow-[3px_3px_0_0_#111111] transition-shadow duration-75 disabled:opacity-50 normal-case"
                />
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1">
                <label className="font-mono text-[0.65rem] font-black tracking-[0.18em] text-[#111111]">KEY [ PASSWORD ]</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => { setLoginPassword(e.target.value); resetError(); }}
                  placeholder="THE SECRET KNOCK"
                  autoComplete="current-password"
                  disabled={busy}
                  className="border-2 border-[#111111] bg-white px-3 py-2 font-mono text-xs tracking-[0.08em] text-[#111111] placeholder:normal-case placeholder:text-[#111111]/20 focus:bg-[#facc15]/20 focus:outline-none focus:shadow-[3px_3px_0_0_#111111] transition-shadow duration-75 disabled:opacity-50 normal-case"
                />
              </div>

              {error && <ErrorBanner message={error} />}
            </div>

            {/* Pinned footer — submit always visible */}
            <div className="flex-shrink-0 flex flex-col gap-3 px-5 pt-3 pb-5 border-t-4 border-[#111111]">
              <button
                type="submit"
                disabled={busy}
                className="-rotate-1 w-full border-4 border-[#111111] bg-[#facc15] px-4 py-3 font-mono text-xs font-black tracking-[0.18em] text-[#111111] shadow-[6px_6px_0_0_#111111] transition-all duration-75 hover:rotate-0 hover:bg-[#111111] hover:text-[#facc15] hover:shadow-[8px_8px_0_0_#facc15] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading === "email" ? "VERIFYING..." : "[ ENTER THE WORKSHOP ]"}
              </button>
              <button
                type="button"
                onClick={() => { setCard("signup"); resetError(); }}
                className="font-mono text-[0.6rem] tracking-[0.14em] text-[#111111]/40 underline hover:text-[#111111] transition-colors"
              >
                NO ACCOUNT YET? CREATE ONE →
              </button>
            </div>
          </form>
        )}

        {/* ═══════════════════════════════════════
            SIGN-UP FORM
        ═══════════════════════════════════════ */}
        {card === "signup" && (
          <form onSubmit={handleSignUp} className="flex flex-col flex-1 min-h-0 overflow-hidden">

            {/* Scrollable field area — hides scrollbar for clean aesthetic */}
            <div
              className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 px-5 pt-4 pb-3"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {/* Google button */}
              <button
                type="button"
                onClick={handleGoogle}
                disabled={busy}
                className="w-full border-4 border-[#111111] bg-white px-4 py-2.5 font-mono text-xs font-black tracking-[0.14em] text-[#111111] shadow-[4px_4px_0_0_#111111] transition-all duration-75 hover:bg-[#facc15] hover:shadow-[6px_6px_0_0_#111111] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="flex items-center justify-center gap-3">
                  <GoogleIcon />
                  {loading === "google" ? "CONNECTING TO GOOGLE..." : "[ SIGN UP VIA GOOGLE ]"}
                </span>
              </button>

              {/* OR divider */}
              <div className="flex items-center gap-3">
                <div className="h-[3px] flex-1 bg-[#111111]" />
                <span className="font-mono text-[0.6rem] font-black tracking-[0.2em] text-[#111111]/40">OR</span>
                <div className="h-[3px] flex-1 bg-[#111111]" />
              </div>

              {/* Username */}
              <div className="flex flex-col gap-1">
                <label className="font-mono text-[0.65rem] font-black tracking-[0.18em] text-[#111111]">USERNAME</label>
                <input
                  type="text"
                  value={signupUsername}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => { setSignupUsername(e.target.value); resetError(); }}
                  placeholder="WHAT DO WE CALL YOU"
                  autoComplete="username"
                  disabled={busy}
                  className="border-2 border-[#111111] bg-white px-3 py-2 font-mono text-xs tracking-[0.08em] text-[#111111] placeholder:normal-case placeholder:text-[#111111]/20 focus:bg-[#facc15]/20 focus:outline-none focus:shadow-[3px_3px_0_0_#111111] transition-shadow duration-75 disabled:opacity-50 normal-case"
                />
              </div>

              {/* Email */}
              <div className="flex flex-col gap-1">
                <label className="font-mono text-[0.65rem] font-black tracking-[0.18em] text-[#111111]">EMAIL</label>
                <input
                  type="email"
                  value={signupEmail}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => { setSignupEmail(e.target.value); resetError(); }}
                  placeholder="YOUR EMAIL ADDRESS"
                  autoComplete="email"
                  disabled={busy}
                  className="border-2 border-[#111111] bg-white px-3 py-2 font-mono text-xs tracking-[0.08em] text-[#111111] placeholder:normal-case placeholder:text-[#111111]/20 focus:bg-[#facc15]/20 focus:outline-none focus:shadow-[3px_3px_0_0_#111111] transition-shadow duration-75 disabled:opacity-50 normal-case"
                />
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1">
                <label className="font-mono text-[0.65rem] font-black tracking-[0.18em] text-[#111111]">KEY [ PASSWORD ]</label>
                <input
                  type="password"
                  value={signupPassword}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => { setSignupPassword(e.target.value); resetError(); }}
                  placeholder="MINIMUM 6 CHARACTERS"
                  autoComplete="new-password"
                  disabled={busy}
                  className="border-2 border-[#111111] bg-white px-3 py-2 font-mono text-xs tracking-[0.08em] text-[#111111] placeholder:normal-case placeholder:text-[#111111]/20 focus:bg-[#facc15]/20 focus:outline-none focus:shadow-[3px_3px_0_0_#111111] transition-shadow duration-75 disabled:opacity-50 normal-case"
                />
              </div>

              {/* Confirm Password */}
              <div className="flex flex-col gap-1">
                <label className="font-mono text-[0.65rem] font-black tracking-[0.18em] text-[#111111]">CONFIRM KEY</label>
                <input
                  type="password"
                  value={signupConfirmPassword}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => { setSignupConfirmPassword(e.target.value); resetError(); }}
                  placeholder="REPEAT THE SECRET KNOCK"
                  autoComplete="new-password"
                  disabled={busy}
                  className="border-2 border-[#111111] bg-white px-3 py-2 font-mono text-xs tracking-[0.08em] text-[#111111] placeholder:normal-case placeholder:text-[#111111]/20 focus:bg-[#facc15]/20 focus:outline-none focus:shadow-[3px_3px_0_0_#111111] transition-shadow duration-75 disabled:opacity-50 normal-case"
                />
              </div>

              {/* Key match indicator */}
              {signupConfirmPassword && (
                <p className={`font-mono text-[0.6rem] tracking-[0.12em] ${
                  signupPassword === signupConfirmPassword ? "text-[#16a34a]" : "text-[#dc2626]"
                }`}>
                  {signupPassword === signupConfirmPassword ? "✓ KEYS MATCH" : "✗ KEYS DO NOT MATCH"}
                </p>
              )}

              {error && <ErrorBanner message={error} />}
            </div>

            {/* Pinned footer — submit always visible */}
            <div className="flex-shrink-0 flex flex-col gap-3 px-5 pt-3 pb-5 border-t-4 border-[#111111]">
              <button
                type="submit"
                disabled={busy}
                className="rotate-1 w-full border-4 border-[#111111] bg-[#111111] px-4 py-3 font-mono text-xs font-black tracking-[0.18em] text-[#facc15] shadow-[6px_6px_0_0_#facc15] transition-all duration-75 hover:rotate-0 hover:bg-[#facc15] hover:text-[#111111] hover:shadow-[8px_8px_0_0_#111111] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading === "register" ? "CREATING ACCOUNT..." : "[ JOIN THE CIRCLE ]"}
              </button>
              <button
                type="button"
                onClick={() => { setCard("login"); resetError(); }}
                className="font-mono text-[0.6rem] tracking-[0.14em] text-[#111111]/40 underline hover:text-[#111111] transition-colors"
              >
                ← ALREADY HAVE AN ACCOUNT? SIGN IN
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="border-2 border-[#dc2626] bg-[#dc2626]/5 px-4 py-3">
      <p className="font-mono text-xs font-black tracking-[0.15em] text-[#dc2626]">
        ⚠ {message}
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" fill="none">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  );
}
