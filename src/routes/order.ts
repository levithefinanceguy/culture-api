import { Router, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import db from "../data/database";
import { searchFood } from "../services/food-search";
import {
  NutritionValues,
  NUTRITION_KEYS,
  sumNutrition,
} from "../services/nutrition-utils";
import {
  parseBase64Image,
  parseGeminiJson,
  getGeminiModel,
} from "../services/gemini-utils";
import { applyCustomizations } from "./customize";

export const orderRoutes = Router();

// --- Types ---

interface OrderItem {
  name: string;
  quantity: number;
  size: string | null;
  price: number | null;
  customizations: string[];
}

interface GeminiOrderResult {
  restaurant: string | null;
  platform: string | null;
  items: OrderItem[];
}

// --- Order scans table ---

db.exec(`
  CREATE TABLE IF NOT EXISTS order_scans (
    id TEXT PRIMARY KEY,
    api_key TEXT NOT NULL,
    restaurant TEXT,
    platform TEXT,
    items TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_order_scans_api_key ON order_scans(api_key);
  CREATE INDEX IF NOT EXISTS idx_order_scans_created ON order_scans(created_at);
`);

// Clean up scans older than 24 hours on startup and periodically
function cleanupExpiredScans(): void {
  try {
    db.prepare(
      "DELETE FROM order_scans WHERE created_at < datetime('now', '-24 hours')"
    ).run();
  } catch {
    // Ignore cleanup errors
  }
}
cleanupExpiredScans();
if (process.env.NODE_ENV !== "test") {
  setInterval(cleanupExpiredScans, 60 * 60 * 1000);
}

// --- Gemini prompt ---

const ORDER_SCAN_PROMPT = `You are analyzing a food delivery or restaurant order screenshot. Extract every food/drink item from the order.

For each item extract:
- name: the item name exactly as shown (e.g., 'Big Mac Combo', 'Large Fries', 'Diet Coke')
- quantity: how many were ordered (default 1)
- size: if specified (Small, Medium, Large, etc.)
- price: if visible (number only, no currency symbol)
- customizations: any modifications (e.g., 'no onions', 'extra cheese')
- restaurant: the restaurant name if visible

Return ONLY valid JSON, no markdown fences, no explanation:
{
  "restaurant": "McDonald's",
  "platform": "DoorDash",
  "items": [
    { "name": "Big Mac", "quantity": 1, "size": null, "price": 5.99, "customizations": [] },
    { "name": "Large Fries", "quantity": 1, "size": "Large", "price": 3.49, "customizations": [] },
    { "name": "Diet Coke", "quantity": 2, "size": "Medium", "price": 1.99, "customizations": [] }
  ]
}

If the image does not contain a food order, return: { "restaurant": null, "platform": null, "items": [] }`;

// --- Helpers ---

function searchFoodByQuery(query: string, brand?: string | null): any | null {
  return searchFood(query, {
    brandFilter: brand || undefined,
    penalizeCommunity: true,
  });
}

function searchFoodWithSize(
  itemName: string,
  size: string | null,
  brand: string | null
): any | null {
  // If a size is specified, try searching with the size included in the name
  if (size) {
    const withSize = searchFoodByQuery(`${size} ${itemName}`, brand);
    if (withSize) return withSize;

    const sizeAfter = searchFoodByQuery(`${itemName} ${size}`, brand);
    if (sizeAfter) return sizeAfter;

    // Also try matching via size_variant column
    const cleanQuery = itemName.toLowerCase().replace(/[^\w\s]/g, "").trim();
    try {
      const result = db
        .prepare(
          `SELECT * FROM foods
           WHERE lower(name) LIKE @pattern
             AND lower(size_variant) = @size
           ORDER BY length(name) ASC
           LIMIT 1`
        )
        .get({ pattern: `%${cleanQuery}%`, size: size.toLowerCase() });
      if (result) return result;
    } catch {}
  }

  // Also try meal_components for chain restaurants
  if (brand) {
    try {
      const cleanQuery = itemName.toLowerCase().replace(/[^\w\s]/g, "").trim();
      const component = db
        .prepare(
          `SELECT * FROM meal_components
           WHERE lower(chain_name) LIKE @chain
             AND lower(component_name) LIKE @name
           ORDER BY length(component_name) ASC
           LIMIT 1`
        )
        .get({
          chain: `%${brand.toLowerCase().replace(/[^\w\s]/g, "").trim()}%`,
          name: `%${cleanQuery}%`,
        }) as any;
      if (component) {
        // Return in the same shape as a food row
        return {
          id: `chain-${component.chain_name.toLowerCase().replace(/\s+/g, "-")}-${component.id}`,
          name: component.component_name,
          brand: component.chain_name,
          category: component.component_category,
          serving_size: component.portion_grams,
          serving_unit: "g",
          source: "vendor",
          calories: component.calories,
          total_fat: component.total_fat,
          saturated_fat: component.saturated_fat,
          trans_fat: component.trans_fat,
          cholesterol: component.cholesterol,
          sodium: component.sodium,
          total_carbohydrates: component.total_carbohydrates,
          dietary_fiber: component.dietary_fiber,
          total_sugars: component.total_sugars,
          protein: component.protein,
          vitamin_d: null,
          calcium: null,
          iron: null,
          potassium: null,
          culture_score: null,
          size_variant: null,
        };
      }
    } catch {}
  }

  return searchFoodByQuery(itemName, brand);
}

function getNutrition(food: any, quantity: number): NutritionValues {
  // For matched foods, nutrition is per serving. Multiply by quantity.
  const round2 = (n: number | null) =>
    n != null ? Math.round(n * quantity * 100) / 100 : null;

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

async function analyzeOrderScreenshot(image: string): Promise<GeminiOrderResult> {
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
    model.generateContent([ORDER_SCAN_PROMPT, imagePart]),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Gemini timeout")), 20000)
    ),
  ]);

  const responseText = result.response.text().trim();
  const parsed = parseGeminiJson(responseText);

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Could not parse order from the image");
  }

  const items: OrderItem[] = [];
  if (Array.isArray(parsed.items)) {
    for (const item of parsed.items) {
      if (typeof item.name === "string" && item.name.trim()) {
        items.push({
          name: item.name.trim(),
          quantity: typeof item.quantity === "number" && item.quantity > 0 ? item.quantity : 1,
          size: typeof item.size === "string" ? item.size : null,
          price: typeof item.price === "number" ? item.price : null,
          customizations: Array.isArray(item.customizations)
            ? item.customizations.filter((c: any) => typeof c === "string")
            : [],
        });
      }
    }
  }

  return {
    restaurant: typeof parsed.restaurant === "string" ? parsed.restaurant : null,
    platform: typeof parsed.platform === "string" ? parsed.platform : null,
    items,
  };
}

