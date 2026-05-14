import type { Request, Response } from 'express';
import { getDb } from '../lib/db.js';

// Single-workspace draft. ĒSO has one shared in-progress plan; anyone hitting
// the UI sees the same selections, deferrals, priorities, and assumption
// sliders. Last-write-wins.
//
// We keep this simple on purpose: ĒSO is a single firm with a handful of
// users (Maggie, Carli, maybe Moshe + Rachel + Silvana). No per-user state.
// Cross-user contention is rare and visible (the change log + "last edited by"
// indicator surface it). If two people change different fields in the same
// debounce window, you get last-write-wins on the whole document — that's
// acceptable in practice.

const WORKSPACE_ID = 'default';

interface DraftPayload {
  state: unknown;
  updatedBy?: string;
  version?: number; // client's last-known version, used for stale-write detection
}

// GET /api/draft → current canonical draft
export function getDraft(_req: Request, res: Response) {
  try {
    const db = getDb();
    const row = db.prepare(`SELECT * FROM workspace_draft WHERE workspace_id = ?`).get(WORKSPACE_ID) as
      | { workspace_id: string; version: number; updated_at: number; updated_by: string; state: string }
      | undefined;

    if (!row) {
      return res.status(200).json({ ok: true, exists: false, version: 0 });
    }

    return res.status(200).json({
      ok: true,
      exists: true,
      version: row.version,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
      state: JSON.parse(row.state),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error('[draft GET] error', msg);
    return res.status(500).json({ ok: false, error: 'db error', detail: msg });
  }
}

// PUT /api/draft → replace the current draft. Bumps version. If the client
// passes a stale version, we accept the write but return `staleWrite: true`
// so the client can surface a "you overwrote a newer version" warning. We
// don't reject — that would lose Maggie's keystrokes in flight.
export function putDraft(req: Request, res: Response) {
  const body = (req.body ?? {}) as DraftPayload;
  if (typeof body.state !== 'object' || body.state == null) {
    return res.status(400).json({ ok: false, error: 'state must be an object' });
  }

  // Cap the body size — drafts should be < 50KB even for huge plans
  const json = JSON.stringify(body.state);
  if (json.length > 100_000) {
    return res.status(413).json({ ok: false, error: 'draft too large (>100KB)' });
  }

  try {
    const db = getDb();
    const now = Date.now();
    const updatedBy = String(body.updatedBy ?? '').slice(0, 80);
    const ua = String(req.headers['user-agent'] ?? '').slice(0, 200);

    const existing = db.prepare(`SELECT version FROM workspace_draft WHERE workspace_id = ?`).get(WORKSPACE_ID) as
      | { version: number }
      | undefined;
    const currentVersion = existing?.version ?? 0;
    const nextVersion = currentVersion + 1;
    const staleWrite = body.version != null && body.version < currentVersion;

    db.prepare(`
      INSERT INTO workspace_draft (workspace_id, version, updated_at, updated_by, ua, state)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (workspace_id) DO UPDATE SET
        version    = excluded.version,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by,
        ua         = excluded.ua,
        state      = excluded.state
    `).run(WORKSPACE_ID, nextVersion, now, updatedBy, ua, json);

    return res.status(200).json({
      ok: true,
      version: nextVersion,
      updatedAt: now,
      staleWrite,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error('[draft PUT] error', msg);
    return res.status(500).json({ ok: false, error: 'db error', detail: msg });
  }
}
