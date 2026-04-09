"use client";

import { useSession, signOut, signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import RansomHeader from "@/components/RansomHeader";
import { getRailsAuthHeaders, getRailsAuthHeadersAsync } from "@/lib/auth-utils";
import { generateFaceMesh } from "@/app/actions/generateAvatar";

// ── Types ──────────────────────────────────────────────────────────────────

type OnboardingStep = 1 | 2 | 3 | 4;

interface UserProfile {
  id?: number;
  display_name?: string;
  phone?: string;
  bio?: string;
  onboarding_complete?: boolean;
  /** Persisted on Rails as jsonb — source of truth for step 3 */
  body_profile?: Record<string, unknown>;
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

function measurementsFromBodyProfile(
  bp: Record<string, unknown> | undefined,
): UserProfile["measurements"] | undefined {
  if (!bp || typeof bp !== "object") return undefined;
  const unit = bp.unit === "metric" || bp.unit === "imperial" ? bp.unit : "imperial";
  return {
    height: String(bp.height ?? bp.height_cm ?? ""),
    chest: String(bp.chest ?? bp.bust_cm ?? ""),
    waist: String(bp.waist ?? bp.waist_cm ?? ""),
    hips: String(bp.hips ?? bp.hip_cm ?? ""),
    unit,
    size_preset: String(bp.size_preset ?? ""),
  };
}

function normalizeMePayload(raw: Record<string, unknown>): UserProfile {
  const bp = raw.body_profile as Record<string, unknown> | undefined;
  return {
    ...(raw as unknown as UserProfile),
    body_profile: bp,
    measurements: measurementsFromBodyProfile(bp),
  };
}

const RAILS_URL = process.env.NEXT_PUBLIC_RAILS_API_URL ?? "http://localhost:3001";

// Use the centralized auth utility that checks cookies first, then localStorage, then session
const railsAuthHeader = getRailsAuthHeadersAsync;

/** Readable message from Rails / non-JSON error bodies */
async function parseRailsError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const j = JSON.parse(text) as {
      error?: string;
      message?: string;
      detail?: string;
      errors?: string[] | Record<string, string[]>;
    };
    if (Array.isArray(j.errors)) return j.errors.join(". ");
    if (j.errors && typeof j.errors === "object") {
      return Object.entries(j.errors)
        .map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`)
        .join(". ");
    }
    const base =
      j.error || j.message || j.detail || `Request failed (${res.status})`;
    if (res.status >= 500) {
      return `${base} — Check Rails: migrations (display_name, body_profile…), and Api::V1::MeController#update.`;
    }
    return base;
  } catch {
    return (
      text.trim().slice(0, 180) ||
      `Request failed (${res.status}) — Is Rails running on ${RAILS_URL}?`
    );
  }
}

