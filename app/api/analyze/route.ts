import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

/** Vercel / Next payload limit (Pages API shape; harmless if ignored by App Router). */
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb" as const,
    },
  },
};

// --- THE FIX: Switched to the universally accepted base model ---
const MODEL_ID = "gemini-2.5-flash" as const;

const SYSTEM_INSTRUCTION =
  "You are a high-end technical fashion consultant for a brutalist, deconstructed brand. " +
  "You analyze garments with cold precision and architectural authority. " +
  "Focus exclusively on construction, silhouette, and geometry — never on color trends or styling. " +
  "Your voice is terse, technical, and uncompromising.";

const USER_PROMPT =
  "Analyze the construction, silhouette, and geometry of this garment. " +
  "Provide exactly 3 sentences. " +
  "First, critique the tension between the textile weight (e.g., sheer or heavy) and the structural draping. " +
  "Second, analyze the specific seam architecture and any asymmetrical geometry or negative space. " +
  "Finally, provide a cold, declarative statement on its spatial logic. " +
  "Be hyper-technical, uncompromising, and use brutalist architectural terminology.";

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

    let model;
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      model = genAI.getGenerativeModel({
        model: MODEL_ID,
        systemInstruction: SYSTEM_INSTRUCTION,
      });
    } catch (setupErr: unknown) {
      const status = extractHttpStatus(setupErr);
      console.error("[/api/analyze] getGenerativeModel failed", {
        model: MODEL_ID,
        httpStatus: status ?? "unknown",
        message: setupErr instanceof Error ? setupErr.message : String(setupErr),
      });
      throw setupErr;
    }

    let result;
    try {
      result = await model.generateContent([
        { inlineData: { data: stripped, mimeType: normMime } },
        USER_PROMPT,
      ]);
    } catch (genErr: unknown) {
      const status = extractHttpStatus(genErr);
      console.error("[/api/analyze] generateContent failed", {
        model: MODEL_ID,
        httpStatus: status ?? "unknown",
        message: genErr instanceof Error ? genErr.message : String(genErr),
      });
      throw genErr;
    }

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