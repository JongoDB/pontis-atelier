import { useEffect, useMemo } from 'react';
import {
  X, Plus, Check, Clock, Calendar, DollarSign, TrendingUp,
  AlertTriangle, MoveRight, Layers, GitBranch,
} from 'lucide-react';
import { cn } from '../lib/cn';
import { useStore } from '../store';
import { ALL_MODULES, MODULE_BY_ID, SECTION_BY_KEY, DEP_INDEX } from '../data/data';
import { missingDependencies, expandPrerequisites } from '../lib/dependencies';
import { compactCurrency, hours as fmtHours, currency } from '../lib/format';
import type { PontisModule } from '../types';
import { track } from '../lib/telemetry';
import { useModal } from '../lib/useModal';

interface DeepDiveProps {
  module: PontisModule | null;
  onClose: () => void;
}

const { byId, dependents } = DEP_INDEX;

export function ModuleDeepDive({ module: m, onClose }: DeepDiveProps) {
  const selectedOrder = useStore((s) => s.selectedOrder);
  const assumptions = useStore((s) => s.assumptions);
  const toggle = useStore((s) => s.toggle);
  const selectMany = useStore((s) => s.selectMany);
  const { labelId } = useModal(!!m, onClose);

  const selected = m ? selectedOrder.includes(m.id) : false;
  const selectedSet = useMemo(() => new Set(selectedOrder), [selectedOrder]);

  // Modules that depend on this one (downstream). The Pontis story is
  // dependency-rich — Maggie should see what shipping THIS unblocks.
  const downstreamIds = m ? (dependents.get(m.id) ?? []) : [];

  // Prerequisite modules (upstream).
  const upstreamIds = m ? m.dependencies : [];

  // Missing prereqs if this is selected
  const missing = useMemo(
    () => (selected && m ? missingDependencies(m, selectedSet, byId) : []),
    [selected, m, selectedSet]
  );

  // Modules in the same lifecycle phase + section — "sibling" suggestions
  const siblings = useMemo(() => {
    if (!m) return [] as PontisModule[];
    return ALL_MODULES
      .filter((x) => x.id !== m.id && x.sectionKey === m.sectionKey)
      .slice(0, 4);
  }, [m]);

  useEffect(() => {
    if (!m) return;
    track('module-flip', { id: m.id, kind: 'deep-dive' });
  }, [m]);

  if (!m) return null;

  const section = SECTION_BY_KEY.get(m.sectionKey);
  const annualInternal = (m.hoursSavedPerYear ?? 0) * assumptions.internalRate * (assumptions.adoptionRate / 0.7);
  const annualPrincipal = (m.hoursSavedPerYear ?? 0) * assumptions.principalRate * (assumptions.adoptionRate / 0.7);
  const fiveYear = annualInternal * 5;

  const handleSelect = () => {
    toggle(m.id, { label: `${selected ? 'removed' : 'selected'} ${m.id} · ${m.name} (from deep-dive)` });
  };

  const handleAddPrereqs = () => {
    const prereqs = expandPrerequisites(m.id, byId).filter((id) => !selectedSet.has(id));
    if (prereqs.length === 0) return;
    selectMany(prereqs, `auto-pulled in prereqs for ${m.id} (from deep-dive)`);
  };

  // Lifecycle phase, cleaned up
  const phase = (m.lifecyclePhase || 'Cross-cutting').replace(/^\d+\.\s+/, '');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelId}
      className="fixed inset-0 z-50 flex items-stretch justify-center overflow-y-auto"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        tabIndex={-1}
        className="fixed inset-0 bg-midnight/40 backdrop-blur-sm animate-fade"
      />

      <article className="relative w-full max-w-4xl bg-pearl my-6 md:my-10 mx-4 mb-[max(env(safe-area-inset-bottom),24px)] rounded-sm shadow-2xl shadow-midnight/30 animate-riseIn">
        {/* Sticky header */}
        <header className="sticky top-0 z-10 bg-pearl border-b border-midnight/15">
          <div className="flex items-start justify-between gap-4 px-6 md:px-10 py-5">
            <div className="flex items-center gap-3 flex-wrap min-w-0">
              <span className={cn(
                'flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] tracking-tight',
                m.retainerCovered ? 'bg-midnight text-pearl' : 'border border-midnight/30 text-burnt'
              )}>
                <span className={cn('w-1.5 h-1.5 rounded-full', m.retainerCovered ? 'bg-laser' : 'bg-burnt')} aria-hidden="true" />
                {m.coa}
              </span>
              <span className="font-mono text-[12px] tabular-nums text-burnt">{m.id}</span>
              <span className="text-clay/50" aria-hidden="true">·</span>
              <span className="text-[12px] text-burnt">§{m.sectionKey} {section?.name?.toLowerCase()}</span>
            </div>
            <button
              onClick={onClose}
              className="p-2 -mr-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-burnt hover:text-midnight transition-colors"
              aria-label="Close module details"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="px-6 md:px-10 py-8 md:py-10">
          {/* Headline + outcome */}
          <h2 id={labelId} className="font-display text-display-lg text-midnight leading-tight lowercase">
            {m.name}
          </h2>
          {m.desiredOutcome && (
            <blockquote className="mt-5 text-burnt text-[16px] italic leading-relaxed max-w-3xl border-l-2 border-laser pl-4">
              "{m.desiredOutcome}"
            </blockquote>
          )}

          {/* Action bar */}
          <div className="mt-7 flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleSelect}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-sm text-sm transition-colors',
                selected
                  ? 'bg-midnight text-pearl hover:bg-ink'
                  : 'border border-midnight text-midnight hover:bg-midnight hover:text-pearl'
              )}
            >
              {selected ? <Check size={14} strokeWidth={2.5} /> : <Plus size={14} />}
              <span>{selected ? 'in my plan · remove' : 'add to my plan'}</span>
            </button>
            {selected && missing.length > 0 && (
              <button
                type="button"
                onClick={handleAddPrereqs}
                className="flex items-center gap-2 px-4 py-2.5 rounded-sm bg-laser text-midnight text-sm hover:bg-laser/90"
              >
                <AlertTriangle size={14} strokeWidth={2.5} />
                add {missing.length} missing prereq{missing.length === 1 ? '' : 's'}
              </button>
            )}
            <span className="text-[11px] text-clay italic ml-auto">
              {phase} · {m.timeLabel}
            </span>
          </div>

          {/* Quick stats */}
          <section className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat
              icon={<Clock size={12} />}
              label="time to deliver"
              value={m.timeLabel.replace(/\s*\([^)]*\)/, '')}
            />
            <Stat
              icon={<DollarSign size={12} />}
              label={m.retainerCovered ? 'cost to ĒSO' : 'COA 1+2 ROM'}
              value={m.retainerCovered ? 'retainer-covered' : compactCurrency(m.rom)}
              sub={m.retainerCovered ? `${assumptions.retainerPerQuarter}/qtr already paid` : `${m.billableHours ?? 0} hrs @ $100/hr`}
            />
            <Stat
              icon={<TrendingUp size={12} />}
              label="hours saved / yr"
              value={m.hoursSavedPerYear != null ? fmtHours(m.hoursSavedPerYear) : '—'}
              sub={m.hoursSavedPerYear != null ? `at ≥ ${Math.round(assumptions.adoptionRate * 100)}% adoption` : 'foundational; non-quantified'}
            />
            <Stat
              icon={<Calendar size={12} />}
              label="lifecycle phase"
              value={phase.toLowerCase()}
            />
          </section>

          {/* Business value */}
          {m.hoursSavedPerYear != null && (
            <section className="mt-10 pt-8 border-t border-midnight/10">
              <p className="eyebrow !text-burnt mb-4">business value · annual + cumulative</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <ValueCard
                  label="@ internal rate"
                  rate={`$${assumptions.internalRate}/hr`}
                  annual={annualInternal}
                  fiveYear={fiveYear}
                />
                <ValueCard
                  label="@ principal rate"
                  rate={`$${assumptions.principalRate}/hr`}
                  annual={annualPrincipal}
                  fiveYear={annualPrincipal * 5}
                  accent
                />
                <ValueCard
                  label="cost per recovered hour"
                  rate={m.retainerCovered ? '$0 marginal' : `$${m.rom} / ${m.hoursSavedPerYear} hrs`}
                  annual={m.retainerCovered ? 0 : m.rom / m.hoursSavedPerYear}
                  fiveYear={null}
                  alt
                />
              </div>
              <p className="mt-3 text-[11px] text-clay italic max-w-2xl">
                figures use your current assumption sliders ({Math.round(assumptions.adoptionRate * 100)}% adoption,
                ${assumptions.internalRate}/hr internal, ${assumptions.principalRate}/hr principal).
                tweak them in the cost panel on the plan page to see how this module's roi shifts.
              </p>
            </section>
          )}

          {/* What it does + what it replaces (today vs with pontis) */}
          <section className="mt-10 pt-8 border-t border-midnight/10 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock size={13} className="text-burnt" />
                <p className="eyebrow !text-burnt">today</p>
              </div>
              <p className="text-[14px] text-burnt leading-relaxed">
                {m.currentTool || 'today this work happens by hand, by memory, or not at all — there\'s no system holding it.'}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <MoveRight size={13} className="text-midnight" />
                <p className="eyebrow">with pontis</p>
              </div>
              <p className="text-[14px] text-midnight leading-relaxed">
                {m.description}
              </p>
            </div>
          </section>

          {/* Dependencies */}
          {(upstreamIds.length > 0 || downstreamIds.length > 0) && (
            <section className="mt-10 pt-8 border-t border-midnight/10">
              <p className="eyebrow !text-burnt mb-4">dependency graph</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <DepList
                  icon={<Layers size={13} />}
                  title={`needs first · ${upstreamIds.length} prerequisite${upstreamIds.length === 1 ? '' : 's'}`}
                  ids={upstreamIds}
                  empty="nothing — this is a foundation module."
                  selectedSet={selectedSet}
                />
                <DepList
                  icon={<GitBranch size={13} />}
                  title={`unblocks · ${downstreamIds.length} downstream module${downstreamIds.length === 1 ? '' : 's'}`}
                  ids={downstreamIds}
                  empty="nothing right now — but later modules may depend on this."
                  selectedSet={selectedSet}
                />
              </div>
            </section>
          )}

          {/* Matrix reference */}
          {m.matrixRef && (
            <section className="mt-10 pt-8 border-t border-midnight/10">
              <p className="eyebrow !text-burnt mb-2">automation opportunity matrix</p>
              <p className="text-[13px] text-burnt">
                this module corresponds to <span className="font-mono text-midnight">{m.matrixRef}</span> in fsc's 31-opportunity matrix.
                cross-referenced during the may 12 readout.
              </p>
            </section>
          )}

          {/* Siblings in same section */}
          {siblings.length > 0 && (
            <section className="mt-10 pt-8 border-t border-midnight/10">
              <p className="eyebrow !text-burnt mb-3">others in this section · {section?.name?.toLowerCase()}</p>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {siblings.map((s) => (
                  <li key={s.id} className="text-[13px] text-burnt">
                    <span className="font-mono text-[11px] text-clay tabular-nums mr-2">{s.id}</span>
                    <span className="text-midnight">{s.name.toLowerCase()}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Bottom etymology line for breathing */}
          <p className="mt-12 pt-6 border-t border-midnight/8 text-[11px] text-clay italic text-center">
            {section?.accent}
          </p>
        </div>
      </article>
    </div>
  );
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="p-3 border border-midnight/15 rounded-sm bg-pearl">
      <div className="flex items-center gap-1.5 text-burnt">{icon}<span className="text-[10px] uppercase tracking-widish">{label}</span></div>
      <p className="font-display text-lg text-midnight mt-1 tabular-nums lowercase">{value}</p>
      {sub && <p className="text-[10px] text-clay mt-0.5">{sub}</p>}
    </div>
  );
}

function ValueCard({
  label, rate, annual, fiveYear, accent, alt,
}: {
  label: string; rate: string; annual: number; fiveYear: number | null;
  accent?: boolean; alt?: boolean;
}) {
  return (
    <div className={cn(
      'p-4 rounded-sm border',
      accent ? 'border-laser bg-laser/10' : alt ? 'border-midnight/15 bg-bone/40' : 'border-midnight/15 bg-pearl'
    )}>
      <p className="eyebrow !text-burnt">{label}</p>
      <p className="text-[11px] text-clay mt-0.5">{rate}</p>
      <p className="font-display text-2xl text-midnight tabular-nums mt-2">
        {alt ? currency(annual, 0) : compactCurrency(annual)}
        {!alt && <span className="text-base text-burnt"> /yr</span>}
      </p>
      {fiveYear !== null && (
        <p className="text-[11px] text-clay mt-1 tabular-nums">
          <span className="text-burnt">5-year</span> · {compactCurrency(fiveYear)}
        </p>
      )}
    </div>
  );
}

function DepList({
  icon, title, ids, empty, selectedSet,
}: {
  icon: React.ReactNode; title: string; ids: string[]; empty: string; selectedSet: Set<string>;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-burnt">{icon}</span>
        <p className="eyebrow !text-burnt">{title}</p>
      </div>
      {ids.length === 0 ? (
        <p className="text-[12px] text-clay italic">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {ids.map((id) => {
            const dep = MODULE_BY_ID.get(id);
            if (!dep) return null;
            const inPlan = selectedSet.has(id);
            return (
              <li key={id} className="flex items-baseline gap-2 text-[12px]">
                <span className={cn('font-mono tabular-nums shrink-0', inPlan ? 'text-midnight' : 'text-burnt')}>{id}</span>
                <span className="text-burnt truncate">{dep.name.toLowerCase()}</span>
                {inPlan && <Check size={10} className="text-midnight shrink-0" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
