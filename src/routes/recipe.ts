import { Router, Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuid } from "uuid";
import db from "../data/database";
import { calculateNutriScore } from "../services/nutrition-score";
import { searchFood } from "../services/food-search";
import {
  NutritionValues,
  NUTRITION_KEYS,
  scaleNutrition,
  sumNutrition,
  estimateGrams,
} from "../services/nutrition-utils";

export const recipeRoutes = Router();

// --- Types ---

interface RecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
}

interface GeminiRecipeResult {
  title: string;
  servings: number;
  ingredients: RecipeIngredient[];
  instructions?: string;
  error?: string;
}

interface MatchedIngredient {
  original: string;
  matched: { id: string; name: string; cultureScore: number | null } | null;
  quantity: number;
  unit: string;
  grams: number;
  nutrition: NutritionValues | null;
}

// --- Social media URL detection ---

function isSocialMediaUrl(url: string): boolean {
  const patterns = [
    /tiktok\.com/i,
    /instagram\.com/i,
    /youtube\.com/i,
    /youtu\.be/i,
  ];
  return patterns.some((p) => p.test(url));
}

// --- HTML stripping ---

function stripHtml(html: string): string {
  // Remove script and style blocks entirely
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, " ");
  // Decode common HTML entities
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, " ");
  // Collapse whitespace
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

// --- URL fetching ---

async function fetchUrlContent(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const text = stripHtml(html);

    // Truncate to 5000 chars to stay within token limits
    if (text.length > 5000) {
      return text.substring(0, 5000);
    }
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

// --- Gemini recipe extraction ---

const RECIPE_PROMPT = `You are a recipe extraction assistant. Given text content from a web page or user input, extract the recipe information.

Return ONLY valid JSON — no markdown fences, no explanation. Return an object with:
- "title": recipe name (string)
- "servings": number of servings (number, default to 4 if not specified)
- "ingredients": array of objects, each with "name" (simple searchable food name like "chicken breast" not "organic free-range chicken"), "quantity" (number), and "unit" (string — use standard units: g, oz, lb, cup, tbsp, tsp, ml, pieces, slices, or "whole" for countable items like eggs)
- "instructions": brief summary of cooking steps (string, optional)

Rules:
- Parse all ingredient amounts into numbers (e.g., "1/2" = 0.5, "a pinch" = 0.25 tsp)
- For vague quantities ("some", "to taste", "a splash"), estimate conservatively
- "name" should be a simple, searchable food name (e.g., "chicken breast" not "boneless skinless chicken breast")
- Handle recipe formats from blogs, TikTok captions, Instagram posts, YouTube descriptions
- If the text is informal (like a TikTok caption), still extract ingredient quantities as best you can

If no recipe is found in the text, return: {"error": "No recipe found"}`;

const SOCIAL_MEDIA_PROMPT = `You are a recipe extraction assistant. The following text was extracted from a social media page (TikTok, Instagram, or YouTube). The recipe information may be in captions, descriptions, comments, or scattered through informal text.

Look carefully for any recipe-related content including ingredient lists, cooking instructions, or food descriptions — even if informal (e.g., "I used like 2 chicken breasts and a cup of rice lol").

Return ONLY valid JSON — no markdown fences, no explanation. Return an object with:
- "title": recipe name (string — infer from context if not explicit)
- "servings": number of servings (number, default to 2 if not specified)
- "ingredients": array of objects, each with "name" (simple searchable food name), "quantity" (number), and "unit" (string — use standard units: g, oz, lb, cup, tbsp, tsp, ml, pieces, slices, or "whole" for countable items)
- "instructions": brief summary of cooking steps (string, optional)

Rules:
- Parse informal quantities ("like 2", "about a cup") into numbers
- For vague amounts, estimate reasonably
- "name" should be simple and searchable
- If no recipe content is found at all, return: {"error": "No recipe found"}`;

async function extractRecipeWithGemini(
  content: string,
  isSocial: boolean
): Promise<GeminiRecipeResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = isSocial ? SOCIAL_MEDIA_PROMPT : RECIPE_PROMPT;

    const result = await Promise.race([
      model.generateContent(`${prompt}\n\nContent:\n${content}`),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Gemini timeout")), 15000)
      ),
    ]);

    const text = result.response.text().trim();

    // Strip markdown code fences if present
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    if (parsed.error) {
      return parsed as GeminiRecipeResult;
    }

    // Validate structure
    if (
      typeof parsed.title !== "string" ||
      !Array.isArray(parsed.ingredients)
    ) {
      return null;
    }

    return {
      title: parsed.title,
      servings: typeof parsed.servings === "number" ? parsed.servings : 4,
      ingredients: parsed.ingredients.map((ing: any) => ({
        name: String(ing.name || ""),
        quantity: typeof ing.quantity === "number" ? ing.quantity : 1,
        unit: String(ing.unit || "whole"),
      })),
      instructions: parsed.instructions || undefined,
    };
  } catch (err) {
    console.warn(
      "Gemini recipe extraction failed:",
      (err as Error).message
    );
    return null;
  }
}

