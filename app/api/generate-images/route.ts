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
export const maxDuration = 300; // 5x 1K images + scene planning

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { year, dayType, context, dayComposerText, characterDescriptions, referencePhotoDataUrl } = body || {};

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({
      error: 'GEMINI_API_KEY not configured'
    }, { status: 400 });
  }

  try {
    const { summary, people } = context || {};
    const city = summary?.city || 'a beautiful location';

    // Physical appearance descriptions from uploaded photos (phenotype - stays constant)
    const physicalDescriptions = Array.isArray(characterDescriptions)
      ? characterDescriptions.map((cd: any) => `${cd.personName}: ${cd.description}`).join('\n\n')
      : (characterDescriptions || '');

    // Age-based characteristics for this specific year (dynamic - changes each year)
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

    // Get people names for scene generation context
    const peopleNames = people?.map((p: any) => p.name).filter(Boolean).join(', ') || '';

    const ai = createGeminiClient();
    const { textModel, imageModel } = getGeminiModels();
    const { imageSize, aspectRatio } = getImageDefaults();

    // Step 1: Generate 5 structured scene ideas (Gemini 3 Pro, JSON schema)
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

    const sceneResponse = await ai.models.generateContent({
      model: textModel,
      contents: scenePrompt,
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: sceneSchema
      }
    });

    const parsedScenes = safeJsonParse<{ sceneIdeas: Array<{ index: number; sceneDescription: string; timeOfDay: string }> }>(getResponseText(sceneResponse));
    const rawIdeas = (parsedScenes.sceneIdeas || []).slice(0, 5);
    const sceneIdeas = rawIdeas
      .map((s, i) => ({
        index: i,
        sceneDescription: String(s.sceneDescription || '').trim(),
        timeOfDay: String(s.timeOfDay || '').trim()
      }))
      .filter(s => s.sceneDescription.length > 0);

    if (sceneIdeas.length !== 5) {
      return NextResponse.json({ error: 'Failed to generate 5 scene ideas' }, { status: 500 });
    }

    // Step 2: Create a multi-turn image chat session (Gemini 3 Pro Image Preview)
    const chat = ai.chats.create({
      model: imageModel,
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: { imageSize, aspectRatio }
      }
    });

    const seriesSetup = `You are generating a 5-photo, photorealistic lifestyle photo series of the SAME FAMILY on the SAME DAY.

Hard requirements:
- The same exact individuals across all images (identical facial features, hair, skin tone, body proportions).
- Correct ages for the year.
- Photorealistic, professional photography; no text overlays.
- Candid, natural moments; no staged posing.

Location: ${city}
Year: ${year}

${ageDescriptions ? `Ages in this year:\n${ageDescriptions}\n` : ''}
${physicalDescriptions ? `Character bible (must match across all images):\n${physicalDescriptions}\n` : ''}`;

    // Step 3: Generate each scene (chat history is the main consistency mechanism).
    const images: Array<{ imageUrl: string; sceneDescription: string; index: number }> = [];

    for (const scene of sceneIdeas) {
      const basePrompt = `Shot ${scene.index + 1} of 5 (${scene.timeOfDay}):
${scene.sceneDescription}

Must be the SAME FAMILY as previous shots. Match faces and hair exactly.`;

      let message: any = basePrompt;
      if (scene.index === 0) {
        const parts: any[] = [
          {
            text:
              `${seriesSetup}\n\n${basePrompt}` +
              `\n\nFor shot 1, ensure all faces are clearly visible (establishing family moment) to lock identity for the series.`
          }
        ];
        if (referencePhotoDataUrl && String(referencePhotoDataUrl).startsWith('data:')) {
          parts.push(
            { text: 'Reference photo (use ONLY for identity/facial features; ignore background/clothing):' },
            dataUrlToInlineDataPart(String(referencePhotoDataUrl))
          );
        }
        message = parts;
      }

      const sceneResponse = await chat.sendMessage({ message });

      let sceneImage = extractFirstInlineImage(sceneResponse);

      if (!sceneImage) {
        continue;
      }

      images.push({
        imageUrl: inlineImageToDataUrl(sceneImage),
        sceneDescription: scene.sceneDescription,
        index: scene.index
      });
    }

    if (images.length === 0) {
      return NextResponse.json({ error: 'No images were generated successfully' }, { status: 500 });
    }

    return NextResponse.json({ images, sceneIdeas });

  } catch (err: any) {
    console.error('Multi-image generation error:', err);
    console.error('Error stack:', err.stack);
    return NextResponse.json({
      error: String(err.message || err),
      stack: err.stack,
      details: err.toString()
    }, { status: 500 });
  }
}
