/**
 * Restaurant Chain Nutrition Data Import — Popular Chains
 *
 * Imports nutrition data for popular US restaurant chains:
 * McDonald's, Chick-fil-A, Taco Bell, Starbucks, Wendy's, Panda Express
 *
 * NOTE: Five Guys, Domino's, Panera Bread, and Skyline Chili are already
 * imported via batch1, batch2, and batch3 scripts respectively.
 *
 * Sources: Published nutrition info from each chain's website (FDA-mandated).
 *   - mcdonalds.com/us/en-us/about-our-food/nutrition-calculator.html
 *   - chick-fil-a.com/nutrition-allergens
 *   - tacobell.com/nutrition/info
 *   - starbucks.com/menu (nutrition facts)
 *   - wendys.com/nutrition-info
 *   - pandaexpress.com/nutrition
 *
 * Usage:
 *   npx ts-node scripts/import-restaurants.ts
 */

import db from "../src/data/database";
import { calculateNutriScore } from "../src/services/nutrition-score";
import { calculatePersonalHealthScore } from "../src/services/health-score";
import { detectAllergens, detectDietaryTags } from "../src/services/food-analysis";
import { generateApiKey } from "../src/middleware/auth";

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── SQL Statements ──────────────────────────────────────────────────────────

const upsertVendor = db.prepare(`
  INSERT INTO vendors (id, name, type, api_key)
  VALUES (@id, @name, @type, @api_key)
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    type = excluded.type
`);

const upsertFood = db.prepare(`
  INSERT INTO foods (id, name, brand, category, serving_size, serving_unit, source, vendor_id,
    calories, total_fat, saturated_fat, trans_fat, cholesterol, sodium,
    total_carbohydrates, dietary_fiber, total_sugars, protein,
    ingredients_text, allergens, dietary_tags, nutri_score, nutri_grade, culture_score,
    updated_at)
  VALUES (@id, @name, @brand, @category, @serving_size, @serving_unit, 'vendor', @vendor_id,
    @calories, @total_fat, @saturated_fat, @trans_fat, @cholesterol, @sodium,
    @total_carbohydrates, @dietary_fiber, @total_sugars, @protein,
    @ingredients_text, @allergens, @dietary_tags, @nutri_score, @nutri_grade, @culture_score,
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
    culture_score = excluded.culture_score,
    updated_at = datetime('now')
`);

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

  const cultureScore = calculatePersonalHealthScore(
    {
      calories: item.calories,
      protein: item.protein,
      dietary_fiber: item.dietary_fiber,
      saturated_fat: item.saturated_fat,
      sodium: item.sodium,
      total_sugars: item.total_sugars,
      total_fat: item.total_fat,
      total_carbohydrates: item.total_carbohydrates,
      cholesterol: item.cholesterol,
      trans_fat: item.trans_fat,
    },
    null
  ).score;

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
    culture_score: cultureScore,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Chain Menu Data — Real published nutrition facts
// ═══════════════════════════════════════════════════════════════════════════════

