import { Router, Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuid } from "uuid";
import db from "../data/database";
import { detectAllergens, detectDietaryTags } from "../services/food-analysis";
import { calculateNutriScore } from "../services/nutrition-score";

export const scanRoutes = Router();

const EXTRACTION_PROMPT = `You are a nutrition label parser. Analyze this image of a nutrition label and extract ALL nutrition facts into structured JSON.

Return ONLY valid JSON with this exact structure (use null for any value you cannot read):
{
  "name": "product name if visible",
  "brand": "brand name if visible",
  "serving_size": number (grams),
  "serving_unit": "g" or "ml",
  "calories": number,
  "total_fat": number (grams),
  "saturated_fat": number (grams),
  "trans_fat": number (grams),
  "cholesterol": number (mg),
  "sodium": number (mg),
  "total_carbohydrates": number (grams),
  "dietary_fiber": number (grams),
  "total_sugars": number (grams),
  "protein": number (grams),
  "vitamin_d": number (mcg) or null,
  "calcium": number (mg) or null,
  "iron": number (mg) or null,
  "potassium": number (mg) or null,
  "ingredients_text": "full ingredients list if visible" or null
}

Important:
- Extract numeric values only (no units in the numbers)
- Convert percentages to actual values when possible
- If the serving size is not in grams, estimate the gram equivalent
- Return ONLY the JSON object, no markdown fences or extra text`;

/**
 * POST /api/v1/scan/label
 * Accepts a base64-encoded image and uses Gemini to extract nutrition data.
 */
scanRoutes.post("/label", async (req: Request, res: Response) => {
  try {
    const { image, format } = req.body;

    if (!image) {
      res.status(400).json({ error: "image is required (base64-encoded string)" });
      return;
    }

    const validFormats = ["nutrition_label", "barcode", "menu"];
    const labelFormat = format || "nutrition_label";
    if (!validFormats.includes(labelFormat)) {
      res.status(400).json({ error: `format must be one of: ${validFormats.join(", ")}` });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: "Nutrition label scanning is not configured. GEMINI_API_KEY is missing." });
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Strip data URI prefix if present (e.g. "data:image/png;base64,...")
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

    // Detect MIME type from prefix or default to jpeg
    let mimeType = "image/jpeg";
    const dataUriMatch = image.match(/^data:(image\/\w+);base64,/);
    if (dataUriMatch) {
      mimeType = dataUriMatch[1];
    }

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType,
      },
    };

    let prompt = EXTRACTION_PROMPT;
    if (labelFormat === "barcode") {
      prompt = `You are a barcode reader. Analyze this image and extract the barcode number. Return ONLY valid JSON: { "barcode": "the barcode number" }`;
    } else if (labelFormat === "menu") {
      prompt = `You are a menu item nutrition estimator. Analyze this image of a menu or menu item and estimate the nutrition facts for each item visible. Return ONLY valid JSON with this structure:
{
  "items": [
    {
      "name": "item name",
      "estimated_calories": number,
      "estimated_protein": number (grams),
      "estimated_total_fat": number (grams),
      "estimated_total_carbohydrates": number (grams),
      "confidence": "low" | "medium" | "high"
    }
  ]
}`;
    }

    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text();

    // Parse the JSON from Gemini's response
    let extracted: any;
    try {
      // Try direct parse first
      extracted = JSON.parse(responseText);
    } catch {
      // Try extracting JSON from markdown code fences
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        extracted = JSON.parse(jsonMatch[1].trim());
      } else {
        // Try finding JSON object in the response
        const objectMatch = responseText.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          extracted = JSON.parse(objectMatch[0]);
        } else {
          res.status(422).json({
            error: "Could not parse nutrition data from the image. Try a clearer photo.",
            raw_response: responseText,
          });
          return;
        }
      }
    }

    // For barcode format, return early with just the barcode
    if (labelFormat === "barcode") {
      // Try to look up the barcode in our database
      const barcode = extracted.barcode;
      if (barcode) {
        const food = db.prepare("SELECT * FROM foods WHERE barcode = ?").get(barcode) as any;
        if (food) {
          res.json({
            barcode,
            found: true,
            food: {
              id: food.id,
              name: food.name,
              brand: food.brand,
              calories: food.calories,
              protein: food.protein,
            },
          });
          return;
        }
      }
      res.json({ barcode, found: false, message: "Barcode not found in database. You can submit it as a contribution." });
      return;
    }

    // For menu format, return the estimated items
    if (labelFormat === "menu") {
      res.json({ format: "menu", ...extracted });
      return;
    }

    // For nutrition_label, return the structured data
    // Fill in defaults for missing values
    const nutrition = {
      name: extracted.name || null,
      brand: extracted.brand || null,
      serving_size: extracted.serving_size ?? 100,
      serving_unit: extracted.serving_unit || "g",
      calories: extracted.calories ?? 0,
      total_fat: extracted.total_fat ?? 0,
      saturated_fat: extracted.saturated_fat ?? 0,
      trans_fat: extracted.trans_fat ?? 0,
      cholesterol: extracted.cholesterol ?? 0,
      sodium: extracted.sodium ?? 0,
      total_carbohydrates: extracted.total_carbohydrates ?? 0,
      dietary_fiber: extracted.dietary_fiber ?? 0,
      total_sugars: extracted.total_sugars ?? 0,
      protein: extracted.protein ?? 0,
      vitamin_d: extracted.vitamin_d ?? null,
      calcium: extracted.calcium ?? null,
      iron: extracted.iron ?? null,
      potassium: extracted.potassium ?? null,
      ingredients_text: extracted.ingredients_text || null,
    };

    // Auto-detect allergens and dietary tags if ingredients are available
    const allergens = nutrition.ingredients_text
      ? detectAllergens(nutrition.ingredients_text)
      : [];
    const dietaryTags = nutrition.ingredients_text
      ? detectDietaryTags(nutrition.ingredients_text, {
          total_carbohydrates: nutrition.total_carbohydrates,
          protein: nutrition.protein,
          total_fat: nutrition.total_fat,
          total_sugars: nutrition.total_sugars,
          dietary_fiber: nutrition.dietary_fiber,
        })
      : [];

    // Calculate nutri-score
    const nutriScore = calculateNutriScore({
      calories: nutrition.calories,
      totalSugars: nutrition.total_sugars,
      saturatedFat: nutrition.saturated_fat,
      sodium: nutrition.sodium,
      dietaryFiber: nutrition.dietary_fiber,
      protein: nutrition.protein,
    });

    res.json({
      format: "nutrition_label",
      nutrition,
      allergens,
      dietary_tags: dietaryTags,
      nutri_score: nutriScore,
      message: "Review the extracted data and submit it via POST /api/v1/scan/submit",
    });
  } catch (err: any) {
    console.error("Scan label error:", err);
    if (err.message?.includes("API key")) {
      res.status(503).json({ error: "Gemini API key is invalid or expired." });
      return;
    }
    res.status(500).json({ error: "Failed to process image. " + (err.message || "Unknown error") });
  }
});

