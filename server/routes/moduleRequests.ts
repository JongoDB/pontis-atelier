import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb, type ModuleRequestRow } from '../lib/db.js';

// POST /api/module-requests
//
// Public endpoint — Maggie submits a custom module idea via the "request a
// custom module" modal in the browser. Validates a small set of required
// fields; the rest are optional. FSC reviews + assigns an ID at intake.

export function createModuleRequest(req: Request, res: Response) {
  const body = (req.body ?? {}) as Record<string, unknown>;

  const name = String(body.name ?? '').trim();
  const desiredOutcome = String(body.desiredOutcome ?? '').trim();

  if (!name) {
    return res.status(400).json({ ok: false, error: 'name is required' });
  }
  if (!desiredOutcome) {
    return res.status(400).json({ ok: false, error: 'desiredOutcome is required' });
  }
  if (name.length > 240) {
    return res.status(400).json({ ok: false, error: 'name too long (max 240 chars)' });
  }

  const id = randomUUID();
  try {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO module_requests (
        id, created_at, requested_by, name, desired_outcome, description,
        current_tool, section_key, lifecycle_phase, hours_saved_per_year,
        dependencies, notes, status, ua, ip
      ) VALUES (
        @id, @created_at, @requested_by, @name, @desired_outcome, @description,
        @current_tool, @section_key, @lifecycle_phase, @hours_saved_per_year,
        @dependencies, @notes, 'new', @ua, @ip
      )
    `);

    stmt.run({
      id,
      created_at: Date.now(),
      requested_by: String(body.requestedBy ?? '').slice(0, 120),
      name: name.slice(0, 240),
      desired_outcome: desiredOutcome.slice(0, 2000),
      description: String(body.description ?? '').slice(0, 4000),
      current_tool: String(body.currentTool ?? '').slice(0, 1000),
      section_key: String(body.sectionKey ?? '').slice(0, 40),
      lifecycle_phase: String(body.lifecyclePhase ?? '').slice(0, 80),
      hours_saved_per_year: numOrNull(body.hoursSavedPerYear),
      dependencies: JSON.stringify(arrOfStrings(body.dependencies)),
      notes: String(body.notes ?? '').slice(0, 4000),
      ua: String(req.headers['user-agent'] ?? ''),
      ip: String(req.headers['x-forwarded-for'] ?? req.ip ?? ''),
    });

    return res.status(201).json({ ok: true, id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error('[module-requests] db error', msg);
    return res.status(500).json({ ok: false, error: 'db error', detail: msg });
  }
}

// GET /api/admin/module-requests
export function adminListModuleRequests(_req: Request, res: Response) {
  try {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT * FROM module_requests ORDER BY created_at DESC LIMIT 500`
      )
      .all() as ModuleRequestRow[];

    return res.status(200).json({
      ok: true,
      total: rows.length,
      requests: rows.map(asPublic),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error('[admin/module-requests] db error', msg);
    return res.status(500).json({ ok: false, error: 'db error', detail: msg });
  }
}

function asPublic(row: ModuleRequestRow) {
  return {
    id: row.id,
    createdAt: new Date(row.created_at).toISOString(),
    requestedBy: row.requested_by,
    name: row.name,
    desiredOutcome: row.desired_outcome,
    description: row.description,
    currentTool: row.current_tool,
    sectionKey: row.section_key,
    lifecyclePhase: row.lifecycle_phase,
    hoursSavedPerYear: row.hours_saved_per_year,
    dependencies: safeParseArray(row.dependencies),
    notes: row.notes,
    status: row.status,
    ua: row.ua,
    ip: row.ip,
  };
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function arrOfStrings(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter((x) => x.length > 0).slice(0, 50);
}

function safeParseArray(s: string): string[] {
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
