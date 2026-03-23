/**
 * Migration script: Add glycemic_index and glycemic_load columns to the foods table,
 * then populate GI values using a comprehensive lookup table of known GI values.
 *
 * GI values sourced from the University of Sydney International GI Database
 * and peer-reviewed publications.
 *
 * Glycemic Index (GI): 0-100 scale measuring how quickly a food raises blood sugar
 *   - Low: ≤55, Medium: 56-69, High: ≥70
 *
 * Glycemic Load (GL): GI × carbs per serving / 100 — accounts for portion size
 *   - Low: ≤10, Medium: 11-19, High: ≥20
 *
 * Usage: npx ts-node scripts/add-glycemic.ts
 */

import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "../culture.db");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

const BATCH_SIZE = 5000;

// --- Comprehensive GI lookup table ---
// Pattern → GI value. Patterns are matched against lowercased food names.
// Order matters: more specific patterns should come first.

const GI_LOOKUP: [string, number][] = [
  // === ZERO-CARB / ZERO-GI FOODS ===
  // Meats
  ["beef jerky", 25], // has some carbs from marinades
  ["beef", 0],
  ["steak", 0],
  ["ground beef", 0],
  ["hamburger patty", 0],
  ["veal", 0],
  ["lamb", 0],
  ["pork chop", 0],
  ["pork loin", 0],
  ["pork tenderloin", 0],
  ["pork belly", 0],
  ["pork", 0],
  ["bacon", 0],
  ["ham", 0],
  ["prosciutto", 0],
  ["salami", 0],
  ["pepperoni", 0],
  ["sausage", 0],
  ["bratwurst", 0],
  ["hot dog", 0],
  ["bison", 0],
  ["venison", 0],
  ["elk", 0],
  ["duck", 0],
  ["goose", 0],
  ["rabbit", 0],
  ["organ meat", 0],
  ["liver", 0],
  ["kidney", 0],

  // Poultry
  ["chicken breast", 0],
  ["chicken thigh", 0],
  ["chicken wing", 0],
  ["chicken drumstick", 0],
  ["chicken leg", 0],
  ["chicken", 0],
  ["turkey breast", 0],
  ["turkey", 0],
  ["poultry", 0],

  // Fish & Seafood
  ["salmon", 0],
  ["tuna", 0],
  ["cod", 0],
  ["tilapia", 0],
  ["halibut", 0],
  ["mahi mahi", 0],
  ["swordfish", 0],
  ["trout", 0],
  ["sardine", 0],
  ["anchovy", 0],
  ["mackerel", 0],
  ["herring", 0],
  ["bass", 0],
  ["catfish", 0],
  ["snapper", 0],
  ["grouper", 0],
  ["flounder", 0],
  ["sole", 0],
  ["perch", 0],
  ["pollock", 0],
  ["haddock", 0],
  ["fish", 0],
  ["shrimp", 0],
  ["prawn", 0],
  ["lobster", 0],
  ["crab", 0],
  ["scallop", 0],
  ["mussel", 0],
  ["clam", 0],
  ["oyster", 0],
  ["squid", 0],
  ["calamari", 0],
  ["octopus", 0],
  ["seafood", 0],
  ["shellfish", 0],

  // Eggs
  ["egg white", 0],
  ["egg yolk", 0],
  ["egg", 0],

  // Oils & Fats
  ["olive oil", 0],
  ["coconut oil", 0],
  ["avocado oil", 0],
  ["canola oil", 0],
  ["vegetable oil", 0],
  ["sunflower oil", 0],
  ["sesame oil", 0],
  ["peanut oil", 0],
  ["flaxseed oil", 0],
  ["walnut oil", 0],
  ["corn oil", 0],
  ["soybean oil", 0],
  ["palm oil", 0],
  ["grapeseed oil", 0],
  ["oil", 0],
  ["butter", 0],
  ["ghee", 0],
  ["lard", 0],
  ["tallow", 0],
  ["margarine", 0],
  ["shortening", 0],

  // Cheese (0 GI - negligible carbs)
  ["cream cheese", 0],
  ["cottage cheese", 0],
  ["cheddar cheese", 0],
  ["mozzarella cheese", 0],
  ["parmesan cheese", 0],
  ["swiss cheese", 0],
  ["brie cheese", 0],
  ["gouda cheese", 0],
  ["feta cheese", 0],
  ["blue cheese", 0],
  ["provolone cheese", 0],
  ["goat cheese", 0],
  ["ricotta cheese", 0],
  ["cheese", 0],

  // Herbs, Spices, Condiments (negligible carbs)
  ["salt", 0],
  ["pepper", 0],
  ["cinnamon", 0],
  ["turmeric", 0],
  ["cumin", 0],
  ["paprika", 0],
  ["oregano", 0],
  ["basil", 0],
  ["thyme", 0],
  ["rosemary", 0],
  ["garlic powder", 0],
  ["onion powder", 0],
  ["chili powder", 0],
  ["mustard", 0],
  ["vinegar", 0],
  ["soy sauce", 0],
  ["hot sauce", 0],
  ["worcestershire", 0],
  ["fish sauce", 0],

  // === GRAINS & CEREALS ===
  ["instant rice", 87],
  ["jasmine rice", 89],
  ["sticky rice", 87],
  ["glutinous rice", 87],
  ["white rice", 73],
  ["basmati rice", 58],
  ["brown rice", 68],
  ["wild rice", 57],
  ["rice pilaf", 65],
  ["fried rice", 73],
  ["rice pudding", 46],
  ["rice noodle", 53],
  ["rice cake", 87],
  ["rice cracker", 87],
  ["rice cereal", 82],
  ["rice flour", 95],
  ["rice milk", 86],
  ["puffed rice", 82],
  ["rice", 73],

  ["white bread", 75],
  ["whole wheat bread", 74],
  ["whole grain bread", 74],
  ["multigrain bread", 53],
  ["rye bread", 58],
  ["pumpernickel bread", 50],
  ["sourdough bread", 54],
  ["pita bread", 68],
  ["naan bread", 71],
  ["naan", 71],
  ["ciabatta", 73],
  ["baguette", 75],
  ["focaccia", 63],
  ["flatbread", 68],
  ["cornbread", 65],
  ["banana bread", 47],
  ["garlic bread", 73],
  ["bread roll", 73],
  ["bread stick", 68],
  ["bread", 75],

  ["instant oatmeal", 79],
  ["steel cut oat", 52],
  ["rolled oat", 55],
  ["oat bran", 55],
  ["oatmeal cookie", 55],
  ["oatmeal", 55],
  ["oat", 55],
  ["granola bar", 61],
  ["granola", 55],
  ["muesli", 57],

  ["spaghetti", 49],
  ["fettuccine", 40],
  ["linguine", 46],
  ["macaroni", 47],
  ["penne", 50],
  ["lasagna", 47],
  ["ravioli", 39],
  ["tortellini", 50],
  ["gnocchi", 68],
  ["egg noodle", 40],
  ["udon noodle", 55],
  ["soba noodle", 46],
  ["ramen noodle", 52],
  ["ramen", 52],
  ["pasta", 49],
  ["noodle", 47],
  ["macaroni and cheese", 64],
  ["mac and cheese", 64],

  ["quinoa", 53],
  ["couscous", 65],
  ["bulgur", 48],
  ["barley", 28],
  ["pearl barley", 28],
  ["buckwheat", 54],
  ["millet", 71],
  ["amaranth", 97],
  ["teff", 57],
  ["farro", 40],
  ["spelt", 55],
  ["polenta", 68],
  ["grits", 69],
  ["cream of wheat", 66],
  ["semolina", 66],

  ["flour tortilla", 30],
  ["corn tortilla", 52],
  ["tortilla chip", 63],
  ["tortilla", 30],
  ["taco shell", 68],

  // === BREAKFAST CEREALS ===
  ["cornflakes", 81],
  ["corn flakes", 81],
  ["bran flakes", 74],
  ["special k", 69],
  ["cheerios", 74],
  ["fruit loops", 69],
  ["frosted flakes", 55],
  ["grape nuts", 75],
  ["shredded wheat", 75],
  ["wheat biscuit", 70],
  ["all-bran", 38],
  ["all bran", 38],
  ["rice krispies", 82],
  ["rice chex", 82],
  ["coco pops", 77],
  ["cocoa puffs", 77],
  ["lucky charms", 73],
  ["cinnamon toast crunch", 75],
  ["life cereal", 66],
  ["total cereal", 76],
  ["wheaties", 75],
  ["raisin bran", 61],
  ["honey nut cheerios", 74],
  ["frosted mini wheats", 58],
  ["cereal bar", 65],
  ["cereal", 72],

  // === FRUITS ===
  ["green apple", 38],
  ["apple juice", 41],
  ["apple sauce", 35],
  ["apple pie", 44],
  ["dried apple", 29],
  ["apple", 36],

  ["banana chip", 55],
  ["banana bread", 47],
  ["green banana", 30],
  ["ripe banana", 62],
  ["banana", 51],

  ["orange juice", 50],
  ["mandarin orange", 47],
  ["blood orange", 43],
  ["orange", 43],
  ["tangerine", 47],
  ["clementine", 47],
  ["mandarin", 47],

  ["watermelon", 76],
  ["cantaloupe", 65],
  ["honeydew", 62],
  ["melon", 65],

  ["grape juice", 48],
  ["raisin", 64],
  ["grape", 46],

  ["mango", 51],
  ["papaya", 59],
  ["guava", 78],
  ["passion fruit", 30],
  ["dragon fruit", 48],
  ["star fruit", 45],
  ["jackfruit", 50],
  ["durian", 49],
  ["lychee", 57],
  ["longan", 57],
  ["persimmon", 50],

  ["pineapple juice", 46],
  ["pineapple", 59],

  ["date", 42],
  ["fig", 61],
  ["prune", 29],
  ["dried fruit", 60],
  ["dried cranberry", 62],
  ["dried mango", 60],
  ["dried apricot", 30],
  ["raisin", 64],

  ["strawberry jam", 51],
  ["strawberry", 41],
  ["blueberry", 53],
  ["raspberry", 32],
  ["blackberry", 25],
  ["cranberry", 45],
  ["cherry", 22],
  ["acai", 10],
  ["goji berr", 29],
  ["berry mix", 40],
  ["mixed berr", 40],
  ["berr", 40],

  ["peach", 42],
  ["nectarine", 43],
  ["plum", 39],
  ["apricot", 34],
  ["pear", 38],
  ["kiwi", 50],
  ["pomegranate", 53],
  ["coconut", 45],
  ["coconut water", 55],
  ["coconut milk", 41],
  ["avocado", 15],
  ["olive", 15],
  ["lemon", 20],
  ["lime", 20],
  ["grapefruit", 25],
  ["tomato sauce", 45],
  ["tomato paste", 38],
  ["tomato soup", 38],
  ["tomato juice", 38],
  ["tomato", 15],

  // === VEGETABLES ===
  ["baked potato", 85],
  ["mashed potato", 83],
  ["french fries", 75],
  ["french fry", 75],
  ["fries", 75],
  ["hash brown", 75],
  ["potato chip", 56],
  ["potato salad", 63],
  ["sweet potato fries", 70],
  ["sweet potato", 63],
  ["yam", 51],
  ["potato wedge", 75],
  ["potato", 78],

  ["carrot juice", 43],
  ["carrot", 39],
  ["beetroot", 64],
  ["beet", 64],
  ["turnip", 72],
  ["parsnip", 97],
  ["rutabaga", 72],

  ["corn on the cob", 48],
  ["sweet corn", 52],
  ["corn chip", 63],
  ["popcorn", 65],
  ["corn", 52],

  ["green pea", 48],
  ["split pea", 32],
  ["snow pea", 48],
  ["pea soup", 66],
  ["pea", 48],

  ["butternut squash", 51],
  ["acorn squash", 75],
  ["spaghetti squash", 42],
  ["pumpkin pie", 44],
  ["pumpkin", 75],
  ["squash", 51],
  ["zucchini", 15],

  ["plantain", 55],
  ["taro", 55],
  ["cassava", 46],
  ["tapioca", 70],
  ["breadfruit", 68],

  // Low GI vegetables (non-starchy)
  ["broccoli", 10],
  ["cauliflower", 10],
  ["brussels sprout", 15],
  ["cabbage", 10],
  ["kale", 10],
  ["spinach", 15],
  ["lettuce", 10],
  ["arugula", 10],
  ["watercress", 10],
  ["chard", 10],
  ["collard", 10],
  ["asparagus", 15],
  ["green bean", 15],
  ["string bean", 15],
  ["snap pea", 15],
  ["celery", 10],
  ["cucumber", 15],
  ["bell pepper", 15],
  ["jalapeno", 15],
  ["pepper", 15],
  ["onion", 10],
  ["garlic", 10],
  ["leek", 15],
  ["shallot", 10],
  ["scallion", 10],
  ["green onion", 10],
  ["mushroom", 10],
  ["eggplant", 15],
  ["artichoke", 15],
  ["okra", 20],
  ["radish", 10],
  ["jicama", 10],
  ["bamboo shoot", 10],
  ["bean sprout", 25],
  ["bok choy", 10],
  ["seaweed", 10],
  ["nori", 10],
  ["kelp", 10],

  // === LEGUMES ===
  ["lentil soup", 44],
  ["red lentil", 26],
  ["green lentil", 30],
  ["lentil", 32],
  ["chickpea", 28],
  ["hummus", 6],
  ["falafel", 32],
  ["kidney bean", 24],
  ["red kidney bean", 24],
  ["black bean", 30],
  ["navy bean", 38],
  ["pinto bean", 39],
  ["lima bean", 32],
  ["butter bean", 31],
  ["cannellini bean", 31],
  ["white bean", 31],
  ["great northern bean", 31],
  ["mung bean", 31],
  ["adzuki bean", 35],
  ["black eyed pea", 42],
  ["edamame", 15],
  ["soybean", 16],
  ["soy milk", 34],
  ["tofu", 15],
  ["tempeh", 15],
  ["baked bean", 48],
  ["refried bean", 38],
  ["bean", 30],

  // === DAIRY & DAIRY ALTERNATIVES ===
  ["whole milk", 39],
  ["skim milk", 37],
  ["2% milk", 37],
  ["1% milk", 37],
  ["chocolate milk", 42],
  ["condensed milk", 61],
  ["evaporated milk", 50],
  ["milk", 39],

  ["greek yogurt", 11],
  ["plain yogurt", 36],
  ["fruit yogurt", 41],
  ["frozen yogurt", 35],
  ["yogurt", 36],
  ["yoghurt", 36],
  ["kefir", 36],

  ["ice cream", 51],
  ["gelato", 57],
  ["sorbet", 65],
  ["frozen dessert", 57],
  ["custard", 43],
  ["pudding", 44],
  ["mousse", 36],

  ["almond milk", 25],
  ["oat milk", 69],
  ["soy milk", 34],
  ["rice milk", 86],
  ["cashew milk", 25],
  ["hemp milk", 25],

  ["whipped cream", 0],
  ["heavy cream", 0],
  ["half and half", 0],
  ["sour cream", 0],
  ["cream", 0],

  // === NUTS & SEEDS ===
  ["peanut butter", 14],
  ["almond butter", 10],
  ["cashew butter", 25],
  ["sunflower seed butter", 35],
  ["peanut", 14],
  ["almond", 10],
  ["cashew", 22],
  ["walnut", 15],
  ["pecan", 10],
  ["pistachio", 15],
  ["macadamia", 10],
  ["brazil nut", 10],
  ["hazelnut", 15],
  ["chestnut", 60],
  ["pine nut", 15],
  ["nut mix", 15],
  ["mixed nut", 15],
  ["trail mix", 38],
  ["sunflower seed", 35],
  ["pumpkin seed", 25],
  ["flaxseed", 0],
  ["chia seed", 1],
  ["hemp seed", 0],
  ["sesame seed", 35],
  ["poppy seed", 35],
  ["tahini", 40],

  // === SUGARS & SWEETENERS ===
  ["glucose", 100],
  ["dextrose", 100],
  ["maltose", 105],
  ["sucrose", 65],
  ["fructose", 15],
  ["lactose", 46],
  ["corn syrup", 90],
  ["high fructose corn syrup", 87],
  ["agave nectar", 15],
  ["agave", 15],
  ["honey", 61],
  ["maple syrup", 54],
  ["molasses", 55],
  ["brown sugar", 65],
  ["white sugar", 65],
  ["powdered sugar", 65],
  ["sugar", 65],
  ["stevia", 0],
  ["monk fruit", 0],
  ["erythritol", 0],
  ["xylitol", 7],
  ["sorbitol", 9],
  ["maltitol", 36],
  ["aspartame", 0],
  ["sucralose", 0],
  ["saccharin", 0],

  // === SNACKS & PROCESSED FOODS ===
  ["pretzel", 83],
  ["rice cake", 87],
  ["rice cracker", 87],
  ["cracker", 70],
  ["water cracker", 78],
  ["graham cracker", 74],
  ["saltine", 74],
  ["breadstick", 68],
  ["croissant", 67],
  ["muffin", 60],
  ["bagel", 72],
  ["english muffin", 77],
  ["scone", 66],
  ["donut", 76],
  ["doughnut", 76],
  ["danish", 59],
  ["pastry", 59],
  ["waffle", 76],
  ["pancake", 67],
  ["crepe", 66],
  ["french toast", 59],

  ["dark chocolate", 23],
  ["milk chocolate", 43],
  ["white chocolate", 44],
  ["chocolate bar", 40],
  ["chocolate cake", 38],
  ["chocolate chip cookie", 44],
  ["chocolate", 40],

  ["gummy bear", 78],
  ["jelly bean", 78],
  ["licorice", 78],
  ["marshmallow", 62],
  ["hard candy", 70],
  ["caramel", 60],
  ["toffee", 65],
  ["candy bar", 55],
  ["candy", 70],
  ["skittles", 70],

  ["potato chip", 56],
  ["tortilla chip", 63],
  ["corn chip", 63],
  ["chip", 56],
  ["nacho", 63],

  ["cookie", 55],
  ["biscuit", 69],
  ["brownie", 42],
  ["cake", 46],
  ["pie crust", 59],
  ["pie", 44],
  ["cheesecake", 35],
  ["tiramisu", 42],

  ["pizza", 60],
  ["pepperoni pizza", 60],
  ["cheese pizza", 60],

  ["burger bun", 61],
  ["hamburger", 66],
  ["cheeseburger", 66],

  ["fried chicken", 46],
  ["chicken nugget", 46],
  ["fish stick", 38],

  ["energy bar", 56],
  ["protein bar", 38],
  ["granola bar", 61],
  ["power bar", 56],
  ["clif bar", 56],
  ["kind bar", 42],

  // === DRINKS ===
  ["cola", 63],
  ["coca-cola", 63],
  ["pepsi", 63],
  ["sprite", 63],
  ["fanta", 68],
  ["mountain dew", 63],
  ["dr pepper", 63],
  ["7up", 63],
  ["root beer", 63],
  ["ginger ale", 63],
  ["cream soda", 63],
  ["soda", 63],
  ["soft drink", 63],
  ["tonic water", 63],
  ["lemonade", 54],

  ["orange juice", 50],
  ["apple juice", 41],
  ["grape juice", 48],
  ["cranberry juice", 52],
  ["pineapple juice", 46],
  ["grapefruit juice", 48],
  ["tomato juice", 38],
  ["carrot juice", 43],
  ["vegetable juice", 43],
  ["fruit juice", 50],
  ["juice", 50],
  ["smoothie", 44],

  ["gatorade", 78],
  ["powerade", 78],
  ["sports drink", 78],
  ["energy drink", 70],
  ["red bull", 70],
  ["monster energy", 70],

  ["beer", 66],
  ["wine", 0],
  ["spirits", 0],
  ["vodka", 0],
  ["whiskey", 0],
  ["gin", 0],
  ["rum", 0],
  ["tequila", 0],
  ["brandy", 0],
  ["champagne", 0],

  ["coffee", 0],
  ["tea", 0],
  ["green tea", 0],
  ["black tea", 0],
  ["herbal tea", 0],
  ["matcha", 0],
  ["espresso", 0],
  ["americano", 0],
  ["latte", 37],
  ["cappuccino", 37],
  ["mocha", 42],
  ["frappuccino", 55],
  ["hot chocolate", 51],
  ["cocoa", 51],

  // === CONDIMENTS & SAUCES ===
  ["ketchup", 55],
  ["barbecue sauce", 55],
  ["bbq sauce", 55],
  ["teriyaki sauce", 55],
  ["hoisin sauce", 55],
  ["sweet chili sauce", 55],
  ["maple syrup", 54],
  ["honey mustard", 55],
  ["ranch dressing", 0],
  ["caesar dressing", 0],
  ["italian dressing", 0],
  ["balsamic vinegar", 0],
  ["mayonnaise", 0],
  ["mayo", 0],
  ["guacamole", 15],
  ["salsa", 15],
  ["pesto", 15],
  ["marinara sauce", 45],
  ["alfredo sauce", 15],
  ["soy sauce", 0],
  ["oyster sauce", 35],
  ["sriracha", 35],
  ["tabasco", 0],
  ["relish", 40],
  ["chutney", 50],
  ["jam", 51],
  ["jelly", 51],
  ["marmalade", 51],
  ["nutella", 33],
  ["peanut butter", 14],

  // === PREPARED / MIXED DISHES ===
  ["sushi", 50],
  ["burrito", 39],
  ["taco", 68],
  ["quesadilla", 45],
  ["enchilada", 42],
  ["tamale", 52],
  ["pad thai", 46],
  ["stir fry", 45],
  ["curry", 45],
  ["dal", 32],
  ["dhal", 32],
  ["biryani", 65],
  ["risotto", 69],
  ["paella", 65],
  ["couscous salad", 65],
  ["tabouleh", 48],
  ["tabbouleh", 48],
  ["fried rice", 73],
  ["pilaf", 65],
  ["chili con carne", 30],
  ["chili", 30],
  ["soup", 48],
  ["minestrone", 39],
  ["chicken soup", 38],
  ["tomato soup", 38],
  ["clam chowder", 66],
  ["chowder", 66],
  ["stew", 45],
  ["casserole", 46],
  ["pot pie", 50],
  ["sandwich", 55],
  ["wrap", 30],
  ["sub", 55],
  ["panini", 55],
  ["salad", 15],
  ["coleslaw", 15],
  ["macaroni salad", 47],

  // === BAKING INGREDIENTS ===
  ["all purpose flour", 85],
  ["whole wheat flour", 69],
  ["almond flour", 10],
  ["coconut flour", 45],
  ["oat flour", 55],
  ["rice flour", 95],
  ["cornstarch", 85],
  ["cornmeal", 69],
  ["flour", 85],
  ["baking powder", 0],
  ["baking soda", 0],
  ["yeast", 0],
  ["cocoa powder", 15],
  ["vanilla extract", 0],
  ["vanilla", 0],

  // === INFANT / SPECIALTY ===
  ["infant formula", 35],
  ["baby food", 40],
  ["meal replacement", 40],
  ["protein shake", 30],
  ["protein powder", 30],
  ["whey protein", 30],
  ["casein protein", 30],
];

