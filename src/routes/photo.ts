import { Router, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import db from "../data/database";
import { searchFood } from "../services/food-search";
import {
  NutritionValues,
  NUTRITION_KEYS,
  scaleNutrition,
  sumNutrition,
} from "../services/nutrition-utils";
import {
  parseBase64Image,
  parseGeminiJson,
  getGeminiModel,
} from "../services/gemini-utils";

export const photoRoutes = Router();

// --- Types ---

interface IdentifiedFood {
  name: string;
  portion_grams: number;
  confidence: number;
}

// --- Photo feedback table ---

db.exec(`
  CREATE TABLE IF NOT EXISTS photo_feedback (
    id TEXT PRIMARY KEY,
    analysis_id TEXT NOT NULL,
    api_key TEXT,
    item_index INTEGER NOT NULL,
    original_name TEXT,
    correct_name TEXT,
    original_grams REAL,
    correct_grams REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_photo_feedback_analysis ON photo_feedback(analysis_id);
`);

// --- Gemini prompt ---

const FOOD_PHOTO_PROMPT = `You are an expert food analyst and nutritionist. Look at this photo of food and identify every food item visible.

For each item, estimate:
- name: what the food is (be specific: "grilled chicken breast" not just "chicken")
- portion_grams: estimated portion size in grams based on visual size
- confidence: how confident you are in the identification (0.0-1.0)

Use these visual references for portion estimation:
- Standard dinner plate diameter: ~26cm (10 inches)
- Standard salad/side plate diameter: ~20cm (8 inches)
- Standard bowl: ~15cm diameter, holds ~300-400ml
- A deck of cards = ~85g meat/fish
- A fist = ~1 cup = ~150g cooked rice/pasta
- A thumb = ~1 tbsp = ~15g butter/oil/sauce
- A palm (no fingers) = ~85g protein (meat, fish, tofu)
- A cupped hand = ~1/2 cup = ~75g grains/snacks
- Tennis ball = ~1 medium fruit (~130-180g)

Portion estimation guidelines:
- Compare food items to plate/bowl size for scale
- Look at utensils (fork ~19cm, knife ~22cm, spoon ~17cm) for additional scale reference
- Consider food thickness and density, not just surface area
- Stacked or layered foods (sandwiches, lasagna) account for all layers
- Sauces and dressings: estimate 15-30ml per visible portion
- For drinks: standard glass ~240ml, mug ~350ml, bottle ~500ml, can ~355ml
- If packaged food with a visible label, use the label information over visual estimation
- When multiple servings of the same item are visible, count them individually

Food identification tips:
- Distinguish between similar foods (e.g., sweet potato vs regular potato, salmon vs tuna)
- Note cooking method when visible (grilled, fried, steamed, raw)
- For mixed dishes (stir-fry, salad), identify the main components separately
- For sandwiches/wraps, estimate visible fillings and bread separately
- For soups/stews, estimate the broth and solid components

Return ONLY valid JSON array, no markdown fences, no explanation:
[{"name": "grilled chicken breast", "portion_grams": 170, "confidence": 0.85}]

If the image does not contain food, return an empty array: []`;

// --- Helpers ---

async function analyzePhoto(image: string): Promise<IdentifiedFood[]> {
  const model = getGeminiModel();
  if (!model) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const { base64Data, mimeType } = parseBase64Image(image);

  const imagePart = {
    inlineData: {
      data: base64Data,
      mimeType,
    },
  };

  const result = await Promise.race([
    model.generateContent([FOOD_PHOTO_PROMPT, imagePart]),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Gemini timeout")), 15000)
    ),
  ]);

  const responseText = result.response.text().trim();
  const parsed = parseGeminiJson(responseText);

  if (!Array.isArray(parsed)) {
    throw new Error("Could not parse food items from the image");
  }

  // Validate and clean each item
  const items: IdentifiedFood[] = [];
  for (const item of parsed) {
    if (
      typeof item.name === "string" &&
      typeof item.portion_grams === "number" &&
      item.portion_grams > 0
    ) {
      items.push({
        name: item.name,
        portion_grams: Math.round(item.portion_grams),
        confidence: typeof item.confidence === "number"
          ? Math.round(Math.min(1, Math.max(0, item.confidence)) * 100) / 100
          : 0.5,
      });
    }
  }

  return items;
}

