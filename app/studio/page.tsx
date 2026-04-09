"use client";

import { AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import RansomHeader from "@/components/RansomHeader";
import UploadGarmentModal, { type ClosetItem } from "@/components/UploadGarmentModal";
import ClientStage, { type FitState } from "@/components/ClientStage";
import { getRailsToken } from "@/lib/auth-utils";
import { parseGarmentsResponse } from "@/lib/garments";

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase     = "idle" | "parsing" | "result" | "error";
type FaultKind = "unauthorized" | "corrupt";
type SidebarTab = "store" | "closet";

interface Material {
  id: number;
  name: string;
  tag: string;
  photo: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RAILS_URL    = process.env.NEXT_PUBLIC_RAILS_API_URL ?? "http://localhost:3001";
const MAX_DIM      = 1024;
const JPEG_Q       = 0.7;
const MANNEQUIN_W  = 280;
const MANNEQUIN_H  = 480;
const WAIST_Y_PCT  = 0.565; // y ≈ 271 → matches the waist-notch ellipse in the SVG path

const TOP_GARMENT_TYPES    = ["T-Shirt", "Crop Top", "Blouse", "Corset", "Tank Top", "Button-down"];
const BOTTOM_GARMENT_TYPES = ["Pants", "Shorts", "Skirt", "Miniskirt", "Cargo", "Sweats"];
const FULL_GARMENT_TYPES   = ["Dress", "Jumpsuit", "1-Piece Swimsuit", "2-Piece Swimsuit"];

// ─── Scene Picker ─────────────────────────────────────────────────────────────
// Results screen: the client gets placed into these locations.
const SCENES = [
  { id: "studio",   label: "WHITE STUDIO",   color: "#f0ede8", textColor: "#111111", value: "harsh minimalist white studio void, high-end editorial lighting, stark clean background" },
  { id: "concrete", label: "CONCRETE BLOCK", color: "#6b7280", textColor: "#ffffff", value: "gritty abandoned brutalist concrete apartment block, peeling paint, natural light flooding through broken windows" },
  { id: "rave",     label: "TECHNO RAVE",    color: "#111111", textColor: "#facc15", value: "dark underground Berlin techno rave, laser strobe lights, dense dry ice fog, industrial warehouse" },
  { id: "beach",    label: "HIDDEN BEACH",   color: "#06b6d4", textColor: "#ffffff", value: "pristine secluded tropical beach, towering limestone cliffs, crystal turquoise water" },
  { id: "market",   label: "NIGHT MARKET",   color: "#dc2626", textColor: "#ffffff", value: "chaotic Bangkok night market at midnight, neon signage, street food smoke, warm amber glow" },
  { id: "rooftop",  label: "CITY ROOFTOP",   color: "#f97316", textColor: "#111111", value: "cinematic New York City rooftop at golden hour, skyline silhouette, water towers, harsh long shadows" },
  { id: "forest",   label: "DARK FOREST",    color: "#166534", textColor: "#ffffff", value: "dense misty old-growth forest, dappled light through ancient trees, moss-covered rocks, ethereal fog" },
  { id: "gallery",  label: "ART GALLERY",    color: "#e5e7eb", textColor: "#111111", value: "stark white cube gallery, precise track lighting, polished concrete floor, contemporary art context" },
] as const;
type SceneId = typeof SCENES[number]["id"];



// ─── Mock Catalog ─────────────────────────────────────────────────────────────

const INITIAL_CATALOG: Material[] = [
  { id: 1,  name: "DIGITAL CAMO FIELD JACKET",       tag: "RIPSTOP UTILITY OUTERWEAR",      photo: "/inventory/digital-camo-field-jacket.webp" },
  { id: 2,  name: "BLACK TUBE TOP",                  tag: "STRETCH KNIT",                   photo: "/inventory/black-tube-top.webp" },
  { id: 3,  name: "NAVY WORK JACKET",                tag: "UTILITY SHELL",                  photo: "/inventory/navy-work-jacket.webp" },
  { id: 4,  name: "BLUSH LACE PARTY DRESS",          tag: "EMBROIDERED TULLE",              photo: "/inventory/blush-lace-party-dress.png" },
  { id: 5,  name: "WOODLAND CAMO CARGO PANTS",       tag: "TACTICAL COTTON BLEND",          photo: "/inventory/woodland-camo-cargo-pants.webp" },
  { id: 6,  name: "OVERSIZED BLUE PLAID FLANNEL",    tag: "BRUSHED COTTON",                 photo: "/inventory/oversized-blue-plaid-flannel.webp" },
  { id: 7,  name: "DIGITAL CAMO TACTICAL PANTS",     tag: "RIPSTOP FIELDWEAR",              photo: "/inventory/digital-camo-tactical-pants.webp" },
  { id: 8,  name: "BLACK LACE UP CROPPED TEE",       tag: "SOFT COTTON JERSEY",             photo: "/inventory/black-lace-up-cropped-tee.png" },
  { id: 9,  name: "BLACK GOTHIC MESH TOP",           tag: "SHEER STRETCH MESH",             photo: "/inventory/black-gothic-mesh-top.png" },
  { id: 10, name: "BLACK LACE TRIM MESH TOP",        tag: "SHEER KNIT",                     photo: "/inventory/black-lace-trim-mesh-top.png" },
  { id: 11, name: "RED PLAID MINI SKIRT",            tag: "PUNK TARTAN WEAVE",              photo: "/inventory/red-plaid-mini-skirt.png" },
  { id: 12, name: "BLACK CHAIN MINI SKIRT",          tag: "PLEATED TWILL",                  photo: "/inventory/black-chain-mini-skirt.png" },
  { id: 13, name: "BLACK LACE UP FLARE PANTS",       tag: "STRETCH KNIT",                   photo: "/inventory/black-lace-up-flare-pants.png" },
  { id: 14, name: "BLACK DRAPED OFF SHOULDER DRESS", tag: "BODYCON JERSEY",                 photo: "/inventory/black-draped-off-shoulder-dress.png" },
  { id: 15, name: "RED SATIN COCKTAIL DRESS",        tag: "LUSTROUS SATIN",                 photo: "/inventory/red-satin-cocktail-dress.png" },
  { id: 16, name: "BLUSH LACE COCKTAIL DRESS",       tag: "EMBROIDERED TULLE",              photo: "/inventory/blush-lace-cocktail-dress.png" },
  { id: 17, name: "SILVER DRAPED COCKTAIL DRESS",    tag: "RUCHED STRETCH SATIN",           photo: "/inventory/silver-draped-cocktail-dress.png" },
  { id: 18, name: "BROWN PLAID FLANNEL SHIRT",       tag: "BRUSHED COTTON",                 photo: "/inventory/brown-plaid-flannel-shirt.webp" },
  { id: 19, name: "OLIVE FIELD JACKET",              tag: "MILITARY CANVAS",                photo: "/inventory/olive-field-jacket.webp" },
  { id: 20, name: "RED BUFFALO PLAID FLANNEL",       tag: "HEAVYWEIGHT BRUSHED COTTON",     photo: "/inventory/red-buffalo-plaid-flannel.webp" },
  { id: 21, name: "FLORAL SMOCKED SUNDRESS",         tag: "LIGHTWEIGHT COTTON",             photo: "/inventory/floral-smocked-sundress.png" },
  { id: 22, name: "OLIVE FLEECE SWEATSHIRT",         tag: "BRUSHED FLEECE KNIT",            photo: "/inventory/olive-fleece-sweatshirt.png" },
  { id: 23, name: "LIGHT WASH STRAIGHT JEANS",       tag: "CLASSIC DENIM",                  photo: "/inventory/light-wash-straight-jeans.png" },
  { id: 24, name: "BEIGE TRENCH COAT",               tag: "STRUCTURED COTTON TWILL",        photo: "/inventory/beige-trench-coat.png" },
  { id: 25, name: "LIGHT BLUE BUTTON UP SHIRT",      tag: "CRISP COTTON POPLIN",            photo: "/inventory/light-blue-button-up-shirt.png" },
  { id: 26, name: "BEIGE CARGO JOGGERS",             tag: "UTILITY COTTON BLEND",           photo: "/inventory/beige-cargo-joggers.png" },
  { id: 27, name: "TAUPE LINEN BUTTON UP",           tag: "WASHED LINEN BLEND",             photo: "/inventory/taupe-linen-button-up.png" },
  { id: 28, name: "BEIGE PLAID MIDI SKIRT",          tag: "SOFT WOVEN PLAID",               photo: "/inventory/beige-plaid-midi-skirt.png" },
  { id: 29, name: "WHITE CLASSIC TSHIRT",            tag: "COTTON JERSEY",                  photo: "/inventory/white-classic-tshirt.png" },
  { id: 30, name: "HEATHER GRAY CLASSIC TSHIRT",     tag: "COTTON JERSEY",                  photo: "/inventory/heather-gray-classic-tshirt.png" },
  { id: 31, name: "BLACK CLASSIC TSHIRT",            tag: "COTTON JERSEY",                  photo: "/inventory/black-classic-tshirt.png" },
  { id: 32, name: "SKY BLUE CLASSIC TSHIRT",         tag: "COTTON JERSEY",                  photo: "/inventory/sky-blue-classic-tshirt.png" },
  { id: 33, name: "SAGE CLASSIC TSHIRT",             tag: "COTTON JERSEY",                  photo: "/inventory/sage-classic-tshirt.png" },
  { id: 34, name: "BLUSH CLASSIC TSHIRT",            tag: "COTTON JERSEY",                  photo: "/inventory/blush-classic-tshirt.png" },
  { id: 35, name: "LAVENDER CLASSIC TSHIRT",         tag: "COTTON JERSEY",                  photo: "/inventory/lavender-classic-tshirt.png" },
  { id: 36, name: "CREAM CLASSIC TSHIRT",            tag: "COTTON JERSEY",                  photo: "/inventory/cream-classic-tshirt.png" },
  { id: 37, name: "RED CLASSIC TSHIRT",              tag: "COTTON JERSEY",                  photo: "/inventory/red-classic-tshirt.png" },
  { id: 38, name: "ROSE CLASSIC TSHIRT",             tag: "COTTON JERSEY",                  photo: "/inventory/rose-classic-tshirt.png" },
  { id: 39, name: "YELLOW CLASSIC TSHIRT",           tag: "COTTON JERSEY",                  photo: "/inventory/yellow-classic-tshirt.png" },
  { id: 40, name: "FOREST GREEN CLASSIC TSHIRT",     tag: "COTTON JERSEY",                  photo: "/inventory/forest-green-classic-tshirt.png" },
  { id: 41, name: "OLIVE UTILITY OVERSHIRT",         tag: "MILITARY COTTON TWILL",          photo: "/inventory/olive-utility-overshirt.jpg" },
  { id: 42, name: "WOODLAND CAMO OVERSHIRT",         tag: "BRUSHED FIELD COTTON",           photo: "/inventory/woodland-camo-overshirt.jpg" },
  { id: 43, name: "GUNS N ROSES GRAPHIC TEE",        tag: "VINTAGE WASH COTTON",            photo: "/inventory/guns-n-roses-graphic-tee.webp" },
  { id: 44, name: "MULTICAM RUCHED LONG SLEEVE TOP", tag: "STRETCH PERFORMANCE KNIT",       photo: "/inventory/multicam-ruched-long-sleeve-top.jpg" },
  { id: 45, name: "WHITE HANGING TEE",               tag: "MINIMAL COTTON JERSEY",          photo: "/inventory/white-hanging-tee.jpg" },
  { id: 46, name: "BROWN PLAID WORK SHIRT",          tag: "HEAVY BRUSHED FLANNEL",          photo: "/inventory/brown-plaid-work-shirt.webp" },
  { id: 47, name: "BLACK HANGING TEE",               tag: "MINIMAL COTTON JERSEY",          photo: "/inventory/black-hanging-tee.jpg" },
  { id: 48, name: "DENIM BUTTON UP SHIRT",           tag: "LIGHTWEIGHT CHAMBRAY",           photo: "/inventory/denim-button-up-shirt.jpg" },
  { id: 49, name: "NIRVANA GRAPHIC TEE",             tag: "VINTAGE WASH COTTON",            photo: "/inventory/nirvana-graphic-tee.webp" },
  { id: 50, name: "DESERT CAMO CARGO PANTS",         tag: "TACTICAL RIPSTOP",               photo: "/inventory/desert-camo-cargo-pants.webp" },
];

// ─── Prompt Compiler ─────────────────────────────────────────────────────────

function compileUserVision(params: {
  garmentTypeTop: string;
  garmentTypeBottom: string;
  garmentTypeFull: string;
  widthScale:   number; // from 3D handles (0.4–2.0)
  hemLength:    number; // from 3D handles (0.3–2.0)
  distressLevel: number;
  asymmetry: number;
}): string {
  const { garmentTypeTop, garmentTypeBottom, garmentTypeFull, widthScale, hemLength, distressLevel, asymmetry } = params;

  const fitDesc =
    widthScale >= 1.7 ? "extremely oversized" :
    widthScale >= 1.3 ? "heavily oversized"   :
    widthScale >= 0.9 ? "relaxed"             :
    widthScale >= 0.7 ? "fitted"              : "extremely form-fitting";

  const lengthDesc =
    hemLength <= 0.45 ? "heavily cropped"   :
    hemLength <= 0.70 ? "cropped"           :
    hemLength <= 1.10 ? "mid-length"        :
    hemLength <= 1.55 ? "long"              : "dramatically draped";

  const distressDesc =
    distressLevel >= 70 ? " with extreme distressing and decay" :
    distressLevel >= 40 ? " with moderate distressing"          :
    distressLevel >= 15 ? " with subtle wear"                   : "";

  const asymDesc =
    asymmetry >= 70 ? ", brutally asymmetrical construction" :
    asymmetry >= 40 ? ", with asymmetrical elements"         : "";

  let garmentDesc: string;
  if (garmentTypeFull) {
    garmentDesc = `A ${fitDesc}, ${lengthDesc} ${garmentTypeFull}`;
  } else if (garmentTypeTop && garmentTypeBottom) {
    garmentDesc = `A ${fitDesc} ${garmentTypeTop} paired with a ${lengthDesc} ${garmentTypeBottom}`;
  } else if (garmentTypeTop) {
    garmentDesc = `A ${fitDesc}, ${lengthDesc} ${garmentTypeTop}`;
  } else if (garmentTypeBottom) {
    garmentDesc = `A ${fitDesc}, ${lengthDesc} ${garmentTypeBottom}`;
  } else {
    garmentDesc = `A ${fitDesc}, ${lengthDesc} upcycled garment`;
  }

  return `${garmentDesc}${distressDesc}${asymDesc}.`;
}

// ─── Image helpers ────────────────────────────────────────────────────────────

function compressToJpeg(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img       = new window.Image();

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

    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("IMAGE LOAD FAILED.")); };
    img.src = objectUrl;
  });
}

