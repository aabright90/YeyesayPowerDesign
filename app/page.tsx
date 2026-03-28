"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Phase = "idle" | "parsing" | "result" | "error";
type FaultKind = "unauthorized" | "corrupt";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_DIM = 1024;
const JPEG_Q  = 0.7;

const SCAN_MESSAGES = [
  "PARSING GEOMETRY...",
  "MAPPING SILHOUETTE NODES...",
  "ANALYZING SEAM ARCHITECTURE...",
  "DECODING STRUCTURAL LOGIC...",
  "READING SPATIAL SIGNATURE...",
  "EXTRACTING FABRIC TOPOLOGY...",
  "ISOLATING FORM VECTORS...",
  "PROCESSING RAW SURFACE DATA...",
];

// ─── Canvas compression ───────────────────────────────────────────────────────

function compressToJpeg(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let w = img.naturalWidth;
      let h = img.naturalHeight;

      if (w === 0 || h === 0) {
        reject(new Error("IMAGE HAS ZERO DIMENSIONS. TRY ANOTHER FILE."));
        return;
      }

      if (w > MAX_DIM || h > MAX_DIM) {
        if (w >= h) { h = Math.round((h * MAX_DIM) / w); w = MAX_DIM; }
        else        { w = Math.round((w * MAX_DIM) / h); h = MAX_DIM; }
      }

      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("CANVAS UNAVAILABLE.")); return; }

      ctx.drawImage(img, 0, 0, w, h);

      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_Q);
      const comma   = dataUrl.indexOf(",");

      if (comma === -1) { reject(new Error("CANVAS ENCODING FAILED — NO PAYLOAD.")); return; }

      const raw = dataUrl.slice(comma + 1).replace(/\s/g, "");

      if (!/^[A-Za-z0-9+/]+=*$/.test(raw) || raw.length < 16) {
        reject(new Error("CANVAS ENCODING FAILED — INVALID BASE64.")); return;
      }

      resolve(raw);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("IMAGE LOAD FAILED. FILE MAY BE CORRUPT."));
    };

    img.src = objectUrl;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Home() {
  const [file, setFile]               = useState<File | null>(null);
  const [phase, setPhase]             = useState<Phase>("idle");
  const [analysis, setAnalysis]       = useState<string>("");
  const [apiError, setApiError]       = useState<string>("");
  const [faultKind, setFaultKind]     = useState<FaultKind | null>(null);
  const [noFile, setNoFile]           = useState(false);
  const [scanIdx, setScanIdx]         = useState(0);
  const [mutationSeed, setMutationSeed] = useState<number>(() => Math.random());
  const [imgLoading, setImgLoading]   = useState(true);
  const [imgError, setImgError]       = useState(false);

  const scanInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup on unmount
  useEffect(() => () => {
    if (scanInterval.current) clearInterval(scanInterval.current);
  }, []);

  // Cycle scan messages while parsing
  useEffect(() => {
    if (phase === "parsing") {
      setScanIdx(0);
      scanInterval.current = setInterval(
        () => setScanIdx(i => (i + 1) % SCAN_MESSAGES.length),
        750
      );
    } else {
      if (scanInterval.current) { clearInterval(scanInterval.current); scanInterval.current = null; }
    }
    return () => {
      if (scanInterval.current) { clearInterval(scanInterval.current); scanInterval.current = null; }
    };
  }, [phase]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null;
    setFile(picked);
    setNoFile(false);
    setApiError("");
    setFaultKind(null);
    if (phase === "error") setPhase("idle");
  };

  const handleReset = () => {
    setFile(null);
    setPhase("idle");
    setAnalysis("");
    setApiError("");
    setFaultKind(null);
    setNoFile(false);
    setMutationSeed(Math.random());
    setImgLoading(true);
    setImgError(false);
  };

  const handleMutate = useCallback(() => {
    setMutationSeed(Math.random());
    setImgLoading(true);
    setImgError(false);
  }, []);

  const handleVisualize = async () => {
    if (phase === "parsing") return;
    if (!file) { setNoFile(true); return; }

    setNoFile(false);
    setApiError("");
    setFaultKind(null);
    setPhase("parsing");

    try {
      const base64 = await compressToJpeg(file);

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData: base64, mimeType: "image/jpeg" }),
      });

      let json: { analysis?: string; error?: string; code?: string; detail?: string };
      try {
        json = (await res.json()) as typeof json;
      } catch {
        setFaultKind("corrupt");
        setApiError("GEOMETRY CORRUPTED");
        setPhase("error");
        return;
      }

      const isKeyMissing =
        res.status === 503 ||
        json.code === "API_KEY_MISSING" ||
        json.error === "API_KEY_MISSING";

      if (!res.ok || json.error) {
        if (isKeyMissing) {
          setFaultKind("unauthorized");
          setApiError("");
        } else {
          setFaultKind("corrupt");
          setApiError(
            (json.detail?.trim()) ||
            (typeof json.error === "string" ? json.error : "") ||
            "GEOMETRY CORRUPTED"
          );
        }
        setPhase("error");
        return;
      }

      setAnalysis(json.analysis ?? "");
      setMutationSeed(Math.random());
      setImgLoading(true);
      setImgError(false);
      setPhase("result");
    } catch (err: unknown) {
      setFaultKind("corrupt");
      setApiError(err instanceof Error ? err.message : "UNKNOWN FAILURE.");
      setPhase("error");
    }
  };

  const isLocked = phase === "parsing";

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="relative flex min-h-screen flex-col bg-[#050505] px-5 py-6 text-[#e5e5e5] sm:px-8 sm:py-10">

      {/* Watermark */}
      <p
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 flex select-none items-center justify-center px-8 text-center font-mono text-[0.6rem] normal-case leading-loose tracking-widest text-[#e5e5e5]/[0.055] sm:text-xs"
      >
        Artistic creation demands of the artist that he perish utterly.
      </p>

      {/* ── Header */}
      <header className="relative z-10">
        <div className="mb-1 flex items-center gap-3">
          <span className="h-px flex-1 bg-[#e5e5e5]/10" />
          <span className="font-mono text-[0.55rem] tracking-[0.3em] text-[#e5e5e5]/30 sm:text-[0.6rem]">
            SYS // ONLINE
          </span>
        </div>
        <h1 className="font-mono text-sm font-bold tracking-[0.14em] text-[#e5e5e5] sm:text-base sm:tracking-[0.18em]">
          YeyesayPowerDesign // V1
        </h1>
        <div className="mt-3 h-px w-full bg-gradient-to-r from-[#e5e5e5]/20 via-[#e5e5e5]/8 to-transparent" />
      </header>

      {/* ── Main */}
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-stretch justify-center gap-5 py-12 sm:gap-6">

        {/* Corner brackets */}
        <div className="pointer-events-none absolute -inset-1 hidden sm:block">
          <span className="absolute left-0 top-0 h-6 w-6 border-l border-t border-[#e5e5e5]/10" />
          <span className="absolute right-0 top-0 h-6 w-6 border-r border-t border-[#e5e5e5]/10" />
          <span className="absolute bottom-0 left-0 h-6 w-6 border-b border-l border-[#e5e5e5]/10" />
          <span className="absolute bottom-0 right-0 h-6 w-6 border-b border-r border-[#e5e5e5]/10" />
        </div>

        {/* ── UPLOAD — hidden when result is showing */}
        {phase !== "result" && (
          <div className="flex flex-col gap-2">
            <label
              className={`group relative block overflow-hidden border bg-[#0a0a0a] transition-all duration-300 active:scale-[0.99] ${
                isLocked
                  ? "cursor-not-allowed border-[#1a1a1a] opacity-40"
                  : "cursor-pointer border-[#2c2c2c] hover:border-[#e5e5e5]/35 hover:bg-[#0f0f0f]"
              }`}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-[#e5e5e5]/6 to-transparent transition-transform duration-700 group-hover:translate-x-full"
              />
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={isLocked}
                onChange={handleFileChange}
              />
              <span className="relative flex flex-col items-center gap-1.5 px-6 py-5 text-center sm:py-6">
                <span className="font-mono text-xs tracking-[0.22em] text-[#e5e5e5] sm:text-sm sm:tracking-[0.26em]">
                  UPLOAD GARMENT
                </span>
                <span className="font-mono text-[0.55rem] tracking-[0.15em] text-[#e5e5e5]/35 sm:text-[0.6rem]">
                  {file ? `✓ ${file.name}` : "ANY FORMAT — COMPRESSED CLIENT-SIDE"}
                </span>
              </span>
            </label>

            {file && (
              <p className="text-center font-mono text-[0.5rem] tracking-[0.15em] text-[#e5e5e5]/20 sm:text-[0.55rem]">
                {(file.size / 1048576).toFixed(2)} MB RAW — WILL BE COMPRESSED
              </p>
            )}
          </div>
        )}

        {/* No-file warning */}
        {noFile && (
          <p className="animate-pulse text-center font-mono text-[0.6rem] tracking-[0.15em] text-red-400 sm:text-xs">
            ⚠ NO FILE DETECTED — UPLOAD GARMENT FIRST
          </p>
        )}

        {/* ── ERROR */}
        {phase === "error" && (
          <div className="border border-red-900/50 bg-[#0a0303] px-4 py-4">
            <p className="mb-1 font-mono text-[0.5rem] tracking-[0.25em] text-red-400/50 sm:text-[0.55rem]">
              ENGINE FAULT // ERR
            </p>
            <p className="font-mono text-xs tracking-[0.12em] text-red-400 sm:text-sm">
              {faultKind === "unauthorized"
                ? "ENGINE FAULT // UNAUTHORIZED"
                : "GEOMETRY CORRUPTED"}
            </p>
            {faultKind === "corrupt" && apiError && (
              <p className="mt-2 font-mono text-[0.55rem] normal-case leading-relaxed tracking-wider text-red-400/60 sm:text-[0.6rem]">
                {apiError}
              </p>
            )}
          </div>
        )}

        {/* ── CINEMATIC PARSING PANEL */}
        {phase === "parsing" && (
          <div className="relative overflow-hidden border border-[#e5e5e5]/8 bg-[#060606]">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#e5e5e5]/25 to-transparent"
              style={{ animation: "scan 1.6s ease-in-out infinite" }}
            />
            <div className="flex flex-col gap-3.5 px-5 py-5 sm:px-6 sm:py-6">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[0.5rem] tracking-[0.28em] text-[#e5e5e5]/25 sm:text-[0.55rem]">
                  VISION ENGINE // ACTIVE
                </span>
                <span className="font-mono text-[0.5rem] tracking-[0.18em] text-[#e5e5e5]/18 sm:text-[0.55rem]">
                  JPEG · {MAX_DIM}px · Q{JPEG_Q * 100 | 0}
                </span>
              </div>
              <p className="min-h-[1.25rem] font-mono text-xs tracking-[0.2em] text-[#e5e5e5]/80 sm:text-sm">
                <span className="mr-2.5 inline-block h-1.5 w-1.5 animate-ping rounded-full bg-[#e5e5e5]/70 align-middle" />
                {SCAN_MESSAGES[scanIdx]}
              </p>
              {["SILHOUETTE_AXIS", "SEAM_TOPOLOGY", "FORM_GEOMETRY"].map((label, i) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="shrink-0 font-mono text-[0.48rem] tracking-[0.13em] text-[#e5e5e5]/18 sm:text-[0.52rem]">
                    {label}
                  </span>
                  <span
                    className="h-px flex-1"
                    style={{
                      background: `linear-gradient(90deg,transparent,rgba(229,229,229,${0.12 + i * 0.04}),transparent)`,
                      animation: `scan ${1.1 + i * 0.35}s ease-in-out infinite`,
                    }}
                  />
                  <span className="font-mono text-[0.48rem] text-[#e5e5e5]/12 sm:text-[0.52rem]">──</span>
                </div>
              ))}
              <div className="h-px w-full overflow-hidden bg-[#141414]">
                <div
                  className="h-full w-1/2 bg-gradient-to-r from-transparent via-[#e5e5e5]/28 to-transparent"
                  style={{ animation: "scan 1.8s ease-in-out infinite" }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── PERMANENT ANALYSIS RESULT */}
        {phase === "result" && analysis && (
          <div className="relative overflow-hidden border border-[#e5e5e5]/12 bg-[#080808]">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#e5e5e5]/10 to-transparent"
            />
            <div className="px-5 py-6 sm:px-6 sm:py-7">
              <div className="mb-4 flex items-center justify-between">
                <p className="font-mono text-[0.5rem] tracking-[0.25em] text-[#e5e5e5]/28 sm:text-[0.55rem]">
                  VISION ENGINE // ANALYSIS OUTPUT
                </p>
                <p className="font-mono text-[0.5rem] tracking-[0.2em] text-[#e5e5e5]/18 sm:text-[0.55rem]">
                  {file?.name?.slice(0, 18) ?? "—"}
                </p>
              </div>
              <div className="h-px w-full bg-[#181818] mb-4" />
              <p className="font-mono text-[0.78rem] normal-case leading-relaxed tracking-wide text-[#e5e5e5]/90 sm:text-[0.85rem] sm:leading-relaxed">
                {analysis}
              </p>
              <div className="mt-6 h-px w-full bg-[#181818]" />
            </div>
          </div>
        )}

        {/* ── PRIMARY ACTION BUTTON */}
        {phase !== "result" && (
          <button
            type="button"
            disabled={isLocked}
            onClick={handleVisualize}
            className="group relative overflow-hidden border border-[#e5e5e5]/20 bg-transparent px-6 py-5 font-mono text-xs tracking-[0.2em] text-[#e5e5e5] transition-all duration-300 hover:border-[#e5e5e5]/50 hover:bg-[#e5e5e5]/[0.03] active:scale-[0.99] disabled:cursor-wait disabled:opacity-60 sm:py-6 sm:text-sm sm:tracking-[0.24em]"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-[#e5e5e5]/5 to-transparent transition-transform duration-700 group-hover:translate-x-full"
            />
            <span className="relative">
              {phase === "parsing" ? "PARSING GEOMETRY..." : "VISUALIZE DECONSTRUCTION"}
            </span>
          </button>
        )}

        {/* ── SYNTHESIZED PERMUTATIONS */}
        {phase === "result" && analysis && (
          <div className="flex flex-col gap-0 border border-[#e5e5e5]/10 bg-[#060606]">
            {/* Section header */}
            <div className="flex items-center justify-between border-b border-[#e5e5e5]/8 px-5 py-3 sm:px-6">
              <span className="font-mono text-[0.5rem] tracking-[0.28em] text-[#e5e5e5]/35 sm:text-[0.55rem]">
                SYNTHESIZED PERMUTATIONS
              </span>
              <span className="font-mono text-[0.48rem] tracking-[0.18em] text-[#e5e5e5]/18 sm:text-[0.52rem]">
                SEED // {Math.floor(mutationSeed * 0xffff).toString(16).toUpperCase().padStart(4, "0")}
              </span>
            </div>

            {/* Image container */}
            <div className="relative w-full overflow-hidden bg-[#030303]" style={{ aspectRatio: "3/4" }}>
              {/* Loading state */}
              {imgLoading && !imgError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <span className="inline-block h-1.5 w-1.5 animate-ping rounded-full bg-[#e5e5e5]/40" />
                  <p className="font-mono text-[0.5rem] tracking-[0.22em] text-[#e5e5e5]/25 sm:text-[0.55rem]">
                    RENDERING PERMUTATION...
                  </p>
                </div>
              )}
              {/* Error state */}
              {imgError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <p className="font-mono text-[0.55rem] tracking-[0.18em] text-[#e5e5e5]/30 sm:text-[0.6rem]">
                    RENDER FAILED
                  </p>
                  <p className="font-mono text-[0.48rem] tracking-[0.14em] text-[#e5e5e5]/15 sm:text-[0.52rem]">
                    POLLINATIONS.AI UNREACHABLE
                  </p>
                </div>
              )}
              {/* Generated image */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={mutationSeed}
                src={`https://image.pollinations.ai/prompt/High-fashion%20editorial%20photography,%20brutalist%20avant-garde%20garment,%20${encodeURIComponent(analysis)}?width=768&height=1024&nologo=true&seed=${mutationSeed}&model=flux`}
                alt="AI synthesized garment permutation"
                onLoad={() => { setImgLoading(false); setImgError(false); }}
                onError={() => { setImgLoading(false); setImgError(true); }}
                className={`h-full w-full object-cover transition-opacity duration-700 ${imgLoading || imgError ? "opacity-0" : "opacity-100"}`}
              />
            </div>

            {/* MUTATE button — inverted fill */}
            <button
              type="button"
              onClick={handleMutate}
              disabled={imgLoading}
              className="group relative overflow-hidden border-t border-[#e5e5e5]/10 bg-[#e5e5e5] px-6 py-4 font-mono text-[0.65rem] tracking-[0.22em] text-[#050505] transition-all duration-200 hover:bg-white active:scale-[0.99] disabled:cursor-wait disabled:opacity-50 sm:py-5 sm:text-xs sm:tracking-[0.26em]"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-black/8 to-transparent transition-transform duration-500 group-hover:translate-x-full"
              />
              <span className="relative">
                {imgLoading ? "RENDERING..." : "MUTATE GEOMETRY"}
              </span>
            </button>
          </div>
        )}

        {/* ── RESET BUTTON — shown only after a result */}
        {phase === "result" && (
          <button
            type="button"
            onClick={handleReset}
            className="group relative overflow-hidden border border-[#e5e5e5]/15 bg-transparent px-6 py-4 font-mono text-[0.65rem] tracking-[0.22em] text-[#e5e5e5]/60 transition-all duration-300 hover:border-[#e5e5e5]/35 hover:text-[#e5e5e5]/90 active:scale-[0.99] sm:py-5 sm:text-xs sm:tracking-[0.26em]"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-[#e5e5e5]/4 to-transparent transition-transform duration-700 group-hover:translate-x-full"
            />
            <span className="relative">INITIALIZE NEW SCAN</span>
          </button>
        )}

        {/* Status line */}
        <p className="text-center font-mono text-[0.48rem] tracking-[0.2em] text-[#e5e5e5]/18 sm:text-[0.52rem]">
          {phase === "parsing" ? "TRANSMITTING TO VISION ENGINE..." :
           phase === "result"  ? "ANALYSIS COMPLETE // STANDING BY" :
           "VISION ENGINE v1.0 // STANDBY"}
        </p>
      </main>

      {/* ── Footer */}
      <footer className="relative z-10 border-t border-[#e5e5e5]/[0.06] pt-4">
        <p className="text-center font-mono text-[0.48rem] tracking-[0.18em] text-[#e5e5e5]/18 sm:text-[0.52rem]">
          © YEYESAYPOWERDESIGN — UNAUTHORIZED ACCESS PROHIBITED
        </p>
      </footer>
    </div>
  );
}
