import * as fs from "fs";
import * as path from "path";
import { createReadStream } from "fs";
import db from "../src/data/database";
import { detectAllergens, detectDietaryTags } from "../src/services/food-analysis";

/**
 * Migration: Add allergen/dietary data to existing foods.
 *
 * 1. Adds ingredients_text, allergens, dietary_tags columns if missing
 * 2. Re-reads the cached branded foods NDJSON to extract ingredients
 * 3. Updates existing foods with allergen + dietary tag detection
 *
 * Usage:
 *   npx ts-node scripts/add-allergens.ts
 */

const NDJSON_PATH = path.join(
  __dirname,
  "../.usda-data/FoodData_Central_branded_food_json/brandedDownload.json.ndjson"
);

// Step 1: Add columns if they don't exist
function addColumnsIfNeeded() {
  const columns = db.prepare("PRAGMA table_info(foods)").all() as any[];
  const colNames = new Set(columns.map((c: any) => c.name));

  if (!colNames.has("ingredients_text")) {
    console.log("Adding column: ingredients_text");
    db.exec("ALTER TABLE foods ADD COLUMN ingredients_text TEXT");
  }
  if (!colNames.has("allergens")) {
    console.log("Adding column: allergens");
    db.exec("ALTER TABLE foods ADD COLUMN allergens TEXT");
  }
  if (!colNames.has("dietary_tags")) {
    console.log("Adding column: dietary_tags");
    db.exec("ALTER TABLE foods ADD COLUMN dietary_tags TEXT");
  }

  console.log("Schema is up to date.\n");
}

// Step 2: Process NDJSON and update existing foods
async function processNdjson() {
  if (!fs.existsSync(NDJSON_PATH)) {
    console.error(`NDJSON file not found: ${NDJSON_PATH}`);
    console.error("Run the bulk import first, or ensure the file exists.");
    process.exit(1);
  }

  const fileSize = fs.statSync(NDJSON_PATH).size;
  console.log(`Reading NDJSON (${Math.round(fileSize / 1024 / 1024)} MB)...`);

  const updateStmt = db.prepare(`
    UPDATE foods
    SET ingredients_text = @ingredients_text,
        allergens = @allergens,
        dietary_tags = @dietary_tags,
        updated_at = datetime('now')
    WHERE id = @id
  `);

  const updateBatch = db.transaction((items: any[]) => {
    for (const item of items) updateStmt.run(item);
  });

  const readline = require("readline");
  const rl = readline.createInterface({
    input: createReadStream(NDJSON_PATH, { encoding: "utf-8" }),
    crlfDelay: Infinity,
  });

  let processed = 0;
  let updated = 0;
  let batch: any[] = [];
  const BATCH_SIZE = 5000;

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const item = JSON.parse(line);
      const id = `usda-${item.fdcId}`;
      const ingredientsText: string | null = item.ingredients || null;

      if (!ingredientsText) {
        processed++;
        continue;
      }

      // Extract nutrition for dietary tag detection
      const nutrients = item.foodNutrients || [];
      const nutrition: Record<string, number> = {
        total_carbohydrates: 0,
        total_sugars: 0,
        dietary_fiber: 0,
        total_fat: 0,
        protein: 0,
      };

      const nutrientIdMap: Record<number, string> = {
        1005: "total_carbohydrates",
        2000: "total_sugars",
        1079: "dietary_fiber",
        1004: "total_fat",
        1003: "protein",
      };

      for (const fn of nutrients) {
        const nid = fn.nutrient?.id || fn.nutrientId;
        const val = fn.amount ?? fn.value ?? 0;
        const k = nutrientIdMap[nid];
        if (k) nutrition[k] = Math.round(val * 10) / 10;
      }

      const allergens = detectAllergens(ingredientsText);
      const dietaryTags = detectDietaryTags(ingredientsText, nutrition);

      batch.push({
        id,
        ingredients_text: ingredientsText,
        allergens: allergens.length > 0 ? allergens.join(",") : null,
        dietary_tags: dietaryTags.length > 0 ? dietaryTags.join(",") : null,
      });

      if (batch.length >= BATCH_SIZE) {
        updateBatch(batch);
        updated += batch.length;
        processed += batch.length;
        batch = [];
        if (updated % 50000 === 0) {
          console.log(`  ${updated} foods updated...`);
        }
      }
    } catch {
      // Skip malformed lines
    }
    processed++;
  }

  if (batch.length > 0) {
    updateBatch(batch);
    updated += batch.length;
  }

  console.log(`\nProcessed ${processed} lines, updated ${updated} foods.`);
}

// Step 3: Update non-branded foods (foundation + SR legacy) that have no ingredients
// These don't have ingredient lists but we can still set dietary tags from nutrition
function updateNutritionOnlyFoods() {
  console.log("\nUpdating dietary tags for foods without ingredients (nutrition-based only)...");

  const foods = db.prepare(
    "SELECT id, total_carbohydrates, total_sugars, dietary_fiber, total_fat, protein FROM foods WHERE ingredients_text IS NULL AND dietary_tags IS NULL"
  ).all() as any[];

  const updateStmt = db.prepare(
    "UPDATE foods SET dietary_tags = @dietary_tags, updated_at = datetime('now') WHERE id = @id"
  );

  const updateBatch = db.transaction((items: any[]) => {
    for (const item of items) updateStmt.run(item);
  });

  let batch: any[] = [];
  let count = 0;

  for (const food of foods) {
    const tags = detectDietaryTags("", {
      total_carbohydrates: food.total_carbohydrates,
      total_sugars: food.total_sugars,
      dietary_fiber: food.dietary_fiber,
      total_fat: food.total_fat,
      protein: food.protein,
    });

    if (tags.length > 0) {
      batch.push({ id: food.id, dietary_tags: tags.join(",") });
      count++;
    }

    if (batch.length >= 5000) {
      updateBatch(batch);
      batch = [];
    }
  }

  if (batch.length > 0) {
    updateBatch(batch);
  }

  console.log(`Updated ${count} foods with nutrition-based dietary tags.`);
}

async function main() {
  console.log("=== Allergen & Dietary Tag Migration ===\n");

  addColumnsIfNeeded();
  await processNdjson();
  updateNutritionOnlyFoods();

  // Show summary stats
  const totalWithIngredients = (db.prepare("SELECT COUNT(*) as c FROM foods WHERE ingredients_text IS NOT NULL").get() as any).c;
  const totalWithAllergens = (db.prepare("SELECT COUNT(*) as c FROM foods WHERE allergens IS NOT NULL").get() as any).c;
  const totalWithTags = (db.prepare("SELECT COUNT(*) as c FROM foods WHERE dietary_tags IS NOT NULL").get() as any).c;

  console.log("\n=== Migration Complete ===");
  console.log(`Foods with ingredients text: ${totalWithIngredients}`);
  console.log(`Foods with allergens detected: ${totalWithAllergens}`);
  console.log(`Foods with dietary tags: ${totalWithTags}`);
}

main();
