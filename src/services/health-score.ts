/**
 * Health Score Calculator
 *
 * Based on two peer-reviewed systems:
 *
 * 1. NRF 9.3 Index (Nutrient Rich Foods)
 *    - Published in the American Journal of Clinical Nutrition
 *    - 9 nutrients to encourage per 100 kcal: protein, fiber, vitamin A, vitamin C,
 *      vitamin D, calcium, iron, potassium, magnesium
 *    - 3 nutrients to limit per 100 kcal: saturated fat, added sugar, sodium
 *    - Score = sum(nutrient/DV * 100) for encourage - sum(nutrient/DV * 100) for limit
 *
 * 2. NOVA Classification (University of São Paulo, endorsed by WHO/FAO)
 *    - NOVA 1: Unprocessed or minimally processed foods
 *    - NOVA 2: Processed culinary ingredients
 *    - NOVA 3: Processed foods
 *    - NOVA 4: Ultra-processed food products
 *
 * Final score = NRF component (0-70) + NOVA component (0-30) + user preference adjustments
 * Scaled to 0-100.
 */

// --- Ingredient category expansion (for user preferences) ---

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

// --- Daily Values (FDA 2020) used for NRF 9.3 ---

const DAILY_VALUES = {
  protein: 50,        // g
  fiber: 28,          // g
  vitaminA: 900,      // mcg RAE (not in our DB, we'll skip)
  vitaminC: 90,       // mg (not in our DB, we'll skip)
  vitaminD: 20,       // mcg
  calcium: 1300,      // mg
  iron: 18,           // mg
  potassium: 4700,    // mg
  magnesium: 420,     // mg (not in our DB, we'll skip)
  saturatedFat: 20,   // g
  addedSugar: 50,     // g (we use total sugars as proxy)
  sodium: 2300,       // mg
};

// --- NRF 9.3 Score (per 100 kcal) → scaled to 0-70 ---

