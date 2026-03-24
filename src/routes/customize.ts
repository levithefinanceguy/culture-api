import { Router, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import db from "../data/database";
import { calculateNutriScore } from "../services/nutrition-score";
import { fuzzySearchSingle } from "../services/fuzzy-search";

export const customizeRoutes = Router();

// --- Types ---

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

type PortionSize = "light" | "standard" | "extra" | "double";

interface ReferenceItem {
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
  portion_grams: number;
  category: "condiment" | "protein" | "extra";
}

// --- Common toppings/add-ons reference ---

const COMMON_ADDONS: Record<string, ReferenceItem> = {
  // Standard toppings (~30g portions)
  "sour cream": {
    calories: 60, total_fat: 5, saturated_fat: 3, trans_fat: 0,
    cholesterol: 20, sodium: 15, total_carbohydrates: 1, dietary_fiber: 0,
    total_sugars: 1, protein: 1, portion_grams: 30, category: "condiment",
  },
  "guacamole": {
    calories: 50, total_fat: 4.5, saturated_fat: 0.5, trans_fat: 0,
    cholesterol: 0, sodium: 115, total_carbohydrates: 3, dietary_fiber: 2,
    total_sugars: 0, protein: 1, portion_grams: 30, category: "condiment",
  },
  "guac": {
    calories: 50, total_fat: 4.5, saturated_fat: 0.5, trans_fat: 0,
    cholesterol: 0, sodium: 115, total_carbohydrates: 3, dietary_fiber: 2,
    total_sugars: 0, protein: 1, portion_grams: 30, category: "condiment",
  },
  "shredded cheese": {
    calories: 110, total_fat: 9, saturated_fat: 5.5, trans_fat: 0,
    cholesterol: 30, sodium: 180, total_carbohydrates: 1, dietary_fiber: 0,
    total_sugars: 0, protein: 7, portion_grams: 30, category: "condiment",
  },
  "cheese": {
    calories: 110, total_fat: 9, saturated_fat: 5.5, trans_fat: 0,
    cholesterol: 30, sodium: 180, total_carbohydrates: 1, dietary_fiber: 0,
    total_sugars: 0, protein: 7, portion_grams: 30, category: "condiment",
  },
  "salsa": {
    calories: 10, total_fat: 0, saturated_fat: 0, trans_fat: 0,
    cholesterol: 0, sodium: 200, total_carbohydrates: 2, dietary_fiber: 0.5,
    total_sugars: 1, protein: 0, portion_grams: 30, category: "condiment",
  },
  "lettuce": {
    calories: 3, total_fat: 0, saturated_fat: 0, trans_fat: 0,
    cholesterol: 0, sodium: 5, total_carbohydrates: 0.5, dietary_fiber: 0.3,
    total_sugars: 0.3, protein: 0, portion_grams: 30, category: "condiment",
  },
  "tomato": {
    calories: 5, total_fat: 0, saturated_fat: 0, trans_fat: 0,
    cholesterol: 0, sodium: 1, total_carbohydrates: 1, dietary_fiber: 0.3,
    total_sugars: 0.7, protein: 0, portion_grams: 30, category: "condiment",
  },
  "tomatoes": {
    calories: 5, total_fat: 0, saturated_fat: 0, trans_fat: 0,
    cholesterol: 0, sodium: 1, total_carbohydrates: 1, dietary_fiber: 0.3,
    total_sugars: 0.7, protein: 0, portion_grams: 30, category: "condiment",
  },
  "onions": {
    calories: 10, total_fat: 0, saturated_fat: 0, trans_fat: 0,
    cholesterol: 0, sodium: 1, total_carbohydrates: 2.5, dietary_fiber: 0.4,
    total_sugars: 1.2, protein: 0, portion_grams: 30, category: "condiment",
  },
  "onion": {
    calories: 10, total_fat: 0, saturated_fat: 0, trans_fat: 0,
    cholesterol: 0, sodium: 1, total_carbohydrates: 2.5, dietary_fiber: 0.4,
    total_sugars: 1.2, protein: 0, portion_grams: 30, category: "condiment",
  },
  "pickles": {
    calories: 4, total_fat: 0, saturated_fat: 0, trans_fat: 0,
    cholesterol: 0, sodium: 280, total_carbohydrates: 1, dietary_fiber: 0.3,
    total_sugars: 0.4, protein: 0, portion_grams: 30, category: "condiment",
  },
  "pickle": {
    calories: 4, total_fat: 0, saturated_fat: 0, trans_fat: 0,
    cholesterol: 0, sodium: 280, total_carbohydrates: 1, dietary_fiber: 0.3,
    total_sugars: 0.4, protein: 0, portion_grams: 30, category: "condiment",
  },
  "jalapenos": {
    calories: 4, total_fat: 0, saturated_fat: 0, trans_fat: 0,
    cholesterol: 0, sodium: 0, total_carbohydrates: 1, dietary_fiber: 0.4,
    total_sugars: 0.6, protein: 0, portion_grams: 30, category: "condiment",
  },
  "jalapeno": {
    calories: 4, total_fat: 0, saturated_fat: 0, trans_fat: 0,
    cholesterol: 0, sodium: 0, total_carbohydrates: 1, dietary_fiber: 0.4,
    total_sugars: 0.6, protein: 0, portion_grams: 30, category: "condiment",
  },
  "mayo": {
    calories: 100, total_fat: 11, saturated_fat: 1.5, trans_fat: 0,
    cholesterol: 5, sodium: 90, total_carbohydrates: 0, dietary_fiber: 0,
    total_sugars: 0, protein: 0, portion_grams: 30, category: "condiment",
  },
  "mayonnaise": {
    calories: 100, total_fat: 11, saturated_fat: 1.5, trans_fat: 0,
    cholesterol: 5, sodium: 90, total_carbohydrates: 0, dietary_fiber: 0,
    total_sugars: 0, protein: 0, portion_grams: 30, category: "condiment",
  },
  "mustard": {
    calories: 10, total_fat: 0.5, saturated_fat: 0, trans_fat: 0,
    cholesterol: 0, sodium: 170, total_carbohydrates: 1, dietary_fiber: 0,
    total_sugars: 0, protein: 0, portion_grams: 30, category: "condiment",
  },
  "ketchup": {
    calories: 20, total_fat: 0, saturated_fat: 0, trans_fat: 0,
    cholesterol: 0, sodium: 160, total_carbohydrates: 5, dietary_fiber: 0,
    total_sugars: 4, protein: 0, portion_grams: 30, category: "condiment",
  },
  "ranch": {
    calories: 70, total_fat: 7, saturated_fat: 1, trans_fat: 0,
    cholesterol: 5, sodium: 200, total_carbohydrates: 1, dietary_fiber: 0,
    total_sugars: 1, protein: 0, portion_grams: 30, category: "condiment",
  },
  "ranch dressing": {
    calories: 70, total_fat: 7, saturated_fat: 1, trans_fat: 0,
    cholesterol: 5, sodium: 200, total_carbohydrates: 1, dietary_fiber: 0,
    total_sugars: 1, protein: 0, portion_grams: 30, category: "condiment",
  },
  "bbq sauce": {
    calories: 30, total_fat: 0, saturated_fat: 0, trans_fat: 0,
    cholesterol: 0, sodium: 250, total_carbohydrates: 7, dietary_fiber: 0,
    total_sugars: 6, protein: 0, portion_grams: 30, category: "condiment",
  },
  "hot sauce": {
    calories: 5, total_fat: 0, saturated_fat: 0, trans_fat: 0,
    cholesterol: 0, sodium: 200, total_carbohydrates: 1, dietary_fiber: 0,
    total_sugars: 0, protein: 0, portion_grams: 30, category: "condiment",
  },

  // Standard proteins (~85g)
  "bacon": {
    calories: 130, total_fat: 10, saturated_fat: 3.5, trans_fat: 0,
    cholesterol: 40, sodium: 580, total_carbohydrates: 0, dietary_fiber: 0,
    total_sugars: 0, protein: 9, portion_grams: 25, category: "protein",
  },
  "grilled chicken": {
    calories: 130, total_fat: 3, saturated_fat: 0.8, trans_fat: 0,
    cholesterol: 75, sodium: 60, total_carbohydrates: 0, dietary_fiber: 0,
    total_sugars: 0, protein: 25, portion_grams: 85, category: "protein",
  },
  "chicken": {
    calories: 130, total_fat: 3, saturated_fat: 0.8, trans_fat: 0,
    cholesterol: 75, sodium: 60, total_carbohydrates: 0, dietary_fiber: 0,
    total_sugars: 0, protein: 25, portion_grams: 85, category: "protein",
  },
  "steak": {
    calories: 150, total_fat: 7, saturated_fat: 3, trans_fat: 0,
    cholesterol: 60, sodium: 55, total_carbohydrates: 0, dietary_fiber: 0,
    total_sugars: 0, protein: 22, portion_grams: 85, category: "protein",
  },
  "beef": {
    calories: 150, total_fat: 7, saturated_fat: 3, trans_fat: 0,
    cholesterol: 60, sodium: 55, total_carbohydrates: 0, dietary_fiber: 0,
    total_sugars: 0, protein: 22, portion_grams: 85, category: "protein",
  },
  "egg": {
    calories: 70, total_fat: 5, saturated_fat: 1.5, trans_fat: 0,
    cholesterol: 185, sodium: 70, total_carbohydrates: 0.5, dietary_fiber: 0,
    total_sugars: 0, protein: 6, portion_grams: 50, category: "protein",
  },

  // Standard extras
  "extra cheese": {
    calories: 110, total_fat: 9, saturated_fat: 5.5, trans_fat: 0,
    cholesterol: 30, sodium: 180, total_carbohydrates: 1, dietary_fiber: 0,
    total_sugars: 0, protein: 7, portion_grams: 30, category: "condiment",
  },
  "avocado": {
    calories: 120, total_fat: 11, saturated_fat: 1.5, trans_fat: 0,
    cholesterol: 0, sodium: 5, total_carbohydrates: 6, dietary_fiber: 5,
    total_sugars: 0.5, protein: 1.5, portion_grams: 68, category: "extra",
  },
  "rice": {
    calories: 100, total_fat: 0, saturated_fat: 0, trans_fat: 0,
    cholesterol: 0, sodium: 0, total_carbohydrates: 22, dietary_fiber: 0.3,
    total_sugars: 0, protein: 2, portion_grams: 90, category: "extra",
  },
  "beans": {
    calories: 110, total_fat: 0.5, saturated_fat: 0, trans_fat: 0,
    cholesterol: 0, sodium: 200, total_carbohydrates: 20, dietary_fiber: 6,
    total_sugars: 0.5, protein: 7, portion_grams: 90, category: "extra",
  },
};

// --- Portion multipliers ---

function getPortionMultiplier(portion: PortionSize): number {
  switch (portion) {
    case "light":
      return 0.5;
    case "standard":
      return 1;
    case "extra":
    case "double":
      return 2;
    default:
      return 1;
  }
}

// --- Search helpers ---

function searchFoodByName(query: string, brand?: string | null): any | null {
  const cleanQuery = query
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .trim();

  if (!cleanQuery) return null;

  const words = cleanQuery.split(/\s+/).filter((w) => w.length > 0);

  const rankExpr = `
      fts.rank
      + CASE WHEN lower(f.name) = lower(@rawQuery) THEN -1000 ELSE 0 END
      + CASE WHEN f.brand IS NULL OR f.brand = '' THEN -50 ELSE 0 END
      + CASE WHEN f.source = 'usda' THEN -30 ELSE 0 END
      + CASE WHEN f.source = 'community' THEN 20 ELSE 0 END
      + length(f.name) * 0.5`;

  // If we have a brand/restaurant, try brand-filtered search first
  if (brand) {
    const brandClean = brand.toLowerCase().replace(/[^\w\s]/g, "").trim();
    try {
      const phraseQuery = `"${words.join(" ")}"`;
      const result = db
        .prepare(
          `SELECT f.* FROM foods f
           JOIN foods_fts fts ON f.rowid = fts.rowid
           WHERE foods_fts MATCH @q AND lower(f.brand) LIKE @brand
           ORDER BY (${rankExpr})
           LIMIT 1`
        )
        .get({ q: phraseQuery, rawQuery: cleanQuery, brand: `%${brandClean}%` });
      if (result) return result;
    } catch { /* ignore FTS errors */ }

    try {
      const ftsQuery = words.map((w) => `"${w}"*`).join(" ");
      const result = db
        .prepare(
          `SELECT f.* FROM foods f
           JOIN foods_fts fts ON f.rowid = fts.rowid
           WHERE foods_fts MATCH @q AND lower(f.brand) LIKE @brand
           ORDER BY (${rankExpr})
           LIMIT 1`
        )
        .get({ q: ftsQuery, rawQuery: cleanQuery, brand: `%${brandClean}%` });
      if (result) return result;
    } catch { /* ignore */ }
  }

  // Generic search (no brand filter)
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
  } catch { /* ignore */ }

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
  } catch { /* ignore */ }

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
  } catch { /* ignore */ }

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
  } catch { /* ignore */ }

  try {
    const fuzzyResult = fuzzySearchSingle(cleanQuery);
    if (fuzzyResult.food) return fuzzyResult.food;
  } catch { /* ignore */ }

  return null;
}

