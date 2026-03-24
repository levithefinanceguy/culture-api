/**
 * Restaurant Chain Nutrition Data Import - Batch 4
 *
 * Drink shops, sub shops, and other chains.
 * Data sourced from each chain's official published nutrition guides.
 *
 * Usage:
 *   npx ts-node scripts/import-chains-batch4.ts
 */

import { v4 as uuidv4 } from "uuid";
import db from "../src/data/database";
import { calculateNutriScore } from "../src/services/nutrition-score";
import { calculatePersonalHealthScore } from "../src/services/health-score";
import { detectAllergens, detectDietaryTags } from "../src/services/food-analysis";
import { generateApiKey } from "../src/middleware/auth";

interface ChainMenuItem {
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
  items: ChainMenuItem[];
}

// --- DRINK SHOPS ---

const smoothieKing: ChainData = {
  chain: "Smoothie King",
  items: [
    { name: "Hulk Strawberry", category: "Smoothies", serving_size: 591, serving_unit: "ml", calories: 964, total_fat: 32, saturated_fat: 10, trans_fat: 0, cholesterol: 15, sodium: 390, total_carbohydrates: 145, dietary_fiber: 6, total_sugars: 125, protein: 32, ingredients_text: "strawberries, turbinado sugar, banana, hulk mix (protein blend, milk, egg), ice, peanut butter" },
    { name: "Gladiator Chocolate", category: "Smoothies", serving_size: 591, serving_unit: "ml", calories: 340, total_fat: 4.5, saturated_fat: 1.5, trans_fat: 0, cholesterol: 10, sodium: 540, total_carbohydrates: 28, dietary_fiber: 2, total_sugars: 6, protein: 45, ingredients_text: "gladiator protein (milk protein isolate, cocoa), water, ice" },
    { name: "Lean1 Vanilla", category: "Smoothies", serving_size: 591, serving_unit: "ml", calories: 360, total_fat: 8, saturated_fat: 1.5, trans_fat: 0, cholesterol: 10, sodium: 480, total_carbohydrates: 50, dietary_fiber: 5, total_sugars: 34, protein: 25, ingredients_text: "banana, lean1 protein blend (whey protein, milk), vanilla, dates, almonds, ice" },
    { name: "The Activator Strawberry Banana", category: "Smoothies", serving_size: 591, serving_unit: "ml", calories: 520, total_fat: 10, saturated_fat: 2, trans_fat: 0, cholesterol: 15, sodium: 350, total_carbohydrates: 84, dietary_fiber: 5, total_sugars: 65, protein: 28, ingredients_text: "strawberries, banana, whey protein, nonfat milk, ice" },
    { name: "Caribbean Way", category: "Smoothies", serving_size: 591, serving_unit: "ml", calories: 400, total_fat: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 45, total_carbohydrates: 99, dietary_fiber: 4, total_sugars: 87, protein: 2, ingredients_text: "strawberries, papaya, turbinado sugar, apple juice blend, ice" },
    { name: "Island Impact", category: "Smoothies", serving_size: 591, serving_unit: "ml", calories: 450, total_fat: 1, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 50, total_carbohydrates: 108, dietary_fiber: 5, total_sugars: 92, protein: 3, ingredients_text: "mango, pineapple, strawberries, turbinado sugar, apple juice blend, ice" },
    { name: "Pineapple Surf", category: "Smoothies", serving_size: 591, serving_unit: "ml", calories: 460, total_fat: 0.5, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 35, total_carbohydrates: 112, dietary_fiber: 3, total_sugars: 96, protein: 3, ingredients_text: "pineapple, coconut, turbinado sugar, apple juice blend, ice" },
    { name: "Angel Food", category: "Smoothies", serving_size: 591, serving_unit: "ml", calories: 330, total_fat: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 60, total_carbohydrates: 80, dietary_fiber: 3, total_sugars: 69, protein: 2, ingredients_text: "strawberries, banana, nonfat milk, turbinado sugar, ice" },
    { name: "Slim-N-Trim Vanilla", category: "Smoothies", serving_size: 591, serving_unit: "ml", calories: 270, total_fat: 2, saturated_fat: 0.5, trans_fat: 0, cholesterol: 5, sodium: 390, total_carbohydrates: 44, dietary_fiber: 4, total_sugars: 30, protein: 20, ingredients_text: "banana, nonfat milk, whey protein, vanilla, dates, ice" },
    { name: "Pure Recharge Mango", category: "Smoothies", serving_size: 591, serving_unit: "ml", calories: 310, total_fat: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 30, total_carbohydrates: 76, dietary_fiber: 3, total_sugars: 60, protein: 1, ingredients_text: "mango, coconut water, dates, ice" },
    { name: "Vegan Mango Kale", category: "Smoothies", serving_size: 591, serving_unit: "ml", calories: 310, total_fat: 2, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 200, total_carbohydrates: 60, dietary_fiber: 5, total_sugars: 44, protein: 16, ingredients_text: "mango, kale, banana, plant-based protein (pea protein), almond milk, ice" },
    { name: "Greek Yogurt Strawberry", category: "Smoothies", serving_size: 591, serving_unit: "ml", calories: 380, total_fat: 6, saturated_fat: 2.5, trans_fat: 0, cholesterol: 20, sodium: 180, total_carbohydrates: 60, dietary_fiber: 3, total_sugars: 50, protein: 22, ingredients_text: "strawberries, greek yogurt (milk), honey, banana, ice" },
    { name: "Power Punch Plus", category: "Smoothies", serving_size: 591, serving_unit: "ml", calories: 430, total_fat: 1, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 55, total_carbohydrates: 105, dietary_fiber: 3, total_sugars: 88, protein: 4, ingredients_text: "strawberries, apple juice blend, banana, turbinado sugar, power punch plus blend, ice" },
    { name: "Coffee High Protein", category: "Smoothies", serving_size: 591, serving_unit: "ml", calories: 370, total_fat: 8, saturated_fat: 2, trans_fat: 0, cholesterol: 15, sodium: 430, total_carbohydrates: 42, dietary_fiber: 2, total_sugars: 32, protein: 30, ingredients_text: "coffee, whey protein, nonfat milk, banana, almond butter, ice" },
    { name: "Banana Boat", category: "Smoothies", serving_size: 591, serving_unit: "ml", calories: 520, total_fat: 14, saturated_fat: 3, trans_fat: 0, cholesterol: 10, sodium: 300, total_carbohydrates: 80, dietary_fiber: 5, total_sugars: 60, protein: 20, ingredients_text: "banana, turbinado sugar, peanut butter, whey protein, nonfat milk, ice" },
  ],
};

