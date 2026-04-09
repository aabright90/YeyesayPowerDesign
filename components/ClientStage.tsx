"use client";

// ─── ClientStage ─────────────────────────────────────────────────────────────
//
// The dress-up board. The client IS the model.
//
// If they upload a photo of themselves, it fills the stage as the canvas base.
// Fabric zone overlays drape on top of the photo using CSS mix-blend-mode.
// If no photo, a clean human fashion-figure silhouette holds their place.
//
// No Three.js. No WebGL. Just the client, their fabrics, and the board.

export interface FitState {
  widthScale: number;  // 0.5 (very tight) → 2.0 (very oversized)
  hemLength:  number;  // 0.3 (cropped) → 2.0 (draped floor-length)
}

export interface Material {
  id:    number;
  name:  string;
  tag:   string;
  photo: string | null;
}

export interface ClientStageProps {
  clientPhoto:      string | null;
  topFabric:        Material | null;
  bottomFabric:     Material | null;
  isDragOverTop:    boolean;
  isDragOverBottom: boolean;
  onDragOverTop:    () => void;
  onDragOverBottom: () => void;
  onDragLeave:      () => void;
  onDropTop:        (e: React.DragEvent<HTMLDivElement>) => void;
  onDropBottom:     (e: React.DragEvent<HTMLDivElement>) => void;
}

// Waist split is at 52% — matches the natural waist line of an upright photo
const SPLIT = 52;

// ─── Human Fashion Silhouette SVG ─────────────────────────────────────────────
//
// Shown when the client hasn't uploaded their photo yet.
// Proportion is slightly elongated (fashion illustration scale, not anatomical).
// Dashed lines give a tailor's blueprint feel without looking like a crash dummy.

function HumanSilhouette() {
  return (
    <svg
      viewBox="0 0 200 580"
      className="absolute inset-0 m-auto h-[85%] w-auto"
      fill="none"
      aria-hidden
    >
      {/* Head */}
      <ellipse cx="100" cy="45" rx="27" ry="34"
        stroke="#111111" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.12" />

      {/* Neck */}
      <path d="M91 76 L109 76 L112 100 L88 100 Z"
        stroke="#111111" strokeWidth="1.5" strokeDasharray="5 4" fill="none" opacity="0.10" />

      {/* Shoulders + torso + hips — one smooth outline */}
      <path d="
        M 55 100
        C 42 100 30 108 26 124
        L 18 172
        C 14 188 16 206 22 220
        L 26 248
        C 28 260 28 272 30 282
        C 36 298 50 306 68 310
        L 78 312
        L 80 340
        L 120 340
        L 122 312
        L 132 310
        C 150 306 164 298 170 282
        C 172 272 172 260 174 248
        L 178 220
        C 184 206 186 188 182 172
        L 174 124
        C 170 108 158 100 145 100
        Z
      "
        stroke="#111111" strokeWidth="1.5" strokeDasharray="7 5" opacity="0.14" />

      {/* Left leg */}
      <path d="M80 340 L72 580" stroke="#111111" strokeWidth="1.5" strokeDasharray="7 5" opacity="0.10" />
      {/* Right leg */}
      <path d="M120 340 L128 580" stroke="#111111" strokeWidth="1.5" strokeDasharray="7 5" opacity="0.10" />

      {/* Left arm */}
      <path d="M55 100 C38 120 24 160 20 220"
        stroke="#111111" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.10" />
      {/* Right arm */}
      <path d="M145 100 C162 120 176 160 180 220"
        stroke="#111111" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.10" />

      {/* Waist line (pink dashed seam) */}
      <line x1="10" y1="248" x2="190" y2="248"
        stroke="#ff007f" strokeWidth="1" strokeDasharray="5 3" opacity="0.25" />
      <text x="100" y="244" textAnchor="middle"
        fontFamily="monospace" fontSize="7" fill="#ff007f" opacity="0.35"
        fontWeight="bold" letterSpacing="2">WAIST</text>
    </svg>
  );
}

// ─── ClientStage ─────────────────────────────────────────────────────────────