function searchMealComponent(name: string, chain: string | null): any | null {
  if (!chain) return null;
  const cleanName = name.toLowerCase().replace(/[^\w\s]/g, "").trim();
  const cleanChain = chain.toLowerCase().replace(/[^\w\s]/g, "").trim();
  if (!cleanName || !cleanChain) return null;

  try {
    const component = db
      .prepare(
        `SELECT * FROM meal_components
         WHERE lower(chain_name) LIKE @chain
           AND lower(component_name) LIKE @name
         ORDER BY length(component_name) ASC
         LIMIT 1`
      )
      .get({ chain: `%${cleanChain}%`, name: `%${cleanName}%` }) as any;
    return component || null;
  } catch {
    return null;
  }
}

// --- Nutrition helpers ---

function makeZeroNutrition(): NutritionValues {
  return {
    calories: 0, total_fat: 0, saturated_fat: 0, trans_fat: 0,
    cholesterol: 0, sodium: 0, total_carbohydrates: 0, dietary_fiber: 0,
    total_sugars: 0, protein: 0, vitamin_d: null, calcium: null,
    iron: null, potassium: null,
  };
}

function extractNutrition(food: any): NutritionValues {
  return {
    calories: food.calories ?? 0,
    total_fat: food.total_fat ?? 0,
    saturated_fat: food.saturated_fat ?? 0,
    trans_fat: food.trans_fat ?? 0,
    cholesterol: food.cholesterol ?? 0,
    sodium: food.sodium ?? 0,
    total_carbohydrates: food.total_carbohydrates ?? 0,
    dietary_fiber: food.dietary_fiber ?? 0,
    total_sugars: food.total_sugars ?? 0,
    protein: food.protein ?? 0,
    vitamin_d: food.vitamin_d ?? null,
    calcium: food.calcium ?? null,
    iron: food.iron ?? null,
    potassium: food.potassium ?? null,
  };
}

