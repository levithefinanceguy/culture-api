/**
 * Chain Importer Service
 *
 * Scrapes nutrition data from restaurant chain websites/PDFs using Gemini AI.
 * Downloads the content (PDF or HTML), sends it to Gemini with a detailed prompt
 * to extract all menu items with full nutrition data, then inserts into the database.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import * as https from "https";
import * as http from "http";
import { URL } from "url";

export interface ExtractedMenuItem {
  name: string;
  category: string;
  serving_description: string;
  serving_size_g: number;
  calories: number;
  total_fat: number;
  saturated_fat: number;
  trans_fat: number;
  cholesterol: number;
  sodium: number;
  total_carbohydrates: number;
  dietary_fiber: number;
  total_sugars: number;
  protein: number;
  ingredients: string | null;
}

export interface ImportResult {
  chain: string;
  url: string;
  itemsExtracted: number;
  itemsInserted: number;
  errors: string[];
}

const GEMINI_MODEL = "gemini-2.5-flash";

/**
 * Downloads content from a URL. Returns the raw buffer and detected content type.
 */
async function downloadContent(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === "https:" ? https : http;

    const request = client.get(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; CultureAPI/1.0)" } }, (response) => {
      // Follow redirects
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        downloadContent(response.headers.location).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode && response.statusCode >= 400) {
        reject(new Error(`HTTP ${response.statusCode} fetching ${url}`));
        return;
      }

      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => {
        const buffer = Buffer.concat(chunks);
        const contentType = response.headers["content-type"] || "application/octet-stream";
        resolve({ buffer, contentType });
      });
      response.on("error", reject);
    });

    request.on("error", reject);
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
  });
}

/**
 * Determines if content is a PDF based on content type or magic bytes.
 */
function isPdf(buffer: Buffer, contentType: string): boolean {
  if (contentType.includes("application/pdf")) return true;
  // Check PDF magic bytes: %PDF
  if (buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return true;
  }
  return false;
}

/**
 * Builds the Gemini extraction prompt.
 */
function buildExtractionPrompt(chainName: string): string {
  return `You are a nutrition data extraction expert. Extract ALL menu items with their complete nutrition data from this ${chainName} nutrition information.

CRITICAL INSTRUCTIONS:
1. Extract EVERY single menu item listed in the document.
2. For items with SIZE VARIANTS (especially pizza, drinks, sides), extract EACH SIZE as a SEPARATE item.
   - For pizza: extract per-slice nutrition for each size separately.
     Example: "Pepperoni Pizza - Small (1 slice)", "Pepperoni Pizza - Medium (1 slice)", "Pepperoni Pizza - Large (1 slice)", "Pepperoni Pizza - XL (1 slice)"
   - For drinks: extract each size separately.
     Example: "Coca-Cola - Small", "Coca-Cola - Medium", "Coca-Cola - Large"
   - For sides/combos with size options, extract each size as its own entry.
3. Use the EXACT per-serving values as listed in the source (typically per 1 slice for pizza, per 1 item for sandwiches, per container for sides).
4. If ingredients are listed anywhere in the document, include them for each item.
5. Categorize items into logical groups (e.g., "Pizza", "Sides", "Desserts", "Wings", "Beverages", "Dipping Sauces", "Pasta", "Sandwiches", "Salads", "Breakfast", etc.)

For each menu item, extract:
- name: Full descriptive name including size variant if applicable
- category: Menu category (e.g., "Pizza", "Sides", "Drinks", "Wings", "Desserts")
- serving_description: What one serving is (e.g., "1 slice", "1 piece", "1 container", "12 fl oz")
- serving_size_g: Serving size in grams (estimate if only given in oz: multiply by 28.35; if given in fl oz for drinks: multiply by 29.57)
- calories: Total calories per serving
- total_fat: Total fat in grams
- saturated_fat: Saturated fat in grams
- trans_fat: Trans fat in grams (0 if not listed)
- cholesterol: Cholesterol in milligrams
- sodium: Sodium in milligrams
- total_carbohydrates: Total carbohydrates in grams
- dietary_fiber: Dietary fiber in grams
- total_sugars: Total sugars in grams
- protein: Protein in grams
- ingredients: Full ingredients text if available, otherwise null

Return ONLY a valid JSON array of objects. No markdown, no explanation, no code fences. Just the raw JSON array.
Example format:
[
  {
    "name": "Pepperoni Pizza - Large (1 slice)",
    "category": "Pizza",
    "serving_description": "1 slice",
    "serving_size_g": 120,
    "calories": 300,
    "total_fat": 13,
    "saturated_fat": 6,
    "trans_fat": 0,
    "cholesterol": 30,
    "sodium": 680,
    "total_carbohydrates": 34,
    "dietary_fiber": 2,
    "total_sugars": 4,
    "protein": 12,
    "ingredients": null
  }
]

Extract ALL items now. Be thorough - do not skip any items or sizes.`;
}

