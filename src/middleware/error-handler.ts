import { Request, Response, NextFunction } from "express";

/**
 * Global error handler middleware.
 * Catches unhandled errors and returns a consistent JSON error format.
 * Must be registered after all routes.
 */
export function globalErrorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const timestamp = new Date().toISOString();
  const statusCode = (err as any).statusCode || 500;
  const message = statusCode === 500 ? "Internal server error" : err.message;

  console.error(`[${timestamp}] ERROR ${statusCode}: ${err.message}`);
  if (statusCode === 500) {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    error: message,
    code: statusCode,
  });
}

/**
 * 404 handler for unmatched routes.
 * Register after all routes but before the global error handler.
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.originalUrl}`,
    code: 404,
  });
}
