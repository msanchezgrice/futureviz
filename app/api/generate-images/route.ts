import { NextRequest, NextResponse } from 'next/server';
import {
  createGeminiClient,
  dataUrlToInlineDataPart,
  extractFirstInlineImage,
  getGeminiModels,
  getImageDefaults,
  getResponseText,
  inlineImageToDataUrl,
  safeJsonParse
} from '../../../lib/gemini';

export const runtime = 'nodejs';
export const maxDuration = 300;

// Back-compat endpoint for older client bundles that still call /api/generate-images.
// Implemented as a single multi-turn image chat for best character consistency.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { year, dayType, context, dayComposerText, characterDescriptions, referencePhotoDataUrl } = body || {};

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

    const peopleNames = people?.map((p: any) => p.name).filter(Boolean).join(', ') || '';

    const ai = createGeminiClient();
    const { textModel, imageModel } = getGeminiModels();
    const { imageSize, aspectRatio } = getImageDefaults();

    // 1) Scene ideas (structured)
    const scenePrompt = `You are a creative director turning a single day-in-the-life into a coherent 5-photo series.

Goal: Produce 5 distinct photographic moments from ONE day, covering different times of day and activities.

Constraints:
- Each scene MUST include the named people (best-effort) and fit their ages.
- Do not introduce new people.
- Each scene should be 2–3 sentences, describing the visual moment like a photo caption.
- Avoid repetition: different setting/activity/lighting per scene.

Year: ${year}
Day type (if provided): ${dayType || 'unknown'}
Location: ${city}
People: ${peopleNames || 'family'}
${ageDescriptions ? `Ages:\n${ageDescriptions}\n` : ''}

Day description (if any):
${dayComposerText && String(dayComposerText).trim() ? `"${dayComposerText}"` : '(none)'}

Return JSON only.`;

    const sceneSchema = {
      type: 'object',
      properties: {
        sceneIdeas: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              index: { type: 'number' },
              sceneDescription: { type: 'string' },
              timeOfDay: { type: 'string' }
            },
            required: ['index', 'sceneDescription', 'timeOfDay']
          },
          minItems: 5,
          maxItems: 5
        }
      },
      required: ['sceneIdeas']
    } as const;

    const scenesResponse = await ai.models.generateContent({
      model: textModel,
      contents: scenePrompt,
      config: { responseMimeType: 'application/json', responseJsonSchema: sceneSchema }
    });

    const parsedScenes = safeJsonParse<{ sceneIdeas: Array<{ index: number; sceneDescription: string; timeOfDay: string }> }>(
      getResponseText(scenesResponse)
    );
    const sceneIdeas = (parsedScenes.sceneIdeas || []).slice(0, 5).map((s, i) => ({
      index: i,
      sceneDescription: String(s.sceneDescription || '').trim(),
      timeOfDay: String(s.timeOfDay || '').trim()
    })).filter(s => s.sceneDescription.length > 0);

    if (sceneIdeas.length !== 5) {
      return NextResponse.json({ error: 'Failed to generate 5 scene ideas' }, { status: 500 });
    }

    // 2) Multi-turn image chat (best consistency; slower but stable identity)
    const chat = ai.chats.create({
      model: imageModel,
      config: { responseModalities: ['IMAGE'], imageConfig: { imageSize, aspectRatio } }
    });

    const anchorPrompt = `You are generating a photorealistic lifestyle photo series of the SAME FAMILY on the SAME DAY.

Hard requirements:
- The same exact individuals across all images (identical facial features, hair, skin tone, body proportions).
- Correct ages for the year.
- Photorealistic, professional photography; no text overlays.
- Candid, natural moments; no staged posing.

Location: ${city}
Year: ${year}

${ageDescriptions ? `Ages in this year:\n${ageDescriptions}\n` : ''}
${physicalDescriptions ? `Character bible (must match across all images):\n${physicalDescriptions}\n` : ''}

Generate an ANCHOR photo: a clear, well-lit family moment with all faces visible and unobstructed. Keep it natural, not posed.`;

    const anchorParts: any[] = [{ text: anchorPrompt }];
    if (referencePhotoDataUrl && String(referencePhotoDataUrl).startsWith('data:')) {
      anchorParts.push(
        { text: 'Reference photo (use ONLY for identity/facial features; ignore background/clothing):' },
        dataUrlToInlineDataPart(String(referencePhotoDataUrl))
      );
    }

    const anchorResponse = await chat.sendMessage({ message: anchorParts as any });
    const anchorImage = extractFirstInlineImage(anchorResponse);
    if (!anchorImage) return NextResponse.json({ error: 'Failed to generate anchor image' }, { status: 500 });

    const images: Array<{ imageUrl: string; sceneDescription: string; index: number }> = [];

    for (const scene of sceneIdeas) {
      const prompt = `Shot ${scene.index + 1} of 5 (${scene.timeOfDay || 'time unknown'}):
${scene.sceneDescription}

CRITICAL:
- Must be the SAME FAMILY as the anchor image (identical faces/hair/skin tone/distinctive features).
- Correct ages for the year.
- Photorealistic, professional photography; no text overlays.`;

      const resp = await chat.sendMessage({ message: prompt });
      const image = extractFirstInlineImage(resp);
      if (!image) continue;
      images.push({
        imageUrl: inlineImageToDataUrl(image),
        sceneDescription: scene.sceneDescription,
        index: scene.index
      });
    }

    if (images.length === 0) {
      return NextResponse.json({ error: 'No images were generated successfully' }, { status: 500 });
    }

    return NextResponse.json(
      { images: images.sort((a, b) => a.index - b.index), sceneIdeas },
      {
        status: 200,
        headers: {
          'x-futureline-generate-images': 'compat'
        }
      }
    );
  } catch (err: any) {
    console.error('Generate-images compat error:', err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
