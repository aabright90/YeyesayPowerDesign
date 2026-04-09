"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRef, useState } from "react";
import { getRailsToken } from "@/lib/auth-utils";

// ── Garment type options ───────────────────────────────────────────────────────

const GARMENT_TYPES = [
  "Shirt", "Crop Top", "Blouse", "Skirt", "Miniskirt",
  "Swimsuit 1-pc", "Swimsuit 2-pc", "Underwear",
] as const;
type GarmentType = (typeof GARMENT_TYPES)[number];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ClosetItem {
  id: number;
  name: string;
  tag: string;
  photo: string; // data-URL or hosted URL
}

interface Props {
  onClose:   () => void;
  onSuccess: (item: ClosetItem) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function UploadGarmentModal({ onClose, onSuccess }: Props) {
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [garmentType,  setGarmentType]  = useState<GarmentType | "">("");
  const [unit,         setUnit]         = useState<"imperial" | "metric">("imperial");
  const [measurements, setMeasurements] = useState({ chest: "", waist: "", hips: "", inseam: "" });
  const [isDragOver,   setIsDragOver]   = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error,        setError]        = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Image helpers ──────────────────────────────────────────────────────────

  const loadFile = (file: File) => {
    if (!file.type.startsWith("image/")) { setError("IMAGES ONLY."); return; }
    const reader = new FileReader();
    reader.onload = () => { setImageDataUrl(reader.result as string); setError(""); };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
  };

  // ── Submit → Rails ─────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!imageDataUrl) { setError("DROP AN IMAGE FIRST."); return; }
    if (!garmentType)  { setError("SELECT A GARMENT TYPE."); return; }

    setIsSubmitting(true);
    setError("");

    const token = getRailsToken();

