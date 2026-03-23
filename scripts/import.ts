import db from "../src/data/database";

const USDA_API = "https://api.nal.usda.gov/fdc/v1";
const API_KEY = "DEMO_KEY";

const NUTRIENT_MAP: Record<number, string> = {
  1008: "calories", 1004: "total_fat", 1258: "saturated_fat", 1257: "trans_fat",
  1253: "cholesterol", 1093: "sodium", 1005: "total_carbohydrates", 1079: "dietary_fiber",
  2000: "total_sugars", 1003: "protein", 1114: "vitamin_d", 1087: "calcium", 1089: "iron", 1092: "potassium",
};

const insert = db.prepare(`
  INSERT OR IGNORE INTO foods (id, name, brand, category, serving_size, serving_unit, barcode, source,
    calories, total_fat, saturated_fat, trans_fat, cholesterol, sodium,
    total_carbohydrates, dietary_fiber, total_sugars, protein, vitamin_d, calcium, iron, potassium)
  VALUES (@id, @name, @brand, @category, @serving_size, @serving_unit, @barcode, 'usda',
    @calories, @total_fat, @saturated_fat, @trans_fat, @cholesterol, @sodium,
    @total_carbohydrates, @dietary_fiber, @total_sugars, @protein, @vitamin_d, @calcium, @iron, @potassium)
`);

const insertMany = db.transaction((foods: Record<string, unknown>[]) => {
  for (const f of foods) insert.run(f);
});

async function fetchAndInsert(query: string, page = 1): Promise<number> {
  const url = `${USDA_API}/foods/search?api_key=${API_KEY}&query=${encodeURIComponent(query)}&pageSize=200&pageNumber=${page}`;
  const res = await fetch(url);
  const data: any = await res.json();
  const foods = (data.foods || []).map((item: any) => {
    const n: Record<string, number> = {
      calories: 0, total_fat: 0, saturated_fat: 0, trans_fat: 0,
      cholesterol: 0, sodium: 0, total_carbohydrates: 0, dietary_fiber: 0,
      total_sugars: 0, protein: 0, vitamin_d: 0, calcium: 0, iron: 0, potassium: 0,
    };
    for (const fn of item.foodNutrients || []) {
      const k = NUTRIENT_MAP[fn.nutrientId];
      if (k) n[k] = Math.round(fn.value * 10) / 10;
    }
    return {
      id: `usda-${item.fdcId}`,
      name: item.description,
      brand: item.brandOwner || item.brandName || null,
      category: item.foodCategory || "Uncategorized",
      serving_size: item.servingSize || 100,
      serving_unit: item.servingSizeUnit || "g",
      barcode: item.gtinUpc || null,
      ...n,
    };
  });
  insertMany(foods);
  return foods.length;
}

async function main() {
  const queries = [
    "chicken", "beef", "pork", "fish", "salmon", "shrimp",
    "rice", "pasta", "bread", "tortilla",
    "apple", "banana", "orange", "strawberry",
    "broccoli", "spinach", "carrot", "tomato", "potato",
    "milk", "cheese", "yogurt", "butter", "egg",
    "olive oil", "sugar", "flour",
    "cereal", "oatmeal", "granola",
    "pizza", "burger", "sandwich", "salad", "soup",
    "coffee", "juice", "soda",
    "chocolate", "cookie", "ice cream",
    "beans", "lentils", "tofu", "nuts", "peanut butter",
  ];

  console.log("Importing USDA data...\n");
  let total = 0;

  for (const q of queries) {
    try {
      const count = await fetchAndInsert(q);
      total += count;
      console.log(`  ${q}: ${count} items (${total} total)`);
    } catch (err: any) {
      console.log(`  ${q}: ERROR - ${err.message}`);
    }
    // DEMO_KEY rate limit
    await new Promise((r) => setTimeout(r, 2500));
  }

  const dbCount = (db.prepare("SELECT COUNT(*) as c FROM foods").get() as any).c;
  console.log(`\nDone! Database has ${dbCount} foods.`);
}

main();
