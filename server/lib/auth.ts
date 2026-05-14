// Admin-secret check for the /api/admin/* endpoints.
//
// One shared secret, supplied via the ADMIN_SECRET env var. Match against the
// `x-admin-secret` header or the `?secret=` query param. Constant-time compare.

import type { Request } from 'express';

const SECRET = process.env.ADMIN_SECRET || '';

export function adminAuthorized(req: Request): boolean {
  if (!SECRET) return false; // fail-closed if not configured
  const provided =
    (req.headers['x-admin-secret'] as string | undefined) ||
    (typeof req.query.secret === 'string' ? req.query.secret : undefined) ||
    '';
  if (!provided || provided.length !== SECRET.length) return false;
  let result = 0;
  for (let i = 0; i < provided.length; i++) {
    result |= provided.charCodeAt(i) ^ SECRET.charCodeAt(i);
  }
  return result === 0;
}

export function adminSecretConfigured(): boolean {
  return !!SECRET;
}
