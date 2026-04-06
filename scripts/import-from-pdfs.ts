/**
 * Restaurant Chain Nutrition PDF Importer
 *
 * Downloads official nutrition PDFs from major restaurant chains,
 * sends them to Gemini 2.5 Flash for multimodal extraction, and
 * upserts the structured nutrition data into the Culture API foods table.
 *
 * If a PDF URL returns 404 or isn't a valid PDF, falls back to Gemini
 * knowledge base extraction (same approach as scrape-chains.ts).
 *
 * Usage:
 *   GEMINI_API_KEY=xxx npx ts-node scripts/import-from-pdfs.ts
 *   GEMINI_API_KEY=xxx npx ts-node scripts/import-from-pdfs.ts mcdonalds chipotle
 */

import "dotenv/config";
import db from "../src/data/database";
import { calculateNutriScore } from "../src/services/nutrition-score";
import { calculatePersonalHealthScore } from "../src/services/health-score";
import { detectDietaryTags } from "../src/services/food-analysis";
import { generateApiKey } from "../src/middleware/auth";
import { getGeminiModel, parseGeminiJson } from "../src/services/gemini-utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ExtractedMenuItem {
  name: string;
  category: string;
  calories: number;
  totalFat: number;
  saturatedFat: number;
  sodium: number;
  totalCarbohydrates: number;
  dietaryFiber: number;
  totalSugars: number;
  protein: number;
  servingSize: number;
  servingUnit: string;
  transFat?: number;
  cholesterol?: number;
}

interface PdfChainConfig {
  name: string;
  slug: string;
  pdfUrl: string;
}

// ─── Chain Registry with PDF URLs ────────────────────────────────────────────

const PDF_CHAINS: PdfChainConfig[] = [
  {
    name: "McDonald's",
    slug: "mcdonalds",
    pdfUrl: "https://www.mcdonalds.com/content/dam/sites/usa/nfl/nutrition/McDonalds-Nutrition-Facts.pdf",
  },
  {
    name: "Chick-fil-A",
    slug: "chick-fil-a",
    pdfUrl: "https://www.chick-fil-a.com/-/media/files/nutrition-allergen-info.pdf",
  },
  {
    name: "Wendy's",
    slug: "wendys",
    pdfUrl: "https://www.wendys.com/sites/default/files/2024-01/Wendys-Nutrition-Guide.pdf",
  },
  {
    name: "Taco Bell",
    slug: "taco-bell",
    pdfUrl: "https://www.tacobell.com/nutrition/Taco-Bell-Nutrition-Guide.pdf",
  },
  {
    name: "Burger King",
    slug: "burger-king",
    pdfUrl: "https://www.bk.com/nutrition/Burger-King-Nutrition-Guide.pdf",
  },
  {
    name: "KFC",
    slug: "kfc",
    pdfUrl: "https://www.kfc.com/nutrition/KFC-Nutrition-Guide.pdf",
  },
  {
    name: "Starbucks",
    slug: "starbucks",
    pdfUrl: "https://www.starbucks.com/menu/catalog/nutrition",
  },
  {
    name: "Subway",
    slug: "subway",
    pdfUrl: "https://www.subway.com/-/media/USA/Documents/Nutrition/US_Nutrition_Values.pdf",
  },
  {
    name: "Popeyes",
    slug: "popeyes",
    pdfUrl: "https://www.popeyes.com/-/media/files/popeyes-nutrition.pdf",
  },
  {
    name: "Arby's",
    slug: "arbys",
    pdfUrl: "https://arbys.com/sites/default/files/2023-09/Arbys-Nutrition-Info.pdf",
  },
  {
    name: "Panda Express",
    slug: "panda-express",
    pdfUrl: "https://www.pandaexpress.com/nutrition",
  },
  {
    name: "Panera Bread",
    slug: "panera-bread",
    pdfUrl: "https://www.panerabread.com/-/media/panera/documents/nutrition.pdf",
  },
  {
    name: "Domino's",
    slug: "dominos",
    pdfUrl: "https://www.dominos.com/assets/derived/pdf/nutrition_guide.pdf",
  },
  {
    name: "Pizza Hut",
    slug: "pizza-hut",
    pdfUrl: "https://www.pizzahut.com/-/media/pizzahut/documents/nutritional-information.pdf",
  },
  {
    name: "Five Guys",
    slug: "five-guys",
    pdfUrl: "https://www.fiveguys.com/-/media/five-guys/nutrition.pdf",
  },
  {
    name: "Chipotle",
    slug: "chipotle",
    pdfUrl: "https://www.chipotle.com/-/media/chipotle/nutrition/ChipotleNutritionTable.pdf",
  },
  {
    name: "Sonic",
    slug: "sonic",
    pdfUrl: "https://www.sonicdrivein.com/-/media/sonic/nutrition/nutrition-guide.pdf",
  },
  {
    name: "Whataburger",
    slug: "whataburger",
    pdfUrl: "https://www.whataburger.com/nutrition/WhataburgerNutritionGuide.pdf",
  },
  {
    name: "Dunkin'",
    slug: "dunkin",
    pdfUrl: "https://www.dunkindonuts.com/content/dam/dd/pdf/nutrition.pdf",
  },
  {
    name: "Jack in the Box",
    slug: "jack-in-the-box",
    pdfUrl: "https://www.jackinthebox.com/-/media/jitb/nutrition/nutrition-guide.pdf",
  },
];

