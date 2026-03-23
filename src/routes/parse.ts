import { Router } from "express";
import db from "../data/database";

export const parseRoutes = Router();

// --- Types ---

interface ParsedItem {
  original: string;
  quantity: number;
  unit: string;
  food_query: string;
  match: FoodMatch | null;
  nutrition: NutritionValues | null;
  confidence: number;
}

interface FoodMatch {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  serving_size: number;
  serving_unit: string;
}

interface NutritionValues {
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
  vitamin_d: number | null;
  calcium: number | null;
  iron: number | null;
  potassium: number | null;
}

const NUTRITION_KEYS: (keyof NutritionValues)[] = [
  "calories",
  "total_fat",
  "saturated_fat",
  "trans_fat",
  "cholesterol",
  "sodium",
  "total_carbohydrates",
  "dietary_fiber",
  "total_sugars",
  "protein",
  "vitamin_d",
  "calcium",
  "iron",
  "potassium",
];

// --- Unit conversion to grams ---

const UNIT_TO_GRAMS: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
  oz: 28.3495,
  ounce: 28.3495,
  ounces: 28.3495,
  lb: 453.592,
  pound: 453.592,
  pounds: 453.592,
  ml: 1, // approximate (water-like density)
  milliliter: 1,
  milliliters: 1,
  l: 1000,
  liter: 1000,
  liters: 1000,
  cup: 240,
  cups: 240,
  tbsp: 14.787,
  tablespoon: 14.787,
  tablespoons: 14.787,
  tsp: 4.929,
  teaspoon: 4.929,
  teaspoons: 4.929,
};

// Common food default weights in grams (for "whole" / "piece" / "slice" units)
const COMMON_FOOD_WEIGHTS: Record<string, number> = {
  egg: 50,
  eggs: 50,
  banana: 118,
  bananas: 118,
  apple: 182,
  apples: 182,
  orange: 131,
  oranges: 131,
  avocado: 150,
  avocados: 150,
  potato: 150,
  potatoes: 150,
  tomato: 123,
  tomatoes: 123,
  "chicken breast": 174,
  "chicken breasts": 174,
  tortilla: 45,
  tortillas: 45,
  bagel: 105,
  bagels: 105,
  muffin: 57,
  muffins: 57,
  cookie: 30,
  cookies: 30,
  donut: 60,
  donuts: 60,
  pancake: 77,
  pancakes: 77,
  waffle: 75,
  waffles: 75,
};

// Unit-specific default weights per item
const UNIT_FOOD_WEIGHTS: Record<string, Record<string, number>> = {
  slice: {
    bread: 30,
    toast: 30,
    pizza: 107,
    cheese: 21,
    bacon: 8,
    ham: 28,
    turkey: 28,
    cake: 80,
    pie: 125,
    default: 30,
  },
  piece: {
    chicken: 120,
    chocolate: 10,
    candy: 10,
    fruit: 100,
    sushi: 30,
    default: 100,
  },
  strip: {
    bacon: 8,
    chicken: 28,
    default: 20,
  },
  patty: {
    beef: 113,
    hamburger: 113,
    burger: 113,
    turkey: 113,
    chicken: 113,
    default: 113,
  },
};

// --- Number word parsing ---

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  half: 0.5,
  quarter: 0.25,
};

// Fraction patterns like "1/2", "3/4"
const FRACTION_REGEX = /^(\d+)\/(\d+)$/;

// Mixed number like "1 1/2"
const MIXED_NUMBER_REGEX = /^(\d+)\s+(\d+)\/(\d+)$/;

// --- Parsing logic ---

function splitIntoItems(input: string): string[] {
  // Normalize whitespace and line breaks
  let text = input
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, ", ")
    .trim();

  // Split on "and", commas, semicolons, plus signs
  const items = text
    .split(/(?:,\s*|\s+and\s+|\s*;\s*|\s*\+\s*)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return items;
}

