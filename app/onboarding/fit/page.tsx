"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import RansomHeader from "@/components/RansomHeader";
import { getRailsToken } from "@/lib/auth-utils";
import { parseGarmentsResponse } from "@/lib/garments";
import type { FitState } from "@/components/PasteUpBoard";

// Load 3D component client-side only
const PasteUpBoard = dynamic(() => import("@/components/PasteUpBoard"), { ssr: false });

// ── Types ──────────────────────────────────────────────────────────────────

interface Material {
  id: number;
  name: string;
  tag: string;
  photo: string | null;
}

interface UserProfile {
  id?: number;
  display_name?: string;
  measurements?: {
    height?: string;
    chest?: string;
    waist?: string;
    hips?: string;
    unit?: 'imperial' | 'metric';
    size_preset?: string;
  };
  pose_vibe?: string;
  pose_notes?: string;
  face_photo_url?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const RAILS_URL = process.env.NEXT_PUBLIC_RAILS_API_URL ?? "http://localhost:3001";

const POSE_PRESETS: Record<string, { hipRotation: number; spineAngle: number; armSpread: number }> = {
  elegant: { hipRotation: 5, spineAngle: 2, armSpread: 10 },
  sassy: { hipRotation: 15, spineAngle: -5, armSpread: 25 },
  sexy: { hipRotation: 20, spineAngle: 8, armSpread: 15 },
  casual: { hipRotation: 0, spineAngle: 0, armSpread: 5 },
  power: { hipRotation: -10, spineAngle: -8, armSpread: 35 },
  playful: { hipRotation: 12, spineAngle: 3, armSpread: 20 }
};

// Catalogue fallback — mirrors every real file under public/inventory/
const STORE_INVENTORY: Material[] = [
  { id: 1,  name: "DIGITAL CAMO FIELD JACKET",       tag: "STORE", photo: "/inventory/digital-camo-field-jacket.webp" },
  { id: 2,  name: "BLACK TUBE TOP",                  tag: "STORE", photo: "/inventory/black-tube-top.webp" },
  { id: 3,  name: "NAVY WORK JACKET",                tag: "STORE", photo: "/inventory/navy-work-jacket.webp" },
  { id: 4,  name: "BLUSH LACE PARTY DRESS",          tag: "STORE", photo: "/inventory/blush-lace-party-dress.png" },
  { id: 5,  name: "WOODLAND CAMO CARGO PANTS",       tag: "STORE", photo: "/inventory/woodland-camo-cargo-pants.webp" },
  { id: 6,  name: "OVERSIZED BLUE PLAID FLANNEL",    tag: "STORE", photo: "/inventory/oversized-blue-plaid-flannel.webp" },
  { id: 7,  name: "DIGITAL CAMO TACTICAL PANTS",     tag: "STORE", photo: "/inventory/digital-camo-tactical-pants.webp" },
  { id: 8,  name: "BLACK LACE UP CROPPED TEE",       tag: "STORE", photo: "/inventory/black-lace-up-cropped-tee.png" },
  { id: 9,  name: "BLACK GOTHIC MESH TOP",           tag: "STORE", photo: "/inventory/black-gothic-mesh-top.png" },
  { id: 10, name: "BLACK LACE TRIM MESH TOP",        tag: "STORE", photo: "/inventory/black-lace-trim-mesh-top.png" },
  { id: 11, name: "RED PLAID MINI SKIRT",            tag: "STORE", photo: "/inventory/red-plaid-mini-skirt.png" },
  { id: 12, name: "BLACK CHAIN MINI SKIRT",          tag: "STORE", photo: "/inventory/black-chain-mini-skirt.png" },
  { id: 13, name: "BLACK LACE UP FLARE PANTS",       tag: "STORE", photo: "/inventory/black-lace-up-flare-pants.png" },
  { id: 14, name: "BLACK DRAPED OFF SHOULDER DRESS", tag: "STORE", photo: "/inventory/black-draped-off-shoulder-dress.png" },
  { id: 15, name: "RED SATIN COCKTAIL DRESS",        tag: "STORE", photo: "/inventory/red-satin-cocktail-dress.png" },
  { id: 16, name: "BLUSH LACE COCKTAIL DRESS",       tag: "STORE", photo: "/inventory/blush-lace-cocktail-dress.png" },
  { id: 17, name: "SILVER DRAPED COCKTAIL DRESS",    tag: "STORE", photo: "/inventory/silver-draped-cocktail-dress.png" },
  { id: 18, name: "BROWN PLAID FLANNEL SHIRT",       tag: "STORE", photo: "/inventory/brown-plaid-flannel-shirt.webp" },
  { id: 19, name: "OLIVE FIELD JACKET",              tag: "STORE", photo: "/inventory/olive-field-jacket.webp" },
  { id: 20, name: "RED BUFFALO PLAID FLANNEL",       tag: "STORE", photo: "/inventory/red-buffalo-plaid-flannel.webp" },
  { id: 21, name: "FLORAL SMOCKED SUNDRESS",         tag: "STORE", photo: "/inventory/floral-smocked-sundress.png" },
  { id: 22, name: "OLIVE FLEECE SWEATSHIRT",         tag: "STORE", photo: "/inventory/olive-fleece-sweatshirt.png" },
  { id: 23, name: "LIGHT WASH STRAIGHT JEANS",       tag: "STORE", photo: "/inventory/light-wash-straight-jeans.png" },
  { id: 24, name: "BEIGE TRENCH COAT",               tag: "STORE", photo: "/inventory/beige-trench-coat.png" },
  { id: 25, name: "LIGHT BLUE BUTTON UP SHIRT",      tag: "STORE", photo: "/inventory/light-blue-button-up-shirt.png" },
  { id: 26, name: "BEIGE CARGO JOGGERS",             tag: "STORE", photo: "/inventory/beige-cargo-joggers.png" },
  { id: 27, name: "TAUPE LINEN BUTTON UP",           tag: "STORE", photo: "/inventory/taupe-linen-button-up.png" },
  { id: 28, name: "BEIGE PLAID MIDI SKIRT",          tag: "STORE", photo: "/inventory/beige-plaid-midi-skirt.png" },
  { id: 29, name: "WHITE CLASSIC TSHIRT",            tag: "STORE", photo: "/inventory/white-classic-tshirt.png" },
  { id: 30, name: "HEATHER GRAY CLASSIC TSHIRT",     tag: "STORE", photo: "/inventory/heather-gray-classic-tshirt.png" },
  { id: 31, name: "BLACK CLASSIC TSHIRT",            tag: "STORE", photo: "/inventory/black-classic-tshirt.png" },
  { id: 32, name: "SKY BLUE CLASSIC TSHIRT",         tag: "STORE", photo: "/inventory/sky-blue-classic-tshirt.png" },
  { id: 33, name: "SAGE CLASSIC TSHIRT",             tag: "STORE", photo: "/inventory/sage-classic-tshirt.png" },
  { id: 34, name: "BLUSH CLASSIC TSHIRT",            tag: "STORE", photo: "/inventory/blush-classic-tshirt.png" },
  { id: 35, name: "LAVENDER CLASSIC TSHIRT",         tag: "STORE", photo: "/inventory/lavender-classic-tshirt.png" },
  { id: 36, name: "CREAM CLASSIC TSHIRT",            tag: "STORE", photo: "/inventory/cream-classic-tshirt.png" },
  { id: 37, name: "RED CLASSIC TSHIRT",              tag: "STORE", photo: "/inventory/red-classic-tshirt.png" },
  { id: 38, name: "ROSE CLASSIC TSHIRT",             tag: "STORE", photo: "/inventory/rose-classic-tshirt.png" },
  { id: 39, name: "YELLOW CLASSIC TSHIRT",           tag: "STORE", photo: "/inventory/yellow-classic-tshirt.png" },
  { id: 40, name: "FOREST GREEN CLASSIC TSHIRT",     tag: "STORE", photo: "/inventory/forest-green-classic-tshirt.png" },
  { id: 41, name: "OLIVE UTILITY OVERSHIRT",         tag: "STORE", photo: "/inventory/olive-utility-overshirt.jpg" },
  { id: 42, name: "WOODLAND CAMO OVERSHIRT",         tag: "STORE", photo: "/inventory/woodland-camo-overshirt.jpg" },
  { id: 43, name: "GUNS N ROSES GRAPHIC TEE",        tag: "STORE", photo: "/inventory/guns-n-roses-graphic-tee.webp" },
  { id: 44, name: "MULTICAM RUCHED LONG SLEEVE TOP", tag: "STORE", photo: "/inventory/multicam-ruched-long-sleeve-top.jpg" },
  { id: 45, name: "WHITE HANGING TEE",               tag: "STORE", photo: "/inventory/white-hanging-tee.jpg" },
  { id: 46, name: "BROWN PLAID WORK SHIRT",          tag: "STORE", photo: "/inventory/brown-plaid-work-shirt.webp" },
  { id: 47, name: "BLACK HANGING TEE",               tag: "STORE", photo: "/inventory/black-hanging-tee.jpg" },
  { id: 48, name: "DENIM BUTTON UP SHIRT",           tag: "STORE", photo: "/inventory/denim-button-up-shirt.jpg" },
  { id: 49, name: "NIRVANA GRAPHIC TEE",             tag: "STORE", photo: "/inventory/nirvana-graphic-tee.webp" },
  { id: 50, name: "DESERT CAMO CARGO PANTS",         tag: "STORE", photo: "/inventory/desert-camo-cargo-pants.webp" },
];

export default function FittingRoomPage() {
  const { data: session } = useSession();
  const router = useRouter();
  
  const [profile, setProfile] = useState<UserProfile>({});
  const [selectedTopFabric, setSelectedTopFabric] = useState<Material | null>(null);
  const [selectedBottomFabric, setSelectedBottomFabric] = useState<Material | null>(null);
  const [fitState, setFitState] = useState<FitState>({ widthScale: 1, hemLength: 1 });
  const [isDragOverTop, setIsDragOverTop] = useState(false);
  const [isDragOverBottom, setIsDragOverBottom] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [inventory, setInventory] = useState<Material[]>(STORE_INVENTORY);
  const [skinTone, setSkinTone] = useState<string | undefined>(undefined);

  // Sample average skin tone from a face image URL using an off-screen canvas
  const sampleSkinTone = useCallback((imgUrl: string) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, 32, 32);
      const { data } = ctx.getImageData(0, 0, 32, 32);
      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 128) continue; // skip transparent
        r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
      }
      if (count === 0) return;
      const toHex = (v: number) => Math.round(v / count).toString(16).padStart(2, "0");
      setSkinTone(`#${toHex(r)}${toHex(g)}${toHex(b)}`);
    };
    img.src = imgUrl;
  }, []);

  // Load user profile
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const token = getRailsToken();
        const res = await fetch(`${RAILS_URL}/api/v1/me`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (res.ok) {
          const userData = await res.json();
          setProfile(userData);
          if (userData.face_photo_url) sampleSkinTone(userData.face_photo_url);
        }
      } catch (error) {
        console.error('Failed to load profile:', error);
      }
    };

    if (session) {
      loadProfile();
    }
  }, [session, sampleSkinTone]);

  // Load store inventory
  useEffect(() => {
    const loadInventory = async () => {
      try {
        const token = getRailsToken();
        const res = await fetch(`${RAILS_URL}/api/v1/garments`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (res.ok) {
          const data = await res.json();
          const items = parseGarmentsResponse(data);
          setInventory(items.length > 0 ? items : STORE_INVENTORY);
        }
      } catch (error) {
        console.error('Failed to load inventory:', error);
      }
    };

    // Always load; fall back to STORE_INVENTORY if Rails not reachable
    loadInventory();
  }, []);

  const handleItemClick = (item: Material) => {
    // Toggle selection
    if (selectedTopFabric?.id === item.id) {
      setSelectedTopFabric(null);
    } else if (selectedBottomFabric?.id === item.id) {
      setSelectedBottomFabric(null);
    } else {
      // Smart assignment based on garment type or current selection
      if (!selectedTopFabric) {
        setSelectedTopFabric(item);
      } else if (!selectedBottomFabric) {
        setSelectedBottomFabric(item);
      } else {
        // Replace top fabric if both slots filled
        setSelectedTopFabric(item);
      }
    }
  };

  const handleDropOnZone = useCallback((e: React.DragEvent, zone: 'top' | 'bottom') => {
    e.preventDefault();
    setIsDragOverTop(false);
    setIsDragOverBottom(false);

    const itemId = e.dataTransfer.getData('application/json');
    if (!itemId) return;

    try {
      const item = JSON.parse(itemId) as Material;
      if (zone === 'top') {
        setSelectedTopFabric(item);
      } else {
        setSelectedBottomFabric(item);
      }
    } catch (error) {
      console.error('Invalid drag data:', error);
    }
  }, []);

  const completeOnboarding = async () => {
    setIsLoading(true);
    
    try {
      // Save any final selections to the user's garment preferences
      // In a real app, you might save the selected garments to user preferences
      
      const token = getRailsToken();
      const res = await fetch(`${RAILS_URL}/api/v1/me/complete_onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (res.ok) {
        router.push('/studio');
      } else {
        console.error('Failed to complete onboarding');
      }
    } catch (error) {
      console.error('Onboarding completion error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate scales from profile measurements for the 3D mannequin
  const getScalesFromMeasurements = () => {
    if (!profile.measurements) {
      return { ch: 1, wt: 1, hp: 1, ht: 1 }; // Default proportions
    }

    const { height, chest, waist, hips, unit } = profile.measurements;
    
    // Convert to consistent units and calculate relative scales
    // This is a simplified calculation - real implementation would be more sophisticated
    const heightNum = parseFloat(height || '170');
    const chestNum = parseFloat(chest || '34');
    const waistNum = parseFloat(waist || '26');
    const hipsNum = parseFloat(hips || '36');

    // Normalize against average proportions
    const avgHeight = unit === 'metric' ? 170 : 67; // cm or inches
    const avgChest = unit === 'metric' ? 86 : 34;
    const avgWaist = unit === 'metric' ? 66 : 26;
    const avgHips = unit === 'metric' ? 91 : 36;

    return {
      ht: heightNum / avgHeight,
      ch: chestNum / avgChest,
      wt: waistNum / avgWaist,
      hp: hipsNum / avgHips,
    };
  };

  const scales = getScalesFromMeasurements();

  // Apply pose preset rotations
  const poseRotations = profile.pose_vibe ? POSE_PRESETS[profile.pose_vibe] || POSE_PRESETS.casual : POSE_PRESETS.casual;

  if (!session) {
    return (
      <div className="min-h-screen bg-punk-halftone flex items-center justify-center">
        <p className="font-mono text-lg text-[#111111]">Please sign in to continue</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-white text-black font-mono">
      {/* Header moved to be part of the flex layout */}
      <div className="flex flex-col h-full w-full">
        <header className="flex-shrink-0 p-4 border-b-4 border-[#111111] bg-white">
          <div className="flex items-center justify-between">
            <RansomHeader text="3D FITTING ROOM" />
            <div className="flex items-center gap-4">
              <div className="font-mono text-xs text-[#111111]/60">
                STEP 4/4 — FINAL FITTING
              </div>
              <button
                onClick={() => router.push('/onboarding')}
                className="font-mono text-xs text-[#111111] hover:text-[#dc2626]"
              >
                ← BACK TO POSES
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 flex min-h-0">
          {/* LEFT — Inventory Sidebar */}
          <div className="w-80 flex-col h-full overflow-y-auto border-r-8 border-[#111111] flex">
            <div className="flex-shrink-0 border-b-4 border-[#111111] bg-[#111111] px-4 py-3">
              <h3 className="font-mono text-sm font-black tracking-[0.12em] text-[#facc15]">
                STORE INVENTORY
              </h3>
            </div>
            
            <div className="flex-1 overflow-y-auto bg-white p-3 space-y-3">
            {inventory.map((item) => {
              const isSelected = selectedTopFabric?.id === item.id || selectedBottomFabric?.id === item.id;
              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify(item));
                  }}
                  onClick={() => handleItemClick(item)}
                  className={`cursor-pointer border-4 p-3 transition-all duration-75 ${
                    isSelected
                      ? 'border-[#ff007f] bg-[#ff007f]/10 shadow-[4px_4px_0_0_#ff007f]'
                      : 'border-[#111111] bg-white hover:shadow-[3px_3px_0_0_#111111]'
                  }`}
                >
                  {item.photo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img 
                      src={item.photo} 
                      alt={item.name}
                      className="w-full h-24 object-cover mb-2 border-2 border-[#111111]"
                    />
                  )}
                  <div>
                    <h4 className="font-mono text-xs font-black tracking-[0.08em] text-[#111111]">
                      {item.name}
                    </h4>
                    <p className="font-mono text-[0.6rem] tracking-[0.1em] text-[#111111]/60">
                      {item.tag}
                    </p>
                  </div>
                </div>
              );
            })}
            </div>
          </div>

          {/* CENTER — 3D Canvas */}
          <div className="flex-1 relative min-h-0 min-w-0 flex flex-col">
            {/* Face reference strip — only visible when face photo is saved */}
            {profile.face_photo_url && (
              <div className="flex-shrink-0 flex items-center gap-3 border-b-4 border-[#111111] bg-[#f4f4f0] px-4 py-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={profile.face_photo_url}
                  alt="Your face reference"
                  className="h-10 w-10 rounded-full border-2 border-[#111111] object-cover"
                />
                <div>
                  <p className="font-mono text-[0.6rem] font-black tracking-[0.12em] text-[#111111]">YOUR DIGITAL DOUBLE</p>
                  <p className="font-mono text-[0.55rem] tracking-[0.08em] text-[#111111]/50">Face mapped to mannequin head</p>
                </div>
              </div>
            )}
          <div className="flex-1 relative min-h-0">
          <PasteUpBoard
            topFabric={selectedTopFabric}
            bottomFabric={selectedBottomFabric}
            phase="idle"
            isDragOverTop={isDragOverTop}
            isDragOverBottom={isDragOverBottom}
            metrics={{
              height: profile.measurements?.height || '',
              chest: profile.measurements?.chest || '',
              waist: profile.measurements?.waist || '',
              hips: profile.measurements?.hips || ''
            }}
            unit={profile.measurements?.unit || 'imperial'}
            facePhotoUrl={profile.face_photo_url}
            skinTone={skinTone}
            onFitChange={setFitState}
            onDragOverTop={() => setIsDragOverTop(true)}
            onDragOverBottom={() => setIsDragOverBottom(true)}
            onDragLeave={() => { setIsDragOverTop(false); setIsDragOverBottom(false); }}
            onDropTop={(e) => handleDropOnZone(e, 'top')}
            onDropBottom={(e) => handleDropOnZone(e, 'bottom')}
          />

          {/* Pose indicator */}
          {profile.pose_vibe && (
            <div className="absolute top-4 right-4 border-4 border-[#111111] bg-[#facc15] px-3 py-2">
              <p className="font-mono text-xs font-black tracking-[0.1em] text-[#111111]">
                POSE: {profile.pose_vibe.toUpperCase()}
              </p>
            </div>
          )}
          </div>{/* inner canvas div */}
          </div>{/* outer center column */}

          {/* RIGHT — Controls Sidebar */}
          <div className="w-80 flex-col h-full overflow-y-auto p-4 border-l-8 border-[#111111] bg-white flex">
          <div className="mb-6">
            <h3 className="font-mono text-sm font-black tracking-[0.12em] text-[#111111] mb-4">
              FITTED SELECTIONS
            </h3>
            
            <div className="space-y-3">
              <div className="border-4 border-[#111111] p-3">
                <p className="font-mono text-xs font-black tracking-[0.08em] text-[#111111] mb-2">
                  TOP FABRIC:
                </p>
                {selectedTopFabric ? (
                  <div className="flex items-center gap-2">
                    {selectedTopFabric.photo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img 
                        src={selectedTopFabric.photo} 
                        alt=""
                        className="w-8 h-8 object-cover border-2 border-[#111111]"
                      />
                    )}
                    <span className="font-mono text-xs text-[#111111]">
                      {selectedTopFabric.name}
                    </span>
                  </div>
                ) : (
                  <p className="font-mono text-xs text-[#111111]/40">None selected</p>
                )}
              </div>

              <div className="border-4 border-[#111111] p-3">
                <p className="font-mono text-xs font-black tracking-[0.08em] text-[#111111] mb-2">
                  BOTTOM FABRIC:
                </p>
                {selectedBottomFabric ? (
                  <div className="flex items-center gap-2">
                    {selectedBottomFabric.photo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img 
                        src={selectedBottomFabric.photo} 
                        alt=""
                        className="w-8 h-8 object-cover border-2 border-[#111111]"
                      />
                    )}
                    <span className="font-mono text-xs text-[#111111]">
                      {selectedBottomFabric.name}
                    </span>
                  </div>
                ) : (
                  <p className="font-mono text-xs text-[#111111]/40">None selected</p>
                )}
              </div>
            </div>
          </div>

          {/* Fitting controls */}
          <div className="mb-6">
            <h3 className="font-mono text-sm font-black tracking-[0.12em] text-[#111111] mb-4">
              FIT ADJUSTMENTS
            </h3>
            
            <div className="space-y-3">
              <div>
                <label className="block font-mono text-xs font-black tracking-[0.08em] text-[#111111] mb-1">
                  WIDTH: {fitState.widthScale.toFixed(2)}x
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.05"
                  value={fitState.widthScale}
                  onChange={(e) => setFitState(prev => ({ ...prev, widthScale: parseFloat(e.target.value) }))}
                  className="w-full h-2 border-2 border-[#111111] bg-[#f4f4f0] accent-[#111111]"
                />
              </div>
              
              <div>
                <label className="block font-mono text-xs font-black tracking-[0.08em] text-[#111111] mb-1">
                  LENGTH: {fitState.hemLength.toFixed(2)}x
                </label>
                <input
                  type="range"
                  min="0.3"
                  max="2.0"
                  step="0.05"
                  value={fitState.hemLength}
                  onChange={(e) => setFitState(prev => ({ ...prev, hemLength: parseFloat(e.target.value) }))}
                  className="w-full h-2 border-2 border-[#111111] bg-[#f4f4f0] accent-[#facc15]"
                />
              </div>
            </div>
          </div>

          {/* Complete onboarding */}
          <div className="mt-auto">
            <button
              onClick={completeOnboarding}
              disabled={isLoading}
              className="w-full border-4 border-[#111111] bg-[#059669] px-6 py-4 font-mono text-sm font-black tracking-[0.14em] text-white shadow-[4px_4px_0_0_#111111] transition-all duration-75 hover:bg-[#111111] hover:text-[#059669] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isLoading ? "COMPLETING..." : "COMPLETE SETUP →"}
            </button>
            
            <p className="mt-3 font-mono text-xs text-[#111111]/60 text-center">
              Ready to start creating? Your measurements and preferences have been saved.
            </p>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}