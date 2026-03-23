/**
 * Health Score Calculator
 *
 * Scores foods 0-100 based on two things:
 * 1. Nutritional density — how much good stuff is in it (protein, fiber, vitamins, minerals)
 * 2. Processing level — how processed is it (ingredient count, seed oils, additives, etc.)
 *
 * Then adjusts based on user preferences.
 */

// --- Ingredient category expansion ---

const INGREDIENT_CATEGORIES: Record<string, string[]> = {
  "seed oils": [
    "canola oil", "soybean oil", "sunflower oil", "corn oil",
    "safflower oil", "grapeseed oil", "cottonseed oil", "rice bran oil",
    "vegetable oil",
  ],
  "artificial sweeteners": [
    "aspartame", "sucralose", "saccharin", "acesulfame potassium",
    "acesulfame k", "neotame",
  ],
  "high fructose corn syrup": ["high fructose corn syrup", "hfcs"],
  "msg": ["monosodium glutamate", "msg"],
  "artificial colors": [
    "red 40", "blue 1", "yellow 5", "yellow 6", "red 3", "blue 2",
    "fd&c red", "fd&c blue", "fd&c yellow",
  ],
};

export function expandIngredientCategory(category: string): string[] {
  const lower = category.toLowerCase().trim();
  return INGREDIENT_CATEGORIES[lower] || [lower];
}

// --- Processing indicators ---

const ULTRA_PROCESSED_MARKERS = [
  "high fructose corn syrup", "hfcs", "hydrogenated", "partially hydrogenated",
  "artificial flavor", "artificial flavour", "natural flavor", "natural flavour",
  "modified food starch", "modified corn starch", "maltodextrin", "dextrose",
  "sodium benzoate", "potassium sorbate", "tbhq", "bht", "bha",
  "carrageenan", "xanthan gum", "guar gum", "cellulose gum",
  "polysorbate", "sodium nitrite", "sodium nitrate",
  "monosodium glutamate", "msg", "autolyzed yeast",
  "aspartame", "sucralose", "saccharin", "acesulfame",
  "red 40", "blue 1", "yellow 5", "yellow 6", "red 3", "blue 2",
  "fd&c", "titanium dioxide", "silicon dioxide",
  "soy lecithin", "mono and diglycerides", "diglycerides",
  "sodium stearoyl lactylate", "datem", "calcium peroxide",
];

const SEED_OIL_TERMS = [
  "canola oil", "soybean oil", "sunflower oil", "corn oil",
  "safflower oil", "grapeseed oil", "cottonseed oil", "rice bran oil",
  "vegetable oil",
];

const WHOLE_FOOD_CATEGORIES = new Set([
  "fruits and fruit juices", "vegetables and vegetable products",
  "legumes and legume products", "finfish and shellfish products",
  "poultry products", "beef products", "pork products",
  "dairy and egg products", "nut and seed products",
  "cereal grains and pasta", "spices and herbs",
  "lamb, veal, and game products", "fats and oils",
]);

const WHOLE_FOOD_CATEGORY_KEYWORDS = [
  "fruit", "vegetable", "meat", "poultry", "fish", "seafood",
  "egg", "dairy", "bean", "legume", "nut", "seed", "grain",
  "herb", "spice", "fresh", "raw", "whole",
];

// --- Types ---

export interface HealthScoreFlag {
  type: "warning" | "positive" | "critical";
  message: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
}

export interface HealthScoreResult {
  score: number;
  flags: HealthScoreFlag[];
  breakdown: {
    nutrition_score: number;
    processing_score: number;
    preference_adjustment: number;
    final_score: number;
  };
}

export interface UserPreferences {
  avoid_ingredients: string | null;
  dietary_goals: string | null;
  health_conditions: string | null;
  calorie_target: number | null;
  protein_target: number | null;
}

// --- Nutritional density score (0-50) ---