function calculateNRF(food: any): { score: number; rawNrf: number; flags: HealthScoreFlag[] } {
  const flags: HealthScoreFlag[] = [];
  const calories = food.calories || 0;

  // Avoid division by zero — foods with 0 calories
  if (calories === 0) {
    return { score: 35, rawNrf: 0, flags: [{ type: "positive", message: "Zero calorie food", severity: "info" }] };
  }

  // Scale factor: nutrients per 100 kcal
  const scale = 100 / calories;

  // 9 nutrients to encourage (% of DV per 100 kcal), capped at 100% each
  const encourageProtein = Math.min(100, ((food.protein || 0) * scale / DAILY_VALUES.protein) * 100);
  const encourageFiber = Math.min(100, ((food.dietary_fiber || 0) * scale / DAILY_VALUES.fiber) * 100);
  const encourageVitD = Math.min(100, ((food.vitamin_d || 0) * scale / DAILY_VALUES.vitaminD) * 100);
  const encourageCalcium = Math.min(100, ((food.calcium || 0) * scale / DAILY_VALUES.calcium) * 100);
  const encourageIron = Math.min(100, ((food.iron || 0) * scale / DAILY_VALUES.iron) * 100);
  const encouragePotassium = Math.min(100, ((food.potassium || 0) * scale / DAILY_VALUES.potassium) * 100);

  // We don't have vitamin A, vitamin C, or magnesium in our DB
  // Use 6 of the 9 nutrients, scale accordingly
  const encourageTotal = encourageProtein + encourageFiber + encourageVitD
    + encourageCalcium + encourageIron + encouragePotassium;

  // 3 nutrients to limit (% of DV per 100 kcal), NOT capped
  const limitSatFat = ((food.saturated_fat || 0) * scale / DAILY_VALUES.saturatedFat) * 100;
  const limitSugar = ((food.total_sugars || 0) * scale / DAILY_VALUES.addedSugar) * 100;
  const limitSodium = ((food.sodium || 0) * scale / DAILY_VALUES.sodium) * 100;

  const limitTotal = limitSatFat + limitSugar + limitSodium;

  // Raw NRF score (can be negative)
  const rawNrf = encourageTotal - limitTotal;

  // Pros: only flag what's genuinely good about this food
  if (food.protein >= 20) flags.push({ type: "positive", message: `High protein (${food.protein}g)`, severity: "info" });
  else if (food.protein >= 10) flags.push({ type: "positive", message: `Good protein (${food.protein}g)`, severity: "info" });
  if (food.dietary_fiber >= 5) flags.push({ type: "positive", message: `High fiber (${food.dietary_fiber}g)`, severity: "info" });
  else if (food.dietary_fiber >= 3) flags.push({ type: "positive", message: `Good fiber (${food.dietary_fiber}g)`, severity: "info" });
  if ((food.iron || 0) >= 3) flags.push({ type: "positive", message: `Rich in iron (${food.iron}mg)`, severity: "info" });
  if ((food.calcium || 0) >= 200) flags.push({ type: "positive", message: `Rich in calcium (${food.calcium}mg)`, severity: "info" });
  if ((food.potassium || 0) >= 300) flags.push({ type: "positive", message: `Good potassium (${food.potassium}mg)`, severity: "info" });
  if (food.calories > 0 && food.calories <= 50) flags.push({ type: "positive", message: `Very low calorie (${food.calories} kcal)`, severity: "info" });

  // Cons: only flag what's actively bad — things that ARE in the food, not what's missing
  if (food.total_sugars > 15) flags.push({ type: "warning", message: `High sugar (${food.total_sugars}g)`, severity: "high" });
  else if (food.total_sugars > 8) flags.push({ type: "warning", message: `Moderate sugar (${food.total_sugars}g)`, severity: "medium" });
  if (food.sodium > 600) flags.push({ type: "warning", message: `High sodium (${food.sodium}mg)`, severity: "high" });
  else if (food.sodium > 300) flags.push({ type: "warning", message: `Moderate sodium (${food.sodium}mg)`, severity: "medium" });
  if (food.saturated_fat > 5) flags.push({ type: "warning", message: `High saturated fat (${food.saturated_fat}g)`, severity: "medium" });
  if (food.trans_fat > 0) flags.push({ type: "warning", message: `Contains trans fat (${food.trans_fat}g)`, severity: "high" });
  if (food.cholesterol > 200) flags.push({ type: "warning", message: `High cholesterol (${food.cholesterol}mg)`, severity: "medium" });

  // Map raw NRF to 0-70 scale
  // We only have 6 of 9 encourage nutrients, so raw scores are compressed.
  // Compensate by scaling up: multiply raw by 9/6 = 1.5 to estimate full NRF.
  const adjustedNrf = rawNrf * 1.5;

  // Adjusted ranges:
  //   Chicken breast: ~49, Broccoli: ~64, Egg: ~48
  //   Yogurt: ~58, Apple: ~-20, Big Mac: ~-15
  //   Soda: ~-76, Snickers: ~-39
  //
  // Target: whole foods (adjusted 40-80) → 55-70/70
  //         decent foods (0-40) → 30-55/70
  //         poor foods (-50 to 0) → 10-30/70
  //         terrible (-100+) → 0-10/70
  let nrfScore: number;
  if (adjustedNrf <= -50) {
    nrfScore = clamp(Math.round(10 + (adjustedNrf + 100) / 50 * 10), 0, 10);
  } else if (adjustedNrf <= 0) {
    nrfScore = Math.round(10 + (adjustedNrf + 50) / 50 * 20); // 10-30
  } else if (adjustedNrf <= 40) {
    nrfScore = Math.round(30 + (adjustedNrf / 40) * 25); // 30-55
  } else if (adjustedNrf <= 100) {
    nrfScore = Math.round(55 + (adjustedNrf - 40) / 60 * 10); // 55-65
  } else {
    nrfScore = Math.round(65 + Math.min(adjustedNrf - 100, 100) / 100 * 5); // 65-70
  }

  return { score: nrfScore, rawNrf: Math.round(rawNrf * 10) / 10, flags };
}

