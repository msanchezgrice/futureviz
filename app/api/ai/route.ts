import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

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
  const apiKey = process.env.OPENAI_API_KEY;

  const defaultText = DAY_TYPE_DEFAULTS[dayType]?.(year) || DAY_TYPE_DEFAULTS.christmas(year);

  if (!apiKey) {
    // No key configured – return a helpful stub text so the app still works.
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
    // If generateAll is true, generate all 5 day types at once
    if (generateAll) {
      const allDayTypes = Object.keys(DAY_TYPE_PROMPTS);
      const allPromises = allDayTypes.map(async (dt) => {
        const dayPrompt = DAY_TYPE_PROMPTS[dt];
        const prompt = [
          { role: 'system', content: 'You write concise, warm, concrete day-in-the-life vignettes for families planning the future.' },
          { role: 'user', content: `Write a vivid single-paragraph day-in-the-life set on ${dayPrompt} in ${year}. Use these facts as soft context: ${JSON.stringify(context)}. Keep it grounded (no fantasy). Capture the specific feeling and traditions of this particular day.` }
        ];

        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: prompt,
            temperature: 0.8,
            max_tokens: 250
          })
        });

        if (!resp.ok) {
          return { dayType: dt, text: DAY_TYPE_DEFAULTS[dt]?.(year) || '' };
        }

        const j = await resp.json();
        const text = j.choices?.[0]?.message?.content || DAY_TYPE_DEFAULTS[dt]?.(year) || '';
        return { dayType: dt, text };
      });

      const results = await Promise.all(allPromises);
      const allDayTexts: Record<string, string> = {};
      results.forEach(r => {
        allDayTexts[r.dayType] = r.text;
      });

      return NextResponse.json({ allDayTexts });
    }

    // Single day type generation
    const dayPrompt = DAY_TYPE_PROMPTS[dayType] || 'a day';
    const prompt = [
      { role: 'system', content: 'You write concise, warm, concrete day-in-the-life vignettes for families planning the future.' },
      { role: 'user', content: `Write a vivid single-paragraph day-in-the-life set on ${dayPrompt} in ${year}. Use these facts as soft context: ${JSON.stringify(context)}. Keep it grounded (no fantasy). Capture the specific feeling and traditions of this particular day.` }
    ];

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: prompt,
        temperature: 0.8,
        max_tokens: 250
      })
    });

    if (!resp.ok) {
      const e = await resp.text();
      return NextResponse.json({ text: defaultText, error: e }, { status: 200 });
    }
    const j = await resp.json();
    const text = j.choices?.[0]?.message?.content || defaultText;
    return NextResponse.json({ text });
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
