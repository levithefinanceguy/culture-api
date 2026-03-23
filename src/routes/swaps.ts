import { Router, Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import db from "../data/database";
import { calculatePersonalHealthScore, UserPreferences, expandIngredientCategory } from "../services/health-score";
import { fuzzySearchSingle } from "../services/fuzzy-search";

export const swapRoutes = Router();

// --- Types ---

interface SwapSuggestion {
  name: string;
  reason: string;
  estimated_calories?: number;
  estimated_protein?: number;
}

// --- Gemini prompt ---

const SWAP_PROMPT = `You are a nutrition expert. The user wants to swap an ingredient in a recipe or meal.

Given the ingredient to swap and the reason, suggest 3-5 alternative ingredients.

For each suggestion, provide:
- name: a simple, searchable food name (e.g. "nutritional yeast" not "Bragg nutritional yeast flakes")
- reason: brief explanation of why this works as a swap (1 sentence)
- estimated_calories: estimated calories per typical serving amount used in this context
- estimated_protein: estimated protein grams per typical serving

Return ONLY valid JSON — no markdown fences, no explanation:
[
  {"name": "nutritional yeast", "reason": "Cheesy flavor without dairy, high in B vitamins", "estimated_calories": 20, "estimated_protein": 3}
]

If you cannot suggest alternatives, return an empty array: []`;

// --- Search helper ---

function searchFood(query: string): any | null {
  const cleanQuery = query.toLowerCase().replace(/[^\w\s]/g, "").trim();
  if (!cleanQuery) return null;

  const words = cleanQuery.split(/\s+/).filter((w) => w.length > 0);

  const rankExpr = `
    fts.rank
    + CASE WHEN lower(f.name) = lower(@rawQuery) THEN -1000 ELSE 0 END
    + CASE WHEN f.brand IS NULL OR f.brand = '' THEN -50 ELSE 0 END
    + CASE WHEN f.source = 'usda' THEN -30 ELSE 0 END
    + length(f.name) * 0.5`;

  // Try exact phrase
  try {
    const phraseQuery = `"${words.join(" ")}"`;
    const result = db.prepare(
      `SELECT f.* FROM foods f
       JOIN foods_fts fts ON f.rowid = fts.rowid
       WHERE foods_fts MATCH @q
       ORDER BY (${rankExpr})
       LIMIT 1`
    ).get({ q: phraseQuery, rawQuery: cleanQuery });
    if (result) return result;
  } catch {}

  // Try prefix matching
  try {
    const ftsQuery = words.map((w) => `"${w}"*`).join(" ");
    const result = db.prepare(
      `SELECT f.* FROM foods f
       JOIN foods_fts fts ON f.rowid = fts.rowid
       WHERE foods_fts MATCH @q
       ORDER BY (${rankExpr})
       LIMIT 1`
    ).get({ q: ftsQuery, rawQuery: cleanQuery });
    if (result) return result;
  } catch {}

  // Try OR logic
  try {
    const ftsQuery = words.map((w) => `"${w}"*`).join(" OR ");
    const result = db.prepare(
      `SELECT f.* FROM foods f
       JOIN foods_fts fts ON f.rowid = fts.rowid
       WHERE foods_fts MATCH @q
       ORDER BY (${rankExpr})
       LIMIT 1`
    ).get({ q: ftsQuery, rawQuery: cleanQuery });
    if (result) return result;
  } catch {}

  // LIKE fallback
  try {
    const result = db.prepare(
      `SELECT * FROM foods
       WHERE lower(name) LIKE @pattern
       ORDER BY
         CASE WHEN lower(name) = lower(@rawQuery) THEN 0 ELSE 1 END,
         CASE WHEN brand IS NULL OR brand = '' THEN 0 ELSE 1 END,
         CASE WHEN source = 'usda' THEN 0 ELSE 1 END,
         length(name) ASC
       LIMIT 1`
    ).get({ pattern: `%${cleanQuery}%`, rawQuery: cleanQuery });
    if (result) return result;
  } catch {}

  // Fuzzy search
  try {
    const fuzzyResult = fuzzySearchSingle(cleanQuery);
    if (fuzzyResult.food) return fuzzyResult.food;
  } catch {}

  return null;
}

function formatFood(row: any) {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    category: row.category,
    servingSize: row.serving_size,
    servingUnit: row.serving_unit,
    nutriScore: row.nutri_score,
    nutriGrade: row.nutri_grade,
    nutrition: {
      calories: row.calories,
      totalFat: row.total_fat,
      saturatedFat: row.saturated_fat,
      transFat: row.trans_fat,
      cholesterol: row.cholesterol,
      sodium: row.sodium,
      totalCarbohydrates: row.total_carbohydrates,
      dietaryFiber: row.dietary_fiber,
      totalSugars: row.total_sugars,
      protein: row.protein,
      vitaminD: row.vitamin_d,
      calcium: row.calcium,
      iron: row.iron,
      potassium: row.potassium,
    },
  };
}

