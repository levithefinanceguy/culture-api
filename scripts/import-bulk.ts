import * as fs from "fs";
import * as path from "path";
import { createWriteStream, createReadStream } from "fs";
import { pipeline } from "stream/promises";
import { execSync } from "child_process";
import db from "../src/data/database";
import { detectAllergens, detectDietaryTags } from "../src/services/food-analysis";

/**
 * USDA Bulk Import Script
 *
 * Downloads the full USDA FoodData Central datasets and imports them.
 * Run manually or via cron/GitHub Actions to keep data fresh.
 *
 * Usage:
 *   npx ts-node scripts/import-bulk.ts
 *   npx ts-node scripts/import-bulk.ts --cleanup   # delete downloads after
 *
 * USDA updates these files ~quarterly.
 */

const DOWNLOAD_DIR = path.join(__dirname, "../.usda-data");
const DATASETS = [
  {
    name: "FoodData_Central_foundation_food_json",
    url: "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_json_2024-10-31.zip",
    key: "FoundationFoods",
  },
  {
    name: "FoodData_Central_sr_legacy_food_json",
    url: "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2021-10-28.zip",
    key: "SRLegacyFoods",
  },
  {
    name: "FoodData_Central_branded_food_json",
    url: "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_branded_food_json_2024-10-31.zip",
    key: "BrandedFoods",
  },
];

const NUTRIENT_MAP: Record<number, string> = {
  1008: "calories", 1004: "total_fat", 1258: "saturated_fat", 1257: "trans_fat",
  1253: "cholesterol", 1093: "sodium", 1005: "total_carbohydrates", 1079: "dietary_fiber",
  2000: "total_sugars", 1003: "protein", 1114: "vitamin_d", 1087: "calcium",
  1089: "iron", 1092: "potassium",
};

const upsert = db.prepare(`
  INSERT INTO foods (id, name, brand, category, serving_size, serving_unit, barcode, source,
    calories, total_fat, saturated_fat, trans_fat, cholesterol, sodium,
    total_carbohydrates, dietary_fiber, total_sugars, protein, vitamin_d, calcium, iron, potassium,
    ingredients_text, allergens, dietary_tags,
    updated_at)
  VALUES (@id, @name, @brand, @category, @serving_size, @serving_unit, @barcode, 'usda',
    @calories, @total_fat, @saturated_fat, @trans_fat, @cholesterol, @sodium,
    @total_carbohydrates, @dietary_fiber, @total_sugars, @protein, @vitamin_d, @calcium, @iron, @potassium,
    @ingredients_text, @allergens, @dietary_tags,
    datetime('now'))
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    brand = excluded.brand,
    category = excluded.category,
    serving_size = excluded.serving_size,
    serving_unit = excluded.serving_unit,
    barcode = excluded.barcode,
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
    vitamin_d = excluded.vitamin_d,
    calcium = excluded.calcium,
    iron = excluded.iron,
    potassium = excluded.potassium,
    ingredients_text = excluded.ingredients_text,
    allergens = excluded.allergens,
    dietary_tags = excluded.dietary_tags,
    updated_at = datetime('now')
`);

const upsertBatch = db.transaction((foods: Record<string, unknown>[]) => {
  for (const f of foods) upsert.run(f);
});

function parseFood(item: any): Record<string, unknown> {
  const n: Record<string, number> = {
    calories: 0, total_fat: 0, saturated_fat: 0, trans_fat: 0,
    cholesterol: 0, sodium: 0, total_carbohydrates: 0, dietary_fiber: 0,
    total_sugars: 0, protein: 0, vitamin_d: 0, calcium: 0, iron: 0, potassium: 0,
  };

  const nutrients = item.foodNutrients || [];
  for (const fn of nutrients) {
    const id = fn.nutrient?.id || fn.nutrientId;
    const val = fn.amount ?? fn.value ?? 0;
    const k = NUTRIENT_MAP[id];
    if (k) n[k] = Math.round(val * 10) / 10;
  }

  const ingredientsText: string | null = item.ingredients || null;
  const allergens = ingredientsText ? detectAllergens(ingredientsText) : [];
  const dietaryTags = detectDietaryTags(ingredientsText || "", n);

  return {
    id: `usda-${item.fdcId}`,
    name: item.description || "Unknown",
    brand: item.brandOwner || item.brandName || null,
    category: item.brandedFoodCategory || item.foodCategory?.description || item.foodCategory || "Uncategorized",
    serving_size: item.servingSize || 100,
    serving_unit: item.servingSizeUnit || "g",
    barcode: item.gtinUpc || null,
    ingredients_text: ingredientsText,
    allergens: allergens.length > 0 ? allergens.join(",") : null,
    dietary_tags: dietaryTags.length > 0 ? dietaryTags.join(",") : null,
    ...n,
  };
}

