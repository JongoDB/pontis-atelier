import type { Request, Response } from 'express';
import { adminSecretConfigured } from '../lib/auth.js';

// GET /api/health
// Liveness + config check. Reveals which env vars are set, not their values.
export function healthRoute(_req: Request, res: Response) {
  res.status(200).json({
    ok: true,
    env: {
      claudeOAuth: !!process.env.CLAUDE_CODE_OAUTH_TOKEN ? 'configured' : 'missing',
      claudeApiKey: !!process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing',
      adminSecret: adminSecretConfigured() ? 'configured' : 'missing',
      node: process.version,
      dbPath: process.env.ATELIER_DB_PATH || './data/atelier.db',
    },
    now: new Date().toISOString(),
  });
}