function getUserPreferences(apiKey: string): UserPreferences | null {
  const row = db.prepare("SELECT * FROM user_preferences WHERE api_key = ?").get(apiKey) as any;
  if (!row) return null;
  return {
    avoid_ingredients: row.avoid_ingredients,
    dietary_goals: row.dietary_goals,
    health_conditions: row.health_conditions,
    calorie_target: row.calorie_target,
    protein_target: row.protein_target,
  };
}

// Check if a food conflicts with user's avoid list
function conflictsWithPreferences(food: any, preferences: UserPreferences | null): boolean {
  if (!preferences || !preferences.avoid_ingredients) return false;

  const ingredientsText = (food.ingredients_text || "").toLowerCase();
  const foodName = (food.name || "").toLowerCase();
  const avoidList = preferences.avoid_ingredients.split(",").map((s: string) => s.trim()).filter(Boolean);

  for (const avoidItem of avoidList) {
    const expanded = expandIngredientCategory(avoidItem);
    for (const term of expanded) {
      const lower = term.toLowerCase();
      if (ingredientsText.includes(lower) || foodName.includes(lower)) {
        return true;
      }
    }
  }
  return false;
}

// --- POST /swap ---
swapRoutes.post("/swap", async (req: Request, res: Response) => {
  try {
    const { food_id, ingredients, swap_out, reason } = req.body;
    const apiKey = req.headers["x-api-key"] as string || req.query.api_key as string;

    if (!swap_out) {
      res.status(400).json({ error: "swap_out is required — the ingredient you want to replace" });
      return;
    }

    if (!reason) {
      res.status(400).json({ error: "reason is required — e.g. 'dairy_free', 'low_calorie', 'keto'" });
      return;
    }

    if (!food_id && !ingredients) {
      res.status(400).json({
        error: "Provide either food_id or ingredients array",
        examples: [
          { food_id: "some-id", swap_out: "cheese", reason: "dairy_free" },
          { ingredients: ["White Rice", "Chicken", "Cheese"], swap_out: "Cheese", reason: "dairy_free" },
        ],
      });
      return;
    }

    // Resolve the ingredient list
    let ingredientList: string[] = [];
    let originalFood: any = null;

    if (food_id) {
      originalFood = db.prepare("SELECT * FROM foods WHERE id = ?").get(food_id) as any;
      if (!originalFood) {
        res.status(404).json({ error: "Food not found" });
        return;
      }

      // Try recipe_ingredients first
      const recipeIngredients = db.prepare(`
        SELECT f.name FROM recipe_ingredients ri
        JOIN foods f ON f.id = ri.ingredient_food_id
        WHERE ri.food_id = ?
      `).all(food_id) as any[];

      if (recipeIngredients.length > 0) {
        ingredientList = recipeIngredients.map((r: any) => r.name);
      } else if (originalFood.ingredients_text) {
        // Parse ingredients_text
        ingredientList = originalFood.ingredients_text
          .split(/[,;]/)
          .map((s: string) => s.trim())
          .filter(Boolean)
          .slice(0, 20); // limit to top 20
      }
    } else {
      ingredientList = ingredients;
    }

    // Find the original ingredient in our DB
    const originalIngredient = searchFood(swap_out);
    const originalNutrition = originalIngredient
      ? {
          calories: originalIngredient.calories,
          total_fat: originalIngredient.total_fat,
          saturated_fat: originalIngredient.saturated_fat,
          sodium: originalIngredient.sodium,
          total_carbohydrates: originalIngredient.total_carbohydrates,
          dietary_fiber: originalIngredient.dietary_fiber,
          total_sugars: originalIngredient.total_sugars,
          protein: originalIngredient.protein,
        }
      : null;

    // Get user preferences
    const preferences = getUserPreferences(apiKey);

    // Call Gemini for swap suggestions
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      res.status(503).json({ error: "Swap suggestions require GEMINI_API_KEY to be configured" });
      return;
    }

    const contextStr = ingredientList.length > 0
      ? `\nThe full recipe/meal ingredients are: ${ingredientList.join(", ")}`
      : "";

    const prefsStr = preferences?.avoid_ingredients
      ? `\nIMPORTANT: The user avoids these ingredients: ${preferences.avoid_ingredients}. Do NOT suggest any of these.`
      : "";

    const prompt = `${SWAP_PROMPT}

The user wants to swap "${swap_out}" because: ${reason}.${contextStr}${prefsStr}

Suggest 3-5 alternatives:`;

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Gemini timeout")), 15000)
      ),
    ]);

    const text = result.response.text().trim();
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let geminiSuggestions: SwapSuggestion[];
    try {
      geminiSuggestions = JSON.parse(cleaned);
      if (!Array.isArray(geminiSuggestions)) {
        geminiSuggestions = [];
      }
    } catch {
      geminiSuggestions = [];
    }

    // For each suggestion, find the actual food in our database and compute nutrition diff
    const suggestions = [];
    for (const suggestion of geminiSuggestions) {
      if (!suggestion.name) continue;

      const match = searchFood(suggestion.name);

      // Skip if it conflicts with user preferences
      if (match && conflictsWithPreferences(match, preferences)) {
        continue;
      }

      let nutritionChange: Record<string, number> | null = null;
      let compatibilityScore = 0.5;

      if (match && originalNutrition) {
        nutritionChange = {
          calories: round(match.calories - originalNutrition.calories),
          total_fat: round(match.total_fat - originalNutrition.total_fat),
          saturated_fat: round(match.saturated_fat - originalNutrition.saturated_fat),
          sodium: round(match.sodium - originalNutrition.sodium),
          total_carbohydrates: round(match.total_carbohydrates - originalNutrition.total_carbohydrates),
          protein: round(match.protein - originalNutrition.protein),
        };

        // Calculate compatibility score based on reason
        compatibilityScore = calculateCompatibility(match, originalNutrition, reason);
      } else if (match) {
        compatibilityScore = 0.7; // have a match but no original to compare
      }

      // If user has preferences, boost score for foods that pass health score well
      if (match && preferences) {
        const healthScore = calculatePersonalHealthScore(match, preferences);
        // Blend compatibility with health score
        compatibilityScore = compatibilityScore * 0.6 + (healthScore.score / 100) * 0.4;
      }

      suggestions.push({
        name: suggestion.name,
        match: match ? formatFood(match) : null,
        reason: suggestion.reason || "Alternative suggestion",
        nutrition_change: nutritionChange,
        compatibility_score: round(compatibilityScore, 2),
      });
    }

    // Sort by compatibility score descending
    suggestions.sort((a, b) => b.compatibility_score - a.compatibility_score);

    res.json({
      original: {
        name: swap_out,
        match: originalIngredient ? formatFood(originalIngredient) : null,
        nutrition: originalNutrition,
      },
      reason,
      suggestions,
      user_preferences_applied: preferences !== null,
    });
  } catch (err: any) {
    console.error("Swap error:", err);
    if (err.message === "Gemini timeout") {
      res.status(504).json({ error: "AI suggestion request timed out. Please try again." });
      return;
    }
    res.status(500).json({ error: "Failed to generate swap suggestions. " + (err.message || "Unknown error") });
  }
});