// --- NOVA Classification → scaled to 0-30 ---

// NOVA 4 ultra-processed markers
const NOVA4_MARKERS = [
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
  "mono and diglycerides", "diglycerides",
  "sodium stearoyl lactylate", "datem", "calcium peroxide",
  "soy protein isolate", "whey protein isolate", "hydrolyzed",
  "interesterified", "invert sugar", "isoglucose",
];

// NOVA 3 processed markers
const NOVA3_MARKERS = [
  "canned", "smoked", "cured", "salted", "pickled", "preserved",
];

// Categories that are typically NOVA 1 — things you pick, catch, or harvest
const NOVA1_CATEGORIES = [
  "fruit", "vegetable", "meat", "poultry", "chicken", "turkey",
  "beef", "pork", "lamb", "veal", "game", "bison", "venison",
  "fish", "seafood", "shellfish", "salmon", "tuna", "shrimp",
  "egg", "legume", "bean", "lentil",
  "nut", "seed", "almond", "walnut", "pecan",
  "herb", "spice",
  "fresh", "raw", "whole piece",
];

// Foods that are NEVER NOVA 1 — always involve processing
const ALWAYS_PROCESSED_KEYWORDS = [
  "cheese", "yogurt", "yoghurt", "bread", "pasta", "cereal",
  "cracker", "chip", "cookie", "cake", "candy", "chocolate",
  "soda", "juice", "sausage", "bacon", "ham", "jerky",
  "ice cream", "frozen", "canned", "dried", "smoked", "cured",
  "sauce", "dressing", "syrup", "jam", "jelly", "spread",
  "bar", "snack", "pizza", "burger", "fries", "nugget",
  "tortilla", "wrap", "biscuit", "muffin", "waffle", "pancake",
];

// Known ultra-processed products by category/name keywords
const NOVA4_CATEGORIES = [
  "candy", "chocolate", "cookie", "biscuit", "cake", "snack cake",
  "soda", "soft drink", "energy drink", "sport drink",
  "chips", "pretzel", "popcorn", "snack",
  "ice cream", "frozen dessert", "frozen yogurt",
  "hot dog", "corn dog", "nugget",
  "coca-cola", "pepsi", "sprite", "fanta", "mountain dew",
  "dr pepper", "7up", "gatorade", "powerade", "red bull",
  "monster energy", "rockstar",
  "lemonade", "fruit punch", "kool-aid",
];

// Categories that are NOVA 2
const NOVA2_KEYWORDS = [
  "oil", "butter", "sugar", "honey", "flour", "starch",
  "salt", "vinegar", "cream",
];

