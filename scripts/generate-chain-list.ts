/**
 * Master Restaurant Chain List Generator
 *
 * Calls Gemini 2.5 Flash to build a comprehensive list of US restaurant chains
 * with 20+ locations that publish nutrition info. Inserts into restaurant_chains table.
 *
 * Usage:
 *   GEMINI_API_KEY=xxx npx ts-node scripts/generate-chain-list.ts
 */

import "dotenv/config";
import db from "../src/data/database";
import { getGeminiModel, parseGeminiJson } from "../src/services/gemini-utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChainEntry {
  name: string;
  domain: string;
  category: string;
  location_count?: number;
}

// ─── SQL ─────────────────────────────────────────────────────────────────────

const upsertChain = db.prepare(`
  INSERT INTO restaurant_chains (id, name, domain, nutrition_url, category, location_count, status)
  VALUES (@id, @name, @domain, @nutrition_url, @category, @location_count, 'pending')
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    domain = excluded.domain,
    nutrition_url = excluded.nutrition_url,
    category = excluded.category,
    location_count = excluded.location_count
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

// ─── Gemini Calls ────────────────────────────────────────────────────────────

const LETTER_RANGES = [
  { label: "A-F", range: "whose names start with letters A through F" },
  { label: "G-L", range: "whose names start with letters G through L" },
  { label: "M-R", range: "whose names start with letters M through R" },
  { label: "S-Z", range: "whose names start with letters S through Z" },
];

function buildPrompt(range: string): string {
  return `List every US restaurant chain with 20+ locations that publishes nutrition information, ${range}.

For each chain, provide:
- name: the official chain name
- domain: the website domain (e.g. "mcdonalds.com")
- category: one of: Fast Food, Fast Casual, Pizza, Coffee/Bakery, Casual Dining, Fine Casual, Buffet, Ice Cream/Dessert, Smoothie/Juice, Deli/Sandwich, Asian, Mexican, Chicken, Seafood, BBQ, Breakfast, Regional
- location_count: approximate number of US locations

Be comprehensive. Include regional chains, not just national ones. Include chains like hospital/university food services if they have 20+ branded locations.

Return ONLY a JSON array of objects, no other text:
[
  {
    "name": "Chain Name",
    "domain": "example.com",
    "category": "Fast Food",
    "location_count": 100
  }
]`;
}

async function fetchChainRange(
  model: any,
  range: { label: string; range: string },
  retries: number = 3
): Promise<ChainEntry[]> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Fetching chains ${range.label} (attempt ${attempt})...`);
      const result = await model.generateContent(buildPrompt(range.range));
      const responseText = result.response.text();
      const parsed = parseGeminiJson(responseText);

      if (!Array.isArray(parsed)) {
        console.log(`  [warn] Non-array response for ${range.label}, retrying...`);
        await sleep(2000 * attempt);
        continue;
      }

      const valid: ChainEntry[] = [];
      for (const item of parsed) {
        if (!item.name || !item.domain) continue;
        valid.push({
          name: String(item.name).trim(),
          domain: String(item.domain).trim().replace(/^https?:\/\//, "").replace(/\/$/, ""),
          category: String(item.category || "Other").trim(),
          location_count: Number(item.location_count) || 0,
        });
      }

      console.log(`  Found ${valid.length} chains for ${range.label}`);
      return valid;
    } catch (err: any) {
      console.log(`  [error] ${range.label} attempt ${attempt}: ${err.message}`);
      if (attempt < retries) {
        const backoff = 2000 * Math.pow(2, attempt - 1);
        console.log(`  Retrying in ${backoff / 1000}s...`);
        await sleep(backoff);
      }
    }
  }

  console.log(`  [error] Failed to fetch chains ${range.label} after ${retries} attempts`);
  return [];
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function generateChainList(): Promise<void> {
  const model = getGeminiModel("gemini-2.5-flash");
  if (!model) {
    console.error("GEMINI_API_KEY not set. Exiting.");
    process.exit(1);
  }

  const allChains: ChainEntry[] = [];

  for (const range of LETTER_RANGES) {
    const chains = await fetchChainRange(model, range);
    allChains.push(...chains);
    // Pause between calls to avoid rate limits
    await sleep(3000);
  }

  // Deduplicate by normalized name
  const seen = new Map<string, ChainEntry>();
  for (const chain of allChains) {
    const key = slugify(chain.name);
    if (!seen.has(key)) {
      seen.set(key, chain);
    }
  }

  const unique = Array.from(seen.values());
  console.log(`\nDeduplication: ${allChains.length} raw -> ${unique.length} unique chains`);

  // Insert into database
  const insertAll = db.transaction(() => {
    for (const chain of unique) {
      const slug = slugify(chain.name);
      const domain = chain.domain.replace(/^www\./, "");
      upsertChain.run({
        id: `chain-${slug}`,
        name: chain.name,
        domain: domain,
        nutrition_url: `https://www.${domain}/nutrition`,
        category: chain.category,
        location_count: chain.location_count,
      });
    }
  });

  insertAll();
  console.log(`\nInserted ${unique.length} chains into restaurant_chains table`);
  console.log(`Found ${unique.length} chains total`);
}

// ─── CLI Entry ───────────────────────────────────────────────────────────────

if (require.main === module) {
  generateChainList()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Fatal error:", err);
      process.exit(1);
    });
}

export { generateChainList };