function calculateNutritionScore(food: any): { score: number; flags: HealthScoreFlag[] } {
  const flags: HealthScoreFlag[] = [];
  let score = 0;

  // Protein: 0-12 points (per 100g)
  const protein = food.protein || 0;
  if (protein >= 25) { score += 12; flags.push({ type: "positive", message: `High protein (${protein}g)`, severity: "info" }); }
  else if (protein >= 15) { score += 9; flags.push({ type: "positive", message: `Good protein (${protein}g)`, severity: "info" }); }
  else if (protein >= 8) score += 6;
  else if (protein >= 3) score += 3;

  // Fiber: 0-10 points
  const fiber = food.dietary_fiber || 0;
  if (fiber >= 8) { score += 10; flags.push({ type: "positive", message: `Excellent fiber (${fiber}g)`, severity: "info" }); }
  else if (fiber >= 5) { score += 7; flags.push({ type: "positive", message: `Good fiber (${fiber}g)`, severity: "info" }); }
  else if (fiber >= 3) score += 5;
  else if (fiber >= 1) score += 2;

  // Iron: 0-5 points
  const iron = food.iron || 0;
  if (iron >= 4) score += 5;
  else if (iron >= 2) score += 3;
  else if (iron >= 1) score += 1;

  // Calcium: 0-5 points
  const calcium = food.calcium || 0;
  if (calcium >= 200) score += 5;
  else if (calcium >= 100) score += 3;
  else if (calcium >= 50) score += 1;

  // Potassium: 0-5 points
  const potassium = food.potassium || 0;
  if (potassium >= 400) score += 5;
  else if (potassium >= 200) score += 3;
  else if (potassium >= 100) score += 1;

  // Vitamin D: 0-3 points
  const vitD = food.vitamin_d || 0;
  if (vitD >= 2) score += 3;
  else if (vitD >= 1) score += 1;

  // Penalize bad stuff: sugar, sodium, saturated fat
  const sugar = food.total_sugars || 0;
  if (sugar > 30) { score -= 8; flags.push({ type: "warning", message: `Very high sugar (${sugar}g)`, severity: "high" }); }
  else if (sugar > 15) { score -= 5; flags.push({ type: "warning", message: `High sugar (${sugar}g)`, severity: "medium" }); }
  else if (sugar > 8) score -= 2;

  const sodium = food.sodium || 0;
  if (sodium > 800) { score -= 6; flags.push({ type: "warning", message: `Very high sodium (${sodium}mg)`, severity: "high" }); }
  else if (sodium > 400) { score -= 3; flags.push({ type: "warning", message: `High sodium (${sodium}mg)`, severity: "medium" }); }

  const satFat = food.saturated_fat || 0;
  if (satFat > 10) { score -= 5; flags.push({ type: "warning", message: `High saturated fat (${satFat}g)`, severity: "medium" }); }
  else if (satFat > 5) score -= 2;

  const transFat = food.trans_fat || 0;
  if (transFat > 0) {
    score -= 5;
    flags.push({ type: "warning", message: `Contains trans fat (${transFat}g)`, severity: "high" });
  }

  return { score: clamp(score, 0, 50), flags };
}

// --- Processing score (0-50) ---

function calculateProcessingScore(food: any): { score: number; flags: HealthScoreFlag[] } {
  const flags: HealthScoreFlag[] = [];
  let score = 50; // Start at max, deduct for processing

  const ingredients = (food.ingredients_text || "").toLowerCase();

  if (!ingredients) {
    const category = (food.category || "").toLowerCase();
    const name = (food.name || "").toLowerCase();

    // Check if it's a whole food by category
    if (WHOLE_FOOD_CATEGORIES.has(category)) {
      flags.push({ type: "positive", message: "Whole food", severity: "info" });
      return { score: 50, flags };
    }

    // Check category keywords
    const isLikelyWholeFood = WHOLE_FOOD_CATEGORY_KEYWORDS.some(
      (kw) => category.includes(kw)
    );

    // Single-word food names with no ingredients are likely whole foods
    // (e.g., "BROCCOLI", "CHICKEN", "SALMON", "APPLE")
    const isSimpleName = name.split(/[\s,]+/).length <= 2 && !food.brand;

    if (isLikelyWholeFood || isSimpleName) {
      flags.push({ type: "positive", message: "Minimally processed", severity: "info" });
      return { score: 45, flags };
    }

    // Unknown processing — give moderate score
    return { score: 30, flags };
  }

  // Count ingredients (rough: split by comma)
  const ingredientCount = ingredients.split(",").length;
  if (ingredientCount <= 3) {
    score += 0; // already at max
    flags.push({ type: "positive", message: `Minimal ingredients (${ingredientCount})`, severity: "info" });
  } else if (ingredientCount <= 6) {
    score -= 5;
  } else if (ingredientCount <= 12) {
    score -= 10;
  } else if (ingredientCount <= 20) {
    score -= 15;
  } else {
    score -= 25;
    flags.push({ type: "warning", message: `Highly complex ingredient list (${ingredientCount} ingredients)`, severity: "medium" });
  }

  // Check for ultra-processed markers
  let processingHits = 0;
  for (const marker of ULTRA_PROCESSED_MARKERS) {
    if (ingredients.includes(marker)) {
      processingHits++;
    }
  }

  if (processingHits === 0) {
    flags.push({ type: "positive", message: "No ultra-processed additives detected", severity: "info" });
  } else if (processingHits <= 2) {
    score -= 5;
  } else if (processingHits <= 5) {
    score -= 12;
    flags.push({ type: "warning", message: `Contains ${processingHits} processed additives`, severity: "medium" });
  } else {
    score -= 20;
    flags.push({ type: "warning", message: `Highly processed (${processingHits} additives detected)`, severity: "high" });
  }

  // Seed oils
  let hasSeedOil = false;
  for (const oil of SEED_OIL_TERMS) {
    if (ingredients.includes(oil)) {
      hasSeedOil = true;
      break;
    }
  }
  if (hasSeedOil) {
    score -= 8;
    flags.push({ type: "warning", message: "Contains seed oils", severity: "medium" });
  }

  return { score: clamp(score, 0, 50), flags };
}

