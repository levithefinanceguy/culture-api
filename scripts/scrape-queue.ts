/**
 * Queue-Based Restaurant Chain Nutrition Scraper
 *
 * Reads chains from the restaurant_chains table (pending or stale),
 * scrapes nutrition data via Gemini, and upserts into the foods table.
 *
 * Usage:
 *   GEMINI_API_KEY=xxx npx ts-node scripts/scrape-queue.ts
 *   GEMINI_API_KEY=xxx npx ts-node scripts/scrape-queue.ts --limit 50
 */

import "dotenv/config";
import db from "../src/data/database";
import { calculateNutriScore } from "../src/services/nutrition-score";
import { calculatePersonalHealthScore } from "../src/services/health-score";
import { detectDietaryTags } from "../src/services/food-analysis";
import { generateApiKey } from "../src/middleware/auth";
import { getGeminiModel, parseGeminiJson } from "../src/services/gemini-utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ScrapedMenuItem {
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

interface ChainRow {
  id: string;
  name: string;
  domain: string;
  nutrition_url: string;
  category: string;
  status: string;
}

// ─── SQL Statements ──────────────────────────────────────────────────────────

const getQueuedChains = db.prepare(`
  SELECT id, name, domain, nutrition_url, category, status
  FROM restaurant_chains
  WHERE status = 'pending'
     OR status = 'error'
     OR (status = 'done' AND last_scraped < datetime('now', '-30 days'))
  ORDER BY
    CASE status WHEN 'pending' THEN 0 WHEN 'error' THEN 1 ELSE 2 END,
    last_scraped ASC NULLS FIRST
  LIMIT ?
`);

const updateChainDone = db.prepare(`
  UPDATE restaurant_chains
  SET status = 'done', last_scraped = datetime('now'), item_count = ?, error_message = NULL
  WHERE id = ?
`);

const updateChainError = db.prepare(`
  UPDATE restaurant_chains
  SET status = 'error', error_message = ?, last_scraped = datetime('now')
  WHERE id = ?
`);

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

function truncateForGemini(text: string, maxChars: number = 200_000): string {
  if (text.length <= maxChars) return text;
  console.log(`  [warn] HTML text truncated from ${text.length} to ${maxChars} chars`);
  return text.slice(0, maxChars);
}

// ─── Extraction ──────────────────────────────────────────────────────────────

const EXTRACTION_PROMPT = `You are a nutrition data extraction expert. Extract EVERY menu item from this restaurant's nutrition page.

RULES:
- Include ALL size variations as separate items (e.g., "Small Fries", "Medium Fries", "Large Fries")
- Include ALL customizations listed (extra cheese, add bacon, etc.) as separate items if they have different nutrition info
- Include ALL sides, ALL drinks (every size), ALL sauces, ALL dressings, ALL desserts, ALL breakfast items, ALL kids meals
- Include ALL seasonal and limited-time items if listed
- Calories and nutrition must match EXACTLY what the restaurant publishes — do NOT estimate or round
- If a value is not listed, use 0
- servingSize should be the ACTUAL item weight/volume in grams, not per 100g
- servingUnit should be "g" for food items, "ml" for beverages, or "oz" if that's what's published
- For category, use one of: Burgers, Chicken, Sandwiches, Wraps, Tacos, Burritos, Pizza, Pasta, Seafood, Salads, Soups, Sides, Breakfast, Desserts, Beverages, Sauces, Kids, Bowls, Platters, Appetizers, Entrees, Bakery, Smoothies, Coffee, Other

Return a JSON array of objects with these exact fields:
[
  {
    "name": "Item Name",
    "category": "Category",
    "calories": 0,
    "totalFat": 0,
    "saturatedFat": 0,
    "sodium": 0,
    "totalCarbohydrates": 0,
    "dietaryFiber": 0,
    "totalSugars": 0,
    "protein": 0,
    "servingSize": 0,
    "servingUnit": "g",
    "transFat": 0,
    "cholesterol": 0
  }
]

Return ONLY the JSON array, no other text. If the page contains no extractable nutrition data, return an empty array [].

Here is the restaurant's nutrition page content:
`;

async function fetchNutritionPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.log(`  [error] HTTP ${response.status} for ${url}`);
      return null;
    }

    return await response.text();
  } catch (err: any) {
    console.log(`  [error] Fetch failed for ${url}: ${err.message}`);
    return null;
  }
}

async function extractMenuItems(
  html: string | null,
  chainName: string,
  model: any,
  retries: number = 3
): Promise<ScrapedMenuItem[]> {
  const cleanedText = html ? truncateForGemini(stripHtml(html)) : "";
  const useKnowledge = cleanedText.length < 100;

  if (useKnowledge) {
    console.log(`  [info] Page JS-rendered or empty for ${chainName} — using Gemini knowledge base`);
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const prompt = useKnowledge
        ? EXTRACTION_PROMPT +
          `\n\nRestaurant: ${chainName}\n\nThe website could not be scraped. Using your training data, provide the COMPLETE current menu for ${chainName} with accurate published nutrition information. Include ALL items: entrees, sides, drinks (all sizes: small, medium, large), desserts, sauces, breakfast items, kids meals. For drinks, list each size separately. Be comprehensive — include at least 30-50 items.`
        : EXTRACTION_PROMPT + `\n\nRestaurant: ${chainName}\n\n` + cleanedText;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      const parsed = parseGeminiJson(responseText);

      if (!Array.isArray(parsed)) {
        console.log(`  [warn] Gemini did not return an array for ${chainName} (attempt ${attempt})`);
        if (attempt < retries) {
          await sleep(2000 * Math.pow(2, attempt - 1));
          continue;
        }
        return [];
      }

      const valid: ScrapedMenuItem[] = [];
      for (const item of parsed) {
        if (!item.name || typeof item.calories !== "number") continue;
        valid.push({
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
        });
      }

      return valid;
    } catch (err: any) {
      const msg = err.message || String(err);
      console.log(`  [error] Gemini extraction failed for ${chainName} (attempt ${attempt}): ${msg}`);

      // Exponential backoff for rate limits
      if (attempt < retries) {
        const backoff = 3000 * Math.pow(2, attempt - 1);
        console.log(`  Retrying in ${backoff / 1000}s...`);
        await sleep(backoff);
      }
    }
  }

  return [];
}