function classifyNOVA(food: any): { nova: number; score: number; flags: HealthScoreFlag[] } {
  const flags: HealthScoreFlag[] = [];
  const ingredients = (food.ingredients_text || "").toLowerCase();
  const category = (food.category || "").toLowerCase();
  const name = (food.name || "").toLowerCase();
  const hasBrand = !!food.brand;

  // Fast food chains are ultra-processed by definition
  const ULTRA_PROCESSED_BRANDS = [
    "mcdonald's", "burger king", "wendy's", "taco bell", "kfc",
    "popeyes", "dunkin'", "dunkin", "subway", "domino's", "pizza hut",
    "papa john's", "papa johns", "sonic", "jack in the box", "arby's",
    "carl's jr", "hardee's", "dairy queen", "five guys", "whataburger",
    "panda express", "little caesars", "del taco", "wingstop",
    "jimmy john's", "jersey mike's", "firehouse subs",
  ];

  const brandLower = (food.brand || "").toLowerCase();
  const isKnownUltraProcessedBrand = ULTRA_PROCESSED_BRANDS.some((b) => brandLower.includes(b));

  if (isKnownUltraProcessedBrand) {
    flags.push({ type: "warning", message: "Ultra-processed (NOVA 4) — fast food chain", severity: "high" });
    return { nova: 4, score: 5, flags };
  }

  // If we have ingredients, check for NOVA 4 markers
  if (ingredients) {
    let nova4Hits = 0;
    for (const marker of NOVA4_MARKERS) {
      if (ingredients.includes(marker)) nova4Hits++;
    }

    const ingredientCount = ingredients.split(",").length;

    if (nova4Hits >= 3 || (nova4Hits >= 1 && ingredientCount > 15)) {
      flags.push({ type: "warning", message: `Ultra-processed (NOVA 4) — ${nova4Hits} additives detected`, severity: "high" });
      return { nova: 4, score: 5, flags };
    }

    if (nova4Hits >= 1) {
      flags.push({ type: "warning", message: `Processed (NOVA 3-4) — contains some additives`, severity: "medium" });
      return { nova: 4, score: 10, flags };
    }

    // Check NOVA 3
    const hasNova3 = NOVA3_MARKERS.some((m) => ingredients.includes(m) || category.includes(m));
    if (hasNova3 || ingredientCount > 5) {
      flags.push({ type: "positive", message: "Processed food (NOVA 3)", severity: "info" });
      return { nova: 3, score: 18, flags };
    }

    // Simple ingredient list, no additives
    if (ingredientCount <= 3) {
      flags.push({ type: "positive", message: "Minimally processed (NOVA 1)", severity: "info" });
      return { nova: 1, score: 30, flags };
    }

    flags.push({ type: "positive", message: "Lightly processed (NOVA 2-3)", severity: "info" });
    return { nova: 2, score: 22, flags };
  }

  // No ingredients text — infer from category and name
  const isLikelyWholeFood = NOVA1_CATEGORIES.some((kw) => category.includes(kw) || name.includes(kw));
  const isSimpleName = name.split(/[\s,]+/).length <= 2 && !hasBrand;
  const isCulinaryIngredient = NOVA2_KEYWORDS.some((kw) => category.includes(kw) || name === kw);

  // Branded products without ingredients are likely processed
  if (hasBrand && !isLikelyWholeFood) {
    return { nova: 3, score: 15, flags: [{ type: "warning", message: "Likely processed (branded, no ingredient data)", severity: "low" }] };
  }

  // Check if category/name matches known ultra-processed types
  const isNova4Category = NOVA4_CATEGORIES.some((kw) => category.includes(kw) || name.includes(kw));
  if (isNova4Category) {
    flags.push({ type: "warning", message: "Ultra-processed (NOVA 4)", severity: "high" });
    return { nova: 4, score: 5, flags };
  }

  // Check if this is something that's always processed (cheese, bread, yogurt, etc.)
  // Use word boundary check to avoid "juice" matching "Fruits and Fruit Juices"
  const matchesWord = (text: string, kw: string) => {
    const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\\\]/g, "\\$&")}\\b`, "i");
    return regex.test(text);
  };
  // Only check the name, not the broad USDA category (which often contains unrelated words)
  const isAlwaysProcessed = ALWAYS_PROCESSED_KEYWORDS.some((kw) => matchesWord(name, kw));
  if (isAlwaysProcessed) {
    flags.push({ type: "warning", message: "Processed food (NOVA 3)", severity: "low" });
    return { nova: 3, score: 18, flags };
  }

  // Nutritional profile check: high sugar + low protein + low fiber = not a whole food
  const sugar = food.total_sugars || 0;
  const protein = food.protein || 0;
  const fiber = food.dietary_fiber || 0;
  if (sugar > 8 && protein < 3 && fiber < 2) {
    return { nova: 3, score: 15, flags: [{ type: "warning", message: "Likely processed (high sugar, low nutrient profile)", severity: "medium" }] };
  }

  if (isCulinaryIngredient) {
    flags.push({ type: "positive", message: "Culinary ingredient (NOVA 2)", severity: "info" });
    return { nova: 2, score: 25, flags };
  }

  if (isLikelyWholeFood || isSimpleName) {
    flags.push({ type: "positive", message: "Minimally processed (NOVA 1)", severity: "info" });
    return { nova: 1, score: 30, flags };
  }

  // Unknown — assume moderate processing
  return { nova: 3, score: 15, flags };
}

// --- Types ---

export interface HealthScoreFlag {
  type: "warning" | "positive" | "critical";
  message: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
}

export interface HealthScoreResult {
  score: number;
  label: string;
  color: string;
  flags: HealthScoreFlag[];
  breakdown: {
    nrf_score: number;
    nrf_raw: number;
    nova_class: number;
    nova_score: number;
    preference_adjustment: number;
    final_score: number;
  };
}

function scoreToLabel(score: number): { label: string; color: string } {
  if (score >= 75) return { label: "Excellent", color: "#2ECC71" };
  if (score >= 50) return { label: "Good", color: "#F1C40F" };
  if (score >= 25) return { label: "Poor", color: "#E67E22" };
  return { label: "Bad", color: "#E74C3C" };
}

export interface UserPreferences {
  avoid_ingredients: string | null;
  dietary_goals: string | null;
  health_conditions: string | null;
  calorie_target: number | null;
  protein_target: number | null;
}

// --- Preference adjustments ---

function applyPreferences(food: any, preferences: UserPreferences | null): { adjustment: number; flags: HealthScoreFlag[] } {
  if (!preferences) return { adjustment: 0, flags: [] };

  const flags: HealthScoreFlag[] = [];
  let adjustment = 0;
  const ingredients = (food.ingredients_text || "").toLowerCase();

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

  if (preferences.dietary_goals) {
    const goals = preferences.dietary_goals.split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean);
    for (const goal of goals) {
      switch (goal) {
        case "keto":
        case "low_carb":
          if (food.total_carbohydrates > 20) {
            adjustment -= 10;
            flags.push({ type: "warning", message: `High carbs for ${goal} (${food.total_carbohydrates}g)`, severity: "medium" });
          } else if (food.total_carbohydrates <= 5) adjustment += 5;
          break;
        case "low_sodium":
          if (food.sodium > 400) { adjustment -= 10; flags.push({ type: "warning", message: `High sodium (${food.sodium}mg)`, severity: "medium" }); }
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
          if (checkContains(ingredients, DAIRY_TERMS)) { adjustment -= 15; flags.push({ type: "warning", message: "Contains dairy", severity: "high" }); }
          break;
        case "gluten_free":
          if (checkContains(ingredients, GLUTEN_TERMS)) { adjustment -= 15; flags.push({ type: "warning", message: "Contains gluten", severity: "high" }); }
          break;
      }
    }
  }

  if (preferences.health_conditions) {
    const conditions = preferences.health_conditions.split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean);
    for (const condition of conditions) {
      switch (condition) {
        case "diabetic":
        case "diabetes":
          if (food.total_sugars > 10) { adjustment -= 15; flags.push({ type: "critical", message: `High sugar — caution for diabetics (${food.total_sugars}g)`, severity: "critical" }); }
          break;
        case "celiac":
          if (checkContains(ingredients, GLUTEN_TERMS)) { adjustment -= 30; flags.push({ type: "critical", message: "Contains gluten — unsafe for celiac disease", severity: "critical" }); }
          break;
        case "lactose_intolerant":
          if (checkContains(ingredients, DAIRY_TERMS)) { adjustment -= 20; flags.push({ type: "critical", message: "Contains dairy", severity: "critical" }); }
          break;
        case "hypertension":
        case "high_blood_pressure":
          if (food.sodium > 400) { adjustment -= 15; flags.push({ type: "critical", message: `High sodium (${food.sodium}mg)`, severity: "critical" }); }
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
  // Zero nutrition = zero score. No protein, no fiber, no vitamins, no minerals = nothing.
  const protein = food.protein || 0;
  const fiber = food.dietary_fiber || 0;
  const iron = food.iron || 0;
  const calcium = food.calcium || 0;
  const potassium = food.potassium || 0;
  const vitD = food.vitamin_d || 0;
  const hasNutrition = protein >= 1 || fiber >= 1 || iron >= 1 || calcium >= 30 || potassium >= 50 || vitD >= 0.5;

  if (!hasNutrition) {
    const prefs = applyPreferences(food, preferences);
    const { label, color } = scoreToLabel(0);
    return {
      score: 0,
      label,
      color,
      flags: [
        { type: "warning", message: "Empty calories — sugar and nothing else", severity: "high" },
        ...prefs.flags,
      ],
      breakdown: { nrf_score: 0, nrf_raw: 0, nova_class: 4, nova_score: 0, preference_adjustment: prefs.adjustment, final_score: 0 },
    };
  }

  const nrf = calculateNRF(food);
  const nova = classifyNOVA(food);
  const prefs = applyPreferences(food, preferences);

  let rawScore: number;

  if (nova.nova === 1) {
    // NOVA 1: Whole unprocessed foods. These are the gold standard.
    // Base is 95-100, only minor deductions for nutritional tradeoffs
    // (e.g., whole milk has sat fat, honey is pure sugar but still natural)
    const limitPenalty = Math.min(15, Math.max(0,
      (food.saturated_fat > 5 ? 3 : 0) +
      (food.total_sugars > 15 ? 5 : food.total_sugars > 8 ? 2 : 0) +
      (food.sodium > 300 ? 3 : 0) +
      (food.trans_fat > 0 ? 4 : 0)
    ));
    rawScore = 100 - limitPenalty + prefs.adjustment;
  } else if (nova.nova === 2) {
    // NOVA 2: Culinary ingredients (oils, butter, sugar, flour)
    // Good when used in cooking, scored 60-80 based on nutrition
    rawScore = 60 + Math.round(nrf.score / 70 * 20) + prefs.adjustment;
  } else if (nova.nova === 3) {
    // NOVA 3: Processed foods (canned, cured, cheese, etc.)
    // Scored 20-55 based on nutrition
    // But if it has essentially zero nutritional value, floor drops to 5
    const hasNutrition = (food.protein || 0) >= 2 || (food.dietary_fiber || 0) >= 1;
    const base = hasNutrition ? 20 : 5;
    const range = hasNutrition ? 35 : 15;
    rawScore = base + Math.round(nrf.score / 70 * range) + prefs.adjustment;
  } else {
    // NOVA 4: Ultra-processed
    // Scored 0-25 based on whatever nutrition they have
    rawScore = Math.round(nrf.score / 70 * 25) + prefs.adjustment;
  }

  const finalScore = clamp(rawScore, 0, 100);

  const { label, color } = scoreToLabel(finalScore);

  return {
    score: finalScore,
    label,
    color,
    flags: [...nrf.flags, ...nova.flags, ...prefs.flags],
    breakdown: {
      nrf_score: nrf.score,
      nrf_raw: nrf.rawNrf,
      nova_class: nova.nova,
      nova_score: nova.score,
      preference_adjustment: prefs.adjustment,
      final_score: finalScore,
    },
  };
}

// --- Helpers ---

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const DAIRY_TERMS = ["milk", "cream", "cheese", "butter", "whey", "casein", "lactose", "yogurt", "yoghurt", "ghee", "curds"];
const GLUTEN_TERMS = ["wheat", "gluten", "barley", "rye", "triticale", "spelt", "kamut", "semolina", "durum", "farina", "bulgur", "couscous"];

function checkContains(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}
