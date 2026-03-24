/**
 * Open Food Facts API client — fallback data source for foods not in Culture's database.
 *
 * Data is licensed under the Open Database License (ODbL).
 * Attribution: "Product data from Open Food Facts (openfoodfacts.org)"
 */

const OFF_BASE_URL = "https://world.openfoodfacts.org";
const USER_AGENT = "CultureAPI/1.0 (culture-api; contact@cheeselabs.com)";
const TIMEOUT_MS = 5000;

export const OFF_ATTRIBUTION =
  "Product data from Open Food Facts (openfoodfacts.org) — Open Database License";

// --- Types ---

export interface OFFFood {
  name: string;
  brand: string | null;
  category: string | null;
  barcode: string | null;
  serving_size: number;
  serving_unit: string;
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
  ingredients_text: string | null;
  nutriscore_grade: string | null;
  nova_group: number | null;
  image_url: string | null;
}

// --- Helpers ---

function parseServingSize(raw: string | undefined | null): { size: number; unit: string } {
  if (!raw) return { size: 100, unit: "g" };

  // Try to extract number and unit, e.g. "30g", "1 cup (240ml)", "2 tbsp (30g)"
  const match = raw.match(/([\d.]+)\s*(g|ml|oz|cup|tbsp|tsp|piece|slice|serving)?/i);
  if (match) {
    return {
      size: parseFloat(match[1]) || 100,
      unit: (match[2] || "g").toLowerCase(),
    };
  }

  return { size: 100, unit: "g" };
}

function mapNutriments(nutriments: any): Pick<
  OFFFood,
  | "calories" | "total_fat" | "saturated_fat" | "trans_fat"
  | "cholesterol" | "sodium" | "total_carbohydrates" | "dietary_fiber"
  | "total_sugars" | "protein"
> {
  if (!nutriments) {
    return {
      calories: 0, total_fat: 0, saturated_fat: 0, trans_fat: 0,
      cholesterol: 0, sodium: 0, total_carbohydrates: 0, dietary_fiber: 0,
      total_sugars: 0, protein: 0,
    };
  }

  // OFF stores sodium as "salt" sometimes; salt (g) * 400 = sodium (mg)
  // But they also provide sodium_100g directly in grams — convert g to mg
  let sodiumMg = 0;
  if (nutriments["sodium_100g"] != null) {
    // OFF sodium is in g per 100g; convert to mg
    sodiumMg = (nutriments["sodium_100g"] || 0) * 1000;
  } else if (nutriments["salt_100g"] != null) {
    // salt (g) * 0.4 = sodium (g), then * 1000 = mg
    sodiumMg = (nutriments["salt_100g"] || 0) * 400;
  }

  // OFF cholesterol is in mg per 100g
  const cholesterolMg = nutriments["cholesterol_100g"] || 0;

  return {
    calories: nutriments["energy-kcal_100g"] || nutriments["energy_kcal_100g"] || 0,
    total_fat: nutriments["fat_100g"] || 0,
    saturated_fat: nutriments["saturated-fat_100g"] || nutriments["saturated_fat_100g"] || 0,
    trans_fat: nutriments["trans-fat_100g"] || nutriments["trans_fat_100g"] || 0,
    cholesterol: cholesterolMg,
    sodium: Math.round(sodiumMg),
    total_carbohydrates: nutriments["carbohydrates_100g"] || 0,
    dietary_fiber: nutriments["fiber_100g"] || 0,
    total_sugars: nutriments["sugars_100g"] || 0,
    protein: nutriments["proteins_100g"] || 0,
  };
}

function mapProduct(product: any): OFFFood | null {
  if (!product) return null;

  const name = product.product_name || product.product_name_en;
  if (!name) return null;

  const { size, unit } = parseServingSize(product.serving_size);
  const nutrition = mapNutriments(product.nutriments);

  // Extract first category
  let category: string | null = null;
  if (product.categories) {
    const cats = product.categories.split(",").map((c: string) => c.trim());
    category = cats[0] || null;
  }

  return {
    name,
    brand: product.brands || null,
    category,
    barcode: product.code || null,
    serving_size: size,
    serving_unit: unit,
    ...nutrition,
    ingredients_text: product.ingredients_text || product.ingredients_text_en || null,
    nutriscore_grade: product.nutriscore_grade || null,
    nova_group: product.nova_group != null ? Number(product.nova_group) : null,
    image_url: product.image_front_url || product.image_url || null,
  };
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

// --- Public API ---

/**
 * Look up a single product by barcode.
 * Returns null if not found or on error.
 */
export async function lookupBarcode(barcode: string): Promise<OFFFood | null> {
  try {
    const url = `${OFF_BASE_URL}/api/v2/product/${encodeURIComponent(barcode)}.json`;
    const response = await fetchWithTimeout(url);

    if (!response.ok) return null;

    const data = (await response.json()) as any;
    if (data.status !== 1 || !data.product) return null;

    return mapProduct(data.product);
  } catch {
    // Network error, timeout, etc.
    return null;
  }
}

/**
 * Search Open Food Facts by text query.
 * Returns an array of mapped foods (empty on error).
 */
export async function searchFoods(query: string, limit: number = 10): Promise<OFFFood[]> {
  try {
    const params = new URLSearchParams({
      search_terms: query,
      json: "1",
      page_size: String(Math.min(limit, 50)),
    });
    const url = `${OFF_BASE_URL}/cgi/search.pl?${params.toString()}`;
    const response = await fetchWithTimeout(url);

    if (!response.ok) return [];

    const data = (await response.json()) as any;
    if (!data.products || !Array.isArray(data.products)) return [];

    const foods: OFFFood[] = [];
    for (const product of data.products) {
      const mapped = mapProduct(product);
      if (mapped) foods.push(mapped);
      if (foods.length >= limit) break;
    }

    return foods;
  } catch {
    return [];
  }
}
