import { createHash, timingSafeEqual } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';

export type TokenProvider = () => string | undefined;

export const envTokenProvider: TokenProvider = () => process.env.AURA_API_TOKEN;

function digest(value: string): Buffer {
  // Hashing both sides gives equal-length buffers, so timingSafeEqual never
  // throws and the comparison time does not depend on the token length.
  return createHash('sha256').update(value, 'utf8').digest();
}

export function tokensMatch(expected: string, provided: string): boolean {
  return timingSafeEqual(digest(expected), digest(provided));
}

function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/**
 * Requires `Authorization: Bearer <AURA_API_TOKEN>`.
 * Fails closed: if the token is not configured on the server, responds 503.
 */
export function requireApiToken(getToken: TokenProvider = envTokenProvider): MiddlewareHandler {
  return async (c, next) => {
    const expected = getToken();
    if (!expected) {
      return c.json({ error: 'API authentication is not configured' }, 503);
    }
    const provided = bearerToken(c.req.header('Authorization'));
    if (provided === null || !tokensMatch(expected, provided)) {
      c.header('WWW-Authenticate', 'Bearer');
      return c.json({ error: 'Unauthorized' }, 401);
    }
    await next();
  };
}