function addColumnsIfNeeded() {
  const columns = db.prepare("PRAGMA table_info(foods)").all() as any[];
  const columnNames = columns.map((c: any) => c.name);

  if (!columnNames.includes("glycemic_index")) {
    console.log("Adding glycemic_index column...");
    db.exec("ALTER TABLE foods ADD COLUMN glycemic_index INTEGER");
  } else {
    console.log("glycemic_index column already exists.");
  }

  if (!columnNames.includes("glycemic_load")) {
    console.log("Adding glycemic_load column...");
    db.exec("ALTER TABLE foods ADD COLUMN glycemic_load REAL");
  } else {
    console.log("glycemic_load column already exists.");
  }
}

function lookupGI(foodName: string): number | null {
  const lower = foodName.toLowerCase();

  for (const [pattern, gi] of GI_LOOKUP) {
    if (lower.includes(pattern)) {
      return gi;
    }
  }

  return null;
}

function calculateGL(gi: number, totalCarbsPerHundredG: number, servingSizeG: number): number {
  // GL = GI × carbs_in_serving / 100
  // carbs_in_serving = totalCarbsPerHundredG * servingSizeG / 100
  const carbsInServing = totalCarbsPerHundredG * servingSizeG / 100;
  return Math.round((gi * carbsInServing / 100) * 10) / 10;
}

