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
// Implemented as a single request with parallel image generation to stay under Vercel timeouts.
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

    // 2) Anchor image (identity lock)
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

    const anchorResponse = await ai.models.generateContent({
      model: imageModel,
      contents: [{ role: 'user', parts: anchorParts }],
      config: { responseModalities: ['IMAGE'], imageConfig: { imageSize, aspectRatio } }
    });

    const anchorImage = extractFirstInlineImage(anchorResponse);
    if (!anchorImage) {
      return NextResponse.json({ error: 'Failed to generate anchor image' }, { status: 500 });
    }

    // 3) Generate 5 images in parallel (anchor + optional user reference image included)
    const generationPromises = sceneIdeas.map(async (scene) => {
      const prompt = `Create a photorealistic, aspirational lifestyle photograph for this scene:

${scene.sceneDescription}

CRITICAL - CHARACTER CONSISTENCY (Image ${scene.index + 1} of 5):
- This is part of a series showing the SAME FAMILY throughout ONE DAY.
- The CURRENT image must match the ANCHOR identities exactly (faces/hair/skin tone/distinctive features).
- Correct ages for the year.

Location: ${city}
Year: ${year}
${scene.timeOfDay ? `Time of day: ${scene.timeOfDay}` : ''}

${ageDescriptions ? `Ages:\n${ageDescriptions}\n` : ''}
${physicalDescriptions ? `Character bible:\n${physicalDescriptions}\n` : ''}

Style:
- High-end, natural lifestyle photography
- Candid, authentic moment
- No text overlays`;

      const parts: any[] = [
        { text: prompt },
        { text: 'ANCHOR IMAGE (identity reference):' },
        { inlineData: { mimeType: anchorImage.mimeType, data: anchorImage.data } }
      ];

      if (referencePhotoDataUrl && String(referencePhotoDataUrl).startsWith('data:')) {
        parts.push(
          { text: 'USER REFERENCE PHOTO (identity reference):' },
          dataUrlToInlineDataPart(String(referencePhotoDataUrl))
        );
      }

      const resp = await ai.models.generateContent({
        model: imageModel,
        contents: [{ role: 'user', parts }],
        config: { responseModalities: ['IMAGE'], imageConfig: { imageSize, aspectRatio } }
      });

      const image = extractFirstInlineImage(resp);
      if (!image) return null;
      return { scene, image };
    });

    const generated = await Promise.all(generationPromises);
    const generatedOk = generated.filter(Boolean) as Array<{ scene: any; image: { mimeType: string; data: string } }>;

    if (generatedOk.length === 0) {
      return NextResponse.json({ error: 'No images were generated successfully' }, { status: 500 });
    }

    // 4) Judge + optional single retry (parallel). Retry regenerates (not edit) to avoid thoughtSignature multi-turn requirements.
    const consistencySchema = {
      type: 'object',
      properties: {
        consistent: { type: 'boolean' },
        issues: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              person: { type: 'string' },
              issue: { type: 'string' },
              severity: { type: 'number' }
            },
            required: ['person', 'issue', 'severity']
          }
        },
        fixPrompt: { type: 'string' }
      },
      required: ['consistent', 'issues', 'fixPrompt']
    } as const;

    const judged = await Promise.all(generatedOk.map(async (item) => {
      const judgePrompt = `You are checking character consistency across a photo series.

Compare the ANCHOR image and the CURRENT image. Determine if the people are the same individuals.
Focus on facial structure, hair, skin tone, and distinctive features. Ignore clothing changes.

Return JSON only.
If inconsistent, produce a short "fixPrompt" for regenerating the CURRENT image while keeping the scene intact.`;

      const judgeResponse = await ai.models.generateContent({
        model: textModel,
        contents: [
          {
            role: 'user',
            parts: [
              { text: judgePrompt },
              { text: 'ANCHOR:' },
              { inlineData: { mimeType: anchorImage.mimeType, data: anchorImage.data } },
              { text: 'CURRENT:' },
              { inlineData: { mimeType: item.image.mimeType, data: item.image.data } }
            ]
          }
        ],
        config: { responseMimeType: 'application/json', responseJsonSchema: consistencySchema }
      });

      const parsed = safeJsonParse<{ consistent: boolean; fixPrompt: string; issues: Array<{ severity: number }> }>(
        getResponseText(judgeResponse)
      );

      const hasMajorIssue = (parsed.issues || []).some(i => Number(i.severity) >= 3);
      const shouldRetry = parsed.consistent === false && (hasMajorIssue || parsed.fixPrompt?.trim());
      return { ...item, judge: parsed, shouldRetry };
    }));

    const retries = await Promise.all(judged.map(async (item) => {
      if (!item.shouldRetry) return item;
      const fixPrompt = item.judge.fixPrompt || '';

      const prompt = `Regenerate the image for this scene, preserving the scene content, lighting, and composition, but fixing identity consistency with the anchor:

Scene:
${item.scene.sceneDescription}

Identity fixes:
${fixPrompt}

Hard requirements:
- Match the ANCHOR identities exactly (faces/hair/skin tone/distinctive features).
- Photorealistic, professional photography; no text overlays.
Location: ${city}
Year: ${year}
${ageDescriptions ? `Ages:\n${ageDescriptions}\n` : ''}`;

      const parts: any[] = [
        { text: prompt },
        { text: 'ANCHOR IMAGE (identity reference):' },
        { inlineData: { mimeType: anchorImage.mimeType, data: anchorImage.data } }
      ];
      if (referencePhotoDataUrl && String(referencePhotoDataUrl).startsWith('data:')) {
        parts.push(
          { text: 'USER REFERENCE PHOTO (identity reference):' },
          dataUrlToInlineDataPart(String(referencePhotoDataUrl))
        );
      }

      const resp = await ai.models.generateContent({
        model: imageModel,
        contents: [{ role: 'user', parts }],
        config: { responseModalities: ['IMAGE'], imageConfig: { imageSize, aspectRatio } }
      });
      const retryImage = extractFirstInlineImage(resp);
      if (!retryImage) return item;
      return { ...item, image: retryImage };
    }));

    const images = retries
      .map((item) => ({
        imageUrl: inlineImageToDataUrl(item.image),
        sceneDescription: item.scene.sceneDescription,
        index: item.scene.index
      }))
      .sort((a, b) => a.index - b.index);

    return NextResponse.json(
      { images, sceneIdeas },
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

