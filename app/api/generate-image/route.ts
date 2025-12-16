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

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { year, context, dayComposerText, characterDescriptions, referencePhotoDataUrl } = body || {};

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({
      error: 'GEMINI_API_KEY not configured'
    }, { status: 400 });
  }

  try {
    // Build a detailed, aspirational prompt based on the year context
    const { summary, people, cityPlan } = context || {};
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

    // Craft the image generation prompt with photorealistic, aspirational style
    let prompt = '';

    if (dayComposerText && dayComposerText.trim()) {
      // If Day Composer text exists, use it as the primary source for the image
      prompt = `Create a photorealistic, aspirational lifestyle photograph that visualizes this specific day:

"${dayComposerText}"

CRITICAL - CHARACTER CONSISTENCY:

${ageDescriptions ? `CHARACTER AGES IN THIS YEAR (${year}):
${ageDescriptions}

Ensure each person appears at their correct age and life stage.
` : ''}

${physicalDescriptions ? `PHYSICAL APPEARANCE TO MATCH EXACTLY (Phenotype - stays constant):
${physicalDescriptions}

` : ''}ALL people in the image MUST match these descriptions precisely. Pay special attention to:
- Exact facial features, bone structure, and proportions
- Hair color, style, and texture
- Eye color and shape
- Skin tone
- Body build and posture relative to their age
- Distinctive features

These are the same individuals who will appear in multiple images, so visual consistency is paramount.

Style: High-end nature photography aesthetic inspired by Patagonia catalogs, Pinterest lifestyle boards, and National Geographic. The image should feel:
- Warm, natural lighting (golden hour preferred)
- Authentic, candid moment (not posed or staged)
- Connection to nature and place
- Aspirational but achievable lifestyle
- Rich colors, professional composition
- Focus on human connection, adventure, or quiet domestic beauty

Visualize the specific scene, activity, or moment described in the text above. Capture the mood, setting, and people mentioned. Location: ${city}.

The image should evoke possibility, warmth, and the beauty of everyday life. Photorealistic quality, professional photography, no text overlays.`;
    } else {
      // Fallback to generic prompt if no Day Composer text
      prompt = `Create a photorealistic, aspirational lifestyle photograph set in ${city} in the year ${year}.

Context: This is a vision of a family's future year.

CRITICAL - CHARACTER CONSISTENCY:

${ageDescriptions ? `CHARACTER AGES IN THIS YEAR (${year}):
${ageDescriptions}

Ensure each person appears at their correct age and life stage.
` : ''}

${physicalDescriptions ? `PHYSICAL APPEARANCE TO MATCH EXACTLY (Phenotype - stays constant):
${physicalDescriptions}

` : ''}ALL people in the image MUST match these descriptions precisely. Pay special attention to:
- Exact facial features, bone structure, and proportions
- Hair color, style, and texture
- Eye color and shape
- Skin tone
- Body build and posture relative to their age
- Distinctive features

These are the same individuals who will appear in multiple images, so visual consistency is paramount.

Style: High-end nature photography aesthetic inspired by Patagonia catalogs, Pinterest lifestyle boards, and National Geographic. The image should feel:
- Warm, natural lighting (golden hour preferred)
- Authentic, candid moment (not posed or staged)
- Connection to nature and place
- Aspirational but achievable lifestyle
- Rich colors, professional composition
- Focus on human connection, adventure, or quiet domestic beauty

Setting: ${city}, capturing the essence of life in this location during ${year}. Show either:
- A family outdoor adventure (hiking, beach, park, exploring nature)
- A warm domestic moment with natural light
- An urban scene that captures the character of ${city}

The image should evoke possibility, warmth, and the beauty of everyday life. Photorealistic quality, professional photography, no text overlays.`;
    }

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

    const result = await ai.models.generateContent({
      model: imageModel,
      contents: [{ role: 'user', parts }],
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: { imageSize, aspectRatio }
      }
    });

    const image = extractFirstInlineImage(result);
    if (image) {
      return NextResponse.json({
        imageUrl: inlineImageToDataUrl(image),
        prompt: prompt.substring(0, 200) + '...'
      });
    }

    // If no image was generated, return error with debug info
    return NextResponse.json({
      error: 'No image generated in response',
      debug: {
        candidatesCount: result.candidates?.length || 0,
        firstCandidatePartsCount: result.candidates?.[0]?.content?.parts?.length || 0
      }
    }, { status: 500 });

  } catch (err: any) {
    console.error('Image generation error:', err);
    console.error('Error stack:', err.stack);
    console.error('Error details:', JSON.stringify(err, null, 2));
    return NextResponse.json({
      error: String(err.message || err),
      stack: err.stack,
      details: err.toString()
    }, { status: 500 });
  }
}
