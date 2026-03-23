import { Request, Response, NextFunction } from "express";
import db from "../data/database";

const RATE_LIMITS: Record<string, number> = {
  free: 100,
  pro: 10000,
  enterprise: 100000,
};

export function authenticateApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers["x-api-key"] as string || req.query.api_key as string;

  if (!apiKey) {
    res.status(401).json({ error: "API key required. Pass via x-api-key header or api_key query param." });
    return;
  }

  const record = db.prepare("SELECT * FROM api_keys WHERE key = ?").get(apiKey) as any;

  if (!record) {
    res.status(401).json({ error: "Invalid API key." });
    return;
  }

  // Check rate limit
  const today = new Date().toISOString().split("T")[0];
  if (record.last_request_date !== today) {
    // Reset daily counter
    db.prepare("UPDATE api_keys SET requests_today = 1, last_request_date = ? WHERE key = ?").run(today, apiKey);
  } else {
    const limit = RATE_LIMITS[record.tier] || RATE_LIMITS.free;
    if (record.requests_today >= limit) {
      res.status(429).json({
        error: "Rate limit exceeded.",
        limit,
        tier: record.tier,
        resetsAt: "midnight UTC",
      });
      return;
    }
    db.prepare("UPDATE api_keys SET requests_today = requests_today + 1 WHERE key = ?").run(apiKey);
  }

  (req as any).apiKeyOwner = record.owner;
  (req as any).apiKeyTier = record.tier;
  next();
}

export function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = "culture_";
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}