const mcdonalds: ChainData = {
  chain: "McDonald's",
  items: [
    // Source: mcdonalds.com/us/en-us/about-our-food/nutrition-calculator.html
    {
      name: "Big Mac",
      category: "burger",
      serving_size: 215,
      serving_unit: "g",
      calories: 590,
      total_fat: 34,
      saturated_fat: 11,
      trans_fat: 1,
      cholesterol: 85,
      sodium: 1050,
      total_carbohydrates: 46,
      dietary_fiber: 3,
      total_sugars: 9,
      protein: 25,
      ingredients_text:
        "Two beef patties, Big Mac bun (enriched flour, water, sugar, sesame seeds, soybean oil, yeast, salt), Big Mac sauce (soybean oil, pickle relish, vinegar, sugar, egg yolks, onion powder, mustard seed), lettuce, American cheese (milk, cream, water, sodium citrate, salt), pickles, onions",
    },
    {
      name: "Quarter Pounder with Cheese",
      category: "burger",
      serving_size: 202,
      serving_unit: "g",
      calories: 530,
      total_fat: 27,
      saturated_fat: 13,
      trans_fat: 1.5,
      cholesterol: 100,
      sodium: 1140,
      total_carbohydrates: 42,
      dietary_fiber: 2,
      total_sugars: 10,
      protein: 30,
      ingredients_text:
        "Beef patty (1/4 lb), sesame seed bun (enriched flour, water, sugar, soybean oil, yeast, salt), American cheese (2 slices, milk, cream, sodium citrate), ketchup, pickles, onions, mustard",
    },
    {
      name: "McDouble",
      category: "burger",
      serving_size: 155,
      serving_unit: "g",
      calories: 400,
      total_fat: 20,
      saturated_fat: 9,
      trans_fat: 1,
      cholesterol: 75,
      sodium: 920,
      total_carbohydrates: 33,
      dietary_fiber: 2,
      total_sugars: 7,
      protein: 22,
      ingredients_text:
        "Two beef patties, regular bun (enriched flour, water, sugar, soybean oil, yeast, salt), American cheese, ketchup, pickles, onions, mustard",
    },
    {
      name: "McNuggets 10 Piece",
      category: "chicken",
      serving_size: 162,
      serving_unit: "g",
      calories: 410,
      total_fat: 24,
      saturated_fat: 4,
      trans_fat: 0,
      cholesterol: 65,
      sodium: 900,
      total_carbohydrates: 25,
      dietary_fiber: 1,
      total_sugars: 0,
      protein: 23,
      ingredients_text:
        "Chicken (white meat chicken, water, vegetable starch, salt, seasoning), batter (wheat flour, water, corn flour, spices, leavening), canola blend cooking oil",
    },
    {
      name: "McNuggets 6 Piece",
      category: "chicken",
      serving_size: 96,
      serving_unit: "g",
      calories: 250,
      total_fat: 14,
      saturated_fat: 2.5,
      trans_fat: 0,
      cholesterol: 40,
      sodium: 540,
      total_carbohydrates: 15,
      dietary_fiber: 1,
      total_sugars: 0,
      protein: 14,
      ingredients_text:
        "Chicken (white meat chicken, water, vegetable starch, salt, seasoning), batter (wheat flour, water, corn flour, spices, leavening), canola blend cooking oil",
    },
    {
      name: "Medium French Fries",
      category: "side",
      serving_size: 111,
      serving_unit: "g",
      calories: 320,
      total_fat: 15,
      saturated_fat: 2,
      trans_fat: 0,
      cholesterol: 0,
      sodium: 260,
      total_carbohydrates: 43,
      dietary_fiber: 4,
      total_sugars: 0,
      protein: 5,
      ingredients_text:
        "Potatoes, canola blend oil (canola oil, corn oil, soybean oil, hydrogenated soybean oil, natural beef flavor [wheat and milk derivatives], citric acid, dimethylpolysiloxane), dextrose, sodium acid pyrophosphate, salt",
    },
    {
      name: "Large French Fries",
      category: "side",
      serving_size: 154,
      serving_unit: "g",
      calories: 480,
      total_fat: 23,
      saturated_fat: 3,
      trans_fat: 0,
      cholesterol: 0,
      sodium: 400,
      total_carbohydrates: 65,
      dietary_fiber: 6,
      total_sugars: 0,
      protein: 7,
      ingredients_text:
        "Potatoes, canola blend oil (canola oil, corn oil, soybean oil, hydrogenated soybean oil, natural beef flavor [wheat and milk derivatives], citric acid, dimethylpolysiloxane), dextrose, sodium acid pyrophosphate, salt",
    },
    {
      name: "McFlurry with Oreo Cookies (Regular)",
      category: "dessert",
      serving_size: 243,
      serving_unit: "g",
      calories: 510,
      total_fat: 17,
      saturated_fat: 9,
      trans_fat: 0,
      cholesterol: 50,
      sodium: 280,
      total_carbohydrates: 80,
      dietary_fiber: 1,
      total_sugars: 63,
      protein: 12,
      ingredients_text:
        "Vanilla reduced fat ice cream (milk, sugar, cream, corn syrup, whey, mono and diglycerides, guar gum, vanilla extract), Oreo cookie pieces (sugar, wheat flour, cocoa, palm oil, corn syrup, salt, soy lecithin, chocolate, vanilla extract)",
    },
    {
      name: "McFlurry with M&Ms (Regular)",
      category: "dessert",
      serving_size: 222,
      serving_unit: "g",
      calories: 510,
      total_fat: 19,
      saturated_fat: 12,
      trans_fat: 0.5,
      cholesterol: 50,
      sodium: 190,
      total_carbohydrates: 77,
      dietary_fiber: 1,
      total_sugars: 64,
      protein: 12,
      ingredients_text:
        "Vanilla reduced fat ice cream (milk, sugar, cream, corn syrup, whey), M&M's candies (milk chocolate, sugar, cocoa butter, skim milk, milkfat, corn syrup, peanuts, soy lecithin, artificial colors)",
    },
    {
      name: "Egg McMuffin",
      category: "breakfast",
      serving_size: 137,
      serving_unit: "g",
      calories: 300,
      total_fat: 13,
      saturated_fat: 6,
      trans_fat: 0,
      cholesterol: 260,
      sodium: 750,
      total_carbohydrates: 26,
      dietary_fiber: 1,
      total_sugars: 3,
      protein: 17,
      ingredients_text:
        "English muffin (enriched flour, water, yeast, cornmeal, sugar, soybean oil, salt), egg, Canadian bacon (pork, water, sugar, salt, sodium nitrite), American cheese (milk, cream, sodium citrate, salt)",
    },
    {
      name: "Sausage McMuffin with Egg",
      category: "breakfast",
      serving_size: 167,
      serving_unit: "g",
      calories: 480,
      total_fat: 31,
      saturated_fat: 12,
      trans_fat: 0,
      cholesterol: 285,
      sodium: 860,
      total_carbohydrates: 27,
      dietary_fiber: 2,
      total_sugars: 2,
      protein: 21,
      ingredients_text:
        "English muffin (enriched flour, water, yeast, cornmeal, sugar), pork sausage patty (pork, water, salt, spices, dextrose, sugar, rosemary extract), egg, American cheese (milk, cream, sodium citrate)",
    },
    {
      name: "Hotcakes",
      category: "breakfast",
      serving_size: 221,
      serving_unit: "g",
      calories: 580,
      total_fat: 16,
      saturated_fat: 5,
      trans_fat: 0,
      cholesterol: 30,
      sodium: 600,
      total_carbohydrates: 101,
      dietary_fiber: 2,
      total_sugars: 45,
      protein: 9,
      ingredients_text:
        "Hotcake batter (enriched bleached flour, water, eggs, sugar, soybean oil, leavening, salt), hotcake syrup (corn syrup, sugar, water, caramel color, natural and artificial flavors), salted butter (cream, salt)",
    },
    {
      name: "McChicken",
      category: "chicken",
      serving_size: 143,
      serving_unit: "g",
      calories: 400,
      total_fat: 22,
      saturated_fat: 3.5,
      trans_fat: 0,
      cholesterol: 35,
      sodium: 730,
      total_carbohydrates: 39,
      dietary_fiber: 2,
      total_sugars: 6,
      protein: 14,
      ingredients_text:
        "Breaded chicken patty (chicken, wheat flour, water, vegetable starch, salt, seasoning, spices), regular bun (enriched flour, water, sugar, soybean oil, yeast), mayonnaise (soybean oil, egg yolks, vinegar), shredded lettuce",
    },
    {
      name: "Filet-O-Fish",
      category: "seafood",
      serving_size: 142,
      serving_unit: "g",
      calories: 390,
      total_fat: 19,
      saturated_fat: 4,
      trans_fat: 0,
      cholesterol: 40,
      sodium: 580,
      total_carbohydrates: 39,
      dietary_fiber: 2,
      total_sugars: 5,
      protein: 16,
      ingredients_text:
        "Fish filet patty (Alaska pollock, wheat flour, water, vegetable starch, salt, spices), steamed bun (enriched flour, water, sugar, yeast), tartar sauce (soybean oil, pickle relish, egg yolks, vinegar, sugar, onion), half slice American cheese (milk, cream, sodium citrate)",
    },
    {
      name: "Apple Slices",
      category: "side",
      serving_size: 34,
      serving_unit: "g",
      calories: 15,
      total_fat: 0,
      saturated_fat: 0,
      trans_fat: 0,
      cholesterol: 0,
      sodium: 0,
      total_carbohydrates: 4,
      dietary_fiber: 0,
      total_sugars: 3,
      protein: 0,
      ingredients_text: "Apples, calcium ascorbate (vitamin C to maintain freshness and color)",
    },
  ],
};

