"use client";

import { useState } from "react";

export default function RewireBlock({ analysisText }: { analysisText: string }) {
  const [isMutating, setIsMutating] = useState(false);
  const [mutatedImage, setMutatedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleMutate = async () => {
    setIsMutating(true);
    setError(null);

    try {
      const response = await fetch("/api/mutate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisText }),
      });

      if (!response.ok) {
        throw new Error("FAILED TO REWIRE AESTHETIC.");
      }

      const data = await response.json();
      setMutatedImage(data.imageUrl);
    } catch {
      setError("ERROR: MUTATION FAILED. CHECK VERCEL LOGS.");
    } finally {
      setIsMutating(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center border-4 border-white p-6 shadow-[6px_6px_0px_white] bg-[#050505] font-mono uppercase mt-8 relative">
      {/* Glitch overlay accent */}
      <div className="absolute inset-0 pointer-events-none border border-[#39ff14] opacity-20 mix-blend-overlay" />

      {isMutating ? (
        <div className="text-[#39ff14] animate-pulse text-center font-bold tracking-widest py-8">
          [ DECONSTRUCTING MATERIAL... PLEASE STAND BY ]
        </div>
      ) : mutatedImage ? (
        <div className="w-full flex flex-col items-center gap-6">
          <div className="relative w-full border-4 border-white shadow-[4px_4px_0px_#39ff14]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mutatedImage}
              alt="Deconstructed Garment"
              className="w-full h-auto filter contrast-125 saturate-150 grayscale-[20%]"
            />
          </div>
          <button
            onClick={handleMutate}
            className="w-full py-4 bg-white text-[#050505] font-bold hover:bg-[#39ff14] hover:text-[#050505] transition-all transform hover:-skew-x-6 shadow-[4px_4px_0px_#39ff14]"
          >
            RE-MUTATE GEOMETRY
          </button>
        </div>
      ) : (
        <button
          onClick={handleMutate}
          className="w-full py-6 bg-transparent text-white border-2 border-white font-bold text-xl hover:bg-white hover:text-[#050505] transition-all shadow-[6px_6px_0px_white] hover:shadow-none hover:translate-x-[6px] hover:translate-y-[6px]"
        >
          REWIRE AESTHETIC
        </button>
      )}

      {error && (
        <div className="text-red-600 mt-4 font-bold tracking-wider text-center bg-black p-2 border border-red-600">
          {error}
        </div>
      )}
    </div>
  );
}
