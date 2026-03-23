import db from "../data/database";

// --- Levenshtein distance ---

export function levenshtein(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;

  // Use two rows instead of full matrix for memory efficiency
  let prev = new Array(lb + 1);
  let curr = new Array(lb + 1);

  for (let j = 0; j <= lb; j++) prev[j] = j;

  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,       // deletion
        curr[j - 1] + 1,   // insertion
        prev[j - 1] + cost  // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[lb];
}

// --- Abbreviation expansion ---

const ABBREVIATIONS: Record<string, string> = {
  "pb&j": "peanut butter and jelly",
  "pb & j": "peanut butter and jelly",
  "pbj": "peanut butter and jelly",
  "pb": "peanut butter",
  "oj": "orange juice",
  "aj": "apple juice",
  "mac": "macaroni",
  "mac n cheese": "macaroni and cheese",
  "mac & cheese": "macaroni and cheese",
  "bfast": "breakfast",
  "chx": "chicken",
  "chkn": "chicken",
  "broc": "broccoli",
  "vegs": "vegetables",
  "veggie": "vegetables",
  "veggies": "vegetables",
  "veg": "vegetables",
  "cuke": "cucumber",
  "cukes": "cucumbers",
  "avo": "avocado",
  "tater": "potato",
  "taters": "potatoes",
  "shroom": "mushroom",
  "shrooms": "mushrooms",
  "zuke": "zucchini",
  "zukes": "zucchini",
  "parm": "parmesan",
  "mozz": "mozzarella",
  "cheddy": "cheddar",
  "sando": "sandwich",
  "sammy": "sandwich",
  "bkfst": "breakfast",
  "bf": "beef",
  "choc": "chocolate",
  "straw": "strawberry",
  "bb": "blueberry",
  "cran": "cranberry",
  "rasp": "raspberry",
  "yog": "yogurt",
  "sw potato": "sweet potato",
  "sw potatoes": "sweet potatoes",
  "gr beans": "green beans",
  "evoo": "extra virgin olive oil",
};

// Common misspellings that require multiple character changes
const COMMON_MISSPELLINGS: Record<string, string> = {
  "brocoli": "broccoli",
  "brocolli": "broccoli",
  "broccolli": "broccoli",
  "brocolie": "broccoli",
  "spagetti": "spaghetti",
  "spagehtti": "spaghetti",
  "spageti": "spaghetti",
  "avacado": "avocado",
  "avacodo": "avocado",
  "avocodo": "avocado",
  "califlower": "cauliflower",
  "cauliflour": "cauliflower",
  "calliflower": "cauliflower",
  "tomatoe": "tomato",
  "tomatos": "tomatoes",
  "potatos": "potatoes",
  "potatoe": "potato",
  "bannana": "banana",
  "bananna": "banana",
  "banannas": "bananas",
  "strawbery": "strawberry",
  "bluberry": "blueberry",
  "blueburry": "blueberry",
  "rasberry": "raspberry",
  "raspbery": "raspberry",
  "cinamon": "cinnamon",
  "cinnimon": "cinnamon",
  "cinimon": "cinnamon",
  "cumcumber": "cucumber",
  "cucmber": "cucumber",
  "lettuse": "lettuce",
  "letuce": "lettuce",
  "choclate": "chocolate",
  "chocholate": "chocolate",
  "chocolat": "chocolate",
  "cheeze": "cheese",
  "chese": "cheese",
  "buger": "burger",
  "burguer": "burger",
  "sandwhich": "sandwich",
  "sandwitch": "sandwich",
  "sanwich": "sandwich",
  "yoghurt": "yogurt",
  "yougurt": "yogurt",
  "salman": "salmon",
  "samlon": "salmon",
  "shripmp": "shrimp",
  "shripm": "shrimp",
  "mushroon": "mushroom",
  "mushrom": "mushroom",
  "parsely": "parsley",
  "parsly": "parsley",
  "jalepeño": "jalapeno",
  "jalepeno": "jalapeno",
  "jalapino": "jalapeno",
  "tortila": "tortilla",
  "tortillia": "tortilla",
  "quesadila": "quesadilla",
  "buritto": "burrito",
  "burito": "burrito",
};

