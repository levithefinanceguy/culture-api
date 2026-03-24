/**
 * Regional Chain Nutrition Data Import — Batch 3
 *
 * Cincinnati/Midwest and other regional chain menu data.
 * Nutrition values sourced from published chain nutrition guides.
 *
 * Usage:
 *   npx ts-node scripts/import-chains-batch3.ts
 */

import { v4 as uuidv4 } from "uuid";
import db from "../src/data/database";
import { calculateNutriScore } from "../src/services/nutrition-score";
import { calculatePersonalHealthScore } from "../src/services/health-score";
import { detectAllergens, detectDietaryTags } from "../src/services/food-analysis";
import { generateApiKey } from "../src/middleware/auth";

interface MenuItem {
  name: string;
  category: string;
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
  ingredients_text?: string;
}

interface ChainData {
  chain: string;
  items: MenuItem[];
}

// Upsert vendor record
const upsertVendor = db.prepare(`
  INSERT INTO vendors (id, name, type, api_key)
  VALUES (@id, @name, @type, @api_key)
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    type = excluded.type
`);

// Upsert food record
const upsertFood = db.prepare(`
  INSERT INTO foods (id, name, brand, category, serving_size, serving_unit, source, vendor_id,
    calories, total_fat, saturated_fat, trans_fat, cholesterol, sodium,
    total_carbohydrates, dietary_fiber, total_sugars, protein,
    ingredients_text, allergens, dietary_tags, nutri_score, nutri_grade,
    updated_at)
  VALUES (@id, @name, @brand, @category, @serving_size, @serving_unit, 'vendor', @vendor_id,
    @calories, @total_fat, @saturated_fat, @trans_fat, @cholesterol, @sodium,
    @total_carbohydrates, @dietary_fiber, @total_sugars, @protein,
    @ingredients_text, @allergens, @dietary_tags, @nutri_score, @nutri_grade,
    datetime('now'))
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    brand = excluded.brand,
    category = excluded.category,
    serving_size = excluded.serving_size,
    serving_unit = excluded.serving_unit,
    vendor_id = excluded.vendor_id,
    calories = excluded.calories,
    total_fat = excluded.total_fat,
    saturated_fat = excluded.saturated_fat,
    trans_fat = excluded.trans_fat,
    cholesterol = excluded.cholesterol,
    sodium = excluded.sodium,
    total_carbohydrates = excluded.total_carbohydrates,
    dietary_fiber = excluded.dietary_fiber,
    total_sugars = excluded.total_sugars,
    protein = excluded.protein,
    ingredients_text = excluded.ingredients_text,
    allergens = excluded.allergens,
    dietary_tags = excluded.dietary_tags,
    nutri_score = excluded.nutri_score,
    nutri_grade = excluded.nutri_grade,
    updated_at = datetime('now')
`);

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildFoodRecord(item: MenuItem, chainName: string, vendorId: string) {
  const chainSlug = slugify(chainName);
  const itemSlug = slugify(item.name);
  const id = `chain-${chainSlug}-${itemSlug}`;

  // Calculate nutri-score (needs per-100g values)
  const servingG = item.serving_unit === "g" ? item.serving_size : item.serving_size * 1;
  const factor = servingG > 0 ? 100 / servingG : 1;

  const nutriResult = calculateNutriScore(
    {
      calories: item.calories * factor,
      totalSugars: item.total_sugars * factor,
      saturatedFat: item.saturated_fat * factor,
      sodium: item.sodium * factor,
      dietaryFiber: item.dietary_fiber * factor,
      protein: item.protein * factor,
    },
    item.category
  );

  const ingredientsText = item.ingredients_text || null;
  const allergens = ingredientsText ? detectAllergens(ingredientsText) : [];
  const dietaryTags = detectDietaryTags(ingredientsText || "", {
    total_carbohydrates: item.total_carbohydrates,
    protein: item.protein,
    total_fat: item.total_fat,
    total_sugars: item.total_sugars,
    dietary_fiber: item.dietary_fiber,
  });

  return {
    id,
    name: item.name,
    brand: chainName,
    category: item.category,
    serving_size: item.serving_size,
    serving_unit: item.serving_unit,
    vendor_id: vendorId,
    calories: item.calories,
    total_fat: item.total_fat,
    saturated_fat: item.saturated_fat,
    trans_fat: item.trans_fat,
    cholesterol: item.cholesterol,
    sodium: item.sodium,
    total_carbohydrates: item.total_carbohydrates,
    dietary_fiber: item.dietary_fiber,
    total_sugars: item.total_sugars,
    protein: item.protein,
    ingredients_text: ingredientsText,
    allergens: allergens.length > 0 ? allergens.join(",") : null,
    dietary_tags: dietaryTags.length > 0 ? dietaryTags.join(",") : null,
    nutri_score: nutriResult.score,
    nutri_grade: nutriResult.grade,
  };
}

// ─── Chain Data ───────────────────────────────────────────────────────────────