function parseQuantity(text: string): {
  quantity: number;
  remaining: string;
} {
  let trimmed = text.trim();

  // Try mixed number: "1 1/2 cups of rice"
  const mixedMatch = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)\s+(.*)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1]);
    const num = parseInt(mixedMatch[2]);
    const den = parseInt(mixedMatch[3]);
    return { quantity: whole + num / den, remaining: mixedMatch[4] };
  }

  // Try fraction: "1/2 cup of rice"
  const fracMatch = trimmed.match(/^(\d+)\/(\d+)\s+(.*)$/);
  if (fracMatch) {
    const num = parseInt(fracMatch[1]);
    const den = parseInt(fracMatch[2]);
    return { quantity: num / den, remaining: fracMatch[3] };
  }

  // Try decimal/integer: "2 eggs", "1.5 cups"
  const numMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s+(.*)$/);
  if (numMatch) {
    return { quantity: parseFloat(numMatch[1]), remaining: numMatch[2] };
  }

  // Try number words: "two eggs", "a banana", "an apple"
  const wordMatch = trimmed.match(/^(\w+)\s+(.*)$/);
  if (wordMatch) {
    const word = wordMatch[1].toLowerCase();
    if (word in NUMBER_WORDS) {
      return { quantity: NUMBER_WORDS[word], remaining: wordMatch[2] };
    }
  }

  // No quantity found, default to 1
  return { quantity: 1, remaining: trimmed };
}

function parseUnit(text: string): {
  unit: string;
  remaining: string;
} {
  let trimmed = text.trim().toLowerCase();

  // All known unit names (sorted longest first to match greedily)
  const allUnits = [
    "tablespoons",
    "tablespoon",
    "teaspoons",
    "teaspoon",
    "milliliters",
    "milliliter",
    "kilograms",
    "kilogram",
    "ounces",
    "ounce",
    "pounds",
    "pound",
    "liters",
    "liter",
    "strips",
    "strip",
    "slices",
    "slice",
    "pieces",
    "piece",
    "patties",
    "patty",
    "cups",
    "cup",
    "tbsp",
    "tsp",
    "oz",
    "lb",
    "kg",
    "ml",
    "g",
    "l",
    "grams",
    "gram",
  ];

  for (const u of allUnits) {
    // Match unit followed by whitespace or "of" or end of string
    const pattern = new RegExp(`^${u}(?:\\s+of\\s+|\\s+|$)(.*)$`, "i");
    const match = trimmed.match(pattern);
    if (match) {
      // Normalize plural/singular unit name
      const normalized = normalizeUnit(u);
      return { unit: normalized, remaining: match[1].trim() };
    }
  }

  // No unit found — it's a whole item
  return { unit: "whole", remaining: trimmed };
}

function normalizeUnit(unit: string): string {
  const u = unit.toLowerCase();
  // Map to singular canonical form
  if (["cups", "cup"].includes(u)) return "cup";
  if (["tbsp", "tablespoon", "tablespoons"].includes(u)) return "tbsp";
  if (["tsp", "teaspoon", "teaspoons"].includes(u)) return "tsp";
  if (["oz", "ounce", "ounces"].includes(u)) return "oz";
  if (["lb", "pound", "pounds"].includes(u)) return "lb";
  if (["g", "gram", "grams"].includes(u)) return "g";
  if (["kg", "kilogram", "kilograms"].includes(u)) return "kg";
  if (["ml", "milliliter", "milliliters"].includes(u)) return "ml";
  if (["l", "liter", "liters"].includes(u)) return "l";
  if (["slices", "slice"].includes(u)) return "slice";
  if (["pieces", "piece"].includes(u)) return "piece";
  if (["strips", "strip"].includes(u)) return "strip";
  if (["patties", "patty"].includes(u)) return "patty";
  return u;
}

function parseFoodItem(raw: string): {
  quantity: number;
  unit: string;
  food_query: string;
} {
  const { quantity, remaining: afterQty } = parseQuantity(raw);
  const { unit, remaining: food_query } = parseUnit(afterQty);

  // Clean up leftover "of" at the start
  const cleaned = food_query.replace(/^of\s+/i, "").trim();

  return {
    quantity,
    unit,
    food_query: cleaned || afterQty, // fallback if nothing remains
  };
}

// --- Database search ---