// Sort abbreviation keys longest-first so longer matches take priority
const ABBREV_KEYS = Object.keys(ABBREVIATIONS).sort(
  (a, b) => b.length - a.length
);

export function expandAbbreviations(query: string): string {
  let q = query.toLowerCase().trim();

  // Check common misspellings first
  if (COMMON_MISSPELLINGS[q]) {
    return COMMON_MISSPELLINGS[q];
  }

  // Check for exact full-query abbreviation match
  if (ABBREVIATIONS[q]) {
    return ABBREVIATIONS[q];
  }

  // Replace misspellings and abbreviations as whole words within the query
  const words = q.split(/\s+/);
  const corrected = words.map((w) => COMMON_MISSPELLINGS[w] || w);
  q = corrected.join(" ");

  for (const abbr of ABBREV_KEYS) {
    const escaped = abbr.replace(/[.*+?^${}()|[\]\\&]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");
    q = q.replace(regex, ABBREVIATIONS[abbr]);
  }

  return q;
}

// --- Common substitutions for generating fuzzy variants ---

const COMMON_SUBSTITUTIONS: [string, string][] = [
  ["ph", "f"],
  ["f", "ph"],
  ["ck", "k"],
  ["k", "ck"],
  ["ie", "y"],
  ["y", "ie"],
  ["ee", "ea"],
  ["ea", "ee"],
  ["oo", "u"],
  ["ou", "o"],
  ["ei", "ie"],
  ["ii", "i"],
  ["ll", "l"],
  ["l", "ll"],
  ["ss", "s"],
  ["s", "ss"],
  ["tt", "t"],
  ["t", "tt"],
  ["rr", "r"],
  ["r", "rr"],
  ["cc", "c"],
  ["c", "cc"],
  ["nn", "n"],
  ["n", "nn"],
  ["pp", "p"],
  ["p", "pp"],
  ["mm", "m"],
  ["m", "mm"],
  ["ff", "f"],
  ["f", "ff"],
  ["bb", "b"],
  ["b", "bb"],
  ["dd", "d"],
  ["d", "dd"],
  ["gg", "g"],
  ["g", "gg"],
  ["z", "s"],
  ["s", "z"],
  ["x", "ks"],
  ["ks", "x"],
  ["tion", "shun"],
  ["shun", "tion"],
  ["ght", "t"],
];

export function generateFuzzyVariants(query: string): string[] {
  const variants = new Set<string>();
  const q = query.toLowerCase().trim();

  // 1. Character swaps (adjacent transpositions)
  for (let i = 0; i < q.length - 1; i++) {
    const arr = q.split("");
    [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
    variants.add(arr.join(""));
  }

  // 2. Missing characters (insert each letter a-z at each position)
  for (let i = 0; i <= q.length; i++) {
    for (let c = 97; c <= 122; c++) {
      const ch = String.fromCharCode(c);
      variants.add(q.slice(0, i) + ch + q.slice(i));
    }
  }

  // 3. Extra characters (delete one character at a time)
  for (let i = 0; i < q.length; i++) {
    variants.add(q.slice(0, i) + q.slice(i + 1));
  }

  // 4. Single character replacements
  for (let i = 0; i < q.length; i++) {
    for (let c = 97; c <= 122; c++) {
      const ch = String.fromCharCode(c);
      if (ch !== q[i]) {
        variants.add(q.slice(0, i) + ch + q.slice(i + 1));
      }
    }
  }

  // 5. Common substitutions
  for (const [from, to] of COMMON_SUBSTITUTIONS) {
    let idx = q.indexOf(from);
    while (idx !== -1) {
      variants.add(q.slice(0, idx) + to + q.slice(idx + from.length));
      idx = q.indexOf(from, idx + 1);
    }
  }

  // Remove the original query itself
  variants.delete(q);

  return Array.from(variants);
}

// --- Query normalization ---

const IRREGULAR_PLURALS: Record<string, string> = {
  berries: "berry",
  cherries: "cherry",
  potatoes: "potato",
  tomatoes: "tomato",
  mangoes: "mango",
  leaves: "leaf",
  loaves: "loaf",
  halves: "half",
  knives: "knife",
};

export function normalizeQuery(query: string): string {
  let q = query.toLowerCase().replace(/\s+/g, " ").trim();

  // Expand abbreviations
  q = expandAbbreviations(q);

  return q;
}

/**
 * De-pluralize a word for search purposes.
 * Returns both the original and singularized form.
 */
export function singularize(word: string): string {
  const lower = word.toLowerCase();

  // Check irregular plurals
  if (IRREGULAR_PLURALS[lower]) {
    return IRREGULAR_PLURALS[lower];
  }

  // Common plural rules (order matters)
  if (lower.endsWith("ies") && lower.length > 4) {
    return lower.slice(0, -3) + "y";
  }
  if (lower.endsWith("ves")) {
    return lower.slice(0, -3) + "f";
  }
  if (lower.endsWith("ses") || lower.endsWith("xes") || lower.endsWith("zes") || lower.endsWith("ches") || lower.endsWith("shes")) {
    return lower.slice(0, -2);
  }
  if (lower.endsWith("s") && !lower.endsWith("ss") && lower.length > 3) {
    return lower.slice(0, -1);
  }

  return lower;
}

// --- Fuzzy search against the database ---

/**
 * Performs a fuzzy LIKE-based search against the foods table.
 * Returns up to `limit` results, ordered by relevance.
 */
export function fuzzyLikeSearch(query: string, limit: number = 25, offset: number = 0): { foods: any[]; total: number; did_you_mean: string | null } {
  const normalized = normalizeQuery(query);
  const words = normalized.split(/\s+/).filter((w) => w.length > 0);

  if (words.length === 0) {
    return { foods: [], total: 0, did_you_mean: null };
  }

  // Try LIKE search with the normalized (abbreviation-expanded) query
  const likePattern = `%${words.join("%")}%`;
  const likeSql = `
    SELECT *,
      CASE WHEN lower(name) = lower(@rawQuery) THEN 0 ELSE 1 END as exact_match,
      CASE WHEN brand IS NULL OR brand = '' THEN 0 ELSE 1 END as has_brand,
      CASE WHEN source = 'usda' THEN 0 ELSE 1 END as not_usda,
      length(name) as name_len
    FROM foods
    WHERE lower(name) LIKE @pattern
    ORDER BY exact_match, has_brand, not_usda, name_len
    LIMIT @limit OFFSET @offset
  `;
  const countSql = `SELECT COUNT(*) as total FROM foods WHERE lower(name) LIKE @pattern`;

  const params = { pattern: likePattern, rawQuery: normalized, limit, offset };
  const foods = db.prepare(likeSql).all(params);
  const total = (db.prepare(countSql).get({ pattern: likePattern }) as any).total;

  if (foods.length > 0) {
    const didYouMean = normalized !== query.toLowerCase().trim() ? normalized : null;
    return { foods, total, did_you_mean: didYouMean };
  }

  // Try singularized forms
  const singularWords = words.map(singularize);
  const singularPattern = `%${singularWords.join("%")}%`;
  const singularParams = { pattern: singularPattern, rawQuery: singularWords.join(" "), limit, offset };

  const singularFoods = db.prepare(likeSql).all(singularParams);
  const singularTotal = (db.prepare(countSql).get({ pattern: singularPattern }) as any).total;

  if (singularFoods.length > 0) {
    return { foods: singularFoods, total: singularTotal, did_you_mean: singularWords.join(" ") };
  }

  return { foods: [], total: 0, did_you_mean: null };
}

/**
 * Generates fuzzy variants of each word in the query, runs FTS5 searches
 * with those variants, and returns the best matches.
 */
export function fuzzyFTS5Search(query: string, limit: number = 25, offset: number = 0): { foods: any[]; total: number; did_you_mean: string | null } {
  const normalized = normalizeQuery(query);
  const words = normalized.split(/\s+/).filter((w) => w.length > 0);

  if (words.length === 0) {
    return { foods: [], total: 0, did_you_mean: null };
  }

  // For single-word queries, generate variants and try FTS5 with each
  // For multi-word, try variants of each word one at a time
  const rankExpr = `
    fts.rank
    + CASE WHEN lower(f.name) = lower(@rawQuery) THEN -1000 ELSE 0 END
    + CASE WHEN f.brand IS NULL OR f.brand = '' THEN -50 ELSE 0 END
    + CASE WHEN f.source = 'usda' THEN -30 ELSE 0 END
    + length(f.name) * 0.5`;

  const tryFTS = (ftsQuery: string, rawQuery: string): any[] => {
    try {
      return db.prepare(
        `SELECT f.* FROM foods f
         JOIN foods_fts fts ON f.rowid = fts.rowid
         WHERE foods_fts MATCH @q
         ORDER BY (${rankExpr})
         LIMIT @limit OFFSET @offset`
      ).all({ q: ftsQuery, rawQuery, limit, offset });
    } catch {
      return [];
    }
  };

  const countFTS = (ftsQuery: string): number => {
    try {
      return (db.prepare(
        `SELECT COUNT(*) as total FROM foods f
         JOIN foods_fts fts ON f.rowid = fts.rowid
         WHERE foods_fts MATCH @q`
      ).get({ q: ftsQuery }) as any).total;
    } catch {
      return 0;
    }
  };

  // For each word, generate variants sorted by Levenshtein distance to original
  // Try replacing one word at a time with its closest variants
  for (let wi = 0; wi < words.length; wi++) {
    const word = words[wi];
    const variants = generateFuzzyVariants(word);

    // Sort variants by Levenshtein distance (closest first), take top candidates
    const scored = variants
      .map((v) => ({ variant: v, dist: levenshtein(word, v) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 30);

    for (const { variant } of scored) {
      const testWords = [...words];
      testWords[wi] = variant;
      const ftsQuery = testWords.map((w) => `"${w}"*`).join(" ");
      const rawQuery = testWords.join(" ");
      const results = tryFTS(ftsQuery, rawQuery);

      if (results.length > 0) {
        const total = countFTS(ftsQuery);
        return { foods: results, total, did_you_mean: rawQuery };
      }
    }
  }

  // Last resort: LIKE search with fuzzy variants
  for (let wi = 0; wi < words.length; wi++) {
    const word = words[wi];
    const variants = generateFuzzyVariants(word);
    const scored = variants
      .map((v) => ({ variant: v, dist: levenshtein(word, v) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 15);

    for (const { variant } of scored) {
      const testWords = [...words];
      testWords[wi] = variant;
      const pattern = `%${testWords.join("%")}%`;
      try {
        const results = db.prepare(
          `SELECT * FROM foods
           WHERE lower(name) LIKE @pattern
           ORDER BY
             CASE WHEN brand IS NULL OR brand = '' THEN 0 ELSE 1 END,
             CASE WHEN source = 'usda' THEN 0 ELSE 1 END,
             length(name) ASC
           LIMIT @limit OFFSET @offset`
        ).all({ pattern, limit, offset });

        if (results.length > 0) {
          const total = (db.prepare(
            `SELECT COUNT(*) as total FROM foods WHERE lower(name) LIKE @pattern`
          ).get({ pattern }) as any).total;
          return { foods: results, total, did_you_mean: testWords.join(" ") };
        }
      } catch {
        continue;
      }
    }
  }

  return { foods: [], total: 0, did_you_mean: null };
}

/**
 * Single-result fuzzy search for use in parse.ts searchFood fallback.
 * Returns the best matching food row or null.
 */
export function fuzzySearchSingle(query: string): { food: any | null; did_you_mean: string | null } {
  // Step 1: Try abbreviation expansion with FTS5
  const normalized = normalizeQuery(query);
  if (normalized !== query.toLowerCase().trim()) {
    const words = normalized.split(/\s+/).filter((w) => w.length > 0);

    const rankExpr = `
      fts.rank
      + CASE WHEN lower(f.name) = lower(@rawQuery) THEN -1000 ELSE 0 END
      + CASE WHEN f.brand IS NULL OR f.brand = '' THEN -50 ELSE 0 END
      + CASE WHEN f.source = 'usda' THEN -30 ELSE 0 END
      + length(f.name) * 0.5`;

    // Try phrase match
    try {
      const phraseQuery = `"${words.join(" ")}"`;
      const result = db.prepare(
        `SELECT f.* FROM foods f
         JOIN foods_fts fts ON f.rowid = fts.rowid
         WHERE foods_fts MATCH @q
         ORDER BY (${rankExpr})
         LIMIT 1`
      ).get({ q: phraseQuery, rawQuery: normalized });
      if (result) return { food: result, did_you_mean: normalized };
    } catch {}

    // Try prefix match
    try {
      const ftsQuery = words.map((w) => `"${w}"*`).join(" ");
      const result = db.prepare(
        `SELECT f.* FROM foods f
         JOIN foods_fts fts ON f.rowid = fts.rowid
         WHERE foods_fts MATCH @q
         ORDER BY (${rankExpr})
         LIMIT 1`
      ).get({ q: ftsQuery, rawQuery: normalized });
      if (result) return { food: result, did_you_mean: normalized };
    } catch {}

    // Try LIKE
    try {
      const likePattern = `%${words.join("%")}%`;
      const result = db.prepare(
        `SELECT * FROM foods
         WHERE lower(name) LIKE @pattern
         ORDER BY
           CASE WHEN lower(name) = lower(@rawQuery) THEN 0 ELSE 1 END,
           CASE WHEN brand IS NULL OR brand = '' THEN 0 ELSE 1 END,
           CASE WHEN source = 'usda' THEN 0 ELSE 1 END,
           length(name) ASC
         LIMIT 1`
      ).get({ pattern: likePattern, rawQuery: normalized });
      if (result) return { food: result, did_you_mean: normalized };
    } catch {}
  }

  // Step 2: Try singularized
  const words = normalized.split(/\s+/).filter((w) => w.length > 0);
  const singularWords = words.map(singularize);
  const singularQuery = singularWords.join(" ");

  if (singularQuery !== normalized) {
    try {
      const ftsQuery = singularWords.map((w) => `"${w}"*`).join(" ");
      const rankExpr = `
        fts.rank
        + CASE WHEN lower(f.name) = lower(@rawQuery) THEN -1000 ELSE 0 END
        + CASE WHEN f.brand IS NULL OR f.brand = '' THEN -50 ELSE 0 END
        + CASE WHEN f.source = 'usda' THEN -30 ELSE 0 END
        + length(f.name) * 0.5`;
      const result = db.prepare(
        `SELECT f.* FROM foods f
         JOIN foods_fts fts ON f.rowid = fts.rowid
         WHERE foods_fts MATCH @q
         ORDER BY (${rankExpr})
         LIMIT 1`
      ).get({ q: ftsQuery, rawQuery: singularQuery });
      if (result) return { food: result, did_you_mean: singularQuery };
    } catch {}
  }

  // Step 3: Fuzzy variants
  for (let wi = 0; wi < words.length; wi++) {
    const word = words[wi];
    const variants = generateFuzzyVariants(word);
    const scored = variants
      .map((v) => ({ variant: v, dist: levenshtein(word, v) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 20);

    for (const { variant } of scored) {
      const testWords = [...words];
      testWords[wi] = variant;

      // Try FTS5
      try {
        const ftsQuery = testWords.map((w) => `"${w}"*`).join(" ");
        const rawQuery = testWords.join(" ");
        const rankExpr = `
          fts.rank
          + CASE WHEN lower(f.name) = lower(@rawQuery) THEN -1000 ELSE 0 END
          + CASE WHEN f.brand IS NULL OR f.brand = '' THEN -50 ELSE 0 END
          + CASE WHEN f.source = 'usda' THEN -30 ELSE 0 END
          + length(f.name) * 0.5`;
        const result = db.prepare(
          `SELECT f.* FROM foods f
           JOIN foods_fts fts ON f.rowid = fts.rowid
           WHERE foods_fts MATCH @q
           ORDER BY (${rankExpr})
           LIMIT 1`
        ).get({ q: ftsQuery, rawQuery });
        if (result) return { food: result, did_you_mean: rawQuery };
      } catch {
        continue;
      }
    }
  }

  return { food: null, did_you_mean: null };
}