interface StepProps {
  profile: UserProfile;
  onUpdate: (updates: Partial<UserProfile>) => Promise<boolean>;
  onNext: () => void;
  onPrev: () => void;
  isLoading: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────────

const SIZE_PRESETS = [
  { label: "XS", value: "xs" },
  { label: "S", value: "s" },
  { label: "M", value: "m" },
  { label: "L", value: "l" },
  { label: "XL", value: "xl" },
  { label: "XXL", value: "xxl" },
];

const LENGTH_MODIFIERS = [
  { label: "Petite", value: "petite" },
  { label: "Regular", value: "regular" },  
  { label: "Tall", value: "tall" },
];

const POSE_VIBES = [
  { id: "elegant", label: "Elegant", color: "#facc15", description: "Refined, graceful positioning" },
  { id: "sassy", label: "Sassy", color: "#ff007f", description: "Confident, attitude-filled stance" },
  { id: "sexy", label: "Sexy", color: "#dc2626", description: "Alluring, sultry positioning" },
  { id: "casual", label: "Casual", color: "#111111", description: "Relaxed, everyday posture" },
  { id: "power", label: "Power", color: "#7c3aed", description: "Strong, commanding presence" },
  { id: "playful", label: "Playful", color: "#059669", description: "Fun, energetic positioning" },
];

// ── Step Components ────────────────────────────────────────────────────────

function Step1Profile({ profile, onUpdate, onNext, isLoading }: StepProps) {
  const { data: session } = useSession();

  const [displayName, setDisplayName] = useState(profile.display_name || "");

  // Prefill from OAuth name once when profile has no display_name yet
  useEffect(() => {
    if (profile.display_name?.trim()) return;
    const fromOAuth = session?.user?.name?.trim();
    if (fromOAuth) setDisplayName(fromOAuth);
  }, [profile.display_name, session?.user?.name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const ok = await onUpdate({
      display_name: displayName.trim(),
    });
    if (ok) onNext();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="font-mono text-lg font-black tracking-[0.12em] text-[#111111] mb-2">
          STEP 1 // DISPLAY NAME
        </h2>
        <p className="font-mono text-sm text-[#111111]/60">
          You already signed in with email or Google — add how you want to appear in the studio.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <label className="block font-mono text-xs font-black uppercase tracking-[0.1em] text-[#111111] mb-2">
            DISPLAY NAME *
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="YOUR STUDIO NAME"
            required
            autoComplete="nickname"
            className="w-full border-4 border-[#111111] bg-white px-4 py-3 font-mono text-sm font-black tracking-[0.08em] text-[#111111] placeholder:text-[#111111]/40 focus:bg-[#facc15] focus:outline-none"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={!displayName.trim() || isLoading}
        className="w-full border-4 border-[#111111] bg-[#facc15] px-6 py-4 font-mono text-sm font-black tracking-[0.14em] text-[#111111] shadow-[4px_4px_0_0_#111111] transition-all duration-75 hover:bg-[#111111] hover:text-[#facc15] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isLoading ? "SAVING..." : "NEXT → FACE PHOTO"}
      </button>
    </form>
  );
}

function Step2FacePhoto({ profile, onUpdate, onNext, onPrev, isLoading }: StepProps) {
  const { data: session } = useSession();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [facePhoto, setFacePhoto] = useState<string | null>(profile.face_photo_url || null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [useCamera, setUseCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const testAuth = async () => {
    console.log('=== AUTH TEST ===');
    const auth = await railsAuthHeader();
    console.log('Auth headers:', auth);
    
    try {
      const res = await fetch(`${RAILS_URL}/api/v1/me`, {
        headers: { ...auth }
      });
      console.log('Test request status:', res.status);
      const text = await res.text();
      console.log('Test request response:', text);
    } catch (error) {
      console.error('Test request error:', error);
    }
  };

  const testRailsLogin = async () => {
    if (!session?.user?.email) {
      console.error('No user email available');
      return;
    }

    console.log('=== TESTING RAILS GOOGLE LOGIN ===');
    try {
      const res = await fetch(`${RAILS_URL}/api/v1/auth/google_login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: {
            email: session.user.email,
            name: session.user.name || '',
            sub: 'test-sub-id',
          },
        }),
      });

      console.log('Rails login status:', res.status);
      if (res.ok) {
        const data = await res.json();
        console.log('Rails login response:', data);
      } else {
        const errorText = await res.text();
        console.error('Rails login error:', errorText);
      }
    } catch (error) {
      console.error('Rails login request failed:', error);
    }
  };

  const fixAuth = async () => {
    console.log('=== FIXING AUTH ===');
    try {
      await signOut({ redirect: false });
      await signIn('google', { redirect: false });
    } catch (error) {
      console.error('Fix auth error:', error);
    }
  };

  const testMeshGeneration = async () => {
    if (!previewUrl) {
      console.error('No preview image available for testing');
      return;
    }

    console.log('=== TESTING 3D MESH GENERATION ===');
    try {
      // Convert preview URL to blob for testing
      const response = await fetch(previewUrl);
      const blob = await response.blob();
      
      const formData = new FormData();
      formData.append('face_photo', blob, 'test_image.jpg');

      const result = await generateFaceMesh(formData);
      console.log('Test mesh generation result:', result);
    } catch (error) {
      console.error('Test mesh generation error:', error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const input = e.target;

    const preview = URL.createObjectURL(file);
    setPreviewUrl(preview);
    setIsUploading(true);
    setIsGenerating(false);
    setUploadProgress(0);
    setUploadError(null);

    let revokePreviewAfterSave = true;

    try {
      setUploadProgress(20);
      const auth = await railsAuthHeader();
      const photoFormData = new FormData();
      photoFormData.append('face_photo', file);

      const photoRes = await fetch(`${RAILS_URL}/api/v1/me/face_photo`, {
        method: 'PATCH',
        headers: { ...auth },
        body: photoFormData,
      });

      setUploadProgress(70);

      if (photoRes.ok) {
        const photoData = await photoRes.json() as { face_photo_url?: string };
        if (photoData.face_photo_url) {
          setFacePhoto(photoData.face_photo_url);
        } else {
          setUploadError('Server saved the photo but returned no URL. You can continue; the image below is your upload.');
          setFacePhoto(preview);
          revokePreviewAfterSave = false;
        }
      } else {
        const errorText = await photoRes.text();
        console.warn('Photo save failed:', photoRes.status, errorText);
        setUploadError(
          `Could not save to server (${photoRes.status}). Using your local photo so you can continue — check login and that Rails is running.`,
        );
        setFacePhoto(preview);
        revokePreviewAfterSave = false;
      }

      setUploadProgress(100);

      // Optional Fal.ai mesh — never block the UI (was causing infinite "UPLOADING" when Fal hung)
      void (async () => {
        try {
          setIsGenerating(true);
          const meshFormData = new FormData();
          meshFormData.append('face_photo', file);
          const aiResponse = await generateFaceMesh(meshFormData);
          if (aiResponse.success && aiResponse.meshUrl) {
            const meshRes = await fetch(`${RAILS_URL}/api/v1/me`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', ...auth },
              body: JSON.stringify({ user: { avatar_mesh_url: aiResponse.meshUrl } }),
            });
            if (!meshRes.ok) {
              console.warn('3D mesh URL save failed (photo still saved):', meshRes.status);
            }
          } else if (aiResponse.error) {
            console.warn('Fal.ai mesh:', aiResponse.error);
          }
        } catch (err) {
          console.warn('Background mesh generation failed:', err);
        } finally {
          setIsGenerating(false);
        }
      })();
    } catch (error) {
      console.error('Face upload error:', error);
      setUploadError(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setFacePhoto(preview);
      revokePreviewAfterSave = false;
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      input.value = '';
      setPreviewUrl(null);
      if (revokePreviewAfterSave) {
        setTimeout(() => URL.revokeObjectURL(preview), 500);
      }
    }
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setUseCamera(true);
    } catch (error) {
      console.error('Camera access denied:', error);
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0);
    
    canvas.toBlob(async (blob) => {
      if (!blob) return;

      const fallbackPreview = URL.createObjectURL(blob);
      let revokeFallback = true;

      setPreviewUrl(fallbackPreview);
      setIsUploading(true);
      setIsGenerating(false);
      setUploadProgress(0);
      setUploadError(null);

      try {
        setUploadProgress(20);
        const auth = await railsAuthHeader();
        const photoFormData = new FormData();
        photoFormData.append('face_photo', blob, 'camera_capture.jpg');

        const photoRes = await fetch(`${RAILS_URL}/api/v1/me/face_photo`, {
          method: 'PATCH',
          headers: { ...auth },
          body: photoFormData,
        });

        setUploadProgress(70);

        if (photoRes.ok) {
          const data = await photoRes.json() as { face_photo_url?: string };
          if (data.face_photo_url) {
            setFacePhoto(data.face_photo_url);
            stopCamera();
          } else {
            setUploadError('No photo URL from server — using camera capture locally.');
            setFacePhoto(fallbackPreview);
            revokeFallback = false;
            stopCamera();
          }
        } else {
          console.warn('Camera photo save failed:', photoRes.status);
          setUploadError(
            `Could not save (${photoRes.status}). Using camera capture locally so you can continue.`,
          );
          setFacePhoto(fallbackPreview);
          revokeFallback = false;
          stopCamera();
        }

        setUploadProgress(100);

        void (async () => {
          try {
            setIsGenerating(true);
            const meshFormData = new FormData();
            meshFormData.append('face_photo', blob, 'camera_capture.jpg');
            const aiResponse = await generateFaceMesh(meshFormData);
            if (aiResponse.success && aiResponse.meshUrl) {
              await fetch(`${RAILS_URL}/api/v1/me`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', ...auth },
                body: JSON.stringify({ user: { avatar_mesh_url: aiResponse.meshUrl } }),
              });
            } else if (aiResponse.error) {
              console.warn('Fal.ai mesh:', aiResponse.error);
            }
          } catch (err) {
            console.warn('Background mesh generation failed:', err);
          } finally {
            setIsGenerating(false);
          }
        })();
      } catch (error) {
        console.error('Camera upload error:', error);
        setUploadError(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setFacePhoto(fallbackPreview);
        revokeFallback = false;
        stopCamera();
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
        setPreviewUrl(null);
        if (revokeFallback) {
          setTimeout(() => URL.revokeObjectURL(fallbackPreview), 500);
        }
      }
    }, 'image/jpeg', 0.8);
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setUseCamera(false);
  };

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="font-mono text-lg font-black tracking-[0.12em] text-[#111111] mb-2">
          STEP 2 // FACE PHOTO
        </h2>
        <p className="font-mono text-sm text-[#111111]/60">
          High-quality photo for AI generation. Clear lighting, direct gaze.
        </p>
        
      </div>

      {facePhoto ? (
        <div className="text-center">
          <div className="mx-auto w-48 h-48 border-4 border-[#111111] bg-white p-2 shadow-[4px_4px_0_0_#111111]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={facePhoto} 
              alt="Face photo" 
              className="w-full h-full object-cover border-2 border-[#111111]"
            />
          </div>
          <p className="mt-3 font-mono text-xs text-[#059669] font-black">
            ✓ DIGITAL DOUBLE CREATED & SAVED
          </p>
        </div>
      ) : previewUrl ? (
        <div className="text-center space-y-4">
          <div className="mx-auto w-48 h-48 border-4 border-[#111111] bg-white p-2 shadow-[4px_4px_0_0_#111111]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={previewUrl} 
              alt="Preview" 
              className="w-full h-full object-cover border-2 border-[#111111]"
            />
          </div>
          <p className="font-mono text-xs text-[#111111]/60">
            {isUploading
              ? 'SAVING PHOTO…'
              : uploadError
                ? 'PREVIEW — SEE MESSAGE BELOW'
                : 'PROCESSING…'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {useCamera ? (
            <div className="text-center">
              <video 
                ref={videoRef}
                autoPlay 
                playsInline
                className="mx-auto w-64 h-64 border-4 border-[#111111] bg-[#111111] object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
              <div className="mt-4 flex gap-3 justify-center">
                <button
                  type="button"
                  onClick={capturePhoto}
                  disabled={isUploading}
                  className="border-4 border-[#111111] bg-[#facc15] px-4 py-2 font-mono text-sm font-black tracking-[0.1em] text-[#111111] shadow-[4px_4px_0_0_#111111] transition-all duration-75 hover:bg-[#111111] hover:text-[#facc15] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
                >
                  {isUploading ? (isGenerating ? "GENERATING DIGITAL DOUBLE..." : "SAVING...") : "CAPTURE"}
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="border-4 border-[#111111] bg-white px-4 py-2 font-mono text-sm font-black tracking-[0.1em] text-[#111111] shadow-[4px_4px_0_0_#111111] transition-all duration-75 hover:bg-[#dc2626] hover:text-white active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
                >
                  CANCEL
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={startCamera}
                className="flex flex-col items-center justify-center h-32 border-4 border-dashed border-[#111111] bg-[#f4f4f0] hover:bg-white transition-colors"
              >
                <div className="text-2xl mb-2">📷</div>
                <span className="font-mono text-sm font-black text-[#111111]">USE CAMERA</span>
              </button>

              <label className="flex flex-col items-center justify-center h-32 border-4 border-dashed border-[#111111] bg-[#f4f4f0] hover:bg-white transition-colors cursor-pointer">
                <div className="text-2xl mb-2">📁</div>
                <span className="font-mono text-sm font-black text-[#111111]">UPLOAD FILE</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}
          
          {isUploading && (
            <div className="space-y-3">
              <div className="text-center">
                <p className="font-mono text-sm font-black text-[#111111] mb-2">
                  {isGenerating ? '🔮 GENERATING DIGITAL DOUBLE...' : '💾 SAVING IDENTITY...'} {Math.round(uploadProgress)}%
                </p>
                <div className="w-full max-w-xs mx-auto h-3 border-4 border-[#111111] bg-white shadow-[2px_2px_0_0_#111111]">
                  <div 
                    className={`h-full transition-all duration-300 ease-out ${isGenerating ? 'bg-[#ff007f]' : 'bg-[#facc15]'}`}
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="font-mono text-xs text-[#111111]/60 mt-2">
                  {isGenerating ? 'Creating your 3D mesh with photogrammetry...' : 'Saving digital identity...'}
                </p>
              </div>
            </div>
          )}
          
          {uploadError && (
            <div className="text-center p-3 border-4 border-[#dc2626] bg-[#fef2f2] shadow-[2px_2px_0_0_#dc2626]">
              <p className="font-mono text-xs font-black text-[#dc2626]">
                ❌ {uploadError}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onPrev}
          className="flex-1 border-4 border-[#111111] bg-white px-6 py-4 font-mono text-sm font-black tracking-[0.14em] text-[#111111] shadow-[4px_4px_0_0_#111111] transition-all duration-75 hover:bg-[#111111] hover:text-white active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
        >
          ← BACK
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!facePhoto || isLoading}
          className="flex-1 border-4 border-[#111111] bg-[#facc15] px-6 py-4 font-mono text-sm font-black tracking-[0.14em] text-[#111111] shadow-[4px_4px_0_0_#111111] transition-all duration-75 hover:bg-[#111111] hover:text-[#facc15] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isLoading ? "SAVING..." : "NEXT → MEASUREMENTS"}
        </button>
      </div>
    </div>
  );
}

function Step3Measurements({ profile, onUpdate, onNext, onPrev, isLoading }: StepProps) {
  const presetParts = (profile.measurements?.size_preset || "").split("-");
  const initialSize = presetParts[0] || "";
  const initialLen = presetParts[1] || "regular";

  const [unit, setUnit] = useState<'imperial' | 'metric'>(profile.measurements?.unit || 'imperial');
  const [sizePreset, setSizePreset] = useState(initialSize);
  const [lengthModifier, setLengthModifier] = useState(initialLen);
  const [customMeasurements, setCustomMeasurements] = useState({
    height: profile.measurements?.height || '',
    chest: profile.measurements?.chest || '',
    waist: profile.measurements?.waist || '',
    hips: profile.measurements?.hips || '',
  });
  const [usePresets, setUsePresets] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const prev = profile.body_profile ?? {};
    const body_profile = usePresets
      ? { ...prev, size_preset: `${sizePreset}-${lengthModifier}`, unit }
      : {
          ...prev,
          height: customMeasurements.height,
          chest: customMeasurements.chest,
          waist: customMeasurements.waist,
          hips: customMeasurements.hips,
          unit,
        };

    const ok = await onUpdate({ body_profile });
    if (ok) onNext();
  };

  const getPlaceholder = (field: string) => {
    if (unit === 'imperial') {
      switch (field) {
        case 'height': return `5'9"`;
        case 'chest': return `36"`;
        case 'waist': return `28"`;
        case 'hips': return `38"`;
        default: return '';
      }
    } else {
      switch (field) {
        case 'height': return '175 CM';
        case 'chest': return '91 CM';
        case 'waist': return '71 CM';
        case 'hips': return '97 CM';
        default: return '';
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="font-mono text-lg font-black tracking-[0.12em] text-[#111111] mb-2">
          STEP 3 // MEASUREMENTS
        </h2>
        <p className="font-mono text-sm text-[#111111]/60">
          Size presets or custom measurements for perfect fit.
        </p>
      </div>

      {/* Unit Toggle */}
      <div className="flex justify-center">
        <div className="border-4 border-[#111111] bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setUnit('imperial')}
            className={`px-4 py-2 font-mono text-sm font-black tracking-[0.1em] transition-colors ${
              unit === 'imperial' 
                ? 'bg-[#facc15] text-[#111111]' 
                : 'bg-white text-[#111111] hover:bg-[#f4f4f0]'
            }`}
          >
            INCHES / LBS
          </button>
          <button
            type="button"
            onClick={() => setUnit('metric')}
            className={`px-4 py-2 font-mono text-sm font-black tracking-[0.1em] transition-colors ${
              unit === 'metric' 
                ? 'bg-[#facc15] text-[#111111]' 
                : 'bg-white text-[#111111] hover:bg-[#f4f4f0]'
            }`}
          >
            CM / KG
          </button>
        </div>
      </div>

      {/* Preset vs Custom Toggle */}
      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => setUsePresets(true)}
          className={`flex-1 border-4 border-[#111111] px-4 py-3 font-mono text-sm font-black tracking-[0.1em] transition-colors ${
            usePresets 
              ? 'bg-[#ff007f] text-white' 
              : 'bg-white text-[#111111] hover:bg-[#f4f4f0]'
          }`}
        >
          SIZE PRESETS
        </button>
        <button
          type="button"
          onClick={() => setUsePresets(false)}
          className={`flex-1 border-4 border-[#111111] px-4 py-3 font-mono text-sm font-black tracking-[0.1em] transition-colors ${
            !usePresets 
              ? 'bg-[#ff007f] text-white' 
              : 'bg-white text-[#111111] hover:bg-[#f4f4f0]'
          }`}
        >
          CUSTOM NUMBERS
        </button>
      </div>

      {usePresets ? (
        <div className="space-y-4">
          <div>
            <label className="block font-mono text-xs font-black uppercase tracking-[0.1em] text-[#111111] mb-2">
              Size
            </label>
            <div className="grid grid-cols-3 gap-2">
              {SIZE_PRESETS.map((size) => (
                <button
                  key={size.value}
                  type="button"
                  onClick={() => setSizePreset(size.value)}
                  className={`border-4 border-[#111111] px-3 py-2 font-mono text-sm font-black transition-colors ${
                    sizePreset === size.value
                      ? 'bg-[#facc15] text-[#111111]'
                      : 'bg-white text-[#111111] hover:bg-[#f4f4f0]'
                  }`}
                >
                  {size.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-mono text-xs font-black uppercase tracking-[0.1em] text-[#111111] mb-2">
              Length
            </label>
            <div className="grid grid-cols-3 gap-2">
              {LENGTH_MODIFIERS.map((modifier) => (
                <button
                  key={modifier.value}
                  type="button"
                  onClick={() => setLengthModifier(modifier.value)}
                  className={`border-4 border-[#111111] px-3 py-2 font-mono text-sm font-black transition-colors ${
                    lengthModifier === modifier.value
                      ? 'bg-[#facc15] text-[#111111]'
                      : 'bg-white text-[#111111] hover:bg-[#f4f4f0]'
                  }`}
                >
                  {modifier.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(customMeasurements).map(([field, value]) => (
            <div key={field}>
              <label className="block font-mono text-xs font-black uppercase tracking-[0.1em] text-[#111111] mb-2">
                {field}
              </label>
              <input
                type="text"
                value={value}
                onChange={(e) => setCustomMeasurements(prev => ({ 
                  ...prev, 
                  [field]: e.target.value 
                }))}
                placeholder={getPlaceholder(field)}
                className="w-full border-4 border-[#111111] bg-white px-3 py-2 font-mono text-sm font-black tracking-[0.08em] text-[#111111] placeholder:text-[#111111]/40 focus:bg-[#facc15] focus:outline-none"
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onPrev}
          className="flex-1 border-4 border-[#111111] bg-white px-6 py-4 font-mono text-sm font-black tracking-[0.14em] text-[#111111] shadow-[4px_4px_0_0_#111111] transition-all duration-75 hover:bg-[#111111] hover:text-white active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
        >
          ← BACK
        </button>
        <button
          type="submit"
          disabled={usePresets ? !sizePreset : !Object.values(customMeasurements).some(v => v.trim()) || isLoading}
          className="flex-1 border-4 border-[#111111] bg-[#facc15] px-6 py-4 font-mono text-sm font-black tracking-[0.14em] text-[#111111] shadow-[4px_4px_0_0_#111111] transition-all duration-75 hover:bg-[#111111] hover:text-[#facc15] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isLoading ? "SAVING..." : "NEXT → 3D FITTING"}
        </button>
      </div>
    </form>
  );
}

function Step4PoseAndFit({ profile, onUpdate, onNext, onPrev, isLoading }: StepProps) {
  const [selectedPose, setSelectedPose] = useState(profile.pose_vibe || '');
  const [poseNotes, setPoseNotes] = useState(profile.pose_notes || '');
  const router = useRouter();

  const goToFittingRoom = async () => {
    if (selectedPose !== profile.pose_vibe || poseNotes !== profile.pose_notes) {
      const ok = await onUpdate({
        pose_vibe: selectedPose,
        pose_notes: poseNotes,
      });
      if (!ok) return;
    }
    router.push("/onboarding/fit");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="font-mono text-lg font-black tracking-[0.12em] text-[#111111] mb-2">
          STEP 4 // POSE & ATTITUDE
        </h2>
        <p className="font-mono text-sm text-[#111111]/60">
          Choose your vibe — this affects both 3D preview and final photos.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {POSE_VIBES.map((pose) => (
          <button
            key={pose.id}
            type="button"
            onClick={() => setSelectedPose(pose.id)}
            className={`border-4 border-[#111111] p-4 text-left transition-all duration-75 ${
              selectedPose === pose.id
                ? 'shadow-[6px_6px_0_0_#111111] scale-[1.02]'
                : 'shadow-[3px_3px_0_0_#111111] hover:shadow-[5px_5px_0_0_#111111] hover:scale-[1.01]'
            }`}
            style={{ 
              backgroundColor: selectedPose === pose.id ? pose.color : 'white',
              color: selectedPose === pose.id 
                ? (pose.id === 'casual' ? '#facc15' : 'white')
                : '#111111'
            }}
          >
            <div className="font-mono text-sm font-black tracking-[0.1em] mb-1">
              {pose.label.toUpperCase()}
            </div>
            <div className="font-mono text-xs opacity-80">
              {pose.description}
            </div>
          </button>
        ))}
      </div>

      {selectedPose && (
        <div>
          <label className="block font-mono text-xs font-black uppercase tracking-[0.1em] text-[#111111] mb-2">
            Pose Notes (Optional)
          </label>
          <textarea
            value={poseNotes}
            onChange={(e) => setPoseNotes(e.target.value)}
            placeholder="E.g., 'Slight head tilt, confident smile'"
            rows={2}
            maxLength={200}
            className="w-full border-4 border-[#111111] bg-white px-4 py-3 font-mono text-sm tracking-[0.08em] text-[#111111] placeholder:text-[#111111]/40 focus:bg-[#facc15] focus:outline-none resize-none"
          />
          <p className="mt-1 font-mono text-xs text-[#111111]/40">
            {poseNotes.length}/200 characters
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onPrev}
          className="flex-1 border-4 border-[#111111] bg-white px-6 py-4 font-mono text-sm font-black tracking-[0.14em] text-[#111111] shadow-[4px_4px_0_0_#111111] transition-all duration-75 hover:bg-[#111111] hover:text-white active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
        >
          ← BACK
        </button>
        <button
          type="button"
          onClick={goToFittingRoom}
          disabled={!selectedPose || isLoading}
          className="flex-1 border-4 border-[#111111] bg-[#facc15] px-6 py-4 font-mono text-sm font-black tracking-[0.14em] text-[#111111] shadow-[4px_4px_0_0_#111111] transition-all duration-75 hover:bg-[#111111] hover:text-[#facc15] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isLoading ? "SAVING..." : "NEXT → 3D FITTING ROOM"}
        </button>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>(1);
  const [profile, setProfile] = useState<UserProfile>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Don’t carry a failed step’s banner into the next screen
  useEffect(() => {
    setError("");
  }, [step]);

  // Load user profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      if (!session) return;

      try {
        const auth = await railsAuthHeader();
        if (!auth.Authorization) {
          // Token not available yet — will retry when session updates
          return;
        }

        const res = await fetch(`${RAILS_URL}/api/v1/me`, {
          headers: { ...auth },
        });

        if (res.ok) {
          const userData = (await res.json()) as Record<string, unknown>;
          setProfile(normalizeMePayload(userData));

          if (userData.onboarding_complete === true) {
            router.push("/studio");
          }
        }
      } catch (error) {
        console.error("Failed to load profile:", error);
      }
    };

    void loadProfile();
  }, [session, router]);

  const updateProfile = async (updates: Partial<UserProfile>): Promise<boolean> => {
    setIsLoading(true);
    setError("");

    try {
      const auth = await railsAuthHeader();
      if (!auth.Authorization) {
        console.warn("No Rails token available - working in offline mode");
        // In offline mode, just update local state and continue
        setProfile(prev => ({
          ...prev,
          ...updates,
        }));
        return true;
      }

      const res = await fetch(`${RAILS_URL}/api/v1/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...auth,
        },
        body: JSON.stringify({ user: updates }),
      });

      if (res.ok) {
        setProfile(prev => {
          const mergedBp = {
            ...(prev.body_profile ?? {}),
            ...((updates.body_profile ?? {}) as Record<string, unknown>),
          };
          return {
            ...prev,
            ...updates,
            body_profile: updates.body_profile ? mergedBp : prev.body_profile,
            measurements: updates.body_profile
              ? measurementsFromBodyProfile(mergedBp)
              : prev.measurements,
          };
        });
        return true;
      }

      const errorMsg = await parseRailsError(res);
      console.warn("Rails API error:", errorMsg);
      setError(`Rails API unavailable - working in offline mode`);
      
      // Still update local state so user can continue
      setProfile(prev => ({
        ...prev,
        ...updates,
      }));
      return true;
    } catch (error) {
      console.warn("Network error - working in offline mode:", error);
      setError("Working in offline mode - Rails server not available");
      
      // Still update local state so user can continue
      setProfile(prev => ({
        ...prev,
        ...updates,
      }));
      return true;
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    if (step < 4) setStep((prev) => (prev + 1) as OnboardingStep);
  };

  const handlePrev = () => {
    if (step > 1) setStep((prev) => (prev - 1) as OnboardingStep);
  };

  if (!session) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <p className="font-mono text-lg text-[#111111]">Please sign in to continue</p>
      </div>
    );
  }

  return (
    <div
      className={
        "flex min-h-0 flex-col bg-punk-halftone " +
        /* Mobile / tablet: page can grow and scroll with the document */
        "min-h-dvh max-lg:min-h-dvh " +
        /* Desktop: lock to one viewport — only inner main scrolls */
        "lg:h-dvh lg:max-h-dvh lg:overflow-hidden"
      }
    >
      <header className="flex-shrink-0 border-b-4 border-[#111111] bg-white px-4 py-3 sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 shrink">
            <RansomHeader text="OOPS ONBOARDING" />
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <div className="font-mono text-xs text-[#111111]/60">
              STEP {step}/4
            </div>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="font-mono text-xs text-[#dc2626] hover:text-[#111111]"
            >
              LOGOUT
            </button>
          </div>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-4 py-4 sm:px-6 sm:py-6">
        <div className="mx-auto w-full max-w-2xl min-w-0 border-4 border-[#111111] bg-white p-4 shadow-[8px_8px_0_0_#111111] sm:p-6">
          {error && (
            <div className="mb-6 border-4 border-[#dc2626] bg-[#dc2626]/10 p-4">
              <p className="font-mono text-sm font-black text-[#dc2626]">
                ERROR: {error}
              </p>
            </div>
          )}

          {step === 1 && (
            <Step1Profile
              profile={profile}
              onUpdate={updateProfile}
              onNext={handleNext}
              onPrev={handlePrev}
              isLoading={isLoading}
            />
          )}

          {step === 2 && (
            <Step2FacePhoto
              profile={profile}
              onUpdate={updateProfile}
              onNext={handleNext}
              onPrev={handlePrev}
              isLoading={isLoading}
            />
          )}

          {step === 3 && (
            <Step3Measurements
              profile={profile}
              onUpdate={updateProfile}
              onNext={handleNext}
              onPrev={handlePrev}
              isLoading={isLoading}
            />
          )}

          {step === 4 && (
            <Step4PoseAndFit
              profile={profile}
              onUpdate={updateProfile}
              onNext={handleNext}
              onPrev={handlePrev}
              isLoading={isLoading}
            />
          )}
        </div>
      </main>
    </div>
  );
}