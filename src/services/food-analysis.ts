/**
 * Allergen detection and dietary tag inference from ingredient text and nutrition data.
 */

const ALLERGEN_PATTERNS: Record<string, RegExp> = {
  milk: /\b(milk|cream|butter|cheese|whey|casein|lactose|ghee|curds|half-and-half|half and half)\b/i,
  eggs: /\b(egg|eggs|albumin|egg white|egg yolk|meringue|mayonnaise)\b/i,
  fish: /\b(fish|salmon|tuna|cod|tilapia|anchov|sardine|bass|trout|mackerel|halibut|haddock|catfish|pollock|mahi|swordfish|herring)\b/i,
  shellfish: /\b(shrimp|crab|lobster|crawfish|crayfish|prawn|scallop|clam|mussel|oyster|squid|calamari)\b/i,
  tree_nuts: /\b(almond|walnut|cashew|pecan|pistachio|macadamia|hazelnut|filbert|brazil nut|chestnut|pine nut)\b/i,
  peanuts: /\b(peanut|peanuts|groundnut)\b/i,
  wheat: /\b(wheat|flour|gluten|durum|semolina|spelt|farina|kamut|einkorn|breadcrumb|couscous)\b/i,
  soy: /\b(soy|soybean|soybeans|soya|tofu|tempeh|edamame|miso|soy lecithin|soy sauce)\b/i,
  sesame: /\b(sesame|tahini)\b/i,
};

const MEAT_PATTERN = /\b(beef|pork|chicken|turkey|lamb|veal|venison|bison|duck|goose|bacon|ham|sausage|salami|pepperoni|prosciutto|chorizo|meat|lard|tallow|gelatin|suet)\b/i;
const FISH_OR_SHELLFISH_PATTERN = /\b(fish|salmon|tuna|cod|tilapia|anchov|sardine|bass|trout|mackerel|halibut|haddock|catfish|pollock|mahi|swordfish|herring|shrimp|crab|lobster|crawfish|crayfish|prawn|scallop|clam|mussel|oyster|squid|calamari)\b/i;
const ANIMAL_PRODUCT_PATTERN = /\b(milk|cream|butter|cheese|whey|casein|lactose|ghee|egg|eggs|albumin|honey|beeswax|gelatin|lard|tallow|suet)\b/i;
const GLUTEN_PATTERN = /\b(wheat|gluten|barley|rye|malt|triticale|durum|semolina|spelt|farina|kamut|einkorn|couscous|seitan)\b/i;
const PORK_ALCOHOL_PATTERN = /\b(pork|ham|bacon|lard|gelatin|alcohol|wine|beer|rum|liquor|ethanol)\b/i;

export function detectAllergens(ingredientsText: string): string[] {
  if (!ingredientsText) return [];

  const found: string[] = [];
  for (const [allergen, pattern] of Object.entries(ALLERGEN_PATTERNS)) {
    if (pattern.test(ingredientsText)) {
      found.push(allergen);
    }
  }
  return found;
}

export function detectDietaryTags(
  ingredientsText: string,
  nutrition?: { total_carbohydrates?: number; protein?: number; total_fat?: number; total_sugars?: number; dietary_fiber?: number }
): string[] {
  const tags: string[] = [];
  const text = ingredientsText || "";
  const hasIngredients = text.length > 0;

  if (hasIngredients) {
    const hasMeat = MEAT_PATTERN.test(text);
    const hasFishShellfish = FISH_OR_SHELLFISH_PATTERN.test(text);
    const hasAnimalProduct = ANIMAL_PRODUCT_PATTERN.test(text);

    // vegan = no animal products at all
    if (!hasMeat && !hasFishShellfish && !hasAnimalProduct) {
      tags.push("vegan");
    }

    // vegetarian = no meat/fish (dairy/eggs ok)
    if (!hasMeat && !hasFishShellfish) {
      tags.push("vegetarian");
    }

    // gluten_free = no wheat/gluten/barley/rye
    if (!GLUTEN_PATTERN.test(text)) {
      tags.push("gluten_free");
    }

    // dairy_free = no milk allergens
    if (!ALLERGEN_PATTERNS.milk.test(text)) {
      tags.push("dairy_free");
    }

    // halal = no pork or alcohol
    if (!PORK_ALCOHOL_PATTERN.test(text)) {
      tags.push("halal");
    }

    // kosher = no pork/shellfish, simplified check
    const hasShellfish = ALLERGEN_PATTERNS.shellfish.test(text);
    const hasPork = /\b(pork|ham|bacon|lard)\b/i.test(text);
    if (!hasPork && !hasShellfish) {
      tags.push("kosher");
    }
  }

  // Nutrition-based tags (per 100g serving assumption)
  if (nutrition) {
    const carbs = nutrition.total_carbohydrates ?? 0;
    const fat = nutrition.total_fat ?? 0;
    const sugars = nutrition.total_sugars ?? 0;
    const fiber = nutrition.dietary_fiber ?? 0;

    // keto = carbs < 10g per 100g
    if (carbs < 10) {
      tags.push("keto");
    }

    // paleo = no grains, no dairy, no legumes, low sugar, moderate approach:
    // approximate as gluten_free + dairy_free + low sugar
    if (hasIngredients) {
      const hasGrains = /\b(wheat|corn|rice|oat|barley|rye|grain|cereal)\b/i.test(text);
      const hasDairy = ALLERGEN_PATTERNS.milk.test(text);
      const hasLegumes = /\b(soy|soybean|bean|lentil|chickpea|peanut)\b/i.test(text);
      if (!hasGrains && !hasDairy && !hasLegumes && sugars < 15) {
        tags.push("paleo");
      }
    }
  }

  return tags;
}