interface MatchedOrderItem {
  index: number;
  selected: boolean;
  original_name: string;
  quantity: number;
  size: string | null;
  price: number | null;
  customizations: string[];
  match: {
    id: string;
    name: string;
    brand: string | null;
    category: string;
    cultureScore: number | null;
  } | null;
  nutrition: NutritionValues | null;
}

function buildOrderItems(
  geminiResult: GeminiOrderResult
): MatchedOrderItem[] {
  const items: MatchedOrderItem[] = [];

  for (let i = 0; i < geminiResult.items.length; i++) {
    const item = geminiResult.items[i];
    const food = searchFoodWithSize(item.name, item.size, geminiResult.restaurant);

    let matchInfo: MatchedOrderItem["match"] = null;
    let nutrition: NutritionValues | null = null;

    if (food) {
      matchInfo = {
        id: food.id,
        name: food.name,
        brand: food.brand || null,
        category: food.category || "Uncategorized",
        cultureScore: food.culture_score ?? null,
      };
      nutrition = getNutrition(food, item.quantity);
    }

    // Auto-apply customizations if the item has them and was matched
    if (food && item.customizations.length > 0) {
      const parsed = parseCustomizationStrings(item.customizations);
      if (parsed.add.length > 0 || parsed.remove.length > 0 || parsed.swap.length > 0) {
        const customResult = applyCustomizations(food.id, parsed);
        if (!("error" in customResult)) {
          nutrition = customResult.customized.nutrition;
          // Scale by quantity
          if (item.quantity > 1 && nutrition) {
            for (const key of NUTRITION_KEYS) {
              const val = nutrition[key];
              if (val != null) {
                (nutrition as any)[key] = Math.round(val * item.quantity * 100) / 100;
              }
            }
          }
        }
      }
    }

    items.push({
      index: i,
      selected: true,
      original_name: item.name,
      quantity: item.quantity,
      size: item.size,
      price: item.price,
      customizations: item.customizations,
      match: matchInfo,
      nutrition,
    });
  }

  return items;
}