const jambaJuice: ChainData = {
  chain: "Jamba Juice",
  items: [
    { name: "Acai Primo Bowl", category: "Bowls", serving_size: 420, serving_unit: "g", calories: 510, total_fat: 11, saturated_fat: 2, trans_fat: 0, cholesterol: 0, sodium: 50, total_carbohydrates: 99, dietary_fiber: 9, total_sugars: 67, protein: 8, ingredients_text: "acai blend, banana, blueberries, strawberries, granola (oats, honey), honey, coconut" },
    { name: "Caribbean Passion", category: "Smoothies", serving_size: 591, serving_unit: "ml", calories: 300, total_fat: 1, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 45, total_carbohydrates: 72, dietary_fiber: 3, total_sugars: 63, protein: 2, ingredients_text: "passion fruit-mango juice blend, strawberries, peaches, orange sherbet (milk), ice" },
    { name: "Mango-a-Go-Go", category: "Smoothies", serving_size: 591, serving_unit: "ml", calories: 320, total_fat: 1.5, saturated_fat: 0.5, trans_fat: 0, cholesterol: 0, sodium: 40, total_carbohydrates: 78, dietary_fiber: 3, total_sugars: 68, protein: 2, ingredients_text: "mango, passion fruit-mango juice blend, pineapple sherbet (milk), ice" },
    { name: "Orange Dream Machine", category: "Smoothies", serving_size: 591, serving_unit: "ml", calories: 440, total_fat: 6, saturated_fat: 2.5, trans_fat: 0, cholesterol: 15, sodium: 190, total_carbohydrates: 81, dietary_fiber: 3, total_sugars: 70, protein: 14, ingredients_text: "orange juice, orange sherbet (milk), vanilla frozen yogurt (milk), whey protein, ice" },
    { name: "Protein Berry Workout", category: "Smoothies", serving_size: 591, serving_unit: "ml", calories: 380, total_fat: 4, saturated_fat: 0.5, trans_fat: 0, cholesterol: 5, sodium: 290, total_carbohydrates: 60, dietary_fiber: 5, total_sugars: 45, protein: 28, ingredients_text: "strawberries, blueberries, whey protein, soy milk, banana, ice" },
    { name: "PB Banana Protein", category: "Smoothies", serving_size: 591, serving_unit: "ml", calories: 490, total_fat: 16, saturated_fat: 3, trans_fat: 0, cholesterol: 10, sodium: 350, total_carbohydrates: 62, dietary_fiber: 5, total_sugars: 42, protein: 26, ingredients_text: "banana, peanut butter, whey protein, chocolate milk (milk, cocoa), ice" },
    { name: "Mega Mango", category: "Smoothies", serving_size: 591, serving_unit: "ml", calories: 290, total_fat: 1, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 35, total_carbohydrates: 70, dietary_fiber: 4, total_sugars: 58, protein: 2, ingredients_text: "mango, orange juice, pineapple, ice" },
    { name: "Greens n Ginger", category: "Smoothies", serving_size: 591, serving_unit: "ml", calories: 240, total_fat: 1, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 85, total_carbohydrates: 56, dietary_fiber: 4, total_sugars: 42, protein: 4, ingredients_text: "kale, lemon juice, ginger, mango, banana, peaches, ice" },
    { name: "Orange Carrot Karma", category: "Smoothies", serving_size: 591, serving_unit: "ml", calories: 310, total_fat: 1.5, saturated_fat: 0.5, trans_fat: 0, cholesterol: 5, sodium: 100, total_carbohydrates: 72, dietary_fiber: 5, total_sugars: 58, protein: 4, ingredients_text: "orange juice, carrot juice, mango, banana, orange sherbet (milk), ice" },
    { name: "Classic Acai Bowl", category: "Bowls", serving_size: 400, serving_unit: "g", calories: 460, total_fat: 9, saturated_fat: 1.5, trans_fat: 0, cholesterol: 0, sodium: 40, total_carbohydrates: 90, dietary_fiber: 10, total_sugars: 58, protein: 7, ingredients_text: "acai blend, banana, strawberries, blueberries, granola (oats, honey), honey" },
    { name: "Vanilla Blue Sky", category: "Smoothies", serving_size: 591, serving_unit: "ml", calories: 350, total_fat: 4, saturated_fat: 2, trans_fat: 0, cholesterol: 15, sodium: 160, total_carbohydrates: 66, dietary_fiber: 2, total_sugars: 56, protein: 10, ingredients_text: "soymilk, vanilla frozen yogurt (milk), blue spirulina, banana, ice" },
    { name: "Apple N Greens", category: "Smoothies", serving_size: 591, serving_unit: "ml", calories: 260, total_fat: 1.5, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 80, total_carbohydrates: 62, dietary_fiber: 5, total_sugars: 48, protein: 3, ingredients_text: "apple juice, kale, mango, banana, peaches, ginger, ice" },
    { name: "Bold N Cold Brew", category: "Smoothies", serving_size: 591, serving_unit: "ml", calories: 270, total_fat: 5, saturated_fat: 1.5, trans_fat: 0, cholesterol: 10, sodium: 200, total_carbohydrates: 40, dietary_fiber: 2, total_sugars: 34, protein: 16, ingredients_text: "cold brew coffee, vanilla frozen yogurt (milk), whey protein, almond milk, ice" },
    { name: "Energy Bowl", category: "Bowls", serving_size: 400, serving_unit: "g", calories: 490, total_fat: 12, saturated_fat: 2, trans_fat: 0, cholesterol: 0, sodium: 60, total_carbohydrates: 85, dietary_fiber: 8, total_sugars: 52, protein: 12, ingredients_text: "acai blend, banana, granola (oats, honey), peanut butter, blueberries, honey" },
    { name: "Oatmeal", category: "Food", serving_size: 340, serving_unit: "g", calories: 370, total_fat: 7, saturated_fat: 1.5, trans_fat: 0, cholesterol: 0, sodium: 190, total_carbohydrates: 67, dietary_fiber: 6, total_sugars: 24, protein: 10, ingredients_text: "oats, brown sugar, banana, blueberries, milk" },
  ],
};

const tropicalSmoothie: ChainData = {
  chain: "Tropical Smoothie",
  items: [
    { name: "Detox Island Green", category: "Smoothies", serving_size: 591, serving_unit: "ml", calories: 180, total_fat: 0.5, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 40, total_carbohydrates: 44, dietary_fiber: 3, total_sugars: 35, protein: 2, ingredients_text: "spinach, kale, mango, pineapple, banana, ginger, ice" },
    { name: "Bahama Mama", category: "Smoothies", serving_size: 591, serving_unit: "ml", calories: 360, total_fat: 1, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 35, total_carbohydrates: 88, dietary_fiber: 4, total_sugars: 72, protein: 2, ingredients_text: "strawberries, white chocolate (milk), coconut, turbinado sugar, pineapple, ice" },
    { name: "Sunshine Smoothie", category: "Smoothies", serving_size: 591, serving_unit: "ml", calories: 440, total_fat: 2, saturated_fat: 0.5, trans_fat: 0, cholesterol: 0, sodium: 55, total_carbohydrates: 106, dietary_fiber: 4, total_sugars: 90, protein: 3, ingredients_text: "mango, strawberries, pineapple, orange juice, turbinado sugar, ice" },
    { name: "Peanut Butter Crunch Flatbread", category: "Flatbreads", serving_size: 298, serving_unit: "g", calories: 580, total_fat: 24, saturated_fat: 5, trans_fat: 0, cholesterol: 15, sodium: 620, total_carbohydrates: 72, dietary_fiber: 5, total_sugars: 28, protein: 20, ingredients_text: "flatbread (wheat flour), peanut butter, banana, honey, granola (oats)" },
    { name: "Chicken Bacon Ranch Wrap", category: "Wraps", serving_size: 340, serving_unit: "g", calories: 640, total_fat: 28, saturated_fat: 9, trans_fat: 0, cholesterol: 95, sodium: 1620, total_carbohydrates: 56, dietary_fiber: 3, total_sugars: 5, protein: 38, ingredients_text: "flour tortilla (wheat), grilled chicken, bacon (pork), ranch dressing (milk, egg, soybean oil), cheddar cheese (milk), lettuce, tomato" },
    { name: "Thai Chicken Wrap", category: "Wraps", serving_size: 326, serving_unit: "g", calories: 580, total_fat: 20, saturated_fat: 3.5, trans_fat: 0, cholesterol: 75, sodium: 1540, total_carbohydrates: 64, dietary_fiber: 4, total_sugars: 14, protein: 34, ingredients_text: "flour tortilla (wheat), grilled chicken, thai peanut sauce (peanut, soybean oil), carrots, cabbage, cilantro, rice noodles" },
    { name: "Baja Chicken Tacos", category: "Tacos", serving_size: 310, serving_unit: "g", calories: 540, total_fat: 22, saturated_fat: 6, trans_fat: 0, cholesterol: 85, sodium: 1280, total_carbohydrates: 48, dietary_fiber: 4, total_sugars: 4, protein: 36, ingredients_text: "corn tortillas, grilled chicken, pico de gallo (tomato, onion), cheese (milk), sour cream (milk), lettuce" },
    { name: "Hummus Veggie Wrap", category: "Wraps", serving_size: 310, serving_unit: "g", calories: 490, total_fat: 18, saturated_fat: 3, trans_fat: 0, cholesterol: 0, sodium: 1180, total_carbohydrates: 66, dietary_fiber: 8, total_sugars: 7, protein: 16, ingredients_text: "flour tortilla (wheat), hummus (chickpeas, sesame), cucumber, tomato, red onion, spinach, feta cheese (milk)" },
    { name: "Chipotle Chicken Club", category: "Sandwiches", serving_size: 355, serving_unit: "g", calories: 680, total_fat: 30, saturated_fat: 10, trans_fat: 0, cholesterol: 105, sodium: 1780, total_carbohydrates: 58, dietary_fiber: 3, total_sugars: 8, protein: 42, ingredients_text: "ciabatta bread (wheat flour), grilled chicken, bacon (pork), cheddar cheese (milk), chipotle mayo (soybean oil, egg), lettuce, tomato" },
    { name: "Island Green", category: "Smoothies", serving_size: 591, serving_unit: "ml", calories: 220, total_fat: 0.5, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 45, total_carbohydrates: 54, dietary_fiber: 3, total_sugars: 42, protein: 2, ingredients_text: "spinach, kale, mango, pineapple, banana, turbinado sugar, ice" },
    { name: "Avocolada", category: "Smoothies", serving_size: 591, serving_unit: "ml", calories: 460, total_fat: 12, saturated_fat: 3, trans_fat: 0, cholesterol: 0, sodium: 55, total_carbohydrates: 82, dietary_fiber: 7, total_sugars: 62, protein: 4, ingredients_text: "avocado, coconut, spinach, pineapple, banana, coconut milk, ice" },
    { name: "Mango Berry Cosmo", category: "Smoothies", serving_size: 591, serving_unit: "ml", calories: 350, total_fat: 1, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 35, total_carbohydrates: 86, dietary_fiber: 4, total_sugars: 72, protein: 2, ingredients_text: "mango, strawberries, cranberries, turbinado sugar, apple juice blend, ice" },
    { name: "Chia Banana Boost", category: "Smoothies", serving_size: 591, serving_unit: "ml", calories: 390, total_fat: 8, saturated_fat: 1, trans_fat: 0, cholesterol: 0, sodium: 95, total_carbohydrates: 68, dietary_fiber: 10, total_sugars: 42, protein: 12, ingredients_text: "banana, chia seeds, almond butter, almond milk, honey, cinnamon, ice" },
    { name: "Kale Tango", category: "Smoothies", serving_size: 591, serving_unit: "ml", calories: 280, total_fat: 1, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 65, total_carbohydrates: 66, dietary_fiber: 5, total_sugars: 50, protein: 4, ingredients_text: "kale, mango, pineapple, banana, ginger, apple juice blend, ice" },
    { name: "Buffalo Chicken Wrap", category: "Wraps", serving_size: 335, serving_unit: "g", calories: 620, total_fat: 26, saturated_fat: 7, trans_fat: 0, cholesterol: 90, sodium: 1860, total_carbohydrates: 58, dietary_fiber: 3, total_sugars: 5, protein: 36, ingredients_text: "flour tortilla (wheat), grilled chicken, buffalo sauce, ranch dressing (milk, egg, soybean oil), cheddar cheese (milk), lettuce, tomato" },
  ],
};

