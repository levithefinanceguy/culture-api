/**
 * can-run-as-cron
 *
 * Automated Restaurant Chain Nutrition Scraper
 *
 * Fetches nutrition page HTML from major US restaurant chains, sends to Gemini 2.5 Flash
 * for structured extraction, and upserts results into the Culture API foods table.
 *
 * Usage:
 *   GEMINI_API_KEY=xxx npx ts-node scripts/scrape-chains.ts
 *
 * Cron usage:
 *   import { scrapeAllChains } from "./scripts/scrape-chains";
 *   await scrapeAllChains();
 */

import "dotenv/config";
import db from "../src/data/database";
import { calculateNutriScore } from "../src/services/nutrition-score";
import { calculatePersonalHealthScore } from "../src/services/health-score";
import { detectAllergens, detectDietaryTags } from "../src/services/food-analysis";
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

interface ChainConfig {
  name: string;
  url: string;
  slug: string;
}

// ─── Chain Registry ──────────────────────────────────────────────────────────

const CHAINS: ChainConfig[] = [
  // Fast Food
  { name: "McDonald's", slug: "mcdonalds", url: "https://www.mcdonalds.com/us/en-us/about-our-food/nutrition-calculator.html" },
  { name: "Burger King", slug: "burger-king", url: "https://www.bk.com/nutrition" },
  { name: "Wendy's", slug: "wendys", url: "https://www.wendys.com/nutrition" },
  { name: "Taco Bell", slug: "taco-bell", url: "https://www.tacobell.com/nutrition" },
  { name: "Chick-fil-A", slug: "chick-fil-a", url: "https://www.chick-fil-a.com/nutrition-allergens" },
  { name: "Popeyes", slug: "popeyes", url: "https://www.popeyes.com/nutrition" },
  { name: "Sonic", slug: "sonic", url: "https://www.sonicdrivein.com/nutrition" },
  { name: "Jack in the Box", slug: "jack-in-the-box", url: "https://www.jackinthebox.com/food/nutrition" },
  { name: "Whataburger", slug: "whataburger", url: "https://www.whataburger.com/nutrition" },
  { name: "KFC", slug: "kfc", url: "https://www.kfc.com/nutrition" },
  { name: "Arby's", slug: "arbys", url: "https://www.arbys.com/nutrition" },
  { name: "Hardee's", slug: "hardees", url: "https://www.hardees.com/nutrition" },
  { name: "Carl's Jr", slug: "carls-jr", url: "https://www.carlsjr.com/nutrition" },
  { name: "Raising Cane's", slug: "raising-canes", url: "https://www.raisingcanes.com/nutrition" },
  { name: "In-N-Out", slug: "in-n-out", url: "https://www.in-n-out.com/nutrition" },
  { name: "Five Guys", slug: "five-guys", url: "https://www.fiveguys.com/nutrition" },
  { name: "Culver's", slug: "culvers", url: "https://www.culvers.com/nutrition" },
  { name: "White Castle", slug: "white-castle", url: "https://www.whitecastle.com/nutrition" },
  { name: "Zaxby's", slug: "zaxbys", url: "https://www.zaxbys.com/nutrition" },
  { name: "Wingstop", slug: "wingstop", url: "https://www.wingstop.com/nutrition" },
  { name: "Del Taco", slug: "del-taco", url: "https://www.deltaco.com/nutrition" },
  { name: "El Pollo Loco", slug: "el-pollo-loco", url: "https://www.elpolloloco.com/nutrition" },
  { name: "Rally's/Checkers", slug: "checkers", url: "https://www.checkers.com/nutrition" },

  // Fast Casual
  { name: "Chipotle", slug: "chipotle", url: "https://www.chipotle.com/nutrition-calculator" },
  { name: "Panera Bread", slug: "panera-bread", url: "https://www.panerabread.com/en-us/menu/nutrition.html" },
  { name: "Shake Shack", slug: "shake-shack", url: "https://www.shakeshack.com/nutrition" },
  { name: "Firehouse Subs", slug: "firehouse-subs", url: "https://www.firehousesubs.com/nutrition" },
  { name: "Jersey Mike's", slug: "jersey-mikes", url: "https://www.jerseymikes.com/nutrition" },
  { name: "Jimmy John's", slug: "jimmy-johns", url: "https://www.jimmyjohns.com/nutrition" },
  { name: "Qdoba", slug: "qdoba", url: "https://www.qdoba.com/nutrition" },
  { name: "Noodles & Company", slug: "noodles-and-company", url: "https://www.noodles.com/nutrition" },
  { name: "Cava", slug: "cava", url: "https://www.cava.com/nutrition" },
  { name: "Sweetgreen", slug: "sweetgreen", url: "https://www.sweetgreen.com/nutrition" },
  { name: "McAlister's", slug: "mcalisters", url: "https://www.mcalistersdeli.com/nutrition" },
  { name: "Jason's Deli", slug: "jasons-deli", url: "https://www.jasonsdeli.com/nutrition" },
  { name: "Wawa", slug: "wawa", url: "https://www.wawa.com/nutrition" },
  { name: "Portillo's", slug: "portillos", url: "https://www.portillos.com/nutrition" },
  { name: "Moe's", slug: "moes", url: "https://www.moes.com/nutrition" },

  // Pizza
  { name: "Domino's", slug: "dominos", url: "https://www.dominos.com/nutrition" },
  { name: "Pizza Hut", slug: "pizza-hut", url: "https://www.pizzahut.com/nutrition" },
  { name: "Papa John's", slug: "papa-johns", url: "https://www.papajohns.com/nutrition" },
  { name: "Little Caesars", slug: "little-caesars", url: "https://www.littlecaesars.com/nutrition" },
  { name: "Marco's Pizza", slug: "marcos-pizza", url: "https://www.marcos.com/nutrition" },

  // Coffee/Bakery
  { name: "Starbucks", slug: "starbucks", url: "https://www.starbucks.com/menu/nutrition" },
  { name: "Dunkin'", slug: "dunkin", url: "https://www.dunkindonuts.com/en/menu/nutrition" },
  { name: "Dutch Bros", slug: "dutch-bros", url: "https://www.dutchbros.com/nutrition" },
  { name: "Krispy Kreme", slug: "krispy-kreme", url: "https://www.krispykreme.com/nutrition" },
  { name: "Tim Hortons", slug: "tim-hortons", url: "https://www.timhortons.com/nutrition" },

  // Casual Dining
  { name: "Olive Garden", slug: "olive-garden", url: "https://www.olivegarden.com/nutrition" },
  { name: "Applebee's", slug: "applebees", url: "https://www.applebees.com/en/nutrition" },
  { name: "Chili's", slug: "chilis", url: "https://www.chilis.com/nutrition" },
  { name: "IHOP", slug: "ihop", url: "https://www.ihop.com/nutrition" },
  { name: "Denny's", slug: "dennys", url: "https://www.dennys.com/nutrition" },
  { name: "Texas Roadhouse", slug: "texas-roadhouse", url: "https://www.texasroadhouse.com/nutrition" },
  { name: "Outback", slug: "outback", url: "https://www.outback.com/nutrition" },
  { name: "Red Lobster", slug: "red-lobster", url: "https://www.redlobster.com/nutrition" },
  { name: "Cracker Barrel", slug: "cracker-barrel", url: "https://www.crackerbarrel.com/nutrition" },
  { name: "Waffle House", slug: "waffle-house", url: "https://www.wafflehouse.com/nutrition" },
  { name: "Buffalo Wild Wings", slug: "buffalo-wild-wings", url: "https://www.buffalowildwings.com/nutrition" },
  { name: "TGI Friday's", slug: "tgi-fridays", url: "https://www.tgifridays.com/nutrition" },
  { name: "Red Robin", slug: "red-robin", url: "https://www.redrobin.com/nutrition" },
  { name: "Bob Evans", slug: "bob-evans", url: "https://www.bobevans.com/nutrition" },
  { name: "Golden Corral", slug: "golden-corral", url: "https://www.goldencorral.com/nutrition" },
  { name: "Panda Express", slug: "panda-express", url: "https://www.pandaexpress.com/nutrition" },
  { name: "P.F. Chang's", slug: "pf-changs", url: "https://www.pfchangs.com/nutrition" },

  // Regional
  { name: "Skyline Chili", slug: "skyline-chili", url: "https://www.skylinechili.com/nutrition" },
  { name: "Gold Star Chili", slug: "gold-star-chili", url: "https://www.goldstarchili.com/nutrition" },
  { name: "Tropical Smoothie", slug: "tropical-smoothie", url: "https://www.tropicalsmoothiecafe.com/nutrition" },
  { name: "Jamba", slug: "jamba", url: "https://www.jamba.com/nutrition" },
  { name: "Smoothie King", slug: "smoothie-king", url: "https://www.smoothieking.com/nutrition" },
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

/**
 * Strip HTML tags, scripts, styles, and compress whitespace to reduce token usage.
 * Keeps text content that Gemini needs to extract nutrition data from.
 */
function stripHtml(html: string): string {
  return html
    // Remove script and style blocks entirely
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    // Remove HTML comments
    .replace(/<!--[\s\S]*?-->/g, "")
    // Remove SVG blocks
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    // Convert table cells and breaks to spaces
    .replace(/<\/?(td|th|tr|br|li|p|div|h[1-6])[^>]*>/gi, " ")
    // Remove remaining HTML tags
    .replace(/<[^>]+>/g, " ")
    // Decode common HTML entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, " ")
    .replace(/&\w+;/g, " ")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Truncate text to a maximum character length (Gemini has context limits).
 * Aim for ~200k chars which is well within Gemini 2.5 Flash's 1M token window.
 */
function truncateForGemini(text: string, maxChars: number = 200_000): string {
  if (text.length <= maxChars) return text;
  console.log(`  [warn] HTML text truncated from ${text.length} to ${maxChars} chars`);
  return text.slice(0, maxChars);
}

function buildFoodRecord(item: ScrapedMenuItem, chainName: string, chainSlug: string, vendorId: string) {
  const itemSlug = slugify(item.name);
  const id = `chain-${chainSlug}-${itemSlug}`;

  const servingG = item.servingUnit === "g" ? item.servingSize : item.servingSize;
  const factor = servingG > 0 ? 100 / servingG : 1;

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
    // Store per-100g (the foods table standard) — Gemini returns per-item values
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

// ─── Gemini Extraction ───────────────────────────────────────────────────────

const EXTRACTION_PROMPT = `You are a nutrition data extraction expert. Extract EVERY menu item from this restaurant's nutrition page.

RULES:
- Include ALL size variations as separate items (e.g., "Small Fries", "Medium Fries", "Large Fries")
- Include ALL customizations listed (extra cheese, add bacon, etc.) as separate items if they have different nutrition info
- Include sides, drinks, desserts, sauces, dressings — everything listed on the page
- Calories and nutrition must match EXACTLY what the restaurant publishes — do NOT estimate or round
- If a value is not listed, use 0
- servingSize should be the ACTUAL item weight/volume, not per 100g
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

    const html = await response.text();
    return html;
  } catch (err: any) {
    console.log(`  [error] Fetch failed for ${url}: ${err.message}`);
    return null;
  }
}

async function extractMenuItems(
  html: string,
  chainName: string,
  model: any
): Promise<ScrapedMenuItem[]> {
  const cleanedText = truncateForGemini(stripHtml(html));

  const useKnowledge = cleanedText.length < 100;
  if (useKnowledge) {
    console.log(`  [info] Page JS-rendered for ${chainName} — using Gemini knowledge base`);
  }

  try {
    const prompt = useKnowledge
      ? EXTRACTION_PROMPT + `\n\nRestaurant: ${chainName}\n\nThe website could not be scraped. Using your training data, provide the COMPLETE current menu for ${chainName} with accurate published nutrition information. Include ALL items: entrees, sides, drinks (all sizes: small, medium, large), desserts, sauces, breakfast items, kids meals. For drinks, list each size separately. Be comprehensive — include at least 30-50 items.`
      : EXTRACTION_PROMPT + `\n\nRestaurant: ${chainName}\n\n` + cleanedText;

    const result = await model.generateContent(prompt
    );

    const responseText = result.response.text();
    const parsed = parseGeminiJson(responseText);

    if (!Array.isArray(parsed)) {
      console.log(`  [warn] Gemini did not return an array for ${chainName}`);
      return [];
    }

    // Validate and clean each item
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
    console.log(`  [error] Gemini extraction failed for ${chainName}: ${err.message}`);
    return [];
  }
}

// ─── Main Scraper ────────────────────────────────────────────────────────────

async function processChain(chain: ChainConfig, model: any): Promise<number> {
  console.log(`Processing ${chain.name}...`);

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
    // Vendor already exists with different api_key — that's fine, ON CONFLICT handles it
  }

  // Fetch nutrition page
  const html = await fetchNutritionPage(chain.url);
  if (!html) {
    console.log(`  [skip] Could not fetch ${chain.name}`);
    return 0;
  }

  // Extract menu items via Gemini
  const items = await extractMenuItems(html, chain.name, model);
  if (items.length === 0) {
    console.log(`  [skip] No items extracted for ${chain.name}`);
    return 0;
  }

  // Upsert into database
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
  console.log(`  ${chain.name}: ${count} items found and inserted`);
  return count;
}

export async function scrapeAllChains(
  chainFilter?: string[]
): Promise<{ total: number; succeeded: number; failed: string[]; itemCount: number }> {
  const model = getGeminiModel("gemini-2.5-flash");
  if (!model) {
    console.error("GEMINI_API_KEY not set. Exiting.");
    return { total: 0, succeeded: 0, failed: [], itemCount: 0 };
  }

  const chainsToProcess = chainFilter
    ? CHAINS.filter((c) => chainFilter.includes(c.slug) || chainFilter.includes(c.name))
    : CHAINS;

  console.log(`\n=== Scraping ${chainsToProcess.length} restaurant chains ===\n`);

  const BATCH_SIZE = 5;
  let totalItems = 0;
  let succeeded = 0;
  const failed: string[] = [];

  for (let i = 0; i < chainsToProcess.length; i += BATCH_SIZE) {
    const batch = chainsToProcess.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(chainsToProcess.length / BATCH_SIZE);
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
      } else {
        failed.push(chain.name);
        if (result.status === "rejected") {
          console.log(`  [error] ${chain.name} batch error: ${result.reason}`);
        }
      }
    }

    // Rate limit pause between batches (except after the last batch)
    if (i + BATCH_SIZE < chainsToProcess.length) {
      console.log("  (waiting 5s between batches for rate limits...)\n");
      await sleep(5_000);
    }
  }

  console.log(`\n=== Scrape Complete ===`);
  console.log(`  Chains processed: ${succeeded}/${chainsToProcess.length}`);
  console.log(`  Total items inserted: ${totalItems}`);
  if (failed.length > 0) {
    console.log(`  Failed chains: ${failed.join(", ")}`);
  }
  console.log();

  return { total: chainsToProcess.length, succeeded, failed, itemCount: totalItems };
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

if (require.main === module) {
  // Allow passing specific chain slugs as CLI args: npx ts-node scripts/scrape-chains.ts mcdonalds chipotle
  const args = process.argv.slice(2);
  const filter = args.length > 0 ? args : undefined;

  scrapeAllChains(filter)
    .then((result) => {
      process.exit(result.failed.length === result.total ? 1 : 0);
    })
    .catch((err) => {
      console.error("Fatal error:", err);
      process.exit(1);
    });
}
