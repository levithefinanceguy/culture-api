/**
 * Official PDF Nutrition Import Pipeline
 *
 * Downloads nutrition PDFs directly from each restaurant chain's website
 * and parses the table data programmatically. NO AI is involved in reading
 * the numbers — this is pure text extraction + regex parsing.
 *
 * Principle: Every calorie, fat, protein, and carb number comes directly
 * from the restaurant's own published PDF. If a PDF can't be downloaded
 * or parsed, that chain is SKIPPED (not estimated).
 *
 * Usage:
 *   npx ts-node scripts/import-from-official-pdfs.ts
 *   npx ts-node scripts/import-from-official-pdfs.ts --chain "Burger King"
 *   npx ts-node scripts/import-from-official-pdfs.ts --dry-run
 */

import db from "../src/data/database";
import { v4 as uuidv4 } from "uuid";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ParsedItem {
  name: string;
  category: string;
  portion_size: string;  // e.g. "1", "6 Pieces", "1 Sandwich"
  calories: number;
  total_fat: number;
  saturated_fat: number;
  trans_fat: number;
  cholesterol: number;
  sodium: number;
  total_carbohydrates: number;
  dietary_fiber: number;
  total_sugars: number;
  protein: number;
  serving_size_grams?: number;  // if the PDF provides weight in grams
}

interface ChainConfig {
  name: string;
  vendorId: string;
  pdfUrl: string;
  parser: (texts: PageTexts[]) => ParsedItem[];
}

// Each page is an array of text items with x,y positions
interface TextItem {
  text: string;
  x: number;
  y: number;
}

interface PageTexts {
  pageNum: number;
  items: TextItem[];
}

// ─── PDF Download ────────────────────────────────────────────────────────────

