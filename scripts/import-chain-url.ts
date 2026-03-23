/**
 * Import restaurant chain nutrition data from a URL using Gemini AI.
 *
 * Downloads a nutrition PDF or webpage, sends it to Gemini for extraction,
 * and imports all menu items into the database.
 *
 * Usage:
 *   npx ts-node scripts/import-chain-url.ts "Papa Johns" "https://www.papajohns.com/nutrition"
 *   npx ts-node scripts/import-chain-url.ts "Dominos" "https://example.com/dominos-nutrition.pdf"
 */

import "dotenv/config";
import { v4 as uuid } from "uuid";
import db from "../src/data/database";
import { calculateNutriScore } from "../src/services/nutrition-score";
import { detectAllergens, detectDietaryTags } from "../src/services/food-analysis";
import { generateApiKey } from "../src/middleware/auth";
import { importChainFromUrl } from "../src/services/chain-importer";

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error("Usage: npx ts-node scripts/import-chain-url.ts <chain-name> <url>");
    console.error("");
    console.error("Examples:");
    console.error('  npx ts-node scripts/import-chain-url.ts "Papa Johns" "https://www.papajohns.com/nutrition"');
    console.error('  npx ts-node scripts/import-chain-url.ts "Dominos" "https://cache.dominos.com/nutrition.pdf"');
    console.error('  npx ts-node scripts/import-chain-url.ts "Chipotle" "https://www.chipotle.com/nutrition-calculator"');
    process.exit(1);
  }

  const chainName = args[0];
  const url = args[1];

  console.log("=== Chain URL Nutrition Import (Gemini AI) ===\n");
  console.log(`Chain:  ${chainName}`);
  console.log(`URL:    ${url}`);
  console.log("");

  const beforeCount = (
    db.prepare("SELECT COUNT(*) as c FROM foods WHERE source = 'vendor'").get() as any
  ).c;

  const existingVendorItems = (
    db.prepare(
      "SELECT COUNT(*) as c FROM foods WHERE source = 'vendor' AND brand = ?"
    ).get(chainName) as any
  ).c;

  console.log(`Existing vendor foods in DB: ${beforeCount}`);
  console.log(`Existing ${chainName} items: ${existingVendorItems}`);
  console.log("");

  try {
    const result = await importChainFromUrl(chainName, url, db, {
      calculateNutriScore,
      detectAllergens,
      detectDietaryTags,
      generateApiKey,
      uuid,
    });

    console.log("\n=== Import Results ===");
    console.log(`Chain:           ${result.chain}`);
    console.log(`Items extracted: ${result.itemsExtracted}`);
    console.log(`Items inserted:  ${result.itemsInserted}`);

    if (result.errors.length > 0) {
      console.log(`\nErrors (${result.errors.length}):`);
      for (const err of result.errors) {
        console.log(`  - ${err}`);
      }
    }

    const afterCount = (
      db.prepare("SELECT COUNT(*) as c FROM foods WHERE source = 'vendor'").get() as any
    ).c;

    const chainItems = (
      db.prepare(
        "SELECT COUNT(*) as c FROM foods WHERE source = 'vendor' AND brand = ?"
      ).get(chainName) as any
    ).c;

    console.log(`\nVendor foods before: ${beforeCount}`);
    console.log(`Vendor foods after:  ${afterCount}`);
    console.log(`Net new items:       ${afterCount - beforeCount}`);
    console.log(`Total ${chainName} items: ${chainItems}`);

    // Show a sample of imported items
    const samples = db
      .prepare(
        "SELECT name, category, calories, serving_size FROM foods WHERE source = 'vendor' AND brand = ? ORDER BY category, name LIMIT 15"
      )
      .all(chainName) as any[];

    if (samples.length > 0) {
      console.log(`\nSample items:`);
      for (const s of samples) {
        console.log(`  [${s.category}] ${s.name} - ${s.calories} cal (${s.serving_size}g)`);
      }
      if (chainItems > 15) {
        console.log(`  ... and ${chainItems - 15} more`);
      }
    }

    console.log("\nDone!");
  } catch (e) {
    console.error(`\nFatal error: ${(e as Error).message}`);
    process.exit(1);
  }
}

main();
