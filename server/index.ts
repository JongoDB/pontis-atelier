// Pontis Atelier server — Express app that serves the static Vite build and
// the /api/* routes for finalize, admin, and the Claude-backed planner.
//
// Deployed by cloning the repo onto a host (LXC, VPS, anything with Node 20+),
// running `npm run build`, then `npm start`. No external services required:
// SQLite holds the snapshots, Claude Code OAuth handles the planner auth.

import express, { type NextFunction, type Request, type Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { ensureSchema } from './lib/db.js';
import { finalizeRoute } from './routes/finalize.js';
import { adminListSnapshots, adminGetSnapshot } from './routes/admin.js';
import { planRoute } from './routes/plan.js';
import { healthRoute } from './routes/health.js';
import { getDraft, putDraft } from './routes/draft.js';
import { adminAuthorized, adminSecretConfigured } from './lib/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'production';

const app = express();

// Trust the first proxy in front of us (nginx / Caddy / Cloudflare) so
// req.ip and req.protocol reflect the real client.
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));

// Simple request log — single line per request, no dependency on morgan/pino
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    // Don't log health checks (too noisy)
    if (req.path === '/api/health') return;
    // eslint-disable-next-line no-console
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${ms}ms`);
  });
  next();
});

// ── API routes ────────────────────────────────────────────────────────────────

app.get('/api/health', healthRoute);

app.post('/api/finalize', finalizeRoute);

app.post('/api/plan', planRoute);

app.get('/api/draft', getDraft);
app.put('/api/draft', putDraft);

// Admin routes share an auth gate
function adminGate(req: Request, res: Response, next: NextFunction) {
  if (!adminSecretConfigured()) {
    return res.status(503).json({ ok: false, error: 'ADMIN_SECRET not configured' });
  }
  if (!adminAuthorized(req)) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  next();
}

app.get('/api/admin/snapshots', adminGate, adminListSnapshots);
app.get('/api/admin/snapshots/:id', adminGate, adminGetSnapshot);

// ── Static frontend ───────────────────────────────────────────────────────────

const DIST_DIR = path.join(PROJECT_ROOT, 'dist');

if (NODE_ENV === 'production') {
  if (fs.existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR, {
      // Long-cache hashed assets; let index.html stay fresh
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('cache-control', 'no-cache');
        } else if (/\.(js|css|svg|woff2?)$/.test(filePath)) {
          res.setHeader('cache-control', 'public, max-age=31536000, immutable');
        }
      },
    }));

    // SPA fallback — Vite produces one index.html; everything that isn't an
    // API route or a file in dist/ falls through to it.
    app.get(/^\/(?!api\/).*/, (_req: Request, res: Response) => {
      res.sendFile(path.join(DIST_DIR, 'index.html'));
    });
  } else {
    // eslint-disable-next-line no-console
    console.warn(`[atelier] dist/ not found at ${DIST_DIR}. Run \`npm run build\` first.`);
    app.get(/^\/(?!api\/).*/, (_req: Request, res: Response) => {
      res.status(503).type('text/plain').send(
        'Pontis Atelier — frontend not built yet.\nRun: npm run build\n'
      );
    });
  }
}

// 404 for unmatched API paths
app.use('/api', (_req, res) => {
  res.status(404).json({ ok: false, error: 'not found' });
});

// Last-resort error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  // eslint-disable-next-line no-console
  console.error('[atelier] uncaught error', err);
  res.status(500).json({ ok: false, error: err.message ?? 'internal error' });
});

// ── Boot ──────────────────────────────────────────────────────────────────────

(async () => {
  await ensureSchema();
  app.listen(PORT, HOST, () => {
    // eslint-disable-next-line no-console
    console.log(`\n  pontis atelier · listening on http://${HOST}:${PORT}\n  env: ${NODE_ENV}  ·  db: ${process.env.ATELIER_DB_PATH ?? './data/atelier.db'}\n`);
  });
})();
