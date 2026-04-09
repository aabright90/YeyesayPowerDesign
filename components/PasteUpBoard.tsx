"use client";

/*
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  PasteUpBoard — Procedural 3D Female Fashion Mannequin             ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║                                                                    ║
 * ║  CRASH COURSE — KEY CONCEPTS                                       ║
 * ║                                                                    ║
 * ║  THREE.LatheGeometry                                               ║
 * ║    Takes an array of 2D points (radius, height) and revolves       ║
 * ║    them 360° around the Y axis — exactly like a pottery wheel.     ║
 * ║    This produces the smooth, continuous surface of a fashion       ║
 * ║    mannequin from a simple silhouette curve.                       ║
 * ║                                                                    ║
 * ║  CatmullRomCurve3 (Spline Interpolation)                          ║
 * ║    Connects control points with smooth S-shaped curves instead     ║
 * ║    of straight lines. Without it, the mannequin would look         ║
 * ║    faceted and polygonal. With it → silky smooth.                  ║
 * ║                                                                    ║
 * ║  useMemo + Parametric Deformation                                  ║
 * ║    The profile curve's radii (bust, waist, hips) are multiplied   ║
 * ║    by scale factors from the UI sliders. When the user drags       ║
 * ║    "CHEST / BUST" → bustRadius grows → LatheGeometry regenerates  ║
 * ║    → the 3D mesh visibly expands. useMemo ensures this only        ║
 * ║    recomputes when scale values actually change.                   ║
 * ║                                                                    ║
 * ║  MeshPhysicalMaterial                                              ║
 * ║    Three.js's most realistic material. The clearcoat parameter     ║
 * ║    adds a transparent lacquer layer on top of the base colour,     ║
 * ║    simulating the glossy plastic/fiberglass look of a real         ║
 * ║    fashion mannequin.                                              ║
 * ║                                                                    ║
 * ║  OrbitControls                                                     ║
 * ║    Left-drag → orbit, scroll → zoom, right-drag → pan.            ║
 * ║    makeDefault registers it as the primary camera controller.      ║
 * ║                                                                    ║
 * ║  Pointer Events Fix                                                ║
 * ║    The drag-and-drop zones for fabric used to sit on top of the   ║
 * ║    canvas and steal ALL mouse events, killing OrbitControls.       ║
 * ║    Fix: drag handlers live on the wrapper div; drop zones are     ║
 * ║    purely visual overlays with pointer-events-none.                ║
 * ║    DOM drag events and pointer events (used by OrbitControls)      ║
 * ║    are separate browser systems — they don't conflict.             ║
 * ║                                                                    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import * as THREE from "three";

// ─── Public types (unchanged — studio/page.tsx depends on these) ──────────────

export interface FitState {
  widthScale: number;
  hemLength: number;
}

export interface Metrics {
  height: string;
  chest: string;
  waist: string;
  hips: string;
}

interface MaterialItem {
  id: number;
  name: string;
  tag: string;
  photo: string | null;
}

export interface PasteUpBoardProps {
  topFabric: MaterialItem | null;
  bottomFabric: MaterialItem | null;
  phase: string;
  isDragOverTop: boolean;
  isDragOverBottom: boolean;
  metrics?: Metrics;
  unit?: "imperial" | "metric";
  /** URL of the user's uploaded face photo — rendered on the mannequin head. */
  facePhotoUrl?: string;
  /** Average skin tone hex sampled from the face photo (e.g. "#c68a5e"). */
  skinTone?: string;
  onFitChange?: (fit: FitState) => void;
  onDragOverTop: () => void;
  onDragOverBottom: () => void;
  onDragLeave: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onDropTop: (e: React.DragEvent<any>) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onDropBottom: (e: React.DragEvent<any>) => void;
}

// ─── Measurement → body-scale mapping ────────────────────────────────────────
//
// CONCEPT: We convert raw human measurements (e.g. "34 inches chest")
// into scale multipliers relative to a reference dress-form (size 8).
// Scale = 1.0 means "matches the reference exactly."
// Scale = 1.3 means "30% larger than the reference."
// These multipliers drive the LatheGeometry profile radii in real-time.