// --- GET /foods/:id/health-score ---
swapRoutes.get("/foods/:id/health-score", (req: Request, res: Response) => {
  const apiKey = req.headers["x-api-key"] as string || req.query.api_key as string;

  const food = db.prepare("SELECT * FROM foods WHERE id = ?").get(req.params.id) as any;
  if (!food) {
    res.status(404).json({ error: "Food not found" });
    return;
  }

  const preferences = getUserPreferences(apiKey);
  const baseResult = calculatePersonalHealthScore(food, null);
  const personalResult = preferences ? calculatePersonalHealthScore(food, preferences) : null;

  // Build pros and cons from flags
  const pros: string[] = [];
  const cons: string[] = [];
  for (const flag of baseResult.flags) {
    if (flag.type === "positive") pros.push(flag.message);
    else cons.push(flag.message);
  }

  // Build your_score with explanation
  let yourScore = null;
  if (personalResult && preferences) {
    const diff = personalResult.score - baseResult.score;
    const adjustmentReasons: { reason: string; impact: string }[] = [];

    for (const flag of personalResult.flags) {
      // Only include flags that aren't in the base result
      const isNew = !baseResult.flags.some((f) => f.message === flag.message);
      if (isNew) {
        const impact = flag.type === "positive" ? "+" : "-";
        adjustmentReasons.push({ reason: flag.message, impact });
      }
    }

    let summary = "";
    if (diff > 0) {
      summary = `Your score is higher because ${adjustmentReasons.filter((r) => r.impact === "+").map((r) => r.reason.toLowerCase()).join(" and ") || "it matches your dietary goals"}`;
    } else if (diff < 0) {
      summary = `Your score is lower because ${adjustmentReasons.filter((r) => r.impact === "-").map((r) => r.reason.toLowerCase()).join(" and ") || "it conflicts with your preferences"}`;
    } else {
      summary = "Your preferences don't affect this food's score";
    }

    yourScore = {
      score: personalResult.score,
      label: personalResult.label,
      color: personalResult.color,
      summary,
      adjustments: adjustmentReasons,
    };
  }

  // Color-coded nutrition facts
  const DV = {
    total_fat: 78, saturated_fat: 20, trans_fat: 0, cholesterol: 300,
    sodium: 2300, total_carbohydrates: 275, dietary_fiber: 28,
    total_sugars: 50, protein: 50, vitamin_d: 20, calcium: 1300,
    iron: 18, potassium: 4700,
  };

  type NutrientColor = "#2ECC71" | "#F1C40F" | "#E67E22" | "#E74C3C" | "#95A5A6";
  type NutrientRating = "good" | "moderate" | "high" | "very_high" | "neutral";

  function rateNutrient(key: string, value: number, dv: number): { rating: NutrientRating; color: NutrientColor; percentDv: number } {
    const pct = dv > 0 ? Math.round((value / dv) * 100) : 0;
    const isGoodNutrient = ["protein", "dietary_fiber", "vitamin_d", "calcium", "iron", "potassium"].includes(key);
    const isBadNutrient = ["saturated_fat", "trans_fat", "sodium", "total_sugars"].includes(key);

    if (isGoodNutrient) {
      if (pct >= 20) return { rating: "good", color: "#2ECC71", percentDv: pct };
      if (pct >= 10) return { rating: "moderate", color: "#F1C40F", percentDv: pct };
      return { rating: "neutral", color: "#95A5A6", percentDv: pct };
    }

    if (isBadNutrient) {
      if (key === "trans_fat" && value > 0) return { rating: "very_high", color: "#E74C3C", percentDv: pct };
      if (pct >= 30) return { rating: "very_high", color: "#E74C3C", percentDv: pct };
      if (pct >= 15) return { rating: "high", color: "#E67E22", percentDv: pct };
      if (pct >= 5) return { rating: "moderate", color: "#F1C40F", percentDv: pct };
      return { rating: "good", color: "#2ECC71", percentDv: pct };
    }

    return { rating: "neutral", color: "#95A5A6", percentDv: pct };
  }

  const nutrientEntries = [
    { key: "calories", label: "Calories", value: food.calories || 0, unit: "kcal" },
    { key: "total_fat", label: "Total Fat", value: food.total_fat || 0, unit: "g" },
    { key: "saturated_fat", label: "Saturated Fat", value: food.saturated_fat || 0, unit: "g" },
    { key: "trans_fat", label: "Trans Fat", value: food.trans_fat || 0, unit: "g" },
    { key: "cholesterol", label: "Cholesterol", value: food.cholesterol || 0, unit: "mg" },
    { key: "sodium", label: "Sodium", value: food.sodium || 0, unit: "mg" },
    { key: "total_carbohydrates", label: "Total Carbs", value: food.total_carbohydrates || 0, unit: "g" },
    { key: "dietary_fiber", label: "Fiber", value: food.dietary_fiber || 0, unit: "g" },
    { key: "total_sugars", label: "Sugars", value: food.total_sugars || 0, unit: "g" },
    { key: "protein", label: "Protein", value: food.protein || 0, unit: "g" },
    { key: "vitamin_d", label: "Vitamin D", value: food.vitamin_d || 0, unit: "mcg" },
    { key: "calcium", label: "Calcium", value: food.calcium || 0, unit: "mg" },
    { key: "iron", label: "Iron", value: food.iron || 0, unit: "mg" },
    { key: "potassium", label: "Potassium", value: food.potassium || 0, unit: "mg" },
  ];

  const nutritionFacts: Record<string, any> = {};
  for (const n of nutrientEntries) {
    const dvValue = (DV as any)[n.key] || 0;
    if (n.key === "calories") {
      nutritionFacts[n.key] = { label: n.label, value: n.value, unit: n.unit, color: "#95A5A6" };
    } else {
      const rated = rateNutrient(n.key, n.value, dvValue);
      nutritionFacts[n.key] = { label: n.label, value: n.value, unit: n.unit, ...rated };
    }
  }

  res.json({
    food: { id: food.id, name: food.name, brand: food.brand, category: food.category, servingSize: food.serving_size, servingUnit: food.serving_unit },
    culture_score: { score: baseResult.score, label: baseResult.label, color: baseResult.color },
    your_score: yourScore,
    pros,
    cons,
    nutrition_facts: nutritionFacts,
  });
});

