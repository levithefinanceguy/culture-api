import { Router, Request, Response } from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import db from "../data/database";

export const imageRoutes = Router();

// --- Image cache table ---

db.exec(`
  CREATE TABLE IF NOT EXISTS food_images (
    id TEXT PRIMARY KEY,
    food_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_food_images_name ON food_images(food_name);
`);

// Directory for stored images
const IMAGE_DIR = process.env.IMAGE_DIR || path.join(__dirname, "../../food-images");
if (!fs.existsSync(IMAGE_DIR)) {
  fs.mkdirSync(IMAGE_DIR, { recursive: true });
}

/**
 * GET /api/v1/images/:id
 * Serve a generated food image by its hash ID.
 */
imageRoutes.get("/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const row = db.prepare("SELECT file_path FROM food_images WHERE id = ?").get(id) as any;

  if (!row || !fs.existsSync(row.file_path)) {
    res.status(404).json({ error: "Image not found" });
    return;
  }

  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  fs.createReadStream(row.file_path).pipe(res);
});

/**
 * POST /api/v1/images/generate
 * Generate an AI food image. Returns cached version if already generated.
 *
 * Body: { "food_name": "Grilled Chicken Breast" }
 * Response: { "image_url": "/api/v1/images/abc123", "cached": true/false }
 */
imageRoutes.post("/generate", async (req: Request, res: Response) => {
  try {
    const { food_name } = req.body;

    if (!food_name || typeof food_name !== "string") {
      res.status(400).json({ error: "food_name is required" });
      return;
    }

    const normalized = food_name.toLowerCase().trim();
    const id = crypto.createHash("md5").update(normalized).digest("hex");

    // Check cache
    const cached = db.prepare("SELECT id FROM food_images WHERE id = ?").get(id) as any;
    if (cached) {
      res.json({ image_url: `/api/v1/images/${id}`, cached: true });
      return;
    }

    // Generate with Gemini Imagen
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: "Image generation is not configured. GEMINI_API_KEY is missing." });
      return;
    }

    const prompt =
      `A product photo of ${food_name} on a plain white background. ` +
      "Show the actual product or packaging as it appears in a store — if it's a branded item, show the bag, box, or container. " +
      "If it's a whole food (fruit, vegetable, meat), show the item by itself. " +
      "Clean, centered, well-lit studio product photography. Nothing else in the frame. No text overlays, no labels added, no watermarks.";

    const imagenURL = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;

    const imagenResp = await fetch(imagenURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: "1:1",
          personGeneration: "DONT_ALLOW",
        },
      }),
    });

    if (!imagenResp.ok) {
      const errText = await imagenResp.text();
      console.error("Imagen API error:", imagenResp.status, errText);
      res.status(502).json({ error: "Image generation failed" });
      return;
    }

    const imagenData: any = await imagenResp.json();
    const predictions = imagenData.predictions;
    if (!predictions || predictions.length === 0 || !predictions[0].bytesBase64Encoded) {
      res.status(502).json({ error: "No image generated" });
      return;
    }

    const imageBuffer = Buffer.from(predictions[0].bytesBase64Encoded, "base64");
    const filePath = path.join(IMAGE_DIR, `${id}.png`);

    // Save to disk
    fs.writeFileSync(filePath, imageBuffer);

    // Cache in database
    db.prepare(
      "INSERT INTO food_images (id, food_name, file_path) VALUES (?, ?, ?)"
    ).run(id, normalized, filePath);

    res.json({ image_url: `/api/v1/images/${id}`, cached: false });
  } catch (err: any) {
    console.error("Image generation error:", err);
    res.status(500).json({ error: "Failed to generate food image. " + (err.message || "Unknown error") });
  }
});