const CM_PER_INCH = 2.54;
const REF = { heightIn: 68, chestIn: 34, waistIn: 26, hipsIn: 36 };

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function parseHeightIn(s: string, metric: boolean): number | null {
  if (!s.trim()) return null;
  if (metric) {
    const n = parseFloat(s);
    return isNaN(n) ? null : n / CM_PER_INCH;
  }
  const m = s.match(/(\d+)['´\s]+(\d*)/);
  if (m) return parseInt(m[1]) * 12 + (parseInt(m[2]) || 0);
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function parseCircIn(s: string, metric: boolean): number | null {
  const n = parseFloat(s);
  if (!s.trim() || isNaN(n)) return null;
  return metric ? n / CM_PER_INCH : n;
}

interface BodyScales {
  ht: number; // height
  ch: number; // chest
  wa: number; // waist
  hp: number; // hips
}

function computeScales(m?: Metrics, unit = "imperial"): BodyScales {
  if (!m) return { ht: 1, ch: 1, wa: 1, hp: 1 };
  const metric = unit === "metric";
  const h = parseHeightIn(m.height, metric);
  const c = parseCircIn(m.chest, metric);
  const w = parseCircIn(m.waist, metric);
  const hp = parseCircIn(m.hips, metric);
  return {
    ht: h ? clamp(h / REF.heightIn, 0.75, 1.45) : 1,
    ch: c ? clamp(c / REF.chestIn, 0.70, 1.70) : 1,
    wa: w ? clamp(w / REF.waistIn, 0.60, 1.80) : 1,
    hp: hp ? clamp(hp / REF.hipsIn, 0.70, 1.70) : 1,
  };
}

// ─── Spline interpolation helper ─────────────────────────────────────────────
//
// CONCEPT: CatmullRomCurve3 is a type of spline that passes through every
// control point (unlike Bezier, which uses handles that the curve doesn't touch).
// We give it ~12 key body measurements and it generates 64+ smooth intermediate
// points, eliminating the faceted look of straight-line interpolation.
//
// The tension parameter (0.5) controls how tightly the curve hugs each point.
// 0 = loose/wavy, 1 = tight/angular. 0.5 is a balanced default.
//
// We clamp radius to 0 because CatmullRom can overshoot past zero in sharp
// transitions (e.g. the crown of the head), which would invert the surface.

function smoothProfile(
  keys: [number, number][],
  samples = 64,
): THREE.Vector2[] {
  if (keys.length < 3) {
    return keys.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y));
  }
  const curve = new THREE.CatmullRomCurve3(
    keys.map(([r, y]) => new THREE.Vector3(r, y, 0)),
    false,
    "catmullrom",
    0.5,
  );
  return curve
    .getPoints(samples)
    .map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));
}

// ─── Body proportions ────────────────────────────────────────────────────────
//
// Y positions define the vertical layout of the mannequin in world space.
// The figure is centred at y=0 (roughly at the hips).
//
// Base radii represent a size-8 dress form at scale = 1.0.
// When the user adjusts the "CHEST / BUST" slider, scales.ch multiplies
// BASE.bust, physically widening the torso geometry.

const CROWN_Y   = 1.54;
const SHOULDER_Y = 0.98;
const WAIST_Y    = 0.35;
const CROTCH_Y   = -0.12;
const FEET_Y     = -1.50;

const UPPER_H = CROWN_Y - WAIST_Y; // waist → crown (now 1.19)
const LOWER_H = WAIST_Y - CROTCH_Y; // crotch → waist
const LEG_H   = CROTCH_Y - FEET_Y;  // crotch → feet
const ARM_H   = 1.05;
const LEG_SPREAD = 0.088;
const ARM_X   = 0.20;
const ARM_ANGLE  = 0.07;

// Neck radius — used by torso profile and neck cylinder
const NECK_R = 0.040;

// Head sphere radius and its world-Y centre (above the neck)
const HEAD_R  = 0.096;
// Neck-top sits at ~ SHOULDER_Y + 0.22; head centre is one HEAD_R above that
const HEAD_Y  = SHOULDER_Y + 0.22 + HEAD_R * 0.95;   // ≈ 1.29

const BASE = {
  bust:      0.160,   // slightly fuller than dress-form
  waist:     0.118,   // less extreme pinch
  hip:       0.182,
  shoulder:  0.182,
  thighTop:  0.092,
  knee:      0.058,
  calf:      0.050,
  ankle:     0.034,
  upperArm:  0.044,
  elbow:     0.034,
  wrist:     0.025,
};

// ─── Profile curve builders ──────────────────────────────────────────────────
//
// Each function returns an array of [radius, localY] control points that
// define the 2D silhouette for a body section. These are passed through
// smoothProfile() and then into LatheGeometry to produce the 3D mesh.
//
// CONCEPT: LatheGeometry revolves the 2D profile around the Y axis.
// The points must have monotonically increasing Y values (bottom to top).
// x = radius at that height, y = height.

// Upper torso stops at the NECK — the head is built separately.
// This prevents the old "head bump baked into the lathe" problem where
// facial features were hidden inside the geometry.
function upperTorsoProfile(bustR: number, waistR: number): THREE.Vector2[] {
  return smoothProfile([
    [waistR,            0],
    [waistR * 1.06,     UPPER_H * 0.07],
    [bustR * 0.84,      UPPER_H * 0.17],
    [bustR,             UPPER_H * 0.27],          // bust peak
    [bustR * 0.76,      UPPER_H * 0.38],
    [BASE.shoulder,     UPPER_H * 0.49],           // shoulder peak
    [BASE.shoulder * 0.85, UPPER_H * 0.55],
    [0.056,             UPPER_H * 0.61],           // clavicle / upper chest
    [NECK_R + 0.010,    UPPER_H * 0.67],           // neck base
    [NECK_R,            UPPER_H * 0.73],           // neck — profile stops here
  ]);
}

function lowerTorsoProfile(hipR: number, waistR: number): THREE.Vector2[] {
  return smoothProfile([
    [0, 0],
    [hipR * 0.32, LOWER_H * 0.08],
    [hipR * 0.88, LOWER_H * 0.28],
    [hipR, LOWER_H * 0.48],
    [hipR * 0.96, LOWER_H * 0.65],
    [waistR * 1.08, LOWER_H * 0.85],
    [waistR, LOWER_H],
  ]);
}

