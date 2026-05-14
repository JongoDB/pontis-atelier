import { useState, useMemo, useEffect, useRef } from 'react';
import { Check, Plus, AlertTriangle, MessageSquareQuote, MoveRight, Clock, Sparkles, Pin } from 'lucide-react';
import type { PontisModule } from '../types';
import { cn } from '../lib/cn';
import { useStore } from '../store';
import { ALL_MODULES, MODULE_BY_ID } from '../data/data';
import { buildDependencyIndex, missingDependencies, expandPrerequisites } from '../lib/dependencies';
import { hours, compactCurrency } from '../lib/format';
import { track as trackTelemetry } from '../lib/telemetry';

// Priority picker: small popover with 1 / 2 / 3 chips. Used to overlay Maggie's
// rack/stack onto FSC's suggested sequence.
function PriorityPicker({
  value, onChange,
}: { value: number | null; onChange: (p: number | null) => void }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={value == null ? 'set priority (your rack/stack)' : `priority ${value} · click to change`}
        className={cn(
          'p-2 transition-colors',
          value == null ? 'text-burnt hover:text-midnight' : 'text-midnight'
        )}
        aria-label="Set priority"
      >
        {value == null ? <Pin size={14} /> : (
          <span className="flex items-center justify-center w-4 h-4 rounded-full bg-laser text-midnight text-[10px] font-medium tabular-nums">{value}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-2 z-30 bg-midnight text-pearl p-3 rounded-sm shadow-xl">
          <p className="eyebrow !text-pearl/70 !text-[0.55rem] mb-2 whitespace-nowrap">rack / stack priority</p>
          <div className="flex items-center gap-1">
            {[1, 2, 3].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => { onChange(p); setOpen(false); }}
                className={cn(
                  'flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium transition-colors tabular-nums',
                  value === p
                    ? 'bg-laser text-midnight'
                    : 'bg-pearl/10 text-pearl hover:bg-pearl/20'
                )}
              >
                {p}
              </button>
            ))}
            {value != null && (
              <button
                type="button"
                onClick={() => { onChange(null); setOpen(false); }}
                className="ml-2 text-[10px] text-pearl/60 hover:text-laser"
              >
                clear
              </button>
            )}
          </div>
          <p className="mt-2 text-[10px] text-pearl/50 leading-snug max-w-[180px]">
            1 = do first. fsc's suggested sequence is still informational underneath.
          </p>
        </div>
      )}
    </div>
  );
}

interface ModuleCardProps {
  module: PontisModule;
  density?: 'normal' | 'compact';
  className?: string;
  /** Fire when the user clicks the sparkle/deep-dive icon. */
  onOpenDeepDive?: (module: PontisModule) => void;
}

const { byId } = buildDependencyIndex(ALL_MODULES);