function searchFood(query: string): any | null {
  const cleanQuery = query
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .trim();

  if (!cleanQuery) return null;

  // Build FTS5 query: quote each word and add prefix matching
  const words = cleanQuery.split(/\s+/).filter((w) => w.length > 0);

  // Custom ranking: prefer exact name matches, shorter names,
  // unbranded/generic foods, and USDA source data
  const rankExpr = `
      fts.rank
      + CASE WHEN lower(f.name) = lower(@rawQuery) THEN -1000 ELSE 0 END
      + CASE WHEN f.brand IS NULL OR f.brand = '' THEN -50 ELSE 0 END
      + CASE WHEN f.source = 'usda' THEN -30 ELSE 0 END
      + length(f.name) * 0.5`;

  // Strategy 1: Try exact phrase match first
  try {
    const phraseQuery = `"${words.join(" ")}"`;
    const result = db
      .prepare(
        `SELECT f.* FROM foods f
         JOIN foods_fts fts ON f.rowid = fts.rowid
         WHERE foods_fts MATCH @q
         ORDER BY (${rankExpr})
         LIMIT 1`
      )
      .get({ q: phraseQuery, rawQuery: cleanQuery });
    if (result) return result;
  } catch {}

  // Strategy 2: All words with prefix matching
  try {
    const ftsQuery = words.map((w) => `"${w}"*`).join(" ");
    const result = db
      .prepare(
        `SELECT f.* FROM foods f
         JOIN foods_fts fts ON f.rowid = fts.rowid
         WHERE foods_fts MATCH @q
         ORDER BY (${rankExpr})
         LIMIT 1`
      )
      .get({ q: ftsQuery, rawQuery: cleanQuery });
    if (result) return result;
  } catch {}

  // Strategy 3: Try individual words (OR logic) — pick the best ranked
  try {
    const ftsQuery = words.map((w) => `"${w}"*`).join(" OR ");
    const result = db
      .prepare(
        `SELECT f.* FROM foods f
         JOIN foods_fts fts ON f.rowid = fts.rowid
         WHERE foods_fts MATCH @q
         ORDER BY (${rankExpr})
         LIMIT 1`
      )
      .get({ q: ftsQuery, rawQuery: cleanQuery });
    if (result) return result;
  } catch {}

  // Strategy 4: LIKE fallback for single short words
  // Prefer unbranded, USDA-sourced, shorter-named foods
  try {
    const result = db
      .prepare(
        `SELECT * FROM foods
         WHERE lower(name) LIKE @pattern
         ORDER BY
           CASE WHEN lower(name) = lower(@rawQuery) THEN 0 ELSE 1 END,
           CASE WHEN brand IS NULL OR brand = '' THEN 0 ELSE 1 END,
           CASE WHEN source = 'usda' THEN 0 ELSE 1 END,
           length(name) ASC
         LIMIT 1`
      )
      .get({ pattern: `%${cleanQuery}%`, rawQuery: cleanQuery });
    if (result) return result;
  } catch {}

  return null;
}

// --- Nutrition scaling ---

function getGramsForItem(
  quantity: number,
  unit: string,
  foodQuery: string,
  dbServingSize: number,
  dbServingUnit: string
): number {
  const foodLower = foodQuery.toLowerCase();

  // If unit is grams already, just multiply
  if (unit === "g") return quantity;

  // If unit has a direct gram conversion (cup, tbsp, tsp, oz, etc.)
  if (unit in UNIT_TO_GRAMS) {
    return quantity * UNIT_TO_GRAMS[unit];
  }

  // For slice/piece/strip/patty, look up food-specific weight
  if (unit in UNIT_FOOD_WEIGHTS) {
    const unitMap = UNIT_FOOD_WEIGHTS[unit];
    for (const [food, grams] of Object.entries(unitMap)) {
      if (food !== "default" && foodLower.includes(food)) {
        return quantity * grams;
      }
    }
    return quantity * (unitMap.default || 30);
  }

  // For "whole" items, check common foods
  if (unit === "whole") {
    // Check exact common food weights
    for (const [food, grams] of Object.entries(COMMON_FOOD_WEIGHTS)) {
      if (foodLower.includes(food) || food.includes(foodLower)) {
        return quantity * grams;
      }
    }

    // If the DB serving unit is already a countable unit (e.g., "piece", "each"),
    // use the DB serving size as the weight per item
    const countableUnits = [
      "piece",
      "each",
      "item",
      "whole",
      "slice",
      "serving",
    ];
    if (
      countableUnits.some(
        (u) => dbServingUnit.toLowerCase().includes(u)
      )
    ) {
      return quantity * dbServingSize;
    }

    // Default: use the DB serving size as-is (assume 1 serving = 1 item)
    return quantity * dbServingSize;
  }

  // Fallback: treat as 1 serving per unit
  return quantity * dbServingSize;
}