// --- SUB SHOPS ---

const jerseyMikes: ChainData = {
  chain: "Jersey Mike's",
  items: [
    { name: "Club Sub", category: "Subs", serving_size: 312, serving_unit: "g", calories: 660, total_fat: 28, saturated_fat: 9, trans_fat: 0, cholesterol: 105, sodium: 1870, total_carbohydrates: 58, dietary_fiber: 3, total_sugars: 8, protein: 42, ingredients_text: "sub roll (wheat flour), turkey, ham (pork), roast beef, provolone cheese (milk), lettuce, tomato, onion, oil, vinegar" },
    { name: "Italian Sub", category: "Subs", serving_size: 320, serving_unit: "g", calories: 730, total_fat: 38, saturated_fat: 14, trans_fat: 0, cholesterol: 110, sodium: 2180, total_carbohydrates: 56, dietary_fiber: 3, total_sugars: 7, protein: 38, ingredients_text: "sub roll (wheat flour), salami (pork), capicola (pork), ham (pork), provolone cheese (milk), lettuce, tomato, onion, oil, vinegar" },
    { name: "Chipotle Cheesesteak", category: "Subs", serving_size: 340, serving_unit: "g", calories: 780, total_fat: 36, saturated_fat: 14, trans_fat: 1, cholesterol: 120, sodium: 1960, total_carbohydrates: 62, dietary_fiber: 3, total_sugars: 9, protein: 48, ingredients_text: "sub roll (wheat flour), grilled steak, chipotle mayo (soybean oil, egg), pepper jack cheese (milk), peppers, onion" },
    { name: "Turkey and Provolone", category: "Subs", serving_size: 290, serving_unit: "g", calories: 530, total_fat: 18, saturated_fat: 7, trans_fat: 0, cholesterol: 70, sodium: 1540, total_carbohydrates: 56, dietary_fiber: 3, total_sugars: 7, protein: 34, ingredients_text: "sub roll (wheat flour), turkey breast, provolone cheese (milk), lettuce, tomato, onion, oil, vinegar" },
    { name: "Veggie Sub", category: "Subs", serving_size: 295, serving_unit: "g", calories: 530, total_fat: 24, saturated_fat: 10, trans_fat: 0, cholesterol: 40, sodium: 1190, total_carbohydrates: 58, dietary_fiber: 4, total_sugars: 8, protein: 22, ingredients_text: "sub roll (wheat flour), provolone cheese (milk), swiss cheese (milk), green peppers, onion, lettuce, tomato, mushroom, oil, vinegar" },
    { name: "Tuna Fish", category: "Subs", serving_size: 310, serving_unit: "g", calories: 680, total_fat: 36, saturated_fat: 8, trans_fat: 0, cholesterol: 55, sodium: 1050, total_carbohydrates: 56, dietary_fiber: 3, total_sugars: 7, protein: 30, ingredients_text: "sub roll (wheat flour), tuna (fish), mayonnaise (soybean oil, egg), lettuce, tomato, onion" },
    { name: "Roast Beef and Provolone", category: "Subs", serving_size: 305, serving_unit: "g", calories: 600, total_fat: 22, saturated_fat: 9, trans_fat: 0, cholesterol: 90, sodium: 1420, total_carbohydrates: 56, dietary_fiber: 3, total_sugars: 7, protein: 40, ingredients_text: "sub roll (wheat flour), roast beef, provolone cheese (milk), lettuce, tomato, onion, oil, vinegar" },
    { name: "BLT", category: "Subs", serving_size: 260, serving_unit: "g", calories: 620, total_fat: 32, saturated_fat: 10, trans_fat: 0, cholesterol: 55, sodium: 1380, total_carbohydrates: 56, dietary_fiber: 3, total_sugars: 7, protein: 24, ingredients_text: "sub roll (wheat flour), bacon (pork), lettuce, tomato, mayonnaise (soybean oil, egg)" },
    { name: "Chicken Philly", category: "Subs", serving_size: 335, serving_unit: "g", calories: 680, total_fat: 26, saturated_fat: 10, trans_fat: 0, cholesterol: 100, sodium: 1640, total_carbohydrates: 60, dietary_fiber: 3, total_sugars: 8, protein: 46, ingredients_text: "sub roll (wheat flour), grilled chicken, american cheese (milk), peppers, onion" },
    { name: "Grilled Portabella", category: "Subs", serving_size: 310, serving_unit: "g", calories: 520, total_fat: 22, saturated_fat: 8, trans_fat: 0, cholesterol: 30, sodium: 1180, total_carbohydrates: 60, dietary_fiber: 4, total_sugars: 9, protein: 22, ingredients_text: "sub roll (wheat flour), portabella mushroom, swiss cheese (milk), roasted peppers, onion, oil, vinegar" },
    { name: "Mike's Famous Philly", category: "Subs", serving_size: 340, serving_unit: "g", calories: 760, total_fat: 34, saturated_fat: 14, trans_fat: 1, cholesterol: 115, sodium: 1780, total_carbohydrates: 60, dietary_fiber: 3, total_sugars: 8, protein: 50, ingredients_text: "sub roll (wheat flour), grilled steak, american cheese (milk), peppers, onion, mushroom" },
    { name: "Super Sub", category: "Subs", serving_size: 330, serving_unit: "g", calories: 710, total_fat: 32, saturated_fat: 12, trans_fat: 0, cholesterol: 100, sodium: 2080, total_carbohydrates: 58, dietary_fiber: 3, total_sugars: 8, protein: 42, ingredients_text: "sub roll (wheat flour), ham (pork), capicola (pork), provolone cheese (milk), lettuce, tomato, onion, oil, vinegar" },
    { name: "Original Italian", category: "Subs", serving_size: 310, serving_unit: "g", calories: 690, total_fat: 34, saturated_fat: 13, trans_fat: 0, cholesterol: 100, sodium: 2050, total_carbohydrates: 56, dietary_fiber: 3, total_sugars: 7, protein: 36, ingredients_text: "sub roll (wheat flour), salami (pork), ham (pork), provolone cheese (milk), lettuce, tomato, onion, oil, vinegar" },
    { name: "Big Kahuna Cheesesteak", category: "Subs", serving_size: 365, serving_unit: "g", calories: 820, total_fat: 40, saturated_fat: 16, trans_fat: 1, cholesterol: 130, sodium: 2100, total_carbohydrates: 64, dietary_fiber: 4, total_sugars: 10, protein: 52, ingredients_text: "sub roll (wheat flour), grilled steak, american cheese (milk), peppers, onion, mushroom, jalapeño" },
    { name: "Chicken Parm", category: "Subs", serving_size: 350, serving_unit: "g", calories: 740, total_fat: 30, saturated_fat: 10, trans_fat: 0, cholesterol: 85, sodium: 1820, total_carbohydrates: 70, dietary_fiber: 4, total_sugars: 12, protein: 42, ingredients_text: "sub roll (wheat flour), breaded chicken (chicken, wheat flour, egg), marinara sauce (tomato), mozzarella cheese (milk)" },
  ],
};

