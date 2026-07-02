import { Router, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import db from "../data/database";
import { formatContribution } from "../services/contribution-format";
import { cache } from "../middleware/cache";

// Creator allowlist for no-barcode corrections. Gated on the verified email in the Firebase
// token (verifyIdToken returns it with no service-account credentials needed). Override/extend
// via CREATOR_EMAILS env (comma-separated).
const CREATOR_EMAILS = (process.env.CREATOR_EMAILS || "bretproctor1@gmail.com")
  .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

export const contributionRoutes = Router();

// Submit a new contribution
contributionRoutes.post("/", (req: Request, res: Response) => {
  const apiKey = req.headers["x-api-key"] as string || req.query.api_key as string || ((req as any).apiKeyOwner === "firebase" ? "firebase" : "");
  const { type, food_id, ...rest } = req.body;

  if (!type) {
    res.status(400).json({ error: "type is required (new_food, correction, barcode_add)" });
    return;
  }

  const validTypes = ["new_food", "correction", "barcode_add"];
  if (!validTypes.includes(type)) {
    res.status(400).json({ error: `type must be one of: ${validTypes.join(", ")}` });
    return;
  }

  // Validate based on type
  if (type === "new_food") {
    const { name, category, calories } = rest;
    if (!name) {
      res.status(400).json({ error: "name is required for new_food contributions" });
      return;
    }
    if (!category) {
      res.status(400).json({ error: "category is required for new_food contributions" });
      return;
    }
    if (calories === undefined || calories === null) {
      res.status(400).json({ error: "calories is required for new_food contributions" });
      return;
    }
  }

  if (type === "correction") {
    if (!food_id) {
      res.status(400).json({ error: "food_id is required for correction contributions" });
      return;
    }
    // Verify the food exists
    const food = db.prepare("SELECT id FROM foods WHERE id = ?").get(food_id);
    if (!food) {
      res.status(404).json({ error: "Food not found for the given food_id" });
      return;
    }
    // Must have at least one field to correct
    const correctionFields = { ...rest };
    delete correctionFields.type;
    if (Object.keys(correctionFields).length === 0) {
      res.status(400).json({ error: "At least one field to correct is required" });
      return;
    }
  }

  if (type === "barcode_add") {
    if (!food_id) {
      res.status(400).json({ error: "food_id is required for barcode_add contributions" });
      return;
    }
    if (!rest.barcode) {
      res.status(400).json({ error: "barcode is required for barcode_add contributions" });
      return;
    }
    // Verify the food exists
    const food = db.prepare("SELECT id FROM foods WHERE id = ?").get(food_id);
    if (!food) {
      res.status(404).json({ error: "Food not found for the given food_id" });
      return;
    }
  }

  const id = uuid();
  const data = JSON.stringify(rest);

  const hasBarcode = rest.barcode && rest.barcode.length > 3;
  const isFirebase = (req as any).apiKeyOwner === "firebase";
  // Creator corrections: the creator may overwrite live data even without a barcode (e.g.
  // fixing a searched/FatSecret item). Keyed by fatsecret-{id}. Gated on the verified email
  // in the token — no Firestore/service-account dependency, so it works wherever auth works.
  const callerEmail = String((req as any).firebaseEmail || "").toLowerCase();
  const isCreator = isFirebase && !!callerEmail && CREATOR_EMAILS.includes(callerEmail);
  const isCreatorCorrection = isCreator && !hasBarcode && !!rest.fatsecret_food_id;
  const status = (hasBarcode || isCreatorCorrection) ? "approved" : "pending";

  // Log to contributions table (skip for Firebase app users — no API key row)
  if (!isFirebase && apiKey) {
    try {
      db.prepare(`
        INSERT INTO contributions (id, api_key, type, food_id, data, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, apiKey, type, food_id || null, data, status);
    } catch (e: any) {
      console.error("Contribution insert failed:", e.message);
      res.status(500).json({ error: "Internal server error", code: 500 });
      return;
    }
  }

  // Auto-insert into foods table when we have a barcode, or when a trusted creator
  // corrects a searched item (no barcode → keyed by fatsecret-{id}).
  if (type === "new_food" && (hasBarcode || isCreatorCorrection)) {
    const foodId = hasBarcode ? `barcode-${rest.barcode}` : `fatsecret-${rest.fatsecret_food_id}`;
    const source = isCreatorCorrection ? "creator_correction" : "community";
    try {
      db.prepare(`
        INSERT OR REPLACE INTO foods (id, name, brand, category, barcode, source, ingredients_text,
          calories, total_fat, saturated_fat, trans_fat, cholesterol, sodium,
          total_carbohydrates, dietary_fiber, total_sugars, protein,
          serving_size, serving_unit, household_serving)
        VALUES (?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?)
      `).run(
        foodId, rest.name || "Unknown", rest.brand || null, rest.category || "Uncategorized",
        hasBarcode ? rest.barcode : null, source, rest.ingredients_text || null,
        rest.calories || 0, rest.total_fat || 0, rest.saturated_fat || 0,
        rest.trans_fat || 0, rest.cholesterol || 0, rest.sodium || 0,
        rest.total_carbohydrates || 0, rest.dietary_fiber || 0, rest.total_sugars || 0,
        rest.protein || 0, rest.serving_size || 100, rest.serving_unit || "g",
        rest.household_serving || null
      );
      // Invalidate the barcode read-back cache so the corrected entry is served immediately
      // (the read endpoint caches for 600s). Cover the leading-zero variants the client tries
      // (UPC-A vs EAN-13) so a self-heal overwrite isn't shadowed by a stale poisoned entry.
      if (hasBarcode) {
        const code = String(rest.barcode);
        const variants = new Set([code, "0" + code, code.startsWith("0") ? code.slice(1) : code]);
        for (const v of variants) cache.del(`barcode:${v}`);
      }
    } catch (e: any) {
      console.error("Auto-insert food failed:", e.message);
    }
  }

  res.status(201).json({
    id,
    type,
    status,
    food_id: food_id || null,
    message: type === "new_food"
      ? "Food added to the database. It's now searchable!"
      : "Contribution submitted for review. Thank you!",
  });
});

// List your own contributions
contributionRoutes.get("/", (req: Request, res: Response) => {
  const apiKey = req.headers["x-api-key"] as string || req.query.api_key as string;
  const status = req.query.status as string;
  const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  let sql = "SELECT * FROM contributions WHERE api_key = @apiKey";
  const params: any = { apiKey, limit, offset };

  if (status) {
    sql += " AND status = @status";
    params.status = status;
  }

  const countSql = sql.replace("SELECT *", "SELECT COUNT(*) as total");
  const total = (db.prepare(countSql).get(params) as any).total;

  sql += " ORDER BY created_at DESC LIMIT @limit OFFSET @offset";
  const contributions = db.prepare(sql).all(params);

  res.json({
    contributions: contributions.map((c) => formatContribution(c)),
    total,
    limit,
    offset,
  });
});

// Get a specific contribution
contributionRoutes.get("/:id", (req: Request, res: Response) => {
  const apiKey = req.headers["x-api-key"] as string || req.query.api_key as string;

  const contribution = db.prepare(
    "SELECT * FROM contributions WHERE id = ? AND api_key = ?"
  ).get(req.params.id, apiKey) as any;

  if (!contribution) {
    res.status(404).json({ error: "Contribution not found" });
    return;
  }

  res.json(formatContribution(contribution));
});