function populateGlycemicData() {
  const total = (db.prepare("SELECT COUNT(*) as count FROM foods").get() as any).count;
  console.log(`\nProcessing ${total} foods in batches of ${BATCH_SIZE}...`);

  const updateStmt = db.prepare(
    "UPDATE foods SET glycemic_index = ?, glycemic_load = ? WHERE id = ?"
  );

  const updateBatch = db.transaction((updates: { id: string; gi: number; gl: number }[]) => {
    for (const u of updates) {
      updateStmt.run(u.gi, u.gl, u.id);
    }
  });

  let processed = 0;
  let matched = 0;
  let zeroCarb = 0;
  let unmatched = 0;
  const giDistribution = { low: 0, medium: 0, high: 0, zero: 0 };

  while (processed < total) {
    const foods = db.prepare(
      "SELECT id, name, total_carbohydrates, serving_size, serving_unit, category FROM foods LIMIT ? OFFSET ?"
    ).all(BATCH_SIZE, processed) as any[];

    if (foods.length === 0) break;

    const updates: { id: string; gi: number; gl: number }[] = [];

    for (const food of foods) {
      const carbs = food.total_carbohydrates || 0;
      const servingSize = food.serving_size || 100;

      // Foods with zero carbs get GI=0, GL=0
      if (carbs === 0) {
        updates.push({ id: food.id, gi: 0, gl: 0 });
        zeroCarb++;
        giDistribution.zero++;
        continue;
      }

      const gi = lookupGI(food.name);

      if (gi !== null) {
        const gl = calculateGL(gi, carbs, servingSize);
        updates.push({ id: food.id, gi, gl });
        matched++;

        if (gi === 0) giDistribution.zero++;
        else if (gi <= 55) giDistribution.low++;
        else if (gi <= 69) giDistribution.medium++;
        else giDistribution.high++;
      } else {
        unmatched++;
        // Leave as NULL for unmatched foods with carbs
      }
    }

    if (updates.length > 0) {
      updateBatch(updates);
    }

    processed += foods.length;
    const pct = Math.round(processed / total * 100);
    process.stdout.write(`\r  Processed ${processed}/${total} (${pct}%)`);
  }

  console.log("\n");
  console.log(`Results:`);
  console.log(`  Matched by name pattern: ${matched}`);
  console.log(`  Zero-carb (auto GI=0):   ${zeroCarb}`);
  console.log(`  Unmatched (left NULL):    ${unmatched}`);
  console.log(`  Total processed:          ${processed}`);
  console.log(`\nGI Distribution (of assigned values):`);
  console.log(`  Zero GI (0):     ${giDistribution.zero}`);
  console.log(`  Low (1-55):      ${giDistribution.low}`);
  console.log(`  Medium (56-69):  ${giDistribution.medium}`);
  console.log(`  High (70+):      ${giDistribution.high}`);
}

// Run
console.log("=== Glycemic Index Migration ===\n");
addColumnsIfNeeded();
populateGlycemicData();
console.log("\nDone.");

db.close();
