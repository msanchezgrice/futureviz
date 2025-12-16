import { GenerateContentResponse, GoogleGenAI } from '@google/genai';

export type InlineImage = { mimeType: string; data: string }; // base64

export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} not configured`);
  return value;
}

export function getGeminiModels() {
  return {
    textModel: process.env.GEMINI_TEXT_MODEL || 'gemini-3-pro-preview',
    imageModel: process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image-preview'
  };
}

export function getImageDefaults() {
  const imageSize = process.env.GEMINI_IMAGE_SIZE || '1K';
  const aspectRatio = process.env.GEMINI_IMAGE_ASPECT_RATIO || '3:2';
  return { imageSize, aspectRatio };
}

export function createGeminiClient() {
  const apiKey = getRequiredEnv('GEMINI_API_KEY');
  return new GoogleGenAI({ apiKey });
}

export function dataUrlToInlineDataPart(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Invalid data URL; expected base64 data URL');
  const [, mimeType, data] = match;
  return { inlineData: { mimeType, data } };
}

export function inlineImageToDataUrl(image: InlineImage): string {
  return `data:${image.mimeType};base64,${image.data}`;
}

export function extractFirstInlineImage(response: GenerateContentResponse): InlineImage | null {
  const parts =
    (response as any).parts ||
    response.candidates?.[0]?.content?.parts ||
    [];

  for (const part of parts) {
    if (part?.inlineData?.data) {
      return {
        mimeType: part.inlineData.mimeType || 'image/png',
        data: part.inlineData.data
      };
    }
  }
  return null;
}

export function getResponseText(response: GenerateContentResponse): string {
  const parts =
    (response as any).parts ||
    response.candidates?.[0]?.content?.parts ||
    [];

  let text = '';
  for (const part of parts) {
    if (typeof part?.text === 'string') {
      if (typeof part.thought === 'boolean' && part.thought) continue;
      text += part.text;
    }
  }
  return text;
}

export function safeJsonParse<T>(text: string): T {
  const trimmed = (text || '').trim();
  const jsonMatch =
    trimmed.match(/```json\s*([\s\S]*?)\s*```/i) ||
    trimmed.match(/```\s*([\s\S]*?)\s*```/i);
  const jsonStr = (jsonMatch ? jsonMatch[1] : trimmed).trim();
  return JSON.parse(jsonStr) as T;
}