function scaleNutrition(n: NutritionValues, multiplier: number): NutritionValues {
  const result = makeZeroNutrition();
  for (const key of NUTRITION_KEYS) {
    const val = n[key];
    if (val != null) {
      (result as any)[key] = round2(val * multiplier);
    }
  }
  return result;
}

function addNutrition(base: NutritionValues, delta: NutritionValues): NutritionValues {
  const result = { ...base };
  for (const key of NUTRITION_KEYS) {
    const bVal = base[key];
    const dVal = delta[key];
    if (dVal != null) {
      (result as any)[key] = round2((bVal ?? 0) + dVal);
    }
  }
  return result;
}

function subtractNutrition(base: NutritionValues, delta: NutritionValues): NutritionValues {
  const result = { ...base };
  for (const key of NUTRITION_KEYS) {
    const bVal = base[key];
    const dVal = delta[key];
    if (dVal != null) {
      (result as any)[key] = round2(Math.max(0, (bVal ?? 0) - dVal));
    }
  }
  return result;
}

function nutritionDifference(
  original: NutritionValues,
  customized: NutritionValues
): Record<string, string> {
  const diff: Record<string, string> = {};
  for (const key of NUTRITION_KEYS) {
    const oVal = original[key] ?? 0;
    const cVal = customized[key] ?? 0;
    const delta = round2(cVal - oVal);
    diff[key] = delta >= 0 ? `+${delta}` : `${delta}`;
  }
  return diff;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatNutritionResponse(n: NutritionValues): Record<string, number | null> {
  return {
    calories: n.calories,
    totalFat: n.total_fat,
    saturatedFat: n.saturated_fat,
    transFat: n.trans_fat,
    cholesterol: n.cholesterol,
    sodium: n.sodium,
    totalCarbohydrates: n.total_carbohydrates,
    dietaryFiber: n.dietary_fiber,
    totalSugars: n.total_sugars,
    protein: n.protein,
    vitaminD: n.vitamin_d,
    calcium: n.calcium,
    iron: n.iron,
    potassium: n.potassium,
  };
}

// --- Core customization logic ---

export interface AddItem {
  name: string;
  portion: PortionSize | string;
}

export interface SwapItem {
  from: string;
  to: string;
}

interface Modification {
  action: "add" | "remove" | "swap";
  item: string;
  nutrition: Record<string, number | null>;
}

export interface CustomizationInput {
  add?: AddItem[];
  remove?: string[];
  swap?: SwapItem[];
}

/**
 * Resolve an ingredient's nutrition.
 * Priority: meal_components (if chain known) -> reference table -> foods DB
 */
function resolveIngredientNutrition(
  name: string,
  portion: PortionSize,
  chain: string | null
): { nutrition: NutritionValues; source: string } | null {
  const lowerName = name.toLowerCase().trim();
  const multiplier = getPortionMultiplier(portion);

  // 1. Try meal_components if chain is known
  if (chain) {
    const component = searchMealComponent(name, chain);
    if (component) {
      const baseNutrition = extractNutrition(component);
      return {
        nutrition: scaleNutrition(baseNutrition, multiplier),
        source: "meal_component",
      };
    }
  }

  // 2. Try reference table
  const ref = COMMON_ADDONS[lowerName];
  if (ref) {
    const baseNutrition: NutritionValues = {
      calories: ref.calories,
      total_fat: ref.total_fat,
      saturated_fat: ref.saturated_fat,
      trans_fat: ref.trans_fat,
      cholesterol: ref.cholesterol,
      sodium: ref.sodium,
      total_carbohydrates: ref.total_carbohydrates,
      dietary_fiber: ref.dietary_fiber,
      total_sugars: ref.total_sugars,
      protein: ref.protein,
      vitamin_d: null,
      calcium: null,
      iron: null,
      potassium: null,
    };
    return {
      nutrition: scaleNutrition(baseNutrition, multiplier),
      source: "reference",
    };
  }

  // 3. Fall back to foods DB
  const food = searchFoodByName(name, chain);
  if (food) {
    const baseNutrition = extractNutrition(food);
    return {
      nutrition: scaleNutrition(baseNutrition, multiplier),
      source: "database",
    };
  }

  return null;
}

/**
 * Calculate a culture score for a customized item.
 * Uses the base item's culture score and adjusts based on the overall
 * calorie change direction (more calories = lower score, fewer = higher).
 */
function calculateCustomizedCultureScore(
  baseCultureScore: number | null,
  originalCalories: number,
  customizedCalories: number
): number | null {
  if (baseCultureScore == null) return null;

  const calDiff = customizedCalories - originalCalories;
  // Adjust by up to +/- 10 points based on calorie change
  // Every 100 cal increase = -5 points, every 100 cal decrease = +5 points
  const adjustment = Math.round((-calDiff / 100) * 5);
  const newScore = Math.max(0, Math.min(100, baseCultureScore + adjustment));
  return newScore;
}

/**
 * Build the customized name from original name + modifications.
 */
function buildCustomizedName(
  originalName: string,
  adds: string[],
  removes: string[],
  swaps: SwapItem[]
): string {
  let name = originalName;
  for (const add of adds) {
    name += ` + ${add}`;
  }
  for (const remove of removes) {
    name += ` - ${remove}`;
  }
  for (const swap of swaps) {
    name += ` (${swap.from} -> ${swap.to})`;
  }
  return name;
}

/**
 * Apply customizations to a base food item.
 * Exported so order.ts can reuse it.
 */
export function applyCustomizations(
  baseFoodId: string,
  customizations: CustomizationInput
): {
  original: {
    id: string;
    name: string;
    brand: string | null;
    nutrition: NutritionValues;
    cultureScore: number | null;
  };
  customized: {
    name: string;
    modifications: Modification[];
    nutrition: NutritionValues;
    cultureScore: number | null;
  };
  difference: Record<string, string>;
} | { error: string } {
  // Look up the base food
  const baseFood = db.prepare("SELECT * FROM foods WHERE id = ?").get(baseFoodId) as any;
  if (!baseFood) {
    return { error: "Food not found" };
  }

  const chain: string | null = baseFood.brand || null;
  const originalNutrition = extractNutrition(baseFood);
  let customizedNutrition = { ...originalNutrition };
  const modifications: Modification[] = [];
  const addNames: string[] = [];
  const removeNames: string[] = [];
  const swapItems: SwapItem[] = [];

  // Process additions
  if (customizations.add && Array.isArray(customizations.add)) {
    for (const item of customizations.add) {
      const name = item.name;
      const portion: PortionSize = (item.portion as PortionSize) || "standard";
      const resolved = resolveIngredientNutrition(name, portion, chain);

      if (resolved) {
        customizedNutrition = addNutrition(customizedNutrition, resolved.nutrition);
        modifications.push({
          action: "add",
          item: name,
          nutrition: formatNutritionResponse(resolved.nutrition),
        });
      } else {
        // Unknown item — still record it but with zero nutrition
        modifications.push({
          action: "add",
          item: name,
          nutrition: formatNutritionResponse(makeZeroNutrition()),
        });
      }
      addNames.push(name);
    }
  }

  // Process removals
  if (customizations.remove && Array.isArray(customizations.remove)) {
    for (const name of customizations.remove) {
      const resolved = resolveIngredientNutrition(name, "standard", chain);

      if (resolved) {
        // Negate the nutrition for removal
        const negated = scaleNutrition(resolved.nutrition, -1);
        customizedNutrition = subtractNutrition(customizedNutrition, resolved.nutrition);
        modifications.push({
          action: "remove",
          item: name,
          nutrition: formatNutritionResponse(negated),
        });
      } else {
        modifications.push({
          action: "remove",
          item: name,
          nutrition: formatNutritionResponse(makeZeroNutrition()),
        });
      }
      removeNames.push(name);
    }
  }

  // Process swaps
  if (customizations.swap && Array.isArray(customizations.swap)) {
    for (const swap of customizations.swap) {
      const fromResolved = resolveIngredientNutrition(swap.from, "standard", chain);
      const toResolved = resolveIngredientNutrition(swap.to, "standard", chain);

      if (fromResolved) {
        customizedNutrition = subtractNutrition(customizedNutrition, fromResolved.nutrition);
      }
      if (toResolved) {
        customizedNutrition = addNutrition(customizedNutrition, toResolved.nutrition);
      }

      // The net nutrition change for the swap
      const netNutrition = makeZeroNutrition();
      for (const key of NUTRITION_KEYS) {
        const fromVal = fromResolved ? (fromResolved.nutrition[key] ?? 0) : 0;
        const toVal = toResolved ? (toResolved.nutrition[key] ?? 0) : 0;
        (netNutrition as any)[key] = round2(toVal - fromVal);
      }

      modifications.push({
        action: "swap",
        item: `${swap.from} -> ${swap.to}`,
        nutrition: formatNutritionResponse(netNutrition),
      });
      swapItems.push(swap);
    }
  }

  const customizedCultureScore = calculateCustomizedCultureScore(
    baseFood.culture_score ?? null,
    originalNutrition.calories,
    customizedNutrition.calories
  );

  const customizedName = buildCustomizedName(
    baseFood.name,
    addNames,
    removeNames,
    swapItems
  );

  return {
    original: {
      id: baseFood.id,
      name: baseFood.name,
      brand: chain,
      nutrition: originalNutrition,
      cultureScore: baseFood.culture_score ?? null,
    },
    customized: {
      name: customizedName,
      modifications,
      nutrition: customizedNutrition,
      cultureScore: customizedCultureScore,
    },
    difference: nutritionDifference(originalNutrition, customizedNutrition),
  };
}

// --- Routes ---

/**
 * POST /foods/:id/customize — Customize an existing food item
 */
customizeRoutes.post("/foods/:id/customize", (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { add, remove, swap } = req.body;

    if (!add && !remove && !swap) {
      res.status(400).json({
        error: "At least one customization is required: add, remove, or swap",
      });
      return;
    }

    const result = applyCustomizations(id, { add, remove, swap });

    if ("error" in result) {
      res.status(404).json({ error: result.error });
      return;
    }

    res.json({
      original: {
        name: result.original.name,
        nutrition: formatNutritionResponse(result.original.nutrition),
        cultureScore: result.original.cultureScore,
      },
      customized: {
        name: result.customized.name,
        modifications: result.customized.modifications,
        nutrition: formatNutritionResponse(result.customized.nutrition),
        cultureScore: result.customized.cultureScore,
      },
      difference: result.difference,
    });
  } catch (err: any) {
    console.error("Customize error:", err);
    res.status(500).json({
      error: "Failed to customize food. " + (err.message || "Unknown error"),
    });
  }
});