async function downloadFile(url: string, dest: string): Promise<void> {
  console.log(`  Downloading ${url}...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  const fileStream = createWriteStream(dest);
  await pipeline(res.body as any, fileStream);
  console.log(`  Saved to ${dest}`);
}

function unzipFile(zipPath: string, destDir: string): string[] {
  console.log(`  Unzipping ${zipPath}...`);
  execSync(`unzip -o "${zipPath}" -d "${destDir}"`, { stdio: "pipe" });
  const files = fs.readdirSync(destDir).filter((f) => f.endsWith(".json"));
  return files.map((f) => path.join(destDir, f));
}

/**
 * For large files (branded foods ~4GB), we split the JSON using
 * a line-by-line approach instead of loading it all into memory.
 * USDA JSON files have one food object per "fdcId" entry.
 */
async function processLargeJsonFile(jsonFile: string): Promise<number> {
  console.log(`  Processing large file with chunked reading...`);

  // Use a Python one-liner to extract foods as individual JSON lines (NDJSON)
  // This avoids loading the entire file into Node's memory
  const ndjsonPath = jsonFile + ".ndjson";

  if (!fs.existsSync(ndjsonPath)) {
    console.log(`  Converting to NDJSON format...`);
    execSync(
      `python3 -c "
import json, sys
with open('${jsonFile}', 'r') as f:
    data = json.load(f)
keys = ['BrandedFoods', 'FoundationFoods', 'SRLegacyFoods']
foods = None
for k in keys:
    if k in data:
        foods = data[k]
        break
if foods is None:
    foods = data if isinstance(data, list) else []
with open('${ndjsonPath}', 'w') as out:
    for item in foods:
        out.write(json.dumps(item) + '\\n')
print(f'Converted {len(foods)} items', file=sys.stderr)
"`,
      { stdio: ["pipe", "pipe", "inherit"], maxBuffer: 1024 * 1024 * 10 }
    );
  }

  // Read NDJSON line by line using readline
  const readline = require("readline");
  const rl = readline.createInterface({
    input: createReadStream(ndjsonPath, { encoding: "utf-8" }),
    crlfDelay: Infinity,
  });

  let totalImported = 0;
  let batch: Record<string, unknown>[] = [];
  const BATCH_SIZE = 5000;

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const item = JSON.parse(line);
      batch.push(parseFood(item));

      if (batch.length >= BATCH_SIZE) {
        upsertBatch(batch);
        totalImported += batch.length;
        if (totalImported % 50000 === 0) {
          console.log(`    ${totalImported} imported...`);
        }
        batch = [];
      }
    } catch {
      // Skip malformed lines
    }
  }

  if (batch.length > 0) {
    upsertBatch(batch);
    totalImported += batch.length;
  }

  // Cleanup NDJSON
  fs.unlinkSync(ndjsonPath);

  return totalImported;
}

function processSmallJsonFile(jsonFile: string, dataKey: string): number {
  const raw = fs.readFileSync(jsonFile, "utf-8");
  const data = JSON.parse(raw);
  const foods: any[] = data[dataKey] || data.FoundationFoods || data.SRLegacyFoods || data.BrandedFoods || data;

  if (!Array.isArray(foods)) return 0;

  let totalImported = 0;
  const BATCH_SIZE = 5000;

  for (let i = 0; i < foods.length; i += BATCH_SIZE) {
    const batch = foods.slice(i, i + BATCH_SIZE).map(parseFood);
    upsertBatch(batch);
    totalImported += batch.length;
  }

  return totalImported;
}

async function processDataset(dataset: typeof DATASETS[0]): Promise<number> {
  console.log(`\nProcessing: ${dataset.name}`);

  const zipPath = path.join(DOWNLOAD_DIR, `${dataset.name}.zip`);
  const extractDir = path.join(DOWNLOAD_DIR, dataset.name);

  if (!fs.existsSync(zipPath)) {
    await downloadFile(dataset.url, zipPath);
  } else {
    console.log(`  Using cached ${zipPath}`);
  }

  fs.mkdirSync(extractDir, { recursive: true });
  const jsonFiles = unzipFile(zipPath, extractDir);

  let totalImported = 0;

  for (const jsonFile of jsonFiles) {
    const fileName = path.basename(jsonFile);
    const fileSize = fs.statSync(jsonFile).size;
    const fileSizeMB = Math.round(fileSize / 1024 / 1024);
    console.log(`  Reading ${fileName} (${fileSizeMB} MB)...`);

    let count: number;
    if (fileSize > 500 * 1024 * 1024) {
      // Files > 500MB: use chunked approach via Python + line-by-line read
      count = await processLargeJsonFile(jsonFile);
    } else {
      count = processSmallJsonFile(jsonFile, dataset.key);
    }

    totalImported += count;
    console.log(`    ${count} items imported from ${fileName}`);
  }

  return totalImported;
}

async function main() {
  console.log("=== USDA Bulk Import ===\n");

  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

  const beforeCount = (db.prepare("SELECT COUNT(*) as c FROM foods WHERE source = 'usda'").get() as any).c;
  console.log(`Current USDA foods in DB: ${beforeCount}`);

  let grandTotal = 0;
  for (const dataset of DATASETS) {
    try {
      const count = await processDataset(dataset);
      grandTotal += count;
      console.log(`  → Imported ${count} items from ${dataset.name}`);
    } catch (err: any) {
      console.error(`  ERROR processing ${dataset.name}: ${err.message}`);
    }
  }

  // Rebuild FTS index
  console.log("\nRebuilding search index...");
  db.exec("INSERT INTO foods_fts(foods_fts) VALUES('rebuild')");

  const afterCount = (db.prepare("SELECT COUNT(*) as c FROM foods WHERE source = 'usda'").get() as any).c;
  console.log(`\n=== Done! ===`);
  console.log(`Processed: ${grandTotal} items`);
  console.log(`USDA foods before: ${beforeCount}`);
  console.log(`USDA foods after: ${afterCount}`);
  console.log(`New foods added: ${afterCount - beforeCount}`);

  if (process.argv.includes("--cleanup")) {
    console.log("\nCleaning up downloaded files...");
    fs.rmSync(DOWNLOAD_DIR, { recursive: true, force: true });
    console.log("Done.");
  }
}

main();
