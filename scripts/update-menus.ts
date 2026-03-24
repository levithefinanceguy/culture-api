/**
 * Menu Update Script
 *
 * Checks restaurant chains for new menu items and imports them.
 * Uses Gemini AI to extract nutrition data from chain nutrition pages.
 *
 * Usage:
 *   npx ts-node scripts/update-menus.ts                  # Check all chains
 *   npx ts-node scripts/update-menus.ts "Taco Bell"      # Check one chain
 */

import "dotenv/config";
import {
  updateChainMenu,
  updateAllChainMenus,
  getRegisteredChains,
  CHAIN_URLS,
} from "../src/services/menu-updater";

async function main() {
  const args = process.argv.slice(2);
  const targetChain = args[0] || null;

  console.log("=== Restaurant Chain Menu Update ===\n");

  if (targetChain) {
    // Single chain mode
    if (!CHAIN_URLS[targetChain]) {
      console.error(`Unknown chain: "${targetChain}"`);
      console.error(`Registered chains: ${getRegisteredChains().join(", ")}`);
      process.exit(1);
    }

    console.log(`Checking: ${targetChain}`);
    console.log(`URL: ${CHAIN_URLS[targetChain]}\n`);

    const result = await updateChainMenu(targetChain);

    console.log(`\n=== Results for ${result.chain} ===`);
    console.log(`  Existing items in DB: ${result.existingCount}`);
    console.log(`  Items extracted:      ${result.extractedCount}`);
    console.log(`  New items found:      ${result.newItemCount}`);

    if (result.errors.length > 0) {
      console.log(`\n  Errors (${result.errors.length}):`);
      for (const err of result.errors) {
        console.log(`    - ${err}`);
      }
    }
  } else {
    // All chains mode
    const chains = getRegisteredChains();
    console.log(`Checking ${chains.length} chains: ${chains.join(", ")}\n`);

    const results = await updateAllChainMenus();

    console.log("\n=== Summary ===\n");

    let totalNew = 0;
    let totalExtracted = 0;
    let totalErrors = 0;

    for (const result of results) {
      const status = result.errors.length > 0 ? " [ERRORS]" : "";
      console.log(
        `  ${result.chain}: ${result.newItemCount} new items (${result.extractedCount} extracted, ${result.existingCount} existing)${status}`
      );
      totalNew += result.newItemCount;
      totalExtracted += result.extractedCount;
      totalErrors += result.errors.length;
    }

    console.log(`\n  Total new items:   ${totalNew}`);
    console.log(`  Total extracted:   ${totalExtracted}`);
    console.log(`  Total errors:      ${totalErrors}`);

    if (totalErrors > 0) {
      console.log("\n=== Errors ===\n");
      for (const result of results) {
        if (result.errors.length > 0) {
          console.log(`  ${result.chain}:`);
          for (const err of result.errors) {
            console.log(`    - ${err}`);
          }
        }
      }
    }
  }

  console.log("\nDone!");
}

main().catch((e) => {
  console.error(`Fatal error: ${(e as Error).message}`);
  process.exit(1);
});
