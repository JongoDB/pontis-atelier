import { useEffect, useState } from 'react';
import { Cloud, CloudOff, CheckCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { draftSync, type SyncStatus } from '../lib/sync';
import { cn } from '../lib/cn';

// Small status chip in the chrome that tells the user whether their
// in-progress draft is synced to the backend. Three states:
//   - enabled + syncing       → "saving…" (clock spinner)
//   - enabled + clean         → "saved · Xs ago · Safari · Mac"
//   - enabled + error         → "couldn't save · click to retry"
//   - disabled (local-only)   → "local only" with help tooltip
export function SyncIndicator() {
  const [status, setStatus] = useState<SyncStatus>(draftSync.status);

  useEffect(() => {
    const unsub = draftSync.subscribe(setStatus);
    return () => unsub();
  }, []);

  const onClick = () => {
    if (status.lastError) draftSync.flush();
    else draftSync.reloadFromServer();
  };

  if (!status.enabled) {
    return (
      <button
        type="button"
        title="Backend draft sync isn't reachable. Your plan is still saved locally on this device — but it won't follow you to another browser until the server is reachable."
        className="hidden md:flex items-center gap-1.5 px-2 py-1 text-[11px] text-burnt hover:text-midnight transition-colors"
      >
        <CloudOff size={12} />
        <span>local only</span>
      </button>
    );
  }

  if (status.syncing) {
    return (
      <span className="hidden md:flex items-center gap-1.5 px-2 py-1 text-[11px] text-burnt">
        <RefreshCw size={12} className="animate-spin" />
        <span>saving…</span>
      </span>
    );
  }

  if (status.lastError) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={`Last error: ${status.lastError}. Click to retry.`}
        className="hidden md:flex items-center gap-1.5 px-2 py-1 text-[11px] text-burnt hover:text-midnight transition-colors"
      >
        <AlertTriangle size={12} />
        <span>retry sync</span>
      </button>
    );
  }

  const ago = status.lastSavedAt ? friendlyAgo(Date.now() - status.lastSavedAt) : null;
  const remote = status.remoteUpdatedBy;

  return (
    <button
      type="button"
      onClick={onClick}
      title={`Synced to server${remote ? ` · last edit by ${remote}` : ''}${status.remoteUpdatedAt ? ` at ${new Date(status.remoteUpdatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''}. Click to re-pull.`}
      className={cn(
        'hidden md:flex items-center gap-1.5 px-2 py-1 text-[11px] transition-colors',
        ago ? 'text-clay hover:text-midnight' : 'text-clay/70'
      )}
    >
      {ago ? <CheckCircle size={12} className="text-midnight" /> : <Cloud size={12} />}
      <span>{ago ? `saved ${ago}` : 'synced'}</span>
    </button>
  );
}

function friendlyAgo(ms: number): string {
  if (ms < 5_000) return 'just now';
  if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`;
  if (ms < 60 * 60_000) return `${Math.round(ms / 60_000)}m ago`;
  return `${Math.round(ms / 3_600_000)}h ago`;
}
