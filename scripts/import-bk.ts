/**
 * Burger King — Official PDF Import
 * Source: https://bk-use1-prod.sites.rbictg.com/nutrition/nutrition.pdf
 *
 * Parses BK's FDA-mandated nutrition PDF directly. No AI involved.
 */

import db from "../src/data/database";

const PDFParser = require("pdf2json");

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function cleanName(name: string): string {
  return name
    .replace(/^Entrees Kids /, "")
    .replace(/^Side Items /, "")
    .replace(/^Beverage /, "")
    .replace(/^Iced Coffee /, "")
    .replace(/^Hot Coffee /, "")
    .trim();
}

function guessCategory(name: string): string {
  const n = name.toLowerCase();
  if (/whopper|hamburger|cheeseburger|double burger|extra long/.test(n)) return "Burgers";
  if (/chicken|nugget|chicken fries/.test(n)) return "Chicken";
  if (/salad|dressing|crouton/.test(n)) return "Salads";
  if (/fries|onion ring|hash brown/.test(n)) return "Sides";
  if (/biscuit|burrito|breakfast|platter|pancake|french toast|oatmeal/.test(n)) return "Breakfast";
  if (/shake|sundae|cookie|soft serve|pie/.test(n)) return "Desserts";
  if (/coffee|juice|coke|frozen|milk/.test(n)) return "Beverages";
  if (/sauce|ketchup|mayo|syrup|jam|cheese.*slice/.test(n)) return "Condiments";
  return "Other";
}

// Upsert vendor
db.prepare(`
  INSERT INTO vendors (id, name, type)
  VALUES ('chain-burger-king', 'Burger King', 'restaurant')
  ON CONFLICT(id) DO UPDATE SET name = excluded.name
`).run();

const upsertFood = db.prepare(`
  INSERT INTO foods (id, name, brand, category, serving_size, serving_unit, source, vendor_id,
    calories, total_fat, saturated_fat, trans_fat, cholesterol, sodium,
    total_carbohydrates, dietary_fiber, total_sugars, protein,
    household_serving, updated_at)
  VALUES (@id, @name, @brand, @category, 100, @serving_unit, 'vendor', 'chain-burger-king',
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

  // Find data start (after first header row)
  let start = 0;
  for (let i = 0; i < allTexts.length; i++) {
    if (allTexts[i] === "Protein (g)") { start = i + 1; break; }
  }

  interface Item { name: string; cal: number; fat: number; satFat: number; transFat: number; chol: number; sodium: number; carbs: number; fiber: number; sugar: number; protein: number; }
  const items: Item[] = [];
  let i = start;

  while (i < allTexts.length) {
    // Skip page headers and repeated column headers
    if (/^(Burger King|Nutrition Facts|NOVEMBER|JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|DECEMBER)/i.test(allTexts[i]) || /^\d$/.test(allTexts[i])) {
      i++;
      while (i < allTexts.length && /^(Calories|Total fat|Saturated Fat|Trans Fat|Cholesterol|Sodium|Total Carb|Dietary Fiber|Total Sugar|Protein|from|Fat|\(g\)|\(mg\)| )$/i.test(allTexts[i])) i++;
      continue;
    }

    // Skip ALL CAPS section headers that aren't followed by numbers
    if (/^[A-Z][A-Z &®\-''\.\/]{3,}$/.test(allTexts[i])) {
      const next = allTexts[i + 1] || "";
      if (!/^\d/.test(next)) { i++; continue; }
    }

    // Collect name tokens
    const nameTokens: string[] = [];
    let j = i;
    while (j < allTexts.length) {
      const t = allTexts[j].replace(/,/g, "");
      if (/^[\d<.\-]+$/.test(t) && nameTokens.length > 0) break;
      nameTokens.push(allTexts[j]);
      j++;
    }
    let name = nameTokens.join(" ").replace(/[®™]+/g, "").trim();

    // Skip garbage names
    if (!name || name.length < 2 || /^[\d<]/.test(name) || /^Calories from Fat/i.test(name) || /Total fat \(g\)/i.test(name)) {
      while (j < allTexts.length && /^[\d<.\-]+$/.test(allTexts[j].replace(/,/g, ""))) j++;
      i = j;
      continue;
    }

    // Collect 11-12 numbers: Cal, CalFromFat, Fat, SatFat, TransFat, Chol, Sodium, Carbs, Fiber, Sugar, Protein
    const nums: number[] = [];
    while (j < allTexts.length && nums.length < 12) {
      const t = allTexts[j].replace(/,/g, "").trim();
      if (t === "<" || t === "< 1") { nums.push(0); j++; if (t === "<" && allTexts[j] === "1") j++; continue; }
      if (/^[\d.\-]+$/.test(t)) { nums.push(parseFloat(t)); j++; }
      else break;
    }

    if (nums.length >= 11) {
      const cal = nums[0], fat = nums[2], satFat = nums[3], transFat = nums[4];
      const chol = nums[5], sodium = nums[6], carbs = nums[7], fiber = nums[8];
      const sugar = nums[9], protein = nums[10];

      // Sanity checks
      if (cal > 0 && cal < 3000 && fat < 200 && carbs < 500 && protein < 200 && sodium < 10000) {
        items.push({ name, cal, fat, satFat, transFat, chol, sodium, carbs, fiber, sugar, protein });
      }
    }
    i = j;
  }

  // Deduplicate by name
  const seen = new Set<string>();
  const unique = items.filter(item => {
    if (seen.has(item.name)) return false;
    seen.add(item.name);
    return true;
  });

  // Import
  let count = 0;
  for (const item of unique) {
    const cleaned = cleanName(item.name);
    const category = guessCategory(cleaned);
    const foodId = "chain-burger-king-" + slugify(cleaned);

    upsertFood.run({
      id: foodId,
      name: cleaned,
      brand: "Burger King",
      category,
      serving_unit: "1 item",
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
      household_serving: "1 item",
    });
    count++;
  }

  db.exec("INSERT INTO foods_fts(foods_fts) VALUES('rebuild')");

  console.log(`\n=== Burger King Import Complete ===`);
  console.log(`Source: bk-use1-prod.sites.rbictg.com/nutrition/nutrition.pdf`);
  console.log(`Items imported: ${count}`);

  // Verify
  const all = db.prepare("SELECT name, calories, protein, total_fat, total_carbohydrates FROM foods WHERE vendor_id='chain-burger-king' ORDER BY name").all() as any[];
  console.log(`\nAll ${all.length} items in database:`);
  for (const r of all) {
    console.log(`  ${r.name.padEnd(55)} ${r.calories} cal  ${r.protein}g pro  ${r.total_fat}g fat  ${r.total_carbohydrates}g carb`);
  }
});

parser.loadPDF("scripts/sources/burger-king.pdf");