const jimmyJohns: ChainData = {
  chain: "Jimmy John's",
  items: [
    { name: "Beach Club", category: "Subs", serving_size: 310, serving_unit: "g", calories: 670, total_fat: 30, saturated_fat: 8, trans_fat: 0, cholesterol: 75, sodium: 1480, total_carbohydrates: 58, dietary_fiber: 3, total_sugars: 6, protein: 38, ingredients_text: "french bread (wheat flour), turkey breast, avocado, provolone cheese (milk), cucumber, sprouts, lettuce, tomato, mayo (soybean oil, egg)" },
    { name: "Italian Night Club", category: "Subs", serving_size: 325, serving_unit: "g", calories: 750, total_fat: 40, saturated_fat: 14, trans_fat: 0, cholesterol: 110, sodium: 2290, total_carbohydrates: 58, dietary_fiber: 3, total_sugars: 7, protein: 40, ingredients_text: "french bread (wheat flour), salami (pork), capicola (pork), ham (pork), provolone cheese (milk), lettuce, tomato, onion, mayo (soybean oil, egg), oil, vinegar" },
    { name: "Turkey Tom", category: "Subs", serving_size: 260, serving_unit: "g", calories: 520, total_fat: 20, saturated_fat: 4, trans_fat: 0, cholesterol: 50, sodium: 1150, total_carbohydrates: 55, dietary_fiber: 2, total_sugars: 5, protein: 26, ingredients_text: "french bread (wheat flour), turkey breast, lettuce, tomato, mayo (soybean oil, egg)" },
    { name: "Vito", category: "Subs", serving_size: 295, serving_unit: "g", calories: 680, total_fat: 36, saturated_fat: 12, trans_fat: 0, cholesterol: 85, sodium: 1880, total_carbohydrates: 56, dietary_fiber: 2, total_sugars: 6, protein: 32, ingredients_text: "french bread (wheat flour), salami (pork), capicola (pork), provolone cheese (milk), lettuce, tomato, onion, oil, vinegar" },
    { name: "Slim 1 Ham and Cheese", category: "Subs", serving_size: 215, serving_unit: "g", calories: 430, total_fat: 12, saturated_fat: 5, trans_fat: 0, cholesterol: 55, sodium: 1280, total_carbohydrates: 54, dietary_fiber: 2, total_sugars: 5, protein: 24, ingredients_text: "french bread (wheat flour), ham (pork), provolone cheese (milk)" },
    { name: "JJ Gargantuan", category: "Subs", serving_size: 425, serving_unit: "g", calories: 950, total_fat: 48, saturated_fat: 16, trans_fat: 0, cholesterol: 160, sodium: 2680, total_carbohydrates: 60, dietary_fiber: 3, total_sugars: 8, protein: 62, ingredients_text: "french bread (wheat flour), salami (pork), capicola (pork), ham (pork), turkey breast, roast beef, provolone cheese (milk), lettuce, tomato, onion, mayo (soybean oil, egg), oil, vinegar" },
    { name: "Billy Club", category: "Subs", serving_size: 310, serving_unit: "g", calories: 670, total_fat: 30, saturated_fat: 9, trans_fat: 0, cholesterol: 90, sodium: 1560, total_carbohydrates: 58, dietary_fiber: 2, total_sugars: 6, protein: 40, ingredients_text: "french bread (wheat flour), roast beef, turkey breast, provolone cheese (milk), lettuce, tomato, mayo (soybean oil, egg)" },
    { name: "Country Club", category: "Subs", serving_size: 310, serving_unit: "g", calories: 680, total_fat: 32, saturated_fat: 8, trans_fat: 0, cholesterol: 80, sodium: 1620, total_carbohydrates: 58, dietary_fiber: 3, total_sugars: 6, protein: 38, ingredients_text: "french bread (wheat flour), turkey breast, ham (pork), provolone cheese (milk), avocado, cucumber, lettuce, tomato, mayo (soybean oil, egg)" },
    { name: "Hunter's Club", category: "Subs", serving_size: 310, serving_unit: "g", calories: 640, total_fat: 26, saturated_fat: 8, trans_fat: 0, cholesterol: 90, sodium: 1440, total_carbohydrates: 56, dietary_fiber: 2, total_sugars: 6, protein: 42, ingredients_text: "french bread (wheat flour), roast beef, ham (pork), provolone cheese (milk), lettuce, tomato, mayo (soybean oil, egg)" },
    { name: "Big John", category: "Subs", serving_size: 270, serving_unit: "g", calories: 540, total_fat: 18, saturated_fat: 5, trans_fat: 0, cholesterol: 70, sodium: 940, total_carbohydrates: 54, dietary_fiber: 2, total_sugars: 5, protein: 32, ingredients_text: "french bread (wheat flour), roast beef, lettuce, tomato, mayo (soybean oil, egg)" },
    { name: "Totally Tuna", category: "Subs", serving_size: 290, serving_unit: "g", calories: 640, total_fat: 34, saturated_fat: 6, trans_fat: 0, cholesterol: 45, sodium: 1020, total_carbohydrates: 56, dietary_fiber: 2, total_sugars: 6, protein: 26, ingredients_text: "french bread (wheat flour), tuna salad (fish, mayonnaise (soybean oil, egg), celery), lettuce, tomato, cucumber" },
    { name: "Bootlegger Club", category: "Subs", serving_size: 310, serving_unit: "g", calories: 650, total_fat: 28, saturated_fat: 8, trans_fat: 0, cholesterol: 85, sodium: 1420, total_carbohydrates: 56, dietary_fiber: 2, total_sugars: 6, protein: 42, ingredients_text: "french bread (wheat flour), roast beef, turkey breast, lettuce, tomato, mayo (soybean oil, egg)" },
    { name: "The JJ", category: "Subs", serving_size: 310, serving_unit: "g", calories: 690, total_fat: 32, saturated_fat: 10, trans_fat: 0, cholesterol: 95, sodium: 1640, total_carbohydrates: 58, dietary_fiber: 3, total_sugars: 7, protein: 40, ingredients_text: "french bread (wheat flour), turkey breast, ham (pork), salami (pork), provolone cheese (milk), lettuce, tomato, mayo (soybean oil, egg), oil, vinegar" },
    { name: "Cookie", category: "Desserts", serving_size: 78, serving_unit: "g", calories: 420, total_fat: 20, saturated_fat: 12, trans_fat: 0, cholesterol: 40, sodium: 330, total_carbohydrates: 56, dietary_fiber: 1, total_sugars: 32, protein: 4, ingredients_text: "enriched flour (wheat), butter, sugar, chocolate chips (cocoa, milk), eggs, vanilla, salt" },
    { name: "Pickle", category: "Sides", serving_size: 112, serving_unit: "g", calories: 5, total_fat: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 790, total_carbohydrates: 1, dietary_fiber: 0, total_sugars: 0, protein: 0, ingredients_text: "cucumbers, water, vinegar, salt, garlic, dill" },
  ],
};

