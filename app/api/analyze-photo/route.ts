import { NextRequest, NextResponse } from 'next/server';
import { createGeminiClient, dataUrlToInlineDataPart, getGeminiModels, safeJsonParse } from '../../../lib/gemini';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { photoDataUrl, people } = body || {};
  const hasKey = !!process.env.GEMINI_API_KEY;

  if (!photoDataUrl) {
    return NextResponse.json({
      error: 'No photo provided'
    }, { status: 400 });
  }

  if (!hasKey) {
    return NextResponse.json({
      error: 'GEMINI_API_KEY not configured'
    }, { status: 400 });
  }

  try {
    const ai = createGeminiClient();
    const { textModel } = getGeminiModels();

    const expectedNames = Array.isArray(people) ? people.map((p: any) => p.name).filter(Boolean) : [];
    const peopleList = expectedNames.length ? expectedNames.join(', ') : 'family members';

    const prompt = `You are a character consistency assistant for AI-generated photorealistic images.

Task: From the provided family photo, extract visual identity notes that can be used to keep the SAME people consistent across generated images.

Expected people (use these names if possible): ${peopleList}

Rules:
- Only describe observable physical traits and styling. Avoid guessing sensitive attributes or personal identity.
- Be concise but specific; these notes will be reused as a "character bible".
- If fewer/more people appear than expected, still produce best-effort entries and name unknowns as "Unknown 1", etc.

Return JSON only.`;

    const schema = {
      type: 'object',
      properties: {
        descriptions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              visualFingerprint: {
                type: 'object',
                properties: {
                  hair: { type: 'string' },
                  eyes: { type: 'string' },
                  face: { type: 'string' },
                  skinTone: { type: 'string' },
                  build: { type: 'string' },
                  distinctiveFeatures: { type: 'string' },
                  typicalStyle: { type: 'string' }
                },
                required: ['hair', 'eyes', 'face', 'skinTone', 'build', 'distinctiveFeatures', 'typicalStyle']
              },
              description: { type: 'string' }
            },
            required: ['name', 'visualFingerprint', 'description']
          }
        }
      },
      required: ['descriptions']
    } as const;

    const inlineImagePart = dataUrlToInlineDataPart(photoDataUrl);

    const response = await ai.models.generateContent({
      model: textModel,
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }, inlineImagePart]
        }
      ],
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: schema
      }
    });

    const parsed = safeJsonParse<{ descriptions: Array<{ name: string; description: string }> }>(response.text || '');
    const parsedDescriptions = parsed || { descriptions: [] };

    // Map descriptions to person IDs
    const characterDescriptions = (parsedDescriptions.descriptions || []).map((desc: any) => {
      // Find matching person by name (case-insensitive)
      const matchingPerson = people?.find((p: any) =>
        p.name.toLowerCase().includes(desc.name.toLowerCase()) ||
        desc.name.toLowerCase().includes(p.name.toLowerCase())
      );

      return {
        personId: matchingPerson?.id || 'unknown',
        personName: matchingPerson?.name || desc.name,
        description: desc.description || ''
      };
    }).filter((d: any) => d.description && String(d.description).trim().length > 0);

    return NextResponse.json({
      characterDescriptions
    });

  } catch (err: any) {
    console.error('Photo analysis error:', err);
    return NextResponse.json({
      error: String(err.message || err)
    }, { status: 500 });
  }
}