// Leg starts with a small foot radius so the figure doesn't taper to a pin-point.
function legProfile(hipScale: number): THREE.Vector2[] {
  const th = BASE.thighTop * hipScale;
  return smoothProfile([
    [BASE.ankle * 0.55, 0],             // ball of foot (not 0 — gives a foot)
    [BASE.ankle * 0.80, LEG_H * 0.02],
    [BASE.ankle,        LEG_H * 0.05],  // ankle
    [BASE.calf * 0.70,  LEG_H * 0.12],
    [BASE.calf,         LEG_H * 0.20],
    [BASE.knee * 0.92,  LEG_H * 0.33],
    [BASE.knee,         LEG_H * 0.42],
    [BASE.knee * 1.06,  LEG_H * 0.48],
    [th * 0.78,         LEG_H * 0.60],
    [th * 0.93,         LEG_H * 0.74],
    [th,                LEG_H * 0.89],
    [th * 0.92,         LEG_H * 0.96],
    [th * 0.55,         LEG_H],
  ]);
}

function armProfile(chestScale: number): THREE.Vector2[] {
  const ua = BASE.upperArm * (1 + (chestScale - 1) * 0.25);
  return smoothProfile(
    [
      [0, 0],
      [BASE.wrist * 0.6, ARM_H * 0.03],
      [BASE.wrist, ARM_H * 0.06],
      [BASE.elbow * 0.85, ARM_H * 0.25],
      [BASE.elbow, ARM_H * 0.44],
      [BASE.elbow * 1.05, ARM_H * 0.50],
      [ua * 0.90, ARM_H * 0.65],
      [ua, ARM_H * 0.82],
      [ua * 1.08, ARM_H * 0.94],
      [ua * 0.65, ARM_H],
    ],
    48,
  );
}

// ─── Skin / hair / feature materials ─────────────────────────────────────────
//
// Replaced the old ivory-plastic dress-form materials with realistic skin.
// Key differences:
//   • Warm medium skin tone (#c8856a) instead of off-white (#f0ede8)
//   • No clearcoat  — clearcoat created a fiberglass-mannequin sheen
//   • Higher roughness (0.75) — skin scatters light softly, not specularlly
//   • MeshStandardMaterial is lighter than Physical and renders more naturally
//     at these roughness values

const DEFAULT_SKIN = "#c8856a";

const MAT_BODY = new THREE.MeshStandardMaterial({
  color: DEFAULT_SKIN,
  roughness: 0.75,
  metalness: 0,
});

const MAT_JOINT = new THREE.MeshStandardMaterial({
  color: "#b87860",
  roughness: 0.80,
  metalness: 0,
});

// Hair — dark brown, near-matte (real hair has high roughness, minimal metalness)
const MAT_HAIR = new THREE.MeshStandardMaterial({
  color: "#2c1a0e",
  roughness: 0.92,
  metalness: 0,
});

// Eyes — very dark, slight specular gloss (iris/pupil approximation)
const MAT_EYE = new THREE.MeshStandardMaterial({
  color: "#0d0a08",
  roughness: 0.25,
  metalness: 0.05,
});

// Sclera (white of eye)
const MAT_SCLERA = new THREE.MeshStandardMaterial({
  color: "#f5f0eb",
  roughness: 0.7,
  metalness: 0,
});

// Lip — slightly darker/pinker than skin
const MAT_LIP = new THREE.MeshStandardMaterial({
  color: "#a8544a",
  roughness: 0.65,
  metalness: 0,
});

// ─── Fabric-textured mesh component ──────────────────────────────────────────
//
// CONCEPT: useTexture (from @react-three/drei) loads an image and returns
// a THREE.Texture. We then set:
//   wrapS / wrapT = RepeatWrapping → pattern tiles instead of stretching
//   repeat.set(2, 2) → the pattern repeats 2× in each direction
//
// This makes the fabric wrap realistically around the body and automatically
// deforms as the morph targets (slider values) change the body shape.
//
// useTexture suspends (React Suspense) until the image loads, so we wrap
// all FabricMesh usage in <Suspense fallback={plain mesh}>.

type V3 = [number, number, number];

function FabricMesh({
  geo,
  photo,
  position,
  rotation,
}: {
  geo: THREE.BufferGeometry;
  photo: string;
  position?: V3;
  rotation?: V3;
}) {
  const tex = useTexture(photo);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);

  return (
    <mesh geometry={geo} position={position} rotation={rotation}>
      <meshPhysicalMaterial
        map={tex}
        roughness={0.55}
        clearcoat={0.15}
        clearcoatRoughness={0.45}
      />
    </mesh>
  );
}

// Smart body-part renderer: plain material or fabric-wrapped
function BodyPart({
  geo,
  photo,
  position,
  rotation,
}: {
  geo: THREE.BufferGeometry;
  photo?: string;
  position?: V3;
  rotation?: V3;
}) {
  const plain = (
    <mesh
      geometry={geo}
      material={MAT_BODY}
      position={position}
      rotation={rotation}
    />
  );
  if (!photo) return plain;
  return (
    <Suspense fallback={plain}>
      <FabricMesh
        geo={geo}
        photo={photo}
        position={position}
        rotation={rotation}
      />
    </Suspense>
  );
}

