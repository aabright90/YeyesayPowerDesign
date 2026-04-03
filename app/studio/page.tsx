"use client";

import { useEffect, useRef, useState } from "react";
import RewireBlock from "@/components/RewireBlock";
import RansomHeader from "@/components/RansomHeader";

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "idle" | "parsing" | "result" | "error";
type FaultKind = "unauthorized" | "corrupt";

interface Material {
  id: number;
  name: string;
  tag: string;
  photo: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_DIM = 1024;
const JPEG_Q  = 0.7;

const SCAN_MESSAGES = [
  "FEELING THE WEIGHT OF IT...",
  "TRACING THE SEAMS...",
  "READING THE GRAIN...",
  "FINDING THE GOOD BITS...",
  "MAPPING THE TENSION...",
  "STUDYING THE HEM...",
  "MEASURING THE DRAPE...",
  "ALMOST THERE...",
];

// ─── Mock Catalog ─────────────────────────────────────────────────────────────

const INITIAL_CATALOG: Material[] = [
  { id: 1, name: "DIGITAL CAMO FIELD JACKET", tag: "RIPSTOP UTILITY OUTERWEAR", photo: "/inventory/digital-camo-field-jacket.webp" },
  { id: 2, name: "BLACK TUBE TOP", tag: "STRETCH KNIT", photo: "/inventory/black-tube-top.webp" },
  { id: 3, name: "NAVY WORK JACKET", tag: "UTILITY SHELL", photo: "/inventory/navy-work-jacket.webp" },
  { id: 4, name: "BLUSH LACE PARTY DRESS", tag: "EMBROIDERED TULLE", photo: "/inventory/blush-lace-party-dress.png" },
  { id: 5, name: "WOODLAND CAMO CARGO PANTS", tag: "TACTICAL COTTON BLEND", photo: "/inventory/woodland-camo-cargo-pants.webp" },
  { id: 6, name: "OVERSIZED BLUE PLAID FLANNEL", tag: "BRUSHED COTTON", photo: "/inventory/oversized-blue-plaid-flannel.webp" },
  { id: 7, name: "DIGITAL CAMO TACTICAL PANTS", tag: "RIPSTOP FIELDWEAR", photo: "/inventory/digital-camo-tactical-pants.webp" },
  { id: 8, name: "BLACK LACE UP CROPPED TEE", tag: "SOFT COTTON JERSEY", photo: "/inventory/black-lace-up-cropped-tee.png" },
  { id: 9, name: "BLACK GOTHIC MESH TOP", tag: "SHEER STRETCH MESH", photo: "/inventory/black-gothic-mesh-top.png" },
  { id: 10, name: "BLACK LACE TRIM MESH TOP", tag: "SHEER KNIT", photo: "/inventory/black-lace-trim-mesh-top.png" },
  { id: 11, name: "RED PLAID MINI SKIRT", tag: "PUNK TARTAN WEAVE", photo: "/inventory/red-plaid-mini-skirt.png" },
  { id: 12, name: "BLACK CHAIN MINI SKIRT", tag: "PLEATED TWILL", photo: "/inventory/black-chain-mini-skirt.png" },
  { id: 13, name: "BLACK LACE UP FLARE PANTS", tag: "STRETCH KNIT", photo: "/inventory/black-lace-up-flare-pants.png" },
  { id: 14, name: "BLACK DRAPED OFF SHOULDER DRESS", tag: "BODYCON JERSEY", photo: "/inventory/black-draped-off-shoulder-dress.png" },
  { id: 15, name: "RED SATIN COCKTAIL DRESS", tag: "LUSTROUS SATIN", photo: "/inventory/red-satin-cocktail-dress.png" },
  { id: 16, name: "BLUSH LACE COCKTAIL DRESS", tag: "EMBROIDERED TULLE", photo: "/inventory/blush-lace-cocktail-dress.png" },
  { id: 17, name: "SILVER DRAPED COCKTAIL DRESS", tag: "RUCHED STRETCH SATIN", photo: "/inventory/silver-draped-cocktail-dress.png" },
  { id: 18, name: "BROWN PLAID FLANNEL SHIRT", tag: "BRUSHED COTTON", photo: "/inventory/brown-plaid-flannel-shirt.webp" },
  { id: 19, name: "OLIVE FIELD JACKET", tag: "MILITARY CANVAS", photo: "/inventory/olive-field-jacket.webp" },
  { id: 20, name: "RED BUFFALO PLAID FLANNEL", tag: "HEAVYWEIGHT BRUSHED COTTON", photo: "/inventory/red-buffalo-plaid-flannel.webp" },
  { id: 21, name: "FLORAL SMOCKED SUNDRESS", tag: "LIGHTWEIGHT COTTON", photo: "/inventory/floral-smocked-sundress.png" },
  { id: 22, name: "OLIVE FLEECE SWEATSHIRT", tag: "BRUSHED FLEECE KNIT", photo: "/inventory/olive-fleece-sweatshirt.png" },
  { id: 23, name: "LIGHT WASH STRAIGHT JEANS", tag: "CLASSIC DENIM", photo: "/inventory/light-wash-straight-jeans.png" },
  { id: 24, name: "BEIGE TRENCH COAT", tag: "STRUCTURED COTTON TWILL", photo: "/inventory/beige-trench-coat.png" },
  { id: 25, name: "LIGHT BLUE BUTTON UP SHIRT", tag: "CRISP COTTON POPLIN", photo: "/inventory/light-blue-button-up-shirt.png" },
  { id: 26, name: "BEIGE CARGO JOGGERS", tag: "UTILITY COTTON BLEND", photo: "/inventory/beige-cargo-joggers.png" },
  { id: 27, name: "TAUPE LINEN BUTTON UP", tag: "WASHED LINEN BLEND", photo: "/inventory/taupe-linen-button-up.png" },
  { id: 28, name: "BEIGE PLAID MIDI SKIRT", tag: "SOFT WOVEN PLAID", photo: "/inventory/beige-plaid-midi-skirt.png" },
  { id: 29, name: "WHITE CLASSIC TSHIRT", tag: "COTTON JERSEY", photo: "/inventory/white-classic-tshirt.png" },
  { id: 30, name: "HEATHER GRAY CLASSIC TSHIRT", tag: "COTTON JERSEY", photo: "/inventory/heather-gray-classic-tshirt.png" },
  { id: 31, name: "BLACK CLASSIC TSHIRT", tag: "COTTON JERSEY", photo: "/inventory/black-classic-tshirt.png" },
  { id: 32, name: "SKY BLUE CLASSIC TSHIRT", tag: "COTTON JERSEY", photo: "/inventory/sky-blue-classic-tshirt.png" },
  { id: 33, name: "SAGE CLASSIC TSHIRT", tag: "COTTON JERSEY", photo: "/inventory/sage-classic-tshirt.png" },
  { id: 34, name: "BLUSH CLASSIC TSHIRT", tag: "COTTON JERSEY", photo: "/inventory/blush-classic-tshirt.png" },
  { id: 35, name: "LAVENDER CLASSIC TSHIRT", tag: "COTTON JERSEY", photo: "/inventory/lavender-classic-tshirt.png" },
  { id: 36, name: "CREAM CLASSIC TSHIRT", tag: "COTTON JERSEY", photo: "/inventory/cream-classic-tshirt.png" },
  { id: 37, name: "RED CLASSIC TSHIRT", tag: "COTTON JERSEY", photo: "/inventory/red-classic-tshirt.png" },
  { id: 38, name: "ROSE CLASSIC TSHIRT", tag: "COTTON JERSEY", photo: "/inventory/rose-classic-tshirt.png" },
  { id: 39, name: "YELLOW CLASSIC TSHIRT", tag: "COTTON JERSEY", photo: "/inventory/yellow-classic-tshirt.png" },
  { id: 40, name: "FOREST GREEN CLASSIC TSHIRT", tag: "COTTON JERSEY", photo: "/inventory/forest-green-classic-tshirt.png" },
  { id: 41, name: "OLIVE UTILITY OVERSHIRT", tag: "MILITARY COTTON TWILL", photo: "/inventory/olive-utility-overshirt.jpg" },
  { id: 42, name: "WOODLAND CAMO OVERSHIRT", tag: "BRUSHED FIELD COTTON", photo: "/inventory/woodland-camo-overshirt.jpg" },
  { id: 43, name: "GUNS N ROSES GRAPHIC TEE", tag: "VINTAGE WASH COTTON", photo: "/inventory/guns-n-roses-graphic-tee.webp" },
  { id: 44, name: "MULTICAM RUCHED LONG SLEEVE TOP", tag: "STRETCH PERFORMANCE KNIT", photo: "/inventory/multicam-ruched-long-sleeve-top.jpg" },
  { id: 45, name: "WHITE HANGING TEE", tag: "MINIMAL COTTON JERSEY", photo: "/inventory/white-hanging-tee.jpg" },
  { id: 46, name: "BROWN PLAID WORK SHIRT", tag: "HEAVY BRUSHED FLANNEL", photo: "/inventory/brown-plaid-work-shirt.webp" },
  { id: 47, name: "BLACK HANGING TEE", tag: "MINIMAL COTTON JERSEY", photo: "/inventory/black-hanging-tee.jpg" },
  { id: 48, name: "DENIM BUTTON UP SHIRT", tag: "LIGHTWEIGHT CHAMBRAY", photo: "/inventory/denim-button-up-shirt.jpg" },
  { id: 49, name: "NIRVANA GRAPHIC TEE", tag: "VINTAGE WASH COTTON", photo: "/inventory/nirvana-graphic-tee.webp" },
  { id: 50, name: "DESERT CAMO CARGO PANTS", tag: "TACTICAL RIPSTOP", photo: "/inventory/desert-camo-cargo-pants.webp" },
];
// ─── Image helpers ────────────────────────────────────────────────────────────

/**
 * Accepts either a data-URL ("data:image/...;base64,...")
 * or a regular URL/path ("/inventory/...") and returns
 * { base64, mimeType } — what the analyze route expects.
 */
async function toBase64(src: string): Promise<{ base64: string; mimeType: string }> {
  if (src.startsWith("data:")) {
    const comma = src.indexOf(",");
    const base64 = src.slice(comma + 1).replace(/\s/g, "");
    const mimeMatch = src.match(/^data:([^;]+);/);
    return { base64, mimeType: mimeMatch?.[1] ?? "image/jpeg" };
  }
  // URL path — fetch the file and read it as a data URL via FileReader
  const res  = await fetch(src);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const comma   = dataUrl.indexOf(",");
      const base64  = dataUrl.slice(comma + 1).replace(/\s/g, "");
      const mimeMatch = dataUrl.match(/^data:([^;]+);/);
      resolve({ base64, mimeType: mimeMatch?.[1] ?? (blob.type || "image/jpeg") });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ─── Canvas compression ───────────────────────────────────────────────────────

function compressToJpeg(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w === 0 || h === 0) { reject(new Error("IMAGE HAS ZERO DIMENSIONS.")); return; }
      if (w > MAX_DIM || h > MAX_DIM) {
        if (w >= h) { h = Math.round((h * MAX_DIM) / w); w = MAX_DIM; }
        else        { w = Math.round((w * MAX_DIM) / h); h = MAX_DIM; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("CANVAS UNAVAILABLE.")); return; }
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_Q);
      const comma   = dataUrl.indexOf(",");
      if (comma === -1) { reject(new Error("CANVAS ENCODING FAILED.")); return; }
      const raw = dataUrl.slice(comma + 1).replace(/\s/g, "");
      if (!/^[A-Za-z0-9+/]+=*$/.test(raw) || raw.length < 16) {
        reject(new Error("INVALID BASE64.")); return;
      }
      resolve(raw);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("IMAGE LOAD FAILED."));
    };

    img.src = objectUrl;
  });
}