const chickFilA: ChainData = {
  chain: "Chick-fil-A",
  items: [
    // Source: chick-fil-a.com/nutrition-allergens
    {
      name: "Chick-fil-A Chicken Sandwich",
      category: "chicken",
      serving_size: 170,
      serving_unit: "g",
      calories: 440,
      total_fat: 19,
      saturated_fat: 4,
      trans_fat: 0,
      cholesterol: 60,
      sodium: 1400,
      total_carbohydrates: 40,
      dietary_fiber: 1,
      total_sugars: 6,
      protein: 28,
      ingredients_text:
        "Chicken breast fillet (chicken breast, seasoning [salt, monosodium glutamate, sugar, spices, paprika], milk, egg), enriched flour bun (enriched flour, sugar, yeast, soybean oil, salt, wheat gluten), peanut oil, dill pickle chips",
    },
    {
      name: "Spicy Chicken Sandwich",
      category: "chicken",
      serving_size: 179,
      serving_unit: "g",
      calories: 450,
      total_fat: 19,
      saturated_fat: 3.5,
      trans_fat: 0,
      cholesterol: 60,
      sodium: 1620,
      total_carbohydrates: 42,
      dietary_fiber: 2,
      total_sugars: 6,
      protein: 28,
      ingredients_text:
        "Spicy chicken breast fillet (chicken breast, seasoning [salt, monosodium glutamate, sugar, spices, paprika, cayenne pepper], milk, egg), enriched flour bun (enriched flour, sugar, yeast, soybean oil, salt), peanut oil, dill pickle chips",
    },
    {
      name: "Chick-fil-A Nuggets 12 Count",
      category: "chicken",
      serving_size: 170,
      serving_unit: "g",
      calories: 380,
      total_fat: 17,
      saturated_fat: 3.5,
      trans_fat: 0,
      cholesterol: 100,
      sodium: 1280,
      total_carbohydrates: 16,
      dietary_fiber: 0,
      total_sugars: 1,
      protein: 40,
      ingredients_text:
        "Chicken breast (chicken, seasoning [salt, monosodium glutamate, sugar, spices, paprika], milk, egg), enriched flour coating (enriched bleached flour, sugar, salt, leavening, spices, paprika), peanut oil",
    },
    {
      name: "Chick-fil-A Nuggets 8 Count",
      category: "chicken",
      serving_size: 113,
      serving_unit: "g",
      calories: 250,
      total_fat: 11,
      saturated_fat: 2.5,
      trans_fat: 0,
      cholesterol: 65,
      sodium: 860,
      total_carbohydrates: 11,
      dietary_fiber: 0,
      total_sugars: 1,
      protein: 27,
      ingredients_text:
        "Chicken breast (chicken, seasoning [salt, monosodium glutamate, sugar, spices, paprika], milk, egg), enriched flour coating (enriched bleached flour, sugar, salt, leavening, spices, paprika), peanut oil",
    },
    {
      name: "Waffle Potato Fries (Medium)",
      category: "side",
      serving_size: 125,
      serving_unit: "g",
      calories: 420,
      total_fat: 24,
      saturated_fat: 4,
      trans_fat: 0,
      cholesterol: 0,
      sodium: 240,
      total_carbohydrates: 45,
      dietary_fiber: 5,
      total_sugars: 0,
      protein: 5,
      ingredients_text:
        "Potatoes (waffle cut), canola oil, sea salt",
    },
    {
      name: "Waffle Potato Fries (Large)",
      category: "side",
      serving_size: 170,
      serving_unit: "g",
      calories: 560,
      total_fat: 32,
      saturated_fat: 5,
      trans_fat: 0,
      cholesterol: 0,
      sodium: 320,
      total_carbohydrates: 60,
      dietary_fiber: 7,
      total_sugars: 1,
      protein: 7,
      ingredients_text:
        "Potatoes (waffle cut), canola oil, sea salt",
    },
    {
      name: "Cookies & Cream Milkshake (Small)",
      category: "beverage",
      serving_size: 396,
      serving_unit: "ml",
      calories: 550,
      total_fat: 22,
      saturated_fat: 14,
      trans_fat: 1,
      cholesterol: 75,
      sodium: 390,
      total_carbohydrates: 77,
      dietary_fiber: 1,
      total_sugars: 65,
      protein: 13,
      ingredients_text:
        "Icedream (milk, sugar, cream, nonfat milk, corn syrup, natural and artificial flavor), whipped cream, chocolate cookie crumbles (sugar, enriched wheat flour, cocoa, palm oil, corn syrup, salt, soy lecithin)",
    },
    {
      name: "Chick-fil-A Chicken Biscuit",
      category: "breakfast",
      serving_size: 179,
      serving_unit: "g",
      calories: 460,
      total_fat: 22,
      saturated_fat: 8,
      trans_fat: 0,
      cholesterol: 35,
      sodium: 1310,
      total_carbohydrates: 48,
      dietary_fiber: 2,
      total_sugars: 7,
      protein: 18,
      ingredients_text:
        "Buttermilk biscuit (enriched flour, buttermilk, palm oil, sugar, baking powder, salt), chicken breast fillet (chicken, seasoning, milk, egg), peanut oil",
    },
    {
      name: "Grilled Nuggets 12 Count",
      category: "chicken",
      serving_size: 142,
      serving_unit: "g",
      calories: 200,
      total_fat: 5,
      saturated_fat: 1.5,
      trans_fat: 0,
      cholesterol: 100,
      sodium: 720,
      total_carbohydrates: 2,
      dietary_fiber: 0,
      total_sugars: 1,
      protein: 38,
      ingredients_text:
        "Chicken breast (boneless, skinless), seasoning (salt, sugar, garlic, paprika, spices), soybean oil",
    },
    {
      name: "Mac and Cheese (Medium)",
      category: "side",
      serving_size: 213,
      serving_unit: "g",
      calories: 450,
      total_fat: 24,
      saturated_fat: 12,
      trans_fat: 0.5,
      cholesterol: 55,
      sodium: 1170,
      total_carbohydrates: 37,
      dietary_fiber: 1,
      total_sugars: 5,
      protein: 19,
      ingredients_text:
        "Pasta shells (enriched wheat flour, eggs), cheddar cheese sauce (cheddar cheese, milk, cream, butter, salt, sodium phosphate, enzymes)",
    },
    {
      name: "Chicken Soup (Medium)",
      category: "soup",
      serving_size: 361,
      serving_unit: "g",
      calories: 230,
      total_fat: 7,
      saturated_fat: 2,
      trans_fat: 0,
      cholesterol: 55,
      sodium: 1430,
      total_carbohydrates: 22,
      dietary_fiber: 2,
      total_sugars: 2,
      protein: 18,
      ingredients_text:
        "Chicken broth, shredded chicken breast, egg noodles (wheat flour, eggs), celery, carrots, onions, corn starch, salt, spices",
    },
    {
      name: "Chick-fil-A Sauce",
      category: "condiment",
      serving_size: 28,
      serving_unit: "g",
      calories: 140,
      total_fat: 13,
      saturated_fat: 2,
      trans_fat: 0,
      cholesterol: 10,
      sodium: 200,
      total_carbohydrates: 7,
      dietary_fiber: 0,
      total_sugars: 6,
      protein: 0,
      ingredients_text:
        "Soybean oil, sugar, BBQ sauce (tomato paste, vinegar, sugar, salt, spices), mustard (water, vinegar, mustard seed), egg yolk, vinegar, salt, lemon juice, natural flavors",
    },
  ],
};

