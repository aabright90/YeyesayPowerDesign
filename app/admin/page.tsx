"use client";

import { useState, useRef, type ChangeEvent } from "react";
import RansomHeader from "@/components/RansomHeader";

// ── Types ─────────────────────────────────────────────────────────────────────

interface InventoryItem {
  id: number;
  type: string;
  yardage: string;
  origin: string;
  photo: string | null;
  rotation: string;
}

// ── Seed data ─────────────────────────────────────────────────────────────────

const ROTATIONS_CYCLE = ["rotate-1", "-rotate-2", "rotate-2", "-rotate-1"] as const;

const SEED_ITEMS: InventoryItem[] = [
  { id:  1, type: "DIGITAL CAMO FIELD JACKET",         yardage: "—", origin: "RIPSTOP UTILITY OUTERWEAR",       photo: "/inventory/digital-camo-field-jacket.webp",          rotation: ROTATIONS_CYCLE[0] },
  { id:  2, type: "BLACK TUBE TOP",                     yardage: "—", origin: "STRETCH KNIT",                    photo: "/inventory/black-tube-top.webp",                     rotation: ROTATIONS_CYCLE[1] },
  { id:  3, type: "NAVY WORK JACKET",                   yardage: "—", origin: "UTILITY SHELL",                   photo: "/inventory/navy-work-jacket.webp",                   rotation: ROTATIONS_CYCLE[2] },
  { id:  4, type: "BLUSH LACE PARTY DRESS",             yardage: "—", origin: "EMBROIDERED TULLE",               photo: "/inventory/blush-lace-party-dress.png",              rotation: ROTATIONS_CYCLE[3] },
  { id:  5, type: "WOODLAND CAMO CARGO PANTS",          yardage: "—", origin: "TACTICAL COTTON BLEND",           photo: "/inventory/woodland-camo-cargo-pants.webp",          rotation: ROTATIONS_CYCLE[0] },
  { id:  6, type: "OVERSIZED BLUE PLAID FLANNEL",       yardage: "—", origin: "BRUSHED COTTON",                  photo: "/inventory/oversized-blue-plaid-flannel.webp",       rotation: ROTATIONS_CYCLE[1] },
  { id:  7, type: "DIGITAL CAMO TACTICAL PANTS",        yardage: "—", origin: "RIPSTOP FIELDWEAR",               photo: "/inventory/digital-camo-tactical-pants.webp",        rotation: ROTATIONS_CYCLE[2] },
  { id:  8, type: "BLACK LACE UP CROPPED TEE",          yardage: "—", origin: "SOFT COTTON JERSEY",              photo: "/inventory/black-lace-up-cropped-tee.png",           rotation: ROTATIONS_CYCLE[3] },
  { id:  9, type: "BLACK GOTHIC MESH TOP",              yardage: "—", origin: "SHEER STRETCH MESH",              photo: "/inventory/black-gothic-mesh-top.png",               rotation: ROTATIONS_CYCLE[0] },
  { id: 10, type: "BLACK LACE TRIM MESH TOP",           yardage: "—", origin: "SHEER KNIT",                      photo: "/inventory/black-lace-trim-mesh-top.png",            rotation: ROTATIONS_CYCLE[1] },
  { id: 11, type: "RED PLAID MINI SKIRT",               yardage: "—", origin: "PUNK TARTAN WEAVE",               photo: "/inventory/red-plaid-mini-skirt.png",                rotation: ROTATIONS_CYCLE[2] },
  { id: 12, type: "BLACK CHAIN MINI SKIRT",             yardage: "—", origin: "PLEATED TWILL",                   photo: "/inventory/black-chain-mini-skirt.png",              rotation: ROTATIONS_CYCLE[3] },
  { id: 13, type: "BLACK LACE UP FLARE PANTS",          yardage: "—", origin: "STRETCH KNIT",                    photo: "/inventory/black-lace-up-flare-pants.png",           rotation: ROTATIONS_CYCLE[0] },
  { id: 14, type: "BLACK DRAPED OFF SHOULDER DRESS",    yardage: "—", origin: "BODYCON JERSEY",                  photo: "/inventory/black-draped-off-shoulder-dress.png",     rotation: ROTATIONS_CYCLE[1] },
  { id: 15, type: "RED SATIN COCKTAIL DRESS",           yardage: "—", origin: "LUSTROUS SATIN",                  photo: "/inventory/red-satin-cocktail-dress.png",            rotation: ROTATIONS_CYCLE[2] },
  { id: 16, type: "BLUSH LACE COCKTAIL DRESS",          yardage: "—", origin: "EMBROIDERED TULLE",               photo: "/inventory/blush-lace-cocktail-dress.png",           rotation: ROTATIONS_CYCLE[3] },
  { id: 17, type: "SILVER DRAPED COCKTAIL DRESS",       yardage: "—", origin: "RUCHED STRETCH SATIN",            photo: "/inventory/silver-draped-cocktail-dress.png",        rotation: ROTATIONS_CYCLE[0] },
  { id: 18, type: "BROWN PLAID FLANNEL SHIRT",          yardage: "—", origin: "BRUSHED COTTON",                  photo: "/inventory/brown-plaid-flannel-shirt.webp",          rotation: ROTATIONS_CYCLE[1] },
  { id: 19, type: "OLIVE FIELD JACKET",                 yardage: "—", origin: "MILITARY CANVAS",                 photo: "/inventory/olive-field-jacket.webp",                 rotation: ROTATIONS_CYCLE[2] },
  { id: 20, type: "RED BUFFALO PLAID FLANNEL",          yardage: "—", origin: "HEAVYWEIGHT BRUSHED COTTON",      photo: "/inventory/red-buffalo-plaid-flannel.webp",          rotation: ROTATIONS_CYCLE[3] },
  { id: 21, type: "FLORAL SMOCKED SUNDRESS",            yardage: "—", origin: "LIGHTWEIGHT COTTON",              photo: "/inventory/floral-smocked-sundress.png",             rotation: ROTATIONS_CYCLE[0] },
  { id: 22, type: "OLIVE FLEECE SWEATSHIRT",            yardage: "—", origin: "BRUSHED FLEECE KNIT",             photo: "/inventory/olive-fleece-sweatshirt.png",             rotation: ROTATIONS_CYCLE[1] },
  { id: 23, type: "LIGHT WASH STRAIGHT JEANS",          yardage: "—", origin: "CLASSIC DENIM",                   photo: "/inventory/light-wash-straight-jeans.png",           rotation: ROTATIONS_CYCLE[2] },
  { id: 24, type: "BEIGE TRENCH COAT",                  yardage: "—", origin: "STRUCTURED COTTON TWILL",         photo: "/inventory/beige-trench-coat.png",                   rotation: ROTATIONS_CYCLE[3] },
  { id: 25, type: "LIGHT BLUE BUTTON UP SHIRT",         yardage: "—", origin: "CRISP COTTON POPLIN",             photo: "/inventory/light-blue-button-up-shirt.png",          rotation: ROTATIONS_CYCLE[0] },
  { id: 26, type: "BEIGE CARGO JOGGERS",                yardage: "—", origin: "UTILITY COTTON BLEND",            photo: "/inventory/beige-cargo-joggers.png",                 rotation: ROTATIONS_CYCLE[1] },
  { id: 27, type: "TAUPE LINEN BUTTON UP",              yardage: "—", origin: "WASHED LINEN BLEND",              photo: "/inventory/taupe-linen-button-up.png",               rotation: ROTATIONS_CYCLE[2] },
  { id: 28, type: "BEIGE PLAID MIDI SKIRT",             yardage: "—", origin: "SOFT WOVEN PLAID",                photo: "/inventory/beige-plaid-midi-skirt.png",              rotation: ROTATIONS_CYCLE[3] },
  { id: 29, type: "WHITE CLASSIC TSHIRT",               yardage: "—", origin: "COTTON JERSEY",                   photo: "/inventory/white-classic-tshirt.png",                rotation: ROTATIONS_CYCLE[0] },
  { id: 30, type: "HEATHER GRAY CLASSIC TSHIRT",        yardage: "—", origin: "COTTON JERSEY",                   photo: "/inventory/heather-gray-classic-tshirt.png",         rotation: ROTATIONS_CYCLE[1] },
  { id: 31, type: "BLACK CLASSIC TSHIRT",               yardage: "—", origin: "COTTON JERSEY",                   photo: "/inventory/black-classic-tshirt.png",                rotation: ROTATIONS_CYCLE[2] },
  { id: 32, type: "SKY BLUE CLASSIC TSHIRT",            yardage: "—", origin: "COTTON JERSEY",                   photo: "/inventory/sky-blue-classic-tshirt.png",             rotation: ROTATIONS_CYCLE[3] },
  { id: 33, type: "SAGE CLASSIC TSHIRT",                yardage: "—", origin: "COTTON JERSEY",                   photo: "/inventory/sage-classic-tshirt.png",                 rotation: ROTATIONS_CYCLE[0] },
  { id: 34, type: "BLUSH CLASSIC TSHIRT",               yardage: "—", origin: "COTTON JERSEY",                   photo: "/inventory/blush-classic-tshirt.png",                rotation: ROTATIONS_CYCLE[1] },
  { id: 35, type: "LAVENDER CLASSIC TSHIRT",            yardage: "—", origin: "COTTON JERSEY",                   photo: "/inventory/lavender-classic-tshirt.png",             rotation: ROTATIONS_CYCLE[2] },
  { id: 36, type: "CREAM CLASSIC TSHIRT",               yardage: "—", origin: "COTTON JERSEY",                   photo: "/inventory/cream-classic-tshirt.png",                rotation: ROTATIONS_CYCLE[3] },
  { id: 37, type: "RED CLASSIC TSHIRT",                 yardage: "—", origin: "COTTON JERSEY",                   photo: "/inventory/red-classic-tshirt.png",                  rotation: ROTATIONS_CYCLE[0] },
  { id: 38, type: "ROSE CLASSIC TSHIRT",                yardage: "—", origin: "COTTON JERSEY",                   photo: "/inventory/rose-classic-tshirt.png",                 rotation: ROTATIONS_CYCLE[1] },
  { id: 39, type: "YELLOW CLASSIC TSHIRT",              yardage: "—", origin: "COTTON JERSEY",                   photo: "/inventory/yellow-classic-tshirt.png",               rotation: ROTATIONS_CYCLE[2] },
  { id: 40, type: "FOREST GREEN CLASSIC TSHIRT",        yardage: "—", origin: "COTTON JERSEY",                   photo: "/inventory/forest-green-classic-tshirt.png",         rotation: ROTATIONS_CYCLE[3] },
  { id: 41, type: "OLIVE UTILITY OVERSHIRT",            yardage: "—", origin: "MILITARY COTTON TWILL",           photo: "/inventory/olive-utility-overshirt.jpg",             rotation: ROTATIONS_CYCLE[0] },
  { id: 42, type: "WOODLAND CAMO OVERSHIRT",            yardage: "—", origin: "BRUSHED FIELD COTTON",            photo: "/inventory/woodland-camo-overshirt.jpg",             rotation: ROTATIONS_CYCLE[1] },
  { id: 43, type: "GUNS N ROSES GRAPHIC TEE",           yardage: "—", origin: "VINTAGE WASH COTTON",             photo: "/inventory/guns-n-roses-graphic-tee.webp",           rotation: ROTATIONS_CYCLE[2] },
  { id: 44, type: "MULTICAM RUCHED LONG SLEEVE TOP",    yardage: "—", origin: "STRETCH PERFORMANCE KNIT",        photo: "/inventory/multicam-ruched-long-sleeve-top.jpg",     rotation: ROTATIONS_CYCLE[3] },
  { id: 45, type: "WHITE HANGING TEE",                  yardage: "—", origin: "MINIMAL COTTON JERSEY",           photo: "/inventory/white-hanging-tee.jpg",                   rotation: ROTATIONS_CYCLE[0] },
  { id: 46, type: "BROWN PLAID WORK SHIRT",             yardage: "—", origin: "HEAVY BRUSHED FLANNEL",           photo: "/inventory/brown-plaid-work-shirt.webp",             rotation: ROTATIONS_CYCLE[1] },
  { id: 47, type: "BLACK HANGING TEE",                  yardage: "—", origin: "MINIMAL COTTON JERSEY",           photo: "/inventory/black-hanging-tee.jpg",                   rotation: ROTATIONS_CYCLE[2] },
  { id: 48, type: "DENIM BUTTON UP SHIRT",              yardage: "—", origin: "LIGHTWEIGHT CHAMBRAY",            photo: "/inventory/denim-button-up-shirt.jpg",               rotation: ROTATIONS_CYCLE[3] },
  { id: 49, type: "NIRVANA GRAPHIC TEE",                yardage: "—", origin: "VINTAGE WASH COTTON",             photo: "/inventory/nirvana-graphic-tee.webp",                rotation: ROTATIONS_CYCLE[0] },
  { id: 50, type: "DESERT CAMO CARGO PANTS",            yardage: "—", origin: "TACTICAL RIPSTOP",                photo: "/inventory/desert-camo-cargo-pants.webp",            rotation: ROTATIONS_CYCLE[1] },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>(SEED_ITEMS);
  const [garmentType, setGarmentType] = useState("");
  const [yardage, setYardage] = useState("");
  const [origin, setOrigin] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFileName, setPhotoFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const nextId = useRef(SEED_ITEMS.length + 1);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === "string") setPhotoPreview(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleInject = () => {
    if (!garmentType.trim()) return;
    const newItem: InventoryItem = {
      id: nextId.current++,
      type: garmentType.trim().toUpperCase(),
      yardage: yardage.trim().toUpperCase() || "—",
      origin: origin.trim().toUpperCase() || "ORIGIN UNKNOWN",
      photo: photoPreview,
      rotation: ROTATIONS_CYCLE[(nextId.current - 2) % ROTATIONS_CYCLE.length],
    };
    setInventory((prev) => [newItem, ...prev]);
    setGarmentType("");
    setYardage("");
    setOrigin("");
    setPhotoPreview(null);
    setPhotoFileName("");
  };

  const handleDelete = (id: number) => {
    setInventory((prev) => prev.filter((item) => item.id !== id));
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-full w-full flex flex-col overflow-hidden normal-case">

      {/* ── Page Header — pinned, never scrolls ──────────────────────────── */}
      <header className="flex-shrink-0 px-3 pt-3 pb-2 sm:px-5 sm:pt-5 sm:pb-3 lg:px-8 lg:pt-6">

        {/* Access badge */}
        <div className="mb-3 flex items-center gap-3">
          <span className="inline-block rotate-1 border-2 border-[#111111] bg-white px-3 py-1.5 font-mono text-xs font-black tracking-[0.2em] text-[#111111] shadow-[2px_2px_0_0_#111111] sm:text-sm">
            ADMIN // RESTRICTED ACCESS
          </span>
        </div>

        {/* Ransom-note title */}
        <RansomHeader text="OOPS INVEN TORY CMD" />

        {/* Subtext */}
        <p className="mt-2 inline-block border-l-4 border-[#facc15] bg-white px-3 py-1.5 font-mono text-xs font-bold tracking-[0.18em] text-[#111111]/70 shadow-[3px_3px_0_0_#111111]">
          ETHICAL SOURCING LOG &amp; MATERIAL MANAGEMENT
        </p>

        <div className="mt-3 h-[3px] w-full bg-[#111111]" />
      </header>

      {/* ── Split Layout — fills all remaining height ─────────────────────── */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row mx-3 mb-3 border-4 border-[#111111] shadow-[6px_6px_0_0_#111111] overflow-hidden sm:mx-5 sm:mb-4 sm:shadow-[8px_8px_0_0_#111111] lg:mx-8 lg:mb-5 lg:shadow-[12px_12px_0_0_#111111]">

        {/* ════════════════════════════════
            LEFT — Upload Form (static, pinned)
        ════════════════════════════════ */}
        <div className="flex-shrink-0 flex flex-col border-b-4 border-[#111111] lg:w-[42%] lg:border-b-0 lg:border-r-4 overflow-hidden">

          {/* Section header */}
          <div className="flex-shrink-0 border-b-4 border-[#111111] bg-[#111111] px-5 py-3">
            <h2 className="font-mono text-base font-black tracking-[0.16em] text-white">
              ADD NEW DEAD STOCK
            </h2>
          </div>

          {/* Form fields — scroll internally if viewport is short */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-4 bg-white px-3 py-4 sm:gap-5 sm:px-5 sm:py-6">

            {/* Garment type */}
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-xs font-black tracking-[0.2em] text-[#111111]">
                GARMENT TYPE
              </label>
              <input
                type="text"
                value={garmentType}
                onChange={(e) => setGarmentType(e.target.value)}
                placeholder="e.g. denim jacket, silk scarf"
                className="border-2 border-[#111111] bg-white px-4 py-3 font-mono text-sm font-bold text-[#111111] placeholder:text-[#111111]/35 focus:outline-none focus:shadow-[3px_3px_0_0_#111111] transition-shadow duration-75 normal-case"
              />
            </div>

            {/* Yardage */}
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-xs font-black tracking-[0.2em] text-[#111111]">
                YARDAGE / SIZE
              </label>
              <input
                type="text"
                value={yardage}
                onChange={(e) => setYardage(e.target.value)}
                placeholder="e.g. 3.5 yd, large, 2xl"
                className="border-2 border-[#111111] bg-white px-4 py-3 font-mono text-sm font-bold text-[#111111] placeholder:text-[#111111]/35 focus:outline-none focus:shadow-[3px_3px_0_0_#111111] transition-shadow duration-75 normal-case"
              />
            </div>

            {/* Origin */}
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-xs font-black tracking-[0.2em] text-[#111111]">
                ORIGIN
              </label>
              <input
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="e.g. deadstock — milan 1998"
                className="border-2 border-[#111111] bg-white px-4 py-3 font-mono text-sm font-bold text-[#111111] placeholder:text-[#111111]/35 focus:outline-none focus:shadow-[3px_3px_0_0_#111111] transition-shadow duration-75 normal-case"
              />
            </div>

            {/* Photo dropzone */}
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-xs font-black tracking-[0.2em] text-[#111111]">
                DEAD STOCK PHOTO
              </label>
              <label
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (!file) return;
                  setPhotoFileName(file.name);
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    if (typeof ev.target?.result === "string") setPhotoPreview(ev.target.result);
                  };
                  reader.readAsDataURL(file);
                }}
                className={`relative flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed px-4 py-8 transition-all duration-75 ${
                  isDragging
                    ? "border-[#111111] bg-[#facc15]/20"
                    : photoPreview
                    ? "border-[#111111] bg-[#f4f4f0]"
                    : "border-[#111111] bg-[#f4f4f0] hover:bg-white"
                }`}
              >
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handlePhotoChange}
                />
                {photoPreview ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoPreview}
                      alt="Preview"
                      className="h-24 w-24 object-cover grayscale-[20%] border-2 border-[#111111]"
                    />
                    <span className="font-mono text-xs font-bold tracking-[0.14em] text-[#111111]">
                      ✓ {photoFileName.slice(0, 24)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-mono text-sm font-black tracking-[0.14em] text-[#111111]">
                      [ DROP DEAD STOCK PHOTO HERE ]
                    </span>
                    <span className="font-mono text-xs tracking-[0.14em] text-[#111111]/50">
                      DRAG &amp; DROP OR CLICK TO BROWSE
                    </span>
                  </>
                )}
              </label>
              {photoPreview && (
                <button
                  onClick={() => { setPhotoPreview(null); setPhotoFileName(""); }}
                  className="border-2 border-[#111111] bg-white px-3 py-1.5 font-mono text-xs font-black tracking-widest text-[#111111] transition-all hover:bg-[#111111] hover:text-white"
                >
                  [ CLEAR PHOTO ]
                </button>
              )}
            </div>

            {/* Submit button */}
            <button
              type="button"
              onClick={handleInject}
              disabled={!garmentType.trim()}
              className="mt-2 w-full rotate-1 border-2 border-[#111111] bg-[#facc15] px-5 py-5 font-mono text-sm font-black tracking-[0.18em] text-[#111111] shadow-[6px_6px_0_0_#111111] transition-all duration-75 hover:rotate-0 hover:bg-[#111111] hover:text-[#facc15] hover:shadow-[8px_8px_0_0_#facc15] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-40 disabled:rotate-0"
            >
              [ INJECT INTO INVENTORY ]
            </button>
          </div>
        </div>

        {/* ════════════════════════════════
            RIGHT — Live Catalog (scrollable internally)
        ════════════════════════════════ */}
        <div className="flex flex-1 flex-col min-h-0 overflow-hidden">

          {/* Section header */}
          <div className="flex-shrink-0 border-b-4 border-[#111111] bg-[#111111] px-5 py-3">
            <h2 className="font-mono text-base font-black tracking-[0.16em] text-white">
              LIVE INVENTORY //{" "}
              <span className="text-[#facc15]">{inventory.length}</span>{" "}
              ITEM{inventory.length !== 1 ? "S" : ""}
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto bg-punk-halftone p-3 pb-8 sm:p-6 sm:pb-10">
            {inventory.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center gap-2 border-2 border-dashed border-[#111111] bg-white">
                <p className="font-mono text-xs font-bold tracking-[0.18em] text-[#111111]/60">
                  INVENTORY EMPTY — INJECT MATERIALS TO BEGIN
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
                {inventory.map((item) => (
                  <div
                    key={item.id}
                    className={`flex flex-col border-4 border-[#111111] bg-white shadow-[6px_6px_0_0_#111111] transition-transform duration-75 hover:scale-[1.02] ${item.rotation}`}
                  >
                    {/* Tape strip */}
                    <div className="relative h-0">
                      <span className="absolute -top-3 left-1/2 z-10 h-5 w-12 -translate-x-1/2 rotate-[-3deg] bg-[#facc15] opacity-80 border border-[#111111]/20" />
                    </div>

                    {/* Polaroid photo area */}
                    <div className="relative border-b-4 border-[#111111] bg-[#d4d4d4]" style={{ aspectRatio: "1/1" }}>
                      {item.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.photo}
                          alt={item.type}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1">
                          <span className="font-mono text-xs font-black tracking-[0.15em] text-[#111111]/40">
                            NO PHOTO
                          </span>
                          <span className="font-mono text-[0.6rem] tracking-widest text-[#111111]/25">
                            DEAD STOCK
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Polaroid caption */}
                    <div className="flex flex-1 flex-col gap-1 bg-white px-3 py-3">
                      <p className="font-mono text-xs font-black leading-tight tracking-[0.12em] text-[#111111] sm:text-sm">
                        {item.type}
                      </p>
                      <p className="font-mono text-xs font-bold tracking-[0.1em] text-[#111111]/70">
                        {item.yardage}
                      </p>
                      <p className="mt-0.5 font-mono text-xs tracking-[0.08em] text-[#111111]/55 normal-case">
                        {item.origin}
                      </p>
                    </div>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="border-t-4 border-[#111111] bg-[#dc2626] px-3 py-2.5 font-mono text-xs font-black tracking-[0.18em] text-white transition-all duration-75 hover:bg-[#111111] active:scale-95"
                    >
                      [ DELETE ]
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
