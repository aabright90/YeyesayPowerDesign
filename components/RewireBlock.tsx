"use client";

import { useEffect, useState, type ChangeEvent } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────

const STYLE_OPTIONS = ["RAW ASYMMETRY", "INDUSTRIAL SHRED", "MINIMALIST CROP"] as const;
type StyleOption = (typeof STYLE_OPTIONS)[number];

const LOCATION_OPTIONS = [
  {
    label: "HARSH STUDIO VOID",
    value: "harsh, minimalist white studio void, high-end editorial lighting",
  },
  {
    label: "ABANDONED APARTMENT",
    value: "gritty, abandoned concrete apartment with peeling paint, natural window light",
  },
  {
    label: "UNDERGROUND RAVE",
    value: "dark, underground Berlin techno rave, laser strobe lights, dense fog",
  },
  {
    label: "MAYA BAY BEACH",
    value: "pristine, secluded tropical beach surrounded by towering limestone cliffs, The Beach movie aesthetic, crystal water",
  },
  {
    label: "FULL MOON PARTY",
    value: "chaotic neon beach party at night, fire spinners, blacklight paint, crowded sand",
  },
] as const;
type LocationValue = (typeof LOCATION_OPTIONS)[number]["value"];

// ── Mannequin clip-path shape (mirrors Studio values exactly) ─────────────────
// Professional tailor's dummy: flat neck cap, natural shoulders, armscye,
// bust, cinched waist, hip flare, straight hem.

const MANNEQUIN_W = 280;
const MANNEQUIN_H = 480;
const MANNEQUIN_PATH =
  "M 112,20 " +
  "C 120,12 160,12 168,20 " +
  "L 168,52 " +
  "C 194,62 228,84 240,114 " +
  "C 248,136 238,158 224,172 " +
  "C 216,194 206,252 200,286 " +
  "C 195,318 212,356 214,392 " +
  "L 216,452 " +
  "L 64,452 " +
  "L 66,392 " +
  "C 68,356 85,318 80,286 " +
  "C 74,252 64,194 56,172 " +
  "C 42,158 32,136 40,114 " +
  "C 52,84 86,62 112,52 " +
  "L 112,20 Z";