// ─── Zone Canvas Compositor ───────────────────────────────────────────────────
// Draws fabrics (and optionally the client's own photo) onto a single canvas.
// The resulting JPEG data-URL is the image_url sent to the AI.
//
// When clientPhoto is provided:
//   • Draw the client photo as the full-frame base layer
//   • Overlay fabric textures in their zones with multiply blend
//   → AI receives: "person + fabrics draping over them" → generates them wearing it
//
// When no clientPhoto:
//   • Draw fabric zones on a neutral background (original behaviour)
//   → AI receives: pure fabric reference → generates garment on a mannequin

async function composeZoneCanvas(
  topPhoto:    string | null,
  bottomPhoto: string | null,
  clientPhoto: string | null = null,
): Promise<string> {
  const W      = MANNEQUIN_W;
  const H      = MANNEQUIN_H;
  const splitY = Math.round(H * WAIST_Y_PCT);

  const canvas = document.createElement("canvas");
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const loadImg = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const el       = new window.Image();
      el.crossOrigin = "anonymous";
      el.onload      = () => resolve(el);
      el.onerror     = () => reject(new Error(`Cannot load: ${src}`));
      el.src         = src;
    });

  const drawCover = (img: HTMLImageElement, y: number, bandH: number) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y, W, bandH);
    ctx.clip();
    const scale = Math.max(W / img.naturalWidth, bandH / img.naturalHeight);
    const dw    = img.naturalWidth  * scale;
    const dh    = img.naturalHeight * scale;
    ctx.drawImage(img, (W - dw) / 2, y + (bandH - dh) / 2, dw, dh);
    ctx.restore();
  };

  if (clientPhoto) {
    // ── Base: client photo fills the full frame ──
    const clientImg = await loadImg(clientPhoto);
    drawCover(clientImg, 0, H);

    // ── Fabric zone overlays — multiply blend ──
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.6;
    if (topPhoto)    { const img = await loadImg(topPhoto);    drawCover(img, 0,      splitY); }
    if (bottomPhoto) { const img = await loadImg(bottomPhoto); drawCover(img, splitY, H - splitY); }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  } else {
    // ── Original behaviour: neutral background + fabric zones ──
    ctx.fillStyle = "#f4f4f0";
    ctx.fillRect(0, 0, W, H);
    if (topPhoto)    { const img = await loadImg(topPhoto);    drawCover(img, 0,      splitY); }
    if (bottomPhoto) { const img = await loadImg(bottomPhoto); drawCover(img, splitY, H - splitY); }
  }

  return canvas.toDataURL("image/jpeg", 0.85);
}

