/** Structured logs for SEO automation (server-side). */

export function logSeoInfo(message: string, meta?: Record<string, unknown>): void {
  if (meta && Object.keys(meta).length > 0) {
    console.info(`[seo-automation] ${message}`, meta);
  } else {
    console.info(`[seo-automation] ${message}`);
  }
}

export function logSeoWarn(message: string, meta?: Record<string, unknown>): void {
  if (meta && Object.keys(meta).length > 0) {
    console.warn(`[seo-automation] ${message}`, meta);
  } else {
    console.warn(`[seo-automation] ${message}`);
  }
}

export function logSeoError(message: string, err?: unknown, meta?: Record<string, unknown>): void {
  const extra = err instanceof Error ? { ...meta, err: err.message, stack: err.stack } : meta;
  console.error(`[seo-automation] ${message}`, extra ?? err);
}
