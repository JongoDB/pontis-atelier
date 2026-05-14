import type { Request, Response } from 'express';
import { getDb, type SnapshotRow } from '../lib/db.js';

// GET /api/admin/snapshots?limit=50&offset=0&by=name
export function adminListSnapshots(req: Request, res: Response) {
  const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? '50'), 10) || 50));
  const offset = Math.max(0, parseInt(String(req.query.offset ?? '0'), 10) || 0);
  const byFilter = typeof req.query.by === 'string' ? req.query.by.trim().toLowerCase() : '';

  try {
    const db = getDb();
    const rows = byFilter
      ? db.prepare(`
          SELECT id, finalized_at, finalized_by, note,
                 modules_count, billable_rom_cents, hours_saved_per_year,
                 annual_saved_internal_cents, quarters_of_retainer_build,
                 share_url, received_at
          FROM snapshots
          WHERE LOWER(finalized_by) LIKE ?
          ORDER BY finalized_at DESC
          LIMIT ? OFFSET ?
        `).all(`%${byFilter}%`, limit, offset) as SnapshotRow[]
      : db.prepare(`
          SELECT id, finalized_at, finalized_by, note,
                 modules_count, billable_rom_cents, hours_saved_per_year,
                 annual_saved_internal_cents, quarters_of_retainer_build,
                 share_url, received_at
          FROM snapshots
          ORDER BY finalized_at DESC
          LIMIT ? OFFSET ?
        `).all(limit, offset) as SnapshotRow[];

    const total = (db.prepare(`SELECT COUNT(*) AS c FROM snapshots`).get() as { c: number }).c;

    return res.status(200).json({
      ok: true,
      total,
      limit,
      offset,
      snapshots: rows.map(asPublicSnapshot),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error('[admin/snapshots] db error', msg);
    return res.status(500).json({ ok: false, error: 'db error', detail: msg });
  }
}

// GET /api/admin/snapshots/:id
export function adminGetSnapshot(req: Request, res: Response) {
  const id = String(req.params.id ?? '');
  if (!id) return res.status(400).json({ ok: false, error: 'missing id' });

  try {
    const db = getDb();
    const row = db.prepare(`SELECT * FROM snapshots WHERE id = ?`).get(id) as SnapshotRow | undefined;
    if (!row) return res.status(404).json({ ok: false, error: 'not found' });

    return res.status(200).json({
      ok: true,
      snapshot: {
        id: row.id,
        finalizedAt: new Date(row.finalized_at).toISOString(),
        finalizedBy: row.finalized_by,
        note: row.note,
        modules: row.modules_count,
        billableROM: row.billable_rom_cents / 100,
        hoursSavedPerYear: row.hours_saved_per_year,
        annualSavedInternal: row.annual_saved_internal_cents / 100,
        quartersOfRetainerBuild: row.quarters_of_retainer_build,
        selectedOrder: JSON.parse(row.selected_order),
        deferrals: JSON.parse(row.deferrals),
        priorities: JSON.parse(row.priorities),
        shareURL: row.share_url,
        ua: row.ua,
        ip: row.ip,
        receivedAt: new Date(row.received_at).toISOString(),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error('[admin/snapshots/:id] db error', msg);
    return res.status(500).json({ ok: false, error: 'db error', detail: msg });
  }
}

function asPublicSnapshot(row: SnapshotRow) {
  return {
    id: row.id,
    finalizedAt: new Date(row.finalized_at).toISOString(),
    finalizedBy: row.finalized_by,
    note: row.note,
    modules: row.modules_count,
    billableROM: row.billable_rom_cents / 100,
    hoursSavedPerYear: row.hours_saved_per_year,
    annualSavedInternal: row.annual_saved_internal_cents / 100,
    quartersOfRetainerBuild: row.quarters_of_retainer_build,
    shareURL: row.share_url,
    receivedAt: new Date(row.received_at).toISOString(),
  };
}
