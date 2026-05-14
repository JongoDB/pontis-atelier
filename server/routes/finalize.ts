import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../lib/db.js';

// POST /api/finalize
//
// Accepts a snapshot from the Atelier UI on commit. Idempotent on `id` —
// repeated POSTs for the same snapshot are no-ops. Either the flat snapshot
// shape or the webhook envelope `{ kind: 'pontis-atelier:finalize', ... }`
// is accepted.

export function finalizeRoute(req: Request, res: Response) {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const snap = parseSnapshot(body);
  if (!snap) {
    return res.status(400).json({ ok: false, error: 'unrecognised snapshot shape' });
  }

  try {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO snapshots (
        id, finalized_at, finalized_by, note,
        modules_count, billable_rom_cents, hours_saved_per_year, annual_saved_internal_cents, quarters_of_retainer_build,
        selected_order, deferrals, priorities,
        share_url, ua, ip, received_at
      ) VALUES (
        @id, @finalized_at, @finalized_by, @note,
        @modules_count, @billable_rom_cents, @hours_saved_per_year, @annual_saved_internal_cents, @quarters_of_retainer_build,
        @selected_order, @deferrals, @priorities,
        @share_url, @ua, @ip, @received_at
      )
    `);

    stmt.run({
      id: snap.id,
      finalized_at: snap.finalizedAt,
      finalized_by: snap.finalizedBy,
      note: snap.note,
      modules_count: snap.totals.modules,
      billable_rom_cents: Math.round(snap.totals.billableROM * 100),
      hours_saved_per_year: snap.totals.hoursSavedPerYear,
      annual_saved_internal_cents: Math.round(snap.totals.annualSavedInternal * 100),
      quarters_of_retainer_build: snap.totals.quartersOfRetainerBuild,
      selected_order: JSON.stringify(snap.selectedOrder),
      deferrals: JSON.stringify(snap.deferrals),
      priorities: JSON.stringify(snap.priorities),
      share_url: snap.shareURL,
      ua: String(req.headers['user-agent'] ?? ''),
      ip: String(req.headers['x-forwarded-for'] ?? req.ip ?? ''),
      received_at: Date.now(),
    });

    return res.status(200).json({ ok: true, id: snap.id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error('[finalize] db error', msg);
    return res.status(500).json({ ok: false, error: 'db error', detail: msg });
  }
}

interface NormalisedSnapshot {
  id: string;
  finalizedAt: number;
  finalizedBy: string;
  note: string;
  selectedOrder: string[];
  deferrals: Record<string, number>;
  priorities: Record<string, number>;
  totals: {
    modules: number;
    billableROM: number;
    hoursSavedPerYear: number;
    annualSavedInternal: number;
    quartersOfRetainerBuild: number;
  };
  shareURL: string;
}

function parseSnapshot(body: Record<string, unknown>): NormalisedSnapshot | null {
  // Webhook envelope shape: { kind: 'pontis-atelier:finalize', ... }
  if (body.kind === 'pontis-atelier:finalize') {
    const totals = body.totals as Record<string, unknown> | undefined;
    if (!totals) return null;
    return {
      id: String(body.id || randomUUID()),
      finalizedAt: Number(body.at ?? Date.now()),
      finalizedBy: String(body.finalizedBy ?? 'unknown'),
      note: String(body.note ?? ''),
      selectedOrder: arrOf(body.selected),
      deferrals: objOf(body.deferrals),
      priorities: objOf(body.priorities),
      totals: {
        modules: num(totals.modules),
        billableROM: num(totals.billableROM),
        hoursSavedPerYear: num(totals.hoursSavedPerYear),
        annualSavedInternal: num(totals.annualSavedInternal),
        quartersOfRetainerBuild: num(totals.quartersOfRetainerBuild),
      },
      shareURL: String(body.shareURL ?? ''),
    };
  }

  // Plain snapshot shape
  if (body.totals && Array.isArray(body.selectedOrder)) {
    const totals = body.totals as Record<string, unknown>;
    return {
      id: String(body.id || randomUUID()),
      finalizedAt: Number(body.finalizedAt ?? Date.now()),
      finalizedBy: String(body.finalizedBy ?? 'unknown'),
      note: String(body.note ?? ''),
      selectedOrder: arrOf(body.selectedOrder),
      deferrals: objOf(body.deferrals),
      priorities: objOf(body.priorities),
      totals: {
        modules: num(totals.modules),
        billableROM: num(totals.billableROM),
        hoursSavedPerYear: num(totals.hoursSavedPerYear),
        annualSavedInternal: num(totals.annualSavedInternal),
        quartersOfRetainerBuild: num(totals.quartersOfRetainerBuild),
      },
      shareURL: String(body.shareURL ?? ''),
    };
  }
  return null;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const arrOf = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

const objOf = (v: unknown): Record<string, number> => {
  if (!v || typeof v !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const n = Number(val);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
};
