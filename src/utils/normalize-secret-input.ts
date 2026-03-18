/**
 * HTTP headers must be Latin-1 (bytes 0–255). Strips any character with
 * code point > 255 to avoid "Cannot convert string to ByteString" errors
 * when tokens/passwords contain Unicode (e.g. pasted from docs with smart quotes).
 */
export function sanitizeForHttpHeader(value: string): string {
  return value.replace(/[^\x00-\xff]/g, "");
}

/**
 * Secret normalization for copy/pasted credentials.
 *
 * Common footgun: line breaks (especially `\r`) embedded in API keys/tokens.
 * We strip line breaks anywhere, then trim whitespace at the ends.
 * Also strips non-Latin-1 chars so values are safe for HTTP headers (ByteString).
 *
 * Intentionally does NOT remove ordinary spaces inside the string to avoid
 * silently altering "Bearer <token>" style values.
 */
export function normalizeSecretInput(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return sanitizeForHttpHeader(value.replace(/[\r\n\u2028\u2029]+/g, "").trim());
}

export function normalizeOptionalSecretInput(value: unknown): string | undefined {
  const normalized = normalizeSecretInput(value);
  return normalized ? normalized : undefined;
}