const chains: ChainData[] = [
  // ─── Skyline Chili ────────────────────────────────────────────────────────
  {
    chain: "Skyline Chili",
    items: [
      { name: "3-Way", category: "entree", serving_size: 340, serving_unit: "g", calories: 730, total_fat: 30, saturated_fat: 14, trans_fat: 1, cholesterol: 75, sodium: 1280, total_carbohydrates: 76, dietary_fiber: 5, total_sugars: 5, protein: 32, ingredients_text: "Spaghetti (enriched wheat flour), chili (beef, water, tomato paste, spices, cocoa, cinnamon, cumin), cheddar cheese (milk, cheese cultures, salt, enzymes)" },
      { name: "4-Way with Onions", category: "entree", serving_size: 370, serving_unit: "g", calories: 770, total_fat: 31, saturated_fat: 14, trans_fat: 1, cholesterol: 75, sodium: 1310, total_carbohydrates: 80, dietary_fiber: 6, total_sugars: 6, protein: 33, ingredients_text: "Spaghetti (enriched wheat flour), chili (beef, water, tomato paste, spices, cocoa, cinnamon), cheddar cheese (milk, cheese cultures, salt, enzymes), diced onions" },
      { name: "4-Way with Beans", category: "entree", serving_size: 397, serving_unit: "g", calories: 820, total_fat: 31, saturated_fat: 14, trans_fat: 1, cholesterol: 75, sodium: 1400, total_carbohydrates: 92, dietary_fiber: 10, total_sugars: 5, protein: 38, ingredients_text: "Spaghetti (enriched wheat flour), chili (beef, water, tomato paste, spices, cocoa, cinnamon), cheddar cheese (milk, cheese cultures, salt, enzymes), kidney beans" },
      { name: "5-Way", category: "entree", serving_size: 425, serving_unit: "g", calories: 860, total_fat: 32, saturated_fat: 14, trans_fat: 1, cholesterol: 75, sodium: 1440, total_carbohydrates: 96, dietary_fiber: 11, total_sugars: 6, protein: 39, ingredients_text: "Spaghetti (enriched wheat flour), chili (beef, water, tomato paste, spices, cocoa, cinnamon), cheddar cheese (milk, cheese cultures, salt, enzymes), kidney beans, diced onions" },
      { name: "Cheese Coney", category: "entree", serving_size: 156, serving_unit: "g", calories: 350, total_fat: 21, saturated_fat: 10, trans_fat: 0.5, cholesterol: 50, sodium: 870, total_carbohydrates: 24, dietary_fiber: 1, total_sugars: 4, protein: 16, ingredients_text: "Hot dog (beef, water, salt, spices, sodium nitrite), bun (enriched wheat flour, water, sugar, yeast), chili (beef, water, tomato paste, spices), cheddar cheese, mustard" },
      { name: "Plain Coney", category: "entree", serving_size: 120, serving_unit: "g", calories: 230, total_fat: 13, saturated_fat: 5, trans_fat: 0.5, cholesterol: 35, sodium: 680, total_carbohydrates: 22, dietary_fiber: 1, total_sugars: 4, protein: 10, ingredients_text: "Hot dog (beef, water, salt, spices, sodium nitrite), bun (enriched wheat flour, water, sugar, yeast), chili (beef, water, tomato paste, spices), mustard" },
      { name: "Chili Cheese Fries", category: "side", serving_size: 312, serving_unit: "g", calories: 680, total_fat: 38, saturated_fat: 16, trans_fat: 1, cholesterol: 70, sodium: 1150, total_carbohydrates: 58, dietary_fiber: 4, total_sugars: 2, protein: 24, ingredients_text: "French fries (potatoes, vegetable oil, salt), chili (beef, water, tomato paste, spices), cheddar cheese (milk, cheese cultures, salt, enzymes)" },
      { name: "Chili Bowl", category: "entree", serving_size: 227, serving_unit: "g", calories: 310, total_fat: 17, saturated_fat: 7, trans_fat: 0.5, cholesterol: 55, sodium: 920, total_carbohydrates: 16, dietary_fiber: 3, total_sugars: 3, protein: 22, ingredients_text: "Chili (beef, water, tomato paste, spices, cocoa, cinnamon, cumin, garlic)" },
      { name: "Black Bean and Rice Burrito", category: "entree", serving_size: 340, serving_unit: "g", calories: 540, total_fat: 16, saturated_fat: 7, trans_fat: 0, cholesterol: 25, sodium: 1180, total_carbohydrates: 78, dietary_fiber: 9, total_sugars: 4, protein: 20, ingredients_text: "Flour tortilla (enriched wheat flour, water, vegetable shortening), black beans, rice, cheddar cheese, salsa" },
      { name: "Chili Cheese Sandwich", category: "entree", serving_size: 198, serving_unit: "g", calories: 430, total_fat: 22, saturated_fat: 11, trans_fat: 0.5, cholesterol: 60, sodium: 1060, total_carbohydrates: 34, dietary_fiber: 2, total_sugars: 5, protein: 24, ingredients_text: "Bread (enriched wheat flour, water, sugar, yeast), chili (beef, water, tomato paste, spices), cheddar cheese (milk, cheese cultures, salt, enzymes)" },
      { name: "Greek Salad", category: "salad", serving_size: 283, serving_unit: "g", calories: 280, total_fat: 22, saturated_fat: 7, trans_fat: 0, cholesterol: 30, sodium: 730, total_carbohydrates: 12, dietary_fiber: 3, total_sugars: 5, protein: 10, ingredients_text: "Romaine lettuce, tomatoes, cucumber, feta cheese (milk, cheese cultures, salt, enzymes), olives, Greek dressing (soybean oil, vinegar, spices)" },
      { name: "Buffalo Chicken Wrap", category: "entree", serving_size: 283, serving_unit: "g", calories: 520, total_fat: 24, saturated_fat: 8, trans_fat: 0, cholesterol: 65, sodium: 1380, total_carbohydrates: 46, dietary_fiber: 3, total_sugars: 3, protein: 28, ingredients_text: "Flour tortilla (enriched wheat flour, water, vegetable shortening), grilled chicken breast, buffalo sauce, lettuce, cheddar cheese, ranch dressing" },
      { name: "Loaded Baked Potato", category: "side", serving_size: 340, serving_unit: "g", calories: 480, total_fat: 22, saturated_fat: 12, trans_fat: 0.5, cholesterol: 55, sodium: 640, total_carbohydrates: 52, dietary_fiber: 5, total_sugars: 3, protein: 18, ingredients_text: "Russet potato, butter (cream, salt), cheddar cheese (milk, cheese cultures, salt, enzymes), sour cream, bacon bits, chives" },
      { name: "Crackers", category: "side", serving_size: 28, serving_unit: "g", calories: 120, total_fat: 4, saturated_fat: 1, trans_fat: 0, cholesterol: 0, sodium: 250, total_carbohydrates: 19, dietary_fiber: 1, total_sugars: 2, protein: 2, ingredients_text: "Enriched wheat flour, vegetable oil, salt, leavening" },
      { name: "Cinnamon Roll", category: "dessert", serving_size: 142, serving_unit: "g", calories: 450, total_fat: 18, saturated_fat: 8, trans_fat: 0, cholesterol: 35, sodium: 380, total_carbohydrates: 66, dietary_fiber: 2, total_sugars: 30, protein: 6, ingredients_text: "Enriched wheat flour, sugar, butter (cream, salt), cinnamon, eggs, milk, cream cheese icing (cream cheese, powdered sugar, vanilla)" },
    ],
  },

  // ─── Gold Star Chili ──────────────────────────────────────────────────────
  {
    chain: "Gold Star Chili",
    items: [
      { name: "3-Way", category: "entree", serving_size: 340, serving_unit: "g", calories: 720, total_fat: 29, saturated_fat: 13, trans_fat: 1, cholesterol: 70, sodium: 1250, total_carbohydrates: 78, dietary_fiber: 5, total_sugars: 5, protein: 30, ingredients_text: "Spaghetti (enriched wheat flour), chili (beef, water, tomato paste, spices, chocolate, cinnamon), cheddar cheese (milk, cheese cultures, salt, enzymes)" },
      { name: "4-Way", category: "entree", serving_size: 380, serving_unit: "g", calories: 790, total_fat: 30, saturated_fat: 13, trans_fat: 1, cholesterol: 70, sodium: 1350, total_carbohydrates: 90, dietary_fiber: 8, total_sugars: 5, protein: 35, ingredients_text: "Spaghetti (enriched wheat flour), chili (beef, water, tomato paste, spices, chocolate, cinnamon), cheddar cheese, kidney beans or diced onions" },
      { name: "5-Way", category: "entree", serving_size: 420, serving_unit: "g", calories: 850, total_fat: 31, saturated_fat: 14, trans_fat: 1, cholesterol: 75, sodium: 1420, total_carbohydrates: 95, dietary_fiber: 10, total_sugars: 6, protein: 38, ingredients_text: "Spaghetti (enriched wheat flour), chili (beef, water, tomato paste, spices, chocolate, cinnamon), cheddar cheese, kidney beans, diced onions" },
      { name: "Cheese Coney", category: "entree", serving_size: 156, serving_unit: "g", calories: 360, total_fat: 22, saturated_fat: 10, trans_fat: 0.5, cholesterol: 50, sodium: 890, total_carbohydrates: 24, dietary_fiber: 1, total_sugars: 4, protein: 16, ingredients_text: "Hot dog (beef, water, salt, spices), bun (enriched wheat flour, water, sugar, yeast), chili (beef, water, tomato paste, spices), cheddar cheese, mustard" },
      { name: "Double Deckeroni", category: "entree", serving_size: 227, serving_unit: "g", calories: 580, total_fat: 36, saturated_fat: 16, trans_fat: 1, cholesterol: 80, sodium: 1340, total_carbohydrates: 32, dietary_fiber: 1, total_sugars: 5, protein: 30, ingredients_text: "Hot dogs (beef), bun (enriched wheat flour), chili (beef, water, tomato paste, spices), cheddar cheese, pepperoni, mustard" },
      { name: "Chili Cheese Fries", category: "side", serving_size: 312, serving_unit: "g", calories: 690, total_fat: 39, saturated_fat: 16, trans_fat: 1, cholesterol: 70, sodium: 1180, total_carbohydrates: 56, dietary_fiber: 4, total_sugars: 2, protein: 24, ingredients_text: "French fries (potatoes, vegetable oil, salt), chili (beef, water, tomato paste, spices), cheddar cheese" },
      { name: "Chili Bowl", category: "entree", serving_size: 227, serving_unit: "g", calories: 300, total_fat: 16, saturated_fat: 7, trans_fat: 0.5, cholesterol: 55, sodium: 900, total_carbohydrates: 15, dietary_fiber: 3, total_sugars: 3, protein: 21, ingredients_text: "Chili (beef, water, tomato paste, spices, chocolate, cinnamon, cumin)" },
      { name: "Loaded Fries", category: "side", serving_size: 340, serving_unit: "g", calories: 760, total_fat: 44, saturated_fat: 18, trans_fat: 1, cholesterol: 80, sodium: 1350, total_carbohydrates: 62, dietary_fiber: 4, total_sugars: 3, protein: 28, ingredients_text: "French fries (potatoes, vegetable oil), chili (beef, water, tomato paste, spices), cheddar cheese, bacon bits, sour cream" },
      { name: "BLT", category: "entree", serving_size: 198, serving_unit: "g", calories: 420, total_fat: 24, saturated_fat: 7, trans_fat: 0, cholesterol: 35, sodium: 890, total_carbohydrates: 34, dietary_fiber: 2, total_sugars: 5, protein: 16, ingredients_text: "Bread (enriched wheat flour, water, sugar, yeast), bacon, lettuce, tomato, mayonnaise (soybean oil, eggs, vinegar)" },
      { name: "Coney Island", category: "entree", serving_size: 130, serving_unit: "g", calories: 280, total_fat: 16, saturated_fat: 6, trans_fat: 0.5, cholesterol: 40, sodium: 740, total_carbohydrates: 23, dietary_fiber: 1, total_sugars: 4, protein: 12, ingredients_text: "Hot dog (beef, water, salt, spices), bun (enriched wheat flour), chili (beef, water, tomato paste, spices), mustard, onions" },
      { name: "Side Salad", category: "salad", serving_size: 170, serving_unit: "g", calories: 120, total_fat: 7, saturated_fat: 3, trans_fat: 0, cholesterol: 15, sodium: 180, total_carbohydrates: 10, dietary_fiber: 2, total_sugars: 4, protein: 5, ingredients_text: "Romaine lettuce, tomatoes, cucumber, cheddar cheese, croutons" },
      { name: "Chili Burrito", category: "entree", serving_size: 312, serving_unit: "g", calories: 560, total_fat: 24, saturated_fat: 10, trans_fat: 0.5, cholesterol: 60, sodium: 1280, total_carbohydrates: 56, dietary_fiber: 5, total_sugars: 4, protein: 26, ingredients_text: "Flour tortilla (enriched wheat flour, water, vegetable shortening), chili (beef, water, tomato paste, spices), cheddar cheese, rice, sour cream" },
      { name: "Black Bean Bowl", category: "entree", serving_size: 340, serving_unit: "g", calories: 420, total_fat: 10, saturated_fat: 4, trans_fat: 0, cholesterol: 15, sodium: 980, total_carbohydrates: 62, dietary_fiber: 12, total_sugars: 5, protein: 18, ingredients_text: "Black beans, rice, cheddar cheese, salsa, sour cream, lettuce" },
      { name: "Buffalo Wings", category: "appetizer", serving_size: 227, serving_unit: "g", calories: 520, total_fat: 34, saturated_fat: 10, trans_fat: 0, cholesterol: 120, sodium: 1560, total_carbohydrates: 12, dietary_fiber: 1, total_sugars: 2, protein: 38, ingredients_text: "Chicken wings (chicken, water, salt), buffalo sauce (cayenne pepper sauce, butter, vinegar, garlic), celery" },
      { name: "Garlic Bread", category: "side", serving_size: 85, serving_unit: "g", calories: 270, total_fat: 14, saturated_fat: 6, trans_fat: 0, cholesterol: 15, sodium: 440, total_carbohydrates: 30, dietary_fiber: 1, total_sugars: 2, protein: 6, ingredients_text: "Italian bread (enriched wheat flour, water, yeast, salt), butter (cream, salt), garlic, parsley" },
    ],
  },

  // ─── LaRosa's Pizza ───────────────────────────────────────────────────────
  {
    chain: "LaRosa's Pizza",
    items: [
      { name: "Pepperoni Pizza per slice", category: "entree", serving_size: 142, serving_unit: "g", calories: 340, total_fat: 15, saturated_fat: 7, trans_fat: 0, cholesterol: 35, sodium: 780, total_carbohydrates: 36, dietary_fiber: 2, total_sugars: 4, protein: 15, ingredients_text: "Pizza dough (enriched wheat flour, water, yeast, salt, sugar, soybean oil), pizza sauce (tomatoes, spices), mozzarella cheese (milk, cheese cultures, salt, enzymes), pepperoni (pork, beef, salt, spices, sodium nitrite)" },
      { name: "Cheese Pizza per slice", category: "entree", serving_size: 128, serving_unit: "g", calories: 280, total_fat: 11, saturated_fat: 5, trans_fat: 0, cholesterol: 25, sodium: 620, total_carbohydrates: 34, dietary_fiber: 2, total_sugars: 4, protein: 13, ingredients_text: "Pizza dough (enriched wheat flour, water, yeast, salt, sugar, soybean oil), pizza sauce (tomatoes, spices), mozzarella cheese (milk, cheese cultures, salt, enzymes)" },
      { name: "Buddy LaRosa per slice", category: "entree", serving_size: 185, serving_unit: "g", calories: 420, total_fat: 20, saturated_fat: 9, trans_fat: 0, cholesterol: 50, sodium: 1020, total_carbohydrates: 38, dietary_fiber: 2, total_sugars: 5, protein: 20, ingredients_text: "Pizza dough (enriched wheat flour, water, yeast, salt, sugar, soybean oil), pizza sauce (tomatoes, spices), mozzarella cheese, pepperoni, sausage, mushrooms, green peppers, onions" },
      { name: "Calzone", category: "entree", serving_size: 340, serving_unit: "g", calories: 760, total_fat: 34, saturated_fat: 16, trans_fat: 0.5, cholesterol: 80, sodium: 1580, total_carbohydrates: 72, dietary_fiber: 3, total_sugars: 6, protein: 36, ingredients_text: "Pizza dough (enriched wheat flour, water, yeast, salt, sugar, soybean oil), ricotta cheese (milk, vinegar, salt), mozzarella cheese, pepperoni, sausage, pizza sauce" },
      { name: "Baked Pasta", category: "entree", serving_size: 370, serving_unit: "g", calories: 650, total_fat: 26, saturated_fat: 12, trans_fat: 0, cholesterol: 65, sodium: 1240, total_carbohydrates: 72, dietary_fiber: 4, total_sugars: 8, protein: 28, ingredients_text: "Penne pasta (enriched wheat flour), marinara sauce (tomatoes, olive oil, garlic, basil), mozzarella cheese, ricotta cheese, parmesan cheese" },
      { name: "Breadsticks", category: "side", serving_size: 113, serving_unit: "g", calories: 320, total_fat: 10, saturated_fat: 3, trans_fat: 0, cholesterol: 5, sodium: 580, total_carbohydrates: 48, dietary_fiber: 2, total_sugars: 4, protein: 9, ingredients_text: "Pizza dough (enriched wheat flour, water, yeast, salt, sugar, soybean oil), butter (cream, salt), garlic, parsley" },
      { name: "Garlic Bread", category: "side", serving_size: 85, serving_unit: "g", calories: 260, total_fat: 13, saturated_fat: 5, trans_fat: 0, cholesterol: 10, sodium: 420, total_carbohydrates: 30, dietary_fiber: 1, total_sugars: 2, protein: 6, ingredients_text: "Italian bread (enriched wheat flour, water, yeast, salt), butter (cream, salt), garlic, parsley" },
      { name: "Caesar Salad", category: "salad", serving_size: 227, serving_unit: "g", calories: 260, total_fat: 18, saturated_fat: 4, trans_fat: 0, cholesterol: 20, sodium: 580, total_carbohydrates: 16, dietary_fiber: 3, total_sugars: 3, protein: 10, ingredients_text: "Romaine lettuce, Caesar dressing (soybean oil, parmesan cheese, anchovy paste, garlic, lemon juice, eggs), croutons (enriched wheat flour, butter), parmesan cheese" },
      { name: "Italian Sub", category: "entree", serving_size: 312, serving_unit: "g", calories: 680, total_fat: 34, saturated_fat: 14, trans_fat: 0, cholesterol: 80, sodium: 1820, total_carbohydrates: 56, dietary_fiber: 3, total_sugars: 6, protein: 34, ingredients_text: "Sub roll (enriched wheat flour, water, yeast, salt), salami, capicola, ham, provolone cheese (milk, cheese cultures, salt, enzymes), lettuce, tomato, onion, Italian dressing" },
      { name: "Meatball Sub", category: "entree", serving_size: 340, serving_unit: "g", calories: 720, total_fat: 32, saturated_fat: 14, trans_fat: 0.5, cholesterol: 90, sodium: 1640, total_carbohydrates: 68, dietary_fiber: 4, total_sugars: 10, protein: 36, ingredients_text: "Sub roll (enriched wheat flour, water, yeast, salt), meatballs (beef, pork, bread crumbs, eggs, parmesan cheese), marinara sauce, mozzarella cheese" },
      { name: "Wings 6pc", category: "appetizer", serving_size: 198, serving_unit: "g", calories: 480, total_fat: 32, saturated_fat: 9, trans_fat: 0, cholesterol: 110, sodium: 1080, total_carbohydrates: 8, dietary_fiber: 0, total_sugars: 1, protein: 36, ingredients_text: "Chicken wings (chicken, water, salt), seasoning (salt, garlic powder, paprika, black pepper), vegetable oil" },
      { name: "Loaded Fries", category: "side", serving_size: 312, serving_unit: "g", calories: 620, total_fat: 36, saturated_fat: 14, trans_fat: 0.5, cholesterol: 55, sodium: 1120, total_carbohydrates: 52, dietary_fiber: 4, total_sugars: 2, protein: 22, ingredients_text: "French fries (potatoes, vegetable oil, salt), mozzarella cheese, cheddar cheese, bacon bits, ranch dressing (soybean oil, buttermilk, eggs)" },
      { name: "Cookie", category: "dessert", serving_size: 85, serving_unit: "g", calories: 380, total_fat: 18, saturated_fat: 10, trans_fat: 0, cholesterol: 40, sodium: 280, total_carbohydrates: 52, dietary_fiber: 1, total_sugars: 28, protein: 4, ingredients_text: "Enriched wheat flour, butter (cream, salt), sugar, brown sugar, chocolate chips (sugar, chocolate liquor, cocoa butter, soy lecithin), eggs, vanilla extract" },
      { name: "Cinnamon Sticks", category: "dessert", serving_size: 142, serving_unit: "g", calories: 420, total_fat: 14, saturated_fat: 6, trans_fat: 0, cholesterol: 10, sodium: 380, total_carbohydrates: 66, dietary_fiber: 2, total_sugars: 24, protein: 7, ingredients_text: "Pizza dough (enriched wheat flour, water, yeast, salt, sugar, soybean oil), butter (cream, salt), cinnamon, sugar, cream cheese icing (cream cheese, powdered sugar)" },
      { name: "Garden Salad", category: "salad", serving_size: 198, serving_unit: "g", calories: 160, total_fat: 9, saturated_fat: 4, trans_fat: 0, cholesterol: 15, sodium: 320, total_carbohydrates: 14, dietary_fiber: 3, total_sugars: 5, protein: 7, ingredients_text: "Romaine lettuce, tomatoes, cucumber, red onion, mozzarella cheese, croutons, Italian dressing (soybean oil, vinegar, spices)" },
    ],
  },

  // ─── Graeter's Ice Cream ──────────────────────────────────────────────────
  {
    chain: "Graeter's Ice Cream",
    items: [
      { name: "Black Raspberry Chocolate Chip 1 scoop", category: "dessert", serving_size: 120, serving_unit: "g", calories: 310, total_fat: 19, saturated_fat: 12, trans_fat: 0, cholesterol: 65, sodium: 65, total_carbohydrates: 32, dietary_fiber: 1, total_sugars: 26, protein: 4, ingredients_text: "Cream, milk, sugar, black raspberries, chocolate chips (sugar, chocolate liquor, cocoa butter, soy lecithin, vanilla), egg yolks, vanilla extract" },
      { name: "Salted Caramel Chocolate Chip", category: "dessert", serving_size: 120, serving_unit: "g", calories: 340, total_fat: 20, saturated_fat: 13, trans_fat: 0, cholesterol: 70, sodium: 180, total_carbohydrates: 36, dietary_fiber: 0, total_sugars: 30, protein: 4, ingredients_text: "Cream, milk, sugar, caramel (sugar, cream, butter, salt), chocolate chips (sugar, chocolate liquor, cocoa butter, soy lecithin), egg yolks, sea salt" },
      { name: "Mint Chocolate Chip", category: "dessert", serving_size: 120, serving_unit: "g", calories: 320, total_fat: 20, saturated_fat: 12, trans_fat: 0, cholesterol: 65, sodium: 70, total_carbohydrates: 33, dietary_fiber: 0, total_sugars: 27, protein: 4, ingredients_text: "Cream, milk, sugar, chocolate chips (sugar, chocolate liquor, cocoa butter, soy lecithin, vanilla), egg yolks, peppermint extract" },
      { name: "Cookies and Cream", category: "dessert", serving_size: 120, serving_unit: "g", calories: 330, total_fat: 19, saturated_fat: 12, trans_fat: 0, cholesterol: 60, sodium: 140, total_carbohydrates: 36, dietary_fiber: 1, total_sugars: 28, protein: 4, ingredients_text: "Cream, milk, sugar, chocolate sandwich cookies (enriched wheat flour, sugar, cocoa, palm oil, corn syrup), egg yolks, vanilla" },
      { name: "Vanilla", category: "dessert", serving_size: 120, serving_unit: "g", calories: 290, total_fat: 18, saturated_fat: 11, trans_fat: 0, cholesterol: 70, sodium: 60, total_carbohydrates: 28, dietary_fiber: 0, total_sugars: 24, protein: 4, ingredients_text: "Cream, milk, sugar, egg yolks, vanilla extract" },
      { name: "Toffee Chocolate Chip", category: "dessert", serving_size: 120, serving_unit: "g", calories: 350, total_fat: 22, saturated_fat: 13, trans_fat: 0, cholesterol: 70, sodium: 130, total_carbohydrates: 34, dietary_fiber: 0, total_sugars: 28, protein: 4, ingredients_text: "Cream, milk, sugar, toffee pieces (sugar, butter, almonds), chocolate chips (sugar, chocolate liquor, cocoa butter, soy lecithin), egg yolks" },
      { name: "Buckeye Blitz", category: "dessert", serving_size: 120, serving_unit: "g", calories: 360, total_fat: 22, saturated_fat: 13, trans_fat: 0, cholesterol: 65, sodium: 120, total_carbohydrates: 36, dietary_fiber: 1, total_sugars: 29, protein: 5, ingredients_text: "Cream, milk, sugar, peanut butter (peanuts, salt), chocolate chips (sugar, chocolate liquor, cocoa butter, soy lecithin), egg yolks, cocoa" },
      { name: "Coffee", category: "dessert", serving_size: 120, serving_unit: "g", calories: 290, total_fat: 18, saturated_fat: 11, trans_fat: 0, cholesterol: 70, sodium: 60, total_carbohydrates: 28, dietary_fiber: 0, total_sugars: 24, protein: 4, ingredients_text: "Cream, milk, sugar, coffee extract, egg yolks" },
      { name: "Peanut Butter Chocolate Chip", category: "dessert", serving_size: 120, serving_unit: "g", calories: 370, total_fat: 24, saturated_fat: 13, trans_fat: 0, cholesterol: 65, sodium: 130, total_carbohydrates: 33, dietary_fiber: 1, total_sugars: 26, protein: 6, ingredients_text: "Cream, milk, sugar, peanut butter (peanuts, salt), chocolate chips (sugar, chocolate liquor, cocoa butter, soy lecithin), egg yolks" },
      { name: "Cookie Dough", category: "dessert", serving_size: 120, serving_unit: "g", calories: 340, total_fat: 19, saturated_fat: 12, trans_fat: 0, cholesterol: 65, sodium: 140, total_carbohydrates: 38, dietary_fiber: 0, total_sugars: 30, protein: 4, ingredients_text: "Cream, milk, sugar, cookie dough (enriched wheat flour, brown sugar, butter, sugar, eggs, vanilla), chocolate chips, egg yolks" },
      { name: "Butter Pecan", category: "dessert", serving_size: 120, serving_unit: "g", calories: 340, total_fat: 22, saturated_fat: 12, trans_fat: 0, cholesterol: 70, sodium: 110, total_carbohydrates: 30, dietary_fiber: 1, total_sugars: 25, protein: 4, ingredients_text: "Cream, milk, sugar, pecans, butter (cream, salt), egg yolks, vanilla extract" },
      { name: "Strawberry", category: "dessert", serving_size: 120, serving_unit: "g", calories: 280, total_fat: 17, saturated_fat: 10, trans_fat: 0, cholesterol: 60, sodium: 55, total_carbohydrates: 30, dietary_fiber: 1, total_sugars: 26, protein: 3, ingredients_text: "Cream, milk, sugar, strawberries, egg yolks, natural flavor" },
      { name: "Double Chocolate", category: "dessert", serving_size: 120, serving_unit: "g", calories: 330, total_fat: 20, saturated_fat: 12, trans_fat: 0, cholesterol: 60, sodium: 80, total_carbohydrates: 34, dietary_fiber: 2, total_sugars: 28, protein: 5, ingredients_text: "Cream, milk, sugar, cocoa, chocolate chips (sugar, chocolate liquor, cocoa butter, soy lecithin), egg yolks" },
      { name: "Coconut Chocolate Chip", category: "dessert", serving_size: 120, serving_unit: "g", calories: 340, total_fat: 22, saturated_fat: 15, trans_fat: 0, cholesterol: 60, sodium: 75, total_carbohydrates: 32, dietary_fiber: 1, total_sugars: 26, protein: 4, ingredients_text: "Cream, milk, sugar, coconut, chocolate chips (sugar, chocolate liquor, cocoa butter, soy lecithin), egg yolks, coconut extract" },
      { name: "Waffle Cone", category: "dessert", serving_size: 42, serving_unit: "g", calories: 160, total_fat: 4, saturated_fat: 2, trans_fat: 0, cholesterol: 15, sodium: 50, total_carbohydrates: 28, dietary_fiber: 0, total_sugars: 12, protein: 3, ingredients_text: "Enriched wheat flour, sugar, butter (cream, salt), eggs, vanilla extract" },
    ],
  },

  // ─── Penn Station ─────────────────────────────────────────────────────────
  {
    chain: "Penn Station",
    items: [
      { name: "Philly Cheesesteak small", category: "entree", serving_size: 227, serving_unit: "g", calories: 480, total_fat: 22, saturated_fat: 10, trans_fat: 0.5, cholesterol: 70, sodium: 1080, total_carbohydrates: 42, dietary_fiber: 2, total_sugars: 5, protein: 28, ingredients_text: "Sub roll (enriched wheat flour, water, yeast, salt), grilled steak (beef sirloin), provolone cheese (milk, cheese cultures, salt, enzymes), grilled onions, mushrooms" },
      { name: "Italian sub", category: "entree", serving_size: 283, serving_unit: "g", calories: 560, total_fat: 28, saturated_fat: 12, trans_fat: 0, cholesterol: 75, sodium: 1620, total_carbohydrates: 46, dietary_fiber: 2, total_sugars: 5, protein: 30, ingredients_text: "Sub roll (enriched wheat flour, water, yeast, salt), salami, capicola, ham, provolone cheese, lettuce, tomato, onion, Italian dressing, banana peppers" },
      { name: "Chicken Teriyaki", category: "entree", serving_size: 283, serving_unit: "g", calories: 490, total_fat: 14, saturated_fat: 4, trans_fat: 0, cholesterol: 65, sodium: 1380, total_carbohydrates: 56, dietary_fiber: 2, total_sugars: 14, protein: 32, ingredients_text: "Sub roll (enriched wheat flour, water, yeast, salt), grilled chicken breast, teriyaki sauce (soy sauce, sugar, rice wine, ginger, garlic), grilled onions, mushrooms" },
      { name: "Club sub", category: "entree", serving_size: 283, serving_unit: "g", calories: 520, total_fat: 24, saturated_fat: 8, trans_fat: 0, cholesterol: 65, sodium: 1420, total_carbohydrates: 44, dietary_fiber: 2, total_sugars: 5, protein: 32, ingredients_text: "Sub roll (enriched wheat flour, water, yeast, salt), turkey, ham, bacon, provolone cheese, lettuce, tomato, mayonnaise (soybean oil, eggs, vinegar)" },
      { name: "Artichoke sub", category: "entree", serving_size: 255, serving_unit: "g", calories: 440, total_fat: 18, saturated_fat: 6, trans_fat: 0, cholesterol: 30, sodium: 1080, total_carbohydrates: 50, dietary_fiber: 4, total_sugars: 5, protein: 18, ingredients_text: "Sub roll (enriched wheat flour, water, yeast, salt), artichoke hearts, mushrooms, provolone cheese, roasted red peppers, Italian dressing" },
      { name: "Pizza sub", category: "entree", serving_size: 283, serving_unit: "g", calories: 540, total_fat: 24, saturated_fat: 10, trans_fat: 0, cholesterol: 55, sodium: 1380, total_carbohydrates: 52, dietary_fiber: 3, total_sugars: 8, protein: 26, ingredients_text: "Sub roll (enriched wheat flour, water, yeast, salt), pepperoni, sausage, mozzarella cheese, pizza sauce (tomatoes, spices), green peppers, mushrooms" },
      { name: "BLT", category: "entree", serving_size: 213, serving_unit: "g", calories: 460, total_fat: 26, saturated_fat: 8, trans_fat: 0, cholesterol: 40, sodium: 1020, total_carbohydrates: 38, dietary_fiber: 2, total_sugars: 5, protein: 18, ingredients_text: "Sub roll (enriched wheat flour, water, yeast, salt), bacon, lettuce, tomato, mayonnaise (soybean oil, eggs, vinegar)" },
      { name: "Fresh Cut Fries small", category: "side", serving_size: 142, serving_unit: "g", calories: 340, total_fat: 16, saturated_fat: 3, trans_fat: 0, cholesterol: 0, sodium: 420, total_carbohydrates: 46, dietary_fiber: 4, total_sugars: 1, protein: 4, ingredients_text: "Potatoes, vegetable oil (canola oil, soybean oil), salt" },
      { name: "Fresh Cut Fries medium", category: "side", serving_size: 213, serving_unit: "g", calories: 510, total_fat: 24, saturated_fat: 4.5, trans_fat: 0, cholesterol: 0, sodium: 630, total_carbohydrates: 68, dietary_fiber: 6, total_sugars: 1, protein: 6, ingredients_text: "Potatoes, vegetable oil (canola oil, soybean oil), salt" },
      { name: "Provolone and Mushroom", category: "entree", serving_size: 255, serving_unit: "g", calories: 470, total_fat: 20, saturated_fat: 9, trans_fat: 0.5, cholesterol: 65, sodium: 1060, total_carbohydrates: 42, dietary_fiber: 2, total_sugars: 4, protein: 28, ingredients_text: "Sub roll (enriched wheat flour, water, yeast, salt), grilled steak (beef sirloin), provolone cheese (milk, cheese cultures, salt, enzymes), sautéed mushrooms" },
      { name: "Chicken Cordon Bleu", category: "entree", serving_size: 283, serving_unit: "g", calories: 540, total_fat: 22, saturated_fat: 9, trans_fat: 0, cholesterol: 80, sodium: 1480, total_carbohydrates: 48, dietary_fiber: 2, total_sugars: 5, protein: 34, ingredients_text: "Sub roll (enriched wheat flour, water, yeast, salt), grilled chicken breast, ham, Swiss cheese (milk, cheese cultures, salt, enzymes), honey mustard (mustard, honey)" },
      { name: "Dagwood", category: "entree", serving_size: 340, serving_unit: "g", calories: 620, total_fat: 30, saturated_fat: 12, trans_fat: 0.5, cholesterol: 85, sodium: 1740, total_carbohydrates: 50, dietary_fiber: 3, total_sugars: 6, protein: 38, ingredients_text: "Sub roll (enriched wheat flour, water, yeast, salt), grilled steak, turkey, ham, salami, provolone cheese, lettuce, tomato, onion, mayonnaise" },
      { name: "Veggie sub", category: "entree", serving_size: 255, serving_unit: "g", calories: 380, total_fat: 14, saturated_fat: 5, trans_fat: 0, cholesterol: 20, sodium: 840, total_carbohydrates: 50, dietary_fiber: 5, total_sugars: 6, protein: 14, ingredients_text: "Sub roll (enriched wheat flour, water, yeast, salt), mushrooms, green peppers, onions, provolone cheese, lettuce, tomato, banana peppers, Italian dressing" },
      { name: "Cookie", category: "dessert", serving_size: 85, serving_unit: "g", calories: 370, total_fat: 17, saturated_fat: 10, trans_fat: 0, cholesterol: 40, sodium: 260, total_carbohydrates: 50, dietary_fiber: 1, total_sugars: 28, protein: 4, ingredients_text: "Enriched wheat flour, butter (cream, salt), sugar, brown sugar, chocolate chips (sugar, chocolate liquor, cocoa butter, soy lecithin), eggs, vanilla" },
      { name: "Lemonade", category: "beverage", serving_size: 473, serving_unit: "ml", calories: 210, total_fat: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 15, total_carbohydrates: 54, dietary_fiber: 0, total_sugars: 50, protein: 0, ingredients_text: "Water, sugar, lemon juice, natural flavor" },
    ],
  },

  // ─── Portillo's ───────────────────────────────────────────────────────────
  {
    chain: "Portillo's",
    items: [
      { name: "Italian Beef sandwich", category: "entree", serving_size: 312, serving_unit: "g", calories: 520, total_fat: 18, saturated_fat: 7, trans_fat: 0.5, cholesterol: 80, sodium: 1840, total_carbohydrates: 48, dietary_fiber: 2, total_sugars: 4, protein: 38, ingredients_text: "French bread (enriched wheat flour, water, yeast, salt), seasoned roast beef (beef, water, salt, garlic, Italian spices), giardiniera (peppers, celery, cauliflower, soybean oil, vinegar)" },
      { name: "Chicago Style Hot Dog", category: "entree", serving_size: 198, serving_unit: "g", calories: 320, total_fat: 16, saturated_fat: 6, trans_fat: 0, cholesterol: 40, sodium: 1120, total_carbohydrates: 30, dietary_fiber: 2, total_sugars: 6, protein: 13, ingredients_text: "Vienna beef hot dog (beef, water, salt, spices, garlic, paprika, sodium nitrite), poppy seed bun (enriched wheat flour, water, sugar, yeast, poppy seeds), mustard, relish, onions, tomato, pickle spear, sport peppers, celery salt" },
      { name: "Char-Grilled Burger", category: "entree", serving_size: 283, serving_unit: "g", calories: 640, total_fat: 38, saturated_fat: 15, trans_fat: 1.5, cholesterol: 110, sodium: 860, total_carbohydrates: 38, dietary_fiber: 1, total_sugars: 7, protein: 36, ingredients_text: "Burger bun (enriched wheat flour, water, sugar, yeast), ground beef (80/20), lettuce, tomato, onion, pickles, ketchup, mustard" },
      { name: "Chicken Sandwich", category: "entree", serving_size: 283, serving_unit: "g", calories: 560, total_fat: 24, saturated_fat: 5, trans_fat: 0, cholesterol: 75, sodium: 1240, total_carbohydrates: 52, dietary_fiber: 2, total_sugars: 6, protein: 32, ingredients_text: "Brioche bun (enriched wheat flour, butter, eggs, sugar), breaded chicken breast (chicken, wheat flour, water, salt, spices), lettuce, tomato, mayonnaise" },
      { name: "Polish Sausage", category: "entree", serving_size: 227, serving_unit: "g", calories: 520, total_fat: 34, saturated_fat: 12, trans_fat: 0, cholesterol: 70, sodium: 1480, total_carbohydrates: 32, dietary_fiber: 2, total_sugars: 5, protein: 22, ingredients_text: "Polish sausage (pork, beef, water, salt, spices, garlic, sodium nitrite), French bread (enriched wheat flour, water, yeast, salt), grilled onions, sport peppers, mustard" },
      { name: "Maxwell Street Polish", category: "entree", serving_size: 213, serving_unit: "g", calories: 480, total_fat: 30, saturated_fat: 11, trans_fat: 0, cholesterol: 65, sodium: 1360, total_carbohydrates: 30, dietary_fiber: 1, total_sugars: 5, protein: 20, ingredients_text: "Polish sausage (pork, beef, water, salt, spices, garlic), bun (enriched wheat flour, water, sugar, yeast), grilled onions, yellow mustard" },
      { name: "Chopped Salad", category: "salad", serving_size: 340, serving_unit: "g", calories: 470, total_fat: 32, saturated_fat: 8, trans_fat: 0, cholesterol: 50, sodium: 1080, total_carbohydrates: 24, dietary_fiber: 4, total_sugars: 6, protein: 24, ingredients_text: "Romaine lettuce, grilled chicken, bacon, gorgonzola cheese (milk, cheese cultures, salt, enzymes), tomatoes, pasta, Italian dressing (soybean oil, vinegar, spices)" },
      { name: "French Fries", category: "side", serving_size: 170, serving_unit: "g", calories: 380, total_fat: 18, saturated_fat: 3, trans_fat: 0, cholesterol: 0, sodium: 480, total_carbohydrates: 50, dietary_fiber: 4, total_sugars: 1, protein: 4, ingredients_text: "Potatoes, vegetable oil (canola oil, soybean oil), salt" },
      { name: "Onion Rings", category: "side", serving_size: 142, serving_unit: "g", calories: 420, total_fat: 24, saturated_fat: 4, trans_fat: 0, cholesterol: 5, sodium: 680, total_carbohydrates: 48, dietary_fiber: 2, total_sugars: 6, protein: 5, ingredients_text: "Onions, batter (enriched wheat flour, water, cornstarch, salt, leavening), vegetable oil (soybean oil)" },
      { name: "Cheese Fries", category: "side", serving_size: 227, serving_unit: "g", calories: 520, total_fat: 28, saturated_fat: 10, trans_fat: 0, cholesterol: 30, sodium: 820, total_carbohydrates: 52, dietary_fiber: 4, total_sugars: 2, protein: 12, ingredients_text: "Potatoes, vegetable oil, cheddar cheese sauce (cheddar cheese, milk, butter, wheat flour), salt" },
      { name: "Chocolate Cake Shake", category: "beverage", serving_size: 473, serving_unit: "ml", calories: 1050, total_fat: 48, saturated_fat: 30, trans_fat: 1, cholesterol: 150, sodium: 620, total_carbohydrates: 142, dietary_fiber: 3, total_sugars: 112, protein: 14, ingredients_text: "Vanilla ice cream (cream, milk, sugar, egg yolks, vanilla), chocolate cake (enriched wheat flour, sugar, cocoa, eggs, butter, milk), whole milk, whipped cream" },
      { name: "Strawberry Shake", category: "beverage", serving_size: 473, serving_unit: "ml", calories: 680, total_fat: 26, saturated_fat: 16, trans_fat: 0.5, cholesterol: 100, sodium: 340, total_carbohydrates: 100, dietary_fiber: 1, total_sugars: 84, protein: 12, ingredients_text: "Vanilla ice cream (cream, milk, sugar, egg yolks, vanilla), strawberries, whole milk, whipped cream" },
      { name: "Vanilla Shake", category: "beverage", serving_size: 473, serving_unit: "ml", calories: 640, total_fat: 26, saturated_fat: 16, trans_fat: 0.5, cholesterol: 100, sodium: 320, total_carbohydrates: 90, dietary_fiber: 0, total_sugars: 78, protein: 12, ingredients_text: "Vanilla ice cream (cream, milk, sugar, egg yolks, vanilla), whole milk, whipped cream" },
      { name: "Garden Salad", category: "salad", serving_size: 198, serving_unit: "g", calories: 140, total_fat: 7, saturated_fat: 3, trans_fat: 0, cholesterol: 10, sodium: 220, total_carbohydrates: 14, dietary_fiber: 3, total_sugars: 5, protein: 6, ingredients_text: "Romaine lettuce, tomatoes, cucumber, red onion, mozzarella cheese, croutons" },
      { name: "Tamale", category: "entree", serving_size: 170, serving_unit: "g", calories: 380, total_fat: 20, saturated_fat: 6, trans_fat: 0, cholesterol: 40, sodium: 860, total_carbohydrates: 38, dietary_fiber: 3, total_sugars: 3, protein: 14, ingredients_text: "Corn masa (corn flour, water, lard, salt), seasoned beef (beef, chili powder, cumin, garlic, salt), chili sauce (tomatoes, chili peppers, spices), corn husk" },
    ],
  },

  // ─── White Castle ─────────────────────────────────────────────────────────
  {
    chain: "White Castle",
    items: [
      { name: "Original Slider", category: "entree", serving_size: 59, serving_unit: "g", calories: 140, total_fat: 7, saturated_fat: 3, trans_fat: 0.5, cholesterol: 15, sodium: 360, total_carbohydrates: 13, dietary_fiber: 1, total_sugars: 2, protein: 6, ingredients_text: "Bun (enriched wheat flour, water, sugar, yeast), beef patty (100% beef), dehydrated onions, pickles" },
      { name: "Cheese Slider", category: "entree", serving_size: 68, serving_unit: "g", calories: 170, total_fat: 9, saturated_fat: 4.5, trans_fat: 0.5, cholesterol: 20, sodium: 470, total_carbohydrates: 14, dietary_fiber: 1, total_sugars: 2, protein: 8, ingredients_text: "Bun (enriched wheat flour, water, sugar, yeast), beef patty (100% beef), American cheese (milk, cheese cultures, salt, enzymes), dehydrated onions, pickles" },
      { name: "Jalapeno Cheese Slider", category: "entree", serving_size: 73, serving_unit: "g", calories: 180, total_fat: 10, saturated_fat: 5, trans_fat: 0.5, cholesterol: 25, sodium: 510, total_carbohydrates: 14, dietary_fiber: 1, total_sugars: 2, protein: 8, ingredients_text: "Bun (enriched wheat flour, water, sugar, yeast), beef patty (100% beef), jalapeño cheese (milk, jalapeño peppers, cheese cultures, salt, enzymes), dehydrated onions" },
      { name: "Chicken Slider", category: "entree", serving_size: 78, serving_unit: "g", calories: 190, total_fat: 9, saturated_fat: 2, trans_fat: 0, cholesterol: 20, sodium: 440, total_carbohydrates: 19, dietary_fiber: 1, total_sugars: 3, protein: 8, ingredients_text: "Bun (enriched wheat flour, water, sugar, yeast), breaded chicken breast (chicken, wheat flour, water, salt, spices, soybean oil), pickles" },
      { name: "Fish Slider", category: "entree", serving_size: 78, serving_unit: "g", calories: 200, total_fat: 10, saturated_fat: 2, trans_fat: 0, cholesterol: 15, sodium: 380, total_carbohydrates: 20, dietary_fiber: 1, total_sugars: 3, protein: 7, ingredients_text: "Bun (enriched wheat flour, water, sugar, yeast), breaded fish fillet (pollock, wheat flour, water, salt, soybean oil), tartar sauce (soybean oil, pickles, eggs)" },
      { name: "Impossible Slider", category: "entree", serving_size: 68, serving_unit: "g", calories: 160, total_fat: 8, saturated_fat: 3, trans_fat: 0, cholesterol: 0, sodium: 380, total_carbohydrates: 15, dietary_fiber: 1, total_sugars: 3, protein: 7, ingredients_text: "Bun (enriched wheat flour, water, sugar, yeast), Impossible patty (water, soy protein concentrate, coconut oil, sunflower oil, methylcellulose), smoked cheddar cheese" },
      { name: "Sack of 10 Sliders", category: "entree", serving_size: 590, serving_unit: "g", calories: 1400, total_fat: 70, saturated_fat: 30, trans_fat: 5, cholesterol: 150, sodium: 3600, total_carbohydrates: 130, dietary_fiber: 10, total_sugars: 20, protein: 60, ingredients_text: "Buns (enriched wheat flour, water, sugar, yeast), beef patties (100% beef), dehydrated onions, pickles" },
      { name: "French Fries small", category: "side", serving_size: 113, serving_unit: "g", calories: 280, total_fat: 14, saturated_fat: 2.5, trans_fat: 0, cholesterol: 0, sodium: 350, total_carbohydrates: 36, dietary_fiber: 3, total_sugars: 1, protein: 3, ingredients_text: "Potatoes, vegetable oil (soybean oil, canola oil), salt" },
      { name: "Onion Rings", category: "side", serving_size: 113, serving_unit: "g", calories: 340, total_fat: 18, saturated_fat: 3, trans_fat: 0, cholesterol: 0, sodium: 520, total_carbohydrates: 40, dietary_fiber: 2, total_sugars: 4, protein: 4, ingredients_text: "Onions, batter (enriched wheat flour, cornstarch, water, salt, leavening), vegetable oil (soybean oil)" },
      { name: "Chicken Rings", category: "side", serving_size: 113, serving_unit: "g", calories: 310, total_fat: 16, saturated_fat: 3, trans_fat: 0, cholesterol: 30, sodium: 680, total_carbohydrates: 28, dietary_fiber: 1, total_sugars: 2, protein: 14, ingredients_text: "Chicken (chicken breast, water, salt), batter (enriched wheat flour, cornstarch, salt, spices), vegetable oil (soybean oil)" },
      { name: "Mozzarella Sticks", category: "side", serving_size: 100, serving_unit: "g", calories: 330, total_fat: 18, saturated_fat: 8, trans_fat: 0, cholesterol: 30, sodium: 720, total_carbohydrates: 28, dietary_fiber: 1, total_sugars: 2, protein: 14, ingredients_text: "Mozzarella cheese (milk, cheese cultures, salt, enzymes), batter (enriched wheat flour, cornstarch, salt), vegetable oil, marinara sauce" },
      { name: "Clam Strips", category: "side", serving_size: 100, serving_unit: "g", calories: 290, total_fat: 16, saturated_fat: 3, trans_fat: 0, cholesterol: 20, sodium: 580, total_carbohydrates: 28, dietary_fiber: 1, total_sugars: 1, protein: 8, ingredients_text: "Clams, batter (enriched wheat flour, cornstarch, water, salt), vegetable oil (soybean oil)" },
      { name: "Breakfast Slider", category: "entree", serving_size: 85, serving_unit: "g", calories: 200, total_fat: 11, saturated_fat: 4, trans_fat: 0, cholesterol: 100, sodium: 480, total_carbohydrates: 14, dietary_fiber: 0, total_sugars: 2, protein: 10, ingredients_text: "Bun (enriched wheat flour, water, sugar, yeast), egg, sausage patty (pork, water, salt, spices), American cheese" },
      { name: "Loaded Fries", category: "side", serving_size: 198, serving_unit: "g", calories: 470, total_fat: 26, saturated_fat: 8, trans_fat: 0, cholesterol: 25, sodium: 820, total_carbohydrates: 44, dietary_fiber: 3, total_sugars: 2, protein: 14, ingredients_text: "Potatoes, vegetable oil, cheddar cheese sauce, bacon bits, ranch dressing (soybean oil, buttermilk, eggs)" },
      { name: "Chocolate Shake", category: "beverage", serving_size: 414, serving_unit: "ml", calories: 580, total_fat: 18, saturated_fat: 12, trans_fat: 0.5, cholesterol: 60, sodium: 380, total_carbohydrates: 96, dietary_fiber: 2, total_sugars: 80, protein: 10, ingredients_text: "Vanilla ice cream (cream, milk, sugar, egg yolks), chocolate syrup (corn syrup, cocoa, sugar), whole milk, whipped cream" },
    ],
  },

  // ─── Steak 'n Shake ───────────────────────────────────────────────────────
  {
    chain: "Steak 'n Shake",
    items: [
      { name: "Steakburger Single", category: "entree", serving_size: 198, serving_unit: "g", calories: 400, total_fat: 20, saturated_fat: 8, trans_fat: 1, cholesterol: 65, sodium: 740, total_carbohydrates: 32, dietary_fiber: 1, total_sugars: 6, protein: 22, ingredients_text: "Bun (enriched wheat flour, water, sugar, yeast), steakburger patty (beef), lettuce, tomato, pickles, ketchup, mustard" },
      { name: "Double Steakburger", category: "entree", serving_size: 270, serving_unit: "g", calories: 570, total_fat: 33, saturated_fat: 14, trans_fat: 2, cholesterol: 120, sodium: 1020, total_carbohydrates: 32, dietary_fiber: 1, total_sugars: 6, protein: 36, ingredients_text: "Bun (enriched wheat flour, water, sugar, yeast), steakburger patties (beef), lettuce, tomato, pickles, ketchup, mustard" },
      { name: "Triple Steakburger", category: "entree", serving_size: 340, serving_unit: "g", calories: 740, total_fat: 46, saturated_fat: 20, trans_fat: 3, cholesterol: 175, sodium: 1280, total_carbohydrates: 32, dietary_fiber: 1, total_sugars: 6, protein: 50, ingredients_text: "Bun (enriched wheat flour, water, sugar, yeast), steakburger patties (beef), lettuce, tomato, pickles, ketchup, mustard" },
      { name: "Frisco Melt", category: "entree", serving_size: 255, serving_unit: "g", calories: 620, total_fat: 38, saturated_fat: 16, trans_fat: 1.5, cholesterol: 100, sodium: 1180, total_carbohydrates: 38, dietary_fiber: 2, total_sugars: 8, protein: 30, ingredients_text: "Sourdough bread (enriched wheat flour, water, sourdough culture), steakburger patties (beef), American cheese, Swiss cheese, Frisco sauce (mayonnaise, ketchup, spices)" },
      { name: "Royale Steakburger", category: "entree", serving_size: 283, serving_unit: "g", calories: 580, total_fat: 34, saturated_fat: 14, trans_fat: 1.5, cholesterol: 95, sodium: 1060, total_carbohydrates: 36, dietary_fiber: 2, total_sugars: 7, protein: 32, ingredients_text: "Bun (enriched wheat flour, water, sugar, yeast), steakburger patties (beef), American cheese, bacon, lettuce, tomato, mayonnaise (soybean oil, eggs)" },
      { name: "Chicken Fingers", category: "entree", serving_size: 198, serving_unit: "g", calories: 440, total_fat: 22, saturated_fat: 4, trans_fat: 0, cholesterol: 60, sodium: 1120, total_carbohydrates: 32, dietary_fiber: 1, total_sugars: 1, protein: 28, ingredients_text: "Chicken breast (chicken, water, salt), breading (enriched wheat flour, cornstarch, salt, spices), vegetable oil (soybean oil)" },
      { name: "Thin n Crispy Fries", category: "side", serving_size: 142, serving_unit: "g", calories: 340, total_fat: 16, saturated_fat: 3, trans_fat: 0, cholesterol: 0, sodium: 440, total_carbohydrates: 46, dietary_fiber: 3, total_sugars: 1, protein: 4, ingredients_text: "Potatoes, vegetable oil (soybean oil, canola oil), salt" },
      { name: "Cheese Fries", category: "side", serving_size: 198, serving_unit: "g", calories: 480, total_fat: 26, saturated_fat: 10, trans_fat: 0, cholesterol: 30, sodium: 780, total_carbohydrates: 48, dietary_fiber: 3, total_sugars: 2, protein: 12, ingredients_text: "Potatoes, vegetable oil (soybean oil), cheddar cheese sauce (cheddar cheese, milk, butter, wheat flour), salt" },
      { name: "Chili", category: "entree", serving_size: 227, serving_unit: "g", calories: 320, total_fat: 18, saturated_fat: 7, trans_fat: 0.5, cholesterol: 55, sodium: 1040, total_carbohydrates: 20, dietary_fiber: 4, total_sugars: 4, protein: 20, ingredients_text: "Ground beef, kidney beans, tomatoes, tomato paste, onions, chili powder, cumin, garlic, salt, black pepper" },
      { name: "Side Salad", category: "salad", serving_size: 142, serving_unit: "g", calories: 100, total_fat: 5, saturated_fat: 2.5, trans_fat: 0, cholesterol: 10, sodium: 160, total_carbohydrates: 10, dietary_fiber: 2, total_sugars: 4, protein: 4, ingredients_text: "Romaine lettuce, tomatoes, cheddar cheese, croutons (enriched wheat flour, butter, garlic)" },
      { name: "Vanilla Shake", category: "beverage", serving_size: 414, serving_unit: "ml", calories: 580, total_fat: 18, saturated_fat: 12, trans_fat: 0.5, cholesterol: 70, sodium: 300, total_carbohydrates: 92, dietary_fiber: 0, total_sugars: 78, protein: 12, ingredients_text: "Vanilla ice cream (cream, milk, sugar, egg yolks, vanilla), whole milk, whipped cream" },
      { name: "Chocolate Shake", category: "beverage", serving_size: 414, serving_unit: "ml", calories: 620, total_fat: 18, saturated_fat: 12, trans_fat: 0.5, cholesterol: 70, sodium: 340, total_carbohydrates: 102, dietary_fiber: 2, total_sugars: 86, protein: 12, ingredients_text: "Vanilla ice cream (cream, milk, sugar, egg yolks), chocolate syrup (corn syrup, cocoa, sugar), whole milk, whipped cream" },
      { name: "Banana Shake", category: "beverage", serving_size: 414, serving_unit: "ml", calories: 610, total_fat: 18, saturated_fat: 12, trans_fat: 0.5, cholesterol: 70, sodium: 310, total_carbohydrates: 98, dietary_fiber: 1, total_sugars: 82, protein: 12, ingredients_text: "Vanilla ice cream (cream, milk, sugar, egg yolks, vanilla), banana, whole milk, whipped cream" },
      { name: "Wisconsin Buttery", category: "entree", serving_size: 255, serving_unit: "g", calories: 610, total_fat: 38, saturated_fat: 16, trans_fat: 1.5, cholesterol: 100, sodium: 980, total_carbohydrates: 34, dietary_fiber: 1, total_sugars: 6, protein: 32, ingredients_text: "Buttered bun (enriched wheat flour, butter, water, sugar, yeast), steakburger patties (beef), American cheese, grilled onions" },
      { name: "Apple Pie", category: "dessert", serving_size: 128, serving_unit: "g", calories: 380, total_fat: 18, saturated_fat: 8, trans_fat: 0, cholesterol: 10, sodium: 280, total_carbohydrates: 52, dietary_fiber: 2, total_sugars: 24, protein: 3, ingredients_text: "Pie crust (enriched wheat flour, butter, water, salt), apples, sugar, cinnamon, cornstarch, lemon juice" },
    ],
  },

  // ─── Culver's ─────────────────────────────────────────────────────────────
  {
    chain: "Culver's",
    items: [
      { name: "ButterBurger Single", category: "entree", serving_size: 213, serving_unit: "g", calories: 460, total_fat: 22, saturated_fat: 10, trans_fat: 1, cholesterol: 70, sodium: 740, total_carbohydrates: 38, dietary_fiber: 1, total_sugars: 7, protein: 25, ingredients_text: "Buttered bun (enriched wheat flour, butter, water, sugar, yeast), beef patty (100% beef), lettuce, tomato, pickles, onions, ketchup, mustard" },
      { name: "ButterBurger Double", category: "entree", serving_size: 298, serving_unit: "g", calories: 650, total_fat: 36, saturated_fat: 17, trans_fat: 2, cholesterol: 130, sodium: 1020, total_carbohydrates: 38, dietary_fiber: 1, total_sugars: 7, protein: 40, ingredients_text: "Buttered bun (enriched wheat flour, butter, water, sugar, yeast), beef patties (100% beef), lettuce, tomato, pickles, onions, ketchup, mustard" },
      { name: "ButterBurger Triple", category: "entree", serving_size: 383, serving_unit: "g", calories: 840, total_fat: 50, saturated_fat: 24, trans_fat: 3, cholesterol: 190, sodium: 1300, total_carbohydrates: 38, dietary_fiber: 1, total_sugars: 7, protein: 55, ingredients_text: "Buttered bun (enriched wheat flour, butter, water, sugar, yeast), beef patties (100% beef), lettuce, tomato, pickles, onions, ketchup, mustard" },
      { name: "Chicken Tenders", category: "entree", serving_size: 198, serving_unit: "g", calories: 450, total_fat: 20, saturated_fat: 3.5, trans_fat: 0, cholesterol: 65, sodium: 1180, total_carbohydrates: 36, dietary_fiber: 1, total_sugars: 1, protein: 30, ingredients_text: "Chicken breast (chicken, water, salt), breading (enriched wheat flour, cornstarch, salt, spices), vegetable oil (canola oil, soybean oil)" },
      { name: "North Atlantic Cod", category: "entree", serving_size: 255, serving_unit: "g", calories: 520, total_fat: 24, saturated_fat: 4, trans_fat: 0, cholesterol: 45, sodium: 1040, total_carbohydrates: 52, dietary_fiber: 2, total_sugars: 6, protein: 22, ingredients_text: "Bun (enriched wheat flour, water, sugar, yeast), cod fillet (cod, wheat flour, water, salt, leavening), tartar sauce (soybean oil, pickles, eggs, vinegar), lettuce" },
      { name: "Pork Tenderloin", category: "entree", serving_size: 255, serving_unit: "g", calories: 540, total_fat: 24, saturated_fat: 5, trans_fat: 0, cholesterol: 55, sodium: 1260, total_carbohydrates: 52, dietary_fiber: 2, total_sugars: 6, protein: 28, ingredients_text: "Bun (enriched wheat flour, water, sugar, yeast), breaded pork loin (pork, wheat flour, water, salt, spices), pickles, onion, mustard" },
      { name: "Crinkle Cut Fries", category: "side", serving_size: 142, serving_unit: "g", calories: 360, total_fat: 17, saturated_fat: 3, trans_fat: 0, cholesterol: 0, sodium: 480, total_carbohydrates: 48, dietary_fiber: 4, total_sugars: 1, protein: 4, ingredients_text: "Potatoes, vegetable oil (canola oil, soybean oil), salt" },
      { name: "Cheese Curds", category: "side", serving_size: 142, serving_unit: "g", calories: 510, total_fat: 32, saturated_fat: 16, trans_fat: 0, cholesterol: 60, sodium: 1080, total_carbohydrates: 32, dietary_fiber: 0, total_sugars: 2, protein: 22, ingredients_text: "Wisconsin cheese curds (milk, cheese cultures, salt, enzymes), batter (enriched wheat flour, cornstarch, salt, leavening), vegetable oil" },
      { name: "Onion Rings", category: "side", serving_size: 142, serving_unit: "g", calories: 420, total_fat: 22, saturated_fat: 4, trans_fat: 0, cholesterol: 5, sodium: 620, total_carbohydrates: 50, dietary_fiber: 2, total_sugars: 6, protein: 5, ingredients_text: "Onions, batter (enriched wheat flour, cornstarch, water, salt, leavening), vegetable oil (canola oil, soybean oil)" },
      { name: "Coleslaw", category: "side", serving_size: 113, serving_unit: "g", calories: 170, total_fat: 12, saturated_fat: 2, trans_fat: 0, cholesterol: 10, sodium: 240, total_carbohydrates: 14, dietary_fiber: 2, total_sugars: 10, protein: 1, ingredients_text: "Cabbage, carrots, mayonnaise (soybean oil, eggs, vinegar), sugar, vinegar, celery seed" },
      { name: "Vanilla Custard", category: "dessert", serving_size: 142, serving_unit: "g", calories: 280, total_fat: 14, saturated_fat: 9, trans_fat: 0, cholesterol: 80, sodium: 120, total_carbohydrates: 32, dietary_fiber: 0, total_sugars: 28, protein: 5, ingredients_text: "Cream, milk, sugar, egg yolks, vanilla extract" },
      { name: "Chocolate Custard", category: "dessert", serving_size: 142, serving_unit: "g", calories: 310, total_fat: 14, saturated_fat: 9, trans_fat: 0, cholesterol: 75, sodium: 140, total_carbohydrates: 40, dietary_fiber: 2, total_sugars: 34, protein: 6, ingredients_text: "Cream, milk, sugar, cocoa, egg yolks, vanilla extract" },
      { name: "Concrete Mixer", category: "dessert", serving_size: 340, serving_unit: "g", calories: 720, total_fat: 34, saturated_fat: 20, trans_fat: 0.5, cholesterol: 140, sodium: 340, total_carbohydrates: 92, dietary_fiber: 1, total_sugars: 76, protein: 12, ingredients_text: "Vanilla custard (cream, milk, sugar, egg yolks, vanilla), cookie dough (enriched wheat flour, sugar, butter, chocolate chips, eggs)" },
      { name: "Garden Salad", category: "salad", serving_size: 198, serving_unit: "g", calories: 150, total_fat: 8, saturated_fat: 4, trans_fat: 0, cholesterol: 15, sodium: 240, total_carbohydrates: 12, dietary_fiber: 3, total_sugars: 5, protein: 8, ingredients_text: "Romaine lettuce, tomatoes, cucumber, red onion, cheddar cheese, croutons (enriched wheat flour, butter)" },
      { name: "Wisconsin Cheese Soup", category: "entree", serving_size: 227, serving_unit: "g", calories: 340, total_fat: 24, saturated_fat: 14, trans_fat: 0.5, cholesterol: 65, sodium: 1120, total_carbohydrates: 16, dietary_fiber: 1, total_sugars: 4, protein: 14, ingredients_text: "Milk, cheddar cheese (milk, cheese cultures, salt, enzymes), cream, celery, onion, butter (cream, salt), wheat flour, chicken broth, spices" },
    ],
  },

  // ─── Waffle House ─────────────────────────────────────────────────────────
  {
    chain: "Waffle House",
    items: [
      { name: "Waffle", category: "entree", serving_size: 142, serving_unit: "g", calories: 340, total_fat: 12, saturated_fat: 5, trans_fat: 0, cholesterol: 60, sodium: 580, total_carbohydrates: 50, dietary_fiber: 1, total_sugars: 8, protein: 8, ingredients_text: "Waffle batter (enriched wheat flour, eggs, milk, vegetable oil, sugar, leavening, salt)" },
      { name: "Hash Browns scattered", category: "side", serving_size: 142, serving_unit: "g", calories: 200, total_fat: 10, saturated_fat: 2, trans_fat: 0, cholesterol: 0, sodium: 280, total_carbohydrates: 26, dietary_fiber: 2, total_sugars: 1, protein: 3, ingredients_text: "Potatoes, vegetable oil (soybean oil), salt" },
      { name: "Hash Browns All the Way", category: "side", serving_size: 312, serving_unit: "g", calories: 520, total_fat: 32, saturated_fat: 12, trans_fat: 0.5, cholesterol: 40, sodium: 1280, total_carbohydrates: 38, dietary_fiber: 3, total_sugars: 4, protein: 18, ingredients_text: "Potatoes, vegetable oil, American cheese, chili (beef, tomatoes, beans, spices), diced ham, sautéed onions, mushrooms, tomatoes, jalapeño peppers, gravy" },
      { name: "T-Bone Steak", category: "entree", serving_size: 340, serving_unit: "g", calories: 620, total_fat: 36, saturated_fat: 14, trans_fat: 1, cholesterol: 140, sodium: 580, total_carbohydrates: 0, dietary_fiber: 0, total_sugars: 0, protein: 68, ingredients_text: "T-bone steak (beef), salt, black pepper, butter" },
      { name: "Grilled Chicken", category: "entree", serving_size: 198, serving_unit: "g", calories: 280, total_fat: 8, saturated_fat: 2, trans_fat: 0, cholesterol: 120, sodium: 680, total_carbohydrates: 2, dietary_fiber: 0, total_sugars: 0, protein: 48, ingredients_text: "Chicken breast (chicken, water, salt), vegetable oil, seasoning (salt, garlic powder, paprika)" },
      { name: "Pork Chop", category: "entree", serving_size: 198, serving_unit: "g", calories: 380, total_fat: 18, saturated_fat: 6, trans_fat: 0, cholesterol: 110, sodium: 520, total_carbohydrates: 4, dietary_fiber: 0, total_sugars: 0, protein: 48, ingredients_text: "Bone-in pork chop, salt, black pepper, vegetable oil" },
      { name: "Cheese N Eggs", category: "entree", serving_size: 198, serving_unit: "g", calories: 420, total_fat: 30, saturated_fat: 14, trans_fat: 0.5, cholesterol: 480, sodium: 720, total_carbohydrates: 2, dietary_fiber: 0, total_sugars: 1, protein: 32, ingredients_text: "Eggs, American cheese (milk, cheese cultures, salt, enzymes), butter (cream, salt), salt, pepper" },
      { name: "Bacon Egg Cheese Sandwich", category: "entree", serving_size: 170, serving_unit: "g", calories: 440, total_fat: 26, saturated_fat: 10, trans_fat: 0.5, cholesterol: 220, sodium: 980, total_carbohydrates: 28, dietary_fiber: 1, total_sugars: 4, protein: 22, ingredients_text: "Texas toast (enriched wheat flour, butter), eggs, bacon (pork, water, salt, sugar, sodium nitrite), American cheese" },
      { name: "Sausage Biscuit", category: "entree", serving_size: 142, serving_unit: "g", calories: 380, total_fat: 24, saturated_fat: 10, trans_fat: 0, cholesterol: 40, sodium: 920, total_carbohydrates: 30, dietary_fiber: 1, total_sugars: 3, protein: 12, ingredients_text: "Biscuit (enriched wheat flour, butter, buttermilk, leavening, salt), sausage patty (pork, water, salt, spices, sage)" },
      { name: "Pecan Waffle", category: "entree", serving_size: 170, serving_unit: "g", calories: 440, total_fat: 20, saturated_fat: 6, trans_fat: 0, cholesterol: 60, sodium: 580, total_carbohydrates: 56, dietary_fiber: 2, total_sugars: 14, protein: 10, ingredients_text: "Waffle batter (enriched wheat flour, eggs, milk, vegetable oil, sugar, leavening, salt), pecans" },
      { name: "Chocolate Chip Waffle", category: "entree", serving_size: 170, serving_unit: "g", calories: 430, total_fat: 18, saturated_fat: 8, trans_fat: 0, cholesterol: 60, sodium: 580, total_carbohydrates: 60, dietary_fiber: 2, total_sugars: 20, protein: 9, ingredients_text: "Waffle batter (enriched wheat flour, eggs, milk, vegetable oil, sugar, leavening), chocolate chips (sugar, chocolate liquor, cocoa butter, soy lecithin)" },
      { name: "Grits", category: "side", serving_size: 170, serving_unit: "g", calories: 120, total_fat: 3, saturated_fat: 1.5, trans_fat: 0, cholesterol: 5, sodium: 280, total_carbohydrates: 20, dietary_fiber: 1, total_sugars: 0, protein: 3, ingredients_text: "Stone-ground corn grits, water, butter (cream, salt), salt" },
      { name: "Toast", category: "side", serving_size: 56, serving_unit: "g", calories: 160, total_fat: 4, saturated_fat: 2, trans_fat: 0, cholesterol: 5, sodium: 280, total_carbohydrates: 26, dietary_fiber: 1, total_sugars: 3, protein: 4, ingredients_text: "White bread (enriched wheat flour, water, sugar, yeast, salt), butter (cream, salt)" },
      { name: "Hash Browns smothered covered", category: "side", serving_size: 227, serving_unit: "g", calories: 380, total_fat: 22, saturated_fat: 9, trans_fat: 0.5, cholesterol: 25, sodium: 840, total_carbohydrates: 32, dietary_fiber: 3, total_sugars: 3, protein: 12, ingredients_text: "Potatoes, vegetable oil (soybean oil), sautéed onions, American cheese (milk, cheese cultures, salt, enzymes)" },
      { name: "Coffee", category: "beverage", serving_size: 355, serving_unit: "ml", calories: 5, total_fat: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 5, total_carbohydrates: 0, dietary_fiber: 0, total_sugars: 0, protein: 0, ingredients_text: "Brewed coffee (water, coffee)" },
    ],
  },

  // ─── Bojangles ────────────────────────────────────────────────────────────
  {
    chain: "Bojangles",
    items: [
      { name: "Famous Chicken Supreme", category: "entree", serving_size: 170, serving_unit: "g", calories: 380, total_fat: 20, saturated_fat: 5, trans_fat: 0, cholesterol: 85, sodium: 1080, total_carbohydrates: 22, dietary_fiber: 1, total_sugars: 0, protein: 28, ingredients_text: "Chicken breast (chicken, water, salt), seasoned coating (enriched wheat flour, salt, spices, leavening, garlic powder, onion powder), vegetable oil (soybean oil, canola oil)" },
      { name: "Cajun Chicken Filet", category: "entree", serving_size: 198, serving_unit: "g", calories: 480, total_fat: 22, saturated_fat: 5, trans_fat: 0, cholesterol: 70, sodium: 1340, total_carbohydrates: 42, dietary_fiber: 2, total_sugars: 5, protein: 28, ingredients_text: "Bun (enriched wheat flour, water, sugar, yeast), chicken breast (chicken, water, salt, Cajun seasoning), breading (wheat flour, spices), mayonnaise (soybean oil, eggs), pickles" },
      { name: "Bo-Berry Biscuit", category: "dessert", serving_size: 113, serving_unit: "g", calories: 380, total_fat: 16, saturated_fat: 8, trans_fat: 0, cholesterol: 5, sodium: 620, total_carbohydrates: 54, dietary_fiber: 1, total_sugars: 24, protein: 4, ingredients_text: "Biscuit (enriched wheat flour, buttermilk, vegetable shortening, leavening, salt), blueberries, icing (powdered sugar, water, vanilla)" },
      { name: "Chicken Biscuit", category: "entree", serving_size: 198, serving_unit: "g", calories: 460, total_fat: 24, saturated_fat: 8, trans_fat: 0, cholesterol: 55, sodium: 1250, total_carbohydrates: 38, dietary_fiber: 1, total_sugars: 3, protein: 22, ingredients_text: "Biscuit (enriched wheat flour, buttermilk, vegetable shortening, leavening, salt), fried chicken breast (chicken, wheat flour, spices, vegetable oil)" },
      { name: "Country Ham Biscuit", category: "entree", serving_size: 156, serving_unit: "g", calories: 340, total_fat: 16, saturated_fat: 7, trans_fat: 0, cholesterol: 35, sodium: 1420, total_carbohydrates: 34, dietary_fiber: 1, total_sugars: 3, protein: 16, ingredients_text: "Biscuit (enriched wheat flour, buttermilk, vegetable shortening, leavening, salt), country ham (pork, water, salt, sugar, sodium nitrite)" },
      { name: "Cajun Pintos", category: "side", serving_size: 142, serving_unit: "g", calories: 130, total_fat: 1, saturated_fat: 0, trans_fat: 0, cholesterol: 5, sodium: 480, total_carbohydrates: 22, dietary_fiber: 6, total_sugars: 1, protein: 7, ingredients_text: "Pinto beans, water, Cajun seasoning (salt, cayenne pepper, garlic powder, onion powder, paprika, black pepper), bacon (pork, water, salt)" },
      { name: "Dirty Rice", category: "side", serving_size: 156, serving_unit: "g", calories: 180, total_fat: 6, saturated_fat: 2, trans_fat: 0, cholesterol: 25, sodium: 620, total_carbohydrates: 24, dietary_fiber: 1, total_sugars: 1, protein: 8, ingredients_text: "Rice, seasoned sausage (pork, salt, spices, sage), Cajun seasoning, chicken broth, onions, green peppers" },
      { name: "Seasoned Fries", category: "side", serving_size: 142, serving_unit: "g", calories: 340, total_fat: 16, saturated_fat: 3, trans_fat: 0, cholesterol: 0, sodium: 540, total_carbohydrates: 46, dietary_fiber: 4, total_sugars: 1, protein: 4, ingredients_text: "Potatoes, vegetable oil (canola oil, soybean oil), Cajun seasoning (salt, paprika, garlic powder, cayenne pepper, black pepper)" },
      { name: "Mac and Cheese", category: "side", serving_size: 170, serving_unit: "g", calories: 260, total_fat: 12, saturated_fat: 7, trans_fat: 0, cholesterol: 30, sodium: 720, total_carbohydrates: 28, dietary_fiber: 1, total_sugars: 4, protein: 10, ingredients_text: "Elbow macaroni (enriched wheat flour), cheddar cheese sauce (cheddar cheese, milk, butter, wheat flour), cream, salt" },
      { name: "Green Beans", category: "side", serving_size: 142, serving_unit: "g", calories: 50, total_fat: 1.5, saturated_fat: 0.5, trans_fat: 0, cholesterol: 5, sodium: 380, total_carbohydrates: 6, dietary_fiber: 2, total_sugars: 2, protein: 2, ingredients_text: "Green beans, water, bacon (pork, water, salt), salt, black pepper" },
      { name: "Coleslaw", category: "side", serving_size: 113, serving_unit: "g", calories: 180, total_fat: 14, saturated_fat: 2, trans_fat: 0, cholesterol: 10, sodium: 220, total_carbohydrates: 14, dietary_fiber: 2, total_sugars: 10, protein: 1, ingredients_text: "Cabbage, carrots, mayonnaise (soybean oil, eggs, vinegar), sugar, vinegar" },
      { name: "Bo-Tato Rounds", category: "side", serving_size: 113, serving_unit: "g", calories: 280, total_fat: 16, saturated_fat: 3, trans_fat: 0, cholesterol: 0, sodium: 480, total_carbohydrates: 32, dietary_fiber: 3, total_sugars: 1, protein: 3, ingredients_text: "Potatoes, vegetable oil (canola oil, soybean oil), salt, dextrose" },
      { name: "Sweet Tea", category: "beverage", serving_size: 473, serving_unit: "ml", calories: 160, total_fat: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 10, total_carbohydrates: 42, dietary_fiber: 0, total_sugars: 42, protein: 0, ingredients_text: "Water, sugar, brewed tea" },
      { name: "Lemonade", category: "beverage", serving_size: 473, serving_unit: "ml", calories: 180, total_fat: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 15, total_carbohydrates: 46, dietary_fiber: 0, total_sugars: 44, protein: 0, ingredients_text: "Water, sugar, lemon juice, natural flavors" },
      { name: "Cinnamon Biscuit", category: "dessert", serving_size: 113, serving_unit: "g", calories: 370, total_fat: 16, saturated_fat: 8, trans_fat: 0, cholesterol: 5, sodium: 580, total_carbohydrates: 52, dietary_fiber: 1, total_sugars: 22, protein: 4, ingredients_text: "Biscuit (enriched wheat flour, buttermilk, vegetable shortening, leavening, salt), cinnamon, sugar, icing (powdered sugar, water, vanilla)" },
    ],
  },

  // ─── Wawa ─────────────────────────────────────────────────────────────────
  {
    chain: "Wawa",
    items: [
      { name: "Classic Hoagie", category: "entree", serving_size: 312, serving_unit: "g", calories: 580, total_fat: 26, saturated_fat: 10, trans_fat: 0, cholesterol: 70, sodium: 1640, total_carbohydrates: 52, dietary_fiber: 3, total_sugars: 6, protein: 32, ingredients_text: "Hoagie roll (enriched wheat flour, water, yeast, salt), ham, turkey, roast beef, American cheese, lettuce, tomato, onion, oil, vinegar" },
      { name: "Italian Hoagie", category: "entree", serving_size: 340, serving_unit: "g", calories: 660, total_fat: 34, saturated_fat: 14, trans_fat: 0, cholesterol: 80, sodium: 1920, total_carbohydrates: 54, dietary_fiber: 3, total_sugars: 6, protein: 34, ingredients_text: "Hoagie roll (enriched wheat flour, water, yeast, salt), salami, capicola, ham, provolone cheese (milk, cheese cultures, salt, enzymes), lettuce, tomato, onion, oil, vinegar, oregano" },
      { name: "Meatball Hoagie", category: "entree", serving_size: 340, serving_unit: "g", calories: 720, total_fat: 32, saturated_fat: 14, trans_fat: 0.5, cholesterol: 85, sodium: 1740, total_carbohydrates: 68, dietary_fiber: 4, total_sugars: 12, protein: 36, ingredients_text: "Hoagie roll (enriched wheat flour, water, yeast, salt), meatballs (beef, pork, bread crumbs, eggs, parmesan cheese), marinara sauce, provolone cheese" },
      { name: "Chicken Cheesesteak", category: "entree", serving_size: 312, serving_unit: "g", calories: 580, total_fat: 24, saturated_fat: 10, trans_fat: 0, cholesterol: 80, sodium: 1480, total_carbohydrates: 50, dietary_fiber: 2, total_sugars: 5, protein: 36, ingredients_text: "Hoagie roll (enriched wheat flour, water, yeast, salt), grilled chicken breast, American cheese, grilled onions, peppers" },
      { name: "Built-to-Order Breakfast Burrito", category: "entree", serving_size: 312, serving_unit: "g", calories: 620, total_fat: 30, saturated_fat: 12, trans_fat: 0.5, cholesterol: 260, sodium: 1380, total_carbohydrates: 52, dietary_fiber: 3, total_sugars: 4, protein: 32, ingredients_text: "Flour tortilla (enriched wheat flour, water, vegetable shortening), scrambled eggs, sausage (pork, salt, spices), American cheese, hash browns, salsa" },
      { name: "Sizzli Sausage", category: "entree", serving_size: 170, serving_unit: "g", calories: 480, total_fat: 30, saturated_fat: 12, trans_fat: 0, cholesterol: 180, sodium: 1040, total_carbohydrates: 28, dietary_fiber: 1, total_sugars: 3, protein: 22, ingredients_text: "Croissant (enriched wheat flour, butter, water, sugar, yeast), sausage patty (pork, water, salt, spices), egg, American cheese" },
      { name: "Mac and Cheese", category: "side", serving_size: 227, serving_unit: "g", calories: 380, total_fat: 18, saturated_fat: 10, trans_fat: 0, cholesterol: 40, sodium: 920, total_carbohydrates: 40, dietary_fiber: 1, total_sugars: 5, protein: 14, ingredients_text: "Elbow macaroni (enriched wheat flour), cheddar cheese sauce (cheddar cheese, milk, butter, wheat flour, cream), salt" },
      { name: "Soft Pretzel", category: "side", serving_size: 128, serving_unit: "g", calories: 340, total_fat: 4, saturated_fat: 1, trans_fat: 0, cholesterol: 0, sodium: 820, total_carbohydrates: 64, dietary_fiber: 2, total_sugars: 4, protein: 10, ingredients_text: "Enriched wheat flour, water, salt, sugar, yeast, sodium bicarbonate, vegetable oil" },
      { name: "Apple Fritter", category: "dessert", serving_size: 128, serving_unit: "g", calories: 420, total_fat: 20, saturated_fat: 8, trans_fat: 0, cholesterol: 25, sodium: 340, total_carbohydrates: 56, dietary_fiber: 1, total_sugars: 28, protein: 5, ingredients_text: "Enriched wheat flour, apples, sugar, vegetable oil, cinnamon, eggs, milk, leavening, glaze (powdered sugar, water)" },
      { name: "Coffee", category: "beverage", serving_size: 473, serving_unit: "ml", calories: 5, total_fat: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 5, total_carbohydrates: 0, dietary_fiber: 0, total_sugars: 0, protein: 0, ingredients_text: "Brewed coffee (water, 100% Arabica coffee)" },
      { name: "Iced Coffee", category: "beverage", serving_size: 473, serving_unit: "ml", calories: 180, total_fat: 4, saturated_fat: 2.5, trans_fat: 0, cholesterol: 15, sodium: 80, total_carbohydrates: 34, dietary_fiber: 0, total_sugars: 32, protein: 3, ingredients_text: "Brewed coffee, milk, sugar, ice, vanilla syrup (sugar, water, natural flavors)" },
      { name: "Smoothie Mango", category: "beverage", serving_size: 473, serving_unit: "ml", calories: 320, total_fat: 2, saturated_fat: 1, trans_fat: 0, cholesterol: 5, sodium: 60, total_carbohydrates: 72, dietary_fiber: 3, total_sugars: 62, protein: 5, ingredients_text: "Mango puree, yogurt (milk, live cultures), sugar, banana, orange juice, ice" },
      { name: "Turkey Gobbler", category: "entree", serving_size: 340, serving_unit: "g", calories: 560, total_fat: 20, saturated_fat: 6, trans_fat: 0, cholesterol: 65, sodium: 1580, total_carbohydrates: 60, dietary_fiber: 3, total_sugars: 10, protein: 32, ingredients_text: "Hoagie roll (enriched wheat flour, water, yeast, salt), roasted turkey, cranberry sauce (cranberries, sugar, water), stuffing (bread, celery, onion, butter, herbs), gravy" },
      { name: "Chicken Noodle Soup", category: "entree", serving_size: 340, serving_unit: "g", calories: 180, total_fat: 5, saturated_fat: 1.5, trans_fat: 0, cholesterol: 40, sodium: 1120, total_carbohydrates: 18, dietary_fiber: 1, total_sugars: 2, protein: 16, ingredients_text: "Chicken broth (water, chicken, salt), chicken breast, egg noodles (enriched wheat flour, eggs), carrots, celery, onion, parsley" },
      { name: "Cookie", category: "dessert", serving_size: 99, serving_unit: "g", calories: 420, total_fat: 20, saturated_fat: 12, trans_fat: 0, cholesterol: 45, sodium: 320, total_carbohydrates: 56, dietary_fiber: 1, total_sugars: 32, protein: 4, ingredients_text: "Enriched wheat flour, butter (cream, salt), sugar, brown sugar, chocolate chips (sugar, chocolate liquor, cocoa butter, soy lecithin), eggs, vanilla extract, baking soda, salt" },
    ],
  },
];

