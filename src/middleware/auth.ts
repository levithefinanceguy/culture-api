import { Request, Response, NextFunction } from "express";
import db from "../data/database";
import { rateLimitMiddleware } from "./rate-limiter";

/**
 * Authenticates the API key and then applies the sliding window rate limiter.
 * Rate limit headers (X-RateLimit-*) are set by the rate limiter middleware.
 */
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

  (req as any).apiKeyOwner = record.owner;
  (req as any).apiKeyTier = record.tier;

  // Delegate rate limiting to the sliding window rate limiter
  rateLimitMiddleware(req, res, next);
}

export function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = "culture_";
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}