// ─── Mannequin SVG ────────────────────────────────────────────────────────────



// ─── Dropdown ─────────────────────────────────────────────────────────────────

function BlueprintSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "— SELECT —",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-mono text-[0.52rem] font-black uppercase tracking-[0.12em] text-[#111111]/55">
        {label}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="border-2 border-[#111111] bg-white px-2 py-1.5 font-mono text-xs font-bold text-[#111111] transition-colors duration-75 focus:bg-[#facc15] focus:outline-none"
      >
        <option value="">{placeholder}</option>
        {options.map(t => (
          <option key={t} value={t}>{t.toUpperCase()}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StudioPage() {
  const router = useRouter();

  // ── Sidebar ───────────────────────────────────────────────────────────────
  const [sidebarTab,      setSidebarTab]      = useState<SidebarTab>("store");
  const [myCloset,        setMyCloset]        = useState<ClosetItem[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Ruby mode flag lives in the API payload via styleMode arg, no local state needed

  // ── Zone fabrics ──────────────────────────────────────────────────────────
  const [selectedTopFabric,    setSelectedTopFabric]    = useState<Material | null>(null);
  const [selectedBottomFabric, setSelectedBottomFabric] = useState<Material | null>(null);

  // ── Phase + result ────────────────────────────────────────────────────────
  const [phase,             setPhase]             = useState<Phase>("idle");
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string>("");
  const [apiError,          setApiError]          = useState<string>("");
  const [faultKind,         setFaultKind]         = useState<FaultKind | null>(null);

  // ── Structural blueprint ──────────────────────────────────────────────────
  const [garmentTypeTop,    setGarmentTypeTop]    = useState("");
  const [garmentTypeBottom, setGarmentTypeBottom] = useState("");
  const [garmentTypeFull,   setGarmentTypeFull]   = useState("");

  // ── Existing decay / asymmetry controls ──────────────────────────────────
  const [distressLevel, setDistressLevel] = useState(50);
  const [asymmetry,     setAsymmetry]     = useState(50);

  // ── Client metrics ────────────────────────────────────────────────────────
  // Default to dress-form size 8 reference: 5'8" / 34-26-36 in imperial
  const [metrics, setMetrics] = useState({ height: "68", chest: "34", waist: "26", hips: "36" });
  const [unit,    setUnit]    = useState<"imperial" | "metric">("imperial");

  // ── Catalog search ────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");

  // ── Drag state ────────────────────────────────────────────────────────────
  const [isDragOverTop,    setIsDragOverTop]    = useState(false);
  const [isDragOverBottom, setIsDragOverBottom] = useState(false);

  const nextDropId   = useRef(-1);
  const scanInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastVision   = useRef("");

  // ── 3D body-scan mesh upload ────────────────────────────────────────────────
  const meshInputRef = useRef<HTMLInputElement>(null);
  const [meshUploading, setMeshUploading] = useState(false);
  const [meshUrl,       setMeshUrl]       = useState<string | null>(null);

  // ── Client photo (the client IS the model) ───────────────────────────────
  const clientPhotoRef = useRef<HTMLInputElement>(null);
  const [clientPhoto, setClientPhoto] = useState<string | null>(null);

  // ── Scene selection (results screen) ────────────────────────────────────
  const [selectedScene, setSelectedScene] = useState<SceneId>("studio");

  // ── Fit/length sliders (replaces 3D handle drags) ───────────────────────
  const [fitWidth,  setFitWidth]  = useState(1.0);  // 0.5 tight → 2.0 oversized
  const [fitLength, setFitLength] = useState(1.0);  // 0.3 cropped → 2.0 draped

  // Derived: kept for compileUserVision compatibility
  const fitState: FitState = { widthScale: fitWidth, hemLength: fitLength };

  // ── Computed ──────────────────────────────────────────────────────────────
  const filteredCatalog = INITIAL_CATALOG.filter(
    m =>
      searchQuery.trim() === "" ||
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.tag.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const hasFabric      = !!(selectedTopFabric || selectedBottomFabric);
  const canReconstruct = hasFabric && phase !== "parsing";
  const bothZonesLoaded = !!(selectedTopFabric && selectedBottomFabric);

  // ── Onboarding gate (Rails /me) — client-side; middleware only checks auth ─
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = getRailsToken();
      if (!token) return;
      try {
        const res = await fetch(`${RAILS_URL}/api/v1/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const me = (await res.json()) as { onboarding_complete?: boolean; face_photo_url?: string };
        if (cancelled) return;
        if (me.onboarding_complete === false) {
          router.replace("/onboarding");
        }
        // Pre-populate the client photo from the saved face photo
        if (me.face_photo_url && !clientPhoto) {
          setClientPhoto(me.face_photo_url);
        }
      } catch {
        /* Rails offline — keep studio usable */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // ── Scan message ticker ───────────────────────────────────────────────────
  useEffect(() => () => { if (scanInterval.current) clearInterval(scanInterval.current); }, []);

  useEffect(() => {
    if (phase === "parsing") {
    } else {
      if (scanInterval.current) { clearInterval(scanInterval.current); scanInterval.current = null; }
    }
    return () => { if (scanInterval.current) { clearInterval(scanInterval.current); scanInterval.current = null; } };
  }, [phase]);

  // ── My Closet: fetch from Rails on tab switch ─────────────────────────────
  const fetchMyCloset = useCallback(async () => {
    const token = getRailsToken();
    try {
      const res = await fetch("http://localhost:3001/api/v1/garments", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      const data = await res.json();
      setMyCloset(parseGarmentsResponse(data));
    } catch { /* Rails not running — closet stays local */ }
  }, []);

  useEffect(() => {
    if (sidebarTab === "closet") fetchMyCloset();
  }, [sidebarTab, fetchMyCloset]);

  // ── Clear garment types when zones cleared ────────────────────────────────
  useEffect(() => { if (!selectedTopFabric)    setGarmentTypeTop(""); },    [selectedTopFabric]);
  useEffect(() => { if (!selectedBottomFabric) setGarmentTypeBottom(""); }, [selectedBottomFabric]);
  useEffect(() => { if (!bothZonesLoaded)      setGarmentTypeFull(""); },   [bothZonesLoaded]);

  // ── Catalog click: assigns to first empty zone ────────────────────────────
  const handleClickGarment = (m: Material) => {
    if (phase === "parsing") return;
    if (selectedTopFabric?.id === m.id) { setSelectedTopFabric(null); return; }
    if (selectedBottomFabric?.id === m.id) { setSelectedBottomFabric(null); return; }
    if (!selectedTopFabric)    { setSelectedTopFabric(m); }
    else if (!selectedBottomFabric) { setSelectedBottomFabric(m); }
    else                       { setSelectedTopFabric(m); }
    setPhase("idle");
    setApiError("");
    setFaultKind(null);
  };

  // ── Zone drag-and-drop ────────────────────────────────────────────────────
  const handleDropOnZone = async (e: React.DragEvent<HTMLDivElement>, zone: "top" | "bottom") => {
    e.preventDefault();
    if (zone === "top") setIsDragOverTop(false); else setIsDragOverBottom(false);
    const setFabric = zone === "top" ? setSelectedTopFabric : setSelectedBottomFabric;

    // File from OS filesystem
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
    if (files.length > 0) {
      try {
        const base64  = await compressToJpeg(files[0]);
        const dataUrl = `data:image/jpeg;base64,${base64}`;
        setFabric({ id: nextDropId.current--, name: files[0].name.replace(/\.[^.]+$/, "").toUpperCase(), tag: "DROPPED FILE", photo: dataUrl });
      } catch { /* silent */ }
      return;
    }

    // Catalog card drag
    const materialId = e.dataTransfer.getData("text/plain");
    if (materialId) {
      const id  = parseInt(materialId, 10);
      const mat = INITIAL_CATALOG.find(m => m.id === id);
      if (mat) setFabric(mat);
    }
  };

  // ── RECONSTRUCT — calls Rails API → Fal.ai ────────────────────────────────
  const handleReconstruct = async (styleMode: "normal" | "ruby" = "normal") => {
    if (phase === "parsing") return;

    const topPhoto    = selectedTopFabric?.photo    ?? null;
    const bottomPhoto = selectedBottomFabric?.photo ?? null;

    if (!topPhoto && !bottomPhoto) {
      setFaultKind("corrupt");
      setApiError("DROP AT LEAST ONE FABRIC ONTO THE MANNEQUIN FIRST.");
      setPhase("error");
      return;
    }

    const userVision = compileUserVision({ garmentTypeTop, garmentTypeBottom, garmentTypeFull, widthScale: fitState.widthScale, hemLength: fitState.hemLength, distressLevel, asymmetry });
    lastVision.current = userVision;

    console.log("[OOPS AI // BLUEPRINT]", {
      userVision,
      top:     selectedTopFabric?.name,
      bottom:  selectedBottomFabric?.name,
      metrics,
    });

    setApiError("");
    setFaultKind(null);
    setPhase("parsing");

    let compositeDataUrl: string;
    try {
      compositeDataUrl = await composeZoneCanvas(topPhoto, bottomPhoto, clientPhoto);
    } catch {
      setFaultKind("corrupt");
      setApiError("FAILED TO COMPOSITE FABRIC ZONES.");
      setPhase("error");
      return;
    }

    const sceneValue = SCENES.find(s => s.id === selectedScene)?.value ?? null;

    try {
      const token = getRailsToken();
      const res = await fetch("http://localhost:3001/api/v1/generations", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          image_url:      compositeDataUrl,
          client_photo:   clientPhoto,        // person reference for VTON-style AI
          user_vision:    userVision,
          location:       sceneValue,
          style_mode:     styleMode === "ruby" ? "ruby" : null,
          fit_state:      fitState,
        }),
      });

      let json: { image_url?: string; error?: string; details?: string };
      try {
        json = await res.json();
      } catch {
        setFaultKind("corrupt");
        setApiError("SIGNAL LOST — INVALID RESPONSE FROM SERVER.");
        setPhase("error");
        return;
      }

      if (!res.ok || !json.image_url) {
        setFaultKind("corrupt");
        setApiError(json.error?.trim() || json.details?.trim() || "RECONSTRUCTION FAILED — CHECK FAL_KEY ENV VAR.");
        setPhase("error");
        return;
      }

      setGeneratedImageUrl(json.image_url);
      setPhase("result");
    } catch (err: unknown) {
      setFaultKind("corrupt");
      setApiError(err instanceof Error ? err.message : "NETWORK FAILURE — IS THE RAILS SERVER RUNNING?");
      setPhase("error");
    }
  };

  const handleReset = () => {
    setSelectedTopFabric(null);
    setSelectedBottomFabric(null);
    setPhase("idle");
    setGeneratedImageUrl("");
    setApiError("");
    setFaultKind(null);
    setGarmentTypeTop(""); setGarmentTypeBottom(""); setGarmentTypeFull("");
    setFitWidth(1); setFitLength(1);
  };

  const handleReroll = () => {
    setPhase("idle");
    setGeneratedImageUrl("");
    setApiError("");
    setFaultKind(null);
  };

  const handleExport = async () => {
    if (!generatedImageUrl) return;
    try {
      const res  = await fetch(generatedImageUrl);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `OOPS_RECONSTRUCT_${Date.now()}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(generatedImageUrl, "_blank");
    }
  };

  // ── Client photo upload ───────────────────────────────────────────────────
  // The client uploads a photo of themselves — they become the model.
  // Compressed to JPEG (same compressToJpeg util) then stored as a data URL.
  // No server upload needed — stays local for the AI canvas composite.

  const handleClientPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await compressToJpeg(file);
      setClientPhoto(`data:image/jpeg;base64,${base64}`);
    } catch { /* silent — photo stays null */ }
    if (clientPhotoRef.current) clientPhotoRef.current.value = "";
  };

  // ── 3D mesh upload → Rails Active Storage ────────────────────────────────
  //
  // RAILS PARALLEL: This is the client-side half of a multipart file upload.
  // On the Rails side, Active Storage handles the heavy lifting:
  //
  //   model User < ApplicationRecord
  //     has_one_attached :avatar_mesh    # ← this one line gives you:
  //   end                                #    • user.avatar_mesh.attach(file)
  //                                      #    • user.avatar_mesh.attached?
  //                                      #    • rails_blob_url(user.avatar_mesh)
  //
  // The key browser API rule: when sending a file via fetch(), you MUST use
  // FormData — never JSON.stringify a File object. And you must NOT manually
  // set Content-Type, because the browser needs to auto-generate the
  // multipart boundary string (e.g. "multipart/form-data; boundary=----abc123").
  // If you set it yourself, the boundary won't match and Rails will reject it.

  const handleMeshUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMeshUploading(true);
    setMeshUrl(null);

    try {
      const token = typeof window !== "undefined"
        ? getRailsToken()
        : null;

      const formData = new FormData();
      formData.append("avatar_mesh", file);

      const res = await fetch(`${RAILS_URL}/api/v1/users/update_mesh`, {
        method: "PATCH",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.error("[MESH UPLOAD FAILED]", res.status, errBody);
        return;
      }

      const data = await res.json() as { mesh_url?: string };
      if (data.mesh_url) {
        setMeshUrl(data.mesh_url);
        console.log("[MESH UPLOAD OK]", data.mesh_url);
      }
    } catch (err) {
      console.error("[MESH UPLOAD ERROR]", err);
    } finally {
      setMeshUploading(false);
      if (meshInputRef.current) meshInputRef.current.value = "";
    }
  };


  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden px-3 pb-3 pt-3 normal-case sm:px-4 sm:pt-4 lg:h-full lg:overflow-hidden lg:px-6 lg:pt-5">

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <header className="mb-2 flex flex-shrink-0 items-end justify-between gap-2 sm:mb-3 sm:gap-3">
        <RansomHeader text="OOPS WORK BENCH" />
        <p className="hidden rotate-[0.5deg] border-l-4 border-[#facc15] bg-white px-3 py-1.5 font-mono text-xs normal-case leading-relaxed tracking-wide text-[#111111]/70 shadow-[3px_3px_0_0_#111111] md:block">
          the world has enough new clothes. we work with what&apos;s already here.
        </p>
        <div className="h-[3px] w-8 bg-[#111111] md:hidden" />
      </header>

      <div className="mb-2 h-[3px] w-full flex-shrink-0 bg-[#111111] sm:mb-3" />

      {/* ══════════════════════════════════════════════════════════════════
          RESULT SCREEN
      ══════════════════════════════════════════════════════════════════ */}
      {phase === "result" && generatedImageUrl && (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden sm:gap-4 lg:grid-cols-12 lg:h-full">

          {/* LEFT — Generated image (the look) */}
          <div className="flex min-h-[55vh] flex-col overflow-hidden border-4 border-[#111111] shadow-[6px_6px_0_0_#111111] sm:shadow-[8px_8px_0_0_#111111] lg:col-span-7 lg:h-full lg:min-h-0">
            <div className="flex-shrink-0 border-b-4 border-[#111111] bg-white px-3 py-2 sm:px-5 sm:py-3">
              <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                <span className="inline-block rotate-[2deg] border-2 border-[#111111] bg-[#111111] px-1.5 py-0.5 font-mono text-[0.6rem] font-black tracking-[0.1em] text-[#facc15] shadow-[2px_2px_0_0_#facc15] sm:px-2 sm:py-1 sm:text-xs">YOUR</span>
                <span className="inline-block -rotate-1 border-2 border-[#111111] bg-[#dc2626] px-1.5 py-0.5 font-mono text-[0.6rem] font-black tracking-[0.1em] text-white shadow-[2px_2px_0_0_#111111] sm:px-2 sm:py-1 sm:text-xs">LOOK</span>
              </div>
              <p className="mt-1 font-mono text-[0.6rem] tracking-[0.12em] text-[#111111]/50 sm:mt-1.5 sm:tracking-[0.14em]">
                {lastVision.current || "OOPS VISION ENGINE — GENERATION COMPLETE"}
              </p>
            </div>
            <div
              className="min-h-0 flex-1 overflow-hidden bg-[#f8f7f4] flex items-center justify-center p-2 sm:p-4"
              style={{
                backgroundImage: "linear-gradient(to right, #e5e7eb 1px, transparent 1px), linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={generatedImageUrl}
                alt="OOPS Generated Look"
                className="max-h-full max-w-full object-contain border-4 border-[#111111] shadow-[4px_4px_0_0_#111111] sm:shadow-[8px_8px_0_0_#111111]"
              />
            </div>
            {/* Export / re-mash strip */}
            <div className="flex-shrink-0 border-t-4 border-[#111111] bg-punk-halftone p-2 flex gap-2 sm:p-3">
              <button type="button" onClick={handleExport}
                className="flex-1 border-4 border-[#111111] bg-[#facc15] px-3 py-2.5 font-mono text-xs font-black tracking-[0.12em] text-[#111111] shadow-[4px_4px_0_0_#111111] transition-all duration-75 hover:bg-[#111111] hover:text-[#facc15] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none">
                [ SAVE ]
              </button>
              <button type="button" onClick={handleReroll}
                className="flex-1 border-4 border-[#111111] bg-[#ff007f] px-3 py-2.5 font-mono text-xs font-black tracking-[0.12em] text-white shadow-[4px_4px_0_0_#111111] transition-all duration-75 hover:bg-[#111111] hover:text-[#ff007f] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none">
                [ TWEAK ]
              </button>
              <button type="button" onClick={handleReset}
                className="border-2 border-[#111111]/40 bg-white px-3 py-2.5 font-mono text-xs font-black tracking-[0.1em] text-[#111111]/50 transition-all duration-75 hover:border-[#111111] hover:text-[#111111]">
                ↩
              </button>
            </div>
          </div>

          {/* RIGHT — Scene placement picker */}
          <div className="flex min-h-0 flex-col overflow-hidden border-4 border-[#111111] shadow-[6px_6px_0_0_#111111] sm:shadow-[8px_8px_0_0_#111111] lg:col-span-5 lg:h-full">
            <div className="flex-shrink-0 border-b-4 border-[#111111] bg-[#111111] px-3 py-2 sm:px-4 sm:py-3">
              <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                <span className="inline-block rotate-[2deg] border-2 border-[#facc15] bg-[#facc15] px-1.5 py-0.5 font-mono text-[0.6rem] font-black tracking-[0.1em] text-[#111111] sm:px-2 sm:py-1 sm:text-xs">PLACE</span>
                <span className="inline-block -rotate-1 border-2 border-white px-1.5 py-0.5 font-mono text-[0.6rem] font-black tracking-[0.1em] text-white sm:px-2 sm:py-1 sm:text-xs">HER</span>
              </div>
              <p className="mt-1 font-mono text-[0.6rem] tracking-[0.12em] text-white/40 sm:mt-1.5 sm:tracking-[0.14em]">
                SELECT A SCENE — REGENERATE IN THAT WORLD
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-punk-halftone p-3 sm:p-4">
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {SCENES.map(scene => {
                  const isActive = selectedScene === scene.id;
                  return (
                    <button
                      key={scene.id}
                      type="button"
                      onClick={() => {
                        setSelectedScene(scene.id);
                        handleReconstruct("normal");
                      }}
                      className={`relative flex flex-col items-start gap-2 border-4 p-3 font-mono text-left transition-all duration-75 active:scale-95 ${
                        isActive
                          ? "border-[#facc15] shadow-[4px_4px_0_0_#facc15] scale-[1.02]"
                          : "border-[#111111] shadow-[3px_3px_0_0_#111111] hover:shadow-[5px_5px_0_0_#111111] hover:scale-[1.01]"
                      }`}
                      style={{ backgroundColor: scene.color }}
                    >
                      {isActive && (
                        <span className="absolute right-2 top-2 bg-[#facc15] px-1 font-mono text-[0.45rem] font-black text-[#111111]">
                          ✓ ACTIVE
                        </span>
                      )}
                      <span
                        className="text-[0.58rem] font-black tracking-[0.14em] sm:text-[0.65rem]"
                        style={{ color: scene.textColor }}
                      >
                        {scene.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-4 text-center font-mono text-[0.5rem] tracking-[0.14em] text-[#111111]/30">
                CLICK A SCENE TO REGENERATE
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MAIN WORKBENCH — 3 columns
      ══════════════════════════════════════════════════════════════════ */}
      {phase !== "result" && (
        <div className="flex flex-col gap-3 sm:gap-4 lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-12 lg:gap-4 lg:h-full lg:overflow-hidden">

          {/* ══════════════════════════════════
              COL 1 — MATERIAL CATALOG
          ══════════════════════════════════ */}
          <div className="flex h-[40vh] flex-col overflow-hidden border-4 border-[#111111] shadow-[6px_6px_0_0_#111111] sm:h-[50vh] sm:shadow-[8px_8px_0_0_#111111] lg:col-span-3 lg:h-full">

            {/* ── Tab bar — min 44px touch target ── */}
            <div className="flex flex-shrink-0 border-b-4 border-[#111111]">
              {(["store", "closet"] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setSidebarTab(tab)}
                  className={`flex-1 border-r-4 border-[#111111] py-3 font-mono text-xs font-black tracking-[0.1em] transition-colors last:border-r-0 sm:tracking-[0.14em] ${
                    sidebarTab === tab
                      ? "bg-[#111111] text-[#facc15]"
                      : "bg-white text-[#111111]/50 hover:bg-[#f4f4f0] hover:text-[#111111]"
                  }`}
                >
                  {tab === "store" ? "[ STORE ]" : "[ CLOSET ]"}
                </button>
              ))}
            </div>

            {/* ── Sub-header ── */}
            <div className="flex-shrink-0 border-b-2 border-[#111111]/15 bg-white px-4 py-2.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                {selectedTopFabric && (
                  <span className="inline-block rotate-[2deg] border-2 border-[#facc15] bg-[#facc15] px-1.5 py-0.5 font-mono text-[0.52rem] font-black tracking-[0.08em] text-[#111111]">TOP ✓</span>
                )}
                {selectedBottomFabric && (
                  <span className="inline-block -rotate-1 border-2 border-[#ff007f] bg-[#ff007f] px-1.5 py-0.5 font-mono text-[0.52rem] font-black tracking-[0.08em] text-white">BTM ✓</span>
                )}
              </div>
              <p className="font-mono text-[0.6rem] tracking-[0.12em] text-[#111111]/40">
                {!selectedTopFabric && !selectedBottomFabric && "CLICK TO ASSIGN · DRAG TO ZONE"}
                {selectedTopFabric && !selectedBottomFabric && "TOP LOADED — ADD A BOTTOM"}
                {!selectedTopFabric && selectedBottomFabric && "BOTTOM LOADED — ADD A TOP"}
                {selectedTopFabric && selectedBottomFabric && "BOTH ZONES LOADED"}
              </p>
            </div>

            {/* ── STORE: search + grid ── */}
            {sidebarTab === "store" && (
              <>
                <div className="flex-shrink-0 border-b-4 border-[#111111] bg-white px-3 py-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="[ SEARCH DEADSTOCK... ]"
                    className="w-full border-2 border-[#111111] bg-white px-3 py-2 font-mono text-xs font-black uppercase tracking-[0.1em] text-[#111111] placeholder:normal-case placeholder:text-[#111111]/25 transition-colors duration-75 focus:bg-[#facc15] focus:placeholder:text-[#111111]/50 focus:outline-none"
                  />
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto bg-punk-halftone p-3 pb-10">
                  {filteredCatalog.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-12">
                      <p className="font-mono text-xs font-black tracking-[0.15em] text-[#111111]/40">NOTHING MATCHES</p>
                      <p className="font-mono text-[0.6rem] tracking-widest text-[#111111]/25">{`"${searchQuery}"`}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {filteredCatalog.map(material => {
                        const isTop    = selectedTopFabric?.id === material.id;
                        const isBottom = selectedBottomFabric?.id === material.id;
                        const isActive = isTop || isBottom;
                        return (
                          <div
                            key={material.id}
                            draggable
                            onDragStart={e => e.dataTransfer.setData("text/plain", material.id.toString())}
                            onClick={() => handleClickGarment(material)}
                            className={`flex cursor-pointer flex-col border-4 bg-white transition-all duration-75 hover:scale-[1.03] ${
                              isTop    ? "border-[#facc15] shadow-[4px_4px_0_0_#facc15] -rotate-1"  :
                              isBottom ? "border-[#ff007f] shadow-[4px_4px_0_0_#ff007f] rotate-1"   :
                                         "border-[#111111] shadow-[3px_3px_0_0_#111111] rotate-1 hover:shadow-[5px_5px_0_0_#111111]"
                            }`}
                          >
                            <div className="relative border-b-4 border-[#111111] bg-[#d4d4d0]" style={{ aspectRatio: "1/1" }}>
                              {material.photo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={material.photo} alt={material.name} className="h-full w-full object-cover transition-all duration-150 hover:brightness-110" />
                              ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-[#d4d4d0]">
                                  <span className="font-mono text-[0.6rem] font-black tracking-[0.12em] text-[#111111]/40">NO PHOTO</span>
                                </div>
                              )}
                              {isTop && (
                                <div className="absolute right-1 top-1 rotate-2 bg-[#facc15] px-1.5 py-0.5">
                                  <span className="font-mono text-[0.6rem] font-black tracking-widest text-[#111111]">TOP ✓</span>
                                </div>
                              )}
                              {isBottom && !isTop && (
                                <div className="absolute right-1 top-1 -rotate-2 bg-[#ff007f] px-1.5 py-0.5">
                                  <span className="font-mono text-[0.6rem] font-black tracking-widest text-white">BTM ✓</span>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col gap-0.5 bg-white px-2 py-2">
                              <p className={`font-mono text-[0.65rem] font-black leading-tight tracking-[0.08em] ${isActive ? "text-[#111111]" : "text-[#111111]"}`}>
                                {material.name}
                              </p>
                              <p className="font-mono text-[0.55rem] tracking-[0.06em] text-[#111111]/50">{material.tag}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <p className="mt-4 text-center font-mono text-xs tracking-[0.14em] text-[#111111]/40">
                    {searchQuery.trim() ? `${filteredCatalog.length} of ${INITIAL_CATALOG.length} ITEMS` : `${INITIAL_CATALOG.length} ITEMS IN STOCK`}
                  </p>
                </div>
              </>
            )}

            {/* ── MY CLOSET: uploaded garments ── */}
            {sidebarTab === "closet" && (
              <>
                <div className="flex-shrink-0 border-b-4 border-[#111111] bg-white px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(true)}
                    className="w-full border-2 border-dashed border-[#111111] bg-[#f4f4f0] px-3 py-2.5 font-mono text-xs font-black tracking-[0.12em] text-[#111111] transition-colors hover:border-solid hover:bg-[#facc15]"
                  >
                    + [ UPLOAD GARMENT ]
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto bg-punk-halftone p-3 pb-10">
                  {myCloset.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-16">
                      <p className="font-mono text-xs font-black tracking-[0.15em] text-[#111111]/40">CLOSET EMPTY</p>
                      <p className="font-mono text-[0.6rem] tracking-[0.1em] text-[#111111]/25">UPLOAD YOUR OWN GARMENTS ABOVE</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {myCloset.map(item => {
                        const mat: Material = { id: item.id, name: item.name, tag: item.tag, photo: item.photo || null };
                        const isTop    = selectedTopFabric?.id === mat.id;
                        const isBottom = selectedBottomFabric?.id === mat.id;
                        return (
                          <div
                            key={item.id}
                            draggable
                            onDragStart={e => e.dataTransfer.setData("text/plain", mat.id.toString())}
                            onClick={() => handleClickGarment(mat)}
                            className={`flex cursor-pointer flex-col border-4 bg-white transition-all duration-75 hover:scale-[1.03] ${
                              isTop    ? "border-[#facc15] shadow-[4px_4px_0_0_#facc15] -rotate-1" :
                              isBottom ? "border-[#ff007f] shadow-[4px_4px_0_0_#ff007f] rotate-1"  :
                                         "border-[#111111] shadow-[3px_3px_0_0_#111111] rotate-1 hover:shadow-[5px_5px_0_0_#111111]"
                            }`}
                          >
                            <div className="relative border-b-4 border-[#111111] bg-[#d4d4d0]" style={{ aspectRatio: "1/1" }}>
                              {item.photo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={item.photo} alt={item.name} className="h-full w-full object-cover" />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center bg-[#d4d4d0]">
                                  <span className="font-mono text-[0.6rem] text-[#111111]/40">NO PHOTO</span>
                                </div>
                              )}
                              {isTop    && <div className="absolute right-1 top-1 rotate-2 bg-[#facc15] px-1.5 py-0.5"><span className="font-mono text-[0.6rem] font-black text-[#111111]">TOP ✓</span></div>}
                              {isBottom && !isTop && <div className="absolute right-1 top-1 -rotate-2 bg-[#ff007f] px-1.5 py-0.5"><span className="font-mono text-[0.6rem] font-black text-white">BTM ✓</span></div>}
                            </div>
                            <div className="flex flex-col gap-0.5 px-2 py-2">
                              <p className="font-mono text-[0.65rem] font-black leading-tight tracking-[0.08em] text-[#111111]">{item.name}</p>
                              <p className="font-mono text-[0.52rem] tracking-widest text-[#ff007f]">MY CLOSET</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ══════════════════════════════════
              COL 2 — DUAL-ZONE MANNEQUIN STAGE
          ══════════════════════════════════ */}
          <div className="relative flex h-[55vh] flex-col overflow-hidden border-4 border-[#111111] shadow-[6px_6px_0_0_#111111] sm:h-[65vh] sm:shadow-[8px_8px_0_0_#111111] lg:col-span-6 lg:h-full">

            {/* Board header */}
            <div className="flex flex-shrink-0 items-center justify-between gap-2 border-b-4 border-[#111111] bg-white px-3 py-2 sm:px-5 sm:py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                  <span className="inline-block rotate-[2deg] border-2 border-[#111111] bg-[#111111] px-1.5 py-0.5 font-mono text-[0.6rem] font-black tracking-[0.1em] text-[#facc15] shadow-[2px_2px_0_0_#facc15] sm:px-2 sm:py-1 sm:text-xs">PASTE</span>
                  <span className="inline-block -rotate-[2deg] border-2 border-[#111111] bg-[#facc15] px-1.5 py-0.5 font-mono text-[0.6rem] font-black tracking-[0.1em] text-[#111111] shadow-[2px_2px_0_0_#111111] sm:px-2 sm:py-1 sm:text-xs">UP</span>
                  <span className="inline-block rotate-[1deg] border-2 border-[#111111] bg-[#dc2626] px-1.5 py-0.5 font-mono text-[0.6rem] font-black tracking-[0.1em] text-white shadow-[2px_2px_0_0_#111111] sm:px-2 sm:py-1 sm:text-xs">BOARD</span>
                </div>
                <p className="mt-1 font-mono text-[0.6rem] tracking-[0.12em] text-[#111111]/50 sm:text-xs sm:tracking-[0.16em]">
                  {!hasFabric            && "TAP TO ASSIGN FABRIC"}
                  {selectedTopFabric && !selectedBottomFabric && "TOP LOADED — ADD BOTTOM"}
                  {!selectedTopFabric && selectedBottomFabric && "BOTTOM LOADED — ADD TOP"}
                  {bothZonesLoaded       && "READY — CONFIGURE →"}
                </p>
              </div>
              {hasFabric && (
                <button type="button" onClick={() => { setSelectedTopFabric(null); setSelectedBottomFabric(null); }}
                  className="flex-shrink-0 border-2 border-[#111111] bg-white px-2 py-1.5 font-mono text-[0.6rem] font-black tracking-widest text-[#111111] shadow-[2px_2px_0_0_#111111] transition-all hover:bg-[#dc2626] hover:text-white hover:border-[#dc2626] sm:px-3 sm:text-xs">
                  <span className="hidden sm:inline">[ CLEAR ZONES ]</span>
                  <span className="sm:hidden">✕</span>
                </button>
              )}
            </div>

            {/* ── Client Dress-Up Stage ── */}
            <div className="relative min-h-0 flex-1 overflow-hidden">
              <ClientStage
                clientPhoto={clientPhoto}
                topFabric={selectedTopFabric}
                bottomFabric={selectedBottomFabric}
                isDragOverTop={isDragOverTop}
                isDragOverBottom={isDragOverBottom}
                onDragOverTop={() => setIsDragOverTop(true)}
                onDragOverBottom={() => setIsDragOverBottom(true)}
                onDragLeave={() => { setIsDragOverTop(false); setIsDragOverBottom(false); }}
                onDropTop={e => handleDropOnZone(e, "top")}
                onDropBottom={e => handleDropOnZone(e, "bottom")}
              />
              {/* Error overlay — floats above the 3D canvas */}
              {phase === "error" && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#f4f4f0]/70 backdrop-blur-[2px]">
                  <div className="w-full max-w-sm border-4 border-[#dc2626] bg-white shadow-[6px_6px_0_0_#dc2626]">
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
                </div>
              )}

            </div>
          </div>

          {/* ══════════════════════════════════
              COL 3 — COMMAND DESK
          ══════════════════════════════════ */}
          <div className="flex flex-col overflow-hidden border-4 border-[#111111] shadow-[6px_6px_0_0_#111111] sm:shadow-[8px_8px_0_0_#111111] lg:col-span-3 lg:h-full">

            <div className="flex-shrink-0 border-b-4 border-[#111111] bg-white px-3 py-2 sm:px-4 sm:py-3">
              <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                <span className="inline-block rotate-[2deg] border-2 border-[#111111] bg-[#111111] px-1.5 py-0.5 font-mono text-[0.6rem] font-black tracking-[0.1em] text-[#facc15] shadow-[2px_2px_0_0_#facc15] sm:px-2 sm:py-1 sm:text-xs">CMD</span>
                <span className="inline-block -rotate-1 border-2 border-[#111111] bg-[#ff007f] px-1.5 py-0.5 font-mono text-[0.6rem] font-black tracking-[0.1em] text-white shadow-[2px_2px_0_0_#111111] sm:px-2 sm:py-1 sm:text-xs">DESK</span>
              </div>
              <p className="mt-1 font-mono text-[0.6rem] tracking-[0.12em] text-[#111111]/50 sm:mt-1.5 sm:text-xs sm:tracking-[0.16em]">AI CONTROLS &amp; METRICS</p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-white px-3 py-3 flex flex-col gap-4 sm:px-4 sm:py-4 sm:gap-5">

              {/* ── CLIENT PHOTO — "you are the model" ── */}
              <div className="flex flex-col gap-2">
                <p className="font-mono text-[0.58rem] font-black uppercase tracking-[0.18em] text-[#111111]">
                  [ YOU ARE THE MODEL ]
                </p>
                <input
                  ref={clientPhotoRef}
                  type="file"
                  accept="image/*"
                  onChange={handleClientPhotoUpload}
                  className="hidden"
                />
                {clientPhoto ? (
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={clientPhoto} alt="You" className="h-14 w-10 flex-shrink-0 border-2 border-[#111111] object-cover object-top" />
                    <div className="flex flex-1 flex-col gap-1">
                      <p className="font-mono text-[0.5rem] font-black tracking-[0.12em] text-[#111111]/50">PHOTO LOADED</p>
                      <button
                        type="button"
                        onClick={() => clientPhotoRef.current?.click()}
                        className="w-full border-2 border-[#111111]/30 bg-white px-2 py-1.5 font-mono text-[0.6rem] font-black tracking-[0.1em] text-[#111111]/50 transition-all hover:border-[#111111] hover:text-[#111111]"
                      >
                        CHANGE PHOTO
                      </button>
                      <button
                        type="button"
                        onClick={() => setClientPhoto(null)}
                        className="w-full border-2 border-[#111111]/20 bg-white px-2 py-1 font-mono text-[0.55rem] font-black tracking-[0.08em] text-[#111111]/30 transition-all hover:border-[#dc2626] hover:text-[#dc2626]"
                      >
                        ✕ REMOVE
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => clientPhotoRef.current?.click()}
                    className="w-full border-4 border-dashed border-[#111111]/30 bg-[#f4f4f0] px-3 py-4 font-mono text-xs font-black tracking-[0.1em] text-[#111111]/40 transition-all duration-75 hover:border-[#111111] hover:bg-white hover:text-[#111111]"
                  >
                    + UPLOAD YOUR PHOTO
                  </button>
                )}
              </div>

              <div className="h-[3px] w-full bg-[#111111]" />

              {/* Unit toggle */}
              <div>
                <p className="mb-2 font-mono text-[0.58rem] font-black uppercase tracking-[0.18em] text-[#111111]/50">MEASUREMENT SYSTEM</p>
                <button type="button"
                  onClick={() => {
                    // Convert slider values to the new unit before toggling
                    setUnit(u => {
                      const toMetric = u === "imperial";
                      const factor   = toMetric ? 2.54 : (1 / 2.54);
                      setMetrics(m => ({
                        height: Math.round(parseInt(m.height) * factor).toString(),
                        chest:  Math.round(parseInt(m.chest)  * factor).toString(),
                        waist:  Math.round(parseInt(m.waist)  * factor).toString(),
                        hips:   Math.round(parseInt(m.hips)   * factor).toString(),
                      }));
                      return toMetric ? "metric" : "imperial";
                    });
                  }}
                  className={`w-full border-4 border-[#111111] px-3 py-2.5 font-mono text-xs font-black tracking-[0.12em] shadow-[4px_4px_0_0_#111111] transition-all duration-75 active:translate-x-[4px] active:translate-y-[4px] active:shadow-none ${
                    unit === "imperial" ? "bg-[#facc15] text-[#111111] hover:bg-[#111111] hover:text-[#facc15]" : "bg-[#111111] text-[#facc15] hover:bg-[#facc15] hover:text-[#111111]"
                  }`}>
                  {unit === "imperial" ? "[ UNIT: INCHES ]" : "[ UNIT: CENTIMETRES ]"}
                </button>
              </div>

              {/* Client metrics — range sliders */}
              <div>
                <p className="mb-2.5 font-mono text-[0.58rem] font-black uppercase tracking-[0.18em] text-[#111111]">
                  [ CLIENT METRICS // TAILOR TAPE ]
                </p>
                <div className="flex flex-col gap-4">
                  {(unit === "imperial"
                    ? [
                        { key: "height", label: "HEIGHT",       min: 58,  max: 78,  accent: "#111111",
                          display: (() => { const n = parseInt(metrics.height); return isNaN(n) ? "—" : `${Math.floor(n/12)}'${n%12}"`; })() },
                        { key: "chest",  label: "CHEST / BUST", min: 28,  max: 56,  accent: "#facc15",
                          display: `${metrics.chest}"` },
                        { key: "waist",  label: "WAIST",        min: 20,  max: 50,  accent: "#ff007f",
                          display: `${metrics.waist}"` },
                        { key: "hips",   label: "HIPS",         min: 30,  max: 58,  accent: "#111111",
                          display: `${metrics.hips}"` },
                      ]
                    : [
                        { key: "height", label: "HEIGHT",       min: 147, max: 198, accent: "#111111",
                          display: `${metrics.height} cm` },
                        { key: "chest",  label: "CHEST / BUST", min: 71,  max: 142, accent: "#facc15",
                          display: `${metrics.chest} cm` },
                        { key: "waist",  label: "WAIST",        min: 51,  max: 127, accent: "#ff007f",
                          display: `${metrics.waist} cm` },
                        { key: "hips",   label: "HIPS",         min: 76,  max: 147, accent: "#111111",
                          display: `${metrics.hips} cm` },
                      ]
                  ).map(({ key, label, min, max, accent, display }) => (
                    <div key={key} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <label className="font-mono text-[0.52rem] font-black uppercase tracking-[0.14em] text-[#111111]/60">
                          {label}
                        </label>
                        <span
                          className="border-2 border-[#111111] px-1.5 py-0.5 font-mono text-[0.6rem] font-black tracking-[0.08em] text-[#111111]"
                          style={{ backgroundColor: accent === "#111111" ? "#f4f4f0" : accent,
                                   color: accent === "#facc15" ? "#111111" : accent === "#ff007f" ? "#fff" : "#111111" }}
                        >
                          {display}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step={1}
                        value={parseInt(metrics[key as keyof typeof metrics]) || min}
                        onChange={e => setMetrics(prev => ({ ...prev, [key]: e.target.value }))}
                        className="h-2 w-full cursor-pointer appearance-none rounded-none border-2 border-[#111111] bg-[#f4f4f0]"
                        style={{ accentColor: accent }}
                      />
                      <div className="flex justify-between font-mono text-[0.44rem] tracking-widest text-[#111111]/25">
                        <span>{unit === "imperial" && key === "height" ? `${Math.floor(min/12)}'${min%12}"` : `${min}`}</span>
                        <span>{unit === "imperial" && key === "height" ? `${Math.floor(max/12)}'${max%12}"` : `${max}`}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="h-[3px] w-full bg-[#111111]" />

              {/* Decay / Distress */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="font-mono text-xs font-black uppercase tracking-[0.1em] text-[#111111]">[ DECAY // DISTRESS ]</label>
                  <span className="font-mono text-xs font-black text-[#dc2626]">{distressLevel}</span>
                </div>
                <input type="range" min="0" max="100" step="1" value={distressLevel}
                  onChange={e => setDistressLevel(parseInt(e.target.value, 10))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-none border-2 border-[#111111] bg-[#f4f4f0] accent-[#dc2626]"
                />
                <div className="flex justify-between font-mono text-[0.52rem] tracking-widest text-[#111111]/30">
                  <span>INTACT</span><span>DESTROYED</span>
                </div>
              </div>

              {/* Mutation / Asymmetry */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="font-mono text-xs font-black uppercase tracking-[0.1em] text-[#111111]">[ MUTATION // ASYMMETRY ]</label>
                  <span className="font-mono text-xs font-black text-[#ff007f]">{asymmetry}</span>
                </div>
                <input type="range" min="0" max="100" step="1" value={asymmetry}
                  onChange={e => setAsymmetry(parseInt(e.target.value, 10))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-none border-2 border-[#111111] bg-[#f4f4f0] accent-[#ff007f]"
                />
                <div className="flex justify-between font-mono text-[0.52rem] tracking-widest text-[#111111]/30">
                  <span>BALANCED</span><span>CHAOTIC</span>
                </div>
              </div>

              {/* ── FIT CONTROLS ── */}
              <div className="flex flex-col gap-3">
                {/* Fit width */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="font-mono text-[0.52rem] font-black uppercase tracking-[0.14em] text-[#111111]/60">FIT // WIDTH</label>
                    <span className="border-2 border-[#111111] bg-[#f4f4f0] px-1.5 py-0.5 font-mono text-[0.6rem] font-black tracking-[0.08em] text-[#111111]">
                      {fitWidth <= 0.7 ? "SKIN TIGHT" : fitWidth <= 0.9 ? "FITTED" : fitWidth <= 1.2 ? "RELAXED" : fitWidth <= 1.6 ? "OVERSIZED" : "EXTREME OS"}
                    </span>
                  </div>
                  <input type="range" min="0.5" max="2.0" step="0.05"
                    value={fitWidth}
                    onChange={e => setFitWidth(parseFloat(e.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-none border-2 border-[#111111] bg-[#f4f4f0] accent-[#111111]"
                  />
                  <div className="flex justify-between font-mono text-[0.44rem] tracking-widest text-[#111111]/25">
                    <span>TIGHT</span><span>OVERSIZED</span>
                  </div>
                </div>
                {/* Hem length */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="font-mono text-[0.52rem] font-black uppercase tracking-[0.14em] text-[#111111]/60">HEM // LENGTH</label>
                    <span className="border-2 border-[#111111] bg-[#facc15] px-1.5 py-0.5 font-mono text-[0.6rem] font-black tracking-[0.08em] text-[#111111]">
                      {fitLength <= 0.5 ? "CROPPED" : fitLength <= 0.8 ? "SHORT" : fitLength <= 1.2 ? "MID" : fitLength <= 1.6 ? "LONG" : "FLOOR"}
                    </span>
                  </div>
                  <input type="range" min="0.3" max="2.0" step="0.05"
                    value={fitLength}
                    onChange={e => setFitLength(parseFloat(e.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-none border-2 border-[#111111] bg-[#f4f4f0] accent-[#facc15]"
                  />
                  <div className="flex justify-between font-mono text-[0.44rem] tracking-widest text-[#111111]/25">
                    <span>CROPPED</span><span>DRAPED</span>
                  </div>
                </div>
              </div>

              {/* ── 3D BODY SCAN UPLOAD ── */}
              <div className="flex flex-col gap-2">
                <p className="font-mono text-[0.58rem] font-black uppercase tracking-[0.18em] text-[#111111]">
                  [ 3D BODY SCAN ]
                </p>
                <input
                  ref={meshInputRef}
                  type="file"
                  accept=".glb,.gltf"
                  onChange={handleMeshUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => meshInputRef.current?.click()}
                  disabled={meshUploading}
                  className="w-full border-4 border-[#111111] bg-white px-3 py-2.5 font-mono text-xs font-black tracking-[0.12em] text-[#111111] shadow-[4px_4px_0_0_#111111] transition-all duration-75 hover:bg-[#111111] hover:text-white active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {meshUploading ? "UPLOADING SCAN..." : "[ UPLOAD 3D SCAN ]"}
                </button>
                {meshUrl && (
                  <p className="font-mono text-[0.5rem] tracking-[0.08em] text-[#111111]/50 break-all">
                    ✓ MESH STORED: {meshUrl.split("/").pop()}
                  </p>
                )}
              </div>

              <div className="h-[3px] w-full bg-[#111111]" />

              {/* ── STRUCTURAL BLUEPRINT ── */}
              <div className="flex flex-col gap-3">
                <p className="font-mono text-[0.58rem] font-black uppercase tracking-[0.18em] text-[#111111]">
                  [ STRUCTURAL BLUEPRINT ]
                </p>

                {!hasFabric ? (
                  <p className="font-mono text-[0.55rem] leading-relaxed tracking-[0.08em] text-[#111111]/35">
                    LOAD FABRIC INTO THE MANNEQUIN ZONES TO UNLOCK GARMENT CONFIGURATION.
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">

                    {/* Top type — shown when top zone has fabric AND no full body override */}
                    {selectedTopFabric && !garmentTypeFull && (
                      <BlueprintSelect
                        label="TOP STRUCTURE"
                        value={garmentTypeTop}
                        onChange={setGarmentTypeTop}
                        options={TOP_GARMENT_TYPES}
                        placeholder="— SELECT TOP TYPE —"
                      />
                    )}

                    {/* Bottom type — shown when bottom zone has fabric AND no full body override */}
                    {selectedBottomFabric && !garmentTypeFull && (
                      <BlueprintSelect
                        label="BOTTOM STRUCTURE"
                        value={garmentTypeBottom}
                        onChange={setGarmentTypeBottom}
                        options={BOTTOM_GARMENT_TYPES}
                        placeholder="— SELECT BOTTOM TYPE —"
                      />
                    )}

                    {/* Full body override — only when BOTH zones are loaded */}
                    {bothZonesLoaded && (
                      <div className="flex flex-col gap-1">
                        <BlueprintSelect
                          label="FULL BODY OVERRIDE"
                          value={garmentTypeFull}
                          onChange={v => {
                            setGarmentTypeFull(v);
                            if (v) { setGarmentTypeTop(""); setGarmentTypeBottom(""); }
                          }}
                          options={FULL_GARMENT_TYPES}
                          placeholder="— SEPARATE PIECES —"
                        />
                        <p className="font-mono text-[0.48rem] tracking-[0.08em] text-[#111111]/35">
                          MERGE BOTH FABRICS INTO A SINGLE SILHOUETTE
                        </p>
                      </div>
                    )}

                    {/* Live preview of compiled vision — uses 3D handle state */}
                    <div className="h-[2px] w-full bg-[#111111]/15" />
                    <div className="border-2 border-[#111111]/20 bg-[#f4f4f0] px-3 py-2">
                      <p className="mb-1 font-mono text-[0.48rem] font-black tracking-[0.14em] text-[#111111]/40">COMPILED OUTPUT //</p>
                      <p className="font-mono text-[0.6rem] normal-case leading-relaxed text-[#111111]/70">
                        {compileUserVision({ garmentTypeTop, garmentTypeBottom, garmentTypeFull, widthScale: fitState.widthScale, hemLength: fitState.hemLength, distressLevel, asymmetry })}
                      </p>
                    </div>
                  </div>
                )}
              </div>

            </div>{/* end scrollable controls */}

            {/* CTA — pinned to bottom, min 48px touch targets on mobile */}
            <div className="flex-shrink-0 border-t-4 border-[#111111] bg-punk-halftone px-3 py-3 flex flex-col gap-2 sm:px-4 sm:py-4">

              {/* Reset fit sliders */}
              {(fitWidth !== 1 || fitLength !== 1) && (
                <button
                  type="button"
                  onClick={() => { setFitWidth(1); setFitLength(1); }}
                  className="w-full border-2 border-[#111111]/30 bg-white px-3 py-2 font-mono text-xs font-black tracking-[0.1em] text-[#111111]/50 transition-all hover:border-[#111111] hover:text-[#111111] sm:py-1.5 sm:text-[0.6rem]"
                >
                  ↺ RESET FIT
                </button>
              )}

              {/* RANDOMIZE // RUBY STYLE */}
              <button
                type="button"
                onClick={() => handleReconstruct("ruby")}
                disabled={!canReconstruct}
                className="rotate-1 w-full border-4 border-[#dc2626] bg-[#dc2626] px-4 py-3 font-mono text-xs font-black tracking-[0.12em] text-white shadow-[4px_4px_0_0_#111111] transition-all duration-75 hover:-rotate-1 hover:bg-[#111111] hover:border-[#dc2626] hover:shadow-[6px_6px_0_0_#dc2626] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-30 disabled:rotate-0 disabled:shadow-none"
              >
                [ RANDOMIZE // RUBY ]
              </button>

              {/* Main reconstruct */}
              <button
                type="button"
                onClick={() => handleReconstruct("normal")}
                disabled={!canReconstruct}
                className="-rotate-1 w-full border-4 border-[#111111] bg-[#facc15] px-4 py-3.5 font-mono text-sm font-black tracking-[0.14em] text-[#111111] shadow-[4px_4px_0_0_#111111] transition-all duration-75 hover:rotate-0 hover:shadow-[8px_8px_0_0_#111111] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-30 disabled:rotate-0 disabled:shadow-none sm:py-4 sm:shadow-[6px_6px_0_0_#111111]"
              >
                {phase === "parsing" ? "BUILDING..." : "[ RECONSTRUCT ]"}
              </button>

              {!hasFabric && (
                <p className="text-center font-mono text-xs tracking-[0.12em] text-[#111111]/40 sm:text-[0.6rem] sm:tracking-[0.14em]">
                  ↑ TAP FABRICS IN THE CATALOG FIRST
                </p>
              )}
            </div>

          </div>{/* end col 3 */}
        </div>
      )}

      {/* ── Upload Modal ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showUploadModal && (
          <UploadGarmentModal
            onClose={() => setShowUploadModal(false)}
            onSuccess={item => {
              setMyCloset(prev => [item, ...prev]);
              setSidebarTab("closet");
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