const tacoBell: ChainData = {
  chain: "Taco Bell",
  items: [
    // Source: tacobell.com/nutrition/info
    {
      name: "Crunchy Taco",
      category: "entree",
      serving_size: 78,
      serving_unit: "g",
      calories: 170,
      total_fat: 9,
      saturated_fat: 3.5,
      trans_fat: 0,
      cholesterol: 25,
      sodium: 310,
      total_carbohydrates: 13,
      dietary_fiber: 3,
      total_sugars: 1,
      protein: 8,
      ingredients_text:
        "Crunchy corn taco shell (ground corn, vegetable oil, salt, water), seasoned beef (beef, water, seasoning [cellulose, chili pepper, onion powder, salt, oats, soy lecithin, sugar, spices, tomato powder, citric acid]), cheddar cheese (milk, cheese cultures, salt, enzymes), lettuce",
    },
    {
      name: "Crunchy Taco Supreme",
      category: "entree",
      serving_size: 113,
      serving_unit: "g",
      calories: 210,
      total_fat: 13,
      saturated_fat: 6,
      trans_fat: 0,
      cholesterol: 35,
      sodium: 350,
      total_carbohydrates: 14,
      dietary_fiber: 3,
      total_sugars: 1,
      protein: 9,
      ingredients_text:
        "Crunchy corn taco shell (ground corn, vegetable oil, salt), seasoned beef (beef, water, seasoning), cheddar cheese (milk, enzymes), reduced fat sour cream, lettuce, tomatoes",
    },
    {
      name: "Soft Taco",
      category: "entree",
      serving_size: 99,
      serving_unit: "g",
      calories: 180,
      total_fat: 9,
      saturated_fat: 4,
      trans_fat: 0,
      cholesterol: 25,
      sodium: 500,
      total_carbohydrates: 18,
      dietary_fiber: 2,
      total_sugars: 1,
      protein: 9,
      ingredients_text:
        "Flour tortilla (enriched bleached wheat flour, water, vegetable shortening, sugar, salt, leavening), seasoned beef (beef, water, seasoning), cheddar cheese (milk, enzymes), lettuce",
    },
    {
      name: "Burrito Supreme - Beef",
      category: "entree",
      serving_size: 248,
      serving_unit: "g",
      calories: 400,
      total_fat: 16,
      saturated_fat: 7,
      trans_fat: 0.5,
      cholesterol: 40,
      sodium: 1090,
      total_carbohydrates: 46,
      dietary_fiber: 6,
      total_sugars: 4,
      protein: 16,
      ingredients_text:
        "Flour tortilla (enriched flour, water, vegetable shortening, sugar, salt, leavening), seasoned beef (beef, water, seasoning), refried beans (pinto beans, soybean oil, seasoning), reduced fat sour cream, cheddar cheese (milk, enzymes), lettuce, tomatoes, onions, seasoned rice (rice, water, seasoning)",
    },
    {
      name: "Cheese Quesadilla",
      category: "entree",
      serving_size: 135,
      serving_unit: "g",
      calories: 470,
      total_fat: 26,
      saturated_fat: 12,
      trans_fat: 0.5,
      cholesterol: 55,
      sodium: 1050,
      total_carbohydrates: 39,
      dietary_fiber: 3,
      total_sugars: 3,
      protein: 19,
      ingredients_text:
        "Flour tortilla (enriched flour, water, vegetable shortening, sugar, salt, leavening), three cheese blend (cheddar cheese, pepper jack cheese, mozzarella cheese; milk, enzymes), creamy jalape\u00f1o sauce (soybean oil, water, jalape\u00f1o peppers, egg yolk, sugar, vinegar, salt)",
    },
    {
      name: "Chicken Quesadilla",
      category: "entree",
      serving_size: 184,
      serving_unit: "g",
      calories: 500,
      total_fat: 26,
      saturated_fat: 12,
      trans_fat: 0.5,
      cholesterol: 75,
      sodium: 1250,
      total_carbohydrates: 38,
      dietary_fiber: 3,
      total_sugars: 3,
      protein: 27,
      ingredients_text:
        "Flour tortilla (enriched flour, water, vegetable shortening, sugar, salt), shredded chicken (chicken, water, seasoning, soybean oil), three cheese blend (cheddar, pepper jack, mozzarella; milk, enzymes), creamy jalape\u00f1o sauce (soybean oil, water, jalape\u00f1os, egg yolk, sugar, vinegar)",
    },
    {
      name: "Nachos BellGrande",
      category: "entree",
      serving_size: 308,
      serving_unit: "g",
      calories: 740,
      total_fat: 38,
      saturated_fat: 8,
      trans_fat: 0.5,
      cholesterol: 30,
      sodium: 1050,
      total_carbohydrates: 80,
      dietary_fiber: 11,
      total_sugars: 5,
      protein: 16,
      ingredients_text:
        "Tortilla chips (ground corn, vegetable oil, salt), seasoned beef (beef, water, seasoning), nacho cheese sauce (cheddar cheese, water, jalape\u00f1o peppers, sodium phosphate), refried beans (pinto beans, soybean oil), reduced fat sour cream, tomatoes",
    },
    {
      name: "Bean Burrito",
      category: "entree",
      serving_size: 198,
      serving_unit: "g",
      calories: 380,
      total_fat: 11,
      saturated_fat: 4,
      trans_fat: 0,
      cholesterol: 10,
      sodium: 1060,
      total_carbohydrates: 55,
      dietary_fiber: 10,
      total_sugars: 3,
      protein: 14,
      ingredients_text:
        "Flour tortilla (enriched flour, water, vegetable shortening, sugar, salt, leavening), refried beans (pinto beans, soybean oil, seasoning), cheddar cheese (milk, enzymes), onions, red sauce (water, tomato paste, chili pepper, salt, spices)",
    },
    {
      name: "Chalupa Supreme - Beef",
      category: "entree",
      serving_size: 153,
      serving_unit: "g",
      calories: 350,
      total_fat: 21,
      saturated_fat: 7,
      trans_fat: 0,
      cholesterol: 35,
      sodium: 590,
      total_carbohydrates: 29,
      dietary_fiber: 3,
      total_sugars: 3,
      protein: 13,
      ingredients_text:
        "Chalupa shell (enriched wheat flour, water, vegetable shortening, sugar, salt, leavening, fried in canola oil), seasoned beef (beef, water, seasoning), reduced fat sour cream, cheddar cheese (milk, enzymes), lettuce, tomatoes",
    },
    {
      name: "Crunchwrap Supreme",
      category: "entree",
      serving_size: 254,
      serving_unit: "g",
      calories: 530,
      total_fat: 24,
      saturated_fat: 8,
      trans_fat: 0.5,
      cholesterol: 45,
      sodium: 1200,
      total_carbohydrates: 58,
      dietary_fiber: 5,
      total_sugars: 5,
      protein: 17,
      ingredients_text:
        "Flour tortilla (enriched flour, water, vegetable shortening, sugar, salt, leavening), seasoned beef (beef, water, seasoning), nacho cheese sauce (cheddar cheese, water, jalape\u00f1o peppers), tostada shell (ground corn, vegetable oil, salt), reduced fat sour cream, lettuce, tomatoes",
    },
    {
      name: "Mexican Pizza",
      category: "entree",
      serving_size: 213,
      serving_unit: "g",
      calories: 540,
      total_fat: 30,
      saturated_fat: 9,
      trans_fat: 0.5,
      cholesterol: 45,
      sodium: 1000,
      total_carbohydrates: 46,
      dietary_fiber: 6,
      total_sugars: 3,
      protein: 19,
      ingredients_text:
        "Pizza shells (enriched wheat flour, water, vegetable shortening, salt, leavening, fried in canola oil), seasoned beef (beef, water, seasoning), refried beans (pinto beans, soybean oil), pizza sauce (water, tomato paste, chili pepper, spices), three cheese blend (cheddar, pepper jack, mozzarella; milk), tomatoes",
    },
    {
      name: "Cheesy Gordita Crunch",
      category: "entree",
      serving_size: 153,
      serving_unit: "g",
      calories: 500,
      total_fat: 29,
      saturated_fat: 10,
      trans_fat: 0.5,
      cholesterol: 50,
      sodium: 810,
      total_carbohydrates: 40,
      dietary_fiber: 4,
      total_sugars: 5,
      protein: 18,
      ingredients_text:
        "Flatbread (enriched wheat flour, water, vegetable shortening, sugar, salt, leavening), crunchy taco shell (ground corn, vegetable oil, salt), seasoned beef (beef, water, seasoning), spicy ranch sauce, three cheese blend (cheddar, pepper jack, mozzarella; milk), lettuce",
    },
  ],
};