export default function ClientStage({
  clientPhoto,
  topFabric,
  bottomFabric,
  isDragOverTop,
  isDragOverBottom,
  onDragOverTop,
  onDragOverBottom,
  onDragLeave,
  onDropTop,
  onDropBottom,
}: ClientStageProps) {
  const hasFabric = !!(topFabric || bottomFabric);
  const isEmpty   = !hasFabric && !clientPhoto;

  const getZone = (e: React.DragEvent<HTMLDivElement>): "top" | "bottom" => {
    const rect = e.currentTarget.getBoundingClientRect();
    return (e.clientY - rect.top) / rect.height < SPLIT / 100 ? "top" : "bottom";
  };

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        backgroundImage:
          "linear-gradient(to right, #e5e7eb 1px, transparent 1px), linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)",
        backgroundSize: "40px 40px",
        backgroundColor: "#f8f7f4",
      }}
      onDragOver={(e) => {
        e.preventDefault();
        getZone(e) === "top" ? onDragOverTop() : onDragOverBottom();
      }}
      onDragLeave={() => onDragLeave()}
      onDrop={(e) => {
        e.preventDefault();
        getZone(e) === "top" ? onDropTop(e) : onDropBottom(e);
      }}
    >

      {/* ── CLIENT PHOTO or SILHOUETTE PLACEHOLDER ─────────────────────── */}
      {clientPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={clientPhoto}
          alt="Client"
          className="absolute inset-0 h-full w-full object-cover object-top"
        />
      ) : (
        <HumanSilhouette />
      )}

      {/* ── TOP FABRIC DRAPE ───────────────────────────────────────────── */}
      {topFabric?.photo && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 overflow-hidden"
          style={{
            height:       `${SPLIT}%`,
            mixBlendMode: clientPhoto ? "multiply" : "normal",
            opacity:      clientPhoto ? 0.60 : 0.85,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={topFabric.photo} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      {/* ── BOTTOM FABRIC DRAPE ─────────────────────────────────────────── */}
      {bottomFabric?.photo && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden"
          style={{
            top:          `${SPLIT}%`,
            mixBlendMode: clientPhoto ? "multiply" : "normal",
            opacity:      clientPhoto ? 0.60 : 0.85,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={bottomFabric.photo} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      {/* ── WAIST SEAM LINE ─────────────────────────────────────────────── */}
      {hasFabric && (
        <div
          className="pointer-events-none absolute inset-x-0 z-20 flex items-center gap-2 px-3"
          style={{ top: `${SPLIT}%` }}
        >
          <div className="h-[2px] flex-1 bg-[#ff007f] opacity-60" />
          <span className="bg-[#ff007f] px-1.5 py-px font-mono text-[0.45rem] font-black tracking-[0.15em] text-white">
            WAIST SEAM
          </span>
          <div className="h-[2px] flex-1 bg-[#ff007f] opacity-60" />
        </div>
      )}

      {/* ── DRAG HIGHLIGHT — TOP ────────────────────────────────────────── */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-center transition-all duration-100 ${
          isDragOverTop
            ? "bg-[#facc15]/35 ring-4 ring-inset ring-[#facc15]"
            : "bg-transparent"
        }`}
        style={{ height: `${SPLIT}%` }}
      >
        {isDragOverTop ? (
          <span className="font-mono text-sm font-black tracking-[0.2em] text-[#facc15] [text-shadow:0_0_8px_#000,0_0_4px_#000]">
            ↓ DROP TOP FABRIC
          </span>
        ) : (!topFabric && !isEmpty && (
          <span className="font-mono text-xs font-black tracking-widest text-[#111111]/20">
            TOP ZONE
          </span>
        ))}
      </div>

      {/* ── DRAG HIGHLIGHT — BOTTOM ─────────────────────────────────────── */}
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-center justify-center transition-all duration-100 ${
          isDragOverBottom
            ? "bg-[#ff007f]/25 ring-4 ring-inset ring-[#ff007f]"
            : "bg-transparent"
        }`}
        style={{ top: `${SPLIT}%` }}
      >
        {isDragOverBottom ? (
          <span className="font-mono text-sm font-black tracking-[0.2em] text-[#ff007f] [text-shadow:0_0_8px_#000,0_0_4px_#000]">
            ↑ DROP BOTTOM FABRIC
          </span>
        ) : (!bottomFabric && !isEmpty && (
          <span className="font-mono text-xs font-black tracking-widest text-[#111111]/20">
            BOTTOM ZONE
          </span>
        ))}
      </div>

      {/* ── EMPTY STATE PROMPT ──────────────────────────────────────────── */}
      {isEmpty && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-center">
          <p className="font-mono text-xs font-black tracking-[0.22em] text-[#111111]/25">
            UPLOAD YOUR PHOTO
          </p>
          <div className="h-[2px] w-12 bg-[#111111]/10" />
          <p className="font-mono text-[0.55rem] tracking-[0.14em] text-[#111111]/15">
            OR DRAG FABRICS FROM THE CATALOG
          </p>
        </div>
      )}

      {/* ── LOADED FABRIC LABELS ────────────────────────────────────────── */}
      {hasFabric && (
        <div className="pointer-events-none absolute bottom-4 left-0 right-0 z-40 flex justify-center gap-3">
          {topFabric && (
            <span className="bg-[#facc15] px-2 py-0.5 font-mono text-[0.6rem] font-black tracking-[0.1em] text-[#111111] shadow-[2px_2px_0_0_#111111]">
              ↑ {topFabric.name.split(" ").slice(0, 4).join(" ")}
            </span>
          )}
          {bottomFabric && (
            <span className="bg-[#ff007f] px-2 py-0.5 font-mono text-[0.6rem] font-black tracking-[0.1em] text-white shadow-[2px_2px_0_0_#111111]">
              ↓ {bottomFabric.name.split(" ").slice(0, 4).join(" ")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