function buildFoodRecord(
  item: ScrapedMenuItem,
  chainName: string,
  chainSlug: string,
  vendorId: string
) {
  const itemSlug = slugify(item.name);
  const id = `chain-${chainSlug}-${itemSlug}`;

  // Convert per-item to per-100g
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
    // Store per-100g
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

// ─── Chain Processor ─────────────────────────────────────────────────────────

async function processChain(chain: ChainRow, model: any): Promise<number> {
  console.log(`Processing ${chain.name}...`);

  // Ensure vendor exists
  const chainSlug = chain.id.replace(/^chain-/, "");
  const vendorId = `vendor-${chainSlug}`;
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

  // Try fetching the nutrition page
  let html: string | null = null;
  if (chain.nutrition_url) {
    html = await fetchNutritionPage(chain.nutrition_url);
  }

  // Also try common URL patterns if the configured URL failed
  if (!html && chain.domain) {
    const alternateUrls = [
      `https://www.${chain.domain}/nutrition`,
      `https://www.${chain.domain}/menu/nutrition`,
      `https://${chain.domain}/nutrition`,
    ];
    for (const url of alternateUrls) {
      if (url === chain.nutrition_url) continue;
      html = await fetchNutritionPage(url);
      if (html) break;
    }
  }

  // Extract menu items (falls back to Gemini knowledge if no HTML)
  const items = await extractMenuItems(html, chain.name, model);
  if (items.length === 0) {
    throw new Error(`No items extracted for ${chain.name}`);
  }

  // Upsert into foods table
  let count = 0;
  const insertMany = db.transaction(() => {
    for (const item of items) {
      try {
        const record = buildFoodRecord(item, chain.name, chainSlug, vendorId);
        upsertFood.run(record);
        count++;
      } catch (err: any) {
        console.log(`  [error] Failed to insert "${item.name}": ${err.message}`);
      }
    }
  });

  insertMany();
  console.log(`  ${chain.name}: ${count} items upserted`);
  return count;
}

// ─── Main Queue Runner ───────────────────────────────────────────────────────

export async function scrapeQueue(
  limit: number = 400
): Promise<{ processed: number; succeeded: number; failed: number; totalItems: number }> {
  const model = getGeminiModel("gemini-2.5-flash");
  if (!model) {
    console.error("GEMINI_API_KEY not set. Exiting.");
    return { processed: 0, succeeded: 0, failed: 0, totalItems: 0 };
  }

  const chains = getQueuedChains.all(limit) as ChainRow[];
  if (chains.length === 0) {
    console.log("No chains in queue to process.");
    return { processed: 0, succeeded: 0, failed: 0, totalItems: 0 };
  }

  console.log(`\n=== Processing ${chains.length} chains from queue ===\n`);

  const BATCH_SIZE = 5;
  let totalItems = 0;
  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < chains.length; i += BATCH_SIZE) {
    const batch = chains.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(chains.length / BATCH_SIZE);
    console.log(`--- Batch ${batchNum}/${totalBatches} ---`);

    const results = await Promise.allSettled(
      batch.map((chain) => processChain(chain, model))
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const chain = batch[j];

      if (result.status === "fulfilled" && result.value > 0) {
        totalItems += result.value;
        succeeded++;
        updateChainDone.run(result.value, chain.id);
      } else {
        failed++;
        const errorMsg =
          result.status === "rejected"
            ? String(result.reason?.message || result.reason)
            : "No items extracted";
        updateChainError.run(errorMsg.slice(0, 500), chain.id);
        console.log(`  [error] ${chain.name}: ${errorMsg}`);
      }
    }

    // Rate limit pause between batches
    if (i + BATCH_SIZE < chains.length) {
      console.log("  (waiting 3s between batches...)\n");
      await sleep(3_000);
    }
  }

  console.log(`\n=== Queue Run Complete ===`);
  console.log(`  Chains processed: ${succeeded + failed}`);
  console.log(`  Succeeded: ${succeeded}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total items upserted: ${totalItems}`);
  console.log();

  return { processed: succeeded + failed, succeeded, failed, totalItems };
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  let limit = 400;

  const limitIdx = args.indexOf("--limit");
  if (limitIdx !== -1 && args[limitIdx + 1]) {
    limit = parseInt(args[limitIdx + 1], 10) || 400;
  }

  scrapeQueue(limit)
    .then((result) => {
      process.exit(result.failed === result.processed && result.processed > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error("Fatal error:", err);
      process.exit(1);
    });
}
