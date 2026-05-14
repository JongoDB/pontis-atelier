import { useEffect, useMemo, useState } from 'react';
import { X, Link2, Check, Copy } from 'lucide-react';
import { useStore } from '../store';
import { encodePlan, buildShareURL, decodePlan, clearShareHash } from '../lib/share';
import { MODULE_BY_ID } from '../data/data';
import { cn } from '../lib/cn';

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ShareDialog({ open, onClose }: ShareDialogProps) {
  const selectedOrder = useStore((s) => s.selectedOrder);
  const deferrals = useStore((s) => s.deferrals);
  const priorities = useStore((s) => s.priorities);
  const [copied, setCopied] = useState(false);

  const url = useMemo(() => {
    const enc = encodePlan({ selected: selectedOrder, deferrals, priorities });
    return buildShareURL(enc);
  }, [selectedOrder, deferrals, priorities]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — user can still select-and-copy from the input
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
      <button onClick={onClose} aria-label="Close" className="absolute inset-0 bg-midnight/40 backdrop-blur-sm animate-fade" />
      <div className="relative w-full max-w-lg bg-pearl rounded-sm shadow-2xl shadow-midnight/30 animate-riseIn">
        <header className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-midnight/10">
          <div className="flex items-center gap-2">
            <Link2 size={14} className="text-burnt" />
            <p className="eyebrow !tracking-[0.28em]">share this plan</p>
          </div>
          <button onClick={onClose} className="p-1 text-burnt hover:text-midnight" aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="px-6 py-6">
          <h2 className="font-display text-xl text-midnight lowercase">
            send maggie's plan to carli, jerry, or anyone.
          </h2>
          <p className="text-sm text-burnt mt-2 leading-relaxed">
            this URL carries your current selections, deferrals, and rack/stack — no backend. whoever opens it sees the same plan, and can edit a copy of it without touching yours.
          </p>

          <div className="mt-6 flex items-stretch gap-2">
            <input
              type="text"
              readOnly
              value={url}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="flex-1 min-w-0 px-3 py-2 bg-bone/60 border border-midnight/15 rounded-sm text-xs font-mono text-midnight focus:outline-none focus:border-midnight"
            />
            <button
              type="button"
              onClick={copy}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-sm transition-colors text-sm',
                copied
                  ? 'bg-laser text-midnight'
                  : 'bg-midnight text-pearl hover:bg-ink'
              )}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? 'copied' : 'copy'}</span>
            </button>
          </div>

          <div className="mt-6 pt-5 border-t border-midnight/10 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="font-display text-xl text-midnight tabular-nums">{selectedOrder.length}</p>
              <p className="text-[10px] uppercase tracking-widish text-clay">modules</p>
            </div>
            <div>
              <p className="font-display text-xl text-midnight tabular-nums">{Object.values(deferrals).filter((w) => w > 0).length}</p>
              <p className="text-[10px] uppercase tracking-widish text-clay">deferred</p>
            </div>
            <div>
              <p className="font-display text-xl text-midnight tabular-nums">{Object.keys(priorities).length}</p>
              <p className="text-[10px] uppercase tracking-widish text-clay">ranked</p>
            </div>
          </div>

          <p className="mt-5 text-[11px] text-clay italic leading-relaxed">
            note: this link is read-by-reader. recipient can "make it mine" to overwrite their plan, otherwise the link is a preview only. nothing leaves your browser.
          </p>
        </div>
      </div>
    </div>
  );
}

// Banner shown when arriving via a #plan=… URL
export function SharedPlanBanner() {
  const [shared, setShared] = useState(() => {
    if (typeof window === 'undefined') return null;
    const hash = window.location.hash;
    if (!hash.startsWith('#plan=')) return null;
    const enc = hash.slice('#plan='.length);
    return decodePlan(enc);
  });
  const applyShared = useStore((s) => s.applyShared);

  if (!shared) return null;

  const accept = () => {
    applyShared({
      selected: shared.s,
      deferrals: shared.d ?? {},
      priorities: shared.p ?? {},
    });
    clearShareHash();
    setShared(null);
  };
  const dismiss = () => {
    clearShareHash();
    setShared(null);
  };

  return (
    <div className="bg-midnight text-pearl no-print">
      <div className="max-w-[1600px] mx-auto px-6 md:px-10 py-3 flex items-center gap-4 flex-wrap">
        <Link2 size={14} className="text-laser shrink-0" />
        <p className="text-sm flex-1 min-w-0">
          someone shared a plan with you. {shared.s.length} modules
          {(shared.d && Object.keys(shared.d).length > 0) && `, ${Object.keys(shared.d).length} deferred`}
          {(shared.p && Object.keys(shared.p).length > 0) && `, ${Object.keys(shared.p).length} ranked`}.
          {' '}
          <span className="text-pearl/60">accepting will overwrite your current plan.</span>
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={dismiss}
            className="text-xs text-pearl/70 hover:text-pearl px-3 py-1.5"
          >
            keep mine
          </button>
          <button
            type="button"
            onClick={accept}
            className="text-xs bg-laser text-midnight px-3 py-1.5 rounded-sm hover:bg-laser/90"
          >
            make this mine →
          </button>
        </div>
      </div>
    </div>
  );
}

function modulesMissing(ids: string[]): string[] {
  return ids.filter((id) => !MODULE_BY_ID.has(id));
}
