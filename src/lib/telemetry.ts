// Adoption telemetry — recursive eat-our-own-dogfood for the C3-F6 module.
//
// Records in-app usage events to localStorage with a fixed cap. This is purely
// local and visible to Maggie inside the app; nothing is sent anywhere. It
// demonstrates the telemetry pattern Pontis itself will use to enforce the
// ≥70% adoption stick rate governance metric.

const KEY = 'pontis-atelier-telemetry-v1';
const CAP = 500; // ringbuffer cap

export type TelemetryKind =
  | 'page-view'
  | 'module-select'
  | 'module-deselect'
  | 'module-flip'
  | 'planner-submit'
  | 'planner-apply'
  | 'defer'
  | 'priority-set'
  | 'export-csv'
  | 'export-pdf'
  | 'share-open'
  | 'undo'
  | 'reset'
  | 'module-request-submit';

export interface TelemetryEvent {
  k: TelemetryKind;
  at: number;
  meta?: Record<string, unknown>;
}

function readAll(): TelemetryEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TelemetryEvent[];
  } catch {
    return [];
  }
}

function writeAll(events: TelemetryEvent[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(events));
  } catch {
    // Quota exceeded or storage disabled — telemetry is best-effort
  }
}

export function track(kind: TelemetryKind, meta?: Record<string, unknown>) {
  const events = readAll();
  events.push({ k: kind, at: Date.now(), meta });
  if (events.length > CAP) events.splice(0, events.length - CAP);
  writeAll(events);
}

export function recentEvents(limit = 50): TelemetryEvent[] {
  return readAll().slice(-limit).reverse();
}

export interface TelemetryRollup {
  totalEvents: number;
  byKind: Record<TelemetryKind, number>;
  uniqueDays: number;
  lastEventAt: number | null;
  // The ≥70% governance metric proxy:
  //   "which capabilities did the user actually touch this week?"
  weeklyKindsUsed: TelemetryKind[];
}

const ALL_KINDS: TelemetryKind[] = [
  'page-view', 'module-select', 'module-deselect', 'module-flip',
  'planner-submit', 'planner-apply', 'defer', 'priority-set',
  'export-csv', 'export-pdf', 'share-open', 'undo', 'reset',
  'module-request-submit',
];

export function rollup(): TelemetryRollup {
  const events = readAll();
  const byKind = {} as Record<TelemetryKind, number>;
  for (const k of ALL_KINDS) byKind[k] = 0;
  const days = new Set<string>();
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weeklyKinds = new Set<TelemetryKind>();

  for (const e of events) {
    byKind[e.k] = (byKind[e.k] ?? 0) + 1;
    days.add(new Date(e.at).toDateString());
    if (e.at >= weekAgo) weeklyKinds.add(e.k);
  }

  return {
    totalEvents: events.length,
    byKind,
    uniqueDays: days.size,
    lastEventAt: events.length > 0 ? events[events.length - 1].at : null,
    weeklyKindsUsed: Array.from(weeklyKinds),
  };
}

export function clearTelemetry() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(KEY);
}