export function ModuleCard({ module: m, density = 'normal', className, onOpenDeepDive }: ModuleCardProps) {
  const [flipped, setFlipped] = useState(false);
  const selectedOrder = useStore((s) => s.selectedOrder);
  const toggle = useStore((s) => s.toggle);
  const selectMany = useStore((s) => s.selectMany);
  const priorities = useStore((s) => s.priorities);
  const setPriority = useStore((s) => s.setPriority);
  const selected = selectedOrder.includes(m.id);
  const selectedSet = useMemo(() => new Set(selectedOrder), [selectedOrder]);
  const priority = priorities[m.id] ?? null;

  const missing = useMemo(
    () => (selected ? missingDependencies(m, selectedSet, byId) : []),
    [selected, m, selectedSet]
  );

  const isCompact = density === 'compact';

  const handleSelect = () => {
    toggle(m.id, { label: `${selected ? 'removed' : 'selected'} ${m.id} · ${m.name}` });
    trackTelemetry(selected ? 'module-deselect' : 'module-select', { id: m.id, section: m.sectionKey });
  };

  const handleAutoResolve = () => {
    const prereqs = expandPrerequisites(m.id, byId).filter((id) => !selectedSet.has(id));
    if (prereqs.length === 0) return;
    selectMany(prereqs, `auto-pulled in prereqs for ${m.id}`);
  };

  // COA accent
  const coaTone =
    m.coa === 'COA 1' ? { dot: 'bg-clay', label: 'M365', subdued: 'text-clay' } :
    m.coa === 'COA 2' ? { dot: 'bg-burnt', label: 'Claude', subdued: 'text-burnt' } :
    { dot: 'bg-midnight', label: 'Pontis', subdued: 'text-midnight' };

  return (
    <div
      className={cn(
        'card-flip group relative',
        className
      )}
      data-flipped={flipped}
    >
      <div className={cn('card-flip-inner', isCompact ? 'h-[280px]' : 'h-[360px]')}>
        {/* ---------- Front (decision face) ---------- */}
        <article
          className={cn(
            'card-flip-face absolute inset-0 flex flex-col rounded-sm border bg-pearl transition-all duration-300',
            selected
              ? 'border-midnight shadow-[0_2px_0_0_var(--midnight)]'
              : 'border-midnight/10 hover:border-midnight/30 hover:shadow-[0_1px_0_0_rgba(33,65,68,0.18)]'
          )}
        >
          {/* Selected indicator: a quiet midnight stripe down the left edge */}
          {selected && (
            <span
              aria-hidden="true"
              className="absolute left-0 top-0 bottom-0 w-1 bg-midnight rounded-l-sm pointer-events-none"
            />
          )}
          {/* Top row: id + COA + flip trigger */}
          <header className="flex items-center justify-between gap-2 px-5 pt-4 pb-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', coaTone.dot)} />
              <span className={cn('font-mono text-[0.6875rem] tracking-tight tabular-nums', coaTone.subdued)}>
                {m.id}
              </span>
              <span className="text-clay/50 text-[0.6875rem]">·</span>
              <span className="text-clay text-[0.6875rem] tracking-widish uppercase">{coaTone.label}</span>
              {priority != null && (
                <span
                  title={`priority ${priority} · click to clear`}
                  onClick={(e) => { e.stopPropagation(); setPriority(m.id, null); }}
                  className="cursor-pointer flex items-center justify-center w-4 h-4 rounded-full bg-laser text-midnight text-[10px] font-medium tabular-nums hover:scale-110 transition-transform"
                >
                  {priority}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => { setFlipped(true); trackTelemetry('module-flip', { id: m.id }); }}
              className="flex items-center gap-1 text-burnt hover:text-midnight transition-colors text-[0.6875rem] tracking-tight focus:outline-none"
              aria-label="Show today vs with pontis comparison"
            >
              <MessageSquareQuote size={12} />
              <span className="hidden sm:inline">today · with pontis</span>
              <span className="sm:hidden">compare</span>
            </button>
          </header>

          {/* Name */}
          <div className="px-5">
            <h3
              title={m.name}
              className={cn(
                'font-display tracking-tight text-midnight',
                isCompact ? 'text-base leading-snug' : 'text-lg leading-snug'
              )}
            >
              {m.name.toLowerCase()}
            </h3>
          </div>

          {/* Desired outcome — load-bearing UX, italicized, ĒSO voice */}
          <div className="px-5 mt-3 grow">
            <p className={cn(
              'italic text-burnt font-light leading-relaxed',
              isCompact ? 'text-[13px] clamp-3' : 'text-[14px] clamp-3'
            )}>
              "{m.desiredOutcome}"
            </p>
          </div>

          {/* Stats strip */}
          <dl className="px-5 mt-4 grid grid-cols-3 gap-2 text-[11px] border-t border-midnight/10 pt-3">
            <div>
              <dt className="eyebrow !text-clay/70 !text-[0.625rem]">time</dt>
              <dd className="text-midnight font-medium mt-0.5 tabular-nums">
                {m.timeLabel.replace(/\s*\([^)]*\)/, '')}
              </dd>
            </div>
            <div>
              <dt className="eyebrow !text-clay/70 !text-[0.625rem]">cost</dt>
              <dd className="text-midnight font-medium mt-0.5 tabular-nums">
                {m.retainerCovered ? 'retainer' : compactCurrency(m.rom)}
              </dd>
            </div>
            <div className="text-right">
              <dt className="eyebrow !text-clay/70 !text-[0.625rem]">saves</dt>
              <dd className="text-midnight font-medium mt-0.5 tabular-nums">
                {m.hoursSavedPerYear != null ? hours(m.hoursSavedPerYear) + '/yr' : '—'}
              </dd>
            </div>
          </dl>

          {/* Bottom action bar */}
          <footer className="px-5 pb-4 pt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelect}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 text-sm tracking-tight transition-colors rounded-sm',
                selected
                  ? 'bg-midnight text-pearl hover:bg-ink'
                  : 'border border-midnight/30 text-midnight hover:bg-midnight hover:text-pearl'
              )}
            >
              {selected ? <Check size={14} strokeWidth={2.5} /> : <Plus size={14} />}
              <span>{selected ? 'in my plan' : 'add to plan'}</span>
            </button>
            {selected && (
              <PriorityPicker
                value={priority}
                onChange={(p) => setPriority(m.id, p)}
              />
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onOpenDeepDive?.(m); }}
              className="p-2 text-burnt hover:text-midnight transition-colors"
              title="See this module in depth — business value, dependencies, what changes"
              aria-label="Open module deep-dive"
            >
              <Sparkles size={14} />
            </button>
          </footer>

          {/* Selected: dependency risk indicator */}
          {selected && missing.length > 0 && (
            <button
              type="button"
              onClick={handleAutoResolve}
              className="absolute -top-2 -right-2 z-10 flex items-center gap-1.5 px-2.5 py-1 bg-laser text-midnight rounded-full text-[0.6875rem] font-medium shadow-md hover:scale-[1.04] transition-transform"
              title={`Missing: ${missing.map((d) => d.id).join(', ')} — click to auto-add prerequisites`}
            >
              <AlertTriangle size={11} strokeWidth={2.5} />
              <span>needs {missing.map((d) => d.id.replace('C3-', '')).join(', ')}</span>
            </button>
          )}
        </article>

        {/* ---------- Back (today vs. with pontis) ---------- */}
        <article
          className={cn(
            'card-flip-face card-flip-back rounded-sm border border-midnight/15 bg-bone text-midnight overflow-hidden'
          )}
        >
          <header className="flex items-center justify-between gap-2 px-5 pt-4 pb-3 border-b border-midnight/10">
            <span className="font-mono text-[0.6875rem] tracking-tight text-burnt tabular-nums">{m.id}</span>
            <button
              type="button"
              onClick={() => setFlipped(false)}
              className="text-[0.6875rem] text-burnt hover:text-midnight transition-colors tracking-tight"
              aria-label="Back to module"
            >
              ← back
            </button>
          </header>
          <div className="grid grid-cols-2 h-[calc(100%-46px)]">
            <div className="px-5 py-4 border-r border-midnight/10">
              <p className="eyebrow mb-3">today</p>
              <div className="flex items-start gap-1.5 text-burnt">
                <Clock size={13} className="shrink-0 mt-0.5 opacity-60" />
                <p className="text-[13px] leading-relaxed">
                  {m.currentTool || 'today this work happens by hand, by memory, or not at all.'}
                </p>
              </div>
              {m.lifecyclePhase && (
                <p className="mt-4 text-[0.6875rem] uppercase tracking-widish text-clay">
                  phase · {m.lifecyclePhase.replace(/^\d+\.\s+/, '')}
                </p>
              )}
            </div>
            <div className="px-5 py-4 bg-pearl">
              <div className="flex items-center gap-1.5 mb-3">
                <p className="eyebrow !text-midnight">with pontis</p>
                <MoveRight size={11} className="text-midnight" />
              </div>
              <p className="text-[13px] leading-relaxed text-midnight italic">
                "{m.desiredOutcome}"
              </p>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
