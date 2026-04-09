import { NextResponse } from "next/server";

export const maxDuration = 60; // prevents Vercel timeout on Fal.ai cold starts

export async function POST(req: Request) {
  try {
    // 1. Extract the payload sent from the frontend Studio
    const {
      sourceImage,           // canvas-composited data-URL — what RewireBlock sends
      image_url,             // alias accepted from direct / external callers
      backgroundStyle,       // full descriptive location string from Location Scout
      location,              // alias accepted from direct / external callers
      clientPhoto  = null,   // the client's own photo — they are the model
      analysisText = "",
      userVision   = null,
      metrics      = {},
    } = await req.json();

    const imagePayload = sourceImage || image_url;
    const locationStr  = backgroundStyle || location || null;
    const hasClientPhoto = !!(clientPhoto as string | null);

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

    // 3. Build the metrics clause
    const { height = "", chest = "", waist = "", hips = "" } =
      metrics as Record<string, string>;
    const metricsParts = [
      height && `height ${height}`,
      chest  && `chest ${chest}`,
      waist  && `waist ${waist}`,
      hips   && `hips ${hips}`,
    ].filter(Boolean);
    const metricsClause = metricsParts.length > 0
      ? ` Fit the garment to client measurements: ${metricsParts.join(", ")}.`
      : "";

    // 4. Brand DNA — no color words to avoid training-data palette bias
    const OOPS_BRAND_DNA =
      `OOPS brand aesthetic, avant-garde upcycled fashion. ` +
      `The garment MUST be constructed by splicing and repurposing the EXACT materials, ` +
      `colors, graphics, and patterns visible in the source image. ` +
      `Features brutalist asymmetrical patchwork and raw frayed exposed seams. ` +
      `Heavily detailed with utilitarian metal hardware: oversized D-rings, ` +
      `tactical buckles, thick chains, and safety pins. ` +
      `High-end fashion editorial, hyper-realistic physical fabric textures, ` +
      `35mm film photography. NO glossy 3D renders. NO studio polish.`;

    // 5. Assemble the Master Prompt
    //
    // Two modes:
    //   hasClientPhoto = true  → Subject is the REAL PERSON from the photo.
    //                            We describe the look ON them, in the scene.
    //   hasClientPhoto = false → Subject is an industrial tailor's mannequin.
    //                            Original editorial-photography mode.

    const settingClause = locationStr
      ? `Shot on location in a ${locationStr}.`
      : "Shot in a harsh, minimalist white studio void with high-end editorial lighting.";

    const designDirective = (userVision as string | null)?.trim()
      ? (userVision as string).trim()
      : "a chaotic, avant-garde reimagining — raw, distressed, deconstructed, asymmetrical.";

    const subjectClause = hasClientPhoto
      ? `THE SUBJECT: The real person visible in the source image, wearing a completely ` +
        `custom upcycled garment reconstructed from the fabrics in the image.${metricsClause} ` +
        `Keep the person's face, body, and skin exactly as they appear in the source. ` +
        `Only the clothing changes — replace whatever they are wearing with the OOPS upcycled piece. ` +
        `NO face changes. NO skin changes. NO body changes. Only the garment is new.`
      : `THE SUBJECT: A custom, industrial tailor's mannequin displaying a completely ` +
        `custom upcycled garment.${metricsClause}`;

    const fullPrompt =
      `Avant-garde fashion editorial photography, 35mm film. ` +
      `THE SETTING: ${settingClause} ` +
      `${subjectClause} ` +
      `THE DESIGN DIRECTIVE: ${designDirective}. ` +
      (analysisText ? `Informed by fabric analysis: "${analysisText}". ` : "") +
      `STRICT BRANDING: ${OOPS_BRAND_DNA} ` +
      `CRITICAL INSTRUCTION: YOU ARE STRICTLY FORBIDDEN FROM CHANGING THE COLORS OR PATTERNS ` +
      `OF THE INPUT IMAGE FABRICS. If the input has camo, the output MUST have camo. ` +
      `If the input has pink lace, the output MUST have pink lace. ` +
      `Do not invent new fabrics. Merely apply the OOPS architectural elements ` +
      `(raw seams, asymmetrical cuts, metal hardware) to the existing input pixels.`;

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
        strength:            0.35,         // low mutation — acts as texture filter, not a full redraw
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
