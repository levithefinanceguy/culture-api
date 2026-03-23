import db from "./database";

const USDA_API_BASE = "https://api.nal.usda.gov/fdc/v1";
const USDA_API_KEY = process.env.USDA_API_KEY || "DEMO_KEY";

interface USDANutrient {
  nutrientId: number;
  nutrientName: string;
  value: number;
}

interface USDAFoodItem {
  fdcId: number;
  description: string;
  brandOwner?: string;
  brandName?: string;
  foodCategory?: string;
  gtinUpc?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients: USDANutrient[];
}

const NUTRIENT_MAP: Record<number, string> = {
  1008: "calories",
  1004: "total_fat",
  1258: "saturated_fat",
  1257: "trans_fat",
  1253: "cholesterol",
  1093: "sodium",
  1005: "total_carbohydrates",
  1079: "dietary_fiber",
  2000: "total_sugars",
  1003: "protein",
  1114: "vitamin_d",
  1087: "calcium",
  1089: "iron",
  1092: "potassium",
};

const insertFood = db.prepare(`
  INSERT OR IGNORE INTO foods (
    id, name, brand, category, serving_size, serving_unit, barcode, source,
    calories, total_fat, saturated_fat, trans_fat, cholesterol, sodium,
    total_carbohydrates, dietary_fiber, total_sugars, protein,
    vitamin_d, calcium, iron, potassium
  ) VALUES (
    @id, @name, @brand, @category, @serving_size, @serving_unit, @barcode, 'usda',
    @calories, @total_fat, @saturated_fat, @trans_fat, @cholesterol, @sodium,
    @total_carbohydrates, @dietary_fiber, @total_sugars, @protein,
    @vitamin_d, @calcium, @iron, @potassium
  )
`);

const insertMany = db.transaction((foods: any[]) => {
  for (const food of foods) {
    insertFood.run(food);
  }
});

function parseFood(item: USDAFoodItem) {
  const nutrients: Record<string, number> = {
    calories: 0,
    total_fat: 0,
    saturated_fat: 0,
    trans_fat: 0,
    cholesterol: 0,
    sodium: 0,
    total_carbohydrates: 0,
    dietary_fiber: 0,
    total_sugars: 0,
    protein: 0,
    vitamin_d: 0,
    calcium: 0,
    iron: 0,
    potassium: 0,
  };

  for (const n of item.foodNutrients) {
    const col = NUTRIENT_MAP[n.nutrientId];
    if (col) {
      nutrients[col] = Math.round(n.value * 10) / 10;
    }
  }

  return {
    id: `usda-${item.fdcId}`,
    name: item.description,
    brand: item.brandOwner || item.brandName || null,
    category: item.foodCategory || "Uncategorized",
    serving_size: item.servingSize || 100,
    serving_unit: item.servingSizeUnit || "g",
    barcode: item.gtinUpc || null,
    ...nutrients,
  };
}

async function fetchPage(query: string, pageNumber: number, pageSize: number): Promise<USDAFoodItem[]> {
  const url = `${USDA_API_BASE}/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(query)}&pageSize=${pageSize}&pageNumber=${pageNumber}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`USDA API error: ${res.status}`);
  const data = await res.json();
  return data.foods || [];
}

async function importCategory(query: string, maxPages: number = 5) {
  console.log(`Importing: "${query}"...`);
  let total = 0;

  for (let page = 1; page <= maxPages; page++) {
    const items = await fetchPage(query, page, 200);
    if (items.length === 0) break;

    const parsed = items.map(parseFood);
    insertMany(parsed);
    total += parsed.length;
    console.log(`  Page ${page}: ${items.length} items (${total} total)`);

    // Rate limit: DEMO_KEY allows 30 req/hour, real key allows 1000/hour
    await new Promise((r) => setTimeout(r, USDA_API_KEY === "DEMO_KEY" ? 2500 : 500));
  }

  return total;
}

async function main() {
  const categories = [
    "chicken", "beef", "pork", "fish", "salmon", "shrimp",
    "rice", "pasta", "bread", "tortilla",
    "apple", "banana", "orange", "strawberry", "blueberry",
    "broccoli", "spinach", "carrot", "tomato", "potato",
    "milk", "cheese", "yogurt", "butter", "egg",
    "olive oil", "sugar", "flour", "salt", "pepper",
    "cereal", "oatmeal", "granola",
    "pizza", "burger", "sandwich", "salad", "soup",
    "coffee", "tea", "juice", "soda", "water",
    "chocolate", "cookie", "cake", "ice cream",
    "beans", "lentils", "tofu", "nuts", "peanut butter",
  ];

  console.log("Starting USDA import...\n");
  let grandTotal = 0;

  for (const cat of categories) {
    const count = await importCategory(cat, 3);
    grandTotal += count;
  }

  console.log(`\nDone! Imported ${grandTotal} total food items.`);

  const dbCount = db.prepare("SELECT COUNT(*) as count FROM foods").get() as any;
  console.log(`Database now has ${dbCount.count} foods.`);
}

main().catch(console.error);