const firehouseSubs: ChainData = {
  chain: "Firehouse Subs",
  items: [
    { name: "Hook and Ladder", category: "Subs", serving_size: 320, serving_unit: "g", calories: 660, total_fat: 26, saturated_fat: 9, trans_fat: 0, cholesterol: 100, sodium: 1920, total_carbohydrates: 62, dietary_fiber: 3, total_sugars: 8, protein: 42, ingredients_text: "sub roll (wheat flour), smoked turkey, virginia honey ham (pork), monterey jack cheese (milk), lettuce, tomato, onion, mustard, mayo (soybean oil, egg)" },
    { name: "Smokehouse Beef and Cheddar", category: "Subs", serving_size: 310, serving_unit: "g", calories: 680, total_fat: 30, saturated_fat: 12, trans_fat: 0.5, cholesterol: 105, sodium: 1750, total_carbohydrates: 58, dietary_fiber: 3, total_sugars: 8, protein: 44, ingredients_text: "sub roll (wheat flour), smoked beef brisket, cheddar cheese (milk), mayo (soybean oil, egg), lettuce, tomato" },
    { name: "New York Steamer", category: "Subs", serving_size: 325, serving_unit: "g", calories: 700, total_fat: 28, saturated_fat: 10, trans_fat: 0, cholesterol: 95, sodium: 2040, total_carbohydrates: 62, dietary_fiber: 3, total_sugars: 9, protein: 46, ingredients_text: "sub roll (wheat flour), corned beef, pastrami (beef), provolone cheese (milk), mustard, lettuce, tomato, onion" },
    { name: "Turkey Bacon Ranch", category: "Subs", serving_size: 325, serving_unit: "g", calories: 680, total_fat: 32, saturated_fat: 10, trans_fat: 0, cholesterol: 95, sodium: 1880, total_carbohydrates: 58, dietary_fiber: 3, total_sugars: 8, protein: 40, ingredients_text: "sub roll (wheat flour), turkey breast, bacon (pork), ranch dressing (milk, egg, soybean oil), provolone cheese (milk), lettuce, tomato" },
    { name: "Meatball Sub", category: "Subs", serving_size: 365, serving_unit: "g", calories: 780, total_fat: 36, saturated_fat: 14, trans_fat: 0.5, cholesterol: 90, sodium: 1940, total_carbohydrates: 72, dietary_fiber: 5, total_sugars: 14, protein: 38, ingredients_text: "sub roll (wheat flour), meatballs (beef, pork, wheat bread crumbs, egg), marinara sauce (tomato), provolone cheese (milk)" },
    { name: "Italian Sub", category: "Subs", serving_size: 325, serving_unit: "g", calories: 740, total_fat: 38, saturated_fat: 14, trans_fat: 0, cholesterol: 110, sodium: 2240, total_carbohydrates: 58, dietary_fiber: 3, total_sugars: 7, protein: 40, ingredients_text: "sub roll (wheat flour), salami (pork), ham (pork), pepperoni (pork), provolone cheese (milk), lettuce, tomato, onion, oil, vinegar" },
    { name: "Club on a Sub", category: "Subs", serving_size: 330, serving_unit: "g", calories: 690, total_fat: 30, saturated_fat: 10, trans_fat: 0, cholesterol: 100, sodium: 1860, total_carbohydrates: 60, dietary_fiber: 3, total_sugars: 8, protein: 44, ingredients_text: "sub roll (wheat flour), turkey breast, ham (pork), bacon (pork), provolone cheese (milk), lettuce, tomato, mayo (soybean oil, egg)" },
    { name: "Engineer", category: "Subs", serving_size: 325, serving_unit: "g", calories: 710, total_fat: 32, saturated_fat: 12, trans_fat: 0, cholesterol: 110, sodium: 1780, total_carbohydrates: 58, dietary_fiber: 3, total_sugars: 8, protein: 46, ingredients_text: "sub roll (wheat flour), smoked turkey, corned beef, provolone cheese (milk), mustard, mayo (soybean oil, egg), lettuce, tomato" },
    { name: "Hero", category: "Subs", serving_size: 330, serving_unit: "g", calories: 720, total_fat: 34, saturated_fat: 12, trans_fat: 0, cholesterol: 100, sodium: 1920, total_carbohydrates: 60, dietary_fiber: 3, total_sugars: 8, protein: 42, ingredients_text: "sub roll (wheat flour), roast beef, turkey breast, provolone cheese (milk), mayo (soybean oil, egg), lettuce, tomato, onion" },
    { name: "Chicken Salad", category: "Subs", serving_size: 310, serving_unit: "g", calories: 640, total_fat: 30, saturated_fat: 6, trans_fat: 0, cholesterol: 70, sodium: 1340, total_carbohydrates: 60, dietary_fiber: 3, total_sugars: 8, protein: 32, ingredients_text: "sub roll (wheat flour), chicken salad (chicken, mayo (soybean oil, egg), celery), lettuce, tomato" },
    { name: "Veggie Sub", category: "Subs", serving_size: 300, serving_unit: "g", calories: 480, total_fat: 18, saturated_fat: 7, trans_fat: 0, cholesterol: 30, sodium: 1120, total_carbohydrates: 60, dietary_fiber: 5, total_sugars: 9, protein: 20, ingredients_text: "sub roll (wheat flour), provolone cheese (milk), swiss cheese (milk), mushroom, green pepper, onion, lettuce, tomato, oil, vinegar" },
    { name: "Chili", category: "Soups", serving_size: 340, serving_unit: "g", calories: 280, total_fat: 10, saturated_fat: 4, trans_fat: 0, cholesterol: 45, sodium: 1180, total_carbohydrates: 28, dietary_fiber: 6, total_sugars: 6, protein: 22, ingredients_text: "ground beef, kidney beans, tomato, onion, green pepper, chili powder, garlic, cumin, salt" },
    { name: "Brownie", category: "Desserts", serving_size: 85, serving_unit: "g", calories: 380, total_fat: 18, saturated_fat: 8, trans_fat: 0, cholesterol: 50, sodium: 210, total_carbohydrates: 54, dietary_fiber: 2, total_sugars: 36, protein: 4, ingredients_text: "sugar, butter, enriched flour (wheat), eggs, cocoa, chocolate chips (cocoa, milk), vanilla, salt" },
    { name: "Cookie", category: "Desserts", serving_size: 75, serving_unit: "g", calories: 370, total_fat: 17, saturated_fat: 10, trans_fat: 0, cholesterol: 35, sodium: 290, total_carbohydrates: 52, dietary_fiber: 1, total_sugars: 30, protein: 3, ingredients_text: "enriched flour (wheat), butter, sugar, chocolate chips (cocoa, milk), eggs, vanilla, salt" },
    { name: "Chips", category: "Sides", serving_size: 42, serving_unit: "g", calories: 230, total_fat: 13, saturated_fat: 1.5, trans_fat: 0, cholesterol: 0, sodium: 250, total_carbohydrates: 25, dietary_fiber: 2, total_sugars: 0, protein: 2, ingredients_text: "potatoes, vegetable oil (sunflower, corn), salt" },
  ],
};

// --- OTHER CHAINS ---

