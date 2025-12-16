import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
  return NextResponse.json(
    {
      error:
        'Deprecated endpoint. Use /api/generate-scenes, /api/generate-anchor, and /api/generate-scene-image for timeout-safe generation.'
    },
    { status: 410 }
  );
}