// ─── Garment canvas compositor ────────────────────────────────────────────────
// Draws all selected garment photos as horizontal bands onto a single canvas
// and returns a JPEG data-URL that Fal.ai can actually read.

async function composeGarmentCanvas(photos: string[]): Promise<string> {
  const W = MANNEQUIN_W;
  const H = MANNEQUIN_H;
  const n = photos.length;

  const canvas = document.createElement("canvas");
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#f4f4f0";
  ctx.fillRect(0, 0, W, H);

  for (let idx = 0; idx < n; idx++) {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el      = new window.Image();
      el.crossOrigin = "anonymous";
      el.onload     = () => resolve(el);
      el.onerror    = () => reject(new Error(`Cannot load: ${photos[idx]}`));
      el.src        = photos[idx];
    });

    const bandTop = (idx / n) * H;
    const bandH   = H / n;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, bandTop, W, bandH);
    ctx.clip();

    // object-cover fit within the band
    const scale = Math.max(W / img.naturalWidth, bandH / img.naturalHeight);
    const dw    = img.naturalWidth  * scale;
    const dh    = img.naturalHeight * scale;
    const dx    = (W - dw) / 2;
    const dy    = bandTop + (bandH - dh) / 2;

    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  }

  return canvas.toDataURL("image/jpeg", 0.85);
}