function scaleNutrition(
  food: any,
  grams: number
): NutritionValues {
  // The DB stores nutrition per serving_size grams
  const servingGrams = food.serving_size || 100;
  const factor = grams / servingGrams;

  const round2 = (n: number | null) =>
    n != null ? Math.round(n * factor * 100) / 100 : null;

  return {
    calories: round2(food.calories) ?? 0,
    total_fat: round2(food.total_fat) ?? 0,
    saturated_fat: round2(food.saturated_fat) ?? 0,
    trans_fat: round2(food.trans_fat) ?? 0,
    cholesterol: round2(food.cholesterol) ?? 0,
    sodium: round2(food.sodium) ?? 0,
    total_carbohydrates: round2(food.total_carbohydrates) ?? 0,
    dietary_fiber: round2(food.dietary_fiber) ?? 0,
    total_sugars: round2(food.total_sugars) ?? 0,
    protein: round2(food.protein) ?? 0,
    vitamin_d: round2(food.vitamin_d),
    calcium: round2(food.calcium),
    iron: round2(food.iron),
    potassium: round2(food.potassium),
  };
}

function sumNutrition(items: NutritionValues[]): NutritionValues {
  const totals: NutritionValues = {
    calories: 0,
    total_fat: 0,
    saturated_fat: 0,
    trans_fat: 0,
    cholesterol: 0,
    sodium: 0,
    total_carbohydrates: 0,
    dietary_fiber: 0,
    total_sugars: 0,
    protein: 0,
    vitamin_d: null,
    calcium: null,
    iron: null,
    potassium: null,
  };

  for (const item of items) {
    for (const key of NUTRITION_KEYS) {
      const val = item[key];
      if (val != null) {
        (totals as any)[key] =
          ((totals as any)[key] ?? 0) + val;
      }
    }
  }

  // Round totals
  for (const key of NUTRITION_KEYS) {
    const val = (totals as any)[key];
    if (val != null) {
      (totals as any)[key] = Math.round(val * 100) / 100;
    }
  }

  return totals;
}

// --- Confidence scoring ---

function computeConfidence(
  foodQuery: string,
  match: any | null
): number {
  if (!match) return 0;

  const query = foodQuery.toLowerCase().trim();
  const name = (match.name as string).toLowerCase();

  // Exact match
  if (name === query) return 1;

  // Name contains all query words
  const queryWords = query.split(/\s+/);
  const allWordsFound = queryWords.every((w) => name.includes(w));
  if (allWordsFound) return 0.9;

  // Most words found
  const foundCount = queryWords.filter((w) => name.includes(w)).length;
  const ratio = foundCount / queryWords.length;

  return Math.round(Math.max(0.3, ratio * 0.85) * 100) / 100;
}

// --- Route handler ---

parseRoutes.post("/", (req, res) => {
  const { input } = req.body;

  if (!input || typeof input !== "string") {
    res.status(400).json({
      error: "Request body must include an 'input' string",
      example: { input: "2 eggs and a slice of toast" },
    });
    return;
  }

  if (input.length > 2000) {
    res.status(400).json({
      error: "Input must be 2000 characters or less",
    });
    return;
  }

  const rawItems = splitIntoItems(input);

  if (rawItems.length === 0) {
    res.status(400).json({
      error: "Could not parse any food items from input",
    });
    return;
  }

  const parsedItems: ParsedItem[] = [];

  for (const raw of rawItems) {
    const { quantity, unit, food_query } = parseFoodItem(raw);
    const match = searchFood(food_query);

    let nutrition: NutritionValues | null = null;
    let foodMatch: FoodMatch | null = null;

    if (match) {
      foodMatch = {
        id: match.id,
        name: match.name,
        brand: match.brand || null,
        category: match.category,
        serving_size: match.serving_size,
        serving_unit: match.serving_unit,
      };

      const grams = getGramsForItem(
        quantity,
        unit,
        food_query,
        match.serving_size,
        match.serving_unit
      );

      nutrition = scaleNutrition(match, grams);
    }

    parsedItems.push({
      original: raw,
      quantity,
      unit,
      food_query,
      match: foodMatch,
      nutrition,
      confidence: computeConfidence(food_query, match),
    });
  }

  const matchedItems = parsedItems.filter((i) => i.nutrition !== null);
  const totals =
    matchedItems.length > 0
      ? sumNutrition(matchedItems.map((i) => i.nutrition!))
      : null;

  res.json({
    input,
    items: parsedItems,
    totals,
    matched: matchedItems.length,
    total_items: parsedItems.length,
  });
});
