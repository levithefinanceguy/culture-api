import * as fs from "fs";
import * as path from "path";
import { createReadStream } from "fs";
import db from "../src/data/database";

/**
 * Fix branded food categories.
 *
 * USDA branded foods use `brandedFoodCategory` (a plain string) instead of
 * `foodCategory.description`. The original parseFood missed this, so ~454K
 * branded foods were imported as "Uncategorized".
 *
 * Strategy:
 *   1. If the cached NDJSON file exists, re-read it and update categories
 *      directly from the source data (most accurate).
 *   2. If the raw JSON exists but no NDJSON, convert it first.
 *   3. Otherwise, there's no source data to pull from — exit with instructions.
 *
 * Usage:
 *   npx ts-node scripts/fix-categories.ts
 */

const DOWNLOAD_DIR = path.join(__dirname, "../.usda-data");
const BRANDED_DIR = path.join(DOWNLOAD_DIR, "FoodData_Central_branded_food_json");
const RAW_JSON = path.join(BRANDED_DIR, "brandedDownload.json");
const NDJSON = RAW_JSON + ".ndjson";

const updateCategory = db.prepare(`
  UPDATE foods SET category = @category, updated_at = datetime('now')
  WHERE id = @id AND category = 'Uncategorized'
`);

const updateBatch = db.transaction((rows: { id: string; category: string }[]) => {
  for (const r of rows) updateCategory.run(r);
});

async function ensureNdjson(): Promise<string> {
  if (fs.existsSync(NDJSON)) {
    console.log(`Using existing NDJSON: ${NDJSON}`);
    return NDJSON;
  }

  if (!fs.existsSync(RAW_JSON)) {
    console.error(
      `No branded food data found at:\n  ${RAW_JSON}\n  ${NDJSON}\n\n` +
        `Re-run the full import to download fresh data:\n` +
        `  npx ts-node scripts/import-bulk.ts`
    );
    process.exit(1);
  }

  console.log("Converting raw JSON to NDJSON (this may take a few minutes)...");
  const { execSync } = require("child_process");
  execSync(
    `python3 -c "
import json, sys
with open('${RAW_JSON}', 'r') as f:
    data = json.load(f)
foods = data.get('BrandedFoods', data if isinstance(data, list) else [])
with open('${NDJSON}', 'w') as out:
    for item in foods:
        out.write(json.dumps(item) + '\\n')
print(f'Converted {len(foods)} items', file=sys.stderr)
"`,
    { stdio: ["pipe", "pipe", "inherit"], maxBuffer: 1024 * 1024 * 10 }
  );

  return NDJSON;
}

async function main() {
  // Check how many are currently uncategorized
  const uncatCount = (
    db
      .prepare(
        "SELECT COUNT(*) as c FROM foods WHERE source = 'usda' AND category = 'Uncategorized'"
      )
      .get() as any
  ).c;

  console.log(`=== Fix Branded Food Categories ===\n`);
  console.log(`Uncategorized USDA foods in DB: ${uncatCount}`);

  if (uncatCount === 0) {
    console.log("Nothing to fix — no uncategorized USDA foods found.");
    return;
  }

  const ndjsonPath = await ensureNdjson();

  const readline = require("readline");
  const rl = readline.createInterface({
    input: createReadStream(ndjsonPath, { encoding: "utf-8" }),
    crlfDelay: Infinity,
  });

  let updated = 0;
  let skipped = 0;
  let batch: { id: string; category: string }[] = [];
  const BATCH_SIZE = 5000;

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const item = JSON.parse(line);
      const category = item.brandedFoodCategory;
      if (!category || category === "Uncategorized") {
        skipped++;
        continue;
      }

      batch.push({ id: `usda-${item.fdcId}`, category });

      if (batch.length >= BATCH_SIZE) {
        updateBatch(batch);
        updated += batch.length;
        if (updated % 50000 === 0) {
          console.log(`  ${updated} processed...`);
        }
        batch = [];
      }
    } catch {
      // Skip malformed lines
    }
  }

  if (batch.length > 0) {
    updateBatch(batch);
    updated += batch.length;
  }

  // Rebuild FTS index so search reflects new categories
  console.log("\nRebuilding search index...");
  db.exec("INSERT INTO foods_fts(foods_fts) VALUES('rebuild')");

  const remainingUncat = (
    db
      .prepare(
        "SELECT COUNT(*) as c FROM foods WHERE source = 'usda' AND category = 'Uncategorized'"
      )
      .get() as any
  ).c;

  console.log(`\n=== Done! ===`);
  console.log(`Rows sent for update: ${updated}`);
  console.log(`Skipped (no category in source): ${skipped}`);
  console.log(`Uncategorized before: ${uncatCount}`);
  console.log(`Uncategorized after:  ${remainingUncat}`);
  console.log(`Fixed: ${uncatCount - remainingUncat}`);
}

main();
