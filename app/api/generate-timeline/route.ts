import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for generating multiple years

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { years, characterDescriptions, people, cityPlan } = body || {};
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!geminiApiKey) {
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
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    // Generate images for all years
    const timelineImages = [];

    for (const yearData of years) {
      const { year, summary } = yearData;
      const city = summary?.city || 'a beautiful location';

      // Physical appearance descriptions from uploaded photos (phenotype - stays constant)
      const physicalDescriptions = Array.isArray(characterDescriptions)
        ? characterDescriptions.map((cd: any) => `${cd.personName}: ${cd.description}`).join('\n\n')
        : '';

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

${physicalDescriptions ? `PHYSICAL APPEARANCE (stays constant across all years):
${physicalDescriptions}

` : ''}Style: High-end nature photography aesthetic inspired by Patagonia catalogs, Pinterest lifestyle boards, and National Geographic.
- Warm, natural lighting (golden hour preferred)
- Authentic, candid family moment
- Connection to nature and place
- Aspirational but achievable lifestyle
- Rich colors, professional composition
- Focus on human connection and everyday beauty

Show the family together in ${city}, capturing the essence of their life in this year. Photorealistic quality, professional photography, no text overlays.`;

      try {
        const result = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: imagePrompt
        });

        const imageDataBase64 = result.data;

        if (imageDataBase64) {
          timelineImages.push({
            year,
            imageUrl: `data:image/png;base64,${imageDataBase64}`,
            generatedAt: Date.now()
          });
        } else {
          // Fallback to checking candidates
          const parts = result.candidates?.[0]?.content?.parts || [];
          for (const part of parts) {
            if (part.inlineData) {
              const imageData = part.inlineData.data;
              const mimeType = part.inlineData.mimeType || 'image/png';
              timelineImages.push({
                year,
                imageUrl: `data:${mimeType};base64,${imageData}`,
                generatedAt: Date.now()
              });
              break;
            }
          }
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
