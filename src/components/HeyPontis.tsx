import { useEffect, useMemo, useRef, useState } from 'react';
import { X, ArrowRight, Sparkles, Check, ChevronRight } from 'lucide-react';
import { cn } from '../lib/cn';
import { ALL_MODULES, MODULE_BY_ID } from '../data/data';
import { useStore } from '../store';
import { buildDependencyIndex } from '../lib/dependencies';
import { plan, type PlannerResult } from '../lib/planner';
import { compactCurrency, compactNumber } from '../lib/format';
import { track } from '../lib/telemetry';

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
  const setLastPlannerPrompt = useStore((s) => s.setLastPlannerPrompt);
  const lastPrompt = useStore((s) => s.lastPlannerPrompt);
  const selectMany = useStore((s) => s.selectMany);
  const selectedOrder = useStore((s) => s.selectedOrder);
  const inputRef = useRef<HTMLInputElement>(null);

  const { byId } = useMemo(() => buildDependencyIndex(ALL_MODULES), []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 80);
      setPrompt(lastPrompt);
    }
    if (!open) setResult(null);
  }, [open, lastPrompt]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const submit = (text: string) => {
    if (!text.trim()) return;
    setLastPlannerPrompt(text);
    const r = plan({ prompt: text, modules: ALL_MODULES, byId });
    setResult(r);
    track('planner-submit', { intents: r.matchedIntents, picks: r.picks.length });
  };

  const applyPlan = () => {
    if (!result) return;
    const fresh = result.picks.filter((id) => !selectedOrder.includes(id));
    if (fresh.length === 0) return;
    selectMany(fresh, `hey pontis · ${prompt.slice(0, 60)}${prompt.length > 60 ? '…' : ''}`);
    track('planner-apply', { added: fresh.length });
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[6vh] md:pt-[10vh]">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute inset-0 bg-midnight/40 backdrop-blur-sm animate-fade"
      />
      <div className="relative w-full max-w-2xl bg-pearl rounded-sm shadow-2xl shadow-midnight/30 animate-riseIn overflow-hidden">
        <header className="flex items-center justify-between gap-3 px-6 pt-5 pb-3 border-b border-midnight/10">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-laser animate-pulseDot" />
            <p className="eyebrow !tracking-[0.28em]">hey pontis</p>
          </div>
          <button onClick={onClose} className="p-1 text-burnt hover:text-midnight transition-colors" aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <form
          onSubmit={(e) => { e.preventDefault(); submit(prompt); }}
          className="px-6 pt-7 pb-5"
        >
          <div className="flex items-center gap-2 pb-3 border-b-2 border-midnight">
            <Sparkles size={16} className="text-burnt shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="build me a plan that…"
              className="w-full bg-transparent text-lg md:text-xl placeholder-clay/60 focus:outline-none text-midnight font-display tracking-tight"
            />
            <button
              type="submit"
              className="p-2 rounded-full bg-midnight text-pearl hover:bg-ink transition-colors disabled:opacity-30"
              disabled={!prompt.trim()}
              aria-label="Submit"
            >
              <ArrowRight size={14} />
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
                this is a rule-based planner (open source — see <span className="font-mono">src/lib/planner.ts</span>).
                it parses pain keywords (closeout, pipeline, voice…), section names, $-caps, and module caps. if you set
                a <span className="font-mono">VITE_ANTHROPIC_KEY</span> env var, future versions will route through claude
                for the parsing.
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
                className="text-sm text-burnt hover:text-midnight px-3 py-2"
              >
                edit prompt
              </button>
              <button
                type="button"
                onClick={applyPlan}
                className="ml-auto flex items-center gap-2 px-5 py-2.5 rounded-sm bg-midnight text-pearl hover:bg-ink transition-colors text-sm"
              >
                add to my plan
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