// Placeholder poses — swap these for real hosted URLs before production
const MODEL_POSES = [
  { id: "ruby-beach",     src: "/ruby-beach.jpg",     label: "BEACH" },
  { id: "ruby-red-dress", src: "/ruby-red-dress.jpg", label: "RED DRESS" },
  { id: "ruby-studio",    src: "/ruby-studio.jpg",    label: "STUDIO" },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

interface Metrics {
  height?: string;
  chest?: string;
  waist?: string;
  hips?: string;
}

interface SourceGarment {
  id: number;
  name: string;
  photo: string | null;
}

export default function RewireBlock({
  analysisText,
  sourceImage,
  visionText = "",
  distressLevel = 50,
  asymmetry = 50,
  metrics = {},
  sourceGarments = [],
  onImageReady,
}: {
  analysisText: string;
  sourceImage: string;
  visionText?: string;
  distressLevel?: number;
  asymmetry?: number;
  metrics?: Metrics;
  sourceGarments?: SourceGarment[];
  onImageReady?: (url: string) => void;
}) {
  // Stage 1→2: mutation
  const [isMutating, setIsMutating]             = useState(false);
  const [mutations, setMutations]               = useState<string[]>([]);
  const [currentIndex, setCurrentIndex]         = useState(0);
  const [mutationStrength, setMutationStrength] = useState(0.65);
  const [adjustmentStyle, setAdjustmentStyle]   = useState<StyleOption>("RAW ASYMMETRY");
  const [backgroundStyle, setBackgroundStyle]   = useState<LocationValue>(LOCATION_OPTIONS[0].value);
  const [faceImage, setFaceImage]               = useState<string | null>(null);
  const [faceFileName, setFaceFileName]         = useState<string>("");
  const [isDownloading, setIsDownloading]       = useState(false);

  // Stage 3→4: VTON
  const [selectedModelPose, setSelectedModelPose] = useState<string>("");
  const [isFitting, setIsFitting]                 = useState(false);
  const [finalFitImage, setFinalFitImage]         = useState<string>("");
  const [isGeneratingBlueprint, setIsGeneratingBlueprint] = useState(false);

  // Shared
  const [error, setError] = useState<string | null>(null);

  const hasMutations    = mutations.length > 0;
  const activeImage     = mutations[currentIndex] ?? null;
  const photosForCorpse = sourceGarments.filter(g => g.photo);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleFaceUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFaceFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result === "string") setFaceImage(result);
    };
    reader.readAsDataURL(file);
  };

  const handleMutate = async () => {
    setIsMutating(true);
    setError(null);
    setFinalFitImage(""); // new mutation resets downstream output
    try {
      const response = await fetch("/api/mutate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisText, sourceImage, faceImage,
          adjustmentStyle, backgroundStyle, mutationStrength,
          userVision: visionText.trim() || null,
          distressLevel,
          asymmetry,
          metrics,
        }),
      });
      if (!response.ok) throw new Error("SIGNAL LOST");
      const data = await response.json();
      setMutations((prev) => {
        const next = [...prev, data.imageUrl];
        setCurrentIndex(next.length - 1);
        onImageReady?.(data.imageUrl);
        return next;
      });
    } catch {
      setError("MUTATION FAILED — CHECK VERCEL LOGS.");
    } finally {
      setIsMutating(false);
    }
  };

  // Auto-fire the mutation the moment the results screen mounts so the user
  // doesn't have to hunt for a second button.
  useEffect(() => {
    if (analysisText && sourceImage) {
      handleMutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally runs once on mount only

  const handleFit = async () => {
    if (!selectedModelPose || !activeImage || isFitting) return;
    setIsFitting(true);
    setError(null);
    // Resolve local pose paths to full origin-prefixed URLs for the Fal.ai API
    const modelImageUrl = selectedModelPose.startsWith("http")
      ? selectedModelPose
      : `${window.location.origin}${selectedModelPose}`;
    try {
      const response = await fetch("/api/vton", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelImage: modelImageUrl, garmentImage: activeImage }),
      });
      if (!response.ok) throw new Error("FITTING FAILED");
      const data = await response.json();
      setFinalFitImage(data.imageUrl);
    } catch {
      setError("LIVE FITTING FAILED — CHECK VERCEL LOGS.");
    } finally {
      setIsFitting(false);
    }
  };

  const handleDownload = async () => {
    if (!activeImage || isDownloading) return;
    setIsDownloading(true);
    try {
      const res = await fetch(activeImage);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `OOPS_TECH_PACK_${Date.now()}.jpg`;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setError("DOWNLOAD FAILED — RIGHT-CLICK → SAVE.");
    } finally {
      setIsDownloading(false);
    }
  };

  const generateBlueprint = async () => {
    // Blueprint uses final VTON result when available; falls back to mutation
    const blueprintTarget = finalFitImage || activeImage;
    if (!blueprintTarget || isGeneratingBlueprint) return;
    setIsGeneratingBlueprint(true);
    setError(null);

    const loadImage = (src: string): Promise<HTMLImageElement> =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload  = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });

    const drawCover = (
      ctx: CanvasRenderingContext2D,
      img: HTMLImageElement,
      dx: number, dy: number, dw: number, dh: number
    ) => {
      const scale = Math.max(dw / img.naturalWidth, dh / img.naturalHeight);
      const sw = dw / scale;
      const sh = dh / scale;
      const sx = (img.naturalWidth  - sw) / 2;
      const sy = (img.naturalHeight - sh) / 2;
      ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    };

    const wrapText = (
      ctx: CanvasRenderingContext2D,
      text: string,
      x: number, y: number,
      maxWidth: number,
      lineHeight: number
    ): number => {
      const words = text.split(" ");
      let line = "";
      let cy = y;
      for (const word of words) {
        const test = line + word + " ";
        if (ctx.measureText(test).width > maxWidth && line !== "") {
          ctx.fillText(line.trim(), x, cy);
          line = word + " ";
          cy += lineHeight;
        } else {
          line = test;
        }
      }
      if (line.trim()) ctx.fillText(line.trim(), x, cy);
      return cy;
    };

    try {
      const [srcImg, outputImg] = await Promise.all([
        loadImage(sourceImage),
        loadImage(blueprintTarget),
      ]);

      const W = 1200, H = 1600;
      const HEADER_H    = 130;
      const LABEL_H     = 44;
      const IMG_TOP     = HEADER_H + LABEL_H;
      const IMG_H       = 810;
      const DIVIDER_Y   = IMG_TOP + IMG_H;
      const ANALYSIS_H  = 490;
      const MANIFESTO_Y = DIVIDER_Y + ANALYSIS_H + 10;
      const PADDING     = 28;

      const canvas = document.createElement("canvas");
      canvas.width  = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d")!;

      ctx.fillStyle = "#050505";
      ctx.fillRect(0, 0, W, H);

      // Yellow header
      ctx.fillStyle = "#facc15";
      ctx.fillRect(0, 0, W, HEADER_H);
      ctx.fillStyle = "#050505";
      ctx.font = "black 58px Arial, sans-serif";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("OOPS // DECONSTRUCTION BLUEPRINT", PADDING, 78);
      ctx.font = `bold 16px "Courier New", monospace`;
      ctx.fillText(
        `GENERATED: ${new Date().toISOString().slice(0, 10)} // MODIFIER: ${adjustmentStyle} // STRENGTH: ${mutationStrength.toFixed(2)}`,
        PADDING, 112
      );

      // Image label bars
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, HEADER_H, W / 2, LABEL_H);
      ctx.fillStyle = "#ffffff";
      ctx.font = `black 15px "Courier New", monospace`;
      ctx.fillText("01 // EXISTING CORPSE", PADDING, HEADER_H + 28);

      const rightLabel   = finalFitImage ? "03 // THE FINAL DRAPE" : `02 // MUTATED GEOMETRY — #${currentIndex + 1}`;
      const rightAccent  = finalFitImage ? "#ff007f" : "#dc2626";
      ctx.fillStyle = rightAccent;
      ctx.fillRect(W / 2, HEADER_H, W / 2, LABEL_H);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(rightLabel, W / 2 + PADDING, HEADER_H + 28);

      // Images
      drawCover(ctx, srcImg,    0,     IMG_TOP, W / 2, IMG_H);
      drawCover(ctx, outputImg, W / 2, IMG_TOP, W / 2, IMG_H);

      // Center divider
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth   = 6;
      ctx.beginPath();
      ctx.moveTo(W / 2, HEADER_H);
      ctx.lineTo(W / 2, DIVIDER_Y);
      ctx.stroke();

      // Neon pink analysis box
      const ANALYSIS_LABEL_H = 36;
      ctx.fillStyle = "#ff007f";
      ctx.fillRect(0, DIVIDER_Y, W, ANALYSIS_LABEL_H);
      ctx.fillStyle = "#ffffff";
      ctx.font = `black 15px "Courier New", monospace`;
      ctx.fillText("STRUCTURAL ANALYSIS //", PADDING, DIVIDER_Y + 24);

      const analysisTop = DIVIDER_Y + ANALYSIS_LABEL_H;
      const contentH    = ANALYSIS_H - ANALYSIS_LABEL_H;
      ctx.fillStyle = "#1a001a";
      ctx.fillRect(0, analysisTop, W, contentH);
      ctx.strokeStyle = "#ff007f";
      ctx.lineWidth   = 3;
      ctx.strokeRect(0, analysisTop, W, contentH);
      ctx.fillStyle   = "#ff007f";
      ctx.font        = `italic 17px "Courier New", monospace`;
      ctx.textBaseline = "top";
      wrapText(ctx, analysisText.toUpperCase(), PADDING, analysisTop + 22, W - PADDING * 2, 26);

      // Manifesto strip
      ctx.fillStyle = "#facc15";
      ctx.fillRect(0, MANIFESTO_Y, W, H - MANIFESTO_Y);
      ctx.fillStyle   = "#050505";
      ctx.font        = `black 22px "Courier New", monospace`;
      ctx.textBaseline = "middle";
      const manifesto = "CLOTHING IS JUST WRAPPING — REAL BEAUTY COMES FROM WITHIN.";
      const mw        = ctx.measureText(manifesto).width;
      ctx.fillText(manifesto, (W - mw) / 2, MANIFESTO_Y + (H - MANIFESTO_Y) / 2);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.93);
      const a       = document.createElement("a");
      a.href        = dataUrl;
      a.download    = `OOPS_BLUEPRINT_${Date.now()}.jpg`;
      a.click();
    } catch (err) {
      console.error("Blueprint error:", err);
      setError("BLUEPRINT FAILED — CDN BLOCKED CANVAS. TRY RIGHT-CLICK → SAVE INSTEAD.");
    } finally {
      setIsGeneratingBlueprint(false);
    }
  };

  const prev = () => setCurrentIndex((i) => Math.max(0, i - 1));
  const next = () => setCurrentIndex((i) => Math.min(mutations.length - 1, i + 1));

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="w-full flex flex-col gap-0 font-mono uppercase border-4 border-[#111111] shadow-[8px_8px_0px_#111111] overflow-hidden">

      {/* ════════════════════════════════════════════════════════════
          STAGES 01 → 02 // THE DECONSTRUCTION
      ════════════════════════════════════════════════════════════ */}

      <div className="bg-[#dc2626] px-5 py-3 flex items-center justify-between border-b-4 border-[#111111]">
        <h2 className="font-sans font-black text-white text-lg tracking-[0.12em] -rotate-1 inline-block">
          STAGES 01→02 // DECONSTRUCTION
        </h2>
        <span className="font-mono text-[0.5rem] text-white/70 tracking-[0.28em]">
          FAL.AI // FLUX-PRO
        </span>
      </div>

      {/* Face identity upload */}
      <div className="bg-[#111111] border-b-4 border-[#111111] px-5 py-4">
        <p className="font-mono text-[0.5rem] font-bold tracking-[0.28em] text-[#ff007f] mb-3">
          FACIAL CONSISTENCY // PULID ENGINE
        </p>
        <label className={`flex flex-col items-center justify-center gap-1.5 border-4 cursor-pointer px-4 py-4 transition-all duration-75 shadow-[4px_4px_0px_white] hover:shadow-[6px_6px_0px_#ff007f] hover:border-[#ff007f] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none ${
          faceImage ? "border-[#ff007f] bg-[#1a001a]" : "border-white bg-[#0a0a0a]"
        }`}>
          <input type="file" accept="image/*" className="sr-only" onChange={handleFaceUpload} />
          <span className="font-sans font-black text-sm tracking-[0.14em] text-white">
            {faceImage ? "✓ IDENTITY LOCKED" : "[ SET MODEL IDENTITY (FACE) ]"}
          </span>
          <span className="font-mono text-[0.46rem] tracking-[0.18em] text-white/40">
            {faceImage ? faceFileName.slice(0, 28) : "UPLOAD A CLEAR FACE PHOTO — OPTIONAL"}
          </span>
        </label>
        {faceImage && (
          <button
            onClick={() => { setFaceImage(null); setFaceFileName(""); }}
            className="mt-2 w-full py-1.5 font-mono text-[0.46rem] tracking-widest text-[#ff007f]/60 border border-[#ff007f]/20 hover:text-[#ff007f] hover:border-[#ff007f]/50 transition-all"
          >
            [ CLEAR IDENTITY ]
          </button>
        )}
      </div>

      {/* Aesthetic control panel */}
      <div className="relative bg-yellow-400 text-black px-5 py-5 rotate-[0.4deg] border-b-4 border-black shadow-[0_4px_0_black]">
        <p className="font-sans font-black text-xs tracking-[0.26em] mb-4 -rotate-1 inline-block">
          ★ AESTHETIC OVERRIDES ★
        </p>

        <div className="flex flex-col gap-1.5 mb-5">
          <label className="font-mono text-[0.52rem] font-bold tracking-[0.2em]">
            DECONSTRUCTION INTENSITY: [{" "}
            <span className="text-[#dc2626]">{mutationStrength.toFixed(2)}</span>{" "}]
          </label>
          <input
            type="range" min={0.3} max={0.9} step={0.05}
            value={mutationStrength}
            onChange={(e) => setMutationStrength(Number(e.target.value))}
            className="w-full h-[4px] appearance-none bg-black/30 cursor-pointer accent-[#dc2626]"
          />
          <div className="flex justify-between font-mono text-[0.42rem] text-black/50 tracking-widest">
            <span>0.30 — WHISPER</span>
            <span>0.90 — ANNIHILATE</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 mb-5">
          <label className="font-mono text-[0.52rem] font-bold tracking-[0.2em]">DRAPE MODIFIER //</label>
          <div className="flex flex-wrap gap-2">
            {STYLE_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => setAdjustmentStyle(opt)}
                className={`px-3 py-2 font-mono text-[0.48rem] font-black tracking-[0.15em] border-2 border-black transition-all duration-75 shadow-[2px_2px_0px_black] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
                  adjustmentStyle === opt
                    ? "bg-[#ff007f] text-white border-black -rotate-1"
                    : "bg-white text-black hover:bg-black hover:text-yellow-400"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-mono text-[0.52rem] font-bold tracking-[0.2em]">LOCATION SCOUT //</label>
          <div className="flex flex-wrap gap-2">
            {LOCATION_OPTIONS.map((loc) => (
              <button
                key={loc.value}
                onClick={() => setBackgroundStyle(loc.value)}
                className={`px-3 py-2 font-mono text-[0.48rem] font-black tracking-[0.15em] border-2 border-black transition-all duration-75 shadow-[2px_2px_0px_black] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
                  backgroundStyle === loc.value
                    ? "bg-[#dc2626] text-white border-black rotate-1"
                    : "bg-white text-black hover:bg-black hover:text-yellow-400"
                }`}
              >
                {loc.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── CORKBOARD: Two design boards pinned to the cutting mat ─── */}
      <div
        className="border-b-4 border-[#111111] p-5 sm:p-8"
        style={{
          backgroundColor: "#f8f7f4",
          backgroundImage:
            "linear-gradient(to right, #e5e7eb 1px, transparent 1px), linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      >
        <div className="flex flex-col gap-8 sm:flex-row">

          {/* ── LEFT BOARD — 01: EXISTING CORPSE ── */}
          <div className="relative flex-1 border-4 border-[#111111] bg-white p-4 shadow-[12px_12px_0px_#111111]">
            {/* Tape — top-left yellow */}
            <div aria-hidden className="pointer-events-none absolute -top-3 left-8 z-30 h-5 w-14 rotate-[6deg] bg-[#facc15]" style={{ boxShadow: "1px 2px 4px rgba(0,0,0,0.35)" }} />
            {/* Tape — top-right pink */}
            <div aria-hidden className="pointer-events-none absolute -top-4 right-6 z-30 h-5 w-12 -rotate-[8deg] bg-[#ff007f]" style={{ boxShadow: "1px 2px 4px rgba(0,0,0,0.35)" }} />

            {/* Board label */}
            <div className="mb-3 flex items-center justify-between border-b-4 border-[#111111] pb-2">
              <span className="font-mono text-xs font-black tracking-[0.2em] text-[#111111]">
                {"// 01: EXISTING CORPSE"}
              </span>
              {photosForCorpse.length > 1 && (
                <span className="bg-[#facc15] px-1.5 py-0.5 font-mono text-[0.52rem] font-black tracking-widest text-[#111111]">
                  {photosForCorpse.length} LAYERS
                </span>
              )}
            </div>

            {photosForCorpse.length > 0 ? (
              /* ── Multi-garment mannequin view ── */
              <div
                className="relative flex items-center justify-center overflow-hidden"
                style={{ aspectRatio: "3/4", background: "#edecea" }}
              >
                {/* Hidden clip-path defs */}
                <svg aria-hidden style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
                  <defs>
                    <clipPath id="corpse-mannequin-clip" clipPathUnits="userSpaceOnUse">
                      <path d={MANNEQUIN_PATH} />
                    </clipPath>
                  </defs>
                </svg>

                {/* Mannequin container */}
                <div className="relative" style={{ width: MANNEQUIN_W, height: MANNEQUIN_H }}>
                  <div className="absolute inset-0 overflow-hidden" style={{ clipPath: "url(#corpse-mannequin-clip)" }}>
                    {photosForCorpse.map((g, idx) => {
                      const n         = photosForCorpse.length;
                      const topPct    = (idx / n * 100).toFixed(2);
                      const bottomPct = ((n - 1 - idx) / n * 100).toFixed(2);
                      return (
                        <div key={g.id} className="absolute inset-0" style={{ clipPath: `inset(${topPct}% 0 ${bottomPct}% 0)` }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={g.photo!} alt={g.name} className="h-full w-full object-cover grayscale-[20%]" />
                        </div>
                      );
                    })}
                    {photosForCorpse.length > 1 && (
                      <svg viewBox={`0 0 ${MANNEQUIN_W} ${MANNEQUIN_H}`} className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 10 }}>
                        {photosForCorpse.slice(0, -1).map((_, idx) => {
                          const y = ((idx + 1) / photosForCorpse.length) * MANNEQUIN_H;
                          return <line key={idx} x1="0" y1={y} x2={MANNEQUIN_W} y2={y} stroke="#111111" strokeWidth="2" strokeDasharray="6 4" strokeOpacity="0.35" />;
                        })}
                      </svg>
                    )}
                  </div>
                  {/* Inner tape on the mannequin itself */}
                  <div aria-hidden className="pointer-events-none absolute -top-2 left-10 z-30 h-4 w-12 rotate-[6deg] bg-[#facc15] opacity-90" style={{ boxShadow: "1px 2px 3px rgba(0,0,0,0.3)" }} />
                  <div aria-hidden className="pointer-events-none absolute -top-3 right-8 z-30 h-4 w-10 -rotate-[11deg] bg-[#ff007f] opacity-80" style={{ boxShadow: "1px 2px 3px rgba(0,0,0,0.3)" }} />
                </div>

                {/* BEFORE badge */}
                <div className="absolute top-2 left-2 bg-[#facc15] text-black font-mono text-[0.4rem] font-black px-1.5 py-0.5 tracking-widest rotate-[-2deg] shadow-[1px_1px_0px_black]">
                  BEFORE
                </div>
                {/* Garment name tags */}
                <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1">
                  {photosForCorpse.map(g => (
                    <span key={g.id} className="bg-[#111111] px-1.5 py-0.5 font-mono text-[0.4rem] font-black tracking-[0.08em] text-white">
                      {g.name.split(" ").slice(0, 2).join(" ")}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              /* ── Fallback: single sourceImage ── */
              <div className="relative overflow-hidden border-2 border-[#111111]" style={{ aspectRatio: "3/4" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sourceImage} alt="Original garment" className="w-full h-full object-cover grayscale-[30%]" />
                <div className="absolute top-2 left-2 bg-[#facc15] text-black font-mono text-[0.4rem] font-black px-1.5 py-0.5 tracking-widest rotate-[-2deg] shadow-[1px_1px_0px_black]">
                  BEFORE
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT BOARD — 02: MUTATED GEOMETRY ── */}
          <div className="relative flex-1 border-4 border-[#111111] bg-white p-4 shadow-[12px_12px_0px_#111111]">
            {/* Tape — top-left black */}
            <div aria-hidden className="pointer-events-none absolute -top-3 left-8 z-30 h-5 w-14 -rotate-[5deg] bg-[#111111]" style={{ boxShadow: "1px 2px 4px rgba(0,0,0,0.5)" }} />
            {/* Tape — top-right red */}
            <div aria-hidden className="pointer-events-none absolute -top-4 right-6 z-30 h-5 w-12 rotate-[9deg] bg-[#dc2626]" style={{ boxShadow: "1px 2px 4px rgba(0,0,0,0.35)" }} />

            {/* Board label */}
            <div className="mb-3 flex items-center justify-between border-b-4 border-[#111111] pb-2">
              <span className="font-mono text-xs font-black tracking-[0.2em] text-[#111111]">
                {"// 02: MUTATED GEOMETRY"}
              </span>
              {hasMutations && (
                <span className="bg-[#dc2626] px-1.5 py-0.5 font-mono text-[0.52rem] font-black tracking-widest text-white">
                  #{currentIndex + 1} / {mutations.length}
                </span>
              )}
            </div>

            {/* Output area */}
            <div className="relative overflow-hidden border-2 border-[#111111]" style={{ aspectRatio: "3/4" }}>
              {isMutating ? (
                /* ── Loading: massive blinking brutalist text ── */
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center gap-5"
                  style={{
                    background: "#f0efec",
                    backgroundImage:
                      "linear-gradient(to right, #e5e7eb 1px, transparent 1px), linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)",
                    backgroundSize: "40px 40px",
                  }}
                >
                  <p className="animate-pulse px-4 text-center font-mono text-xl font-black leading-snug tracking-[0.06em] text-[#111111]">
                    [ WEAVING<br />NEW FABRIC ]
                  </p>
                  <p className="font-mono text-xs font-black tracking-[0.28em] text-[#111111]/40">
                    {"// STANDBY"}
                  </p>
                  <span className="h-2.5 w-2.5 animate-ping rounded-full bg-[#ff007f]" />
                </div>
              ) : activeImage ? (
                /* ── Generated output — full-board polaroid ── */
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activeImage}
                    alt="Deconstructed garment"
                    className="h-full w-full border-2 border-black object-cover"
                  />
                  <div className="absolute top-2 right-2 rotate-[2deg] bg-[#ff007f] px-1.5 py-0.5 font-mono text-[0.4rem] font-black tracking-widest text-white shadow-[1px_1px_0px_black]">
                    AFTER
                  </div>
                </>
              ) : (
                /* ── Empty state ── */
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ background: "#edecea" }}>
                  <p className="font-mono text-xs font-black tracking-[0.22em] text-[#111111]/40 text-center px-4">
                    AWAITING OUTPUT
                  </p>
                  <p className="font-mono text-[0.52rem] tracking-[0.16em] text-[#111111]/25">
                    ENGINE STANDBY
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Carousel navigation (multiple mutations) */}
      {!isMutating && mutations.length > 1 && (
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b-2 border-[#111111]/20 bg-[#f4f4f0]">
          <button
            onClick={prev}
            disabled={currentIndex === 0}
            className="font-mono font-black text-xs tracking-widest px-4 py-2 border-2 border-[#111111] text-[#111111] shadow-[3px_3px_0px_#111111] hover:bg-[#111111] hover:text-white transition-all duration-75 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-20 disabled:cursor-not-allowed"
          >
            [ ← ]
          </button>
          <div className="flex gap-1.5">
            {mutations.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`w-2 h-2 border border-[#111111] transition-all ${
                  i === currentIndex ? "bg-[#facc15]" : "bg-transparent hover:bg-[#111111]/20"
                }`}
              />
            ))}
          </div>
          <button
            onClick={next}
            disabled={currentIndex === mutations.length - 1}
            className="font-mono font-black text-xs tracking-widest px-4 py-2 border-2 border-[#111111] text-[#111111] shadow-[3px_3px_0px_#111111] hover:bg-[#111111] hover:text-white transition-all duration-75 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-20 disabled:cursor-not-allowed"
          >
            [ → ]
          </button>
        </div>
      )}

      {/* Stage 1→2 action buttons */}
      <div className="flex flex-col gap-4 p-5 border-b-4 border-[#111111] bg-white">
        <button
          onClick={handleMutate}
          disabled={isMutating}
          className="w-full py-5 bg-[#dc2626] text-white font-sans font-black text-lg tracking-[0.12em] border-4 border-black shadow-[6px_6px_0px_black] -rotate-[1deg] hover:rotate-0 hover:shadow-[8px_8px_0px_black] hover:bg-[#b91c1c] transition-all duration-100 active:translate-x-[6px] active:translate-y-[6px] active:shadow-none disabled:opacity-50 disabled:cursor-wait"
        >
          {isMutating ? "RIPPING SEAMS..." : hasMutations ? "SHRED & RE-DRAPE" : "[ SHRED & RE-DRAPE ]"}
        </button>

        {hasMutations && (
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="w-full py-3 bg-transparent text-[#facc15] font-mono font-black text-xs tracking-[0.22em] border-2 border-[#facc15] shadow-[4px_4px_0px_#facc15] rotate-[0.5deg] hover:bg-[#facc15] hover:text-black hover:rotate-0 transition-all duration-100 active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-40 disabled:cursor-wait"
          >
            {isDownloading ? "[ EXTRACTING... ]" : `[ EXTRACT TECH-PACK — MUT.${currentIndex + 1} ]`}
          </button>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════
          STAGE 03 // THE LIVING CANVAS  (unlocks after first mutation)
      ════════════════════════════════════════════════════════════ */}

      {hasMutations && (
        <>
          <div className="bg-[#ff007f] px-5 py-3 flex items-center justify-between border-b-4 border-[#111111]">
            <h2 className="font-sans font-black text-white text-lg tracking-[0.12em] rotate-1 inline-block">
              STAGE 03 // THE LIVING CANVAS
            </h2>
            <span className="font-mono text-[0.5rem] text-white/70 tracking-[0.28em]">
              FAL.AI // IDM-VTON
            </span>
          </div>

          {/* Model pose selector */}
          <div className="bg-[#111111] border-b-4 border-[#111111] px-5 py-5">
            <p className="font-mono text-[0.5rem] font-bold tracking-[0.28em] text-[#ff007f] mb-4">
              SELECT YOUR VESSEL //
            </p>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {MODEL_POSES.map((pose) => (
                <button
                  key={pose.id}
                  onClick={() => setSelectedModelPose(pose.src)}
                  className={`flex-shrink-0 flex flex-col gap-0 overflow-hidden transition-all duration-75 ${
                    selectedModelPose === pose.src
                      ? "border-4 border-[#ff007f] shadow-[4px_4px_0px_#ff007f]"
                      : "border-4 border-white/30 hover:border-white shadow-[2px_2px_0px_rgba(255,255,255,0.15)] hover:shadow-[4px_4px_0px_white]"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pose.src}
                    alt={pose.label}
                    className="w-24 h-32 object-cover"
                  />
                  <span className={`font-mono text-[0.4rem] font-black tracking-widest text-center py-1 px-1 bg-[#050505] ${
                    selectedModelPose === pose.src ? "text-[#ff007f]" : "text-white/30"
                  }`}>
                    {pose.label}
                  </span>
                </button>
              ))}
            </div>

            {isFitting && (
              <div className="flex flex-col items-center justify-center gap-3 py-8 mt-4 border-2 border-[#ff007f]/40 bg-[#0a0a0a]">
                <p className="font-sans font-black text-[#ff007f] text-base tracking-[0.08em] animate-pulse text-center">
                  STITCHING THE LIVING CANVAS...
                </p>
                <p className="font-mono text-[0.46rem] tracking-[0.28em] text-white/30">
                  [ VTON ENGINE ACTIVE — STAND BY ]
                </p>
              </div>
            )}
          </div>

          {/* INITIATE LIVE FITTING button */}
          <div className="px-5 py-5 border-b-4 border-[#111111] bg-white">
            <button
              onClick={handleFit}
              disabled={!selectedModelPose || !activeImage || isFitting}
              className="w-full py-6 bg-[#facc15] text-black font-sans font-black text-xl tracking-[0.12em] border-4 border-black shadow-[8px_8px_0px_black] -rotate-1 hover:rotate-0 hover:shadow-[10px_10px_0px_black] hover:bg-yellow-300 transition-all duration-100 active:translate-x-[8px] active:translate-y-[8px] active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isFitting ? "STITCHING..." : "[ INITIATE LIVE FITTING ]"}
            </button>
            {!selectedModelPose && !isFitting && (
              <p className="mt-2 font-mono text-[0.46rem] tracking-widest text-[#111111]/30 text-center">
                ↑ SELECT A VESSEL ABOVE TO UNLOCK
              </p>
            )}
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════
          STAGE 04 // THE FINAL DRAPE  (unlocks after VTON completes)
      ════════════════════════════════════════════════════════════ */}

      {finalFitImage && (
        <>
          <div className="bg-[#facc15] px-5 py-3 flex items-center justify-between border-b-4 border-black">
            <h2 className="font-sans font-black text-black text-lg tracking-[0.12em] -rotate-1 inline-block">
              STAGE 04 // THE FINAL DRAPE
            </h2>
            <span className="font-mono text-[0.5rem] text-black/60 tracking-[0.28em]">
              UNBROKEN CIRCLE
            </span>
          </div>

          {/* Full-width final fit image */}
          <div className="relative border-b-4 border-black">
            <div className="absolute top-0 left-0 right-0 z-10 bg-black/70 backdrop-blur-sm px-4 py-2">
              <span className="font-sans font-black text-white text-[0.65rem] tracking-[0.26em] -rotate-1 inline-block">
                {"// 03: THE FINAL DRAPE [ UNBROKEN CIRCLE ]"}
              </span>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={finalFitImage}
              alt="Virtual try-on result"
              className="w-full object-cover contrast-110"
            />
          </div>

          {/* Blueprint export (moved here from Stage 2) */}
          <div className="flex flex-col gap-4 p-5">
            <button
              onClick={generateBlueprint}
              disabled={isGeneratingBlueprint}
              className="w-full py-4 bg-white text-black font-sans font-black text-sm tracking-[0.16em] border-4 border-black shadow-[6px_6px_0px_black] -rotate-[1deg] hover:rotate-0 hover:bg-[#dc2626] hover:text-white hover:shadow-[8px_8px_0px_black] transition-all duration-100 active:translate-x-[6px] active:translate-y-[6px] active:shadow-none disabled:opacity-40 disabled:cursor-wait"
            >
              {isGeneratingBlueprint
                ? "[ RENDERING BLUEPRINT... ]"
                : "[ EXTRACT DECONSTRUCTION BLUEPRINT ]"}
            </button>
          </div>
        </>
      )}

      {/* Global error bar */}
      {error && (
        <div className="mx-5 mb-5 border-2 border-[#dc2626] bg-white px-3 py-2 font-mono text-[0.58rem] text-[#dc2626] font-bold tracking-wider text-center rotate-[-0.5deg]">
          ⚠ {error}
        </div>
      )}

    </div>
  );
}
