import { NextRequest, NextResponse } from 'next/server';
import {
  createGeminiClient,
  dataUrlToInlineDataPart,
  extractFirstInlineImage,
  getGeminiModels,
  getImageDefaults,
  inlineImageToDataUrl
} from '../../../lib/gemini';

export const runtime = 'nodejs';
export const maxDuration = 180;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { year, context, characterDescriptions, referencePhotoDataUrl } = body || {};

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 400 });
  }

  try {
    const { summary, people } = context || {};
    const city = summary?.city || 'a beautiful location';

    const physicalDescriptions = Array.isArray(characterDescriptions)
      ? characterDescriptions.map((cd: any) => `${cd.personName}: ${cd.description}`).join('\n\n')
      : (characterDescriptions || '');

    const ageDescriptions = people?.map((p: any) => {
      const age = summary?.ages?.[p.id];
      if (age === undefined) return null;

      let stage = '';
      if (p.role === 'child') {
        if (age < 2) stage = 'infant';
        else if (age < 5) stage = 'toddler';
        else if (age < 13) stage = 'child';
        else if (age < 18) stage = 'teenager';
        else stage = 'young adult';
      } else {
        stage = `${age}-year-old adult`;
      }

      return `${p.name}: ${age} years old (${stage})`;
    }).filter(Boolean).join('\n') || '';

    const seriesSetup = `You are generating a photorealistic lifestyle photo series of the SAME FAMILY on the SAME DAY.

Hard requirements:
- The same exact individuals across all images (identical facial features, hair, skin tone, body proportions).
- Correct ages for the year.
- Photorealistic, professional photography; no text overlays.
- Candid, natural moments; no staged posing.

Location: ${city}
Year: ${year}

${ageDescriptions ? `Ages in this year:\n${ageDescriptions}\n` : ''}
${physicalDescriptions ? `Character bible (must match across all images):\n${physicalDescriptions}\n` : ''}`;

    const prompt = `${seriesSetup}

Generate an ANCHOR photo: a clear, well-lit family moment with all faces visible and unobstructed. Keep it natural, not posed.`;

    const ai = createGeminiClient();
    const { imageModel } = getGeminiModels();
    const { imageSize, aspectRatio } = getImageDefaults();

    const parts: any[] = [{ text: prompt }];
    if (referencePhotoDataUrl && String(referencePhotoDataUrl).startsWith('data:')) {
      parts.push(
        { text: 'Reference photo (use ONLY for identity/facial features; ignore background/clothing):' },
        dataUrlToInlineDataPart(String(referencePhotoDataUrl))
      );
    }

    const response = await ai.models.generateContent({
      model: imageModel,
      contents: [{ role: 'user', parts }],
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: { imageSize, aspectRatio }
      }
    });

    const image = extractFirstInlineImage(response);
    if (!image) return NextResponse.json({ error: 'Failed to generate anchor image' }, { status: 500 });

    return NextResponse.json({ anchorImageUrl: inlineImageToDataUrl(image) });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