/**
 * POST /api/v1/scan/submit
 * Takes extracted nutrition data and saves it as a community food entry.
 */
scanRoutes.post("/submit", (req: Request, res: Response) => {
  try {
    const { name, brand, barcode, nutrition, ingredients_text } = req.body;

    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    if (!nutrition || typeof nutrition !== "object") {
      res.status(400).json({ error: "nutrition object is required" });
      return;
    }

    if (nutrition.calories === undefined || nutrition.calories === null) {
      res.status(400).json({ error: "nutrition.calories is required" });
      return;
    }

    // Check for duplicate barcode
    if (barcode) {
      const existing = db.prepare("SELECT id, name FROM foods WHERE barcode = ?").get(barcode) as any;
      if (existing) {
        res.status(409).json({
          error: "A food with this barcode already exists",
          existing_food: { id: existing.id, name: existing.name },
        });
        return;
      }
    }

    // Auto-detect allergens and dietary tags from ingredients
    const ingredientsStr = ingredients_text || "";
    const allergens = detectAllergens(ingredientsStr);
    const dietaryTags = detectDietaryTags(ingredientsStr, {
      total_carbohydrates: nutrition.total_carbohydrates ?? 0,
      protein: nutrition.protein ?? 0,
      total_fat: nutrition.total_fat ?? 0,
      total_sugars: nutrition.total_sugars ?? 0,
      dietary_fiber: nutrition.dietary_fiber ?? 0,
    });

    // Calculate nutri-score
    const nutriScore = calculateNutriScore({
      calories: nutrition.calories ?? 0,
      totalSugars: nutrition.total_sugars ?? 0,
      saturatedFat: nutrition.saturated_fat ?? 0,
      sodium: nutrition.sodium ?? 0,
      dietaryFiber: nutrition.dietary_fiber ?? 0,
      protein: nutrition.protein ?? 0,
    });

    const id = uuid();

    db.prepare(`
      INSERT INTO foods (
        id, name, brand, category, serving_size, serving_unit, barcode, source,
        calories, total_fat, saturated_fat, trans_fat, cholesterol, sodium,
        total_carbohydrates, dietary_fiber, total_sugars, protein,
        vitamin_d, calcium, iron, potassium,
        ingredients_text, allergens, dietary_tags, nutri_score, nutri_grade
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, 'community',
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `).run(
      id,
      name,
      brand || null,
      nutrition.category || "Uncategorized",
      nutrition.serving_size ?? 100,
      nutrition.serving_unit || "g",
      barcode || null,
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
      ingredientsStr || null,
      JSON.stringify(allergens),
      JSON.stringify(dietaryTags),
      nutriScore.score,
      nutriScore.grade,
    );

    res.status(201).json({
      id,
      name,
      brand: brand || null,
      barcode: barcode || null,
      source: "community",
      calories: nutrition.calories ?? 0,
      protein: nutrition.protein ?? 0,
      allergens,
      dietary_tags: dietaryTags,
      nutri_score: nutriScore,
      message: "Food entry created successfully from scanned label.",
    });
  } catch (err: any) {
    console.error("Scan submit error:", err);
    res.status(500).json({ error: "Failed to save food entry. " + (err.message || "Unknown error") });
  }
});
