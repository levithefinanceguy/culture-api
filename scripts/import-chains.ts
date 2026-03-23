/**
 * Restaurant Chain Nutrition Data Import
 *
 * Imports manually curated nutrition data for major US restaurant chains.
 * FDA requires chains with 20+ locations to publish nutrition information.
 *
 * Usage:
 *   npx ts-node scripts/import-chains.ts
 */

import { v4 as uuidv4 } from "uuid";
import db from "../src/data/database";
import { getAllChainData, ChainMenuItem } from "../src/services/chain-scraper";
import { calculateNutriScore } from "../src/services/nutrition-score";
import { detectAllergens, detectDietaryTags } from "../src/services/food-analysis";
import { generateApiKey } from "../src/middleware/auth";

// Upsert vendor record
const upsertVendor = db.prepare(`
  INSERT INTO vendors (id, name, type, api_key)
  VALUES (@id, @name, @type, @api_key)
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    type = excluded.type
`);

// Upsert food record
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

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildFoodRecord(item: ChainMenuItem, chainName: string, vendorId: string) {
  const chainSlug = slugify(chainName);
  const itemSlug = slugify(item.name);
  const id = `chain-${chainSlug}-${itemSlug}`;

  // Calculate nutri-score (needs per-100g values)
  const servingG = item.serving_unit === "g" ? item.serving_size : item.serving_size * 1; // ml ~ g approximation
  const factor = servingG > 0 ? 100 / servingG : 1;

  const nutriResult = calculateNutriScore(
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

  const ingredientsText = item.ingredients_text || null;
  const allergens = ingredientsText ? detectAllergens(ingredientsText) : [];
  const dietaryTags = detectDietaryTags(ingredientsText || "", {
    total_carbohydrates: item.total_carbohydrates,
    protein: item.protein,
    total_fat: item.total_fat,
    total_sugars: item.total_sugars,
    dietary_fiber: item.dietary_fiber,
  });

  return {
    id,
    name: item.name,
    brand: chainName,
    category: item.category,
    serving_size: item.serving_size,
    serving_unit: item.serving_unit,
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
    ingredients_text: ingredientsText,
    allergens: allergens.length > 0 ? allergens.join(",") : null,
    dietary_tags: dietaryTags.length > 0 ? dietaryTags.join(",") : null,
    nutri_score: nutriResult.score,
    nutri_grade: nutriResult.grade,
  };
}

function main() {
  console.log("=== Restaurant Chain Nutrition Import ===\n");

  const chains = getAllChainData();
  let totalItems = 0;
  let totalChains = 0;

  const beforeCount = (
    db.prepare("SELECT COUNT(*) as c FROM foods WHERE source = 'vendor'").get() as any
  ).c;

  const importAll = db.transaction(() => {
    for (const chain of chains) {
      const chainSlug = slugify(chain.chain);
      const vendorId = `chain-${chainSlug}`;

      // Create vendor record
      upsertVendor.run({
        id: vendorId,
        name: chain.chain,
        type: "restaurant",
        api_key: generateApiKey(),
      });

      console.log(`  ${chain.chain}: ${chain.items.length} items`);

      // Import each menu item
      for (const item of chain.items) {
        const record = buildFoodRecord(item, chain.chain, vendorId);
        upsertFood.run(record);
      }

      totalItems += chain.items.length;
      totalChains++;
    }
  });

  importAll();

  // Rebuild FTS index
  console.log("\nRebuilding search index...");
  db.exec("INSERT INTO foods_fts(foods_fts) VALUES('rebuild')");

  const afterCount = (
    db.prepare("SELECT COUNT(*) as c FROM foods WHERE source = 'vendor'").get() as any
  ).c;

  console.log(`\n=== Done! ===`);
  console.log(`Chains imported: ${totalChains}`);
  console.log(`Menu items processed: ${totalItems}`);
  console.log(`Vendor foods before: ${beforeCount}`);
  console.log(`Vendor foods after: ${afterCount}`);
  console.log(`New items added: ${afterCount - beforeCount}`);
}

main();
