import { NextRequest, NextResponse } from 'next/server';
import { createGeminiClient, getGeminiModels, getResponseText, safeJsonParse } from '../../../lib/gemini';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { year, dayType, context, dayComposerText } = body || {};

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 400 });
  }

  try {
    const { summary, people } = context || {};
    const city = summary?.city || 'a beautiful location';

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
    const { textModel } = getGeminiModels();

    const prompt = `You are a creative director turning a single day-in-the-life into a coherent 5-photo series.

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

    const schema = {
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

    const response = await ai.models.generateContent({
      model: textModel,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: schema
      }
    });

    const parsed = safeJsonParse<{ sceneIdeas: Array<{ index: number; sceneDescription: string; timeOfDay: string }> }>(getResponseText(response));
    const rawIdeas = (parsed.sceneIdeas || []).slice(0, 5);
    const sceneIdeas = rawIdeas.map((s, i) => ({
      index: i,
      sceneDescription: String(s.sceneDescription || '').trim(),
      timeOfDay: String(s.timeOfDay || '').trim()
    })).filter(s => s.sceneDescription.length > 0);

    if (sceneIdeas.length !== 5) {
      return NextResponse.json({ error: 'Failed to generate 5 scene ideas' }, { status: 500 });
    }

    return NextResponse.json({ sceneIdeas });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