// ─── Procedural head features ────────────────────────────────────────────────
//
// Renders a semi-realistic head: base sphere + hair cap + eyes + lips.
// When a face photo URL is available, an equirectangular texture is also
// applied to the front-facing hemisphere (Stage 1 preview; not photogrammetry).

/** Hair cap — top hemisphere, slightly larger than the skull */
function HairCap({ headY, skinColor }: { headY: number; skinColor: string }) {
  // Top-half sphere (thetaLength = PI/2 gives upper hemisphere)
  const geo = useMemo(
    () => new THREE.SphereGeometry(HEAD_R + 0.013, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.54),
    [],
  );
  // Hairline on forehead — a thin ellipsoid cap to hide seam
  const lineGeo = useMemo(
    () => new THREE.TorusGeometry(HEAD_R * 0.72, 0.006, 8, 32),
    [],
  );
  void skinColor; // used by parent to tint ears; kept in signature for future
  return (
    <group position={[0, headY + 0.006, 0]}>
      <mesh geometry={geo} material={MAT_HAIR} />
      {/* Hairline ring sits just above mid-sphere */}
      <mesh
        geometry={lineGeo}
        material={MAT_HAIR}
        position={[0, -0.024, 0.018]}
        rotation={[Math.PI / 2 - 0.25, 0, 0]}
      />
    </group>
  );
}

/** Paired eyes: sclera + iris/pupil discs */
function Eyes({ headY }: { headY: number }) {
  const scleraGeo = useMemo(() => new THREE.SphereGeometry(0.014, 16, 10), []);
  const irisGeo   = useMemo(() => new THREE.CircleGeometry(0.009, 16), []);
  const z = HEAD_R * 0.86;
  const y = headY + 0.013;
  const x = 0.028;
  return (
    <>
      {/* Left eye */}
      <mesh geometry={scleraGeo} material={MAT_SCLERA} position={[-x, y, z]} />
      <mesh geometry={irisGeo}   material={MAT_EYE}    position={[-x, y, z + 0.013]} />
      {/* Right eye */}
      <mesh geometry={scleraGeo} material={MAT_SCLERA} position={[x, y, z]} />
      <mesh geometry={irisGeo}   material={MAT_EYE}    position={[x, y, z + 0.013]} />
    </>
  );
}

/** Lips — two thin torus segments, upper and lower */
function Lips({ headY }: { headY: number }) {
  const upperGeo = useMemo(
    () => new THREE.TorusGeometry(0.022, 0.005, 6, 20, Math.PI),
    [],
  );
  const lowerGeo = useMemo(
    () => new THREE.TorusGeometry(0.022, 0.006, 6, 20, Math.PI),
    [],
  );
  const z = HEAD_R * 0.90;
  const y = headY - 0.028;
  return (
    <group position={[0, y, z]} rotation={[0, 0, 0]}>
      {/* Upper lip */}
      <mesh geometry={upperGeo} material={MAT_LIP} position={[0, 0.006, 0]} rotation={[Math.PI / 2, 0, 0]} />
      {/* Lower lip */}
      <mesh geometry={lowerGeo} material={MAT_LIP} position={[0, -0.005, 0]} rotation={[-Math.PI / 2, 0, Math.PI]} />
    </group>
  );
}

/** Nose — a small elongated sphere bridge */
function Nose({ headY }: { headY: number }) {
  const geo = useMemo(
    () => new THREE.SphereGeometry(0.013, 12, 8),
    [],
  );
  return (
    <mesh
      geometry={geo}
      material={MAT_BODY}
      position={[0, headY - 0.006, HEAD_R * 0.95]}
      scale={[0.6, 1, 0.7]}
    />
  );
}

/** Base head sphere with all features assembled */
function HeadAssembly({
  headY,
  skinMat,
  facePhotoUrl,
}: {
  headY: number;
  skinMat: THREE.MeshStandardMaterial;
  facePhotoUrl?: string;
}) {
  return (
    <group>
      {/* Base skull sphere */}
      <mesh position={[0, headY, 0]} material={skinMat}>
        <sphereGeometry args={[HEAD_R, 32, 24]} />
      </mesh>

      {/* Face photo overlay */}
      {facePhotoUrl && (
        <Suspense fallback={null}>
          <FacePhotoLayer headY={headY} photo={facePhotoUrl} />
        </Suspense>
      )}

      {/* Hair */}
      <HairCap headY={headY} skinColor={skinMat.color.getHexString()} />

      {/* Facial features */}
      <Eyes headY={headY} />
      <Nose headY={headY} />
      <Lips headY={headY} />
    </group>
  );
}

