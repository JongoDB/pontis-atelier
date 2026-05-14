import { useMemo, useState } from 'react';
import { Check, Plus, Sparkles, ArrowRight } from 'lucide-react';
import { cn } from '../lib/cn';
import { ALL_MODULES, MODULE_BY_ID } from '../data/data';
import { computeFscPlan } from '../lib/fsc-plan';
import { computeSummary } from '../lib/cost';
import { useStore } from '../store';
import { compactCurrency, compactNumber } from '../lib/format';

interface Props {
  onGoToPlan: () => void;
}

export function FscRecommended({ onGoToPlan }: Props) {
  const plan = useMemo(() => computeFscPlan(ALL_MODULES), []);
  const selectedOrder = useStore((s) => s.selectedOrder);
  const selectMany = useStore((s) => s.selectMany);
  const assumptions = useStore((s) => s.assumptions);
  const [applied, setApplied] = useState(false);

  const selectedSet = useMemo(() => new Set(selectedOrder), [selectedOrder]);
  const missingCount = plan.allIds.filter((id) => !selectedSet.has(id)).length;

  // What the plan looks like if applied — totals computed against the catalog
  // entries for every direct + transitive pick, with no deferrals.
  const summary = useMemo(() => {
    const mods = plan.allIds
      .map((id) => MODULE_BY_ID.get(id))
      .filter(Boolean) as typeof ALL_MODULES;
    return computeSummary(mods, new Map(), assumptions);
  }, [plan.allIds, assumptions]);

  const apply = () => {
    const fresh = plan.allIds.filter((id) => !selectedOrder.includes(id));
    if (fresh.length === 0) {
      setApplied(true);
      return;
    }
    selectMany(fresh, `fsc recommended plan applied · ${fresh.length} module${fresh.length === 1 ? '' : 's'} added`);
    setApplied(true);
  };

  return (
    <div className="px-6 md:px-10 py-10 md:py-14 max-w-[1600px] mx-auto">
      {/* Headline */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
        <div className="md:col-span-8">
          <p className="eyebrow">fsc recommends · curated by the firm building pontis</p>
          <h1 className="font-display text-display-lg text-midnight mt-2 leading-tight">
            if we were maggie,<br />
            <span className="italic font-light text-burnt">we'd start here.</span>
          </h1>
          <p className="mt-5 text-burnt text-[15px] leading-relaxed max-w-2xl">
            three tiers, picked in this order: get the foundations down so nothing breaks,
            ship the few modules that unblock the rest of the catalog, then pick up the highest-roi
            piece in each phase of your business so pontis lifts the whole arc — not just one moment of it.
          </p>
        </div>
        <div className="md:col-span-4 flex md:justify-end">
          <button
            type="button"
            onClick={apply}
            disabled={missingCount === 0}
            className={cn(
              'flex items-center gap-2 px-5 py-3 rounded-sm text-sm font-medium transition-colors',
              missingCount === 0
                ? 'bg-bone text-burnt cursor-default'
                : 'bg-midnight text-pearl hover:bg-ink'
            )}
          >
            {missingCount === 0 ? (
              <>
                <Check size={14} strokeWidth={2.5} />
                all {plan.allIds.length} already in your plan
              </>
            ) : (
              <>
                <Plus size={14} strokeWidth={2.5} />
                apply {missingCount} module{missingCount === 1 ? '' : 's'} to my plan
              </>
            )}
          </button>
        </div>
      </div>

      {applied && missingCount === 0 && (
        <div className="mt-6 p-4 bg-laser/30 border-l-2 border-midnight flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-midnight text-sm">applied. fsc's recommended plan is now in "my plan."</p>
            <p className="text-xs text-burnt mt-0.5">
              tweak it, defer pieces, drop modules — it's your plan now. open the plan view to draw the gantt.
            </p>
          </div>
          <button
            onClick={onGoToPlan}
            className="px-4 py-2 bg-midnight text-pearl text-sm rounded-sm hover:bg-ink transition-colors whitespace-nowrap flex items-center gap-1.5"
          >
            open my plan
            <ArrowRight size={12} />
          </button>
        </div>
      )}

      {/* Bottom-line preview — what this plan delivers if applied as-is */}
      <section className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
        <PreviewStat
          label="modules total"
          value={plan.allIds.length.toString()}
          sub={`${plan.directIds.length} picks + ${plan.allIds.length - plan.directIds.length} prereqs`}
        />
        <PreviewStat
          label="hrs / yr saved"
          value={compactNumber(summary.totalHoursSaved)}
          sub={`firm-wide @ ${Math.round(assumptions.adoptionRate * 100)}% adoption`}
        />
        <PreviewStat
          label="coa 1+2 rom"
          value={compactCurrency(summary.billableROM)}
          sub={`${summary.retainerQuartersNeeded} quarter${summary.retainerQuartersNeeded === 1 ? '' : 's'} of retainer build`}
        />
        <PreviewStat
          label="annual $ saved"
          value={compactCurrency(summary.annualSavedInternal)}
          sub={`@ $${assumptions.internalRate}/hr internal · or ${compactCurrency(summary.annualSavedPrincipal)} @ principal`}
        />
      </section>

      {/* Tiers */}
      <div className="mt-14 space-y-12">
        {plan.tiers.map((tier, idx) => (
          <section key={tier.key}>
            <header className="grid grid-cols-12 gap-6 mb-6 items-baseline">
              <div className="col-span-12 md:col-span-7">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-sm text-clay tabular-nums">tier {idx + 1}</span>
                  <p className="eyebrow !text-burnt">{tier.label}</p>
                </div>
                <p className="mt-3 text-[15px] text-burnt leading-relaxed max-w-xl">
                  {tier.hook}
                </p>
              </div>
              <div className="hidden md:block col-span-1" />
              <div className="col-span-12 md:col-span-4 text-xs text-clay tabular-nums md:text-right">
                {tier.modules.length} module{tier.modules.length === 1 ? '' : 's'}
              </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tier.modules.map((entry) => {
                const m = MODULE_BY_ID.get(entry.id);
                if (!m) return null;
                const inPlan = selectedSet.has(entry.id);
                return (
                  <article
                    key={entry.id}
                    className={cn(
                      'rounded-sm border p-5 flex flex-col gap-3',
                      inPlan
                        ? 'border-midnight bg-laser/20'
                        : 'border-midnight/15 bg-bone'
                    )}
                  >
                    <header className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-[11px] text-burnt tabular-nums">{m.id}</span>
                      <span className={cn(
                        'text-[10px] uppercase tracking-widish px-2 py-0.5 rounded-full',
                        m.retainerCovered
                          ? 'bg-midnight text-pearl'
                          : 'border border-midnight/30 text-burnt'
                      )}>
                        {m.coa}
                      </span>
                    </header>
                    <h3 className="font-display text-base text-midnight leading-snug lowercase">
                      {m.name.toLowerCase()}
                    </h3>
                    <p className="text-[12px] text-burnt italic leading-relaxed">
                      {entry.rationale}
                    </p>
                    <footer className="mt-auto pt-2 flex items-baseline justify-between text-[11px] text-clay tabular-nums">
                      <span>
                        {m.hoursSavedPerYear != null ? `${m.hoursSavedPerYear} hrs/yr` : 'foundational'}
                      </span>
                      {inPlan && (
                        <span className="flex items-center gap-1 text-midnight">
                          <Check size={11} strokeWidth={2.5} />
                          in plan
                        </span>
                      )}
                    </footer>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* Bottom CTA */}
      <section className="mt-16 p-8 md:p-12 bg-midnight text-pearl rounded-sm grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        <div className="md:col-span-8">
          <p className="eyebrow !text-pearl/60 !tracking-[0.28em]">how to use this</p>
          <h3 className="font-display text-display text-pearl mt-2 leading-tight">
            apply it,<br />
            <span className="italic font-light text-pearl/70">then make it yours.</span>
          </h3>
          <p className="mt-3 text-sm text-pearl/70 leading-relaxed max-w-md">
            applying loads all {plan.allIds.length} modules into <em>my plan</em>. from there you can defer pieces,
            drop anything you don't want, re-order the gantt, and tune the cost assumptions. this is a starting point —
            <span className="text-pearl"> not a contract.</span>
          </p>
        </div>
        <div className="md:col-span-4 flex md:justify-end">
          <button
            type="button"
            onClick={() => { apply(); onGoToPlan(); }}
            disabled={missingCount === 0}
            className={cn(
              'flex items-center gap-2 px-6 py-3 rounded-sm font-medium transition-transform',
              missingCount === 0
                ? 'bg-pearl/20 text-pearl/60 cursor-default'
                : 'bg-laser text-midnight hover:scale-[1.02]'
            )}
          >
            <Sparkles size={14} />
            {missingCount === 0 ? 'already applied' : 'apply + open my plan'}
            {missingCount > 0 && <ArrowRight size={14} />}
          </button>
        </div>
      </section>
    </div>
  );
}

function PreviewStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-sm border border-midnight/15 bg-bone p-4">
      <p className="text-[10px] uppercase tracking-widish text-clay">{label}</p>
      <p className="font-display text-2xl text-midnight tabular-nums mt-1">{value}</p>
      <p className="text-[10px] text-burnt mt-1 leading-snug">{sub}</p>
    </div>
  );
}