/**
 * Parse natural-language customization strings (e.g. "no pickles", "add bacon",
 * "extra cheese", "sub chicken for beef") into structured customization input.
 */
function parseCustomizationStrings(
  customizations: string[]
): { add: Array<{ name: string; portion: string }>; remove: string[]; swap: Array<{ from: string; to: string }> } {
  const add: Array<{ name: string; portion: string }> = [];
  const remove: string[] = [];
  const swap: Array<{ from: string; to: string }> = [];

  for (const raw of customizations) {
    const c = raw.toLowerCase().trim();

    // "sub X for Y" or "swap X for Y" or "substitute X for Y" or "X instead of Y"
    const swapMatch = c.match(/^(?:sub|swap|substitute|replace)\s+(.+?)\s+(?:for|with)\s+(.+)$/);
    if (swapMatch) {
      swap.push({ from: swapMatch[2].trim(), to: swapMatch[1].trim() });
      continue;
    }
    const insteadMatch = c.match(/^(.+?)\s+instead\s+of\s+(.+)$/);
    if (insteadMatch) {
      swap.push({ from: insteadMatch[2].trim(), to: insteadMatch[1].trim() });
      continue;
    }

    // "no X" or "remove X" or "without X" or "hold X"
    const removeMatch = c.match(/^(?:no|remove|without|hold|minus)\s+(.+)$/);
    if (removeMatch) {
      remove.push(removeMatch[1].trim());
      continue;
    }

    // "extra X" or "double X"
    const extraMatch = c.match(/^(?:extra|double)\s+(.+)$/);
    if (extraMatch) {
      add.push({ name: extraMatch[1].trim(), portion: "extra" });
      continue;
    }

    // "light X"
    const lightMatch = c.match(/^(?:light|lite|less)\s+(.+)$/);
    if (lightMatch) {
      add.push({ name: lightMatch[1].trim(), portion: "light" });
      continue;
    }

    // "add X"
    const addMatch = c.match(/^(?:add|plus|with)\s+(.+)$/);
    if (addMatch) {
      add.push({ name: addMatch[1].trim(), portion: "standard" });
      continue;
    }

    // Fallback: treat as an addition with standard portion
    if (c.length > 0) {
      add.push({ name: c, portion: "standard" });
    }
  }

  return { add, remove, swap };
}

function calculateTotals(items: MatchedOrderItem[]): {
  total_nutrition: NutritionValues | null;
  total_price: number | null;
  item_count: number;
} {
  const selectedItems = items.filter((i) => i.selected);
  const nutritionList = selectedItems
    .filter((i) => i.nutrition !== null)
    .map((i) => i.nutrition as NutritionValues);

  const total_nutrition = nutritionList.length > 0 ? sumNutrition(nutritionList) : null;

  let total_price: number | null = null;
  const priceItems = selectedItems.filter((i) => i.price !== null);
  if (priceItems.length > 0) {
    total_price = Math.round(
      priceItems.reduce((sum, i) => sum + (i.price ?? 0) * i.quantity, 0) * 100
    ) / 100;
  }

  return {
    total_nutrition,
    total_price,
    item_count: selectedItems.reduce((sum, i) => sum + i.quantity, 0),
  };
}

// --- Routes ---

/**
 * POST /scan — Scan an order screenshot and extract items with nutrition data.
 */
