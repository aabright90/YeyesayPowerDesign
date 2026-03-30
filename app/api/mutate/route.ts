import { NextResponse } from "next/server";

export const maxDuration = 60; // seconds — prevents Vercel timeout on Fal.ai cold starts

export async function POST(request: Request) {
  try {
    // 1. Parse the structural analysis text sent from the frontend
    const body = await request.json();
    const { analysisText } = body;

    if (!analysisText) {
      return NextResponse.json(
        { error: 'No analysis text provided.' },
        { status: 400 }
      );
    }

    // 2. Ensure the API key is loaded in Vercel
    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      console.error('CRITICAL: FAL_KEY is missing from environment variables.');
      return NextResponse.json(
        { error: 'Server misconfiguration. Check Vercel logs.' },
        { status: 500 }
      );
    }

    // 3. Construct the master prompt for Flux-Schnell
    // We wrap the structural analysis in the Oops brand aesthetic.
    const masterPrompt = `
      Underground DIY punk-zine fashion photography. Brutalist, Tarantino-esque, rave aesthetic.
      A radically deconstructed garment that prioritizes environmental awareness by repurposing materials. 
      The clothing looks like raw, jagged wrapping paper around a human form, highlighting inner beauty over mass-produced perfection.
      Base the physical geometry on this structural analysis: "${analysisText}".
      Atmosphere: #050505 void background, harsh flash photography, high contrast, toxic acid green or blood red accents, raw seams, unpolished edges, gritty texture.
    `;

    // 4. Hit the Fal.ai Flux-Schnell REST API
    const response = await fetch('https://fal.run/fal-ai/flux/schnell', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: masterPrompt,
        image_size: 'portrait_4_3',
        num_inference_steps: 4, // Schnell is optimized for 4 steps
        num_images: 1,
        enable_safety_checker: true 
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Fal.ai API Error:', errorData);
      return NextResponse.json(
        { error: 'Failed to generate mutated geometry.' },
        { status: response.status }
      );
    }

    const data = await response.json();

    // 5. Extract the generated image URL and send it back to the UI
    const imageUrl = data.images[0].url;

    return NextResponse.json({ imageUrl });

  } catch (error) {
    console.error('Mutation Route Error:', error);
    return NextResponse.json(
      { error: 'Internal server error during geometric mutation.' },
      { status: 500 }
    );
  }
}