// ─── SQL Statements ──────────────────────────────────────────────────────────

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
    allergens, dietary_tags, nutri_score, nutri_grade, culture_score,
    updated_at)
  VALUES (@id, @name, @brand, @category, @serving_size, @serving_unit, 'vendor', @vendor_id,
    @calories, @total_fat, @saturated_fat, @trans_fat, @cholesterol, @sodium,
    @total_carbohydrates, @dietary_fiber, @total_sugars, @protein,
    @allergens, @dietary_tags, @nutri_score, @nutri_grade, @culture_score,
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
    allergens = excluded.allergens,
    dietary_tags = excluded.dietary_tags,
    nutri_score = excluded.nutri_score,
    nutri_grade = excluded.nutri_grade,
    culture_score = excluded.culture_score,
    updated_at = datetime('now')
`);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<\/?(td|th|tr|br|li|p|div|h[1-6])[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, " ")
    .replace(/&\w+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildFoodRecord(
  item: ExtractedMenuItem,
  chainName: string,
  chainSlug: string,
  vendorId: string
) {
  const itemSlug = slugify(item.name);
  const id = `chain-${chainSlug}-${itemSlug}`;

  // Convert per-serving values to per-100g for the database
  const servingG = item.servingSize > 0 ? item.servingSize : 100;
  const factor = 100 / servingG;

  const nutriResult = calculateNutriScore(
    {
      calories: item.calories * factor,
      totalSugars: item.totalSugars * factor,
      saturatedFat: item.saturatedFat * factor,
      sodium: item.sodium * factor,
      dietaryFiber: item.dietaryFiber * factor,
      protein: item.protein * factor,
    },
    item.category
  );

  const dietaryTags = detectDietaryTags("", {
    total_carbohydrates: item.totalCarbohydrates,
    protein: item.protein,
    total_fat: item.totalFat,
    total_sugars: item.totalSugars,
    dietary_fiber: item.dietaryFiber,
  });

  const cultureScore = calculatePersonalHealthScore(
    {
      calories: item.calories,
      protein: item.protein,
      dietary_fiber: item.dietaryFiber,
      saturated_fat: item.saturatedFat,
      sodium: item.sodium,
      total_sugars: item.totalSugars,
      total_fat: item.totalFat,
      total_carbohydrates: item.totalCarbohydrates,
      cholesterol: item.cholesterol ?? 0,
      trans_fat: item.transFat ?? 0,
    },
    null
  ).score;

  return {
    id,
    name: item.name,
    brand: chainName,
    category: item.category,
    serving_size: item.servingSize,
    serving_unit: item.servingUnit,
    vendor_id: vendorId,
    calories: item.calories * factor,
    total_fat: item.totalFat * factor,
    saturated_fat: item.saturatedFat * factor,
    trans_fat: (item.transFat ?? 0) * factor,
    cholesterol: (item.cholesterol ?? 0) * factor,
    sodium: item.sodium * factor,
    total_carbohydrates: item.totalCarbohydrates * factor,
    dietary_fiber: item.dietaryFiber * factor,
    total_sugars: item.totalSugars * factor,
    protein: item.protein * factor,
    allergens: null,
    dietary_tags: dietaryTags.length > 0 ? dietaryTags.join(",") : null,
    nutri_score: nutriResult.score,
    nutri_grade: nutriResult.grade,
    culture_score: cultureScore,
  };
}

function validateMenuItem(item: any): ExtractedMenuItem | null {
  if (!item.name || typeof item.calories !== "number") return null;

  return {
    name: String(item.name).trim(),
    category: String(item.category || "Other").trim(),
    calories: Number(item.calories) || 0,
    totalFat: Number(item.totalFat) || 0,
    saturatedFat: Number(item.saturatedFat) || 0,
    sodium: Number(item.sodium) || 0,
    totalCarbohydrates: Number(item.totalCarbohydrates) || 0,
    dietaryFiber: Number(item.dietaryFiber) || 0,
    totalSugars: Number(item.totalSugars) || 0,
    protein: Number(item.protein) || 0,
    servingSize: Number(item.servingSize) || 100,
    servingUnit: String(item.servingUnit || "g").trim(),
    transFat: Number(item.transFat) || 0,
    cholesterol: Number(item.cholesterol) || 0,
  };
}

// ─── Extraction Prompt ───────────────────────────────────────────────────────

const PDF_EXTRACTION_PROMPT = `You are a nutrition data extraction expert. This is the official published nutrition data from {CHAIN_NAME}.

CRITICAL INSTRUCTIONS:
- Extract EVERY menu item with EXACT calorie counts as published in this document
- Use ONLY the numbers in this document. Do NOT estimate or approximate. If a value is listed as 580, return 580.
- Include ALL size variations (Small, Medium, Large, etc.) as separate items
- Include sides, drinks, desserts, sauces, dressings, breakfast items, kids meals — everything listed
- If a value is not listed or is blank/dash, use 0

FIELD REQUIREMENTS:
- name: The menu item name exactly as published
- category: One of: Burgers, Chicken, Sandwiches, Wraps, Tacos, Burritos, Pizza, Pasta, Seafood, Salads, Soups, Sides, Breakfast, Desserts, Beverages, Sauces, Kids, Bowls, Platters, Appetizers, Entrees, Bakery, Smoothies, Coffee, Other
- calories: EXACT as published (per serving)
- totalFat: grams per serving
- saturatedFat: grams per serving
- sodium: milligrams per serving
- totalCarbohydrates: grams per serving
- dietaryFiber: grams per serving
- totalSugars: grams per serving
- protein: grams per serving
- cholesterol: milligrams per serving
- transFat: grams per serving
- servingSize: weight in grams (if listed; estimate from standard portions if not)
- servingUnit: "g" for food, "ml" for beverages, "oz" if that's what's published

Return a JSON array of objects. Return ONLY the JSON array, no other text.
If no extractable nutrition data is found, return an empty array [].

Example format:
[
  {
    "name": "Big Mac",
    "category": "Burgers",
    "calories": 550,
    "totalFat": 30,
    "saturatedFat": 11,
    "sodium": 1010,
    "totalCarbohydrates": 45,
    "dietaryFiber": 3,
    "totalSugars": 9,
    "protein": 25,
    "cholesterol": 80,
    "transFat": 1,
    "servingSize": 200,
    "servingUnit": "g"
  }
]`;

const KNOWLEDGE_FALLBACK_PROMPT = `You are a nutrition data extraction expert.

Using your training data, provide the COMPLETE current menu for {CHAIN_NAME} with accurate published nutrition information.

CRITICAL: Use ONLY real published nutrition values. Do NOT estimate or make up numbers.

Include ALL items: entrees, sides, drinks (all sizes: small, medium, large), desserts, sauces, breakfast items, kids meals. For drinks, list each size separately. Be comprehensive — include at least 30-50 items.

FIELD REQUIREMENTS:
- name: The menu item name
- category: One of: Burgers, Chicken, Sandwiches, Wraps, Tacos, Burritos, Pizza, Pasta, Seafood, Salads, Soups, Sides, Breakfast, Desserts, Beverages, Sauces, Kids, Bowls, Platters, Appetizers, Entrees, Bakery, Smoothies, Coffee, Other
- calories: EXACT as published (per serving)
- totalFat: grams per serving
- saturatedFat: grams per serving
- sodium: milligrams per serving
- totalCarbohydrates: grams per serving
- dietaryFiber: grams per serving
- totalSugars: grams per serving
- protein: grams per serving
- cholesterol: milligrams per serving
- transFat: grams per serving
- servingSize: weight in grams
- servingUnit: "g" for food, "ml" for beverages

Return a JSON array of objects. Return ONLY the JSON array, no other text.`;

// ─── PDF Download & Content Detection ────────────────────────────────────────

interface DownloadResult {
  type: "pdf" | "html" | "failed";
  data?: Buffer;
  html?: string;
}

async function downloadContent(url: string): Promise<DownloadResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept:
          "application/pdf,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.log(`  [error] HTTP ${response.status} for ${url}`);
      return { type: "failed" };
    }

    const contentType = response.headers.get("content-type") || "";
    const buffer = Buffer.from(await response.arrayBuffer());

    // Check if it's actually a PDF (by content-type or magic bytes)
    const isPdf =
      contentType.includes("application/pdf") ||
      buffer.slice(0, 5).toString() === "%PDF-";

    if (isPdf) {
      console.log(`  [info] Downloaded PDF (${(buffer.length / 1024).toFixed(0)} KB)`);
      return { type: "pdf", data: buffer };
    }

    // It's HTML or other text content
    const html = buffer.toString("utf-8");
    console.log(`  [info] Got HTML page (${(html.length / 1024).toFixed(0)} KB)`);
    return { type: "html", html };
  } catch (err: any) {
    console.log(`  [error] Download failed for ${url}: ${err.message}`);
    return { type: "failed" };
  }
}

// ─── Gemini Extraction (PDF multimodal) ──────────────────────────────────────

async function extractFromPdf(
  pdfBuffer: Buffer,
  chainName: string,
  model: any
): Promise<ExtractedMenuItem[]> {
  const base64 = pdfBuffer.toString("base64");
  const prompt = PDF_EXTRACTION_PROMPT.replace("{CHAIN_NAME}", chainName);

  try {
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "application/pdf",
          data: base64,
        },
      },
      prompt,
    ]);

    const responseText = result.response.text();
    const parsed = parseGeminiJson(responseText);

    if (!Array.isArray(parsed)) {
      console.log(`  [warn] Gemini did not return an array for ${chainName} PDF`);
      return [];
    }

    const valid: ExtractedMenuItem[] = [];
    for (const item of parsed) {
      const validated = validateMenuItem(item);
      if (validated) valid.push(validated);
    }

    return valid;
  } catch (err: any) {
    console.log(`  [error] Gemini PDF extraction failed for ${chainName}: ${err.message}`);
    return [];
  }
}

async function extractFromHtml(
  html: string,
  chainName: string,
  model: any
): Promise<ExtractedMenuItem[]> {
  const cleanedText = stripHtml(html);

  // If HTML is too short (JS-rendered page), treat as no content
  if (cleanedText.length < 100) {
    return [];
  }

  const truncated =
    cleanedText.length > 200_000
      ? cleanedText.slice(0, 200_000)
      : cleanedText;

  const prompt =
    PDF_EXTRACTION_PROMPT.replace("{CHAIN_NAME}", chainName) +
    "\n\nHere is the nutrition page content:\n\n" +
    truncated;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsed = parseGeminiJson(responseText);

    if (!Array.isArray(parsed)) {
      console.log(`  [warn] Gemini did not return an array for ${chainName} HTML`);
      return [];
    }

    const valid: ExtractedMenuItem[] = [];
    for (const item of parsed) {
      const validated = validateMenuItem(item);
      if (validated) valid.push(validated);
    }

    return valid;
  } catch (err: any) {
    console.log(`  [error] Gemini HTML extraction failed for ${chainName}: ${err.message}`);
    return [];
  }
}

async function extractFromKnowledge(
  chainName: string,
  model: any
): Promise<ExtractedMenuItem[]> {
  console.log(`  [info] Falling back to Gemini knowledge base for ${chainName}`);

  const prompt = KNOWLEDGE_FALLBACK_PROMPT.replace(/{CHAIN_NAME}/g, chainName);

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsed = parseGeminiJson(responseText);

    if (!Array.isArray(parsed)) {
      console.log(`  [warn] Gemini knowledge base did not return an array for ${chainName}`);
      return [];
    }

    const valid: ExtractedMenuItem[] = [];
    for (const item of parsed) {
      const validated = validateMenuItem(item);
      if (validated) valid.push(validated);
    }

    return valid;
  } catch (err: any) {
    console.log(`  [error] Gemini knowledge fallback failed for ${chainName}: ${err.message}`);
    return [];
  }
}

// ─── Main Processing ─────────────────────────────────────────────────────────

async function processChain(chain: PdfChainConfig, model: any): Promise<number> {
  console.log(`\nProcessing ${chain.name} (${chain.pdfUrl})...`);

  // Ensure vendor exists
  const vendorId = `vendor-${chain.slug}`;
  try {
    upsertVendor.run({
      id: vendorId,
      name: chain.name,
      type: "restaurant",
      api_key: generateApiKey(),
    });
  } catch {
    // Vendor already exists — ON CONFLICT handles it
  }

  // Step 1: Download the PDF/page
  const download = await downloadContent(chain.pdfUrl);

  // Step 2: Extract menu items based on content type
  let items: ExtractedMenuItem[] = [];

  if (download.type === "pdf" && download.data) {
    items = await extractFromPdf(download.data, chain.name, model);

    // If PDF extraction yielded nothing, try knowledge fallback
    if (items.length === 0) {
      console.log(`  [info] PDF extraction returned 0 items, trying knowledge fallback`);
      items = await extractFromKnowledge(chain.name, model);
    }
  } else if (download.type === "html" && download.html) {
    items = await extractFromHtml(download.html, chain.name, model);

    // If HTML extraction yielded nothing (JS-rendered), try knowledge fallback
    if (items.length === 0) {
      items = await extractFromKnowledge(chain.name, model);
    }
  } else {
    // Download failed — fall back to Gemini knowledge base
    items = await extractFromKnowledge(chain.name, model);
  }

  if (items.length === 0) {
    console.log(`  [skip] No items extracted for ${chain.name}`);
    return 0;
  }

  // Step 3: Upsert into database
  let count = 0;
  const insertMany = db.transaction(() => {
    for (const item of items) {
      try {
        const record = buildFoodRecord(item, chain.name, chain.slug, vendorId);
        upsertFood.run(record);
        count++;
      } catch (err: any) {
        console.log(`  [error] Failed to insert "${item.name}": ${err.message}`);
      }
    }
  });

  insertMany();
  console.log(`  ✓ ${chain.name}: ${count} items imported`);
  return count;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function importFromPdfs(
  chainFilter?: string[]
): Promise<{ total: number; succeeded: number; failed: string[]; itemCount: number }> {
  const model = getGeminiModel("gemini-2.5-flash");
  if (!model) {
    console.error("GEMINI_API_KEY not set. Exiting.");
    return { total: 0, succeeded: 0, failed: [], itemCount: 0 };
  }

  const chainsToProcess = chainFilter
    ? PDF_CHAINS.filter(
        (c) => chainFilter.includes(c.slug) || chainFilter.includes(c.name)
      )
    : PDF_CHAINS;

  console.log(`\n=== Importing nutrition data from ${chainsToProcess.length} restaurant chain PDFs ===\n`);

  let totalItems = 0;
  let succeeded = 0;
  const failed: string[] = [];

  // Process one at a time with pauses to avoid rate limits
  for (let i = 0; i < chainsToProcess.length; i++) {
    const chain = chainsToProcess[i];
    console.log(`--- [${i + 1}/${chainsToProcess.length}] ---`);

    try {
      const itemCount = await processChain(chain, model);

      if (itemCount > 0) {
        totalItems += itemCount;
        succeeded++;
      } else {
        failed.push(chain.name);
      }
    } catch (err: any) {
      console.log(`  [error] ${chain.name} failed: ${err.message}`);
      failed.push(chain.name);
    }

    // 5-second pause between chains (except after the last one)
    if (i < chainsToProcess.length - 1) {
      console.log("  (waiting 5s for rate limits...)");
      await sleep(5_000);
    }
  }

  console.log(`\n=== PDF Import Complete ===`);
  console.log(`  Chains processed: ${succeeded}/${chainsToProcess.length}`);
  console.log(`  Total items imported: ${totalItems}`);
  if (failed.length > 0) {
    console.log(`  Failed chains: ${failed.join(", ")}`);
  }
  console.log();

  return { total: chainsToProcess.length, succeeded, failed, itemCount: totalItems };
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  const filter = args.length > 0 ? args : undefined;

  importFromPdfs(filter)
    .then((result) => {
      process.exit(result.failed.length === result.total ? 1 : 0);
    })
    .catch((err) => {
      console.error("Fatal error:", err);
      process.exit(1);
    });
}