orderRoutes.post("/scan", async (req: Request, res: Response) => {
  try {
    const { image } = req.body;

    if (!image || typeof image !== "string") {
      res.status(400).json({ error: "image is required (base64-encoded string)" });
      return;
    }

    const geminiResult = await analyzeOrderScreenshot(image);

    if (geminiResult.items.length === 0) {
      res.status(422).json({
        error: "No food items detected in the image. Make sure the screenshot shows an order with item names visible.",
      });
      return;
    }

    const items = buildOrderItems(geminiResult);
    const { total_nutrition, total_price, item_count } = calculateTotals(items);

    const orderId = uuid();
    const apiKey = req.headers["x-api-key"] as string || req.query.api_key as string || "unknown";

    // Store scan for later reference by calculate/log endpoints
    db.prepare(
      "INSERT INTO order_scans (id, api_key, restaurant, platform, items) VALUES (?, ?, ?, ?, ?)"
    ).run(
      orderId,
      apiKey,
      geminiResult.restaurant,
      geminiResult.platform,
      JSON.stringify(items)
    );

    res.json({
      order_id: orderId,
      restaurant: geminiResult.restaurant,
      platform: geminiResult.platform,
      items,
      total_nutrition,
      total_price,
      item_count,
    });
  } catch (err: any) {
    console.error("Order scan error:", err);
    if (err.message?.includes("API key") || err.message?.includes("GEMINI_API_KEY")) {
      res.status(503).json({ error: "Order scanning is not configured. GEMINI_API_KEY is missing or invalid." });
      return;
    }
    if (err.message?.includes("timeout")) {
      res.status(504).json({ error: "Order scanning timed out. Try again or use a smaller image." });
      return;
    }
    res.status(500).json({ error: "Failed to scan order. " + (err.message || "Unknown error") });
  }
});

/**
 * POST /calculate — Recalculate nutrition for selected items with optional splits.
 */
orderRoutes.post("/calculate", (req: Request, res: Response) => {
  try {
    const { order_id, items: selections } = req.body;

    if (!order_id || typeof order_id !== "string") {
      res.status(400).json({ error: "order_id is required" });
      return;
    }

    if (!Array.isArray(selections)) {
      res.status(400).json({ error: "items must be an array of selection objects" });
      return;
    }

    const scan = db
      .prepare("SELECT * FROM order_scans WHERE id = ?")
      .get(order_id) as any;

    if (!scan) {
      res.status(404).json({ error: "Order scan not found. It may have expired (scans last 24 hours)." });
      return;
    }

    const storedItems: MatchedOrderItem[] = JSON.parse(scan.items);

    // Build a selection map: index -> { selected, quantity, split }
    const selectionMap = new Map<number, { selected: boolean; quantity: number; split: number }>();
    for (const sel of selections) {
      if (typeof sel.index === "number") {
        selectionMap.set(sel.index, {
          selected: sel.selected !== false,
          quantity: typeof sel.quantity === "number" && sel.quantity > 0 ? sel.quantity : 1,
          split: typeof sel.split === "number" && sel.split > 1 ? sel.split : 1,
        });
      }
    }

    // Update items based on selections
    const updatedItems: MatchedOrderItem[] = storedItems.map((item) => {
      const sel = selectionMap.get(item.index);
      if (!sel) return item;

      const updatedItem = { ...item, selected: sel.selected, quantity: sel.quantity };

      // Recalculate nutrition if match exists and item is selected
      if (updatedItem.match && updatedItem.selected) {
        // Re-search the food to get fresh data for nutrition calculation
        const food = searchFoodWithSize(
          updatedItem.original_name,
          updatedItem.size,
          scan.restaurant
        );
        if (food) {
          const baseNutrition = getNutrition(food, sel.quantity);
          // Apply split divisor
          if (sel.split > 1) {
            for (const key of NUTRITION_KEYS) {
              const val = baseNutrition[key];
              if (val != null) {
                (baseNutrition as any)[key] = Math.round((val / sel.split) * 100) / 100;
              }
            }
          }
          updatedItem.nutrition = baseNutrition;
        }
      }

      return updatedItem;
    });

    const selectedForTotals = updatedItems.filter((i) => i.selected);
    const nutritionList = selectedForTotals
      .filter((i) => i.nutrition !== null)
      .map((i) => i.nutrition as NutritionValues);

    const total_nutrition = nutritionList.length > 0 ? sumNutrition(nutritionList) : null;

    let total_price: number | null = null;
    const priceItems = selectedForTotals.filter((i) => i.price !== null);
    if (priceItems.length > 0) {
      total_price = Math.round(
        priceItems.reduce((sum, i) => sum + (i.price ?? 0) * i.quantity, 0) * 100
      ) / 100;
    }

    res.json({
      order_id,
      restaurant: scan.restaurant,
      platform: scan.platform,
      items: updatedItems,
      total_nutrition,
      total_price,
      item_count: selectedForTotals.reduce((sum, i) => sum + i.quantity, 0),
    });
  } catch (err: any) {
    console.error("Order calculate error:", err);
    res.status(500).json({ error: "Failed to calculate order. " + (err.message || "Unknown error") });
  }
});