    try {
      const res = await fetch("http://localhost:3001/api/v1/garments", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          image:        imageDataUrl,
          garment_type: garmentType,
          unit,
          measurements,
        }),
      });

      const data = await res.json() as { id?: number; error?: string };

      if (!res.ok) {
        setError(data.error ?? `SERVER ERROR ${res.status}`);
        return;
      }

      onSuccess({
        id:    data.id ?? -Date.now(),
        name:  `${garmentType.toUpperCase()}${data.id ? ` #${data.id}` : ""}`,
        tag:   "MY CLOSET",
        photo: imageDataUrl,
      });
      onClose();
    } catch {
      setError("NETWORK FAILURE — IS THE RAILS SERVER RUNNING?");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Placeholder helpers ────────────────────────────────────────────────────

  const phs = {
    chest:  unit === "imperial" ? "34\""  : "86 CM",
    waist:  unit === "imperial" ? "28\""  : "71 CM",
    hips:   unit === "imperial" ? "38\""  : "96 CM",
    inseam: unit === "imperial" ? "30\""  : "76 CM",
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/75 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
    >
      <motion.div
        className="relative flex w-full max-w-lg flex-col border-4 border-[#111111] bg-white shadow-[16px_16px_0_0_#111111]"
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0,  opacity: 1 }}
        exit={{ y: 16, opacity: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b-4 border-[#111111] bg-[#facc15] px-5 py-4">
          <p className="font-mono text-sm font-black tracking-[0.18em] text-[#111111]">[ ADD TO MY CLOSET ]</p>
          <button
            onClick={onClose}
            className="border-2 border-[#111111] bg-white px-2.5 py-1 font-mono text-xs font-black text-[#111111] shadow-[2px_2px_0_0_#111111] transition-all hover:bg-[#dc2626] hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex max-h-[72vh] flex-col gap-5 overflow-y-auto px-5 py-5">

          {/* Image dropzone */}
          <div
            className={`relative flex cursor-pointer flex-col items-center justify-center border-4 border-dashed transition-colors duration-100 ${
              isDragOver ? "border-[#ff007f] bg-[#ff007f]/10" : "border-[#111111] bg-[#f4f4f0]"
            }`}
            style={{ aspectRatio: "1/1" }}
            onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            {imageDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageDataUrl} alt="Garment preview" className="h-full w-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-2 p-8 text-center">
                <span className="font-mono text-3xl text-[#111111]/25">↓</span>
                <p className="font-mono text-xs font-black tracking-[0.14em] text-[#111111]/50">
                  {isDragOver ? "DROP IT." : "DRAG IMAGE HERE"}
                </p>
                <p className="font-mono text-[0.58rem] tracking-widest text-[#111111]/30">OR CLICK TO BROWSE</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) loadFile(e.target.files[0]); }}
            />
          </div>

          {/* Garment type */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[0.58rem] font-black uppercase tracking-[0.18em] text-[#111111]/60">GARMENT TYPE</label>
            <select
              value={garmentType}
              onChange={e => setGarmentType(e.target.value as GarmentType)}
              className="border-2 border-[#111111] bg-white px-3 py-2 font-mono text-xs font-bold text-[#111111] transition-colors focus:bg-[#facc15] focus:outline-none"
            >
              <option value="">— SELECT TYPE —</option>
              {GARMENT_TYPES.map(t => (
                <option key={t} value={t}>{t.toUpperCase()}</option>
              ))}
            </select>
          </div>

          {/* Unit toggle */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[0.58rem] font-black uppercase tracking-[0.18em] text-[#111111]/60">MEASUREMENT UNIT</label>
            <button
              type="button"
              onClick={() => setUnit(u => u === "imperial" ? "metric" : "imperial")}
              className={`w-full border-2 border-[#111111] px-3 py-2.5 font-mono text-xs font-black tracking-[0.1em] shadow-[2px_2px_0_0_#111111] transition-all ${
                unit === "imperial"
                  ? "bg-[#facc15] text-[#111111]"
                  : "bg-[#111111] text-[#facc15]"
              }`}
            >
              {unit === "imperial" ? "[ UNIT: INCHES ]" : "[ UNIT: CENTIMETRES ]"}
            </button>
          </div>

          {/* Measurement grid */}
          <div className="flex flex-col gap-2">
            <label className="font-mono text-[0.58rem] font-black uppercase tracking-[0.18em] text-[#111111]/60">MEASUREMENTS</label>
            <div className="grid grid-cols-2 gap-3">
              {(["chest", "waist", "hips", "inseam"] as const).map(k => (
                <div key={k} className="flex flex-col gap-1">
                  <span className="font-mono text-[0.5rem] font-black uppercase tracking-widest text-[#111111]/40">{k}</span>
                  <input
                    type="text"
                    value={measurements[k]}
                    placeholder={phs[k]}
                    onChange={e => setMeasurements(m => ({ ...m, [k]: e.target.value }))}
                    className="border-2 border-[#111111] bg-white px-2 py-1.5 font-mono text-xs font-bold text-[#111111] placeholder:text-[#111111]/25 transition-colors focus:bg-[#ff007f] focus:text-white focus:placeholder:text-white/40 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="border-2 border-[#dc2626] bg-[#dc2626]/10 px-3 py-2 font-mono text-xs font-black text-[#dc2626]"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Footer CTA */}
        <div className="flex-shrink-0 border-t-4 border-[#111111] bg-punk-halftone px-5 py-4">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="-rotate-1 w-full border-4 border-[#111111] bg-[#facc15] px-4 py-3 font-mono text-sm font-black tracking-[0.14em] text-[#111111] shadow-[6px_6px_0_0_#111111] transition-all duration-75 hover:rotate-0 hover:bg-[#111111] hover:text-[#facc15] hover:shadow-[8px_8px_0_0_#facc15] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-40 disabled:rotate-0 disabled:shadow-none"
          >
            {isSubmitting ? "UPLOADING TO CLOSET..." : "[ INJECT INTO MY CLOSET ]"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
