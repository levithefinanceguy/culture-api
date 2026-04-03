/**
 * Shared Gemini AI utilities used across photo.ts, order.ts, scan.ts, etc.
 */
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

/**
 * Parse a base64 image string, stripping data URI prefix and detecting MIME type.
 */
export function parseBase64Image(image: string): {
  base64Data: string;
  mimeType: string;
} {
  const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
  let mimeType = "image/jpeg";
  const dataUriMatch = image.match(/^data:(image\/\w+);base64,/);
  if (dataUriMatch) {
    mimeType = dataUriMatch[1];
  }
  return { base64Data, mimeType };
}

/**
 * Parse a Gemini response that may contain JSON — handles raw JSON,
 * markdown-fenced JSON, or embedded JSON arrays/objects.
 */
export function parseGeminiJson(responseText: string): any {
  try {
    return JSON.parse(responseText);
  } catch {
    // Try extracting from markdown code fences
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim());
    }
    // Try finding a JSON array in the response
    const arrayMatch = responseText.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      return JSON.parse(arrayMatch[0]);
    }
    // Try finding a JSON object in the response
    const objMatch = responseText.match(/\{[\s\S]*\}/);
    if (objMatch) {
      return JSON.parse(objMatch[0]);
    }
    return null;
  }
}

/**
 * Get a Gemini GenerativeModel instance, or null if GEMINI_API_KEY is not set.
 */
export function getGeminiModel(
  modelName: string = "gemini-2.5-flash"
): GenerativeModel | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: modelName });
}