function buildAnalysisResult(identifiedItems: IdentifiedFood[]) {
  const analysisId = uuid();
  const items: any[] = [];

  for (const identified of identifiedItems) {
    const match = searchFood(identified.name, { penalizeCommunity: true });
    let nutrition: NutritionValues | null = null;
    let matchInfo: any = null;

    if (match) {
      nutrition = scaleNutrition(match, identified.portion_grams);
      matchInfo = {
        id: match.id,
        name: match.name,
        brand: match.brand || null,
        category: match.category,
        cultureScore: match.culture_score ?? null,
      };
    }

    items.push({
      name: identified.name,
      portion_grams: identified.portion_grams,
      confidence: identified.confidence,
      match: matchInfo,
      nutrition,
    });
  }

  const matchedNutrition = items
    .filter((i) => i.nutrition !== null)
    .map((i) => i.nutrition as NutritionValues);

  const total = matchedNutrition.length > 0 ? sumNutrition(matchedNutrition) : null;

  // Calculate overall culture score as weighted average by calories
  let overallCultureScore: number | null = null;
  const scoredItems = items.filter((i) => i.match?.cultureScore != null && i.nutrition);
  if (scoredItems.length > 0) {
    const totalCals = scoredItems.reduce((sum, i) => sum + (i.nutrition?.calories || 1), 0);
    const weightedSum = scoredItems.reduce(
      (sum, i) => sum + i.match.cultureScore * (i.nutrition?.calories || 1),
      0
    );
    overallCultureScore = Math.round(weightedSum / totalCals);
  }

  return {
    analysis_id: analysisId,
    items,
    total,
    item_count: items.length,
    overall_culture_score: overallCultureScore,
  };
}

// --- Routes ---

/**
 * POST /api/v1/photo/analyze
 * Analyze a food photo and return nutrition data for all identified items.
 */
photoRoutes.post("/analyze", async (req: Request, res: Response) => {
  try {
    const { image } = req.body;

    if (!image || typeof image !== "string") {
      res.status(400).json({ error: "image is required (base64-encoded string)" });
      return;
    }

    const identifiedItems = await analyzePhoto(image);

    if (identifiedItems.length === 0) {
      res.status(422).json({
        error: "No food items detected in the image. Try a clearer photo with food visible.",
      });
      return;
    }

    const result = buildAnalysisResult(identifiedItems);
    res.json(result);
  } catch (err: any) {
    console.error("Photo analyze error:", err);
    if (err.message?.includes("API key") || err.message?.includes("GEMINI_API_KEY")) {
      res.status(503).json({ error: "Photo analysis is not configured. GEMINI_API_KEY is missing or invalid." });
      return;
    }
    if (err.message?.includes("timeout")) {
      res.status(504).json({ error: "Photo analysis timed out. Try again or use a smaller image." });
      return;
    }
    res.status(500).json({ error: "Failed to analyze photo. " + (err.message || "Unknown error") });
  }
});

/**
 * POST /api/v1/photo/log
 * Analyze a food photo AND save the result as food entries.
 */
photoRoutes.post("/log", async (req: Request, res: Response) => {
  try {
    const { image, meal_type } = req.body;

    if (!image || typeof image !== "string") {
      res.status(400).json({ error: "image is required (base64-encoded string)" });
      return;
    }

    const validMealTypes = ["breakfast", "lunch", "dinner", "snack"];
    if (meal_type && !validMealTypes.includes(meal_type)) {
      res.status(400).json({
        error: `meal_type must be one of: ${validMealTypes.join(", ")}`,
      });
      return;
    }

    const identifiedItems = await analyzePhoto(image);

    if (identifiedItems.length === 0) {
      res.status(422).json({
        error: "No food items detected in the image. Try a clearer photo with food visible.",
      });
      return;
    }

    const result = buildAnalysisResult(identifiedItems);

    // Save each matched item as a food entry via contributions
    const apiKey = (req as any).headers?.["x-api-key"] || (req as any).query?.api_key || "unknown";
    const savedEntries: string[] = [];

    for (const item of result.items) {
      if (item.match && item.nutrition) {
        const contributionId = uuid();
        db.prepare(`
          INSERT INTO contributions (id, api_key, type, status, food_id, data)
          VALUES (?, ?, 'new_food', 'approved', ?, ?)
        `).run(
          contributionId,
          apiKey,
          item.match.id,
          JSON.stringify({
            source: "photo_log",
            meal_type: meal_type || null,
            analysis_id: result.analysis_id,
            identified_name: item.name,
            portion_grams: item.portion_grams,
            confidence: item.confidence,
            nutrition: item.nutrition,
          })
        );
        savedEntries.push(contributionId);
      }
    }

    res.json({
      ...result,
      meal_type: meal_type || null,
      logged: true,
      saved_entries: savedEntries.length,
    });
  } catch (err: any) {
    console.error("Photo log error:", err);
    if (err.message?.includes("API key") || err.message?.includes("GEMINI_API_KEY")) {
      res.status(503).json({ error: "Photo analysis is not configured. GEMINI_API_KEY is missing or invalid." });
      return;
    }
    if (err.message?.includes("timeout")) {
      res.status(504).json({ error: "Photo analysis timed out. Try again or use a smaller image." });
      return;
    }
    res.status(500).json({ error: "Failed to analyze and log photo. " + (err.message || "Unknown error") });
  }
});

