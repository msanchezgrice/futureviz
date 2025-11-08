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

    const prompt = `You are a character design reference assistant for AI-generated artwork. I'm creating a family timeline visualization project.

Count the number of people in this image and create general character design reference notes for each person to maintain visual consistency across AI-generated images.

Expected people: ${peopleList}

For each person in the image, provide general artistic reference notes:
- Age category (infant, toddler, child, teen, young adult, middle-aged, senior)
- Build type (petite, average, athletic, stocky)
- Hair color and length (blonde/brown/black/red/gray, short/medium/long)
- General coloring (fair, medium, tan, deep complexion)
- Style aesthetic shown (casual, formal, sporty, etc.)

These are reference notes for character consistency in illustrated/AI-generated art, similar to character sheets used in animation.

Return this exact JSON structure:
{
  "descriptions": [
    {
      "name": "Person 1",
      "description": "General character design notes..."
    }
  ]
}

Match the person count and use the names I provided if possible.`;

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
            content: 'You are creating character reference sheets for animated/illustrated content. Provide general design notes similar to what would appear on animation character sheets. Focus on artistic style elements, not personal identification. Always return valid JSON.'
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