const noodlesAndCompany: ChainData = {
  chain: "Noodles & Company",
  items: [
    { name: "Japanese Pan Noodles", category: "Noodles", serving_size: 425, serving_unit: "g", calories: 630, total_fat: 14, saturated_fat: 2, trans_fat: 0, cholesterol: 0, sodium: 1280, total_carbohydrates: 108, dietary_fiber: 5, total_sugars: 18, protein: 18, ingredients_text: "udon noodles (wheat flour), soy sauce (wheat, soybean), broccoli, mushrooms, carrots, cabbage, garlic, ginger, sesame oil" },
    { name: "Pad Thai", category: "Noodles", serving_size: 430, serving_unit: "g", calories: 680, total_fat: 18, saturated_fat: 3, trans_fat: 0, cholesterol: 130, sodium: 1520, total_carbohydrates: 102, dietary_fiber: 4, total_sugars: 24, protein: 24, ingredients_text: "rice noodles, egg, pad thai sauce (tamarind, sugar, fish sauce), tofu (soybean), bean sprouts, peanuts, lime, scallion" },
    { name: "Mac and Cheese", category: "Noodles", serving_size: 370, serving_unit: "g", calories: 890, total_fat: 42, saturated_fat: 22, trans_fat: 0.5, cholesterol: 100, sodium: 1340, total_carbohydrates: 96, dietary_fiber: 3, total_sugars: 8, protein: 30, ingredients_text: "cavatappi pasta (wheat flour), cheddar cheese (milk), cream (milk), butter, milk, salt" },
    { name: "Pesto Cavatappi", category: "Noodles", serving_size: 400, serving_unit: "g", calories: 810, total_fat: 38, saturated_fat: 12, trans_fat: 0, cholesterol: 55, sodium: 1260, total_carbohydrates: 90, dietary_fiber: 5, total_sugars: 6, protein: 26, ingredients_text: "cavatappi pasta (wheat flour), pesto (basil, pine nuts, parmesan (milk), olive oil, garlic), cream (milk), mushroom, tomato" },
    { name: "Zucchini Grilled Chicken", category: "Noodles", serving_size: 380, serving_unit: "g", calories: 480, total_fat: 20, saturated_fat: 6, trans_fat: 0, cholesterol: 90, sodium: 1080, total_carbohydrates: 42, dietary_fiber: 5, total_sugars: 8, protein: 36, ingredients_text: "zucchini noodles, grilled chicken, garlic cream sauce (cream (milk), parmesan (milk), garlic), tomato, spinach" },
    { name: "Spaghetti and Meatballs", category: "Noodles", serving_size: 440, serving_unit: "g", calories: 820, total_fat: 26, saturated_fat: 10, trans_fat: 0.5, cholesterol: 90, sodium: 1680, total_carbohydrates: 108, dietary_fiber: 7, total_sugars: 16, protein: 36, ingredients_text: "spaghetti (wheat flour), meatballs (beef, pork, wheat bread crumbs, egg, parmesan (milk)), marinara sauce (tomato, garlic, olive oil)" },
    { name: "Alfredo MontAmore", category: "Noodles", serving_size: 390, serving_unit: "g", calories: 940, total_fat: 48, saturated_fat: 24, trans_fat: 1, cholesterol: 120, sodium: 1400, total_carbohydrates: 96, dietary_fiber: 4, total_sugars: 6, protein: 28, ingredients_text: "cavatappi pasta (wheat flour), alfredo sauce (cream (milk), parmesan (milk), butter, garlic), parmesan cheese (milk)" },
    { name: "Chinese Chop Salad", category: "Salads", serving_size: 350, serving_unit: "g", calories: 410, total_fat: 18, saturated_fat: 2.5, trans_fat: 0, cholesterol: 55, sodium: 960, total_carbohydrates: 40, dietary_fiber: 5, total_sugars: 14, protein: 24, ingredients_text: "romaine lettuce, grilled chicken, wontons (wheat flour), carrots, cabbage, cilantro, sesame dressing (soybean oil, sesame, soy sauce (wheat))" },
    { name: "Med Salad", category: "Salads", serving_size: 340, serving_unit: "g", calories: 360, total_fat: 20, saturated_fat: 6, trans_fat: 0, cholesterol: 25, sodium: 820, total_carbohydrates: 32, dietary_fiber: 6, total_sugars: 8, protein: 16, ingredients_text: "romaine lettuce, cucumber, tomato, red onion, kalamata olives, feta cheese (milk), red wine vinaigrette (olive oil, vinegar)" },
    { name: "The Spicy Korean", category: "Noodles", serving_size: 420, serving_unit: "g", calories: 710, total_fat: 22, saturated_fat: 4, trans_fat: 0, cholesterol: 75, sodium: 1640, total_carbohydrates: 96, dietary_fiber: 4, total_sugars: 18, protein: 30, ingredients_text: "udon noodles (wheat flour), gochujang sauce (soybean), grilled chicken, mushrooms, cucumber, scallion, sesame seeds, cilantro" },
    { name: "Chicken Noodle Soup", category: "Soups", serving_size: 340, serving_unit: "g", calories: 190, total_fat: 4, saturated_fat: 1, trans_fat: 0, cholesterol: 40, sodium: 1190, total_carbohydrates: 24, dietary_fiber: 2, total_sugars: 2, protein: 14, ingredients_text: "chicken broth, chicken, egg noodles (wheat flour, egg), carrot, celery, onion, salt, parsley" },
    { name: "Tomato Bisque", category: "Soups", serving_size: 340, serving_unit: "g", calories: 310, total_fat: 16, saturated_fat: 8, trans_fat: 0, cholesterol: 40, sodium: 1060, total_carbohydrates: 36, dietary_fiber: 3, total_sugars: 14, protein: 6, ingredients_text: "tomatoes, cream (milk), butter, onion, garlic, sugar, basil, salt" },
    { name: "Rice Krispy Treat", category: "Desserts", serving_size: 75, serving_unit: "g", calories: 310, total_fat: 8, saturated_fat: 4, trans_fat: 0, cholesterol: 0, sodium: 220, total_carbohydrates: 58, dietary_fiber: 0, total_sugars: 26, protein: 2, ingredients_text: "rice cereal, marshmallows (sugar, corn syrup), butter, vanilla" },
    { name: "Potstickers", category: "Appetizers", serving_size: 140, serving_unit: "g", calories: 310, total_fat: 12, saturated_fat: 3, trans_fat: 0, cholesterol: 30, sodium: 720, total_carbohydrates: 38, dietary_fiber: 2, total_sugars: 4, protein: 12, ingredients_text: "wrapper (wheat flour), pork, cabbage, ginger, garlic, soy sauce (wheat, soybean), sesame oil" },
    { name: "Garlic Bread", category: "Sides", serving_size: 90, serving_unit: "g", calories: 290, total_fat: 14, saturated_fat: 5, trans_fat: 0, cholesterol: 15, sodium: 480, total_carbohydrates: 34, dietary_fiber: 2, total_sugars: 2, protein: 6, ingredients_text: "bread (wheat flour), butter, garlic, parsley, parmesan cheese (milk)" },
  ],
};

const qdoba: ChainData = {
  chain: "Qdoba",
  items: [
    { name: "Burrito Chicken", category: "Burritos", serving_size: 440, serving_unit: "g", calories: 830, total_fat: 30, saturated_fat: 12, trans_fat: 0, cholesterol: 100, sodium: 1780, total_carbohydrates: 96, dietary_fiber: 10, total_sugars: 4, protein: 44, ingredients_text: "flour tortilla (wheat), grilled chicken, cilantro lime rice, black beans, cheese (milk), pico de gallo (tomato, onion, cilantro), sour cream (milk)" },
    { name: "Burrito Bowl", category: "Bowls", serving_size: 420, serving_unit: "g", calories: 680, total_fat: 24, saturated_fat: 10, trans_fat: 0, cholesterol: 90, sodium: 1540, total_carbohydrates: 72, dietary_fiber: 12, total_sugars: 4, protein: 42, ingredients_text: "cilantro lime rice, grilled chicken, black beans, cheese (milk), pico de gallo (tomato, onion, cilantro), sour cream (milk), lettuce" },
    { name: "Chicken Quesadilla", category: "Quesadillas", serving_size: 340, serving_unit: "g", calories: 780, total_fat: 40, saturated_fat: 18, trans_fat: 0.5, cholesterol: 120, sodium: 1620, total_carbohydrates: 56, dietary_fiber: 4, total_sugars: 3, protein: 48, ingredients_text: "flour tortilla (wheat), grilled chicken, cheese blend (milk), sour cream (milk)" },
    { name: "Nachos", category: "Nachos", serving_size: 400, serving_unit: "g", calories: 860, total_fat: 46, saturated_fat: 18, trans_fat: 0, cholesterol: 85, sodium: 1680, total_carbohydrates: 80, dietary_fiber: 8, total_sugars: 4, protein: 34, ingredients_text: "tortilla chips (corn), grilled chicken, queso (milk, cheese), black beans, pico de gallo (tomato, onion, cilantro), sour cream (milk), jalapeño" },
    { name: "Taco Salad", category: "Salads", serving_size: 450, serving_unit: "g", calories: 720, total_fat: 36, saturated_fat: 14, trans_fat: 0, cholesterol: 90, sodium: 1460, total_carbohydrates: 62, dietary_fiber: 10, total_sugars: 5, protein: 40, ingredients_text: "tortilla shell (wheat flour), romaine lettuce, grilled chicken, cheese (milk), black beans, pico de gallo (tomato, onion), sour cream (milk), salsa" },
    { name: "Street Tacos 3", category: "Tacos", serving_size: 280, serving_unit: "g", calories: 490, total_fat: 18, saturated_fat: 6, trans_fat: 0, cholesterol: 75, sodium: 1040, total_carbohydrates: 48, dietary_fiber: 5, total_sugars: 3, protein: 32, ingredients_text: "corn tortillas, grilled steak, cilantro, onion, salsa verde, lime" },
    { name: "Loaded Tortilla Soup", category: "Soups", serving_size: 340, serving_unit: "g", calories: 340, total_fat: 14, saturated_fat: 5, trans_fat: 0, cholesterol: 50, sodium: 1280, total_carbohydrates: 34, dietary_fiber: 4, total_sugars: 6, protein: 20, ingredients_text: "chicken broth, chicken, tomato, corn, black beans, onion, tortilla strips (corn), cheese (milk), cilantro, chili" },
    { name: "Chips and Queso", category: "Sides", serving_size: 200, serving_unit: "g", calories: 520, total_fat: 28, saturated_fat: 12, trans_fat: 0, cholesterol: 50, sodium: 1120, total_carbohydrates: 52, dietary_fiber: 3, total_sugars: 2, protein: 14, ingredients_text: "tortilla chips (corn), queso (milk, cheese (milk), peppers, spices)" },
    { name: "Chips and Guac", category: "Sides", serving_size: 190, serving_unit: "g", calories: 430, total_fat: 24, saturated_fat: 4, trans_fat: 0, cholesterol: 0, sodium: 560, total_carbohydrates: 50, dietary_fiber: 8, total_sugars: 2, protein: 6, ingredients_text: "tortilla chips (corn), guacamole (avocado, tomato, onion, cilantro, lime, jalapeño, salt)" },
    { name: "Grilled Adobo Chicken", category: "Protein", serving_size: 140, serving_unit: "g", calories: 190, total_fat: 7, saturated_fat: 2, trans_fat: 0, cholesterol: 90, sodium: 620, total_carbohydrates: 2, dietary_fiber: 0, total_sugars: 1, protein: 30, ingredients_text: "chicken breast, adobo seasoning (chili pepper, garlic, cumin, oregano, salt), vegetable oil" },
    { name: "Impossible Fajita Bowl", category: "Bowls", serving_size: 430, serving_unit: "g", calories: 640, total_fat: 22, saturated_fat: 8, trans_fat: 0, cholesterol: 15, sodium: 1420, total_carbohydrates: 82, dietary_fiber: 14, total_sugars: 6, protein: 30, ingredients_text: "cilantro lime rice, impossible meat (soybean), fajita veggies (peppers, onion), black beans, cheese (milk), pico de gallo (tomato, onion), guacamole (avocado)" },
    { name: "3 Cheese Nachos", category: "Nachos", serving_size: 350, serving_unit: "g", calories: 740, total_fat: 40, saturated_fat: 16, trans_fat: 0, cholesterol: 65, sodium: 1380, total_carbohydrates: 72, dietary_fiber: 5, total_sugars: 3, protein: 24, ingredients_text: "tortilla chips (corn), queso (milk), cheddar cheese (milk), mozzarella cheese (milk), jalapeño, pico de gallo (tomato, onion)" },
    { name: "Chicken Queso Burrito", category: "Burritos", serving_size: 460, serving_unit: "g", calories: 920, total_fat: 38, saturated_fat: 16, trans_fat: 0, cholesterol: 120, sodium: 2060, total_carbohydrates: 98, dietary_fiber: 8, total_sugars: 5, protein: 48, ingredients_text: "flour tortilla (wheat), grilled chicken, queso (milk, cheese), cilantro lime rice, black beans, pico de gallo (tomato, onion)" },
    { name: "Knockout Tacos", category: "Tacos", serving_size: 290, serving_unit: "g", calories: 530, total_fat: 24, saturated_fat: 8, trans_fat: 0, cholesterol: 80, sodium: 1180, total_carbohydrates: 48, dietary_fiber: 4, total_sugars: 4, protein: 30, ingredients_text: "flour tortillas (wheat), grilled chicken, knockout sauce, cheese (milk), pickled onion, cilantro" },
    { name: "Mexican Street Corn", category: "Sides", serving_size: 160, serving_unit: "g", calories: 280, total_fat: 16, saturated_fat: 5, trans_fat: 0, cholesterol: 20, sodium: 420, total_carbohydrates: 30, dietary_fiber: 3, total_sugars: 6, protein: 8, ingredients_text: "corn, cotija cheese (milk), mayo (soybean oil, egg), chili powder, lime, cilantro" },
  ],
};

