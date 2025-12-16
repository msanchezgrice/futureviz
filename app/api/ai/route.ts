import { NextRequest, NextResponse } from 'next/server';
import { createGeminiClient, getGeminiModels, getResponseText, safeJsonParse } from '../../../lib/gemini';

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow up to 60 seconds for generating all 5 days

const DAY_TYPE_PROMPTS: Record<string, string> = {
  christmas: 'Christmas morning',
  thanksgiving: 'Thanksgiving Day',
  summer: 'a beautiful summer day',
  spring: 'a spring day',
  birthday: 'a birthday celebration'
};

const DAY_TYPE_DEFAULTS: Record<string, (year: number) => string> = {
  christmas: (year) => `It is Christmas morning in ${year}. The tree glows softly in the corner, gifts are unwrapped with squeals of delight, and the smell of cinnamon rolls fills the house. Family gathers, stories are shared, and the day unfolds with warmth and gratitude.`,
  thanksgiving: (year) => `It is Thanksgiving ${year}. The table is set, the turkey is golden, and family gathers from near and far. Gratitude is spoken, laughter echoes through the rooms, and the day ends with full hearts and leftovers for days.`,
  summer: (year) => `It is a summer day in ${year}. The sun is warm, the afternoons stretch long, and adventure calls. You spend the day at the beach, in the garden, or exploring somewhere new, savoring the freedom and light.`,
  spring: (year) => `It is a spring day in ${year}. Flowers bloom, the air is fresh, and renewal is in the air. You spend the day outside, feeling the gentle warmth, watching things grow, and planning what's to come.`,
  birthday: (year) => `It is a birthday in ${year}. Candles are lit, wishes are made, and celebration fills the air. Family and friends gather, memories are made, and another year is welcomed with joy.`
};

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { year, dayType = 'christmas', context, generateAll = false } = body || {};

  const defaultText = DAY_TYPE_DEFAULTS[dayType]?.(year) || DAY_TYPE_DEFAULTS.christmas(year);

  if (!process.env.GEMINI_API_KEY) {
    // No key configured – return helpful stub text so the app still works.
    if (generateAll) {
      const allDayTexts: Record<string, string> = {};
      Object.keys(DAY_TYPE_DEFAULTS).forEach(dt => {
        allDayTexts[dt] = DAY_TYPE_DEFAULTS[dt](year);
      });
      return NextResponse.json({ allDayTexts });
    }
    return NextResponse.json({ text: defaultText });
  }

  try {
    const ai = createGeminiClient();
    const { textModel } = getGeminiModels();

    if (generateAll) {
      const prompt = `Write vivid, grounded, single-paragraph day-in-the-life vignettes for a family's future planning timeline.

Requirements:
- No fantasy/sci-fi, no melodrama, no clichés.
- Use concrete sensory details and specific routines.
- Keep each vignette 90–140 words.
- Use context as soft guidance; do not invent extreme facts.

Year: ${year}
Context (JSON): ${JSON.stringify(context ?? {})}

Generate one vignette for each day type: christmas, thanksgiving, summer, spring, birthday.
Return JSON only.`;

      const schema = {
        type: 'object',
        properties: {
          allDayTexts: {
            type: 'object',
            properties: {
              christmas: { type: 'string' },
              thanksgiving: { type: 'string' },
              summer: { type: 'string' },
              spring: { type: 'string' },
              birthday: { type: 'string' }
            },
            required: ['christmas', 'thanksgiving', 'summer', 'spring', 'birthday']
          }
        },
        required: ['allDayTexts']
      } as const;

      const response = await ai.models.generateContent({
        model: textModel,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: schema
        }
      });

      const parsed = safeJsonParse<{ allDayTexts: Record<string, string> }>(getResponseText(response));
      const allDayTexts = parsed.allDayTexts || {};

      // Ensure all keys exist with sensible fallbacks.
      (Object.keys(DAY_TYPE_DEFAULTS) as Array<keyof typeof DAY_TYPE_DEFAULTS>).forEach((dt) => {
        if (!allDayTexts[dt]) allDayTexts[dt] = DAY_TYPE_DEFAULTS[dt](year);
      });

      return NextResponse.json({ allDayTexts });
    }

    // Single day type generation
    const dayPrompt = DAY_TYPE_PROMPTS[dayType] || 'a day';

    const prompt = `Write one vivid, grounded, single-paragraph day-in-the-life vignette for a family planning their future.

Requirements:
- No fantasy/sci-fi, no melodrama, no clichés.
- 90–140 words.
- Concrete, specific details; avoid generic platitudes.
- Use context as soft guidance; don't invent extreme facts.

Day type: ${dayPrompt}
Year: ${year}
Context (JSON): ${JSON.stringify(context ?? {})}

Return JSON only with key "text".`;

    const schema = {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text']
    } as const;

    const response = await ai.models.generateContent({
      model: textModel,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: schema
      }
    });

    const parsed = safeJsonParse<{ text: string }>(getResponseText(response));
    return NextResponse.json({ text: parsed.text || defaultText });
  } catch (err: any) {
    if (generateAll) {
      const allDayTexts: Record<string, string> = {};
      Object.keys(DAY_TYPE_DEFAULTS).forEach(dt => {
        allDayTexts[dt] = DAY_TYPE_DEFAULTS[dt](year);
      });
      return NextResponse.json({ allDayTexts, error: String(err) }, { status: 200 });
    }
    return NextResponse.json({ text: defaultText, error: String(err) }, { status: 200 });
  }
}
