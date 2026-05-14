import { useEffect, useRef, useState } from 'react';
import { X, ArrowRight, Sparkles, Check, ChevronRight } from 'lucide-react';
import { cn } from '../lib/cn';
import { ALL_MODULES, MODULE_BY_ID, DEP_INDEX } from '../data/data';
import { useStore } from '../store';
import { runPlanner, type PlannerResult } from '../lib/planner-client';
import { compactCurrency, compactNumber } from '../lib/format';
import { track } from '../lib/telemetry';
import { useModal } from '../lib/useModal';

interface HeyPontisProps {
  open: boolean;
  onClose: () => void;
}

const STARTERS = [
  'highest hours-saved next quarter, max 5 modules',
  'focus on closeout pain first, then BD',
  'keep COA 1+2 ROM under $1,500',
  'fastest material savings — quick wins only',
  'voice flows + the pipeline they need',
];

export function HeyPontis({ open, onClose }: HeyPontisProps) {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<PlannerResult | null>(null);
  const [busy, setBusy] = useState(false);
  const setLastPlannerPrompt = useStore((s) => s.setLastPlannerPrompt);
  const lastPrompt = useStore((s) => s.lastPlannerPrompt);
  const selectMany = useStore((s) => s.selectMany);
  const selectedOrder = useStore((s) => s.selectedOrder);
  const inputRef = useRef<HTMLInputElement>(null);
  const { labelId } = useModal(open, onClose);
  const { byId } = DEP_INDEX;

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 80);
      setPrompt(lastPrompt);
    }
    if (!open) {
      setResult(null);
      setBusy(false);
    }
  }, [open, lastPrompt]);

  const submit = async (text: string) => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setLastPlannerPrompt(text);
    try {
      const r = await runPlanner({ prompt: text, modules: ALL_MODULES, byId });
      setResult(r);
      track('planner-submit', { source: r.source, intents: r.matchedIntents, picks: r.picks.length });
    } finally {
      setBusy(false);
    }
  };

  const applyPlan = () => {
    if (!result) return;
    const fresh = result.picks.filter((id) => !selectedOrder.includes(id));
    if (fresh.length === 0) return;
    selectMany(fresh, `hey pontis · ${prompt.slice(0, 60)}${prompt.length > 60 ? '…' : ''}`);
    track('planner-apply', { source: result.source, added: fresh.length });
    onClose();
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelId}
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[6vh] md:pt-[10vh] pb-[max(env(safe-area-inset-bottom),16px)]"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        tabIndex={-1}
        className="absolute inset-0 bg-midnight/40 backdrop-blur-sm animate-fade"
      />
      <div className="relative w-full max-w-2xl max-h-[88vh] flex flex-col bg-pearl rounded-sm shadow-2xl shadow-midnight/30 animate-riseIn overflow-hidden">
        <header className="flex items-center justify-between gap-3 px-6 pt-5 pb-3 border-b border-midnight/10">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-laser animate-pulseDot" aria-hidden="true" />
            <p id={labelId} className="eyebrow !tracking-[0.28em]">hey pontis</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-1 min-h-[44px] min-w-[44px] flex items-center justify-center text-burnt hover:text-midnight transition-colors"
            aria-label="Close planner"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="overflow-y-auto thin-scroll flex-1">
        <form
          onSubmit={(e) => { e.preventDefault(); submit(prompt); }}
          className="px-6 pt-7 pb-5"
        >
          <div className="flex items-center gap-2 pb-3 border-b-2 border-midnight">
            <Sparkles size={16} aria-hidden="true" className={cn('shrink-0', busy ? 'text-midnight animate-pulse' : 'text-burnt')} />
            <label htmlFor="heypontis-prompt" className="sr-only">Describe a plan for Pontis to draft</label>
            <input
              id="heypontis-prompt"
              ref={inputRef}
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={busy ? 'pontis is thinking…' : 'build me a plan that…'}
              disabled={busy}
              className="w-full bg-transparent text-base md:text-lg placeholder-clay/60 focus:outline-none text-midnight font-display tracking-tight disabled:opacity-60"
            />
            <button
              type="submit"
              className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full bg-midnight text-pearl hover:bg-ink transition-colors disabled:opacity-30"
              disabled={!prompt.trim() || busy}
              aria-label="Submit prompt"
            >
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </div>

          {!result && (
            <div className="mt-5">
              <p className="text-xs text-clay mb-3">try:</p>
              <div className="flex flex-wrap gap-2">
                {STARTERS.map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => { setPrompt(s); submit(s); }}
                    className="text-[12px] text-burnt hover:text-midnight px-3 py-1.5 border border-midnight/15 rounded-full hover:border-midnight transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
              <p className="mt-6 text-xs text-clay leading-relaxed">
                pontis sends your request to claude on the backend, with the full 101-module catalog as context.
                claude reads your intent, picks a slice, and writes back a plan in ĒSO's voice.
                <span className="text-burnt"> if the backend is unreachable, a built-in rule-based planner takes over
                so you can keep working.</span>
              </p>
            </div>
          )}
        </form>

        {result && (
          <div className="border-t border-midnight/10 bg-bone/40">
            <div className="px-6 py-5">
              <p className="text-[13px] text-burnt italic leading-relaxed">
                "{result.rationale}"
              </p>
              {result.matchedIntents.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {result.matchedIntents.map((i) => (
                    <span key={i} className="text-[10px] tracking-widish uppercase text-clay border border-clay/30 rounded-full px-2 py-0.5">
                      {i}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-midnight/10 grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="font-display text-2xl text-midnight tabular-nums">{result.estimates.moduleCount}</p>
                <p className="text-[10px] uppercase tracking-widish text-clay mt-0.5">modules</p>
              </div>
              <div>
                <p className="font-display text-2xl text-midnight tabular-nums">{compactCurrency(result.estimates.billableROM)}</p>
                <p className="text-[10px] uppercase tracking-widish text-clay mt-0.5">billable ROM</p>
              </div>
              <div>
                <p className="font-display text-2xl text-midnight tabular-nums">{compactNumber(result.estimates.hoursSaved)} hrs</p>
                <p className="text-[10px] uppercase tracking-widish text-clay mt-0.5">saved / yr</p>
              </div>
            </div>
            <div className="px-6 pb-4 max-h-[34vh] overflow-y-auto thin-scroll">
              <p className="eyebrow !text-burnt mb-2">recommended picks</p>
              <ul className="divide-y divide-midnight/8">
                {result.picks.map((id) => {
                  const m = MODULE_BY_ID.get(id);
                  if (!m) return null;
                  const alreadyIn = selectedOrder.includes(id);
                  return (
                    <li key={id} className="flex items-center gap-3 py-2">
                      <ChevronRight size={11} className="text-clay shrink-0" />
                      <span className="font-mono text-[11px] tabular-nums text-burnt w-12 shrink-0">{m.id}</span>
                      <span className="text-[13px] text-midnight truncate">{m.name.toLowerCase()}</span>
                      {alreadyIn && (
                        <span className="ml-auto flex items-center gap-1 text-[10px] text-clay">
                          <Check size={10} /> in plan
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="px-6 py-4 border-t border-midnight/10 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setResult(null)}
                className="text-sm text-burnt hover:text-midnight px-3 py-2 min-h-[40px]"
              >
                edit prompt
              </button>
              <button
                type="button"
                onClick={applyPlan}
                className="ml-auto flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-sm bg-midnight text-pearl hover:bg-ink transition-colors text-sm"
              >
                add to my plan
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
