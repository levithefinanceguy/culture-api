/**
 * Restaurant Chain Nutrition Importer — Web Search Grounded
 *
 * Uses Gemini 2.5 Flash with Google Search grounding to pull EXACT
 * published nutrition data from each restaurant's official website.
 *
 * This gives real-time accurate data, not approximations.
 *
 * Usage:
 *   GEMINI_API_KEY=xxx npx ts-node scripts/import-web-search.ts
 *   GEMINI_API_KEY=xxx npx ts-node scripts/import-web-search.ts mcdonalds
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import db from "../src/data/database";
import { calculateNutriScore } from "../src/services/nutrition-score";
import { detectDietaryTags } from "../src/services/food-analysis";

interface MenuItem {
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
  cholesterol: number;
  transFat: number;
  servingSize: number;
}

const CHAINS = [
  "McDonald's", "Chick-fil-A", "Wendy's", "Taco Bell", "Burger King",
  "KFC", "Popeyes", "Starbucks", "Subway", "Arby's",
  "Panda Express", "Panera Bread", "Domino's", "Pizza Hut", "Five Guys",
  "Chipotle", "Sonic", "Whataburger", "Dunkin'", "Jack in the Box",
  "Shake Shack", "In-N-Out", "Culver's", "Raising Cane's", "Wingstop",
  "Buffalo Wild Wings", "Olive Garden", "Applebee's", "Chili's", "IHOP",
  "Denny's", "Texas Roadhouse", "Cracker Barrel", "Waffle House",
  "Jersey Mike's", "Jimmy John's", "Firehouse Subs", "Qdoba",
  "Noodles & Company", "Zaxby's", "Del Taco", "El Pollo Loco",
  "Skyline Chili", "Gold Star Chili", "White Castle",
  "Papa John's", "Little Caesars", "Krispy Kreme", "Tim Hortons",
  "Dutch Bros", "Jamba", "Smoothie King", "Tropical Smoothie Cafe",
  "Red Lobster", "Outback Steakhouse", "TGI Friday's", "Red Robin",
  "Bob Evans", "P.F. Chang's", "Portillo's",
];

function slugify(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseGeminiJson(text: string): any {
  try { return JSON.parse(text); } catch {}
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) try { return JSON.parse(fenced[1].trim()); } catch {}
  const arr = text.match(/\[[\s\S]*\]/);
  if (arr) try { return JSON.parse(arr[0]); } catch {}
  return null;
}

// DB operations
const upsertVendor = db.prepare(`
  INSERT INTO vendors (id, name, type, api_key)
  VALUES (?, ?, 'restaurant', ?)
  ON CONFLICT(id) DO UPDATE SET name = excluded.name
`);

const upsertFood = db.prepare(`
  INSERT INTO foods (id, name, brand, category, serving_size, serving_unit, source, vendor_id,
    calories, total_fat, saturated_fat, trans_fat, cholesterol, sodium,
    total_carbohydrates, dietary_fiber, total_sugars, protein,
    nutri_score, nutri_grade, culture_score, dietary_tags)
  VALUES (@id, @name, @brand, @category, @serving_size, @serving_unit, 'vendor', @vendor_id,
    @calories, @total_fat, @saturated_fat, @trans_fat, @cholesterol, @sodium,
    @total_carbohydrates, @dietary_fiber, @total_sugars, @protein,
    @nutri_score, @nutri_grade, @culture_score, @dietary_tags)
  ON CONFLICT(id) DO UPDATE SET
    calories=excluded.calories, total_fat=excluded.total_fat, saturated_fat=excluded.saturated_fat,
    trans_fat=excluded.trans_fat, cholesterol=excluded.cholesterol, sodium=excluded.sodium,
    total_carbohydrates=excluded.total_carbohydrates, dietary_fiber=excluded.dietary_fiber,
    total_sugars=excluded.total_sugars, protein=excluded.protein,
    serving_size=excluded.serving_size, serving_unit=excluded.serving_unit,
    nutri_score=excluded.nutri_score, nutri_grade=excluded.nutri_grade,
    culture_score=excluded.culture_score, dietary_tags=excluded.dietary_tags,
    updated_at=datetime('now')
`);

async function importChain(chainName: string, searchModel: any, formatModel: any): Promise<number> {
  const slug = slugify(chainName);
  const vendorId = `vendor-${slug}`;

  upsertVendor.run(vendorId, chainName, `key-${slug}`);
  console.log(`Processing ${chainName}...`);

  try {
    // Step 1: Search the web for the chain's nutrition data
    const searchResult = await searchModel.generateContent(
      `Go to ${chainName}'s official nutrition calculator or nutrition page on their website. List the COMPLETE nutrition facts for every menu item including: calories, total fat (g), saturated fat (g), trans fat (g), cholesterol (mg), sodium (mg), total carbs (g), dietary fiber (g), sugars (g), protein (g), and serving weight in grams. Include ALL categories: entrees, sandwiches, burgers, sides, drinks, breakfast, desserts, salads, combos. Include all sizes (Small, Medium, Large) where applicable. List at least 30 items. Use the EXACT numbers as published — do not estimate.`
    );
    const searchText = searchResult.response.text();
    console.log(`  [search] Got ${searchText.length} chars of nutrition data`);

    if (searchText.length < 100) {
      console.log(`  [warn] Insufficient search results for ${chainName}`);
      return 0;
    }

    // Step 2: Format the search results into structured JSON
    const formatResult = await formatModel.generateContent(
      `Extract EVERY menu item from this nutrition data into a JSON array. EVERY item MUST have ALL of these fields — if a value is missing from the data, use 0, but DO NOT leave fields out:

- name (string)
- category (string: "Burgers", "Chicken", "Sides", "Drinks", "Breakfast", "Desserts", "Tacos", "Burritos", "Salads", "Other")
- calories (integer, per serving)
- totalFat (number, grams per serving) — REQUIRED, must not be 0 if the item has fat
- saturatedFat (number, grams)
- transFat (number, grams)
- cholesterol (number, mg)
- sodium (number, mg) — REQUIRED, most items have 200-2000mg
- totalCarbohydrates (number, grams) — REQUIRED, must not be 0 if item has carbs
- dietaryFiber (number, grams)
- totalSugars (number, grams)
- protein (number, grams) — REQUIRED, must not be 0 if item has protein
- servingSize (number, grams — estimate from item type if not given: burger ~200g, burrito ~200g, taco ~80g, drink ~400ml, side ~100g)

Return ONLY the JSON array. No explanation.\n\nData:\n${searchText}`
    );
    const text = formatResult.response.text();
    const items = parseGeminiJson(text) as MenuItem[] | null;

    if (!items || !Array.isArray(items) || items.length === 0) {
      console.log(`  [warn] No items extracted for ${chainName}`);
      return 0;
    }

    let count = 0;
    const insertMany = db.transaction(() => {
      for (const item of items) {
        if (!item.name || !item.calories) continue;

        const itemSlug = slugify(item.name);
        const id = `chain-${slug}-${itemSlug}`;
        const sv = item.servingSize || 100;

        // Convert per-serving to per-100g for DB storage
        const factor = sv > 0 ? 100 / sv : 1;

        const nutriResult = calculateNutriScore(
          {
            calories: item.calories * factor,
            totalSugars: (item.totalSugars || 0) * factor,
            saturatedFat: (item.saturatedFat || 0) * factor,
            sodium: (item.sodium || 0) * factor,
            dietaryFiber: (item.dietaryFiber || 0) * factor,
            protein: (item.protein || 0) * factor,
          },
          item.category
        );

        const dietaryTags = detectDietaryTags("", {
          total_carbohydrates: item.totalCarbohydrates || 0,
          protein: item.protein || 0,
          total_fat: item.totalFat || 0,
          total_sugars: item.totalSugars || 0,
          dietary_fiber: item.dietaryFiber || 0,
        });

        try {
          upsertFood.run({
            id,
            name: item.name,
            brand: chainName,
            category: item.category || "Other",
            serving_size: sv,
            serving_unit: "g",
            vendor_id: vendorId,
            calories: item.calories * factor,
            total_fat: (item.totalFat || 0) * factor,
            saturated_fat: (item.saturatedFat || 0) * factor,
            trans_fat: (item.transFat || 0) * factor,
            cholesterol: (item.cholesterol || 0) * factor,
            sodium: (item.sodium || 0) * factor,
            total_carbohydrates: (item.totalCarbohydrates || 0) * factor,
            dietary_fiber: (item.dietaryFiber || 0) * factor,
            total_sugars: (item.totalSugars || 0) * factor,
            protein: (item.protein || 0) * factor,
            nutri_score: nutriResult.score,
            nutri_grade: nutriResult.grade,
            culture_score: 0,
            dietary_tags: dietaryTags.length > 0 ? dietaryTags.join(",") : null,
          });
          count++;
        } catch (e: any) {
          // skip duplicates
        }
      }
    });
    insertMany();

    console.log(`  ✓ ${chainName}: ${count} items imported`);
    return count;
  } catch (e: any) {
    console.log(`  [error] ${chainName}: ${e.message?.substring(0, 100)}`);
    return 0;
  }
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) { console.error("GEMINI_API_KEY required"); process.exit(1); }

  const genAI = new GoogleGenerativeAI(apiKey);
  // Search model with web grounding — finds real current data
  const searchModel = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { temperature: 0 },
    tools: [{ googleSearch: {} }],
  } as any);

  // Format model without search — converts text to structured JSON
  const formatModel = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { temperature: 0 },
  });

  // Filter chains if args provided
  const args = process.argv.slice(2).map(a => slugify(a));
  const chainsToProcess = args.length > 0
    ? CHAINS.filter(c => args.some(a => slugify(c).includes(a)))
    : CHAINS;

  console.log(`\n=== Importing ${chainsToProcess.length} chains with web search grounding ===\n`);

  let totalItems = 0;
  let success = 0;

  for (let i = 0; i < chainsToProcess.length; i++) {
    const count = await importChain(chainsToProcess[i], searchModel, formatModel);
    if (count > 0) success++;
    totalItems += count;

    // Rate limit: pause between chains
    if (i < chainsToProcess.length - 1) {
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  console.log(`\n=== Import Complete ===`);
  console.log(`  Chains: ${success}/${chainsToProcess.length}`);
  console.log(`  Items: ${totalItems}\n`);
}

main().catch(console.error);
