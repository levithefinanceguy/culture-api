/**
 * Restaurant Chain Nutrition Data Import — Batch 2
 *
 * Casual Dining & Pizza chains with manually curated nutrition data.
 * Sources: Published nutrition PDFs from each chain (FDA-mandated for 20+ locations).
 *
 * Usage:
 *   npx ts-node scripts/import-chains-batch2.ts
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

// ─── CASUAL DINING CHAINS ────────────────────────────────────────────────────

const oliveGarden: ChainData = {
  chain: "Olive Garden",
  items: [
    { name: "Chicken Alfredo", category: "entree", serving_size: 439, serving_unit: "g", calories: 1010, total_fat: 47, saturated_fat: 25, trans_fat: 1, cholesterol: 140, sodium: 1480, total_carbohydrates: 90, dietary_fiber: 4, total_sugars: 6, protein: 55, ingredients_text: "fettuccine pasta (wheat flour, eggs), heavy cream, butter, parmesan cheese (milk), garlic, grilled chicken breast, salt, pepper" },
    { name: "Chicken Parmigiana", category: "entree", serving_size: 450, serving_unit: "g", calories: 1060, total_fat: 49, saturated_fat: 18, trans_fat: 0.5, cholesterol: 165, sodium: 2140, total_carbohydrates: 89, dietary_fiber: 7, total_sugars: 12, protein: 64, ingredients_text: "breaded chicken breast (wheat flour, eggs, breadcrumbs), marinara sauce (tomatoes, garlic, olive oil), mozzarella cheese (milk), spaghetti (wheat flour)" },
    { name: "Tour of Italy", category: "entree", serving_size: 510, serving_unit: "g", calories: 1500, total_fat: 74, saturated_fat: 33, trans_fat: 1.5, cholesterol: 235, sodium: 3250, total_carbohydrates: 114, dietary_fiber: 7, total_sugars: 14, protein: 82, ingredients_text: "chicken parmigiana (chicken, wheat flour, eggs, breadcrumbs, marinara, mozzarella), lasagna classico (beef, ricotta, mozzarella, pasta), fettuccine alfredo (pasta, cream, parmesan)" },
    { name: "Eggplant Parmigiana", category: "entree", serving_size: 430, serving_unit: "g", calories: 850, total_fat: 38, saturated_fat: 15, trans_fat: 0, cholesterol: 55, sodium: 1900, total_carbohydrates: 95, dietary_fiber: 9, total_sugars: 15, protein: 30, ingredients_text: "breaded eggplant (eggplant, wheat flour, eggs, breadcrumbs), marinara sauce (tomatoes, garlic, olive oil), mozzarella cheese (milk), spaghetti (wheat flour)" },
    { name: "Lasagna Classico", category: "entree", serving_size: 397, serving_unit: "g", calories: 650, total_fat: 30, saturated_fat: 15, trans_fat: 0.5, cholesterol: 105, sodium: 1830, total_carbohydrates: 53, dietary_fiber: 4, total_sugars: 11, protein: 38, ingredients_text: "lasagna noodles (wheat flour, eggs), ground beef, ricotta cheese (milk), mozzarella cheese (milk), marinara sauce (tomatoes, garlic), parmesan cheese" },
    { name: "Shrimp Scampi", category: "entree", serving_size: 370, serving_unit: "g", calories: 720, total_fat: 29, saturated_fat: 14, trans_fat: 0.5, cholesterol: 280, sodium: 1640, total_carbohydrates: 76, dietary_fiber: 4, total_sugars: 4, protein: 36, ingredients_text: "shrimp, angel hair pasta (wheat flour), butter, garlic, white wine, lemon juice, olive oil, parsley, red pepper flakes" },
    { name: "Zuppa Toscana", category: "soup", serving_size: 340, serving_unit: "g", calories: 220, total_fat: 14, saturated_fat: 6, trans_fat: 0, cholesterol: 30, sodium: 910, total_carbohydrates: 15, dietary_fiber: 1, total_sugars: 2, protein: 9, ingredients_text: "Italian sausage (pork), potatoes, kale, heavy cream (milk), chicken broth, onion, garlic, red pepper flakes" },
    { name: "Minestrone", category: "soup", serving_size: 340, serving_unit: "g", calories: 120, total_fat: 1.5, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 790, total_carbohydrates: 22, dietary_fiber: 4, total_sugars: 5, protein: 5, ingredients_text: "vegetables (tomatoes, zucchini, carrots, celery, onion, spinach), shell pasta (wheat flour), kidney beans, vegetable broth, garlic, olive oil" },
    { name: "Breadstick", category: "side", serving_size: 43, serving_unit: "g", calories: 140, total_fat: 2.5, saturated_fat: 0.5, trans_fat: 0, cholesterol: 0, sodium: 460, total_carbohydrates: 25, dietary_fiber: 1, total_sugars: 2, protein: 5, ingredients_text: "wheat flour, water, yeast, salt, garlic butter (butter, garlic, soybean oil)" },
    { name: "Salad with Dressing", category: "salad", serving_size: 310, serving_unit: "g", calories: 350, total_fat: 26, saturated_fat: 5, trans_fat: 0, cholesterol: 15, sodium: 1530, total_carbohydrates: 22, dietary_fiber: 3, total_sugars: 6, protein: 5, ingredients_text: "lettuce, tomatoes, red onion, black olives, pepperoncini, croutons (wheat flour, oil), Italian dressing (soybean oil, vinegar, sugar, garlic)" },
    { name: "Five Cheese Ziti al Forno", category: "entree", serving_size: 425, serving_unit: "g", calories: 990, total_fat: 45, saturated_fat: 24, trans_fat: 0.5, cholesterol: 100, sodium: 1790, total_carbohydrates: 96, dietary_fiber: 5, total_sugars: 10, protein: 43, ingredients_text: "ziti pasta (wheat flour), ricotta (milk), mozzarella (milk), fontina (milk), parmesan (milk), romano (milk), marinara sauce (tomatoes, garlic), alfredo sauce (cream, butter, parmesan)" },
    { name: "Stuffed Mushrooms", category: "appetizer", serving_size: 227, serving_unit: "g", calories: 370, total_fat: 24, saturated_fat: 10, trans_fat: 0, cholesterol: 65, sodium: 920, total_carbohydrates: 20, dietary_fiber: 2, total_sugars: 3, protein: 18, ingredients_text: "mushrooms, Italian sausage (pork), breadcrumbs (wheat flour), parmesan cheese (milk), garlic, clam juice, cream cheese (milk), romano cheese" },
    { name: "Tiramisu", category: "dessert", serving_size: 200, serving_unit: "g", calories: 470, total_fat: 26, saturated_fat: 14, trans_fat: 0, cholesterol: 170, sodium: 230, total_carbohydrates: 47, dietary_fiber: 0, total_sugars: 33, protein: 9, ingredients_text: "mascarpone cheese (milk), ladyfingers (wheat flour, eggs, sugar), espresso, cocoa powder, sugar, eggs, heavy cream (milk), vanilla extract" },
    { name: "Black Tie Mousse Cake", category: "dessert", serving_size: 180, serving_unit: "g", calories: 560, total_fat: 34, saturated_fat: 20, trans_fat: 0, cholesterol: 95, sodium: 290, total_carbohydrates: 58, dietary_fiber: 2, total_sugars: 44, protein: 7, ingredients_text: "chocolate mousse (cream, sugar, cocoa, eggs), chocolate cake (wheat flour, cocoa, sugar, eggs, butter), white chocolate, chocolate ganache (cream, chocolate)" },
    { name: "Iced Tea", category: "beverage", serving_size: 480, serving_unit: "ml", calories: 0, total_fat: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 10, total_carbohydrates: 0, dietary_fiber: 0, total_sugars: 0, protein: 0, ingredients_text: "brewed tea, water" },
  ],
};

const applebees: ChainData = {
  chain: "Applebee's",
  items: [
    { name: "Classic Burger", category: "entree", serving_size: 312, serving_unit: "g", calories: 770, total_fat: 46, saturated_fat: 17, trans_fat: 1.5, cholesterol: 115, sodium: 1290, total_carbohydrates: 50, dietary_fiber: 2, total_sugars: 10, protein: 40, ingredients_text: "beef patty, brioche bun (wheat flour, eggs, butter), lettuce, tomato, onion, pickles, American cheese (milk), ketchup, mustard" },
    { name: "Bourbon Street Chicken & Shrimp", category: "entree", serving_size: 370, serving_unit: "g", calories: 560, total_fat: 17, saturated_fat: 6, trans_fat: 0, cholesterol: 225, sodium: 2770, total_carbohydrates: 42, dietary_fiber: 3, total_sugars: 8, protein: 52, ingredients_text: "grilled chicken breast, shrimp, Cajun spices, sauteed mushrooms, onions, garlic butter, mashed potatoes (potatoes, milk, butter)" },
    { name: "Oriental Chicken Salad", category: "salad", serving_size: 420, serving_unit: "g", calories: 1310, total_fat: 76, saturated_fat: 12, trans_fat: 0, cholesterol: 100, sodium: 1810, total_carbohydrates: 107, dietary_fiber: 8, total_sugars: 42, protein: 50, ingredients_text: "fried chicken strips (chicken, wheat flour), mixed greens, almonds, crispy noodles (wheat flour), mandarin oranges, rice, Oriental vinaigrette (soybean oil, sugar, soy, sesame oil)" },
    { name: "Boneless Wings", category: "appetizer", serving_size: 280, serving_unit: "g", calories: 740, total_fat: 40, saturated_fat: 8, trans_fat: 0, cholesterol: 75, sodium: 2210, total_carbohydrates: 60, dietary_fiber: 3, total_sugars: 16, protein: 35, ingredients_text: "chicken breast, wheat flour, cornstarch, eggs, buffalo sauce (cayenne pepper, vinegar, butter, garlic), celery, ranch dressing (soybean oil, buttermilk, eggs)" },
    { name: "Riblets Platter", category: "entree", serving_size: 400, serving_unit: "g", calories: 870, total_fat: 42, saturated_fat: 15, trans_fat: 0.5, cholesterol: 155, sodium: 2100, total_carbohydrates: 76, dietary_fiber: 3, total_sugars: 35, protein: 48, ingredients_text: "pork riblets, BBQ sauce (high fructose corn syrup, tomato paste, vinegar, molasses), coleslaw (cabbage, carrots, mayonnaise), fries (potatoes, soybean oil, salt)" },
    { name: "Fiesta Lime Chicken", category: "entree", serving_size: 390, serving_unit: "g", calories: 730, total_fat: 29, saturated_fat: 10, trans_fat: 0, cholesterol: 130, sodium: 2340, total_carbohydrates: 66, dietary_fiber: 6, total_sugars: 10, protein: 48, ingredients_text: "grilled chicken breast, mexi-ranch sauce (soybean oil, buttermilk, lime), cheddar cheese (milk), pico de gallo (tomatoes, onion, cilantro, jalapeno), tortilla strips (corn, oil), rice, black beans" },
    { name: "Quesadilla Burger", category: "entree", serving_size: 390, serving_unit: "g", calories: 1000, total_fat: 61, saturated_fat: 26, trans_fat: 2, cholesterol: 165, sodium: 2090, total_carbohydrates: 56, dietary_fiber: 3, total_sugars: 6, protein: 56, ingredients_text: "beef patty, flour tortilla (wheat flour), pepper jack cheese (milk), cheddar cheese (milk), bacon, Mexi-ranch sauce (soybean oil, buttermilk), lettuce, tomato, pickles" },
    { name: "Mozzarella Sticks", category: "appetizer", serving_size: 200, serving_unit: "g", calories: 570, total_fat: 29, saturated_fat: 13, trans_fat: 0, cholesterol: 55, sodium: 1430, total_carbohydrates: 51, dietary_fiber: 3, total_sugars: 6, protein: 24, ingredients_text: "mozzarella cheese (milk), wheat flour, breadcrumbs (wheat), eggs, marinara sauce (tomatoes, garlic, olive oil, basil), soybean oil" },
    { name: "Chicken Tenders", category: "entree", serving_size: 270, serving_unit: "g", calories: 680, total_fat: 33, saturated_fat: 6, trans_fat: 0, cholesterol: 85, sodium: 1810, total_carbohydrates: 54, dietary_fiber: 3, total_sugars: 4, protein: 40, ingredients_text: "chicken breast tenders, wheat flour, cornstarch, eggs, salt, pepper, soybean oil, honey mustard sauce (mustard, honey, soybean oil)" },
    { name: "Onion Rings", category: "appetizer", serving_size: 200, serving_unit: "g", calories: 480, total_fat: 24, saturated_fat: 4, trans_fat: 0, cholesterol: 0, sodium: 820, total_carbohydrates: 58, dietary_fiber: 3, total_sugars: 8, protein: 6, ingredients_text: "onion rings, wheat flour, cornstarch, breadcrumbs (wheat), salt, soybean oil" },
    { name: "Caesar Salad", category: "salad", serving_size: 260, serving_unit: "g", calories: 370, total_fat: 26, saturated_fat: 6, trans_fat: 0, cholesterol: 30, sodium: 870, total_carbohydrates: 22, dietary_fiber: 3, total_sugars: 3, protein: 12, ingredients_text: "romaine lettuce, parmesan cheese (milk), croutons (wheat flour, butter, garlic), Caesar dressing (soybean oil, parmesan, anchovy, eggs, lemon, garlic)" },
    { name: "Loaded Fajitas", category: "entree", serving_size: 450, serving_unit: "g", calories: 840, total_fat: 38, saturated_fat: 14, trans_fat: 0.5, cholesterol: 150, sodium: 2540, total_carbohydrates: 68, dietary_fiber: 7, total_sugars: 8, protein: 52, ingredients_text: "grilled chicken, peppers, onions, flour tortillas (wheat flour), cheddar cheese (milk), sour cream (milk), pico de gallo (tomatoes, onion, cilantro), guacamole (avocado)" },
    { name: "Triple Chocolate Meltdown", category: "dessert", serving_size: 190, serving_unit: "g", calories: 810, total_fat: 37, saturated_fat: 17, trans_fat: 0, cholesterol: 100, sodium: 370, total_carbohydrates: 109, dietary_fiber: 4, total_sugars: 77, protein: 10, ingredients_text: "chocolate cake (wheat flour, cocoa, sugar, eggs, butter, milk), chocolate fudge, chocolate ice cream (milk, cream, cocoa, sugar), whipped cream (cream)" },
    { name: "Oreo Cookie Shake", category: "beverage", serving_size: 450, serving_unit: "ml", calories: 880, total_fat: 38, saturated_fat: 24, trans_fat: 1, cholesterol: 130, sodium: 440, total_carbohydrates: 121, dietary_fiber: 1, total_sugars: 98, protein: 16, ingredients_text: "vanilla ice cream (milk, cream, sugar), milk, Oreo cookies (wheat flour, sugar, cocoa, soybean oil), whipped cream (cream, sugar)" },
    { name: "Brownie Bite", category: "dessert", serving_size: 100, serving_unit: "g", calories: 370, total_fat: 17, saturated_fat: 6, trans_fat: 0, cholesterol: 45, sodium: 180, total_carbohydrates: 51, dietary_fiber: 2, total_sugars: 34, protein: 4, ingredients_text: "chocolate brownie (wheat flour, cocoa, sugar, eggs, butter, milk), chocolate chips, powdered sugar" },
  ],
};

const chilis: ChainData = {
  chain: "Chili's",
  items: [
    { name: "Oldtimer Burger", category: "entree", serving_size: 303, serving_unit: "g", calories: 810, total_fat: 48, saturated_fat: 18, trans_fat: 2, cholesterol: 130, sodium: 1540, total_carbohydrates: 51, dietary_fiber: 2, total_sugars: 10, protein: 42, ingredients_text: "beef patty, sesame bun (wheat flour, sesame seeds), lettuce, tomato, onion, pickles, American cheese (milk), mustard, ketchup" },
    { name: "Baby Back Ribs Full Rack", category: "entree", serving_size: 510, serving_unit: "g", calories: 1370, total_fat: 85, saturated_fat: 30, trans_fat: 0, cholesterol: 310, sodium: 2850, total_carbohydrates: 64, dietary_fiber: 1, total_sugars: 48, protein: 86, ingredients_text: "pork baby back ribs, BBQ sauce (sugar, tomato paste, vinegar, molasses, spices), coleslaw (cabbage, mayonnaise), cinnamon apples" },
    { name: "Chicken Crispers", category: "entree", serving_size: 340, serving_unit: "g", calories: 1070, total_fat: 55, saturated_fat: 10, trans_fat: 0, cholesterol: 110, sodium: 2740, total_carbohydrates: 90, dietary_fiber: 4, total_sugars: 8, protein: 47, ingredients_text: "chicken breast, wheat flour, cornstarch, eggs, salt, pepper, soybean oil, corn on the cob (corn, butter), fries (potatoes, soybean oil)" },
    { name: "Cajun Chicken Pasta", category: "entree", serving_size: 460, serving_unit: "g", calories: 1230, total_fat: 60, saturated_fat: 26, trans_fat: 1, cholesterol: 180, sodium: 2880, total_carbohydrates: 106, dietary_fiber: 6, total_sugars: 10, protein: 62, ingredients_text: "penne pasta (wheat flour), grilled chicken breast, alfredo sauce (cream, butter, parmesan cheese, milk), bell peppers, onion, tomatoes, Cajun spices" },
    { name: "Chicken Fajitas", category: "entree", serving_size: 430, serving_unit: "g", calories: 690, total_fat: 25, saturated_fat: 8, trans_fat: 0, cholesterol: 135, sodium: 2480, total_carbohydrates: 62, dietary_fiber: 6, total_sugars: 7, protein: 50, ingredients_text: "grilled chicken breast, bell peppers, onions, flour tortillas (wheat flour), pico de gallo (tomatoes, onion, cilantro), sour cream (milk), cheddar cheese (milk)" },
    { name: "Big Mouth Bites", category: "appetizer", serving_size: 340, serving_unit: "g", calories: 960, total_fat: 56, saturated_fat: 22, trans_fat: 1.5, cholesterol: 145, sodium: 1880, total_carbohydrates: 64, dietary_fiber: 3, total_sugars: 12, protein: 48, ingredients_text: "mini beef patties, slider buns (wheat flour), American cheese (milk), bacon, sauteed onions, ketchup, mustard, pickles" },
    { name: "Southwestern Eggrolls", category: "appetizer", serving_size: 240, serving_unit: "g", calories: 720, total_fat: 38, saturated_fat: 10, trans_fat: 0, cholesterol: 60, sodium: 1560, total_carbohydrates: 64, dietary_fiber: 5, total_sugars: 5, protein: 28, ingredients_text: "flour tortilla wrapper (wheat flour), chicken, corn, black beans, spinach, jalapeno, red pepper, smoked chicken, avocado-ranch dipping sauce (soybean oil, avocado, buttermilk)" },
    { name: "Chips and Salsa", category: "appetizer", serving_size: 210, serving_unit: "g", calories: 430, total_fat: 21, saturated_fat: 2.5, trans_fat: 0, cholesterol: 0, sodium: 860, total_carbohydrates: 56, dietary_fiber: 5, total_sugars: 5, protein: 6, ingredients_text: "corn tortilla chips (corn, soybean oil, salt), salsa (tomatoes, onion, jalapeno, cilantro, lime juice, salt)" },
    { name: "Classic Nachos", category: "appetizer", serving_size: 380, serving_unit: "g", calories: 1140, total_fat: 66, saturated_fat: 24, trans_fat: 1, cholesterol: 110, sodium: 2370, total_carbohydrates: 86, dietary_fiber: 8, total_sugars: 6, protein: 44, ingredients_text: "corn tortilla chips, seasoned beef, queso (cheese, milk), cheddar cheese (milk), pico de gallo (tomatoes, onion, cilantro), jalapenos, sour cream (milk), guacamole (avocado)" },
    { name: "Loaded Baked Potato Soup", category: "soup", serving_size: 340, serving_unit: "g", calories: 350, total_fat: 22, saturated_fat: 12, trans_fat: 0.5, cholesterol: 55, sodium: 1180, total_carbohydrates: 27, dietary_fiber: 2, total_sugars: 3, protein: 12, ingredients_text: "potatoes, cheddar cheese (milk), bacon, sour cream (milk), butter, chicken broth, onion, garlic, heavy cream (milk)" },
    { name: "Margarita Grilled Chicken", category: "entree", serving_size: 350, serving_unit: "g", calories: 550, total_fat: 14, saturated_fat: 4, trans_fat: 0, cholesterol: 130, sodium: 1780, total_carbohydrates: 52, dietary_fiber: 5, total_sugars: 9, protein: 48, ingredients_text: "grilled chicken breast marinated in citrus juices, rice, black beans, fresh pico de gallo (tomatoes, onion, cilantro, lime)" },
    { name: "Molten Chocolate Cake", category: "dessert", serving_size: 210, serving_unit: "g", calories: 1030, total_fat: 50, saturated_fat: 28, trans_fat: 0.5, cholesterol: 175, sodium: 540, total_carbohydrates: 131, dietary_fiber: 4, total_sugars: 95, protein: 13, ingredients_text: "chocolate cake (wheat flour, cocoa, sugar, eggs, butter, milk), chocolate fudge, vanilla ice cream (milk, cream, sugar), chocolate shell, whipped cream (cream)" },
    { name: "Skillet Cookie", category: "dessert", serving_size: 230, serving_unit: "g", calories: 890, total_fat: 44, saturated_fat: 22, trans_fat: 0.5, cholesterol: 100, sodium: 490, total_carbohydrates: 117, dietary_fiber: 3, total_sugars: 72, protein: 10, ingredients_text: "chocolate chip cookie (wheat flour, butter, sugar, brown sugar, eggs, chocolate chips, vanilla), vanilla ice cream (milk, cream, sugar), whipped cream" },
    { name: "Chicken Bacon Ranch Quesadilla", category: "entree", serving_size: 380, serving_unit: "g", calories: 1140, total_fat: 67, saturated_fat: 26, trans_fat: 1, cholesterol: 180, sodium: 2650, total_carbohydrates: 66, dietary_fiber: 3, total_sugars: 5, protein: 65, ingredients_text: "flour tortilla (wheat flour), grilled chicken, bacon, ranch dressing (soybean oil, buttermilk, eggs), cheddar cheese (milk), pepper jack cheese (milk)" },
    { name: "Caesar Salad", category: "salad", serving_size: 250, serving_unit: "g", calories: 360, total_fat: 25, saturated_fat: 5, trans_fat: 0, cholesterol: 25, sodium: 840, total_carbohydrates: 20, dietary_fiber: 3, total_sugars: 3, protein: 12, ingredients_text: "romaine lettuce, parmesan cheese (milk), croutons (wheat flour, butter), Caesar dressing (soybean oil, parmesan, anchovy, eggs, lemon juice)" },
  ],
};

const ihop: ChainData = {
  chain: "IHOP",
  items: [
    { name: "Original Buttermilk Pancakes Stack of 3", category: "entree", serving_size: 300, serving_unit: "g", calories: 450, total_fat: 16, saturated_fat: 7, trans_fat: 0, cholesterol: 65, sodium: 1140, total_carbohydrates: 63, dietary_fiber: 2, total_sugars: 14, protein: 12, ingredients_text: "buttermilk pancake batter (wheat flour, buttermilk, eggs, sugar, baking powder), butter, maple syrup" },
    { name: "Belgian Waffle", category: "entree", serving_size: 210, serving_unit: "g", calories: 590, total_fat: 29, saturated_fat: 14, trans_fat: 1, cholesterol: 80, sodium: 990, total_carbohydrates: 71, dietary_fiber: 1, total_sugars: 18, protein: 11, ingredients_text: "waffle batter (wheat flour, eggs, butter, sugar, milk, baking powder), whipped cream (cream), butter, maple syrup" },
    { name: "French Toast", category: "entree", serving_size: 280, serving_unit: "g", calories: 580, total_fat: 22, saturated_fat: 8, trans_fat: 0.5, cholesterol: 120, sodium: 760, total_carbohydrates: 78, dietary_fiber: 2, total_sugars: 30, protein: 16, ingredients_text: "brioche bread (wheat flour, eggs, butter, sugar), egg batter (eggs, milk, vanilla, cinnamon), butter, powdered sugar, maple syrup" },
    { name: "Country Fried Steak", category: "entree", serving_size: 390, serving_unit: "g", calories: 860, total_fat: 52, saturated_fat: 17, trans_fat: 1, cholesterol: 125, sodium: 2300, total_carbohydrates: 56, dietary_fiber: 2, total_sugars: 4, protein: 38, ingredients_text: "beef steak, wheat flour, eggs, breadcrumbs, country gravy (milk, wheat flour, butter, sausage drippings), hash browns (potatoes, soybean oil)" },
    { name: "T-Bone Steak", category: "entree", serving_size: 340, serving_unit: "g", calories: 690, total_fat: 38, saturated_fat: 15, trans_fat: 1.5, cholesterol: 175, sodium: 950, total_carbohydrates: 28, dietary_fiber: 2, total_sugars: 2, protein: 58, ingredients_text: "T-bone steak, seasoning (salt, pepper, garlic), butter, hash browns (potatoes, soybean oil), eggs" },
    { name: "Omelette", category: "entree", serving_size: 320, serving_unit: "g", calories: 620, total_fat: 42, saturated_fat: 16, trans_fat: 0.5, cholesterol: 520, sodium: 1440, total_carbohydrates: 14, dietary_fiber: 1, total_sugars: 4, protein: 44, ingredients_text: "eggs, ham, cheddar cheese (milk), American cheese (milk), mushrooms, peppers, onions, butter, milk" },
    { name: "Eggs Benedict", category: "entree", serving_size: 350, serving_unit: "g", calories: 730, total_fat: 46, saturated_fat: 18, trans_fat: 0.5, cholesterol: 445, sodium: 1680, total_carbohydrates: 38, dietary_fiber: 1, total_sugars: 3, protein: 35, ingredients_text: "poached eggs, Canadian bacon (pork), English muffin (wheat flour), hollandaise sauce (egg yolks, butter, lemon juice), hash browns (potatoes)" },
    { name: "Breakfast Sampler", category: "entree", serving_size: 410, serving_unit: "g", calories: 1020, total_fat: 59, saturated_fat: 20, trans_fat: 1, cholesterol: 380, sodium: 2340, total_carbohydrates: 68, dietary_fiber: 3, total_sugars: 18, protein: 50, ingredients_text: "eggs, buttermilk pancakes (wheat flour, buttermilk, eggs), bacon, sausage links (pork), hash browns (potatoes, soybean oil), butter, maple syrup" },
    { name: "Chicken and Waffles", category: "entree", serving_size: 380, serving_unit: "g", calories: 940, total_fat: 43, saturated_fat: 14, trans_fat: 0.5, cholesterol: 140, sodium: 2110, total_carbohydrates: 92, dietary_fiber: 2, total_sugars: 22, protein: 42, ingredients_text: "fried chicken breast (chicken, wheat flour, eggs, spices, soybean oil), Belgian waffle (wheat flour, eggs, butter, milk), maple syrup, butter" },
    { name: "Burger", category: "entree", serving_size: 310, serving_unit: "g", calories: 750, total_fat: 44, saturated_fat: 17, trans_fat: 1.5, cholesterol: 120, sodium: 1320, total_carbohydrates: 48, dietary_fiber: 2, total_sugars: 9, protein: 40, ingredients_text: "beef patty, brioche bun (wheat flour, eggs, butter), lettuce, tomato, onion, pickles, American cheese (milk), ketchup" },
    { name: "Mozzarella Sticks", category: "appetizer", serving_size: 180, serving_unit: "g", calories: 520, total_fat: 27, saturated_fat: 12, trans_fat: 0, cholesterol: 50, sodium: 1300, total_carbohydrates: 46, dietary_fiber: 2, total_sugars: 5, protein: 22, ingredients_text: "mozzarella cheese (milk), wheat flour, breadcrumbs (wheat), eggs, marinara sauce (tomatoes, garlic, olive oil), soybean oil" },
    { name: "Onion Rings", category: "appetizer", serving_size: 190, serving_unit: "g", calories: 470, total_fat: 23, saturated_fat: 4, trans_fat: 0, cholesterol: 0, sodium: 800, total_carbohydrates: 56, dietary_fiber: 3, total_sugars: 7, protein: 6, ingredients_text: "onion rings, wheat flour, cornstarch, breadcrumbs (wheat), salt, soybean oil" },
    { name: "New York Cheesecake", category: "dessert", serving_size: 170, serving_unit: "g", calories: 550, total_fat: 35, saturated_fat: 20, trans_fat: 0.5, cholesterol: 160, sodium: 390, total_carbohydrates: 46, dietary_fiber: 0, total_sugars: 34, protein: 10, ingredients_text: "cream cheese (milk), sugar, sour cream (milk), eggs, graham cracker crust (wheat flour, butter, sugar), vanilla extract" },
    { name: "Chocolate Shake", category: "beverage", serving_size: 420, serving_unit: "ml", calories: 620, total_fat: 24, saturated_fat: 15, trans_fat: 0.5, cholesterol: 80, sodium: 310, total_carbohydrates: 92, dietary_fiber: 2, total_sugars: 76, protein: 12, ingredients_text: "vanilla ice cream (milk, cream, sugar), milk, chocolate syrup (sugar, cocoa, water), whipped cream (cream)" },
    { name: "Coffee", category: "beverage", serving_size: 360, serving_unit: "ml", calories: 5, total_fat: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 5, total_carbohydrates: 0, dietary_fiber: 0, total_sugars: 0, protein: 0, ingredients_text: "brewed coffee, water" },
  ],
};

const dennys: ChainData = {
  chain: "Denny's",
  items: [
    { name: "Grand Slam", category: "entree", serving_size: 380, serving_unit: "g", calories: 770, total_fat: 43, saturated_fat: 14, trans_fat: 0.5, cholesterol: 370, sodium: 1860, total_carbohydrates: 55, dietary_fiber: 2, total_sugars: 11, protein: 36, ingredients_text: "eggs, buttermilk pancakes (wheat flour, buttermilk, eggs), bacon, sausage links (pork), butter, maple syrup, hash browns (potatoes)" },
    { name: "Moons Over My Hammy", category: "entree", serving_size: 350, serving_unit: "g", calories: 780, total_fat: 41, saturated_fat: 17, trans_fat: 0.5, cholesterol: 365, sodium: 2280, total_carbohydrates: 54, dietary_fiber: 2, total_sugars: 6, protein: 48, ingredients_text: "sourdough bread (wheat flour), scrambled eggs, ham, Swiss cheese (milk), American cheese (milk), butter, hash browns (potatoes)" },
    { name: "Bacon Avocado Cheeseburger", category: "entree", serving_size: 370, serving_unit: "g", calories: 950, total_fat: 60, saturated_fat: 22, trans_fat: 1.5, cholesterol: 155, sodium: 1640, total_carbohydrates: 50, dietary_fiber: 4, total_sugars: 10, protein: 52, ingredients_text: "beef patty, brioche bun (wheat flour, eggs, butter), bacon, avocado, cheddar cheese (milk), lettuce, tomato, onion, pickles, mayonnaise (soybean oil, eggs)" },
    { name: "Country Fried Steak", category: "entree", serving_size: 400, serving_unit: "g", calories: 870, total_fat: 54, saturated_fat: 18, trans_fat: 1, cholesterol: 130, sodium: 2410, total_carbohydrates: 58, dietary_fiber: 2, total_sugars: 4, protein: 36, ingredients_text: "beef steak, wheat flour, eggs, breadcrumbs, country gravy (milk, wheat flour, butter, sausage drippings), mashed potatoes (potatoes, milk, butter)" },
    { name: "Lumberjack Slam", category: "entree", serving_size: 520, serving_unit: "g", calories: 1190, total_fat: 65, saturated_fat: 22, trans_fat: 1, cholesterol: 495, sodium: 3120, total_carbohydrates: 90, dietary_fiber: 3, total_sugars: 22, protein: 55, ingredients_text: "eggs, buttermilk pancakes (wheat flour, buttermilk, eggs), bacon, sausage (pork), ham, hash browns (potatoes, soybean oil), butter, maple syrup" },
    { name: "French Toast Slam", category: "entree", serving_size: 350, serving_unit: "g", calories: 710, total_fat: 34, saturated_fat: 12, trans_fat: 0.5, cholesterol: 295, sodium: 1470, total_carbohydrates: 68, dietary_fiber: 2, total_sugars: 24, protein: 30, ingredients_text: "French toast (wheat bread, eggs, milk, cinnamon, vanilla), eggs, bacon, butter, powdered sugar, maple syrup" },
    { name: "Fit Fare Veggie Skillet", category: "entree", serving_size: 360, serving_unit: "g", calories: 340, total_fat: 14, saturated_fat: 4, trans_fat: 0, cholesterol: 195, sodium: 780, total_carbohydrates: 32, dietary_fiber: 6, total_sugars: 7, protein: 22, ingredients_text: "egg whites, broccoli, mushrooms, tomatoes, spinach, bell peppers, onions, potatoes, seasoning (salt, pepper, herbs)" },
    { name: "Chicken Tenders", category: "entree", serving_size: 260, serving_unit: "g", calories: 660, total_fat: 32, saturated_fat: 6, trans_fat: 0, cholesterol: 80, sodium: 1760, total_carbohydrates: 52, dietary_fiber: 3, total_sugars: 4, protein: 38, ingredients_text: "chicken breast, wheat flour, cornstarch, eggs, salt, pepper, soybean oil, fries (potatoes, soybean oil)" },
    { name: "Club Sandwich", category: "entree", serving_size: 350, serving_unit: "g", calories: 730, total_fat: 38, saturated_fat: 10, trans_fat: 0, cholesterol: 95, sodium: 1890, total_carbohydrates: 56, dietary_fiber: 3, total_sugars: 8, protein: 40, ingredients_text: "toasted bread (wheat flour), turkey breast, ham, bacon, lettuce, tomato, American cheese (milk), mayonnaise (soybean oil, eggs)" },
    { name: "Cobb Salad", category: "salad", serving_size: 380, serving_unit: "g", calories: 580, total_fat: 37, saturated_fat: 12, trans_fat: 0, cholesterol: 260, sodium: 1340, total_carbohydrates: 16, dietary_fiber: 4, total_sugars: 5, protein: 44, ingredients_text: "mixed greens, grilled chicken breast, bacon, hard-boiled eggs, avocado, tomatoes, blue cheese (milk), ranch dressing (soybean oil, buttermilk)" },
    { name: "Onion Rings", category: "appetizer", serving_size: 190, serving_unit: "g", calories: 460, total_fat: 22, saturated_fat: 4, trans_fat: 0, cholesterol: 0, sodium: 790, total_carbohydrates: 57, dietary_fiber: 3, total_sugars: 7, protein: 6, ingredients_text: "onion rings, wheat flour, cornstarch, breadcrumbs (wheat), salt, soybean oil" },
    { name: "Brownie Sundae", category: "dessert", serving_size: 230, serving_unit: "g", calories: 780, total_fat: 36, saturated_fat: 18, trans_fat: 0.5, cholesterol: 90, sodium: 340, total_carbohydrates: 107, dietary_fiber: 3, total_sugars: 76, protein: 9, ingredients_text: "chocolate brownie (wheat flour, cocoa, sugar, eggs, butter), vanilla ice cream (milk, cream, sugar), hot fudge (chocolate, cream, sugar), whipped cream (cream)" },
    { name: "Pancakes 3 Stack", category: "entree", serving_size: 290, serving_unit: "g", calories: 430, total_fat: 15, saturated_fat: 6, trans_fat: 0, cholesterol: 60, sodium: 1100, total_carbohydrates: 61, dietary_fiber: 2, total_sugars: 13, protein: 11, ingredients_text: "buttermilk pancakes (wheat flour, buttermilk, eggs, sugar, baking powder), butter, maple syrup" },
    { name: "Seasoned Fries", category: "side", serving_size: 170, serving_unit: "g", calories: 390, total_fat: 19, saturated_fat: 3, trans_fat: 0, cholesterol: 0, sodium: 630, total_carbohydrates: 50, dietary_fiber: 4, total_sugars: 0, protein: 5, ingredients_text: "potatoes, soybean oil, seasoning (salt, paprika, garlic powder, onion powder, pepper)" },
    { name: "Chocolate Shake", category: "beverage", serving_size: 420, serving_unit: "ml", calories: 630, total_fat: 25, saturated_fat: 16, trans_fat: 0.5, cholesterol: 85, sodium: 320, total_carbohydrates: 93, dietary_fiber: 2, total_sugars: 78, protein: 12, ingredients_text: "vanilla ice cream (milk, cream, sugar), milk, chocolate syrup (sugar, cocoa, water), whipped cream (cream)" },
  ],
};

// ─── PIZZA CHAINS ────────────────────────────────────────────────────────────

const pizzaHut: ChainData = {
  chain: "Pizza Hut",
  items: [
    { name: "Pepperoni Pizza Medium Slice", category: "entree", serving_size: 107, serving_unit: "g", calories: 250, total_fat: 10, saturated_fat: 4.5, trans_fat: 0, cholesterol: 25, sodium: 590, total_carbohydrates: 28, dietary_fiber: 1, total_sugars: 3, protein: 11, ingredients_text: "pizza dough (wheat flour, water, yeast, sugar, soybean oil, salt), pizza sauce (tomatoes, garlic, herbs), mozzarella cheese (milk), pepperoni (pork, beef, spices)" },
    { name: "Cheese Pizza Medium Slice", category: "entree", serving_size: 98, serving_unit: "g", calories: 220, total_fat: 8, saturated_fat: 4, trans_fat: 0, cholesterol: 20, sodium: 500, total_carbohydrates: 27, dietary_fiber: 1, total_sugars: 3, protein: 10, ingredients_text: "pizza dough (wheat flour, water, yeast, sugar, soybean oil, salt), pizza sauce (tomatoes, garlic, herbs), mozzarella cheese (milk)" },
    { name: "Supreme Pizza Medium Slice", category: "entree", serving_size: 130, serving_unit: "g", calories: 280, total_fat: 13, saturated_fat: 5, trans_fat: 0, cholesterol: 30, sodium: 660, total_carbohydrates: 28, dietary_fiber: 2, total_sugars: 3, protein: 13, ingredients_text: "pizza dough (wheat flour, water, yeast), pizza sauce (tomatoes, garlic), mozzarella cheese (milk), pepperoni (pork, beef), Italian sausage (pork), green peppers, onions, mushrooms, black olives" },
    { name: "Meat Lovers Pizza Medium Slice", category: "entree", serving_size: 133, serving_unit: "g", calories: 320, total_fat: 17, saturated_fat: 7, trans_fat: 0.5, cholesterol: 40, sodium: 780, total_carbohydrates: 27, dietary_fiber: 1, total_sugars: 3, protein: 15, ingredients_text: "pizza dough (wheat flour, water, yeast), pizza sauce (tomatoes), mozzarella cheese (milk), pepperoni (pork, beef), Italian sausage (pork), ham, bacon, seasoned beef" },
    { name: "Breadsticks 5 Piece", category: "side", serving_size: 150, serving_unit: "g", calories: 490, total_fat: 18, saturated_fat: 4, trans_fat: 0, cholesterol: 0, sodium: 1020, total_carbohydrates: 68, dietary_fiber: 3, total_sugars: 5, protein: 13, ingredients_text: "pizza dough (wheat flour, water, yeast, soybean oil, sugar, salt), garlic butter (butter, garlic), parmesan cheese (milk), marinara dipping sauce (tomatoes)" },
    { name: "Garlic Knots", category: "side", serving_size: 115, serving_unit: "g", calories: 340, total_fat: 14, saturated_fat: 5, trans_fat: 0, cholesterol: 10, sodium: 660, total_carbohydrates: 44, dietary_fiber: 2, total_sugars: 3, protein: 9, ingredients_text: "pizza dough (wheat flour, water, yeast), garlic butter (butter, garlic), parmesan cheese (milk), parsley, marinara sauce (tomatoes)" },
    { name: "Wing Street Wings 6 Piece", category: "appetizer", serving_size: 195, serving_unit: "g", calories: 450, total_fat: 28, saturated_fat: 8, trans_fat: 0, cholesterol: 160, sodium: 1140, total_carbohydrates: 10, dietary_fiber: 0, total_sugars: 1, protein: 38, ingredients_text: "chicken wings, buffalo sauce (cayenne pepper, vinegar, butter, garlic), celery, ranch dressing (soybean oil, buttermilk, eggs)" },
    { name: "Pasta Marinara", category: "entree", serving_size: 380, serving_unit: "g", calories: 490, total_fat: 10, saturated_fat: 2, trans_fat: 0, cholesterol: 5, sodium: 980, total_carbohydrates: 84, dietary_fiber: 5, total_sugars: 10, protein: 16, ingredients_text: "penne pasta (wheat flour), marinara sauce (tomatoes, garlic, olive oil, basil, oregano), parmesan cheese (milk)" },
    { name: "Cinnamon Sticks", category: "dessert", serving_size: 110, serving_unit: "g", calories: 370, total_fat: 12, saturated_fat: 3.5, trans_fat: 0, cholesterol: 0, sodium: 370, total_carbohydrates: 60, dietary_fiber: 1, total_sugars: 23, protein: 6, ingredients_text: "pizza dough (wheat flour, water, yeast, sugar), cinnamon sugar, butter, icing (sugar, milk, vanilla)" },
    { name: "Ultimate Hersheys Chocolate Chip Cookie", category: "dessert", serving_size: 110, serving_unit: "g", calories: 480, total_fat: 22, saturated_fat: 12, trans_fat: 0, cholesterol: 40, sodium: 340, total_carbohydrates: 66, dietary_fiber: 2, total_sugars: 40, protein: 5, ingredients_text: "wheat flour, butter, sugar, brown sugar, chocolate chips (sugar, cocoa butter, milk), eggs, vanilla extract, baking soda, salt" },
    { name: "Stuffed Crust Pepperoni Slice", category: "entree", serving_size: 140, serving_unit: "g", calories: 350, total_fat: 15, saturated_fat: 7, trans_fat: 0.5, cholesterol: 35, sodium: 820, total_carbohydrates: 35, dietary_fiber: 2, total_sugars: 4, protein: 16, ingredients_text: "pizza dough (wheat flour, water, yeast), mozzarella cheese (milk) stuffed crust, pizza sauce (tomatoes), mozzarella cheese, pepperoni (pork, beef)" },
    { name: "Thin Crust Pepperoni Slice", category: "entree", serving_size: 75, serving_unit: "g", calories: 190, total_fat: 10, saturated_fat: 4, trans_fat: 0, cholesterol: 20, sodium: 470, total_carbohydrates: 16, dietary_fiber: 1, total_sugars: 2, protein: 9, ingredients_text: "thin pizza dough (wheat flour, water, soybean oil, salt), pizza sauce (tomatoes), mozzarella cheese (milk), pepperoni (pork, beef)" },
    { name: "Personal Pan Cheese Pizza", category: "entree", serving_size: 238, serving_unit: "g", calories: 590, total_fat: 22, saturated_fat: 10, trans_fat: 0.5, cholesterol: 45, sodium: 1240, total_carbohydrates: 72, dietary_fiber: 3, total_sugars: 7, protein: 24, ingredients_text: "pizza dough (wheat flour, water, yeast, soybean oil, sugar, salt), pizza sauce (tomatoes, garlic, herbs), mozzarella cheese (milk)" },
    { name: "Caesar Salad", category: "salad", serving_size: 220, serving_unit: "g", calories: 290, total_fat: 20, saturated_fat: 4, trans_fat: 0, cholesterol: 20, sodium: 660, total_carbohydrates: 16, dietary_fiber: 2, total_sugars: 2, protein: 10, ingredients_text: "romaine lettuce, parmesan cheese (milk), croutons (wheat flour, butter), Caesar dressing (soybean oil, parmesan, anchovy, eggs, lemon)" },
    { name: "Chocolate Brownie", category: "dessert", serving_size: 95, serving_unit: "g", calories: 370, total_fat: 17, saturated_fat: 6, trans_fat: 0, cholesterol: 35, sodium: 220, total_carbohydrates: 52, dietary_fiber: 2, total_sugars: 33, protein: 4, ingredients_text: "wheat flour, sugar, cocoa, butter, eggs, chocolate chips, vanilla extract, salt" },
  ],
};

const dominos: ChainData = {
  chain: "Domino's",
  items: [
    { name: "Hand Tossed Pepperoni Medium Slice", category: "entree", serving_size: 103, serving_unit: "g", calories: 240, total_fat: 10, saturated_fat: 4, trans_fat: 0, cholesterol: 22, sodium: 560, total_carbohydrates: 27, dietary_fiber: 1, total_sugars: 3, protein: 10, ingredients_text: "hand-tossed dough (wheat flour, water, yeast, sugar, soybean oil, salt), pizza sauce (tomatoes, garlic), mozzarella cheese (milk), pepperoni (pork, beef, spices)" },
    { name: "Brooklyn Style Cheese Slice", category: "entree", serving_size: 120, serving_unit: "g", calories: 260, total_fat: 9, saturated_fat: 4, trans_fat: 0, cholesterol: 20, sodium: 530, total_carbohydrates: 33, dietary_fiber: 1, total_sugars: 4, protein: 12, ingredients_text: "Brooklyn-style dough (wheat flour, water, yeast, sugar, soybean oil), pizza sauce (tomatoes, garlic), mozzarella cheese (milk)" },
    { name: "Thin Crust Cheese Slice", category: "entree", serving_size: 63, serving_unit: "g", calories: 160, total_fat: 7, saturated_fat: 3, trans_fat: 0, cholesterol: 15, sodium: 340, total_carbohydrates: 16, dietary_fiber: 1, total_sugars: 2, protein: 7, ingredients_text: "thin crust dough (wheat flour, water, soybean oil, salt), pizza sauce (tomatoes), mozzarella cheese (milk)" },
    { name: "Pan Pizza Cheese Slice", category: "entree", serving_size: 115, serving_unit: "g", calories: 280, total_fat: 13, saturated_fat: 5, trans_fat: 0, cholesterol: 20, sodium: 540, total_carbohydrates: 30, dietary_fiber: 1, total_sugars: 3, protein: 11, ingredients_text: "pan dough (wheat flour, water, yeast, soybean oil, sugar, salt), pizza sauce (tomatoes, garlic), mozzarella cheese (milk), soybean oil" },
    { name: "Chicken Alfredo Pasta", category: "entree", serving_size: 380, serving_unit: "g", calories: 660, total_fat: 29, saturated_fat: 14, trans_fat: 0.5, cholesterol: 100, sodium: 1040, total_carbohydrates: 63, dietary_fiber: 3, total_sugars: 4, protein: 34, ingredients_text: "penne pasta (wheat flour), alfredo sauce (cream, parmesan cheese, butter, milk, garlic), grilled chicken breast, parmesan cheese (milk)" },
    { name: "Italian Sandwich", category: "entree", serving_size: 310, serving_unit: "g", calories: 790, total_fat: 37, saturated_fat: 16, trans_fat: 0.5, cholesterol: 100, sodium: 2110, total_carbohydrates: 70, dietary_fiber: 3, total_sugars: 6, protein: 38, ingredients_text: "Italian bread (wheat flour), salami (pork), ham, pepperoni (pork, beef), provolone cheese (milk), banana peppers, onions, oil, vinegar" },
    { name: "Philly Cheese Steak Sandwich", category: "entree", serving_size: 300, serving_unit: "g", calories: 690, total_fat: 28, saturated_fat: 12, trans_fat: 0.5, cholesterol: 90, sodium: 1560, total_carbohydrates: 68, dietary_fiber: 3, total_sugars: 5, protein: 36, ingredients_text: "Italian bread (wheat flour), steak (beef), American cheese (milk), provolone cheese (milk), mushrooms, green peppers, onions" },
    { name: "Breadsticks", category: "side", serving_size: 120, serving_unit: "g", calories: 330, total_fat: 10, saturated_fat: 2, trans_fat: 0, cholesterol: 0, sodium: 650, total_carbohydrates: 50, dietary_fiber: 2, total_sugars: 4, protein: 10, ingredients_text: "pizza dough (wheat flour, water, yeast, soybean oil, sugar, salt), garlic oil (soybean oil, garlic), parsley" },
    { name: "Parmesan Bread Bites", category: "side", serving_size: 130, serving_unit: "g", calories: 380, total_fat: 14, saturated_fat: 3.5, trans_fat: 0, cholesterol: 5, sodium: 760, total_carbohydrates: 52, dietary_fiber: 2, total_sugars: 4, protein: 12, ingredients_text: "pizza dough (wheat flour, water, yeast), parmesan cheese (milk), garlic butter (butter, garlic, soybean oil), parsley" },
    { name: "Lava Cakes", category: "dessert", serving_size: 90, serving_unit: "g", calories: 350, total_fat: 16, saturated_fat: 8, trans_fat: 0, cholesterol: 55, sodium: 280, total_carbohydrates: 47, dietary_fiber: 2, total_sugars: 30, protein: 5, ingredients_text: "chocolate cake (wheat flour, cocoa, sugar, eggs, butter), chocolate filling (chocolate, cream, sugar), powdered sugar" },
    { name: "Cinnamon Bread Twists", category: "dessert", serving_size: 115, serving_unit: "g", calories: 390, total_fat: 14, saturated_fat: 4, trans_fat: 0, cholesterol: 5, sodium: 400, total_carbohydrates: 60, dietary_fiber: 1, total_sugars: 24, protein: 7, ingredients_text: "pizza dough (wheat flour, water, yeast, sugar), cinnamon sugar, butter, vanilla icing (sugar, water, milk, vanilla)" },
    { name: "Boneless Chicken", category: "appetizer", serving_size: 190, serving_unit: "g", calories: 390, total_fat: 16, saturated_fat: 3, trans_fat: 0, cholesterol: 65, sodium: 1150, total_carbohydrates: 33, dietary_fiber: 2, total_sugars: 2, protein: 27, ingredients_text: "chicken breast, wheat flour, cornstarch, spices, soybean oil, hot sauce (cayenne pepper, vinegar, salt)" },
    { name: "Wings 8 Piece", category: "appetizer", serving_size: 250, serving_unit: "g", calories: 560, total_fat: 36, saturated_fat: 10, trans_fat: 0, cholesterol: 200, sodium: 1460, total_carbohydrates: 8, dietary_fiber: 0, total_sugars: 0, protein: 48, ingredients_text: "chicken wings, hot buffalo sauce (cayenne pepper, vinegar, butter, garlic, salt)" },
    { name: "Marbled Cookie Brownie", category: "dessert", serving_size: 100, serving_unit: "g", calories: 390, total_fat: 17, saturated_fat: 7, trans_fat: 0, cholesterol: 40, sodium: 230, total_carbohydrates: 56, dietary_fiber: 2, total_sugars: 35, protein: 4, ingredients_text: "wheat flour, sugar, butter, eggs, cocoa powder, chocolate chips, vanilla extract, baking soda, salt" },
    { name: "Caesar Salad", category: "salad", serving_size: 210, serving_unit: "g", calories: 280, total_fat: 19, saturated_fat: 4, trans_fat: 0, cholesterol: 20, sodium: 640, total_carbohydrates: 16, dietary_fiber: 2, total_sugars: 2, protein: 10, ingredients_text: "romaine lettuce, parmesan cheese (milk), croutons (wheat flour, butter), Caesar dressing (soybean oil, parmesan, anchovy, eggs)" },
  ],
};

const papaJohns: ChainData = {
  chain: "Papa John's",
  items: [
    { name: "Pepperoni Pizza Large Slice", category: "entree", serving_size: 130, serving_unit: "g", calories: 300, total_fat: 13, saturated_fat: 5, trans_fat: 0, cholesterol: 30, sodium: 720, total_carbohydrates: 32, dietary_fiber: 1, total_sugars: 4, protein: 13, ingredients_text: "original dough (wheat flour, water, sugar, soybean oil, yeast, salt), pizza sauce (tomatoes, garlic), mozzarella cheese (milk), pepperoni (pork, beef, spices)" },
    { name: "Cheese Pizza Large Slice", category: "entree", serving_size: 117, serving_unit: "g", calories: 260, total_fat: 9, saturated_fat: 4, trans_fat: 0, cholesterol: 20, sodium: 600, total_carbohydrates: 32, dietary_fiber: 1, total_sugars: 4, protein: 11, ingredients_text: "original dough (wheat flour, water, sugar, soybean oil, yeast, salt), pizza sauce (tomatoes, garlic), mozzarella cheese (milk)" },
    { name: "The Works Pizza Large Slice", category: "entree", serving_size: 155, serving_unit: "g", calories: 330, total_fat: 15, saturated_fat: 6, trans_fat: 0, cholesterol: 35, sodium: 830, total_carbohydrates: 33, dietary_fiber: 2, total_sugars: 4, protein: 14, ingredients_text: "original dough (wheat flour, water, yeast), pizza sauce (tomatoes), mozzarella cheese (milk), pepperoni (pork, beef), Italian sausage (pork), onions, green peppers, mushrooms, black olives" },
    { name: "Garlic Knots", category: "side", serving_size: 120, serving_unit: "g", calories: 350, total_fat: 15, saturated_fat: 5, trans_fat: 0, cholesterol: 10, sodium: 680, total_carbohydrates: 44, dietary_fiber: 2, total_sugars: 3, protein: 9, ingredients_text: "pizza dough (wheat flour, water, yeast, sugar), garlic butter (butter, garlic), parmesan cheese (milk), parsley, pizza sauce (tomatoes)" },
    { name: "Breadsticks", category: "side", serving_size: 140, serving_unit: "g", calories: 380, total_fat: 12, saturated_fat: 3, trans_fat: 0, cholesterol: 0, sodium: 720, total_carbohydrates: 56, dietary_fiber: 2, total_sugars: 5, protein: 11, ingredients_text: "pizza dough (wheat flour, water, yeast, sugar, soybean oil, salt), garlic butter (butter, garlic), parmesan cheese (milk)" },
    { name: "Chicken Poppers", category: "appetizer", serving_size: 165, serving_unit: "g", calories: 340, total_fat: 15, saturated_fat: 3, trans_fat: 0, cholesterol: 65, sodium: 1080, total_carbohydrates: 26, dietary_fiber: 1, total_sugars: 1, protein: 24, ingredients_text: "chicken breast, wheat flour, spices, soybean oil, ranch dipping sauce (soybean oil, buttermilk, eggs)" },
    { name: "Wings 8 Piece", category: "appetizer", serving_size: 240, serving_unit: "g", calories: 520, total_fat: 34, saturated_fat: 9, trans_fat: 0, cholesterol: 190, sodium: 1380, total_carbohydrates: 6, dietary_fiber: 0, total_sugars: 0, protein: 46, ingredients_text: "chicken wings, buffalo sauce (cayenne pepper, vinegar, butter, garlic), ranch dipping sauce (soybean oil, buttermilk)" },
    { name: "Papadia", category: "entree", serving_size: 270, serving_unit: "g", calories: 620, total_fat: 26, saturated_fat: 10, trans_fat: 0, cholesterol: 75, sodium: 1580, total_carbohydrates: 62, dietary_fiber: 2, total_sugars: 5, protein: 30, ingredients_text: "pizza dough (wheat flour, water, yeast), mozzarella cheese (milk), pepperoni (pork, beef), Italian sausage (pork), pizza sauce (tomatoes, garlic)" },
    { name: "Garlic Sauce Cup", category: "condiment", serving_size: 28, serving_unit: "g", calories: 150, total_fat: 17, saturated_fat: 3, trans_fat: 0, cholesterol: 0, sodium: 160, total_carbohydrates: 0, dietary_fiber: 0, total_sugars: 0, protein: 0, ingredients_text: "soybean oil, hydrogenated soybean oil, water, salt, garlic, natural and artificial butter flavor, TBHQ, citric acid" },
    { name: "Special Garlic Dipping Sauce", category: "condiment", serving_size: 28, serving_unit: "g", calories: 40, total_fat: 4, saturated_fat: 0.5, trans_fat: 0, cholesterol: 0, sodium: 160, total_carbohydrates: 1, dietary_fiber: 0, total_sugars: 0, protein: 0, ingredients_text: "soybean oil, water, garlic, salt, natural flavor" },
    { name: "Jalapeno Poppers", category: "appetizer", serving_size: 145, serving_unit: "g", calories: 330, total_fat: 18, saturated_fat: 8, trans_fat: 0, cholesterol: 35, sodium: 820, total_carbohydrates: 32, dietary_fiber: 2, total_sugars: 3, protein: 10, ingredients_text: "jalapeno peppers, cream cheese (milk), cheddar cheese (milk), wheat flour, breadcrumbs (wheat), eggs, soybean oil" },
    { name: "Chocolate Chip Cookie", category: "dessert", serving_size: 100, serving_unit: "g", calories: 450, total_fat: 20, saturated_fat: 10, trans_fat: 0, cholesterol: 35, sodium: 310, total_carbohydrates: 62, dietary_fiber: 1, total_sugars: 36, protein: 5, ingredients_text: "wheat flour, butter, sugar, brown sugar, chocolate chips (sugar, cocoa butter, milk), eggs, vanilla extract, baking soda, salt" },
    { name: "Cinnamon Knots", category: "dessert", serving_size: 100, serving_unit: "g", calories: 340, total_fat: 11, saturated_fat: 3, trans_fat: 0, cholesterol: 0, sodium: 340, total_carbohydrates: 54, dietary_fiber: 1, total_sugars: 20, protein: 6, ingredients_text: "pizza dough (wheat flour, water, yeast, sugar), cinnamon sugar, cream cheese icing (cream cheese, milk, sugar, vanilla)" },
    { name: "Double Chocolate Chip Brownie", category: "dessert", serving_size: 100, serving_unit: "g", calories: 410, total_fat: 19, saturated_fat: 8, trans_fat: 0, cholesterol: 45, sodium: 240, total_carbohydrates: 56, dietary_fiber: 2, total_sugars: 37, protein: 5, ingredients_text: "wheat flour, sugar, cocoa, butter, eggs, chocolate chips, vanilla extract, baking powder, salt" },
    { name: "Caesar Salad", category: "salad", serving_size: 210, serving_unit: "g", calories: 270, total_fat: 18, saturated_fat: 4, trans_fat: 0, cholesterol: 18, sodium: 620, total_carbohydrates: 15, dietary_fiber: 2, total_sugars: 2, protein: 9, ingredients_text: "romaine lettuce, parmesan cheese (milk), croutons (wheat flour, butter), Caesar dressing (soybean oil, parmesan, anchovy, eggs, lemon)" },
  ],
};

const paneraBread: ChainData = {
  chain: "Panera Bread",
  items: [
    { name: "Broccoli Cheddar Soup Bowl", category: "soup", serving_size: 340, serving_unit: "g", calories: 360, total_fat: 21, saturated_fat: 13, trans_fat: 0, cholesterol: 55, sodium: 1190, total_carbohydrates: 29, dietary_fiber: 2, total_sugars: 6, protein: 14, ingredients_text: "water, broccoli, half and half (milk, cream), carrots, processed cheddar cheese (milk, whey, salt, enzymes), onion, wheat flour, butter, salt, pepper" },
    { name: "Mac and Cheese", category: "entree", serving_size: 340, serving_unit: "g", calories: 480, total_fat: 22, saturated_fat: 11, trans_fat: 0, cholesterol: 50, sodium: 1290, total_carbohydrates: 50, dietary_fiber: 2, total_sugars: 5, protein: 18, ingredients_text: "elbow pasta (wheat flour), white cheddar cheese sauce (milk, cheddar cheese, cream, butter, wheat flour, salt)" },
    { name: "Caesar Salad", category: "salad", serving_size: 250, serving_unit: "g", calories: 330, total_fat: 24, saturated_fat: 5, trans_fat: 0, cholesterol: 25, sodium: 740, total_carbohydrates: 18, dietary_fiber: 3, total_sugars: 2, protein: 10, ingredients_text: "romaine lettuce, parmesan cheese (milk), croutons (wheat flour, olive oil, garlic), Caesar dressing (soybean oil, parmesan, anchovy, eggs, lemon juice)" },
    { name: "Greek Salad", category: "salad", serving_size: 290, serving_unit: "g", calories: 400, total_fat: 30, saturated_fat: 7, trans_fat: 0, cholesterol: 25, sodium: 870, total_carbohydrates: 22, dietary_fiber: 4, total_sugars: 6, protein: 10, ingredients_text: "romaine lettuce, tomatoes, cucumbers, red onion, kalamata olives, pepperoncini, feta cheese (milk), Greek dressing (olive oil, red wine vinegar, garlic, oregano)" },
    { name: "Turkey Sandwich", category: "entree", serving_size: 320, serving_unit: "g", calories: 510, total_fat: 15, saturated_fat: 3, trans_fat: 0, cholesterol: 55, sodium: 1310, total_carbohydrates: 56, dietary_fiber: 3, total_sugars: 5, protein: 35, ingredients_text: "country bread (wheat flour, water, salt, yeast), smoked turkey breast, lettuce, tomato, onion, mustard" },
    { name: "Bacon Turkey Bravo", category: "entree", serving_size: 350, serving_unit: "g", calories: 630, total_fat: 25, saturated_fat: 8, trans_fat: 0, cholesterol: 80, sodium: 1800, total_carbohydrates: 60, dietary_fiber: 3, total_sugars: 8, protein: 40, ingredients_text: "tomato basil bread (wheat flour, tomatoes), smoked turkey breast, bacon, Gouda cheese (milk), lettuce, tomato, signature sauce (mayonnaise, soybean oil)" },
    { name: "Frontega Chicken Panini", category: "entree", serving_size: 340, serving_unit: "g", calories: 660, total_fat: 28, saturated_fat: 9, trans_fat: 0, cholesterol: 90, sodium: 1650, total_carbohydrates: 58, dietary_fiber: 3, total_sugars: 6, protein: 42, ingredients_text: "focaccia bread (wheat flour, olive oil), grilled chicken breast, mozzarella cheese (milk), tomatoes, red onions, chipotle mayonnaise (mayonnaise, soybean oil, chipotle peppers)" },
    { name: "Kitchen Sink Cookie", category: "dessert", serving_size: 110, serving_unit: "g", calories: 480, total_fat: 23, saturated_fat: 13, trans_fat: 0, cholesterol: 55, sodium: 350, total_carbohydrates: 66, dietary_fiber: 2, total_sugars: 42, protein: 5, ingredients_text: "wheat flour, butter, sugar, brown sugar, chocolate chips (sugar, cocoa butter, milk), caramel chips, eggs, vanilla extract, baking soda, salt" },
    { name: "Bear Claw", category: "dessert", serving_size: 130, serving_unit: "g", calories: 460, total_fat: 22, saturated_fat: 10, trans_fat: 0, cholesterol: 50, sodium: 330, total_carbohydrates: 60, dietary_fiber: 2, total_sugars: 28, protein: 7, ingredients_text: "pastry dough (wheat flour, butter, sugar, eggs, milk, yeast), almond filling (almonds, sugar), sugar glaze (sugar, milk, vanilla)" },
    { name: "Bagel with Cream Cheese", category: "entree", serving_size: 150, serving_unit: "g", calories: 370, total_fat: 12, saturated_fat: 7, trans_fat: 0, cholesterol: 30, sodium: 540, total_carbohydrates: 52, dietary_fiber: 2, total_sugars: 7, protein: 12, ingredients_text: "plain bagel (wheat flour, water, sugar, malt, yeast, salt), cream cheese (milk, cream, salt)" },
    { name: "Baguette", category: "side", serving_size: 170, serving_unit: "g", calories: 430, total_fat: 2, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 980, total_carbohydrates: 87, dietary_fiber: 3, total_sugars: 3, protein: 16, ingredients_text: "wheat flour, water, salt, yeast, malted barley flour" },
    { name: "Tomato Soup Bowl", category: "soup", serving_size: 340, serving_unit: "g", calories: 270, total_fat: 14, saturated_fat: 6, trans_fat: 0, cholesterol: 25, sodium: 1040, total_carbohydrates: 31, dietary_fiber: 3, total_sugars: 15, protein: 5, ingredients_text: "tomatoes, cream (milk), water, sugar, butter, wheat flour, salt, basil, garlic, onion" },
    { name: "Chicken Noodle Soup Bowl", category: "soup", serving_size: 340, serving_unit: "g", calories: 160, total_fat: 5, saturated_fat: 1.5, trans_fat: 0, cholesterol: 40, sodium: 1160, total_carbohydrates: 15, dietary_fiber: 1, total_sugars: 2, protein: 13, ingredients_text: "chicken broth, chicken breast, egg noodles (wheat flour, eggs), carrots, celery, onion, chicken fat, salt, pepper" },
    { name: "Green Goddess Cobb Salad", category: "salad", serving_size: 380, serving_unit: "g", calories: 530, total_fat: 33, saturated_fat: 9, trans_fat: 0, cholesterol: 210, sodium: 1180, total_carbohydrates: 20, dietary_fiber: 5, total_sugars: 5, protein: 38, ingredients_text: "mixed greens, grilled chicken breast, bacon, hard-boiled eggs, avocado, tomatoes, pickled red onion, green goddess dressing (soybean oil, herbs, buttermilk)" },
    { name: "Lemon Drop Cookie", category: "dessert", serving_size: 95, serving_unit: "g", calories: 400, total_fat: 17, saturated_fat: 10, trans_fat: 0, cholesterol: 45, sodium: 270, total_carbohydrates: 58, dietary_fiber: 0, total_sugars: 36, protein: 4, ingredients_text: "wheat flour, butter, sugar, lemon juice, lemon zest, eggs, powdered sugar, vanilla extract, baking soda" },
  ],
};

const crackerBarrel: ChainData = {
  chain: "Cracker Barrel",
  items: [
    { name: "Country Boy Breakfast", category: "entree", serving_size: 480, serving_unit: "g", calories: 1070, total_fat: 60, saturated_fat: 21, trans_fat: 1, cholesterol: 440, sodium: 2680, total_carbohydrates: 78, dietary_fiber: 3, total_sugars: 16, protein: 52, ingredients_text: "eggs, bacon, sausage (pork), buttermilk biscuits (wheat flour, buttermilk, butter), hash brown casserole (potatoes, cheddar cheese, milk, sour cream), butter, strawberry jam, grits (corn)" },
    { name: "Chicken Fried Chicken", category: "entree", serving_size: 400, serving_unit: "g", calories: 890, total_fat: 48, saturated_fat: 14, trans_fat: 0.5, cholesterol: 140, sodium: 2240, total_carbohydrates: 66, dietary_fiber: 3, total_sugars: 5, protein: 48, ingredients_text: "chicken breast, wheat flour, eggs, buttermilk, sawmill gravy (milk, wheat flour, butter, sausage drippings, pepper), mashed potatoes (potatoes, milk, butter), turnip greens" },
    { name: "Meatloaf", category: "entree", serving_size: 370, serving_unit: "g", calories: 680, total_fat: 35, saturated_fat: 14, trans_fat: 1, cholesterol: 155, sodium: 1890, total_carbohydrates: 48, dietary_fiber: 3, total_sugars: 14, protein: 40, ingredients_text: "ground beef, breadcrumbs (wheat flour), eggs, onion, ketchup (tomatoes, sugar, vinegar), tomato glaze (ketchup, brown sugar), mashed potatoes (potatoes, milk, butter)" },
    { name: "Grilled Chicken Tenderloins", category: "entree", serving_size: 310, serving_unit: "g", calories: 380, total_fat: 10, saturated_fat: 3, trans_fat: 0, cholesterol: 120, sodium: 1340, total_carbohydrates: 32, dietary_fiber: 4, total_sugars: 5, protein: 40, ingredients_text: "grilled chicken tenderloins, seasoning (salt, pepper, garlic), steamed broccoli, carrots, corn" },
    { name: "Country Ham", category: "entree", serving_size: 280, serving_unit: "g", calories: 510, total_fat: 20, saturated_fat: 7, trans_fat: 0, cholesterol: 130, sodium: 3200, total_carbohydrates: 42, dietary_fiber: 2, total_sugars: 6, protein: 38, ingredients_text: "country-cured ham (pork, salt, sugar, sodium nitrite), eggs, biscuit (wheat flour, buttermilk, butter), hash brown casserole (potatoes, cheese, sour cream)" },
    { name: "Sunrise Sampler", category: "entree", serving_size: 450, serving_unit: "g", calories: 960, total_fat: 52, saturated_fat: 18, trans_fat: 0.5, cholesterol: 410, sodium: 2540, total_carbohydrates: 70, dietary_fiber: 3, total_sugars: 18, protein: 48, ingredients_text: "eggs, bacon, sausage (pork), buttermilk pancakes (wheat flour, buttermilk, eggs), hash brown casserole (potatoes, cheddar cheese, milk), grits (corn), butter, maple syrup" },
    { name: "Pancakes", category: "entree", serving_size: 280, serving_unit: "g", calories: 420, total_fat: 14, saturated_fat: 6, trans_fat: 0, cholesterol: 55, sodium: 1060, total_carbohydrates: 60, dietary_fiber: 2, total_sugars: 14, protein: 10, ingredients_text: "buttermilk pancake batter (wheat flour, buttermilk, eggs, sugar, baking powder), butter, maple syrup" },
    { name: "Biscuit", category: "side", serving_size: 85, serving_unit: "g", calories: 280, total_fat: 13, saturated_fat: 7, trans_fat: 0, cholesterol: 5, sodium: 720, total_carbohydrates: 35, dietary_fiber: 1, total_sugars: 3, protein: 5, ingredients_text: "wheat flour, buttermilk, butter, baking powder, salt, sugar" },
    { name: "Hashbrown Casserole", category: "side", serving_size: 170, serving_unit: "g", calories: 300, total_fat: 20, saturated_fat: 9, trans_fat: 0, cholesterol: 35, sodium: 680, total_carbohydrates: 24, dietary_fiber: 2, total_sugars: 2, protein: 7, ingredients_text: "shredded potatoes, cheddar cheese (milk), sour cream (milk), cream of chicken soup (milk, wheat flour, chicken), onion, butter, salt, pepper" },
    { name: "Turnip Greens", category: "side", serving_size: 140, serving_unit: "g", calories: 60, total_fat: 2, saturated_fat: 0.5, trans_fat: 0, cholesterol: 5, sodium: 620, total_carbohydrates: 7, dietary_fiber: 3, total_sugars: 1, protein: 3, ingredients_text: "turnip greens, water, pork fat, salt, pepper, vinegar" },
    { name: "Mac and Cheese", category: "side", serving_size: 170, serving_unit: "g", calories: 310, total_fat: 16, saturated_fat: 8, trans_fat: 0, cholesterol: 35, sodium: 740, total_carbohydrates: 30, dietary_fiber: 1, total_sugars: 4, protein: 12, ingredients_text: "elbow macaroni (wheat flour), cheddar cheese (milk), milk, butter, wheat flour, salt" },
    { name: "Corn Muffin", category: "side", serving_size: 80, serving_unit: "g", calories: 230, total_fat: 8, saturated_fat: 3, trans_fat: 0, cholesterol: 30, sodium: 380, total_carbohydrates: 35, dietary_fiber: 1, total_sugars: 10, protein: 4, ingredients_text: "cornmeal, wheat flour, sugar, buttermilk, eggs, butter, baking powder, salt" },
    { name: "Cobbler", category: "dessert", serving_size: 230, serving_unit: "g", calories: 520, total_fat: 18, saturated_fat: 9, trans_fat: 0, cholesterol: 40, sodium: 380, total_carbohydrates: 84, dietary_fiber: 2, total_sugars: 54, protein: 5, ingredients_text: "peaches, sugar, wheat flour, butter, cinnamon, nutmeg, vanilla extract, baking powder, milk" },
    { name: "Country Fried Steak", category: "entree", serving_size: 390, serving_unit: "g", calories: 850, total_fat: 50, saturated_fat: 17, trans_fat: 1, cholesterol: 130, sodium: 2350, total_carbohydrates: 58, dietary_fiber: 2, total_sugars: 4, protein: 38, ingredients_text: "beef steak, wheat flour, eggs, buttermilk, sawmill gravy (milk, wheat flour, butter, sausage drippings), mashed potatoes (potatoes, milk, butter)" },
    { name: "Grilled Trout", category: "entree", serving_size: 300, serving_unit: "g", calories: 440, total_fat: 22, saturated_fat: 5, trans_fat: 0, cholesterol: 120, sodium: 890, total_carbohydrates: 24, dietary_fiber: 3, total_sugars: 3, protein: 38, ingredients_text: "rainbow trout fillet, butter, lemon, seasoning (salt, pepper, herbs), steamed vegetables (broccoli, carrots), rice" },
  ],
};

// ─── All Chains ──────────────────────────────────────────────────────────────

const allChains: ChainData[] = [
  oliveGarden,
  applebees,
  chilis,
  ihop,
  dennys,
  pizzaHut,
  dominos,
  papaJohns,
  paneraBread,
  crackerBarrel,
];

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  console.log("=== Restaurant Chain Nutrition Import — Batch 2 ===\n");

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
