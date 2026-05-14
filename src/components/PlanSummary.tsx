import { useMemo, useState } from 'react';
import { Download, Printer, RotateCcw, Trash2, Plus, Link2, Check, ArrowRight, Sparkles } from 'lucide-react';
import { cn } from '../lib/cn';
import { ALL_MODULES, SECTION_BY_KEY, ROADMAP } from '../data/data';
import { useStore } from '../store';
import { buildDependencyIndex, missingDependencies, expandPrerequisites } from '../lib/dependencies';
import { computeSummary } from '../lib/cost';
import { compactCurrency, compactNumber, hours, formatTime } from '../lib/format';
import { downloadCSV, exportPDF } from '../lib/export';
import { CostPanel } from './CostPanel';
import { Gantt } from './Gantt';
import { ShareDialog } from './Share';
import { track } from '../lib/telemetry';
import { TelemetryPanel } from './Telemetry';
import { FinalizeFlow } from './Finalize';
import { buildSchedule } from '../lib/schedule';

export function PlanPage() {
  const selectedOrder = useStore((s) => s.selectedOrder);
  const deferrals = useStore((s) => s.deferrals);
  const log = useStore((s) => s.log);
  const reset = useStore((s) => s.reset);
  const undo = useStore((s) => s.undo);
  const toggle = useStore((s) => s.toggle);
  const defer = useStore((s) => s.defer);
  const selectMany = useStore((s) => s.selectMany);
  const assumptions = useStore((s) => s.assumptions);

  const [showLog, setShowLog] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const snapshots = useStore((s) => s.snapshots);
  const latestSnapshot = snapshots[0];
  const { byId } = useMemo(() => buildDependencyIndex(ALL_MODULES), []);
  const selectedSet = useMemo(() => new Set(selectedOrder), [selectedOrder]);

  const selected = useMemo(
    () => selectedOrder.map((id) => ALL_MODULES.find((m) => m.id === id)).filter(Boolean) as typeof ALL_MODULES,
    [selectedOrder]
  );

  const allMissing = useMemo(() => {
    const out = new Map<string, string[]>(); // moduleId → missing dep IDs
    for (const m of selected) {
      const miss = missingDependencies(m, selectedSet, byId).map((d) => d.id);
      if (miss.length) out.set(m.id, miss);
    }
    return out;
  }, [selected, selectedSet, byId]);

  const deferralMap = useMemo(() => new Map(Object.entries(deferrals)), [deferrals]);
  const summary = computeSummary(selected, deferralMap, assumptions);

  const onAutoFixAll = () => {
    const needed = new Set<string>();
    for (const m of selected) {
      for (const prereq of expandPrerequisites(m.id, byId)) {
        if (!selectedSet.has(prereq)) needed.add(prereq);
      }
    }
    if (needed.size) selectMany(Array.from(needed), 'auto-pulled in all missing prerequisites');
  };

  if (selectedOrder.length === 0) {
    return (
      <div className="px-6 md:px-10 py-20 max-w-3xl mx-auto text-center">
        <p className="eyebrow">my plan</p>
        <h1 className="font-display text-display-lg text-midnight mt-3">
          you haven't picked yet.
        </h1>
        <p className="mt-5 text-burnt leading-relaxed text-[15px]">
          select modules from the <em>browse</em> page, or ask <em>hey pontis</em> to suggest a starting plan based on
          a phrase like "highest hours-saved next quarter" or "focus on closeout pain."
        </p>
      </div>
    );
  }

  return (
    <div className="px-6 md:px-10 py-10 md:py-14 max-w-[1600px] mx-auto">
      {/* Headline + actions */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
        <div className="md:col-span-7">
          <p className="eyebrow">my plan · {selectedOrder.length} modules</p>
          <h1 className="font-display text-display-lg text-midnight mt-2">
            this is what i want.<br />
            <span className="italic font-light text-burnt">let's go.</span>
          </h1>
        </div>
        <div className="md:col-span-5 flex flex-wrap gap-2 md:justify-end no-print">
          <button onClick={() => { setShareOpen(true); track('share-open'); }} className="flex items-center gap-1.5 px-3 py-2 text-sm text-burnt hover:text-midnight border border-midnight/15 rounded-sm hover:border-midnight transition-colors">
            <Link2 size={14} /> share
          </button>
          <button onClick={() => { downloadCSV(selected); track('export-csv'); }} className="flex items-center gap-1.5 px-3 py-2 text-sm text-burnt hover:text-midnight border border-midnight/15 rounded-sm hover:border-midnight transition-colors">
            <Download size={14} /> csv
          </button>
          <button onClick={() => { exportPDF(); track('export-pdf'); }} className="flex items-center gap-1.5 px-3 py-2 text-sm text-burnt hover:text-midnight border border-midnight/15 rounded-sm hover:border-midnight transition-colors">
            <Printer size={14} /> print / pdf
          </button>
          <button onClick={() => { reset(); track('reset'); }} className="flex items-center gap-1.5 px-3 py-2 text-sm text-burnt hover:text-red-700 border border-midnight/15 rounded-sm hover:border-red-700 transition-colors">
            <Trash2 size={14} /> reset
          </button>
          <button
            onClick={() => setFinalizeOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-midnight text-pearl rounded-sm hover:bg-ink transition-colors ml-auto md:ml-0"
          >
            <Check size={14} strokeWidth={2.5} /> finalize plan
            <ArrowRight size={12} />
          </button>
        </div>
      </div>

      {/* Snapshot bar — surfaces the last finalized state without nagging */}
      {latestSnapshot && (
        <div className="mt-6 p-3 px-4 bg-bone/60 border-l-2 border-midnight flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-2 text-[12px] text-midnight min-w-0">
            <Sparkles size={12} className="text-burnt shrink-0" />
            <span className="truncate">
              last finalized {new Date(latestSnapshot.finalizedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} by{' '}
              <span className="font-medium">{latestSnapshot.finalizedBy}</span>{' '}
              · {latestSnapshot.totals.modules} modules · {Math.round(latestSnapshot.totals.hoursSavedPerYear).toLocaleString()} hrs/yr
            </span>
          </div>
          <button
            onClick={() => setFinalizeOpen(true)}
            className="text-[11px] text-burnt hover:text-midnight shrink-0"
          >
            finalize again →
          </button>
        </div>
      )}

      {/* Missing-prereq banner */}
      {allMissing.size > 0 && (
        <div className="mt-8 p-4 bg-laser/30 border-l-2 border-midnight flex items-center justify-between gap-4 no-print">
          <div>
            <p className="font-medium text-midnight text-sm">
              {allMissing.size} module{allMissing.size === 1 ? '' : 's'} {allMissing.size === 1 ? 'has' : 'have'} unmet prerequisites
            </p>
            <p className="text-xs text-burnt mt-0.5">
              pontis needs the foundations beneath these to land. add them all in one click?
            </p>
          </div>
          <button
            onClick={onAutoFixAll}
            className="px-4 py-2 bg-midnight text-pearl text-sm rounded-sm hover:bg-ink transition-colors whitespace-nowrap"
          >
            <Plus size={12} className="inline mr-1.5" />
            add prerequisites
          </button>
        </div>
      )}

      {/* Layout: gantt + cost on the right */}
      <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8 no-print">
        <div className="lg:col-span-8">
          <Gantt />

          {/* Roadmap alignment */}
          <RoadmapAlignment selectedSet={selectedSet} />
        </div>
        <aside className="lg:col-span-4 border border-midnight/15 rounded-sm bg-pearl">
          <CostPanel />
        </aside>
      </div>

      {/* Change log */}
      <section className="mt-12 no-print">
        <header className="flex items-center justify-between gap-3 pb-3 border-b border-midnight/15">
          <div>
            <p className="eyebrow">change log · the thinking, in order</p>
            <h3 className="font-display text-xl text-midnight mt-1 lowercase">
              {log.length} {log.length === 1 ? 'decision' : 'decisions'} this session
            </h3>
          </div>
          <button
            onClick={() => setShowLog((v) => !v)}
            className="text-sm text-burnt hover:text-midnight"
          >
            {showLog ? 'hide' : 'show'}
          </button>
        </header>
        {showLog && (
          <ul className="mt-5 space-y-2 max-h-[300px] overflow-y-auto thin-scroll pr-2">
            {log.length === 0 ? (
              <li className="text-sm text-clay italic">no decisions yet.</li>
            ) : (
              log.map((entry) => (
                <li key={entry.id} className="flex items-center gap-3 py-1.5 text-sm">
                  <span className="text-[11px] text-clay tabular-nums w-20 shrink-0">{formatTime(entry.at)}</span>
                  <span className={cn(
                    'text-[10px] uppercase tracking-widish w-20 shrink-0',
                    entry.kind === 'select' ? 'text-midnight' :
                    entry.kind === 'deselect' ? 'text-red-700' :
                    entry.kind === 'defer' ? 'text-burnt' :
                    entry.kind === 'plan-apply' ? 'text-midnight' : 'text-clay'
                  )}>
                    {entry.kind}
                  </span>
                  <span className="text-burnt grow truncate">{entry.label}</span>
                  {entry.reversible && (
                    <button
                      onClick={() => undo(entry.id)}
                      className="text-[11px] text-clay hover:text-midnight transition-colors shrink-0"
                      aria-label="Undo this change"
                    >
                      <RotateCcw size={11} className="inline mr-1" /> undo
                    </button>
                  )}
                </li>
              ))
            )}
          </ul>
        )}
      </section>

      <TelemetryPanel />

      {/* Bottom commit CTA — Maggie reaches the end of the page and sees the close */}
      <section className="mt-14 no-print">
        <div className="p-8 md:p-12 bg-midnight text-pearl rounded-sm grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-8">
            <p className="eyebrow !text-pearl/60 !tracking-[0.28em]">when you're ready</p>
            <h3 className="font-display text-display text-pearl mt-2 leading-tight">
              this is what i want.<br />
              <span className="italic font-light text-pearl/70">let's finalize.</span>
            </h3>
            <p className="mt-3 text-sm text-pearl/70 leading-relaxed max-w-md">
              the finalize flow walks you through one last review (selections, timeline, cost),
              captures your sign-off, and produces a snapshot fsc can build from. nothing's irreversible.
            </p>
          </div>
          <div className="md:col-span-4 flex md:justify-end">
            <button
              onClick={() => setFinalizeOpen(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-sm bg-laser text-midnight hover:scale-[1.02] transition-transform font-medium"
            >
              finalize plan
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </section>

      {/* PRINT-ONLY one-page summary */}
      <PrintSummary selected={selected} summary={summary} deferrals={deferrals} />

      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} />
      <FinalizeFlow open={finalizeOpen} onClose={() => setFinalizeOpen(false)} />
    </div>
  );
}

function RoadmapAlignment({ selectedSet }: { selectedSet: Set<string> }) {
  return (
    <section className="mt-8 border border-midnight/15 rounded-sm bg-pearl p-6">
      <p className="eyebrow">roadmap alignment · fsc's suggested cadence</p>
      <h3 className="font-display text-lg text-midnight mt-1 mb-1 lowercase">
        what each phase delivers — if you keep the suggested order
      </h3>
      <p className="text-[11px] text-clay mb-4 italic">
        percentages reflect coverage of fsc's original sequence for each phase. they don't
        account for your reorders or deferrals — those land where the gantt shows.
      </p>
      <div className="space-y-3">
        {ROADMAP.map((r, i) => {
          const inPlan = r.modules.filter((id) => selectedSet.has(id));
          const inPlanPct = r.modules.length > 0 ? Math.round((inPlan.length / r.modules.length) * 100) : 0;
          return (
            <div key={i} className="grid grid-cols-12 gap-4 py-2 border-b border-midnight/8 last:border-b-0">
              <div className="col-span-3 md:col-span-3">
                <p className="text-[11px] uppercase tracking-widish text-clay">{r.window}</p>
                <p className="text-sm text-midnight font-medium mt-0.5 lowercase">{r.phase.replace(/^phase \d+ — /, '')}</p>
              </div>
              <div className="col-span-6 md:col-span-7">
                <p className="text-[13px] text-burnt leading-relaxed clamp-2">{r.outcome}</p>
                <p className="text-[10px] text-clay mt-1 tabular-nums">
                  {inPlan.length}/{r.modules.length} of this phase in your plan
                </p>
              </div>
              <div className="col-span-3 md:col-span-2 flex flex-col items-end justify-center">
                <p className="font-display text-xl text-midnight tabular-nums">{inPlanPct}%</p>
                <div className="w-full h-1 bg-midnight/10 mt-1 overflow-hidden">
                  <div
                    className="h-full bg-midnight transition-all"
                    style={{ width: `${inPlanPct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PrintSummary({
  selected, summary, deferrals,
}: {
  selected: typeof ALL_MODULES;
  summary: ReturnType<typeof computeSummary>;
  deferrals: Record<string, number>;
}) {
  const snapshots = useStore((s) => s.snapshots);
  const latest = snapshots[0];
  const priorities = useStore((s) => s.priorities);
  const { byId } = useMemo(() => buildDependencyIndex(ALL_MODULES), []);
  const deferralMap = useMemo(() => new Map(Object.entries(deferrals)), [deferrals]);
  const orderedForSchedule = useMemo(() => {
    const ids = selected.map((m) => m.id);
    return ids.sort((a, b) => (priorities[a] ?? Infinity) - (priorities[b] ?? Infinity));
  }, [selected, priorities]);
  const schedule = useMemo(
    () => buildSchedule(orderedForSchedule, byId, deferralMap, 2),
    [orderedForSchedule, byId, deferralMap]
  );
  const maxWeek = Math.max(16, ...schedule.map((s) => s.endWeek));

  // Inline-styles only here — the print stylesheet shouldn't depend on Tailwind utilities
  // because some browsers strip class-based colors when printing in grayscale mode.
  const colors = { midnight: '#214144', clay: '#828279', burnt: '#61655f', bone: '#edeae2', laser: '#e9ff14' };

  return (
    <article className="print-only">
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* The ĒSO mark as inline SVG so the printer renders it crisply */}
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="11" stroke={colors.midnight} strokeWidth="1.6" />
            <path d="M12 1.5 V 22.5" stroke={colors.midnight} strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="6.4" cy="12" r="2.4" fill={colors.midnight} />
          </svg>
          <div>
            <p style={{ fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase', color: colors.clay, margin: 0 }}>
              pontis atelier · finalized plan
            </p>
            <p style={{ fontSize: 22, fontWeight: 500, color: colors.midnight, margin: '2px 0 0' }}>
              ĒSO Architecture + Design
            </p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {latest ? (
            <>
              <p style={{ fontSize: 10, color: colors.midnight, margin: 0, fontWeight: 500 }}>signed by {latest.finalizedBy}</p>
              <p style={{ fontSize: 9, color: colors.clay, margin: '2px 0 0' }}>
                {new Date(latest.finalizedAt).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}
              </p>
            </>
          ) : (
            <p style={{ fontSize: 10, color: colors.clay, margin: 0 }}>
              {new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}
            </p>
          )}
        </div>
      </header>

      {/* Headline */}
      <h1 style={{ fontSize: 30, lineHeight: 1.05, color: colors.midnight, margin: '12px 0 4px' }}>
        {selected.length} modules · ≈ {Math.round(summary.totalHoursSaved).toLocaleString()} hrs saved per year
      </h1>
      <p style={{ fontSize: 11, color: colors.burnt, fontStyle: 'italic', margin: '0 0 14px' }}>
        what ĒSO wants from Pontis — racked, stacked, and timeline-drawn.
      </p>

      {latest?.note && (
        <blockquote style={{ borderLeft: `2px solid ${colors.midnight}`, paddingLeft: 12, margin: '10px 0 16px', color: colors.burnt, fontSize: 10, fontStyle: 'italic' }}>
          "{latest.note}"
        </blockquote>
      )}

      {/* Mini Gantt thumbnail — pure inline SVG, prints perfectly */}
      <section style={{ margin: '18px 0' }}>
        <p style={{ fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: colors.clay, margin: '0 0 6px' }}>
          gantt thumbnail · ≈ {maxWeek} weeks
        </p>
        <svg
          viewBox={`0 0 ${Math.max(maxWeek * 12, 240)} ${schedule.length * 10 + 18}`}
          style={{ width: '100%', height: 'auto', display: 'block', border: `1px solid ${colors.bone}` }}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Phase grid lines */}
          {[4, 10, 16, 26, 39].filter((w) => w < maxWeek).map((w) => (
            <line
              key={w}
              x1={w * 12} x2={w * 12}
              y1={0} y2={schedule.length * 10 + 14}
              stroke={colors.midnight} strokeOpacity={0.12}
            />
          ))}
          {/* Bars */}
          {schedule.map((s, i) => {
            const fill = s.module.coa === 'COA 3' ? colors.midnight : colors.burnt;
            const ghostX = Math.max(0, s.startWeek - s.lagWeeks) * 12;
            const ghostW = s.durationWeeks * 12;
            return (
              <g key={s.module.id}>
                {s.isDeferred && (
                  <rect
                    x={ghostX} y={i * 10 + 4}
                    width={ghostW} height={5}
                    fill="none"
                    stroke={fill} strokeOpacity={0.4} strokeDasharray="2 2"
                  />
                )}
                <rect
                  x={s.startWeek * 12} y={i * 10 + 4}
                  width={Math.max(s.durationWeeks * 12, 6)} height={5}
                  fill={fill}
                />
                <text
                  x={s.startWeek * 12 + 3}
                  y={i * 10 + 8.5}
                  fontSize="3.2"
                  fill={colors.bone}
                  fontFamily="monospace"
                >
                  {s.module.id}
                </text>
              </g>
            );
          })}
          {/* Week axis at the bottom */}
          <line x1={0} x2={maxWeek * 12} y1={schedule.length * 10 + 12} y2={schedule.length * 10 + 12} stroke={colors.midnight} strokeOpacity={0.3} />
          {[0, Math.round(maxWeek / 2), maxWeek].map((w, idx) => (
            <text
              key={idx}
              x={Math.max(0, w * 12 - 6)}
              y={schedule.length * 10 + 17}
              fontSize="3.2"
              fill={colors.clay}
            >w{w}</text>
          ))}
        </svg>
      </section>

      {/* Module table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 14, fontSize: 9.5 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${colors.midnight}`, textAlign: 'left', color: colors.burnt }}>
            <th style={{ padding: '6px 4px' }}>id</th>
            <th style={{ padding: '6px 4px' }}>module</th>
            <th style={{ padding: '6px 4px' }}>coa</th>
            <th style={{ padding: '6px 4px' }}>time</th>
            <th style={{ padding: '6px 4px', textAlign: 'right' }}>cost</th>
            <th style={{ padding: '6px 4px', textAlign: 'right' }}>hrs/yr</th>
          </tr>
        </thead>
        <tbody>
          {selected.map((m) => (
            <tr key={m.id} style={{ borderBottom: `1px solid ${colors.bone}` }}>
              <td style={{ padding: '4px', fontFamily: 'monospace', color: colors.burnt }}>{m.id}</td>
              <td style={{ padding: '4px', color: colors.midnight }}>
                {m.name}
                {priorities[m.id] != null && <span style={{ color: colors.burnt }}> · P{priorities[m.id]}</span>}
                {deferrals[m.id] ? <span style={{ color: colors.burnt }}> · +{deferrals[m.id]}w</span> : null}
              </td>
              <td style={{ padding: '4px', color: colors.burnt }}>{m.coa}</td>
              <td style={{ padding: '4px', color: colors.burnt }}>{m.timeLabel}</td>
              <td style={{ padding: '4px', textAlign: 'right', color: colors.midnight }}>{m.retainerCovered ? 'retainer' : '$' + (m.rom ?? 0).toLocaleString()}</td>
              <td style={{ padding: '4px', textAlign: 'right', color: colors.midnight }}>{m.hoursSavedPerYear ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ marginTop: 22, borderTop: `2px solid ${colors.midnight}`, paddingTop: 12, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <Totals label="COA 1+2 ROM" value={`$${Math.round(summary.billableROM).toLocaleString()}`} />
        <Totals label="Pontis modules" value={summary.retainerModules.toString()} />
        <Totals label="Hrs saved / yr" value={Math.round(summary.totalHoursSaved).toLocaleString()} />
        <Totals label="$ saved / yr" value={`$${Math.round(summary.annualSavedInternal).toLocaleString()}`} />
      </div>

      {/* Etymology line + signature line */}
      <div style={{ marginTop: 28, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
        <p style={{ fontSize: 9, color: colors.clay, fontStyle: 'italic', margin: 0, maxWidth: '60%' }}>
          pontis · latin: of the bridge.  ·  atelier · french: the workshop.<br />
          ĒSO's drafting table for what pontis becomes.
        </p>
        <div style={{ minWidth: 220, textAlign: 'right' }}>
          {latest ? (
            <>
              <p style={{ fontSize: 18, fontFamily: 'serif', fontStyle: 'italic', color: colors.midnight, margin: '0 0 -2px', borderBottom: `1px solid ${colors.midnight}`, paddingBottom: 2 }}>
                {latest.finalizedBy}
              </p>
              <p style={{ fontSize: 9, color: colors.clay, margin: '4px 0 0' }}>
                signed · {new Date(latest.finalizedAt).toLocaleDateString('en-US', { dateStyle: 'long' })}
              </p>
            </>
          ) : (
            <>
              <div style={{ borderBottom: `1px solid ${colors.midnight}`, height: 20 }} />
              <p style={{ fontSize: 9, color: colors.clay, margin: '4px 0 0' }}>signature · date</p>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function Totals({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: 8.5, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#828279', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 18, color: '#214144', margin: '2px 0 0' }}>{value}</p>
    </div>
  );
}