function main() {
  console.log("=== Regional Chain Nutrition Import (Batch 3) ===\n");

  let totalItems = 0;
  let totalChains = 0;

  const beforeCount = (
    db.prepare("SELECT COUNT(*) as c FROM foods WHERE source = 'vendor'").get() as any
  ).c;

  const importAll = db.transaction(() => {
    for (const chain of chains) {
      const chainSlug = slugify(chain.chain);
      const vendorId = `chain-${chainSlug}`;

      // Create vendor record
      upsertVendor.run({
        id: vendorId,
        name: chain.chain,
        type: "restaurant",
        api_key: generateApiKey(),
      });

      console.log(`  ${chain.chain}: ${chain.items.length} items`);

      // Import each menu item
      for (const item of chain.items) {
        const record = buildFoodRecord(item, chain.chain, vendorId);
        upsertFood.run(record);
      }

      totalItems += chain.items.length;
      totalChains++;
    }
  });

  importAll();

  // Rebuild FTS index
  console.log("\nRebuilding search index...");
  db.exec("INSERT INTO foods_fts(foods_fts) VALUES('rebuild')");

  const afterCount = (
    db.prepare("SELECT COUNT(*) as c FROM foods WHERE source = 'vendor'").get() as any
  ).c;

  console.log(`\n=== Done! ===`);
  console.log(`Chains imported: ${totalChains}`);
  console.log(`Menu items processed: ${totalItems}`);
  console.log(`Vendor foods before: ${beforeCount}`);
  console.log(`Vendor foods after: ${afterCount}`);
  console.log(`New items added: ${afterCount - beforeCount}`);
}

main();
