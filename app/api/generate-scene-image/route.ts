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
export const maxDuration = 240;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    year,
    context,
    characterDescriptions,
    sceneDescription,
    timeOfDay,
    index,
    anchorImageUrl,
    referencePhotoDataUrl
  } = body || {};

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 400 });
  }

  if (!anchorImageUrl || !String(anchorImageUrl).startsWith('data:')) {
    return NextResponse.json({ error: 'anchorImageUrl missing/invalid' }, { status: 400 });
  }

  if (!sceneDescription) {
    return NextResponse.json({ error: 'sceneDescription missing' }, { status: 400 });
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

    const prompt = `Create a photorealistic, aspirational lifestyle photograph for this scene:

${sceneDescription}

CRITICAL - CHARACTER CONSISTENCY (Image ${Number(index) + 1} of 5):
- This is part of a series showing the SAME FAMILY throughout ONE DAY.
- The CURRENT image must match the ANCHOR image's identities exactly (faces/hair/skin tone/distinctive features).
- Correct ages for the year.

Location: ${city}
Year: ${year}
${timeOfDay ? `Time of day: ${timeOfDay}` : ''}

${ageDescriptions ? `Ages:\n${ageDescriptions}\n` : ''}
${physicalDescriptions ? `Character bible:\n${physicalDescriptions}\n` : ''}

Style:
- High-end, natural lifestyle photography
- Candid, authentic moment
- No text overlays`;

    const ai = createGeminiClient();
    const { textModel, imageModel } = getGeminiModels();
    const { imageSize, aspectRatio } = getImageDefaults();

    const baseParts: any[] = [
      { text: prompt },
      { text: 'ANCHOR IMAGE (identity reference):' },
      dataUrlToInlineDataPart(String(anchorImageUrl))
    ];

    if (referencePhotoDataUrl && String(referencePhotoDataUrl).startsWith('data:')) {
      baseParts.push(
        { text: 'USER REFERENCE PHOTO (identity reference):' },
        dataUrlToInlineDataPart(String(referencePhotoDataUrl))
      );
    }

    let imageResponse = await ai.models.generateContent({
      model: imageModel,
      contents: [{ role: 'user', parts: baseParts }],
      config: { responseModalities: ['IMAGE'], imageConfig: { imageSize, aspectRatio } }
    });

    let image = extractFirstInlineImage(imageResponse);
    if (!image) return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });

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

    // Judge + single retry
    try {
      const judgePrompt = `You are checking character consistency across a photo series.

Compare the ANCHOR image and the CURRENT image. Determine if the people are the same individuals.
Focus on facial structure, hair, skin tone, and distinctive features. Ignore clothing changes.

Return JSON only.
If inconsistent, produce a short "fixPrompt" that can be used to regenerate the current image while keeping the scene intact.`;

      const judgeResponse = await ai.models.generateContent({
        model: textModel,
        contents: [
          {
            role: 'user',
            parts: [
              { text: judgePrompt },
              { text: 'ANCHOR:' },
              dataUrlToInlineDataPart(String(anchorImageUrl)),
              { text: 'CURRENT:' },
              { inlineData: { mimeType: image.mimeType, data: image.data } }
            ]
          }
        ],
        config: { responseMimeType: 'application/json', responseJsonSchema: consistencySchema }
      });

      const judged = safeJsonParse<{ consistent: boolean; fixPrompt: string; issues: Array<{ severity: number }> }>(
        getResponseText(judgeResponse)
      );
      const hasMajorIssue = (judged.issues || []).some(i => Number(i.severity) >= 3);

      if (judged.consistent === false && (hasMajorIssue || judged.fixPrompt?.trim())) {
        const retryParts: any[] = [
          { text: `${prompt}\n\nIdentity fixes to apply (preserve the scene):\n${judged.fixPrompt || ''}` },
          { text: 'ANCHOR IMAGE (identity reference):' },
          dataUrlToInlineDataPart(String(anchorImageUrl)),
          { text: 'CURRENT IMAGE (use as base; keep composition, fix identity):' },
          { inlineData: { mimeType: image.mimeType, data: image.data } }
        ];
        if (referencePhotoDataUrl && String(referencePhotoDataUrl).startsWith('data:')) {
          retryParts.push(
            { text: 'USER REFERENCE PHOTO (identity reference):' },
            dataUrlToInlineDataPart(String(referencePhotoDataUrl))
          );
        }

        imageResponse = await ai.models.generateContent({
          model: imageModel,
          contents: [{ role: 'user', parts: retryParts }],
          config: { responseModalities: ['IMAGE'], imageConfig: { imageSize, aspectRatio } }
        });
        const retryImage = extractFirstInlineImage(imageResponse);
        if (retryImage) image = retryImage;
      }
    } catch {
      // Ignore judge failures; still return the generated image.
    }

    return NextResponse.json({
      imageUrl: inlineImageToDataUrl(image),
      index: Number(index) || 0,
      sceneDescription: String(sceneDescription)
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

