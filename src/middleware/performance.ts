import { Request, Response, NextFunction } from "express";
import compression from "compression";

/**
 * Response time logging middleware.
 * Logs method, path, status code, and duration for every request.
 * Also sets the X-Response-Time header.
 */
export function responseTimeLogger(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    const durationNs = process.hrtime.bigint() - start;
    const durationMs = Number(durationNs) / 1e6;
    if (!res.headersSent) {
      res.setHeader("X-Response-Time", `${durationMs.toFixed(2)}ms`);
    }
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(2)}ms`
    );
    return originalJson(body);
  };

  next();
}

/**
 * Compression middleware using the 'compression' package.
 * Compresses responses with gzip/deflate/br based on Accept-Encoding.
 */
export const compressionMiddleware = compression({ threshold: 1024 });

/**
 * Enable ETag support.
 * Express has built-in ETag generation; this helper applies the setting to the app.
 * Call app.set("etag", "strong") in your app setup instead of using this as middleware.
 */
export function enableEtag(app: { set: (key: string, value: string) => void }): void {
  app.set("etag", "strong");
}