// --- Nutrition helpers ---

function divideNutrition(
  nutrition: NutritionValues,
  divisor: number
): NutritionValues {
  const result: any = {};
  for (const key of NUTRITION_KEYS) {
    const val = (nutrition as any)[key];
    if (val != null) {
      result[key] = Math.round((val / divisor) * 100) / 100;
    } else {
      result[key] = null;
    }
  }
  return result as NutritionValues;
}

// --- Core recipe processing ---

async function processRecipe(
  recipe: GeminiRecipeResult,
  sourceUrl?: string
): Promise<any> {
  const ingredients: MatchedIngredient[] = [];

  for (const ing of recipe.ingredients) {
    const match = searchFood(ing.name);

    let nutrition: NutritionValues | null = null;
    let grams = 0;
    let matchedInfo: MatchedIngredient["matched"] = null;

    if (match) {
      matchedInfo = {
        id: match.id,
        name: match.name,
        cultureScore: match.culture_score ?? null,
      };

      grams = estimateGrams(
        ing.quantity,
        ing.unit,
        ing.name,
        match.serving_size
      );

      nutrition = scaleNutrition(match, grams);
    }

    const originalText = `${ing.quantity} ${ing.unit === "whole" ? "" : ing.unit + " "}${ing.name}`.trim();

    ingredients.push({
      original: originalText,
      matched: matchedInfo,
      quantity: ing.quantity,
      unit: ing.unit,
      grams: Math.round(grams * 100) / 100,
      nutrition,
    });
  }

  const matchedIngredients = ingredients.filter((i) => i.nutrition !== null);
  const totalNutrition =
    matchedIngredients.length > 0
      ? sumNutrition(matchedIngredients.map((i) => i.nutrition!))
      : null;

  const perServing =
    totalNutrition && recipe.servings > 0
      ? divideNutrition(totalNutrition, recipe.servings)
      : null;

  // Calculate weighted culture score
  let cultureScore: number | null = null;
  const scoredIngredients = ingredients.filter(
    (i) => i.matched?.cultureScore != null && i.grams > 0
  );
  if (scoredIngredients.length > 0) {
    const totalGrams = scoredIngredients.reduce((sum, i) => sum + i.grams, 0);
    const weightedSum = scoredIngredients.reduce(
      (sum, i) => sum + i.matched!.cultureScore! * i.grams,
      0
    );
    cultureScore = Math.round(weightedSum / totalGrams);
  }

  return {
    title: recipe.title,
    source_url: sourceUrl || null,
    servings: recipe.servings,
    instructions: recipe.instructions || null,
    ingredients,
    total_nutrition: totalNutrition,
    per_serving: perServing,
    culture_score: cultureScore,
    matched_count: matchedIngredients.length,
    total_ingredients: ingredients.length,
  };
}

// --- Routes ---