// ─── Mannequin shape ─────────────────────────────────────────────────────────
// All coordinates live in a 280 × 480 space — must match MANNEQUIN_W/H exactly.
// Silhouette: professional tailor's dummy — flat neck cap, natural shoulder slope,
// armscye indent, bust, cinched waist, hip flare, straight hem.

const MANNEQUIN_W = 280;
const MANNEQUIN_H = 480;

const MANNEQUIN_PATH =
  "M 112,20 " +                      // top-left neck cap
  "C 120,12 160,12 168,20 " +         // flat neck top arc
  "L 168,52 " +                       // right neck column
  "C 194,62 228,84 240,114 " +        // right shoulder slope
  "C 248,136 238,158 224,172 " +      // right underarm / armscye
  "C 216,194 206,252 200,286 " +      // right side → waist
  "C 195,318 212,356 214,392 " +      // right waist → hip flare
  "L 216,452 " +                      // right hem edge
  "L 64,452 " +                       // hem straight across
  "L 66,392 " +                       // left hem → hip
  "C 68,356 85,318 80,286 " +         // left hip → waist
  "C 74,252 64,194 56,172 " +         // left waist → bust
  "C 42,158 32,136 40,114 " +         // left armscye / underarm
  "C 52,84 86,62 112,52 " +           // left shoulder slope
  "L 112,20 Z";                       // left neck column, close

// ─── Mannequin SVG ────────────────────────────────────────────────────────────