// --- Helpers ---

function calculateCompatibility(
  match: any,
  original: Record<string, number>,
  reason: string
): number {
  let score = 0.5;
  const reasonLower = reason.toLowerCase();

  if (reasonLower.includes("low_calorie") || reasonLower.includes("calorie")) {
    if (match.calories < original.calories) {
      score += 0.3 * Math.min(1, (original.calories - match.calories) / original.calories);
    } else {
      score -= 0.2;
    }
  }

  if (reasonLower.includes("dairy_free") || reasonLower.includes("dairy")) {
    const ingredientsText = (match.ingredients_text || "").toLowerCase();
    const dairyTerms = ["milk", "cream", "cheese", "butter", "whey", "casein", "lactose"];
    const hasDairy = dairyTerms.some((t) => ingredientsText.includes(t));
    if (!hasDairy) {
      score += 0.3;
    } else {
      score -= 0.4;
    }
  }

  if (reasonLower.includes("keto") || reasonLower.includes("low_carb")) {
    if (match.total_carbohydrates < original.total_carbohydrates) {
      score += 0.3 * Math.min(1, (original.total_carbohydrates - match.total_carbohydrates) / Math.max(1, original.total_carbohydrates));
    }
  }

  if (reasonLower.includes("high_protein") || reasonLower.includes("protein")) {
    if (match.protein > original.protein) {
      score += 0.3 * Math.min(1, (match.protein - original.protein) / Math.max(1, original.protein));
    }
  }

  if (reasonLower.includes("low_fat") || reasonLower.includes("fat")) {
    if (match.total_fat < original.total_fat) {
      score += 0.3 * Math.min(1, (original.total_fat - match.total_fat) / Math.max(1, original.total_fat));
    }
  }

  if (reasonLower.includes("low_sodium") || reasonLower.includes("sodium")) {
    if (match.sodium < original.sodium) {
      score += 0.3 * Math.min(1, (original.sodium - match.sodium) / Math.max(1, original.sodium));
    }
  }

  if (reasonLower.includes("gluten_free") || reasonLower.includes("gluten")) {
    const ingredientsText = (match.ingredients_text || "").toLowerCase();
    const glutenTerms = ["wheat", "gluten", "barley", "rye"];
    const hasGluten = glutenTerms.some((t) => ingredientsText.includes(t));
    if (!hasGluten) {
      score += 0.3;
    } else {
      score -= 0.4;
    }
  }

  // Prefer USDA source and better nutri grade
  if (match.source === "usda") score += 0.05;
  if (match.nutri_grade === "A") score += 0.1;
  else if (match.nutri_grade === "B") score += 0.05;

  return Math.max(0, Math.min(1, score));
}

function round(value: number, decimals = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
