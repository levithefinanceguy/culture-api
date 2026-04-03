import { Router, Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import db from "../data/database";
import {
  calculatePersonalHealthScore,
  UserPreferences,
  expandIngredientCategory,
} from "../services/health-score";
import { searchFood } from "../services/food-search";
import { formatFood } from "../services/food-format";

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

// --- Helpers ---

function getUserPreferences(apiKey: string): UserPreferences | null {
  const row = db
    .prepare("SELECT * FROM user_preferences WHERE api_key = ?")
    .get(apiKey) as any;
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
function conflictsWithPreferences(
  food: any,
  preferences: UserPreferences | null
): boolean {
  if (!preferences || !preferences.avoid_ingredients) return false;

  const ingredientsText = (food.ingredients_text || "").toLowerCase();
  const foodName = (food.name || "").toLowerCase();
  const avoidList = preferences.avoid_ingredients
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean);

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
    const apiKey =
      (req.headers["x-api-key"] as string) ||
      (req.query.api_key as string);

    if (!swap_out) {
      res.status(400).json({
        error:
          "swap_out is required — the ingredient you want to replace",
      });
      return;
    }

    if (!reason) {
      res.status(400).json({
        error:
          "reason is required — e.g. 'dairy_free', 'low_calorie', 'keto'",
      });
      return;
    }

    if (!food_id && !ingredients) {
      res.status(400).json({
        error: "Provide either food_id or ingredients array",
        examples: [
          { food_id: "some-id", swap_out: "cheese", reason: "dairy_free" },
          {
            ingredients: ["White Rice", "Chicken", "Cheese"],
            swap_out: "Cheese",
            reason: "dairy_free",
          },
        ],
      });
      return;
    }

    // Resolve the ingredient list
    let ingredientList: string[] = [];
    let originalFood: any = null;

    if (food_id) {
      originalFood = db
        .prepare("SELECT * FROM foods WHERE id = ?")
        .get(food_id) as any;
      if (!originalFood) {
        res.status(404).json({ error: "Food not found" });
        return;
      }

      // Try recipe_ingredients first
      const recipeIngredients = db
        .prepare(
          `
        SELECT f.name FROM recipe_ingredients ri
        JOIN foods f ON f.id = ri.ingredient_food_id
        WHERE ri.food_id = ?
      `
        )
        .all(food_id) as any[];

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
      res.status(503).json({
        error: "Swap suggestions require GEMINI_API_KEY to be configured",
      });
      return;
    }

    const contextStr =
      ingredientList.length > 0
        ? `\nThe full recipe/meal ingredients are: ${ingredientList.join(", ")}`
        : "";

    const prefsStr = preferences?.avoid_ingredients
      ? `\nIMPORTANT: The user avoids these ingredients: ${preferences.avoid_ingredients}. Do NOT suggest any of these.`
      : "";

    const prompt = `${SWAP_PROMPT}

The user wants to swap "${swap_out}" because: ${reason}.${contextStr}${prefsStr}

Suggest 3-5 alternatives:`;

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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
          saturated_fat: round(
            match.saturated_fat - originalNutrition.saturated_fat
          ),
          sodium: round(match.sodium - originalNutrition.sodium),
          total_carbohydrates: round(
            match.total_carbohydrates -
              originalNutrition.total_carbohydrates
          ),
          protein: round(match.protein - originalNutrition.protein),
        };

        // Calculate compatibility score based on reason
        compatibilityScore = calculateCompatibility(
          match,
          originalNutrition,
          reason
        );
      } else if (match) {
        compatibilityScore = 0.7; // have a match but no original to compare
      }

      // If user has preferences, boost score for foods that pass health score well
      if (match && preferences) {
        const healthScore = calculatePersonalHealthScore(match, preferences);
        // Blend compatibility with health score
        compatibilityScore =
          compatibilityScore * 0.6 + (healthScore.score / 100) * 0.4;
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
    suggestions.sort(
      (a, b) => b.compatibility_score - a.compatibility_score
    );

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
      res.status(504).json({
        error: "AI suggestion request timed out. Please try again.",
      });
      return;
    }
    res.status(500).json({
      error:
        "Failed to generate swap suggestions. " +
        (err.message || "Unknown error"),
    });
  }
});

// --- Helpers ---

function calculateCompatibility(
  match: any,
  original: Record<string, number>,
  reason: string
): number {
  let score = 0.5;
  const reasonLower = reason.toLowerCase();

  if (
    reasonLower.includes("low_calorie") ||
    reasonLower.includes("calorie")
  ) {
    if (match.calories < original.calories) {
      score +=
        0.3 *
        Math.min(
          1,
          (original.calories - match.calories) / original.calories
        );
    } else {
      score -= 0.2;
    }
  }

  if (
    reasonLower.includes("dairy_free") ||
    reasonLower.includes("dairy")
  ) {
    const ingredientsText = (match.ingredients_text || "").toLowerCase();
    const dairyTerms = [
      "milk",
      "cream",
      "cheese",
      "butter",
      "whey",
      "casein",
      "lactose",
    ];
    const hasDairy = dairyTerms.some((t) => ingredientsText.includes(t));
    if (!hasDairy) {
      score += 0.3;
    } else {
      score -= 0.4;
    }
  }

  if (reasonLower.includes("keto") || reasonLower.includes("low_carb")) {
    if (match.total_carbohydrates < original.total_carbohydrates) {
      score +=
        0.3 *
        Math.min(
          1,
          (original.total_carbohydrates - match.total_carbohydrates) /
            Math.max(1, original.total_carbohydrates)
        );
    }
  }

  if (
    reasonLower.includes("high_protein") ||
    reasonLower.includes("protein")
  ) {
    if (match.protein > original.protein) {
      score +=
        0.3 *
        Math.min(
          1,
          (match.protein - original.protein) /
            Math.max(1, original.protein)
        );
    }
  }

  if (reasonLower.includes("low_fat") || reasonLower.includes("fat")) {
    if (match.total_fat < original.total_fat) {
      score +=
        0.3 *
        Math.min(
          1,
          (original.total_fat - match.total_fat) /
            Math.max(1, original.total_fat)
        );
    }
  }

  if (
    reasonLower.includes("low_sodium") ||
    reasonLower.includes("sodium")
  ) {
    if (match.sodium < original.sodium) {
      score +=
        0.3 *
        Math.min(
          1,
          (original.sodium - match.sodium) / Math.max(1, original.sodium)
        );
    }
  }

  if (
    reasonLower.includes("gluten_free") ||
    reasonLower.includes("gluten")
  ) {
    const ingredientsText = (match.ingredients_text || "").toLowerCase();
    const glutenTerms = ["wheat", "gluten", "barley", "rye"];
    const hasGluten = glutenTerms.some((t) =>
      ingredientsText.includes(t)
    );
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