/**
 * Sends content to Gemini and extracts structured nutrition data.
 */
async function extractWithGemini(
  chainName: string,
  buffer: Buffer,
  contentType: string
): Promise<ExtractedMenuItem[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not set in environment");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const prompt = buildExtractionPrompt(chainName);
  const pdf = isPdf(buffer, contentType);

  let result;

  if (pdf) {
    // Send PDF as inline data
    const base64Data = buffer.toString("base64");
    result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: "application/pdf",
          data: base64Data,
        },
      },
    ]);
  } else {
    // Send HTML as text content
    const htmlText = buffer.toString("utf-8");
    // Trim extremely long HTML to stay within token limits
    const trimmedHtml = htmlText.length > 500000 ? htmlText.substring(0, 500000) : htmlText;
    result = await model.generateContent([
      prompt,
      `Here is the nutrition page content:\n\n${trimmedHtml}`,
    ]);
  }

  const responseText = result.response.text();

  // Parse JSON from Gemini response - strip code fences if present
  let jsonText = responseText.trim();
  if (jsonText.startsWith("```")) {
    jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  let parsed: any[];
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    // Try to find a JSON array in the response
    const arrayMatch = jsonText.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      parsed = JSON.parse(arrayMatch[0]);
    } else {
      throw new Error(`Failed to parse Gemini response as JSON: ${(e as Error).message}\nResponse preview: ${jsonText.substring(0, 500)}`);
    }
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Gemini response is not a JSON array");
  }

  // Validate and normalize each item
  const items: ExtractedMenuItem[] = [];
  for (const raw of parsed) {
    if (!raw.name || raw.calories == null) continue;

    items.push({
      name: String(raw.name).trim(),
      category: String(raw.category || "Uncategorized").trim(),
      serving_description: String(raw.serving_description || "1 serving").trim(),
      serving_size_g: Number(raw.serving_size_g) || 100,
      calories: Number(raw.calories) || 0,
      total_fat: Number(raw.total_fat) || 0,
      saturated_fat: Number(raw.saturated_fat) || 0,
      trans_fat: Number(raw.trans_fat) || 0,
      cholesterol: Number(raw.cholesterol) || 0,
      sodium: Number(raw.sodium) || 0,
      total_carbohydrates: Number(raw.total_carbohydrates) || 0,
      dietary_fiber: Number(raw.dietary_fiber) || 0,
      total_sugars: Number(raw.total_sugars) || 0,
      protein: Number(raw.protein) || 0,
      ingredients: raw.ingredients ? String(raw.ingredients).trim() : null,
    });
  }

  return items;
}

/**
 * Slugify a string for use as an ID component.
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Import nutrition data from a URL for a given restaurant chain.
 *
 * Downloads the content, sends to Gemini for extraction, and inserts
 * all extracted items into the database.
 */
