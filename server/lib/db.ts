// SQLite storage for Pontis Atelier snapshots.
//
// Embedded, zero-config. The DB file lives at $ATELIER_DB_PATH (defaults to
// ./data/atelier.db). better-sqlite3 is synchronous and very fast for the
// small-volume / small-row workload here (a few snapshots a day).
//
// To back up: copy the .db file.
// To inspect: sqlite3 data/atelier.db 'SELECT id, finalized_by FROM snapshots'

import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const DB_PATH = process.env.ATELIER_DB_PATH || './data/atelier.db';

let db: Database.Database | null = null;

function open(): Database.Database {
  if (db) return db;
  const dir = path.dirname(DB_PATH);
  if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

export function getDb(): Database.Database {
  return open();
}

export async function ensureSchema() {
  const d = open();
  d.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id                          TEXT PRIMARY KEY,
      finalized_at                INTEGER NOT NULL,
      finalized_by                TEXT NOT NULL,
      note                        TEXT NOT NULL DEFAULT '',
      modules_count               INTEGER NOT NULL,
      billable_rom_cents          INTEGER NOT NULL,
      hours_saved_per_year        REAL NOT NULL,
      annual_saved_internal_cents INTEGER NOT NULL,
      quarters_of_retainer_build  INTEGER NOT NULL,
      selected_order              TEXT NOT NULL,
      deferrals                   TEXT NOT NULL DEFAULT '{}',
      priorities                  TEXT NOT NULL DEFAULT '{}',
      share_url                   TEXT NOT NULL DEFAULT '',
      ua                          TEXT NOT NULL DEFAULT '',
      ip                          TEXT NOT NULL DEFAULT '',
      received_at                 INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS snapshots_finalized_at_idx ON snapshots (finalized_at DESC);
    CREATE INDEX IF NOT EXISTS snapshots_finalized_by_idx ON snapshots (finalized_by);
  `);
}

export interface SnapshotRow {
  id: string;
  finalized_at: number;
  finalized_by: string;
  note: string;
  modules_count: number;
  billable_rom_cents: number;
  hours_saved_per_year: number;
  annual_saved_internal_cents: number;
  quarters_of_retainer_build: number;
  selected_order: string;
  deferrals: string;
  priorities: string;
  share_url: string;
  ua: string;
  ip: string;
  received_at: number;
}