const starbucks: ChainData = {
  chain: "Starbucks",
  items: [
    // Source: starbucks.com/menu (nutrition facts)
    {
      name: "Caramel Macchiato (Grande, 2% Milk)",
      category: "beverage",
      serving_size: 473,
      serving_unit: "ml",
      calories: 250,
      total_fat: 7,
      saturated_fat: 4.5,
      trans_fat: 0,
      cholesterol: 25,
      sodium: 150,
      total_carbohydrates: 35,
      dietary_fiber: 0,
      total_sugars: 33,
      protein: 10,
      ingredients_text:
        "2% milk, espresso, vanilla syrup (sugar, water, natural flavors, potassium sorbate, citric acid), caramel sauce (sugar, butter, heavy cream, water, salt, vanilla extract)",
    },
    {
      name: "Caffe Latte (Grande, 2% Milk)",
      category: "beverage",
      serving_size: 473,
      serving_unit: "ml",
      calories: 190,
      total_fat: 7,
      saturated_fat: 4.5,
      trans_fat: 0,
      cholesterol: 25,
      sodium: 170,
      total_carbohydrates: 19,
      dietary_fiber: 0,
      total_sugars: 17,
      protein: 13,
      ingredients_text:
        "2% milk, espresso",
    },
    {
      name: "Caramel Frappuccino (Grande, Whole Milk)",
      category: "beverage",
      serving_size: 473,
      serving_unit: "ml",
      calories: 380,
      total_fat: 16,
      saturated_fat: 10,
      trans_fat: 0.5,
      cholesterol: 55,
      sodium: 250,
      total_carbohydrates: 54,
      dietary_fiber: 0,
      total_sugars: 50,
      protein: 5,
      ingredients_text:
        "Ice, whole milk, Frappuccino roast coffee, caramel syrup (sugar, water, natural flavors, potassium sorbate, citric acid), whipped cream (cream, vanilla extract), caramel drizzle (sugar, butter, heavy cream, water, salt)",
    },
    {
      name: "Mocha Frappuccino (Grande, Whole Milk)",
      category: "beverage",
      serving_size: 473,
      serving_unit: "ml",
      calories: 370,
      total_fat: 15,
      saturated_fat: 10,
      trans_fat: 0,
      cholesterol: 55,
      sodium: 230,
      total_carbohydrates: 52,
      dietary_fiber: 2,
      total_sugars: 48,
      protein: 6,
      ingredients_text:
        "Ice, whole milk, Frappuccino roast coffee, mocha sauce (water, sugar, cocoa, vanilla), whipped cream (cream, vanilla extract)",
    },
    {
      name: "Birthday Cake Pop",
      category: "dessert",
      serving_size: 32,
      serving_unit: "g",
      calories: 160,
      total_fat: 8,
      saturated_fat: 7,
      trans_fat: 0,
      cholesterol: 5,
      sodium: 100,
      total_carbohydrates: 19,
      dietary_fiber: 0,
      total_sugars: 16,
      protein: 2,
      ingredients_text:
        "Vanilla cake (sugar, enriched bleached wheat flour, eggs, soybean oil, butter, nonfat milk, baking powder, vanilla extract), white chocolaty coating (sugar, palm kernel oil, nonfat milk, soy lecithin, vanilla), sprinkles (sugar, corn starch, palm oil, artificial colors)",
    },
    {
      name: "Chocolate Cake Pop",
      category: "dessert",
      serving_size: 32,
      serving_unit: "g",
      calories: 150,
      total_fat: 7,
      saturated_fat: 6,
      trans_fat: 0,
      cholesterol: 5,
      sodium: 90,
      total_carbohydrates: 20,
      dietary_fiber: 0,
      total_sugars: 16,
      protein: 1,
      ingredients_text:
        "Chocolate cake (sugar, enriched wheat flour, cocoa, eggs, soybean oil, butter, nonfat milk, baking powder), chocolaty coating (sugar, palm kernel oil, cocoa, nonfat milk, soy lecithin, vanilla)",
    },
    {
      name: "Bacon, Gouda & Egg Sandwich",
      category: "breakfast",
      serving_size: 127,
      serving_unit: "g",
      calories: 360,
      total_fat: 19,
      saturated_fat: 7,
      trans_fat: 0,
      cholesterol: 170,
      sodium: 780,
      total_carbohydrates: 28,
      dietary_fiber: 1,
      total_sugars: 3,
      protein: 20,
      ingredients_text:
        "Artisan roll (wheat flour, water, sugar, soybean oil, yeast, salt), applewood smoked bacon (pork, water, salt, sugar, sodium phosphate, sodium nitrite), Gouda cheese (pasteurized milk, cheese cultures, salt, enzymes), egg patty (eggs, butter, water, modified food starch)",
    },
    {
      name: "Impossible Breakfast Sandwich",
      category: "breakfast",
      serving_size: 145,
      serving_unit: "g",
      calories: 420,
      total_fat: 22,
      saturated_fat: 8,
      trans_fat: 0,
      cholesterol: 195,
      sodium: 820,
      total_carbohydrates: 34,
      dietary_fiber: 3,
      total_sugars: 6,
      protein: 22,
      ingredients_text:
        "Ciabatta roll (wheat flour, water, olive oil, yeast, salt), Impossible sausage (water, soy protein concentrate, coconut oil, sunflower oil, natural flavors), cage-free egg patty (eggs, butter), aged cheddar cheese (milk, cultures, salt, enzymes)",
    },
    {
      name: "Butter Croissant",
      category: "bakery",
      serving_size: 68,
      serving_unit: "g",
      calories: 260,
      total_fat: 14,
      saturated_fat: 8,
      trans_fat: 0.5,
      cholesterol: 45,
      sodium: 300,
      total_carbohydrates: 28,
      dietary_fiber: 1,
      total_sugars: 5,
      protein: 5,
      ingredients_text:
        "Enriched wheat flour, butter (cream, salt), water, sugar, eggs, yeast, salt, wheat gluten, nonfat dry milk",
    },
    {
      name: "Blueberry Muffin",
      category: "bakery",
      serving_size: 116,
      serving_unit: "g",
      calories: 360,
      total_fat: 15,
      saturated_fat: 2.5,
      trans_fat: 0,
      cholesterol: 50,
      sodium: 310,
      total_carbohydrates: 53,
      dietary_fiber: 1,
      total_sugars: 29,
      protein: 5,
      ingredients_text:
        "Sugar, enriched wheat flour, soybean oil, eggs, blueberries, buttermilk, modified food starch, baking powder, salt, vanilla extract",
    },
    {
      name: "Pumpkin Cream Cheese Muffin",
      category: "bakery",
      serving_size: 128,
      serving_unit: "g",
      calories: 350,
      total_fat: 14,
      saturated_fat: 4,
      trans_fat: 0,
      cholesterol: 65,
      sodium: 440,
      total_carbohydrates: 52,
      dietary_fiber: 1,
      total_sugars: 34,
      protein: 5,
      ingredients_text:
        "Sugar, enriched wheat flour, pumpkin, eggs, soybean oil, cream cheese filling (cream cheese, sugar, eggs, vanilla), spices (cinnamon, ginger, nutmeg), baking powder, salt",
    },
    {
      name: "Iced Chai Tea Latte (Grande, 2% Milk)",
      category: "beverage",
      serving_size: 473,
      serving_unit: "ml",
      calories: 240,
      total_fat: 4,
      saturated_fat: 2.5,
      trans_fat: 0,
      cholesterol: 15,
      sodium: 125,
      total_carbohydrates: 45,
      dietary_fiber: 0,
      total_sugars: 42,
      protein: 6,
      ingredients_text:
        "Ice, 2% milk, chai tea concentrate (water, black tea, cinnamon, ginger, cardamom, vanilla, clove, star anise, sugar, honey)",
    },
  ],
};

