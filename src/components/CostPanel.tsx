import { useMemo } from 'react';
import { ALL_MODULES } from '../data/data';
import { useStore } from '../store';
import { computeSummary } from '../lib/cost';
import { compactCurrency, compactNumber, currency } from '../lib/format';
import { cn } from '../lib/cn';

interface CostPanelProps {
  variant?: 'sidebar' | 'page';
}

function Row({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3', highlight && 'pt-3 border-t border-midnight/15')}>
      <div>
        <p className={cn('text-[13px]', highlight ? 'text-midnight font-medium' : 'text-burnt')}>{label}</p>
        {sub && <p className="text-[10px] text-clay tracking-widish mt-0.5">{sub}</p>}
      </div>
      <p className={cn(
        'tabular-nums font-display',
        highlight ? 'text-2xl text-midnight' : 'text-base text-midnight'
      )}>
        {value}
      </p>
    </div>
  );
}

function Slider({
  label, value, onChange, min, max, step, format, hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="eyebrow !text-burnt">{label}</p>
        <p className="text-sm font-medium text-midnight tabular-nums">{format(value)}</p>
      </div>
      <input
        type="range"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="mt-1"
      />
      {hint && <p className="text-[10px] text-clay/80 mt-0.5">{hint}</p>}
    </div>
  );
}

export function CostPanel({ variant = 'sidebar' }: CostPanelProps) {
  const selectedOrder = useStore((s) => s.selectedOrder);
  const deferrals = useStore((s) => s.deferrals);
  const assumptions = useStore((s) => s.assumptions);
  const setAssumption = useStore((s) => s.setAssumption);

  const selectedModules = useMemo(
    () => selectedOrder.map((id) => ALL_MODULES.find((m) => m.id === id)).filter(Boolean) as typeof ALL_MODULES,
    [selectedOrder]
  );
  const deferralMap = useMemo(() => new Map(Object.entries(deferrals)), [deferrals]);
  const summary = useMemo(
    () => computeSummary(selectedModules, deferralMap, assumptions),
    [selectedModules, deferralMap, assumptions]
  );

  const isPage = variant === 'page';

  if (selectedOrder.length === 0 && !isPage) {
    return (
      <div className="p-6 text-center text-burnt">
        <p className="font-display text-lg italic">your plan is empty.</p>
        <p className="text-xs text-clay mt-2 leading-relaxed">
          select modules on the left.<br />the cost calculator and gantt redraw as you sketch.
        </p>
      </div>
    );
  }

  return (
    <div className={cn(isPage ? 'p-8' : 'p-6')}>
      {!isPage && (
        <div className="flex items-baseline justify-between mb-5">
          <p className="eyebrow">cost · saved · roi</p>
          <p className="text-[10px] text-clay tabular-nums">{selectedModules.length} selected</p>
        </div>
      )}

      <div className="space-y-3.5">
        <Row
          label="COA 1 + 2 ROM"
          sub="billable @ $100/hr"
          value={compactCurrency(summary.billableROM)}
        />
        <Row
          label="Pontis modules (COA 3)"
          sub={`retainer · ≈${summary.retainerQuartersNeeded} quarter${summary.retainerQuartersNeeded === 1 ? '' : 's'} of build`}
          value={summary.retainerModules.toString()}
        />
        <Row
          label="annual hours saved"
          sub="firm-wide, adjusted for adoption + deferrals"
          value={summary.totalHoursSaved > 0 ? `${compactNumber(summary.totalHoursSaved)} hrs` : '—'}
          highlight
        />
        <Row
          label={`$ saved @ $${assumptions.internalRate}/hr`}
          sub="internal blended rate"
          value={compactCurrency(summary.annualSavedInternal)}
        />
        <Row
          label={`$ saved @ $${assumptions.principalRate}/hr`}
          sub="maggie's principal rate (displaced value)"
          value={compactCurrency(summary.annualSavedPrincipal)}
        />
        <Row
          label="5-year cumulative"
          sub="internal rate · compounds"
          value={compactCurrency(summary.fiveYearInternal)}
        />
        {summary.costPerRecoveredHour > 0 && (
          <Row
            label="cost per recovered hour"
            sub="billable ROM ÷ annual hours saved · lower = sharper"
            value={currency(summary.costPerRecoveredHour, 0)}
          />
        )}
      </div>

      {summary.byPhase.length > 0 && (
        <div className="mt-7 pt-6 border-t border-midnight/15">
          <p className="eyebrow !text-burnt mb-3">by lifecycle phase</p>
          <p className="text-[10px] text-clay/80 mb-3 leading-relaxed">
            what each phase nets if shipped on its own — same hours-saved math, broken out.
          </p>
          <ul className="space-y-1.5">
            {summary.byPhase.map((p) => {
              const maxHours = Math.max(...summary.byPhase.map((x) => x.hoursSaved));
              const pct = maxHours > 0 ? (p.hoursSaved / maxHours) * 100 : 0;
              return (
                <li key={p.phase}>
                  <div className="flex items-baseline justify-between gap-2 text-[11px]">
                    <span className="text-burnt truncate">{p.phase.toLowerCase()}</span>
                    <span className="tabular-nums text-midnight font-medium shrink-0">
                      {p.hoursSaved > 0 ? `${Math.round(p.hoursSaved).toLocaleString()} hrs` : '—'}
                      {p.hoursSaved > 0 && (
                        <span className="text-clay/80 ml-1">· {compactCurrency(p.internalDollars)}/yr</span>
                      )}
                    </span>
                  </div>
                  <div className="h-px mt-0.5 bg-midnight/10 overflow-hidden">
                    <div className="h-full bg-midnight transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="mt-7 pt-6 border-t border-midnight/15">
        <p className="eyebrow !text-burnt mb-4">assumptions · stress-test the numbers</p>
        <div className="space-y-5">
          <Slider
            label="internal rate"
            value={assumptions.internalRate}
            onChange={(v) => setAssumption('internalRate', v)}
            min={40} max={150} step={5}
            format={(v) => `$${v}/hr`}
          />
          <Slider
            label="maggie's principal rate"
            value={assumptions.principalRate}
            onChange={(v) => setAssumption('principalRate', v)}
            min={150} max={300} step={5}
            format={(v) => `$${v}/hr`}
            hint="intake range was $175–$250"
          />
          <Slider
            label="adoption rate"
            value={assumptions.adoptionRate}
            onChange={(v) => setAssumption('adoptionRate', v)}
            min={0.3} max={1.0} step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            hint="below 70% = redesign or retire per kill criterion"
          />
          <Slider
            label="working weeks / year"
            value={assumptions.workingWeeks}
            onChange={(v) => setAssumption('workingWeeks', v)}
            min={40} max={52} step={1}
            format={(v) => `${v}`}
          />
        </div>
      </div>
    </div>
  );
}
