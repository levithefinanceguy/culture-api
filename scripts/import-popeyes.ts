/**
 * Popeyes — Official PDF Import
 * Source: https://plk-use1-prod.sites.rbictg.com/nutrition/PLK_Nutrition.pdf
 *
 * Parses Popeyes' FDA-mandated nutrition PDF directly. No AI involved.
 * Format: Name | PortionSize | Cal | CalFromFat | Fat | SatFat | TransFat | Chol | Sodium | Carbs | Fiber | Sugar | Protein
 * Portion sizes can be: "1", "3 Pieces", "6 Pieces", "8 Pieces", "Reg", "Lg"
 */

import db from "../src/data/database";

const PDFParser = require("pdf2json");

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function guessCategory(name: string): string {
  const n = name.toLowerCase();
  if (/bone-in wing|boneless wing/.test(n)) return "Wings";
  if (/tender/.test(n)) return "Tenders";
  if (/breast|thigh|leg \(|drumstick|wing \(/.test(n)) return "Chicken";
  if (/sandwich|wrap/.test(n)) return "Sandwiches";
  if (/shrimp|fish|flounder|butterfly/.test(n)) return "Seafood";
  if (/biscuit|gravy/.test(n) && /sausage|egg|bacon|chicken/.test(n)) return "Breakfast";
  if (/fries|mashed|coleslaw|corn|cajun rice|red beans|mac|green bean|cole slaw|jambalaya|biscuit|grits|hash round/.test(n)) return "Sides";
  if (/pie|sundae|cookie|cobbler|cream cheese/.test(n)) return "Desserts";
  if (/sauce|dip|ranch|mustard|bbq|buffalo|honey|sweet heat|cocktail|jalape/.test(n)) return "Sauces";
  if (/juice|tea|lemonade/.test(n)) return "Beverages";
  return "Other";
}

// Upsert vendor
db.prepare(`
  INSERT INTO vendors (id, name, type)
  VALUES ('chain-popeyes', 'Popeyes', 'restaurant')
  ON CONFLICT(id) DO UPDATE SET name = excluded.name
`).run();

// Delete existing popeyes entries to reimport clean
db.prepare("DELETE FROM foods WHERE vendor_id = 'chain-popeyes'").run();

const upsertFood = db.prepare(`
  INSERT INTO foods (id, name, brand, category, serving_size, serving_unit, source, vendor_id,
    calories, total_fat, saturated_fat, trans_fat, cholesterol, sodium,
    total_carbohydrates, dietary_fiber, total_sugars, protein,
    household_serving, updated_at)
  VALUES (@id, @name, @brand, @category, 100, @serving_unit, 'vendor', 'chain-popeyes',
    @calories, @total_fat, @saturated_fat, @trans_fat, @cholesterol, @sodium,
    @total_carbohydrates, @dietary_fiber, @total_sugars, @protein,
    @household_serving, datetime('now'))
  ON CONFLICT(id) DO UPDATE SET
    name=excluded.name, brand=excluded.brand, category=excluded.category,
    calories=excluded.calories, total_fat=excluded.total_fat, saturated_fat=excluded.saturated_fat,
    trans_fat=excluded.trans_fat, cholesterol=excluded.cholesterol, sodium=excluded.sodium,
    total_carbohydrates=excluded.total_carbohydrates, dietary_fiber=excluded.dietary_fiber,
    total_sugars=excluded.total_sugars, protein=excluded.protein,
    household_serving=excluded.household_serving, updated_at=datetime('now')
`);

const parser = new PDFParser();
parser.on("pdfParser_dataReady", (pdfData: any) => {
  const allTexts: string[] = [];
  for (const page of pdfData.Pages) {
    for (const t of page.Texts) {
      let text: string;
      try { text = decodeURIComponent(t.R[0].T); } catch { text = t.R[0].T; }
      allTexts.push(text.trim());
    }
  }

  // Find first data start
  let start = 0;
  for (let i = 0; i < allTexts.length; i++) {
    if (allTexts[i] === "Protein (g)") { start = i + 1; break; }
  }

  interface Item {
    name: string; portion: string;
    cal: number; fat: number; satFat: number; transFat: number;
    chol: number; sodium: number; carbs: number; fiber: number; sugar: number; protein: number;
  }
  const items: Item[] = [];
  let i = start;

  // Popeyes portion size tokens that appear between name and numbers
  const PORTION_TOKENS = /^(Pieces?|Reg|Lg|Each|Sandwich|Biscuit|pc)$/i;

  while (i < allTexts.length) {
    const token = allTexts[i];

    // Skip page numbers, footers, repeated headers
    if (/^\d$/.test(token)) { i++; continue; }
    if (/^(Popeyes|Nutrition Facts|JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)/i.test(token)) {
      i++;
      while (i < allTexts.length && /^(Calories|Total|Saturated|Trans|Cholesterol|Sodium|Dietary|Protein|Portion|fat|Fiber|Sugar|Carb|from|\(g\)|\(mg\)|Size| )$/i.test(allTexts[i])) i++;
      continue;
    }

    // Skip section headers (ALL CAPS, not followed by portion/numbers pattern)
    if (/^(SIGNATURE CHICKEN|TENDERS|SEAFOOD|SANDWICHES|WINGS|SIDES|DESSERTS|SAUCES|BREAKFAST|BEVERAGES)/i.test(token)) {
      i++;
      // Also skip sub-headers like "BONELESS OR BONE-IN"
      while (i < allTexts.length && /^[A-Z &\-]+$/.test(allTexts[i]) && !/^(WING|LEG|THIGH|BREAST|TENDER|CHICKEN|CAJUN|MASHED|RED|COLE|BISCUIT|BACON|EGG|SAUSAGE|GRITS|HASH|BUTTERFLY|CLASSIC|BUFFALO|GARLIC|GHOST|HONEY|LEMON|SIGNATURE|SWEET|CINNAMON|STRAWBERRY|BLACKENED|BAYOU|BOLD|BUTTERMILK|MARDI|WILD|COCKTAIL|JALAP|ORANGE)/i.test(allTexts[i])) i++;
      continue;
    }

    // Collect name: everything that's clearly text (not a number, not a portion token by itself)
    const nameTokens: string[] = [];
    let j = i;
    while (j < allTexts.length) {
      const t = allTexts[j];
      const stripped = t.replace(/,/g, "");

      // If we hit a combined portion token like "3 Pieces", "6 Pieces", "8 Pieces"
      if (/^\d+\s+(Pieces?|pc)/i.test(t) && nameTokens.length > 0) break;

      // If we hit a bare number and we already have a name, check if it's a portion count
      if (/^\d+$/.test(stripped) && nameTokens.length > 0) {
        // Peek: is the next token a portion word like "Pieces"?
        const next = allTexts[j + 1] || "";
        if (PORTION_TOKENS.test(next)) {
          break; // portion size starts here
        }
        // Is it just "1" followed by numbers? That's the portion count = 1
        if (parseInt(stripped) <= 20) {
          break; // portion count
        }
      }

      // If it's "Reg" or "Lg" standalone, it's a portion token
      if (/^(Reg|Lg)$/i.test(t) && nameTokens.length > 0) break;

      // If it looks like a decimal or negative number, we've hit data
      if (/^[\d]+\.\d+$/.test(stripped) && nameTokens.length > 0) break;

      nameTokens.push(t);
      j++;
    }

    let name = nameTokens.join(" ").replace(/[®™]+/g, "").trim();

    // Skip garbage names
    if (!name || name.length < 2 || /^Portion Size/i.test(name) || /^Calories/i.test(name) || /Nutrition Guide/i.test(name)) {
      // Advance past any numbers
      while (j < allTexts.length && /^[\d<.\-]+$/.test(allTexts[j].replace(/,/g, ""))) j++;
      // Also skip portion tokens
      while (j < allTexts.length && PORTION_TOKENS.test(allTexts[j])) j++;
      i = Math.max(j, i + 1);
      continue;
    }

    // Collect portion size
    let portion = "1 item";
    if (j < allTexts.length) {
      const t = allTexts[j];
      if (/^(Reg|Lg)$/i.test(t)) {
        portion = t === "Reg" ? "Regular" : "Large";
        j++;
      } else if (/^\d+\s+(Pieces?|pc)/i.test(t)) {
        // Combined token like "3 Pieces", "6 Pieces"
        portion = t;
        j++;
      } else if (/^\d+$/.test(t)) {
        const num = parseInt(t);
        j++;
        // Check for "Pieces" after
        if (j < allTexts.length && PORTION_TOKENS.test(allTexts[j])) {
          portion = `${num} ${allTexts[j]}`;
          j++;
        } else {
          portion = num === 1 ? "1 item" : `${num} pieces`;
        }
      }
    }

    // Collect numbers: Cal | CalFromFat | Fat | SatFat | TransFat | Chol | Sodium | Carbs | Fiber | Sugar | Protein
    const nums: number[] = [];
    while (j < allTexts.length && nums.length < 12) {
      const t = allTexts[j].replace(/,/g, "").trim();
      if (t === "<" || t === "< 1") { nums.push(0); j++; if (t === "<" && j < allTexts.length && allTexts[j] === "1") j++; continue; }
      if (/^[\d.\-]+$/.test(t)) { nums.push(parseFloat(t)); j++; }
      else break;
    }

    // Need at least 11 numbers: Cal, CalFromFat, Fat, SatFat, TransFat, Chol, Sodium, Carbs, Fiber, Sugar, Protein
    if (nums.length >= 11) {
      let idx = 0;
      const cal = nums[idx++];
      idx++; // skip cal from fat
      const fat = nums[idx++];
      const satFat = nums[idx++];
      const transFat = nums[idx++];
      const chol = nums[idx++];
      const sodium = nums[idx++];
      const carbs = nums[idx++];
      const fiber = nums[idx++];
      const sugar = nums[idx++];
      const protein = nums[idx++];

      if (cal > 0 && cal < 3000 && fat < 200 && carbs < 500 && protein < 200 && sodium < 10000) {
        items.push({ name, portion, cal, fat, satFat, transFat, chol, sodium, carbs, fiber, sugar, protein });
      }
    }

    i = j;
  }

  // Deduplicate by name+portion
  const seen = new Set<string>();
  const unique = items.filter(item => {
    const key = item.name + "|" + item.portion;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Import
  let count = 0;
  for (const item of unique) {
    const category = guessCategory(item.name);
    const displayName = item.portion !== "1 item" ? `${item.name} (${item.portion})` : item.name;
    const foodId = "chain-popeyes-" + slugify(displayName);

    upsertFood.run({
      id: foodId,
      name: displayName,
      brand: "Popeyes",
      category,
      serving_unit: item.portion,
      calories: item.cal,
      total_fat: item.fat,
      saturated_fat: item.satFat,
      trans_fat: item.transFat,
      cholesterol: item.chol,
      sodium: item.sodium,
      total_carbohydrates: item.carbs,
      dietary_fiber: item.fiber,
      total_sugars: item.sugar,
      protein: item.protein,
      household_serving: item.portion,
    });
    count++;
  }

  db.exec("INSERT INTO foods_fts(foods_fts) VALUES('rebuild')");

  console.log(`\n=== Popeyes Import Complete ===`);
  console.log(`Source: plk-use1-prod.sites.rbictg.com/nutrition/PLK_Nutrition.pdf`);
  console.log(`Items imported: ${count}`);

  const all = db.prepare("SELECT name, calories, protein, total_fat, total_carbohydrates FROM foods WHERE vendor_id='chain-popeyes' ORDER BY name").all() as any[];
  console.log(`\nAll ${all.length} items in database:`);
  for (const r of all) {
    console.log(`  ${r.name.padEnd(60)} ${r.calories} cal  ${r.protein}g pro  ${r.total_fat}g fat  ${r.total_carbohydrates}g carb`);
  }
});

parser.loadPDF("scripts/sources/popeyes.pdf");