function downloadPDF(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const get = url.startsWith("https") ? https.get : http.get;

    const doRequest = (reqUrl: string, redirectCount: number) => {
      if (redirectCount > 5) { reject(new Error("Too many redirects")); return; }
      get(reqUrl, (response) => {
        if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          doRequest(response.headers.location, redirectCount + 1);
          return;
        }
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode} for ${reqUrl}`));
          return;
        }
        response.pipe(file);
        file.on("finish", () => { file.close(); resolve(); });
      }).on("error", reject);
    };
    doRequest(url, 0);
  });
}

// ─── PDF Text Extraction ─────────────────────────────────────────────────────

async function extractPDFTexts(pdfPath: string): Promise<PageTexts[]> {
  const PDFParser = require("pdf2json");
  return new Promise((resolve, reject) => {
    const parser = new PDFParser();
    parser.on("pdfParser_dataReady", (pdfData: any) => {
      const pages: PageTexts[] = pdfData.Pages.map((page: any, idx: number) => ({
        pageNum: idx + 1,
        items: page.Texts.map((t: any) => {
          let text: string;
          try { text = decodeURIComponent(t.R[0].T); }
          catch { text = t.R[0].T; }
          return { text, x: t.x, y: t.y };
        }),
      }));
      resolve(pages);
    });
    parser.on("pdfParser_dataError", (err: any) => reject(err));
    parser.loadPDF(pdfPath);
  });
}

// Helper: flatten all text items from all pages into a single ordered stream
function flattenTexts(pages: PageTexts[]): string[] {
  const all: string[] = [];
  for (const page of pages) {
    for (const item of page.items) {
      all.push(item.text.trim());
    }
  }
  return all;
}

// ─── Generic Table Parser ────────────────────────────────────────────────────
// Many chain PDFs use the same format: columns are
// Name | Calories | CalFromFat | TotalFat | SatFat | TransFat | Cholesterol | Sodium | TotalCarb | Fiber | Sugar | Protein
// with optional Portion Size column after Name.
//
// This parser detects section headers (all-caps categories like "BURGERS", "CHICKEN")
// and extracts rows where the pattern is: text followed by a sequence of numbers.

function parseStandardNutritionTable(
  pages: PageTexts[],
  opts: {
    hasPortionSize?: boolean;       // if true, expect portion size text after name
    hasCalFromFat?: boolean;        // if true, skip "calories from fat" column (default true)
    categoryHeaders?: RegExp;       // regex to detect section headers
    skipPatterns?: RegExp[];        // patterns for rows to skip entirely
  } = {}
): ParsedItem[] {
  const {
    hasPortionSize = false,
    hasCalFromFat = true,
    categoryHeaders = /^[A-Z][A-Z &®\-''.\/]+$/,
    skipPatterns = [],
  } = opts;

  const texts = flattenTexts(pages);
  const items: ParsedItem[] = [];
  let currentCategory = "Uncategorized";

  // Find where data starts (after the header row)
  let startIdx = 0;
  for (let i = 0; i < texts.length; i++) {
    if (texts[i] === "Protein (g)" || texts[i] === "Protein(g)") {
      startIdx = i + 1;
      break;
    }
  }

  let i = startIdx;
  while (i < texts.length) {
    const token = texts[i];

    // Skip known footer/header text
    if (/^(Nutrition|Burger King|Popeyes|Wendy|Panera|Domino|Dunkin|Five Guys|Wingstop|Buffalo|Panda|Subway)/i.test(token) && !/^(Nutrition Facts)/.test(token)) {
      // Skip to next non-header
      i++;
      // Skip repeated column headers
      while (i < texts.length && /^(Calories|Total fat|Saturated|Trans|Cholesterol|Sodium|Total Carb|Dietary|Total Sugar|Protein|Portion|Serving|\d+$)/i.test(texts[i])) {
        i++;
      }
      continue;
    }

    // Skip page numbers and repeated headers
    if (/^\d+$/.test(token) && parseInt(token) < 10) {
      // Could be a page number at start of page — check if next token is a header
      i++;
      continue;
    }

    // Detect section headers
    if (categoryHeaders.test(token) && !/^\d/.test(token)) {
      // Make sure it's not a food item by checking if next tokens are numbers
      const nextFew = texts.slice(i + 1, i + 4).join(" ");
      if (!/^\d/.test(nextFew.trim()) || token.length < 4) {
        currentCategory = token.replace(/[®™]/g, "").trim();
        i++;
        continue;
      }
    }

    // Try to parse a food row: Name [PortionSize] Calories [CalFromFat] Fat SatFat TransFat Chol Sodium Carbs Fiber Sugar Protein
    // First, collect the name (may span multiple tokens until we hit a number or portion size)
    let name = "";
    let portionSize = "";

    // Collect name tokens
    const nameTokens: string[] = [];
    let j = i;
    while (j < texts.length) {
      const t = texts[j];
      // If it's a number (possibly negative or decimal), we've reached the data columns
      if (/^[\d<\-.]+$/.test(t.replace(/,/g, ""))) break;
      // If hasPortionSize and this looks like a portion descriptor, capture it
      if (hasPortionSize && /^\d+\s*(Pieces?|pc|oz|fl oz|Each|Sandwich|Biscuit|Cup|Bowl|Slice)/i.test(t)) {
        portionSize = t;
        j++;
        break;
      }
      // Check if this is a portion size like "1" or "3 Pieces"
      if (hasPortionSize && /^\d+$/.test(t)) {
        // Could be portion size or start of numbers — peek ahead
        const next = texts[j + 1] || "";
        if (/^(Pieces?|pc|oz|Each)/i.test(next)) {
          portionSize = t + " " + next;
          j += 2;
          break;
        } else if (nameTokens.length > 0) {
          // We have a name already and this number is the start of data
          break;
        }
      }
      nameTokens.push(t);
      j++;
    }

    name = nameTokens.join(" ").replace(/[®™]+/g, "").trim();
    if (!name) { i = j + 1; continue; }

    // Skip items matching skip patterns
    if (skipPatterns.some(p => p.test(name))) { i = j + 1; continue; }

    // Now collect numeric values
    const nums: number[] = [];
    while (j < texts.length && nums.length < (hasCalFromFat ? 12 : 11)) {
      const t = texts[j].replace(/,/g, "").trim();
      if (t === "<" || t === "< 1") {
        nums.push(0);
        j++;
        // skip the "1" if it was "< 1" split across tokens
        if (t === "<" && texts[j] === "1") j++;
        continue;
      }
      if (/^[\d.\-]+$/.test(t)) {
        nums.push(parseFloat(t));
        j++;
      } else {
        break; // Hit a non-number, end of this row
      }
    }

    // We need at least: Calories, TotalFat, SatFat, TransFat, Cholesterol, Sodium, Carbs, Fiber, Sugar, Protein
    const expectedNums = hasCalFromFat ? 12 : 11;
    if (nums.length >= 10) {
      let idx = 0;
      const calories = nums[idx++];
      if (hasCalFromFat) idx++; // skip calories from fat
      const total_fat = nums[idx++];
      const saturated_fat = nums[idx++];
      const trans_fat = nums[idx++];
      const cholesterol = nums[idx++];
      const sodium = nums[idx++];
      const total_carbohydrates = nums[idx++];
      const dietary_fiber = nums[idx++];
      const total_sugars = nums[idx++];
      const protein = nums[idx++];

      if (calories > 0 && calories < 5000) {
        items.push({
          name,
          category: currentCategory,
          portion_size: portionSize || "1 item",
          calories,
          total_fat,
          saturated_fat,
          trans_fat,
          cholesterol,
          sodium,
          total_carbohydrates,
          dietary_fiber,
          total_sugars,
          protein,
        });
      }
    }

    i = j;
  }

  return items;
}

// ─── Chain-Specific Parsers ──────────────────────────────────────────────────

function parseBurgerKing(pages: PageTexts[]): ParsedItem[] {
  return parseStandardNutritionTable(pages, {
    hasPortionSize: false,
    hasCalFromFat: true,
    categoryHeaders: /^[A-Z][A-Z &®\-''\.\/]{3,}$/,
  });
}

function parsePopeyes(pages: PageTexts[]): ParsedItem[] {
  // Popeyes PDF format: Name | PortionSize | Cal | CalFromFat | Fat | SatFat | TransFat | Chol | Sodium | Carbs | Fiber | Sugar | Protein
  // PortionSize is a number or "X Pieces" — always the first value after the name.
  // We use the generic parser but consume one extra leading number as portion size.
  const texts = flattenTexts(pages);
  const items: ParsedItem[] = [];
  let currentCategory = "Uncategorized";

  let startIdx = 0;
  for (let i = 0; i < texts.length; i++) {
    if (texts[i] === "Protein (g)") { startIdx = i + 1; break; }
  }

  let i = startIdx;
  while (i < texts.length) {
    const token = texts[i];

    // Skip footer/header text
    if (/^(Popeyes|Nutrition)/i.test(token)) {
      i++;
      while (i < texts.length && /^(Calories|Total|Saturated|Trans|Cholesterol|Sodium|Dietary|Protein|Portion|\d+$|\()/i.test(texts[i])) i++;
      continue;
    }

    // Detect category headers (ALL CAPS text that isn't followed by numbers in data-row pattern)
    if (/^[A-Z][A-Z &®\-''.\/]{3,}$/.test(token)) {
      const nextTokens = texts.slice(i + 1, i + 3);
      const allNums = nextTokens.every(t => /^\d/.test(t));
      if (!allNums || nextTokens.length < 2) {
        currentCategory = token.replace(/[®™]/g, "").trim();
        i++;
        continue;
      }
    }

    // Collect name tokens (non-numeric)
    const nameTokens: string[] = [];
    let j = i;
    while (j < texts.length && !/^[\d<\-.]+$/.test(texts[j].replace(/,/g, ""))) {
      nameTokens.push(texts[j]);
      j++;
    }
    const name = nameTokens.join(" ").replace(/[®™]+/g, "").trim();
    if (!name) { i = j + 1; continue; }

    // Collect ALL numbers after the name
    const nums: number[] = [];
    while (j < texts.length && nums.length < 14) {
      const t = texts[j].replace(/,/g, "").trim();
      if (t === "<" || t === "< 1") {
        nums.push(0);
        j++;
        if (t === "<" && j < texts.length && texts[j] === "1") j++;
        continue;
      }
      if (/^[\d.\-]+$/.test(t)) {
        nums.push(parseFloat(t));
        j++;
      } else break;
    }

    // Expect: PortionCount(skip) | Cal | CalFromFat(skip) | Fat | SatFat | TransFat | Chol | Sodium | Carbs | Fiber | Sugar | Protein
    // That's 12 numbers minimum (1 portion + 11 nutrition with calFromFat)
    if (nums.length >= 12) {
      let idx = 1; // skip portion size
      const calories = nums[idx++];
      idx++; // skip cal from fat
      const total_fat = nums[idx++];
      const saturated_fat = nums[idx++];
      const trans_fat = nums[idx++];
      const cholesterol = nums[idx++];
      const sodium = nums[idx++];
      const total_carbohydrates = nums[idx++];
      const dietary_fiber = nums[idx++];
      const total_sugars = nums[idx++];
      const protein = nums[idx++];

      // Determine portion description from the first number
      const portionNum = nums[0];
      let portionSize = portionNum === 1 ? "1 item" : `${portionNum} pieces`;

      if (calories > 0 && calories < 5000) {
        items.push({
          name, category: currentCategory, portion_size: portionSize,
          calories, total_fat, saturated_fat, trans_fat, cholesterol, sodium,
          total_carbohydrates, dietary_fiber, total_sugars, protein,
        });
      }
    }

    i = j;
  }
  return items;
}

function parseWendys(pages: PageTexts[]): ParsedItem[] {
  return parseStandardNutritionTable(pages, {
    hasPortionSize: false,
    hasCalFromFat: true,
    categoryHeaders: /^[A-Z][A-Z &®\-''\.\/]{3,}$/,
  });
}

function parsePanera(pages: PageTexts[]): ParsedItem[] {
  return parseStandardNutritionTable(pages, {
    hasPortionSize: false,
    hasCalFromFat: true,
    categoryHeaders: /^[A-Z][A-Z &®\-''\.\/]{3,}$/,
  });
}

function parseDominos(pages: PageTexts[]): ParsedItem[] {
  return parseStandardNutritionTable(pages, {
    hasPortionSize: false,
    hasCalFromFat: true,
    categoryHeaders: /^[A-Z][A-Z &®\-''\.\/]{3,}$/,
  });
}

function parseDunkin(pages: PageTexts[]): ParsedItem[] {
  return parseStandardNutritionTable(pages, {
    hasPortionSize: false,
    hasCalFromFat: true,
    categoryHeaders: /^[A-Z][A-Z &®\-''\.\/]{3,}$/,
  });
}

function parseFiveGuys(pages: PageTexts[]): ParsedItem[] {
  return parseStandardNutritionTable(pages, {
    hasPortionSize: false,
    hasCalFromFat: true,
    categoryHeaders: /^[A-Z][A-Z &®\-''\.\/]{3,}$/,
  });
}

function parsePandaExpress(pages: PageTexts[]): ParsedItem[] {
  return parseStandardNutritionTable(pages, {
    hasPortionSize: false,
    hasCalFromFat: true,
    categoryHeaders: /^[A-Z][A-Z &®\-''\.\/]{3,}$/,
  });
}

function parseSubway(pages: PageTexts[]): ParsedItem[] {
  return parseStandardNutritionTable(pages, {
    hasPortionSize: false,
    hasCalFromFat: true,
    categoryHeaders: /^[A-Z][A-Z &®\-''\.\/]{3,}$/,
  });
}

function parseWingstop(pages: PageTexts[]): ParsedItem[] {
  return parseStandardNutritionTable(pages, {
    hasPortionSize: false,
    hasCalFromFat: true,
    categoryHeaders: /^[A-Z][A-Z &®\-''\.\/]{3,}$/,
  });
}

function parseBuffaloWildWings(pages: PageTexts[]): ParsedItem[] {
  return parseStandardNutritionTable(pages, {
    hasPortionSize: false,
    hasCalFromFat: true,
    categoryHeaders: /^[A-Z][A-Z &®\-''\.\/]{3,}$/,
  });
}

function parseSweetgreen(pages: PageTexts[]): ParsedItem[] {
  return parseStandardNutritionTable(pages, {
    hasPortionSize: false,
    hasCalFromFat: true,
    categoryHeaders: /^[A-Z][A-Z &®\-''\.\/]{3,}$/,
  });
}

// ─── Chain Registry ──────────────────────────────────────────────────────────

const CHAINS: ChainConfig[] = [
  {
    name: "Burger King",
    vendorId: "chain-burger-king",
    pdfUrl: "https://bk-use1-prod.sites.rbictg.com/nutrition/nutrition.pdf",
    parser: parseBurgerKing,
  },
  {
    name: "Popeyes",
    vendorId: "chain-popeyes",
    pdfUrl: "https://plk-use1-prod.sites.rbictg.com/nutrition/PLK_Nutrition.pdf",
    parser: parsePopeyes,
  },
  {
    name: "Wendy's",
    vendorId: "chain-wendys",
    pdfUrl: "https://www.wendys.com/sites/default/files/2025-02/Core%20Menu.pdf",
    parser: parseWendys,
  },
  {
    name: "Panera Bread",
    vendorId: "chain-panera-bread",
    pdfUrl: "https://www.panerabread.com/content/dam/panerabread/documents/c1-26-nutrition-guide.pdf",
    parser: parsePanera,
  },
  {
    name: "Domino's",
    vendorId: "chain-dominos",
    pdfUrl: "https://cache.dominos.com/olo/6_168_0/assets/build/market/US/_en/pdf/DominosNutritionGuide.pdf",
    parser: parseDominos,
  },
  {
    name: "Dunkin'",
    vendorId: "chain-dunkin",
    pdfUrl: "https://www.dunkindonuts.com/content/dam/dd/pdf/nutrition.pdf",
    parser: parseDunkin,
  },
  {
    name: "Five Guys",
    vendorId: "chain-five-guys",
    pdfUrl: "https://www.fiveguys.com/wp-content/uploads/2025/07/five-guys-us-nutrition-allergen-guide-english-1-final.pdf",
    parser: parseFiveGuys,
  },
  {
    name: "Panda Express",
    vendorId: "chain-panda-express",
    pdfUrl: "https://s3.amazonaws.com/PandaExpressWebsite/files/pdf/Nutrition.pdf",
    parser: parsePandaExpress,
  },
  {
    name: "Subway",
    vendorId: "chain-subway",
    pdfUrl: "https://www.subway.com/en-us/-/media/northamerica/usa/nutrition/nutritiondocuments/2026/us_nutrition_en_1-2026.pdf",
    parser: parseSubway,
  },
  {
    name: "Wingstop",
    vendorId: "chain-wingstop",
    pdfUrl: "https://s3.amazonaws.com/wingstop.com/assets/static/WSR18-0009-Corporate-NutritionalGuide-JumboWings-HR_OFFICAL.pdf",
    parser: parseWingstop,
  },
  {
    name: "Buffalo Wild Wings",
    vendorId: "chain-buffalo-wild-wings",
    pdfUrl: "https://assets.ctfassets.net/l5fkpck1mwg3/xW0KIWJCivPU5wWP72LDx/5ab6367ad5d66b40e9ba364abb45dc47/24_BWW_1464398_IS_25_AW1_Nutrition_Guide_-_FINAL.pdf",
    parser: parseBuffaloWildWings,
  },
  {
    name: "Sweetgreen",
    vendorId: "chain-sweetgreen",
    pdfUrl: "https://assets.ctfassets.net/eum7w7yri3zr/7JCDKKeRKOpMPeHN3QzWCd/b7210d1b620b50a91313cfec38228335/1.22.24_sweetgreen_Nutrition_Binder.pdf",
    parser: parseSweetgreen,
  },
];

// ─── Database Import ─────────────────────────────────────────────────────────

const upsertVendor = db.prepare(`
  INSERT INTO vendors (id, name, type)
  VALUES (@id, @name, 'restaurant')
  ON CONFLICT(id) DO UPDATE SET name = excluded.name
`);

const upsertFood = db.prepare(`
  INSERT INTO foods (id, name, brand, category, serving_size, serving_unit, source, vendor_id,
    calories, total_fat, saturated_fat, trans_fat, cholesterol, sodium,
    total_carbohydrates, dietary_fiber, total_sugars, protein,
    household_serving, updated_at)
  VALUES (@id, @name, @brand, @category, @serving_size, @serving_unit, 'vendor', @vendor_id,
    @calories, @total_fat, @saturated_fat, @trans_fat, @cholesterol, @sodium,
    @total_carbohydrates, @dietary_fiber, @total_sugars, @protein,
    @household_serving, datetime('now'))
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name, brand = excluded.brand, category = excluded.category,
    serving_size = excluded.serving_size, serving_unit = excluded.serving_unit,
    vendor_id = excluded.vendor_id,
    calories = excluded.calories, total_fat = excluded.total_fat,
    saturated_fat = excluded.saturated_fat, trans_fat = excluded.trans_fat,
    cholesterol = excluded.cholesterol, sodium = excluded.sodium,
    total_carbohydrates = excluded.total_carbohydrates,
    dietary_fiber = excluded.dietary_fiber, total_sugars = excluded.total_sugars,
    protein = excluded.protein,
    household_serving = excluded.household_serving,
    updated_at = datetime('now')
`);

function slugify(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function importChain(chain: ChainConfig, items: ParsedItem[], dryRun: boolean): number {
  if (dryRun) {
    console.log(`  [DRY RUN] Would import ${items.length} items for ${chain.name}`);
    for (const item of items.slice(0, 5)) {
      console.log(`    ${item.name}: ${item.calories} cal, ${item.protein}g protein, ${item.total_fat}g fat, ${item.total_carbohydrates}g carbs`);
    }
    if (items.length > 5) console.log(`    ... and ${items.length - 5} more`);
    return items.length;
  }

  upsertVendor.run({ id: chain.vendorId, name: chain.name });

  let count = 0;
  for (const item of items) {
    const foodId = `${chain.vendorId}-${slugify(item.name)}`;
    upsertFood.run({
      id: foodId,
      name: item.name,
      brand: chain.name,
      category: item.category,
      serving_size: item.serving_size_grams || 100, // per-serving values, weight TBD from PDF
      serving_unit: item.portion_size,
      vendor_id: chain.vendorId,
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
      household_serving: item.portion_size,
    });
    count++;
  }
  return count;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const chainFilter = args.includes("--chain")
    ? args[args.indexOf("--chain") + 1]
    : null;

  const sourcesDir = path.join(__dirname, "sources");
  if (!fs.existsSync(sourcesDir)) fs.mkdirSync(sourcesDir, { recursive: true });

  const chains = chainFilter
    ? CHAINS.filter(c => c.name.toLowerCase().includes(chainFilter.toLowerCase()))
    : CHAINS;

  if (chains.length === 0) {
    console.error(`No chains matching "${chainFilter}"`);
    process.exit(1);
  }

  console.log(`\n=== Official PDF Nutrition Import ===`);
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE IMPORT"}`);
  console.log(`Chains: ${chains.length}\n`);

  const vendorCountBefore = (db.prepare("SELECT COUNT(*) as c FROM foods WHERE source='vendor'").get() as any).c;

  let totalItems = 0;
  let successChains = 0;
  let failedChains: string[] = [];

  for (const chain of chains) {
    const pdfPath = path.join(sourcesDir, `${slugify(chain.name)}.pdf`);

    // Step 1: Download PDF
    console.log(`  ${chain.name}:`);
    try {
      console.log(`    Downloading PDF...`);
      await downloadPDF(chain.pdfUrl, pdfPath);
      const stat = fs.statSync(pdfPath);
      if (stat.size < 1000) {
        throw new Error(`PDF too small (${stat.size} bytes) — likely an error page`);
      }
      console.log(`    Downloaded: ${(stat.size / 1024).toFixed(0)} KB`);
    } catch (err: any) {
      console.log(`    FAILED to download: ${err.message}`);
      failedChains.push(chain.name);
      continue;
    }

    // Step 2: Extract text
    let pages: PageTexts[];
    try {
      pages = await extractPDFTexts(pdfPath);
      console.log(`    Extracted text from ${pages.length} pages`);
    } catch (err: any) {
      console.log(`    FAILED to parse PDF: ${err.message}`);
      failedChains.push(chain.name);
      continue;
    }

    // Step 3: Parse nutrition table
    let items: ParsedItem[];
    try {
      items = chain.parser(pages);
      console.log(`    Parsed ${items.length} menu items`);
      if (items.length === 0) {
        throw new Error("No items parsed — parser may need adjustment for this PDF format");
      }
    } catch (err: any) {
      console.log(`    FAILED to parse: ${err.message}`);
      failedChains.push(chain.name);
      continue;
    }

    // Step 4: Import
    const count = importChain(chain, items, dryRun);
    totalItems += count;
    successChains++;
    console.log(`    ✓ ${count} items ${dryRun ? "would be imported" : "imported"}`);
  }

  // Rebuild FTS
  if (!dryRun && totalItems > 0) {
    console.log("\nRebuilding search index...");
    db.exec("INSERT INTO foods_fts(foods_fts) VALUES('rebuild')");
  }

  const vendorCountAfter = dryRun
    ? vendorCountBefore
    : (db.prepare("SELECT COUNT(*) as c FROM foods WHERE source='vendor'").get() as any).c;

  console.log(`\n=== Results ===`);
  console.log(`Chains succeeded: ${successChains}/${chains.length}`);
  console.log(`Total items: ${totalItems}`);
  console.log(`Vendor foods: ${vendorCountBefore} → ${vendorCountAfter}`);
  if (failedChains.length > 0) {
    console.log(`\nFailed chains (need manual attention):`);
    for (const name of failedChains) {
      console.log(`  ✗ ${name}`);
    }
  }
  console.log("");
}

main().catch(console.error);