const dairyQueen: ChainData = {
  chain: "Dairy Queen",
  items: [
    { name: "Blizzard Oreo Medium", category: "Ice Cream", serving_size: 382, serving_unit: "g", calories: 790, total_fat: 30, saturated_fat: 16, trans_fat: 0.5, cholesterol: 55, sodium: 480, total_carbohydrates: 119, dietary_fiber: 1, total_sugars: 92, protein: 15, ingredients_text: "vanilla soft serve (milk, sugar, cream, corn syrup), oreo cookie pieces (wheat flour, sugar, palm oil, cocoa), whipped topping" },
    { name: "Dilly Bar", category: "Ice Cream", serving_size: 85, serving_unit: "g", calories: 220, total_fat: 13, saturated_fat: 8, trans_fat: 0, cholesterol: 15, sodium: 70, total_carbohydrates: 24, dietary_fiber: 1, total_sugars: 18, protein: 3, ingredients_text: "vanilla ice cream (milk, sugar, cream), chocolate coating (cocoa butter, cocoa, milk, sugar)" },
    { name: "Buster Bar", category: "Ice Cream", serving_size: 149, serving_unit: "g", calories: 450, total_fat: 28, saturated_fat: 14, trans_fat: 0, cholesterol: 20, sodium: 220, total_carbohydrates: 44, dietary_fiber: 2, total_sugars: 34, protein: 10, ingredients_text: "vanilla soft serve (milk, sugar, cream), peanuts, fudge (cocoa, sugar, milk, cream), chocolate coating" },
    { name: "MooLatte", category: "Beverages", serving_size: 473, serving_unit: "ml", calories: 590, total_fat: 22, saturated_fat: 14, trans_fat: 0.5, cholesterol: 55, sodium: 250, total_carbohydrates: 88, dietary_fiber: 0, total_sugars: 76, protein: 11, ingredients_text: "vanilla soft serve (milk, sugar, cream), coffee concentrate, whipped topping (cream, sugar)" },
    { name: "Peanut Buster Parfait", category: "Ice Cream", serving_size: 305, serving_unit: "g", calories: 730, total_fat: 34, saturated_fat: 17, trans_fat: 0.5, cholesterol: 35, sodium: 350, total_carbohydrates: 94, dietary_fiber: 3, total_sugars: 74, protein: 16, ingredients_text: "vanilla soft serve (milk, sugar, cream), peanuts, hot fudge (cocoa, sugar, milk, cream)" },
    { name: "Banana Split", category: "Ice Cream", serving_size: 369, serving_unit: "g", calories: 520, total_fat: 14, saturated_fat: 9, trans_fat: 0, cholesterol: 30, sodium: 170, total_carbohydrates: 92, dietary_fiber: 3, total_sugars: 72, protein: 9, ingredients_text: "vanilla soft serve (milk, sugar, cream), banana, strawberry topping, pineapple topping, chocolate topping (cocoa), whipped topping" },
    { name: "Original Cheeseburger", category: "Burgers", serving_size: 152, serving_unit: "g", calories: 370, total_fat: 18, saturated_fat: 8, trans_fat: 0.5, cholesterol: 55, sodium: 740, total_carbohydrates: 31, dietary_fiber: 1, total_sugars: 6, protein: 20, ingredients_text: "beef patty, enriched flour bun (wheat), american cheese (milk), ketchup, mustard, pickle" },
    { name: "GrillBurger Double", category: "Burgers", serving_size: 284, serving_unit: "g", calories: 740, total_fat: 44, saturated_fat: 18, trans_fat: 2, cholesterol: 150, sodium: 1260, total_carbohydrates: 38, dietary_fiber: 2, total_sugars: 9, protein: 48, ingredients_text: "beef patties, enriched flour bun (wheat), american cheese (milk), lettuce, tomato, pickle, ketchup, mustard, mayo (soybean oil, egg)" },
    { name: "Chicken Strip Basket", category: "Chicken", serving_size: 340, serving_unit: "g", calories: 1020, total_fat: 50, saturated_fat: 8, trans_fat: 0, cholesterol: 65, sodium: 2290, total_carbohydrates: 108, dietary_fiber: 5, total_sugars: 2, protein: 34, ingredients_text: "chicken strips (chicken breast, wheat flour, corn starch, salt, spices), fries (potatoes, vegetable oil), country gravy (milk, wheat flour)" },
    { name: "Onion Rings", category: "Sides", serving_size: 128, serving_unit: "g", calories: 360, total_fat: 16, saturated_fat: 2.5, trans_fat: 0, cholesterol: 0, sodium: 840, total_carbohydrates: 50, dietary_fiber: 2, total_sugars: 6, protein: 6, ingredients_text: "onion, enriched flour (wheat), corn starch, vegetable oil, salt, leavening" },
    { name: "Fries", category: "Sides", serving_size: 128, serving_unit: "g", calories: 350, total_fat: 15, saturated_fat: 2, trans_fat: 0, cholesterol: 0, sodium: 590, total_carbohydrates: 50, dietary_fiber: 4, total_sugars: 0, protein: 4, ingredients_text: "potatoes, vegetable oil (soybean, canola), salt" },
    { name: "Hot Dog", category: "Hot Dogs", serving_size: 99, serving_unit: "g", calories: 290, total_fat: 17, saturated_fat: 6, trans_fat: 0.5, cholesterol: 30, sodium: 780, total_carbohydrates: 22, dietary_fiber: 1, total_sugars: 4, protein: 10, ingredients_text: "hot dog (beef, pork, water, salt, corn syrup), enriched flour bun (wheat)" },
    { name: "Corn Dog", category: "Hot Dogs", serving_size: 110, serving_unit: "g", calories: 260, total_fat: 12, saturated_fat: 3, trans_fat: 0, cholesterol: 25, sodium: 640, total_carbohydrates: 28, dietary_fiber: 1, total_sugars: 8, protein: 8, ingredients_text: "hot dog (beef, pork), cornbread batter (corn flour, wheat flour, sugar, egg)" },
    { name: "Pretzel Sticks Cheese", category: "Sides", serving_size: 155, serving_unit: "g", calories: 480, total_fat: 18, saturated_fat: 8, trans_fat: 0, cholesterol: 25, sodium: 1320, total_carbohydrates: 66, dietary_fiber: 2, total_sugars: 6, protein: 12, ingredients_text: "pretzel sticks (wheat flour, salt, yeast), queso dip (milk, cheese (milk), peppers)" },
    { name: "Brownie Dough Blizzard Medium", category: "Ice Cream", serving_size: 382, serving_unit: "g", calories: 880, total_fat: 36, saturated_fat: 20, trans_fat: 1, cholesterol: 65, sodium: 420, total_carbohydrates: 126, dietary_fiber: 2, total_sugars: 100, protein: 14, ingredients_text: "vanilla soft serve (milk, sugar, cream, corn syrup), brownie dough pieces (wheat flour, sugar, butter, cocoa, eggs), fudge (cocoa, sugar)" },
  ],
};