/**
 * POST /log — Log selected order items as meal entries.
 */
orderRoutes.post("/log", (req: Request, res: Response) => {
  try {
    const { order_id, items: selections, meal_type } = req.body;

    if (!order_id || typeof order_id !== "string") {
      res.status(400).json({ error: "order_id is required" });
      return;
    }

    if (!Array.isArray(selections)) {
      res.status(400).json({ error: "items must be an array of selection objects" });
      return;
    }

    const validMealTypes = ["breakfast", "lunch", "dinner", "snack"];
    if (meal_type && !validMealTypes.includes(meal_type)) {
      res.status(400).json({
        error: `meal_type must be one of: ${validMealTypes.join(", ")}`,
      });
      return;
    }

    const scan = db
      .prepare("SELECT * FROM order_scans WHERE id = ?")
      .get(order_id) as any;

    if (!scan) {
      res.status(404).json({ error: "Order scan not found. It may have expired (scans last 24 hours)." });
      return;
    }

    const storedItems: MatchedOrderItem[] = JSON.parse(scan.items);
    const apiKey = req.headers["x-api-key"] as string || req.query.api_key as string || "unknown";

    // Build selection map
    const selectionMap = new Map<number, { selected: boolean; quantity: number; split: number }>();
    for (const sel of selections) {
      if (typeof sel.index === "number") {
        selectionMap.set(sel.index, {
          selected: sel.selected !== false,
          quantity: typeof sel.quantity === "number" && sel.quantity > 0 ? sel.quantity : 1,
          split: typeof sel.split === "number" && sel.split > 1 ? sel.split : 1,
        });
      }
    }

    const savedEntries: string[] = [];

    for (const item of storedItems) {
      const sel = selectionMap.get(item.index);
      const isSelected = sel ? sel.selected : item.selected;
      if (!isSelected) continue;
      if (!item.match) continue;

      const quantity = sel?.quantity ?? item.quantity;
      const split = sel?.split ?? 1;

      // Recalculate nutrition with split
      const food = searchFoodWithSize(item.original_name, item.size, scan.restaurant);
      let nutrition = item.nutrition;
      if (food) {
        nutrition = getNutrition(food, quantity);
        if (split > 1 && nutrition) {
          for (const key of NUTRITION_KEYS) {
            const val = nutrition[key];
            if (val != null) {
              (nutrition as any)[key] = Math.round((val / split) * 100) / 100;
            }
          }
        }
      }

      const contributionId = uuid();
      db.prepare(`
        INSERT INTO contributions (id, api_key, type, status, food_id, data)
        VALUES (?, ?, 'new_food', 'approved', ?, ?)
      `).run(
        contributionId,
        apiKey,
        item.match.id,
        JSON.stringify({
          source: "order_scan",
          order_id,
          meal_type: meal_type || null,
          restaurant: scan.restaurant,
          platform: scan.platform,
          original_name: item.original_name,
          quantity,
          split,
          customizations: item.customizations,
          nutrition,
        })
      );
      savedEntries.push(contributionId);
    }

    res.json({
      order_id,
      restaurant: scan.restaurant,
      platform: scan.platform,
      meal_type: meal_type || null,
      logged: true,
      saved_entries: savedEntries.length,
      entry_ids: savedEntries,
    });
  } catch (err: any) {
    console.error("Order log error:", err);
    res.status(500).json({ error: "Failed to log order. " + (err.message || "Unknown error") });
  }
});
