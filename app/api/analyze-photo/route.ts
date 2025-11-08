import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { photoDataUrl, people } = body || {};
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      error: 'OPENAI_API_KEY not configured'
    }, { status: 400 });
  }

  if (!photoDataUrl) {
    return NextResponse.json({
      error: 'No photo provided'
    }, { status: 400 });
  }

  try {
    // Use OpenAI Vision to analyze the photo and extract character descriptions
    const peopleList = people?.map((p: any) => p.name).join(', ') || 'family members';

    const prompt = `Analyze this family photo and provide detailed physical descriptions of each person for use in AI image generation.

The photo should include these people: ${peopleList}

For EACH person, provide a detailed physical description including:
- Build and body type
- Hair color, style, and length
- Eye color (if visible)
- Skin tone
- Distinctive facial features (nose shape, facial structure, etc.)
- Typical clothing style shown
- Any other notable physical characteristics

IMPORTANT: Return ONLY a valid JSON object in this exact format:
{
  "descriptions": [
    {
      "name": "Person Name",
      "description": "Detailed physical description..."
    }
  ]
}

Be specific and detailed enough that an AI image generator can maintain visual consistency across multiple images. Focus on permanent physical features, not temporary styling.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a visual analysis assistant. Always return valid JSON in the exact format requested.'
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: photoDataUrl,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 1500,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || '';

    // Parse JSON response
    let parsedDescriptions;
    try {
      // Try to extract JSON if it's wrapped in markdown code blocks
      const jsonMatch = rawContent.match(/```json\s*([\s\S]*?)\s*```/) || rawContent.match(/```\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : rawContent;
      parsedDescriptions = JSON.parse(jsonStr);
    } catch (e) {
      console.error('Failed to parse JSON, using raw text:', rawContent);
      // Fallback: return raw text as single description
      return NextResponse.json({
        characterDescriptions: [
          { personId: people?.[0]?.id || 'unknown', personName: 'Family', description: rawContent }
        ]
      });
    }

    // Map descriptions to person IDs
    const characterDescriptions = parsedDescriptions.descriptions?.map((desc: any) => {
      // Find matching person by name (case-insensitive)
      const matchingPerson = people?.find((p: any) =>
        p.name.toLowerCase().includes(desc.name.toLowerCase()) ||
        desc.name.toLowerCase().includes(p.name.toLowerCase())
      );

      return {
        personId: matchingPerson?.id || 'unknown',
        personName: matchingPerson?.name || desc.name,
        description: desc.description
      };
    }) || [];

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