export async function importChainFromUrl(
  chainName: string,
  url: string,
  db: any,
  dependencies: {
    calculateNutriScore: typeof import("./nutrition-score").calculateNutriScore;
    detectAllergens: typeof import("./food-analysis").detectAllergens;
    detectDietaryTags: typeof import("./food-analysis").detectDietaryTags;
    generateApiKey: typeof import("../middleware/auth").generateApiKey;
    uuid: () => string;
  }
): Promise<ImportResult> {
  const result: ImportResult = {
    chain: chainName,
    url,
    itemsExtracted: 0,
    itemsInserted: 0,
    errors: [],
  };

  // Step 1: Download the content
  console.log(`Downloading content from ${url}...`);
  let buffer: Buffer;
  let contentType: string;
  try {
    const downloaded = await downloadContent(url);
    buffer = downloaded.buffer;
    contentType = downloaded.contentType;
    const sizeKb = Math.round(buffer.length / 1024);
    console.log(`Downloaded ${sizeKb} KB (${contentType})`);
  } catch (e) {
    const msg = `Failed to download ${url}: ${(e as Error).message}`;
    result.errors.push(msg);
    return result;
  }

  // Step 2: Send to Gemini for extraction
  console.log(`Sending to Gemini (${GEMINI_MODEL}) for extraction...`);
  let items: ExtractedMenuItem[];
  try {
    items = await extractWithGemini(chainName, buffer, contentType);
    result.itemsExtracted = items.length;
    console.log(`Gemini extracted ${items.length} menu items`);
  } catch (e) {
    const msg = `Gemini extraction failed: ${(e as Error).message}`;
    result.errors.push(msg);
    return result;
  }

  if (items.length === 0) {
    result.errors.push("Gemini returned zero items - the URL may not contain nutrition data");
    return result;
  }

  // Step 3: Create or update vendor
  const chainSlug = slugify(chainName);
  const vendorId = `chain-${chainSlug}`;

  const upsertVendor = db.prepare(`
    INSERT INTO vendors (id, name, type, api_key)
    VALUES (@id, @name, @type, @api_key)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      type = excluded.type
  `);

  const upsertFood = db.prepare(`
    INSERT INTO foods (id, name, brand, category, serving_size, serving_unit, source, vendor_id,
      calories, total_fat, saturated_fat, trans_fat, cholesterol, sodium,
      total_carbohydrates, dietary_fiber, total_sugars, protein,
      ingredients_text, allergens, dietary_tags, nutri_score, nutri_grade,
      updated_at)
    VALUES (@id, @name, @brand, @category, @serving_size, @serving_unit, 'vendor', @vendor_id,
      @calories, @total_fat, @saturated_fat, @trans_fat, @cholesterol, @sodium,
      @total_carbohydrates, @dietary_fiber, @total_sugars, @protein,
      @ingredients_text, @allergens, @dietary_tags, @nutri_score, @nutri_grade,
      datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      brand = excluded.brand,
      category = excluded.category,
      serving_size = excluded.serving_size,
      serving_unit = excluded.serving_unit,
      vendor_id = excluded.vendor_id,
      calories = excluded.calories,
      total_fat = excluded.total_fat,
      saturated_fat = excluded.saturated_fat,
      trans_fat = excluded.trans_fat,
      cholesterol = excluded.cholesterol,
      sodium = excluded.sodium,
      total_carbohydrates = excluded.total_carbohydrates,
      dietary_fiber = excluded.dietary_fiber,
      total_sugars = excluded.total_sugars,
      protein = excluded.protein,
      ingredients_text = excluded.ingredients_text,
      allergens = excluded.allergens,
      dietary_tags = excluded.dietary_tags,
      nutri_score = excluded.nutri_score,
      nutri_grade = excluded.nutri_grade,
      updated_at = datetime('now')
  `);

  // Step 4: Insert all items in a transaction
  const insertAll = db.transaction(() => {
    upsertVendor.run({
      id: vendorId,
      name: chainName,
      type: "restaurant",
      api_key: dependencies.generateApiKey(),
    });

    for (const item of items) {
      try {
        const itemSlug = slugify(item.name);
        const id = `chain-${chainSlug}-${itemSlug}`;

        // Calculate nutri-score (needs per-100g values)
        const servingG = item.serving_size_g > 0 ? item.serving_size_g : 100;
        const factor = 100 / servingG;

        const nutriResult = dependencies.calculateNutriScore(
          {
            calories: item.calories * factor,
            totalSugars: item.total_sugars * factor,
            saturatedFat: item.saturated_fat * factor,
            sodium: item.sodium * factor,
            dietaryFiber: item.dietary_fiber * factor,
            protein: item.protein * factor,
          },
          item.category
        );

        const allergens = item.ingredients ? dependencies.detectAllergens(item.ingredients) : [];
        const dietaryTags = dependencies.detectDietaryTags(item.ingredients || "", {
          total_carbohydrates: item.total_carbohydrates,
          protein: item.protein,
          total_fat: item.total_fat,
          total_sugars: item.total_sugars,
          dietary_fiber: item.dietary_fiber,
        });

        upsertFood.run({
          id,
          name: item.name,
          brand: chainName,
          category: item.category,
          serving_size: item.serving_size_g,
          serving_unit: "g",
          vendor_id: vendorId,
          calories: item.calories,
          total_fat: item.total_fat,
          saturated_fat: item.saturated_fat,
          trans_fat: item.trans_fat,
          cholesterol: item.cholesterol,
          sodium: item.sodium,
          total_carbohydrates: item.total_carbohydrates,
          dietary_fiber: item.dietary_fiber,
          total_sugars: item.total_sugars,
          protein: item.protein,
          ingredients_text: item.ingredients,
          allergens: allergens.length > 0 ? allergens.join(",") : null,
          dietary_tags: dietaryTags.length > 0 ? dietaryTags.join(",") : null,
          nutri_score: nutriResult.score,
          nutri_grade: nutriResult.grade,
        });

        result.itemsInserted++;
      } catch (e) {
        result.errors.push(`Failed to insert "${item.name}": ${(e as Error).message}`);
      }
    }
  });

  insertAll();

  // Rebuild FTS index
  db.exec("INSERT INTO foods_fts(foods_fts) VALUES('rebuild')");

  return result;
}
