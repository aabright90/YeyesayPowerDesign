import { NextResponse } from "next/server";

// DEV MODE: IDM-VTON is mocked to avoid API costs during UI/pipeline testing.
// Restore the real implementation when switching back to production.
export async function POST(req: Request) {
  try {
    const { garmentImage } = await req.json();

    // Simulate a 2.5 second AI processing delay
    await new Promise((resolve) => setTimeout(resolve, 2500));

    // Return the garment image as a placeholder for the final fit
    return NextResponse.json({ imageUrl: garmentImage });
  } catch (error) {
    return NextResponse.json({ error: "MOCK VTON CRASHED." }, { status: 500 });
  }
}