/** Face photo mapped onto the front hemisphere — Stage 1 preview */
function FacePhotoLayer({ headY, photo }: { headY: number; photo: string }) {
  const tex = useTexture(photo);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  // Show a 50%-wide strip centred at u=0.5 (front of Three.js sphere is u≈0.75
  // after rotating the group 90° around Y, so the face faces the camera).
  tex.offset.set(0.25, 0.05);
  tex.repeat.set(0.5, 0.85);

  return (
    // Rotate 90° around Y so sphere u=0.5 (front) aligns with +Z (camera view)
    <group position={[0, headY, 0]} rotation={[0, -Math.PI / 2, 0]}>
      <mesh>
        <sphereGeometry args={[HEAD_R + 0.002, 32, 24]} />
        <meshStandardMaterial
          map={tex}
          roughness={0.6}
          transparent
          opacity={0.92}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// ─── Breast geometry ─────────────────────────────────────────────────────────
//
// Two scaled spheres placed in front of the upper torso at bust-line height.
// They sit slightly forward (z+) of the torso surface so they protrude naturally.
// Hidden by the fabric texture when a top is assigned.

function BreastMesh({
  bustR,
  mat,
}: {
  bustR: number;
  mat: THREE.MeshStandardMaterial;
}) {
  const geo = useMemo(() => new THREE.SphereGeometry(0.052, 24, 16), []);
  const x = bustR * 0.44;
  const y = WAIST_Y + UPPER_H * 0.28;  // bust-line height
  const z = bustR * 0.20;              // protrude in front of torso surface
  return (
    <>
      <mesh geometry={geo} material={mat} scale={[1, 0.86, 0.70]} position={[-x, y, z]} />
      <mesh geometry={geo} material={mat} scale={[1, 0.86, 0.70]} position={[ x, y, z]} />
    </>
  );
}

// ─── Conservative underwear layer ────────────────────────────────────────────
//
// Shown when no top or bottom fabric is assigned.  Two simple banded meshes
// at bust and hip level give a professional, non-revealing default state.
// They disappear as soon as the corresponding fabric zone is filled.

const MAT_UNDERWEAR = new THREE.MeshStandardMaterial({
  color: "#f0e8dc",
  roughness: 0.8,
  metalness: 0,
  side: THREE.FrontSide,
});

function BraBand({ bustR }: { bustR: number }) {
  const geo = useMemo(
    () => new THREE.CylinderGeometry(bustR + 0.004, bustR + 0.004, 0.055, 64, 1, true),
    [bustR],
  );
  return (
    <mesh
      geometry={geo}
      material={MAT_UNDERWEAR}
      position={[0, WAIST_Y + UPPER_H * 0.29, 0]}
    />
  );
}

function BriefBand({ hipR, waistR }: { hipR: number; waistR: number }) {
  const geo = useMemo(
    () =>
      new THREE.CylinderGeometry(
        waistR + 0.005,
        hipR + 0.005,
        LOWER_H * 0.48,
        64,
        1,
        true,
      ),
    [hipR, waistR],
  );
  return (
    <mesh
      geometry={geo}
      material={MAT_UNDERWEAR}
      position={[0, CROTCH_Y + (LOWER_H * 0.48) / 2, 0]}
    />
  );
}

// ─── Procedural Mannequin ────────────────────────────────────────────────────
//
// CONCEPT: Every useMemo below takes measurement-derived radii as
// dependencies. When the user moves a slider:
//   slider → scales.ch changes → bustR changes →
//   useMemo detects new dependency value → recomputes profile →
//   new LatheGeometry is created → React reconciles the <mesh> →
//   GPU renders the new shape → user sees the body expand/contract
//
// This entire chain runs synchronously in a single animation frame,
// giving smooth, real-time parametric feedback.

function ProceduralMannequin({
  scales,
  topPhoto,
  bottomPhoto,
  facePhotoUrl,
  skinTone,
}: {
  scales: BodyScales;
  topPhoto?: string;
  bottomPhoto?: string;
  facePhotoUrl?: string;
  skinTone?: string;
}) {
  const bustR = BASE.bust * scales.ch;
  const waistR = BASE.waist * scales.wa;
  const hipR = BASE.hip * scales.hp;

  // Build the dynamic skin material.
  // When the user uploads a face, we sample the average colour and pass it in
  // as skinTone so the body reads as the same skin as the face.
  // Default is a warm medium skin tone (not the old ivory dress-form colour).
  const bodyColor = skinTone ?? DEFAULT_SKIN;
  const matBody = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: bodyColor,
        roughness: 0.75,
        metalness: 0,
      }),
    [bodyColor],
  );

  // Upper torso: waist → crown of head
  const upperGeo = useMemo(() => {
    const pts = upperTorsoProfile(bustR, waistR);
    return new THREE.LatheGeometry(pts, 64);
  }, [bustR, waistR]);

  // Lower torso: crotch → waist
  const lowerGeo = useMemo(() => {
    const pts = lowerTorsoProfile(hipR, waistR);
    return new THREE.LatheGeometry(pts, 64);
  }, [hipR, waistR]);

  // Single leg (used twice, mirrored)
  const legGeo = useMemo(() => {
    const pts = legProfile(scales.hp);
    return new THREE.LatheGeometry(pts, 48);
  }, [scales.hp]);

  // Single arm (used twice, mirrored)
  const armGeo = useMemo(() => {
    const pts = armProfile(scales.ch);
    return new THREE.LatheGeometry(pts, 32);
  }, [scales.ch]);

  // Shoulder joint spheres (bridge arm↔torso gap)
  const shoulderGeo = useMemo(
    () => new THREE.SphereGeometry(0.052, 16, 16),
    [],
  );

  // Waist seam ring (marks top/bottom fabric split)
  const seamGeo = useMemo(
    () => new THREE.TorusGeometry(waistR + 0.005, 0.004, 8, 64),
    [waistR],
  );

  // Neck cylinder — bridges torso-top (WAIST_Y + UPPER_H*0.73) to head sphere bottom
  const neckGeo = useMemo(() => {
    const neckTopWorldY  = WAIST_Y + UPPER_H * 0.73;
    const headBottomY    = HEAD_Y - HEAD_R * 0.80;
    const h = Math.max(0.01, headBottomY - neckTopWorldY);
    // Slightly tapered: wider at base, narrower at head
    return new THREE.CylinderGeometry(NECK_R * 0.88, NECK_R, h, 24, 1);
  }, []);

  // Glass stand base
  const standGeo = useMemo(() => new THREE.CircleGeometry(0.28, 32), []);

  const hasFabric = !!(topPhoto || bottomPhoto);

  return (
    <group scale={[1, scales.ht, 1]}>
      {/* ── UPPER BODY (top fabric zone) ── */}
      <BodyPart geo={upperGeo} photo={topPhoto} position={[0, WAIST_Y, 0]} />

      {/* ── LOWER BODY (bottom fabric zone) ── */}
      <BodyPart
        geo={lowerGeo}
        photo={bottomPhoto}
        position={[0, CROTCH_Y, 0]}
      />

      {/* ── LEGS — positioned at feet, geometry grows upward to crotch ── */}
      <BodyPart
        geo={legGeo}
        photo={bottomPhoto}
        position={[-LEG_SPREAD, FEET_Y, 0]}
      />
      <BodyPart
        geo={legGeo}
        photo={bottomPhoto}
        position={[LEG_SPREAD, FEET_Y, 0]}
      />

      {/* ── ARMS — shoulder pivot with slight outward angle ── */}
      <group
        position={[-ARM_X, SHOULDER_Y, 0]}
        rotation={[0, 0, ARM_ANGLE]}
      >
        <BodyPart
          geo={armGeo}
          photo={topPhoto}
          position={[0, -ARM_H, 0]}
        />
      </group>
      <group
        position={[ARM_X, SHOULDER_Y, 0]}
        rotation={[0, 0, -ARM_ANGLE]}
      >
        <BodyPart
          geo={armGeo}
          photo={topPhoto}
          position={[0, -ARM_H, 0]}
        />
      </group>

      {/* ── SHOULDER JOINTS — cover the arm↔torso seam ── */}
      <mesh
        geometry={shoulderGeo}
        material={topPhoto ? matBody : MAT_JOINT}
        position={[-ARM_X + 0.01, SHOULDER_Y, 0]}
      />
      <mesh
        geometry={shoulderGeo}
        material={topPhoto ? matBody : MAT_JOINT}
        position={[ARM_X - 0.01, SHOULDER_Y, 0]}
      />

      {/* ── NECK — tapered cylinder connecting torso to head ── */}
      <mesh
        geometry={neckGeo}
        material={matBody}
        position={[0, (WAIST_Y + UPPER_H * 0.73 + HEAD_Y - HEAD_R * 0.80) / 2, 0]}
      />

      {/* ── BREAST GEOMETRY — visible when no top fabric ── */}
      {!topPhoto && <BreastMesh bustR={bustR} mat={matBody} />}

      {/* ── HEAD — base sphere + hair + eyes + nose + lips + optional face photo ── */}
      <HeadAssembly headY={HEAD_Y} skinMat={matBody} facePhotoUrl={facePhotoUrl} />

      {/* ── CONSERVATIVE UNDERWEAR — shown when no fabric assigned ── */}
      {!topPhoto && <BraBand bustR={bustR} />}
      {!bottomPhoto && <BriefBand hipR={hipR} waistR={waistR} />}

      {/* ── WAIST SEAM (pink ring at the fabric split line) ── */}
      {hasFabric && (
        <mesh
          geometry={seamGeo}
          position={[0, WAIST_Y, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <meshBasicMaterial color="#ff007f" />
        </mesh>
      )}

      {/* ── GLASS STAND ── */}
      <mesh
        geometry={standGeo}
        position={[0, FEET_Y - 0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <meshPhysicalMaterial
          color="#d0d8e0"
          transparent
          opacity={0.3}
          roughness={0.1}
          metalness={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

// ─── Full 3D Scene ───────────────────────────────────────────────────────────
//
// CONCEPT: The scene graph is a tree of objects. At the top we have:
//   • Lights (ambient + directional + fill) — illuminate the mannequin
//   • OrbitControls — camera interaction
//   • ProceduralMannequin — the parametric body
//
// makeDefault on OrbitControls tells R3F "this is THE camera controller"
// so other drei helpers can reference the active camera if needed.
//
// minPolarAngle / maxPolarAngle limit vertical orbit range to prevent
// the camera from going under the floor or above straight up.

function MannequinScene({
  topFabric,
  bottomFabric,
  scales,
  facePhotoUrl,
  skinTone,
}: {
  topFabric: MaterialItem | null;
  bottomFabric: MaterialItem | null;
  scales: BodyScales;
  facePhotoUrl?: string;
  skinTone?: string;
}) {
  return (
    <>
      {/* Ambient — warm base fill so shadows are not cold/grey */}
      <ambientLight intensity={0.55} color="#ffe8d8" />
      {/* Key light — slightly warm, raised and to the side (3-point setup) */}
      <directionalLight position={[2, 6, 5]} intensity={1.4} color="#fff5ee" />
      {/* Fill light — cool-blue from opposite side, keeps shadows from going black */}
      <directionalLight position={[-4, 2, -2]} intensity={0.35} color="#c8d8ff" />
      {/* Bounce light from below — simulates floor bounce, warms the chin/jaw area */}
      <pointLight position={[0, -1.5, 2]} intensity={0.25} color="#ffd4a8" />
      {/* Rim light — behind and slightly above for edge definition */}
      <pointLight position={[0, 3, -4]} intensity={0.28} color="#dde8ff" />

      <OrbitControls
        makeDefault
        enablePan
        enableZoom
        enableRotate
        minPolarAngle={0.1}
        maxPolarAngle={Math.PI / 1.4}
        minDistance={2.0}
        maxDistance={10}
        enableDamping
        dampingFactor={0.08}
        touches={{
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_PAN,
        }}
      />

      <ProceduralMannequin
        scales={scales}
        topPhoto={topFabric?.photo ?? undefined}
        bottomPhoto={bottomFabric?.photo ?? undefined}
        facePhotoUrl={facePhotoUrl}
        skinTone={skinTone}
      />
    </>
  );
}

// ─── PasteUpBoard (exported default) ─────────────────────────────────────────
//
// CONCEPT: Pointer Events Fix
//
// Previous bug: two HTML <div> drop zones sat at z-index 10 over the entire
// Canvas, intercepting every mousedown/mousemove/mouseup before R3F could
// process them → OrbitControls was completely dead.
//
// Fix: We move all drag event handlers (onDragOver, onDragLeave, onDrop)
// to the WRAPPER div. We determine which zone (top vs bottom) by checking
// the cursor's Y position relative to the container height.
//
// The visual zone highlights remain as pointer-events-none overlays — they
// show the yellow/pink feedback but let all mouse events pass straight
// through to the Canvas underneath.
//
// Why this works: DOM "drag" events (dragover, drop) and "pointer" events
// (pointerdown, pointermove — used by OrbitControls) are completely separate
// browser event systems. A div with onDragOver does NOT block pointer events.
// OrbitControls keeps working normally during non-drag interactions, and the
// drag handlers only fire when the user is dragging a file or catalog card.

export default function PasteUpBoard({
  topFabric,
  bottomFabric,
  phase,
  isDragOverTop,
  isDragOverBottom,
  metrics,
  unit = "imperial",
  facePhotoUrl,
  skinTone,
  onDragOverTop,
  onDragOverBottom,
  onDragLeave,
  onDropTop,
  onDropBottom,
}: PasteUpBoardProps) {
  const scales = useMemo(() => computeScales(metrics, unit), [metrics, unit]);
  const hasFabric = !!(topFabric || bottomFabric);
  const hasMetrics =
    metrics && (metrics.chest || metrics.waist || metrics.hips || metrics.height);

  // Zone detection: top 52% = top zone, bottom 48% = bottom zone
  const getZone = (e: React.DragEvent<HTMLDivElement>): "top" | "bottom" => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relY = (e.clientY - rect.top) / rect.height;
    return relY < 0.52 ? "top" : "bottom";
  };

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      // Drag handlers on the wrapper — zone determined by cursor Y position
      onDragOver={(e) => {
        e.preventDefault();
        const zone = getZone(e);
        if (zone === "top") {
          onDragOverTop();
        } else {
          onDragOverBottom();
        }
      }}
      onDragLeave={() => onDragLeave()}
      onDrop={(e) => {
        e.preventDefault();
        const zone = getZone(e);
        if (zone === "top") {
          onDropTop(e);
        } else {
          onDropBottom(e);
        }
      }}
    >
      {/* ── 3D Canvas ──
          touch-action: none → prevents the browser from hijacking touch
          gestures (scroll, pinch-zoom) so OrbitControls can use them for
          orbit, zoom, and pan on phones/tablets.

          fov 50 on desktop, but portrait-mode phones need a wider fov
          to fit the full mannequin in a narrow viewport — handled by the
          camera's aspect ratio auto-adjustment via R3F's resize observer.
      */}
      <Canvas
        camera={{ position: [0, 0.2, 4.2], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 1.5]}
        style={{
          width: '100%',
          height: '100%',
          position: "absolute",
          inset: 0,
          background: "linear-gradient(160deg, #f8f7f4 0%, #eeede9 100%)",
          touchAction: "none",
        }}
      >
        <MannequinScene
          topFabric={topFabric}
          bottomFabric={bottomFabric}
          scales={scales}
          facePhotoUrl={facePhotoUrl}
          skinTone={skinTone}
        />
      </Canvas>

      {/* Cutting-mat grid (decorative) — pointer-events-none */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, #e5e7eb 1px, transparent 1px), " +
            "linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          opacity: 0.12,
        }}
      />

      {/* Watermark */}
      <p
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 flex select-none items-center justify-center font-mono text-2xl font-black tracking-[0.25em] text-[#111111]/[0.04]"
      >
        {hasFabric ? "3D // LOADED" : "[ AWAITING TEXTILE ]"}
      </p>

      {/* ── TOP DROP ZONE — visual highlight only, pointer-events-none ── */}
      <div
        className={`pointer-events-none absolute left-0 right-0 top-0 z-10 transition-colors duration-100 ${
          isDragOverTop
            ? "bg-[#facc15]/25 ring-2 ring-inset ring-[#facc15]"
            : "bg-transparent"
        }`}
        style={{ height: "52%" }}
      >
        {!topFabric && (
          <div
            className={`flex h-full flex-col items-center justify-center transition-opacity ${isDragOverTop ? "opacity-100" : "opacity-50"}`}
          >
            <span
              className={`font-mono text-xs sm:text-[0.6rem] font-black tracking-[0.15em] ${isDragOverTop ? "text-[#facc15]" : "text-[#111111]/20"}`}
            >
              {isDragOverTop ? "↓ DROP TOP FABRIC" : "TOP ZONE"}
            </span>
          </div>
        )}
      </div>

      {/* ── BOTTOM DROP ZONE — visual highlight only, pointer-events-none ── */}
      <div
        className={`pointer-events-none absolute bottom-0 left-0 right-0 z-10 transition-colors duration-100 ${
          isDragOverBottom
            ? "bg-[#ff007f]/20 ring-2 ring-inset ring-[#ff007f]"
            : "bg-transparent"
        }`}
        style={{ top: "52%" }}
      >
        {!bottomFabric && (
          <div
            className={`flex h-full flex-col items-center justify-center transition-opacity ${isDragOverBottom ? "opacity-100" : "opacity-50"}`}
          >
            <span
              className={`font-mono text-xs sm:text-[0.6rem] font-black tracking-[0.15em] ${isDragOverBottom ? "text-[#ff007f]" : "text-[#111111]/20"}`}
            >
              {isDragOverBottom ? "↑ DROP BOTTOM FABRIC" : "BOTTOM ZONE"}
            </span>
          </div>
        )}
      </div>

      {/* Zone labels once fabric loaded */}
      {hasFabric && (
        <div className="pointer-events-none absolute bottom-3 left-0 right-0 z-20 flex justify-center gap-4 sm:bottom-3">
          {topFabric && (
            <div className="flex flex-col items-center gap-0.5">
              <span className="bg-[#facc15] px-2 py-0.5 font-mono text-xs sm:text-[0.5rem] font-black tracking-[0.12em] text-[#111111]">
                ↑ TOP
              </span>
              <span className="font-mono text-[0.6rem] sm:text-[0.5rem] text-[#111111]/50">
                {topFabric.name.split(" ").slice(0, 3).join(" ")}
              </span>
            </div>
          )}
          {bottomFabric && (
            <div className="flex flex-col items-center gap-0.5">
              <span className="bg-[#ff007f] px-2 py-0.5 font-mono text-xs sm:text-[0.5rem] font-black tracking-[0.12em] text-white">
                ↓ BTM
              </span>
              <span className="font-mono text-[0.6rem] sm:text-[0.5rem] text-[#111111]/50">
                {bottomFabric.name.split(" ").slice(0, 3).join(" ")}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Metrics badge — hidden on very small screens to reduce clutter */}
      {hasMetrics && (
        <div className="pointer-events-none absolute left-3 top-3 z-20 hidden flex-col gap-[2px] sm:flex">
          <p className="font-mono text-[0.5rem] font-black tracking-[0.12em] text-[#111111]/30">
            PARAMETRIC MODEL
          </p>
          {metrics?.height && (
            <p className="font-mono text-[0.5rem] font-black tracking-[0.08em] text-[#111111]/50">
              HT {metrics.height}
            </p>
          )}
          {metrics?.chest && (
            <p className="font-mono text-[0.5rem] font-black tracking-[0.08em] text-[#facc15]">
              CH {metrics.chest}
            </p>
          )}
          {metrics?.waist && (
            <p className="font-mono text-[0.5rem] font-black tracking-[0.08em] text-[#ff007f]">
              WA {metrics.waist}
            </p>
          )}
          {metrics?.hips && (
            <p className="font-mono text-[0.5rem] font-black tracking-[0.08em] text-[#111111]/50">
              HP {metrics.hips}
            </p>
          )}
        </div>
      )}

      {/* Orbit hint — adapts wording for touch vs mouse */}
      <p className="pointer-events-none absolute bottom-3 right-3 z-20 font-mono text-xs sm:text-[0.4rem] font-black tracking-[0.1em] text-[#111111]/20">
        <span className="hidden sm:inline">DRAG TO ORBIT · SCROLL TO ZOOM · RIGHT-DRAG TO PAN</span>
        <span className="sm:hidden">TOUCH TO ORBIT · PINCH TO ZOOM</span>
      </p>

      {/* Parsing overlay */}
      {phase === "parsing" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#f4f4f0]/80 backdrop-blur-[2px]">
          <div className="border-4 border-[#111111] bg-white px-6 py-5 shadow-[6px_6px_0_0_#111111]">
            <p className="font-mono text-xs font-black tracking-[0.18em] text-[#111111]">
              FEEDING THE ENGINE...
            </p>
            <div className="mt-3 h-1 w-full overflow-hidden bg-[#111111]/10">
              <div className="h-full w-1/3 animate-[ping_1.2s_ease-in-out_infinite] bg-[#facc15]" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
