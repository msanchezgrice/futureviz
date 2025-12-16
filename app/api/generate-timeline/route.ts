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
export const maxDuration = 300; // 5 minutes for generating multiple years

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { years, characterDescriptions, people, referencePhotoDataUrl } = body || {};

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({
      error: 'GEMINI_API_KEY not configured'
    }, { status: 400 });
  }

  if (!years || years.length === 0) {
    return NextResponse.json({
      error: 'No years provided'
    }, { status: 400 });
  }

  try {
    const ai = createGeminiClient();
    const { imageModel } = getGeminiModels();
    const { imageSize, aspectRatio } = getImageDefaults();

    // Generate images for all years
    const timelineImages = [];

    // Physical appearance descriptions from uploaded photos (phenotype - stays constant)
    const physicalDescriptions = Array.isArray(characterDescriptions)
      ? characterDescriptions.map((cd: any) => `${cd.personName}: ${cd.description}`).join('\n\n')
      : '';

    const shouldUseChatForConsistency = Array.isArray(years) && years.length > 1;
    const chat = shouldUseChatForConsistency
      ? ai.chats.create({
          model: imageModel,
          config: {
            responseModalities: ['IMAGE'],
            imageConfig: { imageSize, aspectRatio }
          }
        })
      : null;

    if (chat) {
      const setupParts: any[] = [
        {
          text:
            `You are generating a timeline of photorealistic family lifestyle photos across multiple years.\n\n` +
            `Hard requirements:\n` +
            `- The same exact individuals across years (identical facial identity).\n` +
            `- Ages should change appropriately by year.\n` +
            `- Photorealistic, professional photography; no text overlays.\n\n` +
            (physicalDescriptions ? `Character bible (must match across all years):\n${physicalDescriptions}\n\n` : '') +
            `First, generate an ANCHOR family photo with clear, well-lit faces (natural candid moment).`
        }
      ];
      if (referencePhotoDataUrl && String(referencePhotoDataUrl).startsWith('data:')) {
        setupParts.push(
          { text: 'Reference photo (use ONLY for identity/facial features; ignore background/clothing):' },
          dataUrlToInlineDataPart(String(referencePhotoDataUrl))
        );
      }

      // Anchor (not returned, but kept in chat history for consistency)
      await chat.sendMessage({ message: setupParts as any });
    }

    for (const yearData of years) {
      const { year, summary } = yearData;
      const city = summary?.city || 'a beautiful location';

      // Age-based characteristics for this specific year
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

      // Generate a representative scene for this year
      const imagePrompt = `Create a photorealistic, aspirational lifestyle photograph representing a typical day in ${year}.

Location: ${city}
Year: ${year}

${ageDescriptions ? `CHARACTER AGES IN THIS YEAR:
${ageDescriptions}

Show each person at their correct age and life stage.
` : ''}

Style: High-end nature photography aesthetic inspired by Patagonia catalogs, Pinterest lifestyle boards, and National Geographic.
- Warm, natural lighting (golden hour preferred)
- Authentic, candid family moment
- Connection to nature and place
- Aspirational but achievable lifestyle
- Rich colors, professional composition
- Focus on human connection and everyday beauty

      Show the family together in ${city}, capturing the essence of their life in this year. Photorealistic quality, professional photography, no text overlays.`;

      try {
        const result = chat
          ? await chat.sendMessage({ message: imagePrompt })
          : await ai.models.generateContent({
              model: imageModel,
              contents: [
                {
                  role: 'user',
                  parts: [
                    { text: physicalDescriptions ? `${imagePrompt}\n\nCharacter bible:\n${physicalDescriptions}` : imagePrompt },
                    ...(referencePhotoDataUrl && String(referencePhotoDataUrl).startsWith('data:')
                      ? [
                          { text: 'Reference photo (use ONLY for identity/facial features; ignore background/clothing):' },
                          dataUrlToInlineDataPart(String(referencePhotoDataUrl))
                        ]
                      : [])
                  ]
                }
              ],
              config: {
                responseModalities: ['IMAGE'],
                imageConfig: { imageSize, aspectRatio }
              }
            });

        const image = extractFirstInlineImage(result as any);
        if (image) {
          timelineImages.push({
            year,
            imageUrl: inlineImageToDataUrl(image),
            generatedAt: Date.now()
          });
        }
      } catch (err: any) {
        console.error(`Error generating image for year ${year}:`, err.message);
        // Continue with other years even if one fails
      }
    }

    return NextResponse.json({
      timelineImages
    });

  } catch (err: any) {
    console.error('Timeline generation error:', err);
    return NextResponse.json({
      error: String(err.message || err)
    }, { status: 500 });
  }
}
