import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow up to 60 seconds for generating 5 images

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { year, context, dayComposerText, characterDescriptions } = body || {};
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!geminiApiKey) {
    return NextResponse.json({
      error: 'GEMINI_API_KEY not configured'
    }, { status: 400 });
  }

  if (!openaiApiKey) {
    return NextResponse.json({
      error: 'OPENAI_API_KEY not configured for scene generation'
    }, { status: 400 });
  }

  try {
    const { summary, people } = context || {};
    const city = summary?.city || 'a beautiful location';

    // Physical appearance descriptions from uploaded photos (phenotype - stays constant)
    const physicalDescriptions = Array.isArray(characterDescriptions)
      ? characterDescriptions.map((cd: any) => `${cd.personName}: ${cd.description}`).join('\n\n')
      : (characterDescriptions || '');

    console.log('=== IMAGE GENERATION DEBUG ===');
    console.log('Year:', year);
    console.log('Character Descriptions (phenotype):', characterDescriptions);
    console.log('Physical Descriptions (formatted):', physicalDescriptions);

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

    // Get people names for scene generation context
    const peopleNames = people?.map((p: any) => p.name).filter(Boolean).join(', ') || '';

    // Step 1: Use OpenAI to generate 5 different scene ideas from the Day Composer text
    let sceneIdeas: string[];

    if (dayComposerText && dayComposerText.trim()) {
      const scenePrompt = `Based on this day-in-the-life description, generate 5 distinct visual scenes from different moments throughout the day. Each scene should capture a different time or aspect of the day, like different photos from the same day.

Day description:
"${dayComposerText}"

${peopleNames ? `People in the scenes: ${peopleNames}` : ''}
${ageDescriptions ? `Ages and life stages:\n${ageDescriptions}` : ''}

Return ONLY a JSON array of 5 scene descriptions. Each description should be 2-3 sentences describing a specific visual moment that INCLUDES THE PEOPLE mentioned above at their specified ages. Focus on different times of day (morning, midday, afternoon, evening, night) and different activities/settings from the day description.

Example format:
["Scene 1 description", "Scene 2 description", "Scene 3 description", "Scene 4 description", "Scene 5 description"]`;

      const sceneResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a creative director helping visualize a day in the life. Return only valid JSON arrays.' },
            { role: 'user', content: scenePrompt }
          ],
          temperature: 0.9,
          max_tokens: 800
        })
      });

      if (!sceneResponse.ok) {
        throw new Error('Failed to generate scene ideas with OpenAI');
      }

      const sceneData = await sceneResponse.json();
      const sceneText = sceneData.choices?.[0]?.message?.content || '';

      // Parse JSON array from response
      try {
        sceneIdeas = JSON.parse(sceneText);
      } catch (e) {
        // Fallback if parsing fails
        sceneIdeas = [
          `Early morning in ${city}. The soft light filters through windows as the day begins.`,
          `Mid-morning activity in ${city}. Energy and movement as the day unfolds.`,
          `Afternoon in ${city}. The warmth of the day at its peak.`,
          `Evening golden hour in ${city}. Warm light bathes everything in gold.`,
          `Night time in ${city}. The calm and reflection of day's end.`
        ];
      }
    } else {
      // Default scenes if no Day Composer text
      sceneIdeas = [
        `Early morning in ${city} during ${year}. The family starts their day together.`,
        `Mid-morning in ${city}. Active and engaged in daily activities.`,
        `Afternoon adventure in ${city}. Exploring and experiencing life.`,
        `Golden hour in ${city}. Family connection during the beautiful evening light.`,
        `Evening at home in ${city}. Cozy and peaceful end to the day.`
      ];
    }

    // Step 2: Generate images for each scene with character consistency
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const imagePromises = sceneIdeas.map(async (sceneIdea, index) => {
      const imagePrompt = `Create a photorealistic, aspirational lifestyle photograph for this scene:

${sceneIdea}

CRITICAL - CHARACTER CONSISTENCY (Image ${index + 1} of 5):
This is part of a series of 5 images showing the SAME FAMILY throughout a single day. Visual consistency is absolutely critical.

${ageDescriptions ? `CHARACTER AGES IN THIS YEAR (${year}):
${ageDescriptions}

Ensure each person appears at their correct age and life stage.
` : ''}

${physicalDescriptions ? `PHYSICAL APPEARANCE TO MATCH EXACTLY (Phenotype - stays constant):
${physicalDescriptions}

` : ''}STRICT CONSISTENCY REQUIREMENTS:
- Every person must have IDENTICAL facial features across all 5 images
- Same eye color, eye shape, and eye spacing
- Same nose shape and size
- Same mouth, lips, and smile
- Same bone structure and face shape
- Same hair color, style, length, and texture
- Same skin tone and complexion
- Same body build and height proportions relative to their age
- Same distinctive features (freckles, facial hair, etc.)
- Similar clothing style/colors within the same day

These are photographs of the SAME PEOPLE at different times during ONE DAY. Treat this like a photo series where maintaining the exact same individuals is paramount.

Location: ${city}
Year: ${year}

Style Guidelines:
- High-end nature photography aesthetic inspired by Patagonia catalogs, Pinterest lifestyle boards, and National Geographic
- Warm, natural lighting (golden hour preferred for outdoor scenes)
- Authentic, candid moment (not posed or staged)
- Connection to nature and place where appropriate
- Aspirational but achievable lifestyle
- Rich colors, professional composition
- Focus on human connection, adventure, or quiet domestic beauty

Photorealistic quality, professional photography, no text overlays.`;

      // Log the first prompt to verify phenotype details are included
      if (index === 0) {
        console.log('=== FIRST IMAGE PROMPT ===');
        console.log('Has physical descriptions:', !!physicalDescriptions);
        console.log('Has age descriptions:', !!ageDescriptions);
        console.log('Prompt length:', imagePrompt.length);
      }

      try {
        const result = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: imagePrompt
        });

        const imageDataBase64 = result.data;

        if (imageDataBase64) {
          return {
            imageUrl: `data:image/png;base64,${imageDataBase64}`,
            sceneDescription: sceneIdea,
            index
          };
        }

        // Fallback to checking candidates
        const parts = result.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.inlineData) {
            const imageData = part.inlineData.data;
            const mimeType = part.inlineData.mimeType || 'image/png';
            return {
              imageUrl: `data:${mimeType};base64,${imageData}`,
              sceneDescription: sceneIdea,
              index
            };
          }
        }

        return null;
      } catch (err: any) {
        console.error(`Error generating image ${index}:`, err.message);
        return null;
      }
    });

    const images = await Promise.all(imagePromises);
    const validImages = images.filter(img => img !== null);

    if (validImages.length === 0) {
      return NextResponse.json({
        error: 'No images were generated successfully'
      }, { status: 500 });
    }

    return NextResponse.json({
      images: validImages,
      sceneIdeas
    });

  } catch (err: any) {
    console.error('Multi-image generation error:', err);
    console.error('Error stack:', err.stack);
    return NextResponse.json({
      error: String(err.message || err),
      stack: err.stack,
      details: err.toString()
    }, { status: 500 });
  }
}