// --- Preference adjustments ---

function applyPreferences(food: any, preferences: UserPreferences | null): { adjustment: number; flags: HealthScoreFlag[] } {
  if (!preferences) return { adjustment: 0, flags: [] };

  const flags: HealthScoreFlag[] = [];
  let adjustment = 0;
  const ingredients = (food.ingredients_text || "").toLowerCase();

  // Avoid ingredients
  if (preferences.avoid_ingredients) {
    const avoidList = preferences.avoid_ingredients.split(",").map((s: string) => s.trim()).filter(Boolean);
    for (const avoidItem of avoidList) {
      const expanded = expandIngredientCategory(avoidItem);
      for (const term of expanded) {
        if (ingredients.includes(term.toLowerCase())) {
          adjustment -= 15;
          const label = expanded.length > 1 ? ` (${avoidItem})` : "";
          flags.push({ type: "warning", message: `Contains ${term}${label}`, severity: "high" });
          break;
        }
      }
    }
  }

  // Dietary goals
  if (preferences.dietary_goals) {
    const goals = preferences.dietary_goals.split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean);
    for (const goal of goals) {
      switch (goal) {
        case "keto":
        case "low_carb":
          if (food.total_carbohydrates > 20) {
            adjustment -= 10;
            flags.push({ type: "warning", message: `High carbs for ${goal} (${food.total_carbohydrates}g)`, severity: "medium" });
          } else if (food.total_carbohydrates <= 5) {
            adjustment += 5;
          }
          break;
        case "low_sodium":
          if (food.sodium > 400) {
            adjustment -= 10;
            flags.push({ type: "warning", message: `High sodium for low-sodium goal (${food.sodium}mg)`, severity: "medium" });
          }
          break;
        case "high_protein":
          if (food.protein >= 20) adjustment += 5;
          else if (food.protein < 5) adjustment -= 5;
          break;
        case "low_fat":
          if (food.total_fat > 15) adjustment -= 10;
          else if (food.total_fat <= 3) adjustment += 5;
          break;
        case "low_sugar":
          if (food.total_sugars > 10) adjustment -= 10;
          else if (food.total_sugars <= 2) adjustment += 5;
          break;
        case "dairy_free":
          if (checkContains(ingredients, DAIRY_TERMS)) {
            adjustment -= 15;
            flags.push({ type: "warning", message: "Contains dairy", severity: "high" });
          }
          break;
        case "gluten_free":
          if (checkContains(ingredients, GLUTEN_TERMS)) {
            adjustment -= 15;
            flags.push({ type: "warning", message: "Contains gluten", severity: "high" });
          }
          break;
      }
    }
  }

  // Health conditions
  if (preferences.health_conditions) {
    const conditions = preferences.health_conditions.split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean);
    for (const condition of conditions) {
      switch (condition) {
        case "diabetic":
        case "diabetes":
          if (food.total_sugars > 10) {
            adjustment -= 15;
            flags.push({ type: "critical", message: `High sugar — caution for diabetics (${food.total_sugars}g)`, severity: "critical" });
          }
          break;
        case "celiac":
          if (checkContains(ingredients, GLUTEN_TERMS)) {
            adjustment -= 30;
            flags.push({ type: "critical", message: "Contains gluten — unsafe for celiac disease", severity: "critical" });
          }
          break;
        case "lactose_intolerant":
          if (checkContains(ingredients, DAIRY_TERMS)) {
            adjustment -= 20;
            flags.push({ type: "critical", message: "Contains dairy — not suitable for lactose intolerance", severity: "critical" });
          }
          break;
        case "hypertension":
        case "high_blood_pressure":
          if (food.sodium > 400) {
            adjustment -= 15;
            flags.push({ type: "critical", message: `High sodium — caution with hypertension (${food.sodium}mg)`, severity: "critical" });
          }
          break;
      }
    }
  }

  return { adjustment, flags };
}

// --- Main scoring function ---

export function calculatePersonalHealthScore(
  food: any,
  preferences: UserPreferences | null
): HealthScoreResult {
  const nutrition = calculateNutritionScore(food);
  const processing = calculateProcessingScore(food);
  const prefs = applyPreferences(food, preferences);

  const rawScore = nutrition.score + processing.score + prefs.adjustment;
  const finalScore = clamp(rawScore, 0, 100);

  return {
    score: finalScore,
    flags: [...nutrition.flags, ...processing.flags, ...prefs.flags],
    breakdown: {
      nutrition_score: nutrition.score,
      processing_score: processing.score,
      preference_adjustment: prefs.adjustment,
      final_score: finalScore,
    },
  };
}

// --- Helpers ---

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const DAIRY_TERMS = [
  "milk", "cream", "cheese", "butter", "whey", "casein", "lactose",
  "yogurt", "yoghurt", "ghee", "curds",
];

const GLUTEN_TERMS = [
  "wheat", "gluten", "barley", "rye", "triticale", "spelt", "kamut",
  "semolina", "durum", "farina", "bulgur", "couscous",
];

function checkContains(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}