/**
 * POST /foods/:id/customize/save — Customize and save as a new community food
 */
customizeRoutes.post(
  "/foods/:id/customize/save",
  (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { add, remove, swap } = req.body;

      if (!add && !remove && !swap) {
        res.status(400).json({
          error: "At least one customization is required: add, remove, or swap",
        });
        return;
      }

      const result = applyCustomizations(id, { add, remove, swap });

      if ("error" in result) {
        res.status(404).json({ error: result.error });
        return;
      }

      const n = result.customized.nutrition;
      const servingSize = (
        db.prepare("SELECT serving_size, serving_unit FROM foods WHERE id = ?").get(id) as any
      );

      // Calculate nutri-score for the customized item
      const portionGrams = servingSize?.serving_size ?? 100;
      const scale = portionGrams > 0 ? 100 / portionGrams : 1;
      const nutriScore = calculateNutriScore({
        calories: n.calories * scale,
        totalSugars: n.total_sugars * scale,
        saturatedFat: n.saturated_fat * scale,
        sodium: n.sodium * scale,
        dietaryFiber: n.dietary_fiber * scale,
        protein: n.protein * scale,
      });

      const foodId = uuid();

      db.prepare(`
        INSERT INTO foods (
          id, name, brand, category, serving_size, serving_unit, source,
          calories, total_fat, saturated_fat, trans_fat, cholesterol, sodium,
          total_carbohydrates, dietary_fiber, total_sugars, protein,
          vitamin_d, calcium, iron, potassium,
          nutri_score, nutri_grade, culture_score, parent_food_id
        ) VALUES (
          ?, ?, ?, ?, ?, ?, 'community',
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?
        )
      `).run(
        foodId,
        result.customized.name,
        result.original.brand,
        "Customized",
        servingSize?.serving_size ?? 100,
        servingSize?.serving_unit ?? "g",
        n.calories,
        n.total_fat,
        n.saturated_fat,
        n.trans_fat,
        n.cholesterol,
        n.sodium,
        n.total_carbohydrates,
        n.dietary_fiber,
        n.total_sugars,
        n.protein,
        n.vitamin_d,
        n.calcium,
        n.iron,
        n.potassium,
        nutriScore.score,
        nutriScore.grade,
        result.customized.cultureScore,
        id
      );

      res.status(201).json({
        id: foodId,
        original: {
          name: result.original.name,
          nutrition: formatNutritionResponse(result.original.nutrition),
          cultureScore: result.original.cultureScore,
        },
        customized: {
          name: result.customized.name,
          modifications: result.customized.modifications,
          nutrition: formatNutritionResponse(result.customized.nutrition),
          cultureScore: result.customized.cultureScore,
          nutriScore: nutriScore.score,
          nutriGrade: nutriScore.grade,
        },
        difference: result.difference,
        message: "Customized food saved to database",
      });
    } catch (err: any) {
      console.error("Customize save error:", err);
      res.status(500).json({
        error:
          "Failed to save customized food. " + (err.message || "Unknown error"),
      });
    }
  }
);
