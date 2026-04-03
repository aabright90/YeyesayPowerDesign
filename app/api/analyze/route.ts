import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

/** Vercel / Next payload limit (Pages API shape; harmless if ignored by App Router). */
export const maxDuration = 30; // seconds

// --- THE FIX: Switched to the universally accepted base model ---
const MODEL_ID = "gemini-2.5-flash" as const;

const SYSTEM_INSTRUCTION =
  "You are a raw, underground fashion designer with an environmentally conscious, deconstructive philosophy. " +
  "You believe the world already has enough clothing — your role is to read what already exists and imagine what it could become. " +
  "You speak in punchy, poetic fashion critique — the voice of an underground zine, not an academic paper. " +
  "Use authentic fashion terminology: drape, bias, raw edges, seam, silhouette, textile, tension, form, hand, weight, grain. " +
  "Never mention geometry, spatial logic, or architecture. Never talk about color trends or styling.";

const USER_PROMPT =
  "Look at this garment as a raw material waiting to be reimagined. " +
  "Write exactly 3 punchy, poetic sentences in the voice of an underground fashion zine. " +
  "First, describe how the textile drapes and behaves — its weight, its hand, how it falls against the body or resists it. " +
  "Second, read the seam structure and silhouette — where it is cut, where it pulls, where the raw edges live. " +
  "Third, give one cold, declarative sentence about the garment's repurpose potential — what it wants to become. " +
  "Use real fashion words: bias, drape, raw edge, seam, form, tension, warp, grain, hem, tuck. " +
  "Sound like you are holding the fabric in your hands.";

/** Best-effort HTTP status from @google/generative-ai / fetch wrappers. */
function extractHttpStatus(err: unknown): number | undefined {
  if (err && typeof err === "object") {
    const o = err as Record<string, unknown>;
    
    if (typeof o.status === "number") return o.status;
    if (typeof o.statusCode === "number") return o.statusCode;
    const cause = o.cause;
    if (cause && typeof cause === "object") {
      const c = cause as Record<string, unknown>;
      if (typeof c.status === "number") return c.status;
    }
    const response = o.response;
    if (response && typeof response === "object") {
      const r = response as Record<string, unknown>;
      if (typeof r.status === "number") return r.status;
    }
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      throw new Error("API_KEY_MISSING");
    }
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    const body = await req.json();
    const { imageData, mimeType } = body as {
      imageData?: string;
      mimeType?: string;
    };

    if (!imageData || !mimeType) {
      return NextResponse.json(
        { error: "NO IMAGE DATA — UPLOAD A GARMENT FILE FIRST." },
        { status: 400 }
      );
    }

    const stripped = imageData
      .replace(/^data:[^;]+;base64,/, "")
      .replace(/\s/g, "");

    if (!/^[A-Za-z0-9+/]+=*$/.test(stripped) || stripped.length < 16) {
      return NextResponse.json(
        { error: "INVALID BASE64 — IMAGE ENCODING FAILED. RETRY." },
        { status: 400 }
      );
    }

    const mimeMap: Record<string, string> = {
      "image/jpeg": "image/jpeg",
      "image/jpg":  "image/jpeg",
      "image/png":  "image/png",
      "image/webp": "image/webp",
    };
    const normMime = mimeMap[mimeType.trim().toLowerCase()] ?? "image/jpeg";

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: MODEL_ID,
      systemInstruction: SYSTEM_INSTRUCTION,
    });

    const result = await model.generateContent([
      { inlineData: { data: stripped, mimeType: normMime } },
      USER_PROMPT,
    ]);

    const analysis = result.response.text().trim();
    return NextResponse.json({ analysis });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "API_KEY_MISSING") {
      console.error("[/api/analyze] API_KEY_MISSING");
      return NextResponse.json(
        { error: "API_KEY_MISSING", code: "API_KEY_MISSING" },
        { status: 503 }
      );
    }

    console.error("[/api/analyze] unhandled", err);
    const raw = err instanceof Error ? err.message : "Unknown engine failure.";
    const status = extractHttpStatus(err);
    if (status !== undefined) {
      console.error("[/api/analyze] outer catch httpStatus:", status);
    }
    return NextResponse.json(
      {
        error: "GEOMETRY_CORRUPTED",
        code: "GEOMETRY_CORRUPTED",
        detail: raw.slice(0, 200),
      },
      { status: 500 }
    );
  }
}