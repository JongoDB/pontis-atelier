import { useEffect, useState } from 'react';
import { Activity, TrendingUp } from 'lucide-react';
import { rollup, type TelemetryRollup, type TelemetryKind } from '../lib/telemetry';
import { useStore } from '../store';

const HUMAN_NAMES: Record<TelemetryKind, string> = {
  'page-view':       'page navigation',
  'module-select':   'add to plan',
  'module-deselect': 'remove from plan',
  'module-flip':     'today vs. pontis compare',
  'planner-submit':  'hey pontis ask',
  'planner-apply':   'apply suggested plan',
  'defer':           'defer module',
  'priority-set':    'rank module',
  'export-csv':      'csv export',
  'export-pdf':      'pdf export',
  'share-open':      'open share dialog',
  'undo':            'undo a change',
  'reset':           'reset plan',
  'module-request-submit': 'request a custom module',
};

const CORE_KINDS: TelemetryKind[] = [
  'module-select', 'planner-submit', 'module-flip', 'defer', 'priority-set', 'export-pdf', 'share-open',
];

export function TelemetryPanel() {
  // Subscribe to log changes so this panel refreshes when telemetry events
  // fire indirectly (e.g. from other components).
  const logVersion = useStore((s) => s.log.length);
  const [data, setData] = useState<TelemetryRollup>(() => rollup());

  useEffect(() => {
    setData(rollup());
    const tick = setInterval(() => setData(rollup()), 4000);
    return () => clearInterval(tick);
  }, [logVersion]);

  if (data.totalEvents === 0) return null;

  const adoptedThisWeek = CORE_KINDS.filter((k) => data.weeklyKindsUsed.includes(k)).length;
  const adoptionPct = Math.round((adoptedThisWeek / CORE_KINDS.length) * 100);
  const atGoal = adoptionPct >= 70;

  const topKinds = Object.entries(data.byKind)
    .filter(([, n]) => n > 0)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 6);

  return (
    <section className="mt-10 no-print">
      <header className="flex items-center justify-between gap-3 pb-3 border-b border-midnight/15">
        <div>
          <p className="eyebrow">adoption telemetry · the c3-f6 module · eating our dogfood</p>
          <h3 className="font-display text-xl text-midnight mt-1 lowercase flex items-baseline gap-2">
            {data.totalEvents.toLocaleString()} events
            <span className="text-burnt text-base font-light italic">over {data.uniqueDays} day{data.uniqueDays === 1 ? '' : 's'}</span>
          </h3>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2">
            <TrendingUp size={14} className={atGoal ? 'text-midnight' : 'text-burnt'} />
            <span className={atGoal ? 'text-midnight font-medium tabular-nums' : 'text-burnt tabular-nums'}>
              {adoptionPct}%
            </span>
          </div>
          <p className="text-[10px] text-clay mt-1 tabular-nums">
            ≥70% governance · {adoptedThisWeek}/{CORE_KINDS.length} core capabilities used this week
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-5">
        {topKinds.map(([k, n]) => {
          const max = Math.max(...topKinds.map(([, v]) => v as number));
          const pct = max > 0 ? ((n as number) / max) * 100 : 0;
          return (
            <div key={k}>
              <div className="flex items-baseline justify-between gap-2 text-[12px]">
                <span className="text-burnt truncate">{HUMAN_NAMES[k as TelemetryKind] ?? k}</span>
                <span className="tabular-nums text-midnight font-medium shrink-0">{n as number}</span>
              </div>
              <div className="h-px mt-0.5 bg-midnight/10 overflow-hidden">
                <div className="h-full bg-midnight transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-5 text-[11px] text-clay italic leading-relaxed max-w-2xl">
        this panel runs entirely on your device. it's a working preview of the c3-f6 adoption
        telemetry module: the same pattern Pontis itself will use to enforce the ≥70% adoption
        stick-rate governance metric. capability below threshold gets redesigned or retired.
      </p>
    </section>
  );
}
