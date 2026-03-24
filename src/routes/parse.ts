import { Router, Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { searchFood } from "../services/food-search";
import {
  NutritionValues,
  NUTRITION_KEYS,
  scaleNutrition,
  sumNutrition,
  UNIT_TO_GRAMS,
  COMMON_FOOD_WEIGHTS,
  UNIT_FOOD_WEIGHTS,
  estimateGrams,
} from "../services/nutrition-utils";

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

interface GeminiParsedItem {
  food: string;
  quantity_grams: number;
  original_text: string;
}

// --- Gemini AI parser ---

const GEMINI_PROMPT = `You are a food portion parser. Given a natural language description of food, break it into individual food items and estimate the weight in grams for each.

Rules:
- Split compound descriptions into individual food items (e.g., "chicken caesar salad" = chicken breast, romaine lettuce, parmesan cheese, caesar dressing)
- For multi-component items like "coffee with cream and sugar", split into separate components
- Estimate realistic portion weights in grams using these common references:
  - Handful: ~28g (nuts, small snacks), ~15g (leafy greens)
  - Bowl: ~300-400g (cereal with milk ~350g, soup ~350g, salad ~200g)
  - Plate: ~300g (pasta ~250g, rice ~200g, mixed meal ~350g)
  - Glass: ~240ml/240g (water, milk, juice)
  - Cup: ~240ml/240g
  - Mug: ~350ml (coffee, tea)
  - Slice of bread: ~30g
  - Slice of pizza: ~107g
  - Piece of fruit: apple ~182g, banana ~118g, orange ~131g
  - Egg: ~50g each
  - Chicken breast: ~174g
  - Tablespoon: ~15g
  - Teaspoon: ~5g
  - Pat of butter: ~5g
  - Strip of bacon: ~8g cooked
  - Tortilla: ~45g
- For vague quantities ("some", "a bit of", "a little"), estimate conservatively (~15-30g)
- For "leftover" or unspecified portions, estimate a typical single serving
- Account for cooking methods in the food name (e.g., "scrambled eggs" is still "eggs")
- The "food" field should be a simple, searchable food name (e.g., "chicken breast" not "grilled free-range chicken breast")
- The "original_text" field should be the portion of the input that corresponds to this item

Return ONLY valid JSON — no markdown fences, no explanation. Return an array of objects:
[{"food": "almonds", "quantity_grams": 28, "original_text": "a handful of almonds"}]

If the input is not food-related, return an empty array: []`;

async function parseWithGemini(
  input: string
): Promise<GeminiParsedItem[] | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await Promise.race([
      model.generateContent(`${GEMINI_PROMPT}\n\nInput: "${input}"`),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Gemini timeout")), 10000)
      ),
    ]);

    const text = result.response.text().trim();

    // Strip markdown code fences if present
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    if (!Array.isArray(parsed)) return null;

    // Validate structure
    const valid = parsed.every(
      (item: any) =>
        typeof item.food === "string" &&
        typeof item.quantity_grams === "number" &&
        item.quantity_grams > 0 &&
        typeof item.original_text === "string"
    );

    if (!valid) return null;

    return parsed as GeminiParsedItem[];
  } catch (err) {
    console.warn("Gemini parsing failed, falling back to string matching:", (err as Error).message);
    return null;
  }
}

// --- Number words (used by fallback parser) ---

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

// --- Fallback string-matching parser ---

function splitIntoItems(input: string): string[] {
  let text = input
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, ", ")
    .trim();

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

  const mixedMatch = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)\s+(.*)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1]);
    const num = parseInt(mixedMatch[2]);
    const den = parseInt(mixedMatch[3]);
    return { quantity: whole + num / den, remaining: mixedMatch[4] };
  }

  const fracMatch = trimmed.match(/^(\d+)\/(\d+)\s+(.*)$/);
  if (fracMatch) {
    const num = parseInt(fracMatch[1]);
    const den = parseInt(fracMatch[2]);
    return { quantity: num / den, remaining: fracMatch[3] };
  }

  const numMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s+(.*)$/);
  if (numMatch) {
    return { quantity: parseFloat(numMatch[1]), remaining: numMatch[2] };
  }

  const wordMatch = trimmed.match(/^(\w+)\s+(.*)$/);
  if (wordMatch) {
    const word = wordMatch[1].toLowerCase();
    if (word in NUMBER_WORDS) {
      return { quantity: NUMBER_WORDS[word], remaining: wordMatch[2] };
    }
  }

  return { quantity: 1, remaining: trimmed };
}

function parseUnit(text: string): {
  unit: string;
  remaining: string;
} {
  let trimmed = text.trim().toLowerCase();

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
    const pattern = new RegExp(`^${u}(?:\\s+of\\s+|\\s+|$)(.*)$`, "i");
    const match = trimmed.match(pattern);
    if (match) {
      const normalized = normalizeUnit(u);
      return { unit: normalized, remaining: match[1].trim() };
    }
  }

  return { unit: "whole", remaining: trimmed };
}

function normalizeUnit(unit: string): string {
  const u = unit.toLowerCase();
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

  const cleaned = food_query.replace(/^of\s+/i, "").trim();

  return {
    quantity,
    unit,
    food_query: cleaned || afterQty,
  };
}

function fallbackParse(input: string): ParsedItem[] {
  const rawItems = splitIntoItems(input);
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

      const grams = estimateGrams(
        quantity,
        unit,
        food_query,
        match.serving_size
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

  return parsedItems;
}

// --- Confidence scoring ---

function computeConfidence(
  foodQuery: string,
  match: any | null
): number {
  if (!match) return 0;

  const query = foodQuery.toLowerCase().trim();
  const name = (match.name as string).toLowerCase();

  if (name === query) return 1;

  const queryWords = query.split(/\s+/);
  const allWordsFound = queryWords.every((w) => name.includes(w));
  if (allWordsFound) return 0.9;

  const foundCount = queryWords.filter((w) => name.includes(w)).length;
  const ratio = foundCount / queryWords.length;

  return Math.round(Math.max(0.3, ratio * 0.85) * 100) / 100;
}

// --- Gemini-based item processing ---

function processGeminiItems(geminiItems: GeminiParsedItem[]): ParsedItem[] {
  const parsedItems: ParsedItem[] = [];

  for (const item of geminiItems) {
    const match = searchFood(item.food);

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

      // Gemini gives us grams directly — scale nutrition from that
      nutrition = scaleNutrition(match, item.quantity_grams);
    }

    parsedItems.push({
      original: item.original_text,
      quantity: item.quantity_grams,
      unit: "g",
      food_query: item.food,
      match: foodMatch,
      nutrition,
      confidence: computeConfidence(item.food, match),
    });
  }

  return parsedItems;
}

// --- Route handler ---

parseRoutes.post("/", async (req: Request, res: Response) => {
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

  const useFallback = req.query.mode === "fast";
  let parsedItems: ParsedItem[];
  let parser_used: "gemini" | "fallback";

  if (useFallback) {
    // Forced fallback via ?mode=fast
    parsedItems = fallbackParse(input);
    parser_used = "fallback";
  } else {
    // Try Gemini first
    const geminiResult = await parseWithGemini(input);

    if (geminiResult && geminiResult.length > 0) {
      parsedItems = processGeminiItems(geminiResult);
      parser_used = "gemini";
    } else {
      // Gemini unavailable or returned nothing — use fallback
      parsedItems = fallbackParse(input);
      parser_used = "fallback";
    }
  }

  if (parsedItems.length === 0) {
    res.status(400).json({
      error: "Could not parse any food items from input",
    });
    return;
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
    parser_used,
  });
});
