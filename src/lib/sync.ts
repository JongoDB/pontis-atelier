// Backend draft sync — keeps the in-progress plan on the server so it follows
// Maggie across devices.
//
// Boot flow:
//   1. The Zustand store rehydrates from localStorage immediately (synchronous).
//      That gives instant UI even if the network is slow.
//   2. We then fetch /api/draft. If the server's version is newer than what
//      we have locally, we apply the server state on top.
//   3. After boot, every store change triggers a debounced PUT /api/draft.
//
// Failure modes:
//   - /api/draft 404 (no server, e.g. plain Vite dev without `npm run dev`)
//     → localStorage-only mode. We disable the sync silently.
//   - Network error during a PUT → we keep the change locally and retry on
//     the next change. No queue, no exponential backoff — just best-effort.
//   - Server returns staleWrite: true → we accept it (last-write-wins) but
//     could surface a banner in a future iteration.

import { useStore, type AtelierStore } from '../store';

export interface SyncStatus {
  enabled: boolean;            // server reachable
  version: number;             // last server version we know about
  lastSavedAt: number | null;  // when we last successfully PUT
  lastError: string | null;
  syncing: boolean;            // a PUT is in flight
  remoteUpdatedBy: string;     // who last edited on the server
  remoteUpdatedAt: number | null;
}

const SYNC_ENDPOINT = '/api/draft';
const DEBOUNCE_MS = 1500;       // wait this long after the last change before saving
const STARTUP_GRACE_MS = 200;   // don't trigger PUT during the initial hydrate

type Subscriber = (s: SyncStatus) => void;

class DraftSync {
  status: SyncStatus = {
    enabled: false,
    version: 0,
    lastSavedAt: null,
    lastError: null,
    syncing: false,
    remoteUpdatedBy: '',
    remoteUpdatedAt: null,
  };

  private subs = new Set<Subscriber>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private bootAt = 0;
  private unsubStore: (() => void) | null = null;
  private inFlight: Promise<void> | null = null;

  subscribe(fn: Subscriber): () => void {
    this.subs.add(fn);
    fn(this.status);
    return () => { this.subs.delete(fn); };
  }

  private set(partial: Partial<SyncStatus>) {
    this.status = { ...this.status, ...partial };
    for (const fn of this.subs) fn(this.status);
  }

  /** Boot: pull from server, then start watching. Safe to call once on app mount. */
  async boot() {
    this.bootAt = Date.now();
    try {
      const r = await fetch(SYNC_ENDPOINT);
      if (!r.ok) {
        // 404 = no API route mounted; 503 = server up but broken. Either way,
        // fall back to local-only operation silently.
        this.set({ enabled: false, lastError: r.status === 404 ? null : `HTTP ${r.status}` });
        return;
      }
      const data = await r.json() as {
        ok: boolean; exists: boolean; version: number;
        state?: Partial<AtelierStore>; updatedAt?: number; updatedBy?: string;
      };
      this.set({
        enabled: true,
        version: data.version ?? 0,
        remoteUpdatedAt: data.updatedAt ?? null,
        remoteUpdatedBy: data.updatedBy ?? '',
      });

      // If the server has state and (it's newer than ours OR we have no local
      // state), apply it. The localStorage rehydrate already ran by this
      // point, so we treat the server as the source of truth on boot.
      if (data.exists && data.state) {
        applyServerState(data.state);
      }

      // Now subscribe to all changes
      this.unsubStore = useStore.subscribe((next) => this.onChange(next));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.set({ enabled: false, lastError: msg });
    }
  }

  /** Called on every store change. Debounced. */
  private onChange(_state: AtelierStore) {
    if (!this.status.enabled) return;
    if (Date.now() - this.bootAt < STARTUP_GRACE_MS) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), DEBOUNCE_MS);
  }

  /** Flush whatever's in the store to the server. */
  async flush() {
    if (!this.status.enabled) return;
    if (this.inFlight) {
      // A PUT is already going; let it finish then schedule another flush
      await this.inFlight;
      this.timer = setTimeout(() => this.flush(), 200);
      return;
    }
    const state = serialise(useStore.getState());
    this.set({ syncing: true });
    this.inFlight = (async () => {
      try {
        const r = await fetch(SYNC_ENDPOINT, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            state,
            version: this.status.version,
            updatedBy: updatedByFingerprint(),
          }),
        });
        if (!r.ok) {
          throw new Error(`HTTP ${r.status}`);
        }
        const data = await r.json() as { ok: boolean; version: number; updatedAt: number };
        this.set({
          version: data.version,
          lastSavedAt: data.updatedAt,
          syncing: false,
          lastError: null,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.set({ syncing: false, lastError: msg });
      } finally {
        this.inFlight = null;
      }
    })();
  }

  /** Force a fresh pull from server, overwriting local state. */
  async reloadFromServer() {
    const r = await fetch(SYNC_ENDPOINT);
    if (!r.ok) return;
    const data = await r.json();
    if (data.exists && data.state) applyServerState(data.state);
    this.set({
      version: data.version ?? 0,
      remoteUpdatedAt: data.updatedAt ?? null,
      remoteUpdatedBy: data.updatedBy ?? '',
    });
  }
}

export const draftSync = new DraftSync();

// What we ship to the server. Just the fields that matter for collaboration —
// not the UI-only state like `hasOpenedBefore` or `lastPlannerPrompt`.
function serialise(s: AtelierStore) {
  return {
    selectedOrder: s.selectedOrder,
    deferrals: s.deferrals,
    priorities: s.priorities,
    assumptions: s.assumptions,
    log: s.log.slice(0, 30),   // cap the log on what we ship; older entries stay local
    snapshots: s.snapshots,     // snapshots are also synced — admin views read from /api/admin/snapshots
  };
}

// Apply a server-fetched state to the store. Skip UI-only fields so the user's
// local "have I opened this before" state isn't overwritten.
function applyServerState(serverState: Partial<AtelierStore>) {
  useStore.setState((prev) => ({
    ...prev,
    selectedOrder: serverState.selectedOrder ?? prev.selectedOrder,
    deferrals: serverState.deferrals ?? prev.deferrals,
    priorities: serverState.priorities ?? prev.priorities,
    assumptions: serverState.assumptions ?? prev.assumptions,
    log: serverState.log ?? prev.log,
    snapshots: serverState.snapshots ?? prev.snapshots,
  }));
}

// Returns a short, persisted-locally identifier so the "edited by" indicator
// shows something stable across sessions on this device. The actual user name
// is Maggie's in the finalize flow — for in-progress edits this is just a
// device tag like "Safari · Mac".
function updatedByFingerprint(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent || '';
  // Pull a simple browser + OS hint
  const browser =
    ua.includes('Edg/') ? 'Edge' :
    ua.includes('Chrome/') ? 'Chrome' :
    ua.includes('Firefox/') ? 'Firefox' :
    ua.includes('Safari/') ? 'Safari' : 'browser';
  const os =
    ua.includes('Mac') ? 'Mac' :
    ua.includes('Windows') ? 'Windows' :
    ua.includes('Linux') ? 'Linux' :
    ua.includes('iPhone') || ua.includes('iPad') ? 'iOS' :
    ua.includes('Android') ? 'Android' : 'device';
  return `${browser} · ${os}`;
}