// POST /parse — Parse recipe from URL
recipeRoutes.post("/parse", async (req: Request, res: Response) => {
  const { url } = req.body;

  if (!url || typeof url !== "string") {
    res.status(400).json({
      error: "Request body must include a 'url' string",
      example: { url: "https://allrecipes.com/recipe/..." },
    });
    return;
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch {
    res.status(400).json({ error: "Invalid URL format" });
    return;
  }

  try {
    // Fetch page content
    const content = await fetchUrlContent(url);

    if (!content || content.length < 20) {
      res.status(422).json({
        error: "Could not extract meaningful content from URL",
      });
      return;
    }

    const isSocial = isSocialMediaUrl(url);

    // Extract recipe via Gemini
    const recipe = await extractRecipeWithGemini(content, isSocial);

    if (!recipe) {
      res.status(502).json({
        error: "Failed to extract recipe — Gemini unavailable or returned invalid data",
      });
      return;
    }

    if (recipe.error) {
      res.status(404).json({ error: recipe.error });
      return;
    }

    const result = await processRecipe(recipe, url);
    res.json(result);
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes("abort") || message.includes("timeout")) {
      res.status(504).json({ error: "URL fetch timed out after 10 seconds" });
      return;
    }
    console.error("Recipe parse error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /text — Parse recipe from plain text
recipeRoutes.post("/text", async (req: Request, res: Response) => {
  const { text } = req.body;

  if (!text || typeof text !== "string") {
    res.status(400).json({
      error: "Request body must include a 'text' string",
      example: { text: "2 chicken breasts\n1 cup rice\n2 tbsp soy sauce\nServes 4" },
    });
    return;
  }

  if (text.length > 10000) {
    res.status(400).json({ error: "Text must be 10000 characters or less" });
    return;
  }

  try {
    const recipe = await extractRecipeWithGemini(text, false);

    if (!recipe) {
      res.status(502).json({
        error: "Failed to extract recipe — Gemini unavailable or returned invalid data",
      });
      return;
    }

    if (recipe.error) {
      res.status(404).json({ error: recipe.error });
      return;
    }

    const result = await processRecipe(recipe);
    res.json(result);
  } catch (err) {
    console.error("Recipe text parse error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /save — Save a parsed recipe as a food in the database
recipeRoutes.post("/save", async (req: Request, res: Response) => {
  const { title, servings, ingredients, per_serving, total_nutrition, culture_score, source_url, name } = req.body;

  if (!per_serving || !ingredients || !Array.isArray(ingredients)) {
    res.status(400).json({
      error: "Request body must include a parsed recipe result (from /parse or /text)",
    });
    return;
  }

  const foodName = name || title || "Custom Recipe";
  const servingCount = servings || 1;

  // per_serving nutrition is what we store as the food's per-serving values
  const nutrition = per_serving;

  // Calculate total grams for serving size
  const totalGrams = ingredients.reduce(
    (sum: number, i: any) => sum + (i.grams || 0),
    0
  );
  const servingSizeGrams = Math.round((totalGrams / servingCount) * 100) / 100;

  // Calculate nutri-score from per-serving nutrition
  const nutriScore = calculateNutriScore({
    calories: nutrition.calories ?? 0,
    totalSugars: nutrition.total_sugars ?? 0,
    saturatedFat: nutrition.saturated_fat ?? 0,
    sodium: nutrition.sodium ?? 0,
    dietaryFiber: nutrition.dietary_fiber ?? 0,
    protein: nutrition.protein ?? 0,
  });

  const foodId = uuid();

  // Build ingredients text from the ingredient list
  const ingredientsText = ingredients
    .map((i: any) => i.original || i.matched?.name || "unknown")
    .join(", ");

  try {
    db.prepare(`
      INSERT INTO foods (
        id, name, category, serving_size, serving_unit, source,
        calories, total_fat, saturated_fat, trans_fat, cholesterol, sodium,
        total_carbohydrates, dietary_fiber, total_sugars, protein,
        vitamin_d, calcium, iron, potassium,
        ingredients_text, nutri_score, nutri_grade, culture_score
      ) VALUES (
        ?, ?, ?, ?, ?, 'community',
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?
      )
    `).run(
      foodId,
      foodName,
      "Recipe",
      servingSizeGrams,
      "g",
      nutrition.calories ?? 0,
      nutrition.total_fat ?? 0,
      nutrition.saturated_fat ?? 0,
      nutrition.trans_fat ?? 0,
      nutrition.cholesterol ?? 0,
      nutrition.sodium ?? 0,
      nutrition.total_carbohydrates ?? 0,
      nutrition.dietary_fiber ?? 0,
      nutrition.total_sugars ?? 0,
      nutrition.protein ?? 0,
      nutrition.vitamin_d ?? null,
      nutrition.calcium ?? null,
      nutrition.iron ?? null,
      nutrition.potassium ?? null,
      ingredientsText,
      nutriScore.score,
      nutriScore.grade,
      culture_score ?? null
    );

    // Save recipe_ingredients linkage for matched ingredients
    const insertIngredient = db.prepare(
      "INSERT INTO recipe_ingredients (id, food_id, ingredient_food_id, grams) VALUES (?, ?, ?, ?)"
    );

    for (const ing of ingredients) {
      if (ing.matched?.id && ing.grams > 0) {
        insertIngredient.run(uuid(), foodId, ing.matched.id, ing.grams);
      }
    }

    res.status(201).json({
      id: foodId,
      name: foodName,
      servings: servingCount,
      serving_size: servingSizeGrams,
      serving_unit: "g",
      source: "community",
      source_url: source_url || null,
      nutrition: per_serving,
      total_nutrition: total_nutrition || null,
      culture_score: culture_score ?? null,
      nutri_score: nutriScore.score,
      nutri_grade: nutriScore.grade,
      ingredients_count: ingredients.length,
    });
  } catch (err) {
    console.error("Recipe save error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