const wendys: ChainData = {
  chain: "Wendy's",
  items: [
    // Source: wendys.com/nutrition-info
    {
      name: "Dave's Single",
      category: "burger",
      serving_size: 219,
      serving_unit: "g",
      calories: 590,
      total_fat: 34,
      saturated_fat: 14,
      trans_fat: 1.5,
      cholesterol: 95,
      sodium: 1070,
      total_carbohydrates: 39,
      dietary_fiber: 2,
      total_sugars: 9,
      protein: 30,
      ingredients_text:
        "Beef patty (1/4 lb), premium bun (enriched flour, water, sugar, soybean oil, yeast, salt), American cheese (milk, cream, sodium citrate, salt, enzymes), crinkle-cut pickles, ketchup, mayonnaise, onion, lettuce, tomato",
    },
    {
      name: "Dave's Double",
      category: "burger",
      serving_size: 308,
      serving_unit: "g",
      calories: 860,
      total_fat: 53,
      saturated_fat: 24,
      trans_fat: 3,
      cholesterol: 175,
      sodium: 1350,
      total_carbohydrates: 39,
      dietary_fiber: 2,
      total_sugars: 9,
      protein: 52,
      ingredients_text:
        "Two beef patties (1/4 lb each), premium bun (enriched flour, water, sugar, soybean oil, yeast), American cheese (2 slices), crinkle-cut pickles, ketchup, mayonnaise, onion, lettuce, tomato",
    },
    {
      name: "Baconator",
      category: "burger",
      serving_size: 299,
      serving_unit: "g",
      calories: 960,
      total_fat: 62,
      saturated_fat: 27,
      trans_fat: 3,
      cholesterol: 205,
      sodium: 1630,
      total_carbohydrates: 38,
      dietary_fiber: 1,
      total_sugars: 8,
      protein: 59,
      ingredients_text:
        "Two beef patties (1/4 lb each), premium bun (enriched flour, water, sugar, soybean oil, yeast, salt), American cheese (2 slices, milk, cream, sodium citrate), Applewood smoked bacon (6 strips, pork, water, salt, sugar, sodium phosphate, sodium nitrite), ketchup, mayonnaise",
    },
    {
      name: "Jr. Bacon Cheeseburger",
      category: "burger",
      serving_size: 163,
      serving_unit: "g",
      calories: 380,
      total_fat: 22,
      saturated_fat: 9,
      trans_fat: 0.5,
      cholesterol: 60,
      sodium: 700,
      total_carbohydrates: 26,
      dietary_fiber: 1,
      total_sugars: 5,
      protein: 19,
      ingredients_text:
        "Beef patty, junior bun (enriched flour, water, sugar, soybean oil, yeast, salt), American cheese (milk, cream, sodium citrate), Applewood smoked bacon, lettuce, tomato, mayonnaise",
    },
    {
      name: "Classic Chicken Sandwich",
      category: "chicken",
      serving_size: 224,
      serving_unit: "g",
      calories: 490,
      total_fat: 22,
      saturated_fat: 4,
      trans_fat: 0,
      cholesterol: 55,
      sodium: 1120,
      total_carbohydrates: 46,
      dietary_fiber: 2,
      total_sugars: 6,
      protein: 28,
      ingredients_text:
        "Breaded chicken breast fillet (chicken breast, wheat flour, water, salt, seasoning, spices, leavening), premium bun (enriched flour, water, sugar, soybean oil, yeast), mayonnaise (soybean oil, egg yolks, vinegar), lettuce, tomato",
    },
    {
      name: "Spicy Chicken Sandwich",
      category: "chicken",
      serving_size: 216,
      serving_unit: "g",
      calories: 490,
      total_fat: 21,
      saturated_fat: 3.5,
      trans_fat: 0,
      cholesterol: 55,
      sodium: 1130,
      total_carbohydrates: 48,
      dietary_fiber: 3,
      total_sugars: 6,
      protein: 28,
      ingredients_text:
        "Spicy breaded chicken breast fillet (chicken breast, wheat flour, water, salt, spices, cayenne pepper, leavening), premium bun (enriched flour, water, sugar, soybean oil, yeast), mayonnaise, lettuce, tomato",
    },
    {
      name: "Nuggets 10 Piece",
      category: "chicken",
      serving_size: 139,
      serving_unit: "g",
      calories: 430,
      total_fat: 27,
      saturated_fat: 5,
      trans_fat: 0,
      cholesterol: 65,
      sodium: 870,
      total_carbohydrates: 22,
      dietary_fiber: 0,
      total_sugars: 0,
      protein: 24,
      ingredients_text:
        "Chicken breast, wheat flour, water, salt, spices, garlic powder, onion powder, leavening, vegetable oil, dextrose",
    },
    {
      name: "Small Chocolate Frosty",
      category: "dessert",
      serving_size: 227,
      serving_unit: "g",
      calories: 350,
      total_fat: 9,
      saturated_fat: 6,
      trans_fat: 0,
      cholesterol: 40,
      sodium: 200,
      total_carbohydrates: 56,
      dietary_fiber: 0,
      total_sugars: 47,
      protein: 9,
      ingredients_text:
        "Milk, sugar, cream, cocoa (processed with alkali), corn syrup, whey, nonfat dry milk, guar gum, mono and diglycerides, cellulose gum, carrageenan, vanilla extract",
    },
    {
      name: "Small Vanilla Frosty",
      category: "dessert",
      serving_size: 227,
      serving_unit: "g",
      calories: 350,
      total_fat: 9,
      saturated_fat: 6,
      trans_fat: 0,
      cholesterol: 40,
      sodium: 180,
      total_carbohydrates: 56,
      dietary_fiber: 0,
      total_sugars: 48,
      protein: 9,
      ingredients_text:
        "Milk, sugar, cream, corn syrup, whey, nonfat dry milk, guar gum, mono and diglycerides, cellulose gum, carrageenan, vanilla extract",
    },
    {
      name: "Natural-Cut Fries (Medium)",
      category: "side",
      serving_size: 142,
      serving_unit: "g",
      calories: 350,
      total_fat: 16,
      saturated_fat: 2.5,
      trans_fat: 0,
      cholesterol: 0,
      sodium: 390,
      total_carbohydrates: 47,
      dietary_fiber: 5,
      total_sugars: 0,
      protein: 5,
      ingredients_text:
        "Potatoes, vegetable oil (soybean oil, corn oil), dextrose, sodium acid pyrophosphate, sea salt",
    },
    {
      name: "Chili (Large)",
      category: "soup",
      serving_size: 340,
      serving_unit: "g",
      calories: 310,
      total_fat: 12,
      saturated_fat: 4,
      trans_fat: 1,
      cholesterol: 60,
      sodium: 1170,
      total_carbohydrates: 26,
      dietary_fiber: 7,
      total_sugars: 8,
      protein: 23,
      ingredients_text:
        "Ground beef, water, tomatoes, kidney beans, pinto beans, onions, celery, green peppers, chili seasoning (chili pepper, cumin, garlic, onion powder, paprika, salt, sugar)",
    },
    {
      name: "Apple Pecan Salad (Full)",
      category: "salad",
      serving_size: 388,
      serving_unit: "g",
      calories: 560,
      total_fat: 27,
      saturated_fat: 8,
      trans_fat: 0,
      cholesterol: 105,
      sodium: 1210,
      total_carbohydrates: 43,
      dietary_fiber: 5,
      total_sugars: 29,
      protein: 38,
      ingredients_text:
        "Spring mix (lettuce, spinach, frisee), grilled chicken breast, dried cranberries (cranberries, sugar, sunflower oil), roasted pecans, crumbled blue cheese (milk, cultures, salt, enzymes), apple cider vinaigrette (apple cider vinegar, soybean oil, sugar, apple juice concentrate, dijon mustard, salt)",
    },
  ],
};