const dutchBros: ChainData = {
  chain: "Dutch Bros",
  items: [
    { name: "Medium Rebel Energy", category: "Energy Drinks", serving_size: 473, serving_unit: "ml", calories: 250, total_fat: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 190, total_carbohydrates: 62, dietary_fiber: 0, total_sugars: 62, protein: 0, ingredients_text: "dutch bros rebel energy drink (carbonated water, sugar, citric acid, taurine, caffeine, sodium citrate, natural flavors)" },
    { name: "Caramelizer Iced", category: "Coffee", serving_size: 473, serving_unit: "ml", calories: 350, total_fat: 10, saturated_fat: 6, trans_fat: 0, cholesterol: 35, sodium: 180, total_carbohydrates: 56, dietary_fiber: 0, total_sugars: 54, protein: 6, ingredients_text: "espresso, half and half (milk, cream), caramel sauce (sugar, cream (milk), butter), ice" },
    { name: "Golden Eagle Iced", category: "Coffee", serving_size: 473, serving_unit: "ml", calories: 390, total_fat: 12, saturated_fat: 7, trans_fat: 0, cholesterol: 40, sodium: 200, total_carbohydrates: 62, dietary_fiber: 0, total_sugars: 60, protein: 6, ingredients_text: "espresso, half and half (milk, cream), vanilla syrup (sugar), caramel sauce (sugar, cream (milk), butter), ice" },
    { name: "Annihilator Iced", category: "Coffee", serving_size: 473, serving_unit: "ml", calories: 380, total_fat: 12, saturated_fat: 7, trans_fat: 0, cholesterol: 40, sodium: 190, total_carbohydrates: 60, dietary_fiber: 0, total_sugars: 58, protein: 6, ingredients_text: "espresso, half and half (milk, cream), chocolate macadamia nut syrup (sugar, cocoa), ice" },
    { name: "White Chocolate Mocha", category: "Coffee", serving_size: 473, serving_unit: "ml", calories: 420, total_fat: 14, saturated_fat: 8, trans_fat: 0, cholesterol: 45, sodium: 210, total_carbohydrates: 64, dietary_fiber: 0, total_sugars: 62, protein: 8, ingredients_text: "espresso, milk, white chocolate sauce (sugar, cocoa butter, milk), whipped cream (cream, sugar)" },
    { name: "Vanilla Latte", category: "Coffee", serving_size: 473, serving_unit: "ml", calories: 280, total_fat: 8, saturated_fat: 5, trans_fat: 0, cholesterol: 30, sodium: 160, total_carbohydrates: 44, dietary_fiber: 0, total_sugars: 42, protein: 8, ingredients_text: "espresso, milk, vanilla syrup (sugar, natural flavors)" },
    { name: "Blue Rebel", category: "Energy Drinks", serving_size: 473, serving_unit: "ml", calories: 240, total_fat: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 180, total_carbohydrates: 60, dietary_fiber: 0, total_sugars: 60, protein: 0, ingredients_text: "dutch bros blue rebel (carbonated water, sugar, citric acid, taurine, caffeine, blue 1, natural flavors)" },
    { name: "Dinosaur Egg Rebel", category: "Energy Drinks", serving_size: 473, serving_unit: "ml", calories: 290, total_fat: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 200, total_carbohydrates: 72, dietary_fiber: 0, total_sugars: 72, protein: 0, ingredients_text: "dutch bros rebel energy drink (carbonated water, sugar, citric acid, taurine, caffeine), passion fruit syrup, watermelon syrup" },
    { name: "Palm Beach Lemonade", category: "Lemonades", serving_size: 473, serving_unit: "ml", calories: 260, total_fat: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 20, total_carbohydrates: 66, dietary_fiber: 0, total_sugars: 64, protein: 0, ingredients_text: "lemonade (water, sugar, lemon juice), peach syrup, coconut syrup" },
    { name: "Iced Tea", category: "Tea", serving_size: 473, serving_unit: "ml", calories: 5, total_fat: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 10, total_carbohydrates: 1, dietary_fiber: 0, total_sugars: 0, protein: 0, ingredients_text: "brewed black tea, water, ice" },
    { name: "Hot Chocolate", category: "Hot Drinks", serving_size: 473, serving_unit: "ml", calories: 380, total_fat: 12, saturated_fat: 7, trans_fat: 0, cholesterol: 35, sodium: 240, total_carbohydrates: 58, dietary_fiber: 2, total_sugars: 52, protein: 10, ingredients_text: "milk, chocolate sauce (sugar, cocoa, cream (milk)), whipped cream (cream, sugar)" },
    { name: "Chai Latte", category: "Tea", serving_size: 473, serving_unit: "ml", calories: 310, total_fat: 8, saturated_fat: 5, trans_fat: 0, cholesterol: 30, sodium: 170, total_carbohydrates: 52, dietary_fiber: 0, total_sugars: 48, protein: 8, ingredients_text: "chai tea concentrate (water, sugar, black tea, spices, ginger), milk" },
    { name: "Cookie Dough Freeze", category: "Freezes", serving_size: 473, serving_unit: "ml", calories: 620, total_fat: 18, saturated_fat: 12, trans_fat: 0.5, cholesterol: 55, sodium: 310, total_carbohydrates: 102, dietary_fiber: 1, total_sugars: 90, protein: 10, ingredients_text: "vanilla ice cream (milk, sugar, cream), cookie dough pieces (wheat flour, sugar, butter, eggs, chocolate chips (cocoa, milk)), milk, whipped cream" },
    { name: "Mango Smoothie", category: "Smoothies", serving_size: 473, serving_unit: "ml", calories: 340, total_fat: 1, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 40, total_carbohydrates: 82, dietary_fiber: 3, total_sugars: 72, protein: 2, ingredients_text: "mango puree, mango syrup (sugar), ice, water" },
    { name: "Peach Rebel", category: "Energy Drinks", serving_size: 473, serving_unit: "ml", calories: 270, total_fat: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 190, total_carbohydrates: 68, dietary_fiber: 0, total_sugars: 68, protein: 0, ingredients_text: "dutch bros rebel energy drink (carbonated water, sugar, citric acid, taurine, caffeine), peach syrup" },
  ],
};

// --- All chains ---

const allChains: ChainData[] = [
  smoothieKing,
  jambaJuice,
  tropicalSmoothie,
  jerseyMikes,
  jimmyJohns,
  firehouseSubs,
  noodlesAndCompany,
  qdoba,
  dairyQueen,
  dutchBros,
];

// --- DB statements ---

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

function buildFoodRecord(item: ChainMenuItem, chainName: string, vendorId: string) {
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

function main() {
  console.log("=== Restaurant Chain Nutrition Import - Batch 4 ===\n");

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