/**
 * POST /api/v1/photo/quick
 * Fast mode — just calories, macros, and item names.
 */
photoRoutes.post("/quick", async (req: Request, res: Response) => {
  try {
    const { image } = req.body;

    if (!image || typeof image !== "string") {
      res.status(400).json({ error: "image is required (base64-encoded string)" });
      return;
    }

    const identifiedItems = await analyzePhoto(image);

    if (identifiedItems.length === 0) {
      res.status(422).json({
        error: "No food items detected in the image. Try a clearer photo with food visible.",
      });
      return;
    }

    const result = buildAnalysisResult(identifiedItems);

    // Build streamlined response
    const itemNames = result.items.map(
      (i) => `${i.name} (${i.portion_grams}g)`
    );

    res.json({
      calories: result.total?.calories ?? 0,
      protein: result.total?.protein ?? 0,
      carbs: result.total?.total_carbohydrates ?? 0,
      fat: result.total?.total_fat ?? 0,
      items: itemNames,
      culture_score: result.overall_culture_score,
    });
  } catch (err: any) {
    console.error("Photo quick error:", err);
    if (err.message?.includes("API key") || err.message?.includes("GEMINI_API_KEY")) {
      res.status(503).json({ error: "Photo analysis is not configured. GEMINI_API_KEY is missing or invalid." });
      return;
    }
    if (err.message?.includes("timeout")) {
      res.status(504).json({ error: "Photo analysis timed out. Try again or use a smaller image." });
      return;
    }
    res.status(500).json({ error: "Failed to analyze photo. " + (err.message || "Unknown error") });
  }
});

/**
 * POST /api/v1/photo/feedback
 * Submit corrections for a photo analysis to improve future accuracy.
 */
photoRoutes.post("/feedback", (req: Request, res: Response) => {
  try {
    const { analysis_id, corrections } = req.body;

    if (!analysis_id || typeof analysis_id !== "string") {
      res.status(400).json({ error: "analysis_id is required" });
      return;
    }

    if (!Array.isArray(corrections) || corrections.length === 0) {
      res.status(400).json({
        error: "corrections must be a non-empty array",
        example: {
          corrections: [
            { item_index: 0, correct_name: "salmon fillet", correct_grams: 150 },
          ],
        },
      });
      return;
    }

    const apiKey = req.headers["x-api-key"] as string || req.query.api_key as string || "unknown";
    const savedIds: string[] = [];

    const insertStmt = db.prepare(`
      INSERT INTO photo_feedback (id, analysis_id, api_key, item_index, original_name, correct_name, original_grams, correct_grams)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const correction of corrections) {
      if (typeof correction.item_index !== "number") {
        continue;
      }

      const id = uuid();
      insertStmt.run(
        id,
        analysis_id,
        apiKey,
        correction.item_index,
        correction.original_name || null,
        correction.correct_name || null,
        correction.original_grams ?? null,
        correction.correct_grams ?? null,
      );
      savedIds.push(id);
    }

    if (savedIds.length === 0) {
      res.status(400).json({ error: "No valid corrections provided. Each correction must have an item_index." });
      return;
    }

    res.json({
      message: "Feedback recorded. Thank you for helping improve photo analysis accuracy.",
      analysis_id,
      corrections_saved: savedIds.length,
      feedback_ids: savedIds,
    });
  } catch (err: any) {
    console.error("Photo feedback error:", err);
    res.status(500).json({ error: "Failed to save feedback. " + (err.message || "Unknown error") });
  }
});