const pandaExpress: ChainData = {
  chain: "Panda Express",
  items: [
    // Source: pandaexpress.com/nutrition
    {
      name: "Orange Chicken",
      category: "entree",
      serving_size: 162,
      serving_unit: "g",
      calories: 490,
      total_fat: 23,
      saturated_fat: 5,
      trans_fat: 0,
      cholesterol: 80,
      sodium: 820,
      total_carbohydrates: 51,
      dietary_fiber: 0,
      total_sugars: 19,
      protein: 25,
      ingredients_text:
        "Chicken breast (chicken, water, salt, sodium phosphate), wheat flour, cornstarch, soybean oil, orange sauce (sugar, water, vinegar, soy sauce [water, soybeans, wheat, salt], orange peel, ginger, garlic, chili flakes, sesame oil)",
    },
    {
      name: "Beijing Beef",
      category: "entree",
      serving_size: 162,
      serving_unit: "g",
      calories: 470,
      total_fat: 26,
      saturated_fat: 6,
      trans_fat: 0.5,
      cholesterol: 35,
      sodium: 660,
      total_carbohydrates: 40,
      dietary_fiber: 2,
      total_sugars: 18,
      protein: 19,
      ingredients_text:
        "Beef (beef, water, soy sauce, cornstarch), wheat flour, soybean oil, bell peppers, onions, sweet and sour sauce (sugar, water, vinegar, ketchup, soy sauce [water, soybeans, wheat, salt])",
    },
    {
      name: "Kung Pao Chicken",
      category: "entree",
      serving_size: 162,
      serving_unit: "g",
      calories: 290,
      total_fat: 19,
      saturated_fat: 3.5,
      trans_fat: 0,
      cholesterol: 75,
      sodium: 950,
      total_carbohydrates: 14,
      dietary_fiber: 2,
      total_sugars: 5,
      protein: 16,
      ingredients_text:
        "Chicken breast (chicken, water, soy sauce, cornstarch), peanuts, celery, zucchini, red bell peppers, dried chili peppers, soybean oil, soy sauce (water, soybeans, wheat, salt), garlic, ginger, rice wine, sugar, cornstarch, sesame oil",
    },
    {
      name: "Broccoli Beef",
      category: "entree",
      serving_size: 162,
      serving_unit: "g",
      calories: 150,
      total_fat: 7,
      saturated_fat: 1.5,
      trans_fat: 0,
      cholesterol: 15,
      sodium: 520,
      total_carbohydrates: 13,
      dietary_fiber: 2,
      total_sugars: 7,
      protein: 9,
      ingredients_text:
        "Beef (beef, water, soy sauce, cornstarch), broccoli, soybean oil, ginger soy sauce (soy sauce [water, soybeans, wheat, salt], water, sugar, ginger, garlic, sesame oil)",
    },
    {
      name: "Grilled Teriyaki Chicken",
      category: "entree",
      serving_size: 162,
      serving_unit: "g",
      calories: 275,
      total_fat: 12.5,
      saturated_fat: 2.5,
      trans_fat: 0,
      cholesterol: 80,
      sodium: 530,
      total_carbohydrates: 14,
      dietary_fiber: 0,
      total_sugars: 8,
      protein: 25,
      ingredients_text:
        "Chicken thigh (chicken, water, soy sauce), teriyaki sauce (water, sugar, soy sauce [water, soybeans, wheat, salt], rice wine vinegar, ginger, garlic, sesame oil), soybean oil",
    },
    {
      name: "Honey Walnut Shrimp",
      category: "entree",
      serving_size: 162,
      serving_unit: "g",
      calories: 360,
      total_fat: 23,
      saturated_fat: 3.5,
      trans_fat: 0,
      cholesterol: 35,
      sodium: 440,
      total_carbohydrates: 27,
      dietary_fiber: 1,
      total_sugars: 9,
      protein: 13,
      ingredients_text:
        "Shrimp (shrimp, wheat flour, cornstarch, salt, leavening), soybean oil, glazed walnuts (walnuts, sugar, corn syrup), honey sauce (mayonnaise [soybean oil, egg yolks, vinegar], condensed milk, sugar, honey, lemon juice)",
    },
    {
      name: "SweetFire Chicken Breast",
      category: "entree",
      serving_size: 162,
      serving_unit: "g",
      calories: 380,
      total_fat: 15,
      saturated_fat: 3,
      trans_fat: 0,
      cholesterol: 50,
      sodium: 600,
      total_carbohydrates: 42,
      dietary_fiber: 1,
      total_sugars: 19,
      protein: 18,
      ingredients_text:
        "Chicken breast (chicken, water, wheat flour, cornstarch, salt), soybean oil, red bell peppers, pineapple, sweetfire sauce (sugar, water, soy sauce [water, soybeans, wheat, salt], vinegar, chili garlic sauce)",
    },
    {
      name: "Fried Rice",
      category: "side",
      serving_size: 227,
      serving_unit: "g",
      calories: 520,
      total_fat: 16,
      saturated_fat: 3,
      trans_fat: 0,
      cholesterol: 150,
      sodium: 850,
      total_carbohydrates: 85,
      dietary_fiber: 1,
      total_sugars: 3,
      protein: 11,
      ingredients_text:
        "Rice, soybean oil, eggs, peas, carrots, green onions, soy sauce (water, soybeans, wheat, salt), salt, sesame oil",
    },
    {
      name: "Chow Mein",
      category: "side",
      serving_size: 227,
      serving_unit: "g",
      calories: 510,
      total_fat: 22,
      saturated_fat: 4,
      trans_fat: 0,
      cholesterol: 0,
      sodium: 860,
      total_carbohydrates: 65,
      dietary_fiber: 4,
      total_sugars: 5,
      protein: 13,
      ingredients_text:
        "Stir-fried noodles (wheat flour, water, salt), cabbage, celery, onions, soybean oil, soy sauce (water, soybeans, wheat, salt), sesame oil",
    },
    {
      name: "White Steamed Rice",
      category: "side",
      serving_size: 227,
      serving_unit: "g",
      calories: 380,
      total_fat: 0,
      saturated_fat: 0,
      trans_fat: 0,
      cholesterol: 0,
      sodium: 0,
      total_carbohydrates: 87,
      dietary_fiber: 0,
      total_sugars: 0,
      protein: 7,
      ingredients_text: "Long grain rice, water",
    },
    {
      name: "Super Greens",
      category: "side",
      serving_size: 198,
      serving_unit: "g",
      calories: 90,
      total_fat: 3,
      saturated_fat: 0.5,
      trans_fat: 0,
      cholesterol: 0,
      sodium: 320,
      total_carbohydrates: 10,
      dietary_fiber: 5,
      total_sugars: 2,
      protein: 6,
      ingredients_text:
        "Broccoli, kale, cabbage, soybean oil, garlic, salt",
    },
    {
      name: "Cream Cheese Rangoon (3 Piece)",
      category: "appetizer",
      serving_size: 64,
      serving_unit: "g",
      calories: 190,
      total_fat: 8,
      saturated_fat: 5,
      trans_fat: 0,
      cholesterol: 15,
      sodium: 180,
      total_carbohydrates: 24,
      dietary_fiber: 2,
      total_sugars: 1,
      protein: 5,
      ingredients_text:
        "Wonton wrapper (enriched wheat flour, water, salt), cream cheese (pasteurized milk, cream, salt), green onions, garlic, soybean oil",
    },
    {
      name: "Chicken Egg Roll (1)",
      category: "appetizer",
      serving_size: 79,
      serving_unit: "g",
      calories: 200,
      total_fat: 10,
      saturated_fat: 2,
      trans_fat: 0,
      cholesterol: 20,
      sodium: 390,
      total_carbohydrates: 20,
      dietary_fiber: 2,
      total_sugars: 2,
      protein: 8,
      ingredients_text:
        "Wheat flour wrapper (enriched wheat flour, water, salt), chicken, cabbage, celery, carrots, onions, soybean oil, soy sauce, garlic, ginger, sesame oil",
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// All Chains
// ═══════════════════════════════════════════════════════════════════════════════

const allChains: ChainData[] = [
  mcdonalds,
  chickFilA,
  tacoBell,
  starbucks,
  wendys,
  pandaExpress,
];

// ═══════════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════════

function main() {
  console.log("=== Restaurant Chain Nutrition Import — Popular Chains ===\n");
  console.log("Chains: McDonald's, Chick-fil-A, Taco Bell, Starbucks, Wendy's, Panda Express\n");
  console.log("NOTE: Five Guys, Domino's, Panera Bread, and Skyline Chili already exist");
  console.log("      in batch1, batch2, and batch3 respectively.\n");

  let totalItems = 0;
  let totalChains = 0;

  const beforeCount = (
    db.prepare("SELECT COUNT(*) as c FROM foods WHERE source = 'vendor'").get() as any
  ).c;

  const importAll = db.transaction(() => {
    for (const chain of allChains) {
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