function MannequinSilhouette({ faint = false }: { faint?: boolean }) {
  return (
    <svg
      viewBox={`0 0 ${MANNEQUIN_W} ${MANNEQUIN_H}`}
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full"
      fill="none"
      aria-label="Dress form silhouette"
    >
      <path
        d={MANNEQUIN_PATH}
        stroke={faint ? "#cccccc" : "#999999"}
        strokeWidth={faint ? "1.5" : "3"}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="9 5"
        strokeOpacity={faint ? 0.4 : 1}
      />
      {/* Centre-front seam */}
      <line
        x1="140" y1="62" x2="140" y2="270"
        stroke={faint ? "#cccccc" : "#999999"}
        strokeWidth="1.5"
        strokeDasharray="4 7"
        strokeOpacity={faint ? 0.2 : 0.35}
      />
      {/* Waist notch */}
      <ellipse
        cx="140" cy="270" rx="62" ry="9"
        stroke={faint ? "#cccccc" : "#999999"}
        strokeWidth="1.5"
        strokeDasharray="4 6"
        strokeOpacity={faint ? 0.15 : 0.28}
      />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StudioPage() {
  const [catalog, setCatalog]                   = useState<Material[]>(INITIAL_CATALOG);
  const [selectedGarments, setSelectedGarments] = useState<Material[]>([]);
  const [phase, setPhase]                       = useState<Phase>("idle");
  const [analysis, setAnalysis]                 = useState<string>("");
  const [sourceImage, setSourceImage]           = useState<string>("");
  const [apiError, setApiError]                 = useState<string>("");
  const [faultKind, setFaultKind]               = useState<FaultKind | null>(null);
  const [scanIdx, setScanIdx]                   = useState(0);
  const [distressLevel, setDistressLevel]       = useState(50);
  const [asymmetry, setAsymmetry]               = useState(50);
  const [searchQuery, setSearchQuery]           = useState("");
  const [visionText, setVisionText]             = useState("");
  const [isDragOver, setIsDragOver]             = useState(false);
  const [metrics, setMetrics]                   = useState({ height: "", chest: "", waist: "", hips: "" });
  const [unit, setUnit]                         = useState<"imperial" | "metric">("imperial");
  const [generatedImage, setGeneratedImage]     = useState("");

  const nextDropId = useRef(-1); // negative IDs for drag-dropped items

  const filteredCatalog = catalog.filter(
    (m) =>
      searchQuery.trim() === "" ||
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.tag.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const scanInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (scanInterval.current) clearInterval(scanInterval.current);
  }, []);

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

  // ── Toggle selection — add if absent, remove if present ─────────────────

  const handleToggleGarment = (m: Material) => {
    if (phase === "parsing") return;
    setSelectedGarments(prev => {
      const alreadyIn = prev.some(g => g.id === m.id);
      return alreadyIn ? prev.filter(g => g.id !== m.id) : [...prev, m];
    });
    setPhase("idle");
    setAnalysis("");
    setApiError("");
    setFaultKind(null);
  };

  // ── Drop local images directly onto the board ────────────────────────────

  const handleStageDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
    for (const file of files) {
      try {
        const base64 = await compressToJpeg(file);
        const dataUrl = `data:image/jpeg;base64,${base64}`;
        const newItem: Material = {
          id: nextDropId.current--,
          name: file.name.replace(/\.[^.]+$/, "").toUpperCase(),
          tag: "DROPPED FILE",
          photo: dataUrl,
        };
        setSelectedGarments(prev => [...prev, newItem]);
      } catch { /* silent */ }
    }
  };

  // ── Main AI trigger — logs payload, then runs analyze pipeline ───────────

  const handleMutate = async () => {
    if (phase === "parsing") return;

    const garmentPhotos = selectedGarments.filter(g => g.photo).map(g => g.photo!);

    if (garmentPhotos.length === 0) {
      setFaultKind("corrupt");
      setApiError("NO GARMENTS WITH PHOTOS — SELECT SOMETHING FROM THE RACK.");
      setPhase("error");
      return;
    }

    // ── Log full payload for verification ──
    const payload = {
      garmentUrls:   garmentPhotos,
      primaryGarment: garmentPhotos[0],
      garmentNames:  selectedGarments.map(g => g.name),
      visionText:    visionText.trim() || null,
      distressLevel,
      asymmetry,
      metrics,
    };
    console.log("[OOPS AI PAYLOAD]", payload);

    // ── Composite all selected garments into a single canvas image ──
    // This produces a real data-URL that Fal.ai can actually read.
    setApiError("");
    setFaultKind(null);
    setPhase("parsing");

    let compositeDataUrl: string;
    try {
      compositeDataUrl = await composeGarmentCanvas(garmentPhotos);
    } catch {
      // Fallback: convert the first garment path to base64 the slow way
      try {
        const { base64, mimeType } = await toBase64(garmentPhotos[0]);
        compositeDataUrl = `data:${mimeType};base64,${base64}`;
      } catch {
        setFaultKind("corrupt");
        setApiError("FAILED TO LOAD IMAGE — CHECK THE FILE.");
        setPhase("error");
        return;
      }
    }

    setSourceImage(compositeDataUrl); // data-URL — Fal.ai can read this

    try {
      // toBase64 short-circuits instantly for data: URIs
      let base64: string;
      let mimeType: string;
      try {
        ({ base64, mimeType } = await toBase64(compositeDataUrl));
      } catch {
        setFaultKind("corrupt");
        setApiError("FAILED TO ENCODE IMAGE.");
        setPhase("error");
        return;
      }

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageData: base64,
          mimeType,
          userVision: visionText.trim() || null,
          metrics,
        }),
      });

      let json: { analysis?: string; error?: string; code?: string; detail?: string };
      try {
        json = (await res.json()) as typeof json;
      } catch {
        setFaultKind("corrupt"); setApiError("SIGNAL LOST"); setPhase("error"); return;
      }

      const isKeyMissing =
        res.status === 503 ||
        json.code === "API_KEY_MISSING" ||
        json.error === "API_KEY_MISSING";

      if (!res.ok || json.error) {
        if (isKeyMissing) { setFaultKind("unauthorized"); }
        else {
          setFaultKind("corrupt");
          setApiError(
            json.detail?.trim() ||
            (typeof json.error === "string" ? json.error : "") ||
            "SIGNAL LOST"
          );
        }
        setPhase("error");
        return;
      }

      setAnalysis(json.analysis ?? "");
      setPhase("result");
    } catch (err: unknown) {
      setFaultKind("corrupt");
      setApiError(err instanceof Error ? err.message : "UNKNOWN FAILURE.");
      setPhase("error");
    }
  };

  const handleReset = () => {
    setSelectedGarments([]);
    setPhase("idle");
    setAnalysis("");
    setSourceImage("");
    setGeneratedImage("");
    setApiError("");
    setFaultKind(null);
  };

  // Back to studio but keep garment stack, sliders, directive, and metrics intact.
  const handleReroll = () => {
    setPhase("idle");
    setAnalysis("");
    setSourceImage("");
    setGeneratedImage("");
    setApiError("");
    setFaultKind(null);
  };

  const handleExport = async () => {
    if (!generatedImage) return;
    try {
      const res  = await fetch(generatedImage);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `OOPS_MUTANT_${Date.now()}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(generatedImage, "_blank");
    }
  };

  const canMutate = selectedGarments.some(g => g.photo) && phase !== "parsing";

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    // ── Mobile: scrolls freely. Desktop (lg): locked to viewport height ──
    <div className="flex min-h-screen flex-col overflow-x-hidden px-4 pb-3 pt-4 normal-case lg:h-full lg:overflow-hidden lg:px-6 lg:pt-5">

      {/* ── Compact Page Header ──────────────────────────────────────── */}
      <header className="mb-3 flex flex-shrink-0 items-end justify-between gap-3">
        <RansomHeader text="OOPS WORK BENCH" />
        <p className="hidden rotate-[0.5deg] border-l-4 border-[#facc15] bg-white px-3 py-1.5 font-mono text-xs normal-case leading-relaxed tracking-wide text-[#111111]/70 shadow-[3px_3px_0_0_#111111] sm:block">
          the world has enough new clothes. we work with what&apos;s already here.
        </p>
        <div className="h-[3px] w-8 bg-[#111111] sm:hidden" />
      </header>

      {/* ── Thick rule under header ──────────────────────────────────── */}
      <div className="mb-3 h-[3px] w-full flex-shrink-0 bg-[#111111]" />

      {/* ── Results Screen — locked two-column grid, mirrors the workbench ── */}
      {phase === "result" && analysis && (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-12 lg:h-full">

          {/* LEFT — Fabric Analysis (col-span-4, internally scrollable) */}
          <div className="flex h-full min-h-0 flex-col overflow-hidden border-4 border-[#111111] shadow-[8px_8px_0_0_#111111] lg:col-span-4">

            {/* Panel header — pinned */}
            <div className="flex-shrink-0 border-b-4 border-[#111111] bg-white px-4 py-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-block -rotate-1 border-2 border-[#111111] bg-[#facc15] px-2 py-1 font-mono text-xs font-black tracking-[0.1em] text-[#111111] shadow-[2px_2px_0_0_#111111]">
                  FABRIC
                </span>
                <span className="inline-block rotate-[2deg] border-2 border-[#111111] bg-[#111111] px-2 py-1 font-mono text-xs font-black tracking-[0.1em] text-white shadow-[2px_2px_0_0_#dc2626]">
                  READ
                </span>
                <span className="inline-block rotate-[-1deg] border-2 border-[#111111] bg-[#dc2626] px-2 py-1 font-mono text-xs font-black tracking-[0.1em] text-white shadow-[2px_2px_0_0_#111111]">
                  OUT
                </span>
              </div>
              <p className="mt-1.5 font-mono text-[0.6rem] tracking-[0.14em] text-[#111111]/50">
                OOPS VISION ENGINE — STRUCTURAL REPORT
              </p>
            </div>

            {/* Analysis text — scrolls internally */}
            <div className="min-h-0 flex-1 overflow-y-auto bg-white px-5 py-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <p className="font-mono text-xs tracking-[0.16em] text-[#111111]/40">
                  STRUCTURAL DECONSTRUCTION //
                </p>
                <span className="inline-block rotate-1 bg-[#ff007f] px-2 py-0.5 font-mono text-[0.6rem] font-black tracking-widest text-white">
                  {selectedGarments[0]?.name ?? "GARMENT"}
                </span>
              </div>
              <div className="h-[3px] w-full bg-[#111111]" />
              <p className="terminal-feed mt-4 font-mono text-[0.8rem] normal-case leading-relaxed tracking-wide text-[#111111]/85 sm:text-[0.88rem]">
                {analysis}
              </p>
              <div className="mt-6 h-[3px] w-full bg-[#111111]" />
              <p className="mt-3 font-mono text-[0.44rem] font-bold tracking-[0.22em] text-[#111111]/25">
                LEAVE IT BETTER THAN YOU FOUND IT.
              </p>
            </div>

            {/* Action cluster — pinned to bottom of left panel */}
            <div className="flex-shrink-0 border-t-4 border-[#111111] bg-punk-halftone p-3 flex flex-col gap-2">

              {/* Export / Save */}
              <button
                type="button"
                onClick={handleExport}
                disabled={!generatedImage}
                className="w-full border-4 border-[#111111] bg-[#facc15] px-4 py-3 font-mono text-xs font-black tracking-[0.18em] text-[#111111] shadow-[4px_4px_0_0_#111111] transition-all duration-75 hover:bg-[#111111] hover:text-[#facc15] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-30 disabled:shadow-none"
              >
                [ EXPORT // SAVE ]
              </button>

              {/* Re-Mash — keep stack, go back to studio */}
              <button
                type="button"
                onClick={handleReroll}
                className="w-full border-4 border-[#111111] bg-[#ff007f] px-4 py-3 font-mono text-xs font-black tracking-[0.18em] text-white shadow-[4px_4px_0_0_#111111] transition-all duration-75 hover:bg-[#111111] hover:text-[#ff007f] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
              >
                [ RE-MASH // TWEAK DIRECTIVE ]
              </button>

              {/* Full reset — clear everything */}
              <button
                type="button"
                onClick={handleReset}
                className="w-full border-2 border-[#111111]/40 bg-white px-4 py-2.5 font-mono text-xs font-black tracking-[0.18em] text-[#111111]/50 transition-all duration-75 hover:border-[#111111] hover:text-[#111111]"
              >
                ↩ PICK ANOTHER GARMENT
              </button>
            </div>
          </div>

          {/* RIGHT — AI Generation Studio via RewireBlock (col-span-8) */}
          <div className="flex h-full min-h-0 flex-col overflow-hidden border-4 border-[#111111] shadow-[8px_8px_0_0_#111111] lg:col-span-8">

            {/* Panel header — pinned */}
            <div className="flex-shrink-0 border-b-4 border-[#111111] bg-white px-5 py-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-block rotate-[2deg] border-2 border-[#111111] bg-[#111111] px-2 py-1 font-mono text-xs font-black tracking-[0.1em] text-[#facc15] shadow-[2px_2px_0_0_#facc15]">
                  RE
                </span>
                <span className="inline-block -rotate-1 border-2 border-[#111111] bg-[#ff007f] px-2 py-1 font-mono text-xs font-black tracking-[0.1em] text-white shadow-[2px_2px_0_0_#111111]">
                  WIRE
                </span>
                <span className="inline-block rotate-1 border-2 border-[#111111] bg-[#facc15] px-2 py-1 font-mono text-xs font-black tracking-[0.1em] text-[#111111] shadow-[2px_2px_0_0_#111111]">
                  STUDIO
                </span>
              </div>
              <p className="mt-1.5 font-mono text-[0.6rem] tracking-[0.14em] text-[#111111]/50">
                AI MUTATION ENGINE — GENERATE THE FINAL DESIGN
              </p>
            </div>

            {/* RewireBlock — scrolls internally */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <RewireBlock
                analysisText={analysis}
                sourceImage={sourceImage}
                visionText={visionText}
                distressLevel={distressLevel}
                asymmetry={asymmetry}
                metrics={metrics}
                sourceGarments={selectedGarments}
                onImageReady={setGeneratedImage}
              />
            </div>
          </div>

        </div>
      )}

      {/* ── Main Workbench Grid — 3 columns on desktop ──────────────── */}
      {phase !== "result" && (
        <div className="flex flex-col gap-4 lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-12 lg:gap-4 lg:h-full lg:overflow-hidden">

          {/* ════════════════════════════════════════════════
              COL 1 — MATERIAL CATALOG  (lg:col-span-3)
              Header + search bar fixed; cards scroll inside
          ════════════════════════════════════════════════ */}
          <div className="flex h-[55vh] flex-col overflow-hidden border-4 border-[#111111] shadow-[8px_8px_0_0_#111111] lg:col-span-3 lg:h-full">

            {/* Catalog ransom-note header */}
            <div className="flex-shrink-0 border-b-4 border-[#111111] bg-white px-4 py-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-block rotate-[-2deg] border-2 border-[#111111] bg-[#dc2626] px-2 py-1 font-mono text-xs font-black tracking-[0.1em] text-white shadow-[2px_2px_0_0_#111111]">
                  LIVE
                </span>
                <span className="inline-block rotate-[3deg] border-2 border-[#111111] bg-[#111111] px-2 py-1 font-mono text-xs font-black tracking-[0.1em] text-white shadow-[2px_2px_0_0_#dc2626]">
                  INVEN
                </span>
                <span className="inline-block -rotate-1 border-2 border-[#111111] bg-[#facc15] px-2 py-1 font-mono text-xs font-black tracking-[0.1em] text-[#111111] shadow-[2px_2px_0_0_#111111]">
                  TORY
                </span>
                {selectedGarments.length > 0 && (
                  <span className="inline-block rotate-[2deg] border-2 border-[#ff007f] bg-[#ff007f] px-2 py-1 font-mono text-xs font-black tracking-[0.1em] text-white shadow-[2px_2px_0_0_#111111]">
                    {selectedGarments.length} ✓
                  </span>
                )}
              </div>
              <p className="mt-1.5 font-mono text-xs tracking-[0.16em] text-[#111111]/50">
                {selectedGarments.length > 0
                  ? "CLICK TO TOGGLE — ADD OR REMOVE"
                  : "CLICK TO SELECT GARMENTS"}
              </p>
            </div>

            {/* ── Search bar — sticky below header */}
            <div className="flex-shrink-0 border-b-4 border-[#111111] bg-white px-3 py-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="[ SEARCH DEADSTOCK... ]"
                className="w-full border-2 border-[#111111] bg-white px-3 py-2 font-mono text-xs font-black uppercase tracking-[0.1em] text-[#111111] placeholder:normal-case placeholder:text-[#111111]/25 transition-colors duration-75 focus:bg-[#facc15] focus:placeholder:text-[#111111]/50 focus:outline-none"
              />
            </div>

            {/* ── Scrollable polaroid grid */}
            <div className="min-h-0 flex-1 overflow-y-auto bg-punk-halftone p-3 pb-10">
              {filteredCatalog.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12">
                  <p className="font-mono text-xs font-black tracking-[0.15em] text-[#111111]/40">
                    NOTHING MATCHES
                  </p>
                  <p className="font-mono text-[0.6rem] tracking-widest text-[#111111]/25">
                    {`"${searchQuery}"`}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {filteredCatalog.map((material) => {
                    const isSelected = selectedGarments.some(g => g.id === material.id);
                    return (
                      <div
                        key={material.id}
                        onClick={() => handleToggleGarment(material)}
                        className={`flex cursor-pointer flex-col border-4 bg-white transition-all duration-75 hover:scale-[1.03] ${
                          isSelected
                            ? "border-[#ff007f] shadow-[4px_4px_0_0_#ff007f] -rotate-1"
                            : "border-[#111111] shadow-[3px_3px_0_0_#111111] rotate-1 hover:shadow-[5px_5px_0_0_#111111]"
                        }`}
                      >
                        {/* Photo */}
                        <div className="relative border-b-4 border-[#111111] bg-[#d4d4d0]" style={{ aspectRatio: "1/1" }}>
                          {material.photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={material.photo}
                              alt={material.name}
                              className="h-full w-full object-cover transition-all duration-150 hover:brightness-110"
                            />
                          ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-[#d4d4d0]">
                              <span className="font-mono text-[0.6rem] font-black tracking-[0.12em] text-[#111111]/40">
                                NO PHOTO
                              </span>
                            </div>
                          )}
                          {isSelected && (
                            <div className="absolute right-1 top-1 rotate-2 bg-[#ff007f] px-1.5 py-0.5">
                              <span className="font-mono text-[0.6rem] font-black tracking-widest text-white">✓ ON BOARD</span>
                            </div>
                          )}
                        </div>
                        {/* Caption */}
                        <div className="flex flex-col gap-0.5 bg-white px-2 py-2">
                          <p className="font-mono text-[0.65rem] font-black leading-tight tracking-[0.08em] text-[#111111]">
                            {material.name}
                          </p>
                          <p className="font-mono text-[0.55rem] tracking-[0.06em] text-[#111111]/50">
                            {material.tag}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <p className="mt-4 text-center font-mono text-xs tracking-[0.14em] text-[#111111]/40">
                {searchQuery.trim()
                  ? `${filteredCatalog.length} of ${catalog.length} ITEMS`
                  : `${catalog.length} ITEMS IN STOCK`}
              </p>
            </div>
          </div>

          {/* ════════════════════════════════════════════════
              COL 2 — MANNEQUIN STAGE  (lg:col-span-6)
              Pure canvas — controls live in Command Desk
          ════════════════════════════════════════════════ */}
          <div className="relative flex h-[70vh] flex-col overflow-hidden border-4 border-[#111111] shadow-[8px_8px_0_0_#111111] lg:col-span-6 lg:h-full">

            {/* Board header */}
            <div className="flex flex-shrink-0 items-center justify-between border-b-4 border-[#111111] bg-white px-5 py-3">
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-block rotate-[2deg] border-2 border-[#111111] bg-[#111111] px-2 py-1 font-mono text-xs font-black tracking-[0.1em] text-[#facc15] shadow-[2px_2px_0_0_#facc15]">
                    PASTE
                  </span>
                  <span className="inline-block -rotate-[2deg] border-2 border-[#111111] bg-[#facc15] px-2 py-1 font-mono text-xs font-black tracking-[0.1em] text-[#111111] shadow-[2px_2px_0_0_#111111]">
                    UP
                  </span>
                  <span className="inline-block rotate-[1deg] border-2 border-[#111111] bg-[#dc2626] px-2 py-1 font-mono text-xs font-black tracking-[0.1em] text-white shadow-[2px_2px_0_0_#111111]">
                    BOARD
                  </span>
                </div>
                <p className="mt-1 font-mono text-xs tracking-[0.16em] text-[#111111]/50">
                  {selectedGarments.length > 0
                    ? `${selectedGarments.length} GARMENT${selectedGarments.length > 1 ? "S" : ""} LOADED — DROP MORE OR CLICK RACK`
                    : "NO GARMENTS — SELECT FROM RACK OR DROP FILES HERE"}
                </p>
              </div>
              {selectedGarments.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedGarments([])}
                  className="border-2 border-[#111111] bg-white px-3 py-1.5 font-mono text-xs font-black tracking-widest text-[#111111] shadow-[2px_2px_0_0_#111111] transition-all hover:bg-[#dc2626] hover:text-white hover:border-[#dc2626]"
                >
                  [ CLEAR BOARD ]
                </button>
              )}
            </div>

            {/* ── CUTTING-MAT STAGE — drag-drop target, fills remaining height */}
            <div
              className={`relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden transition-all duration-100 ${isDragOver ? "ring-4 ring-inset ring-[#ff007f]" : ""}`}
              style={{
                backgroundColor: isDragOver ? "rgba(255,0,127,0.04)" : "#f8f7f4",
                backgroundImage:
                  "linear-gradient(to right, #e5e7eb 1px, transparent 1px), linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleStageDrop}
            >
              {/* Contextual watermark */}
              <p
                aria-hidden
                className="pointer-events-none absolute inset-0 z-0 flex select-none items-center justify-center text-center font-mono text-3xl font-black tracking-[0.25em] text-[#111111]/[0.06] sm:text-4xl"
              >
                {selectedGarments.length > 0 ? "STAGE // LOADED" : "[ AWAITING TEXTILE ]"}
              </p>

              {/* Drop overlay */}
              {isDragOver && (
                <div className="pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center gap-3">
                  <p className="font-mono text-3xl font-black tracking-[0.2em] text-[#ff007f]">
                    [ DROP IT ]
                  </p>
                  <p className="font-mono text-sm font-bold tracking-widest text-[#ff007f]/70">
                    RELEASE TO PIN TO BOARD
                  </p>
                </div>
              )}

              {/* ── PARSING */}
              {phase === "parsing" && (
                <div className="relative z-10 w-full max-w-sm border-4 border-[#111111] bg-[#f4f4f0] shadow-[6px_6px_0_0_#111111]">
                  <div className="h-2 w-full bg-[#facc15]" />
                  <div className="flex flex-col gap-4 px-5 py-5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold tracking-[0.18em] text-[#111111]/50">
                        VISION ENGINE // ACTIVE
                      </span>
                      <span className="h-2 w-2 animate-ping rounded-full bg-[#ff007f]" />
                    </div>
                    <p className="min-h-[1.2rem] font-mono text-xs font-black tracking-[0.18em] text-[#111111]">
                      {SCAN_MESSAGES[scanIdx]}
                    </p>
                    {["SILHOUETTE", "FABRIC WEIGHT", "SEAM LINES"].map((label, i) => (
                      <div key={label} className="flex items-center gap-2">
                        <span className="font-mono text-[0.6rem] tracking-[0.1em] text-[#111111]/40">{label}</span>
                        <span
                          className="h-[2px] flex-1 bg-[#111111]/10"
                          style={{ animation: `scan ${1.1 + i * 0.35}s ease-in-out infinite` }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── ERROR */}
              {phase === "error" && (
                <div className="relative z-10 w-full max-w-sm border-4 border-[#dc2626] bg-white shadow-[6px_6px_0_0_#dc2626]">
                  <div className="h-2 w-full bg-[#dc2626]" />
                  <div className="px-5 py-5">
                    <p className="font-mono text-xs font-black tracking-[0.16em] text-[#dc2626]">
                      {faultKind === "unauthorized" ? "ENGINE FAULT // UNAUTHORIZED" : "SOMETHING BROKE."}
                    </p>
                    {faultKind === "corrupt" && apiError && (
                      <p className="mt-2 font-mono text-xs normal-case leading-relaxed text-[#dc2626]/80">{apiError}</p>
                    )}
                    <button
                      onClick={() => setPhase("idle")}
                      className="mt-4 border-2 border-[#dc2626] px-4 py-2 font-mono text-xs font-black tracking-widest text-[#dc2626] transition-all hover:bg-[#dc2626] hover:text-white"
                    >
                      [ TRY AGAIN ]
                    </button>
                  </div>
                </div>
              )}

              {/* ── IDLE: unified mannequin stage ── */}
              {phase === "idle" && (() => {
                const photos = selectedGarments.filter(g => g.photo);
                const n = photos.length;

                return (
                  <div className="relative z-10 flex flex-col items-center gap-4">

                    {/* ── Hidden SVG defs — clip path lives here ── */}
                    <svg
                      aria-hidden
                      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
                    >
                      <defs>
                        <clipPath id="mannequin-clip" clipPathUnits="userSpaceOnUse">
                          <path d={MANNEQUIN_PATH} />
                        </clipPath>
                      </defs>
                    </svg>

                    {/* ── Fixed-size mannequin container ── */}
                    <div
                      className="relative"
                      style={{ width: MANNEQUIN_W, height: MANNEQUIN_H }}
                    >
                      {/* Ghost silhouette — full opacity when empty, whisper faint when loaded */}
                      <div
                        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
                        style={{ opacity: n > 0 ? 0.1 : 1 }}
                      >
                        <MannequinSilhouette />
                      </div>

                      {/* ── Patchwork fabric fill — clipped to dress form ── */}
                      {n > 0 && (
                        <>
                          {/* All garment images stacked in horizontal bands, clipped to mannequin */}
                          <div
                            className="absolute inset-0 overflow-hidden"
                            style={{ clipPath: "url(#mannequin-clip)" }}
                          >
                            {photos.map((g, idx) => {
                              const topPct    = ((idx) / n * 100).toFixed(2);
                              const bottomPct = ((n - 1 - idx) / n * 100).toFixed(2);
                              return (
                                <div
                                  key={g.id}
                                  className="absolute inset-0"
                                  style={{
                                    clipPath: `inset(${topPct}% 0 ${bottomPct}% 0)`,
                                  }}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={g.photo!}
                                    alt={g.name}
                                    className="h-full w-full object-cover"
                                  />
                                </div>
                              );
                            })}

                            {/* Dashed seam lines between fabric bands — also clipped to shape */}
                            {n > 1 && (
                              <svg
                                viewBox={`0 0 ${MANNEQUIN_W} ${MANNEQUIN_H}`}
                                className="pointer-events-none absolute inset-0 h-full w-full"
                                style={{ zIndex: 10 }}
                              >
                                {photos.slice(0, -1).map((_, idx) => {
                                  const y = ((idx + 1) / n) * MANNEQUIN_H;
                                  return (
                                    <line
                                      key={idx}
                                      x1="0" y1={y}
                                      x2={MANNEQUIN_W} y2={y}
                                      stroke="#111111"
                                      strokeWidth="2.5"
                                      strokeDasharray="7 5"
                                      strokeOpacity="0.55"
                                    />
                                  );
                                })}
                              </svg>
                            )}
                          </div>

                          {/* Punk tape — OUTSIDE the clip, so it's never cut off */}
                          <div aria-hidden className="pointer-events-none absolute -top-3 left-12 z-30 h-5 w-14 rotate-[6deg] bg-[#facc15] opacity-90" style={{ boxShadow: "1px 2px 3px rgba(0,0,0,0.28)" }} />
                          <div aria-hidden className="pointer-events-none absolute -top-4 right-10 z-30 h-5 w-12 -rotate-[11deg] bg-[#ff007f] opacity-85" style={{ boxShadow: "1px 2px 3px rgba(0,0,0,0.28)" }} />
                          <div aria-hidden className="pointer-events-none absolute -bottom-2 left-16 z-30 h-4 w-10 rotate-[3deg] bg-[#111111] opacity-50" style={{ boxShadow: "1px 2px 3px rgba(0,0,0,0.2)" }} />
                        </>
                      )}
                    </div>

                    {/* Caption row */}
                    {n === 0 ? (
                      <p className="font-mono text-xs tracking-[0.2em] text-[#111111]/30">
                        ← SELECT FROM RACK OR DROP AN IMAGE FILE HERE
                      </p>
                    ) : (
                      <div className="flex max-w-[280px] flex-wrap justify-center gap-1.5">
                        {photos.map((g) => (
                          <span
                            key={g.id}
                            className="bg-[#111111] px-2 py-0.5 font-mono text-[0.55rem] font-black tracking-[0.1em] text-white"
                          >
                            {g.name.split(" ").slice(0, 3).join(" ")}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

          </div>{/* end col 2 */}

          {/* ════════════════════════════════════════════════
              COL 3 — COMMAND DESK  (lg:col-span-3)
              Unit toggle · Metrics · Sliders · Directive · CTA
          ════════════════════════════════════════════════ */}
          <div className="flex flex-col overflow-hidden border-4 border-[#111111] shadow-[8px_8px_0_0_#111111] lg:col-span-3 lg:h-full">

            {/* Header */}
            <div className="flex-shrink-0 border-b-4 border-[#111111] bg-white px-4 py-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-block rotate-[2deg] border-2 border-[#111111] bg-[#111111] px-2 py-1 font-mono text-xs font-black tracking-[0.1em] text-[#facc15] shadow-[2px_2px_0_0_#facc15]">
                  CMD
                </span>
                <span className="inline-block -rotate-1 border-2 border-[#111111] bg-[#ff007f] px-2 py-1 font-mono text-xs font-black tracking-[0.1em] text-white shadow-[2px_2px_0_0_#111111]">
                  DESK
                </span>
              </div>
              <p className="mt-1.5 font-mono text-xs tracking-[0.16em] text-[#111111]/50">
                AI CONTROLS &amp; CLIENT METRICS
              </p>
            </div>

            {/* ── Scrollable controls body */}
            <div className="min-h-0 flex-1 overflow-y-auto bg-white px-4 py-4 flex flex-col gap-5">

              {/* Unit toggle */}
              <div>
                <p className="mb-2 font-mono text-[0.58rem] font-black uppercase tracking-[0.18em] text-[#111111]/50">
                  MEASUREMENT SYSTEM
                </p>
                <button
                  type="button"
                  onClick={() => setUnit(u => u === "imperial" ? "metric" : "imperial")}
                  className={`w-full border-4 border-[#111111] px-3 py-2.5 font-mono text-xs font-black tracking-[0.12em] shadow-[4px_4px_0_0_#111111] transition-all duration-75 active:translate-x-[4px] active:translate-y-[4px] active:shadow-none ${
                    unit === "imperial"
                      ? "bg-[#facc15] text-[#111111] hover:bg-[#111111] hover:text-[#facc15]"
                      : "bg-[#111111] text-[#facc15] hover:bg-[#facc15] hover:text-[#111111]"
                  }`}
                >
                  {unit === "imperial" ? "[ UNIT: INCHES / LBS ]" : "[ UNIT: CM / KG ]"}
                </button>
              </div>

              {/* Client metrics — 2×2 grid */}
              <div>
                <p className="mb-2.5 font-mono text-[0.58rem] font-black uppercase tracking-[0.18em] text-[#111111]">
                  [ CLIENT METRICS // TAILOR TAPE ]
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      { key: "height", label: "HEIGHT",       ph: unit === "imperial" ? "5'9\""  : "175 CM" },
                      { key: "chest",  label: "CHEST / BUST", ph: unit === "imperial" ? "34\""   : "86 CM"  },
                      { key: "waist",  label: "WAIST",        ph: unit === "imperial" ? "28\""   : "71 CM"  },
                      { key: "hips",   label: "HIPS",         ph: unit === "imperial" ? "38\""   : "96 CM"  },
                    ] as const
                  ).map(({ key, label, ph }) => (
                    <div key={key} className="flex flex-col gap-1">
                      <label className="font-mono text-[0.52rem] font-black uppercase tracking-[0.12em] text-[#111111]/55">
                        {label}
                      </label>
                      <input
                        type="text"
                        value={metrics[key]}
                        onChange={(e) => setMetrics(prev => ({ ...prev, [key]: e.target.value }))}
                        placeholder={ph}
                        className="border-2 border-[#111111] bg-white px-2 py-1.5 font-mono text-xs font-bold normal-case text-[#111111] placeholder:text-[#111111]/25 transition-colors duration-75 focus:bg-[#ff007f] focus:text-white focus:placeholder:text-white/40 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="h-[3px] w-full bg-[#111111]" />

              {/* Decay / Distress slider */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="font-mono text-xs font-black uppercase tracking-[0.1em] text-[#111111]">
                    [ DECAY // DISTRESS ]
                  </label>
                  <span className="font-mono text-xs font-black text-[#dc2626]">{distressLevel}</span>
                </div>
                <input
                  type="range" min="0" max="100" step="1"
                  value={distressLevel}
                  onChange={(e) => setDistressLevel(parseInt(e.target.value, 10))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-none border-2 border-[#111111] bg-[#f4f4f0] accent-[#dc2626]"
                />
                <div className="flex justify-between font-mono text-[0.52rem] tracking-widest text-[#111111]/30">
                  <span>INTACT</span><span>DESTROYED</span>
                </div>
              </div>

              {/* Mutation / Asymmetry slider */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="font-mono text-xs font-black uppercase tracking-[0.1em] text-[#111111]">
                    [ MUTATION // ASYMMETRY ]
                  </label>
                  <span className="font-mono text-xs font-black text-[#ff007f]">{asymmetry}</span>
                </div>
                <input
                  type="range" min="0" max="100" step="1"
                  value={asymmetry}
                  onChange={(e) => setAsymmetry(parseInt(e.target.value, 10))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-none border-2 border-[#111111] bg-[#f4f4f0] accent-[#ff007f]"
                />
                <div className="flex justify-between font-mono text-[0.52rem] tracking-widest text-[#111111]/30">
                  <span>BALANCED</span><span>CHAOTIC</span>
                </div>
              </div>

              {/* Creative Directive */}
              <div>
                <label className="mb-2 block font-mono text-xs font-black uppercase tracking-[0.12em] text-[#111111]">
                  CREATIVE DIRECTIVE
                </label>
                <textarea
                  value={visionText}
                  onChange={(e) => setVisionText(e.target.value)}
                  placeholder={'E.G. "ASYMMETRICAL CYBERPUNK SKIRT WITH HEAVY DISTRESSING"'}
                  rows={3}
                  className="w-full resize-none border-4 border-[#111111] bg-white p-3 font-mono text-xs font-bold uppercase tracking-[0.05em] text-[#111111] placeholder:normal-case placeholder:font-normal placeholder:text-[#111111]/30 focus:bg-[#facc15] focus:outline-none transition-colors duration-75 shadow-[4px_4px_0_0_#111111]"
                />
              </div>

            </div>{/* end scrollable controls */}

            {/* ── DECONSTRUCT — pinned to the bottom of the column */}
            <div className="flex-shrink-0 border-t-4 border-[#111111] bg-punk-halftone px-4 py-4">
              <button
                type="button"
                onClick={handleMutate}
                disabled={!canMutate}
                className="-rotate-1 w-full border-4 border-[#111111] bg-[#facc15] px-4 py-4 font-mono text-sm font-black tracking-[0.14em] text-[#111111] shadow-[6px_6px_0_0_#111111] transition-all duration-75 hover:rotate-0 hover:shadow-[8px_8px_0_0_#111111] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-30 disabled:rotate-0 disabled:shadow-none"
              >
                {phase === "parsing" ? "READING THE FABRIC..." : "[ DECONSTRUCT GARMENT ]"}
              </button>
              {selectedGarments.length === 0 && (
                <p className="mt-2 text-center font-mono text-[0.6rem] tracking-[0.14em] text-[#111111]/40">
                  ↑ SELECT GARMENTS FROM THE RACK FIRST
                </p>
              )}
              {selectedGarments.length > 0 && !selectedGarments.some(g => g.photo) && (
                <p className="mt-2 text-center font-mono text-[0.6rem] tracking-[0.14em] text-[#111111]/40">
                  ↑ NO PHOTOS LOADED — TAP A CARD IN THE RACK
                </p>
              )}
            </div>

          </div>{/* end col 3 */}

        </div>
      )}
    </div>
  );
}
