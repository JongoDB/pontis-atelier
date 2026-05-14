// HTTP Basic Auth for /admin and /api/admin/*.
//
// One shared username + password, supplied via env. The browser handles the
// credential prompt natively; once authenticated, subsequent requests to the
// same origin + realm carry the Authorization header automatically — both
// the /admin SPA route and the /api/admin/* JSON endpoints see the same
// header, so authenticating once unlocks both.
//
// Env:
//   ADMIN_USERNAME   default "admin"
//   ADMIN_SECRET     the password (required; no default — fail-closed)
//   ADMIN_REALM      default "Pontis Atelier Admin"

import type { Request, Response, NextFunction } from 'express';

const USERNAME = process.env.ADMIN_USERNAME || 'admin';
const PASSWORD = process.env.ADMIN_SECRET || '';
const REALM = process.env.ADMIN_REALM || 'Pontis Atelier Admin';

export function adminSecretConfigured(): boolean {
  return !!PASSWORD;
}

/** Parse the Authorization: Basic <base64> header. Returns null if absent / malformed. */
function parseBasic(header: string | undefined): { user: string; pass: string } | null {
  if (!header) return null;
  if (!header.startsWith('Basic ')) return null;
  const b64 = header.slice('Basic '.length).trim();
  let decoded: string;
  try {
    decoded = Buffer.from(b64, 'base64').toString('utf8');
  } catch {
    return null;
  }
  const idx = decoded.indexOf(':');
  if (idx === -1) return null;
  return { user: decoded.slice(0, idx), pass: decoded.slice(idx + 1) };
}

/** Constant-time string compare. */
function safeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Returns true when the request carries valid Basic Auth credentials. */
export function basicAuthCheck(req: Request): boolean {
  if (!PASSWORD) return false;
  const creds = parseBasic(req.headers.authorization);
  if (!creds) return false;
  return safeEq(creds.user, USERNAME) && safeEq(creds.pass, PASSWORD);
}

/**
 * Express middleware. Sends 401 with WWW-Authenticate when unauthenticated,
 * causing the browser to pop the native credential dialog. Calls next() once
 * authenticated.
 */
export function requireBasicAuth(req: Request, res: Response, next: NextFunction) {
  if (!PASSWORD) {
    // Don't expose admin routes at all when ADMIN_SECRET isn't configured
    return res.status(503).type('text/plain')
      .send('ADMIN_SECRET not configured on the server. Refusing to serve admin routes.');
  }
  if (basicAuthCheck(req)) return next();

  // Tell the browser this is a Basic Auth challenge in the named realm.
  // The realm string is what browsers use to scope credential caching, so
  // both the SPA route and the JSON endpoints must declare the same realm
  // for single-prompt authentication to work.
  res.setHeader('WWW-Authenticate', `Basic realm="${REALM}", charset="UTF-8"`);

  // For JSON API routes, return a JSON body. For the HTML page route, a
  // tiny HTML body. Either way the browser shows its native dialog because
  // of the WWW-Authenticate header.
  const wantsJson = req.path.startsWith('/api/');
  if (wantsJson) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  return res.status(401).type('text/plain').send('Authentication required');
}
