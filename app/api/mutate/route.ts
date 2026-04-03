import { NextResponse } from "next/server";

export const maxDuration = 60; // prevents Vercel timeout on Fal.ai cold starts

export async function POST(req: Request) {
  try {
    // 1. Extract the payload sent from the frontend Studio
    //    RewireBlock sends `sourceImage` (the canvas data-URL) and `backgroundStyle` (full location string)
    const {
      sourceImage,           // canvas-composited data-URL — what RewireBlock sends
      image_url,             // alias accepted from direct / external callers
      backgroundStyle,       // full descriptive location string from Location Scout
      location,              // alias accepted from direct / external callers
      analysisText = "",
      userVision   = null,
      metrics      = {},
    } = await req.json();

    const imagePayload = sourceImage || image_url;
    const locationStr  = backgroundStyle || location || null;

    // 2. Security Check: Ensure the API key exists
    if (!process.env.FAL_KEY) {
      console.error("CRITICAL: FAL_KEY is missing from environment variables.");
      return NextResponse.json(
        { error: "Server misconfiguration: API key missing" },
        { status: 500 },
      );
    }

    if (!imagePayload) {
      return NextResponse.json(
        { error: "No source image provided." },
        { status: 400 },
      );
    }

    // 3. Build the metrics clause so the AI scales for the client's body
    const { height = "", chest = "", waist = "", hips = "" } =
      metrics as Record<string, string>;
    const metricsParts = [
      height && `height ${height}`,
      chest  && `chest ${chest}`,
      waist  && `waist ${waist}`,
      hips   && `hips ${hips}`,
    ].filter(Boolean);
    const metricsClause =
      metricsParts.length > 0
        ? ` Scale the mannequin for client measurements: ${metricsParts.join(", ")}.`
        : "";

    // 4. The Brand DNA (Our Aesthetic Rules)
    //    Explicitly instructs the model to preserve source graphics/logos/patterns.
    const OOPS_BRAND_DNA =
      `OOPS brand aesthetic, avant-garde 'Daylight Punk' upcycled fashion. ` +
      `The garment MUST be constructed by splicing and repurposing the EXACT materials, ` +
      `graphics, logos, and patterns visible in the source image. ` +
      `Retain the original graphic prints (e.g., band logos, vintage text) but distort ` +
      `and re-sew them into the new silhouette. ` +
      `Features brutalist asymmetrical patchwork and raw frayed exposed seams. ` +
      `Heavily detailed with utilitarian metal hardware: oversized D-rings, ` +
      `tactical buckles, thick chains, and safety pins. ` +
      `High-end fashion editorial, hyper-realistic physical fabric textures, ` +
      `35mm film photography. ` +
      `NO human faces. NO glossy 3D renders. NO studio polish.`;

    // 5. Assemble the Master Prompt
    const settingClause = locationStr
      ? `Shot on location in a ${locationStr}.`
      : "Shot in a harsh, minimalist white studio void.";

    const designDirective = (userVision as string | null)?.trim()
      ? (userVision as string).trim()
      : "a chaotic, avant-garde reimagining — raw, distressed, deconstructed, asymmetrical.";

    const fullPrompt =
      `Avant-garde fashion editorial photography, 35mm film. ` +
      `THE SETTING: ${settingClause} ` +
      `THE SUBJECT: A custom, industrial tailor's mannequin displaying a completely ` +
      `custom upcycled garment.${metricsClause} ` +
      `THE DESIGN DIRECTIVE: ${designDirective}. ` +
      (analysisText ? `Informed by fabric analysis: "${analysisText}". ` : "") +
      `STRICT BRANDING: ${OOPS_BRAND_DNA} ` +
      `CRITICAL INSTRUCTION: DO NOT change the colors or graphic prints of the source image. ` +
      `You MUST preserve the EXACT colors, patterns (e.g., plaid, stripes, logos), and prints ` +
      `from the input image. Only add raw seams, asymmetrical cuts, and metal hardware on top.`;

    // 6. Fire the Engine (Secure fetch to Fal.ai)
    const response = await fetch("https://fal.run/fal-ai/flux-pro", {
      method: "POST",
      headers: {
        Authorization:  `Key ${process.env.FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt:              fullPrompt,
        image_url:           imagePayload, // canvas-composited Base64 data-URL
        image_size:          "portrait_4_3",
        num_inference_steps: 35,
        guidance_scale:      5.0,          // stricter prompt adherence
        strength:            0.45,         // low mutation — preserves source colors/logos/patterns
        num_images:          1,
        prompt_upsampling:   false,        // prevent Fal.ai LLM from rewriting our prompt
        safety_tolerance:    "6",
      }),
    });

    // 7. Handle Fal.ai Errors (e.g., out of credits, bad payload)
    if (!response.ok) {
      const errorText = await response.text();
      console.error("FAL API ERROR:", errorText);
      return NextResponse.json(
        { error: "Failed to generate image from AI engine.", detail: errorText.slice(0, 300) },
        { status: response.status },
      );
    }

    // 8. Extract the URL and return it to the frontend
    //    RewireBlock reads `data.imageUrl` — keep that key.
    const data      = await response.json();
    const imageUrl  = data.images?.[0]?.url;

    if (!imageUrl) {
      console.error("Fal.ai returned no image URL:", JSON.stringify(data).slice(0, 300));
      return NextResponse.json(
        { error: "Fal.ai returned no image in response." },
        { status: 502 },
      );
    }

    return NextResponse.json({ imageUrl });

  } catch (error) {
    // Catch any total system failures
    console.error("MUTATION ENDPOINT CRASH:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
