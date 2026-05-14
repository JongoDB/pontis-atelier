import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Check, X, Sparkles, Download, Printer, Link2,
  Calendar, DollarSign, Clock, AlertTriangle, Trash2,
} from 'lucide-react';
import { ALL_MODULES, SECTION_BY_KEY } from '../data/data';
import { useStore } from '../store';
import { computeSummary } from '../lib/cost';
import { buildDependencyIndex, missingDependencies } from '../lib/dependencies';
import { buildSchedule, totalSpanWeeks } from '../lib/schedule';
import { compactCurrency, compactNumber, currency, formatTime } from '../lib/format';
import { cn } from '../lib/cn';
import { downloadCSV, exportPDF } from '../lib/export';
import { encodePlan, buildShareURL } from '../lib/share';
import { track } from '../lib/telemetry';
import { EsoMark } from './Wordmark';
import { buildMailto, fireWebhook, notifyEnv, type NotifyResult } from '../lib/notify';
import type { PlanSnapshot } from '../types';
import { Mail } from 'lucide-react';

interface FinalizeFlowProps {
  open: boolean;
  onClose: () => void;
}

type Step = 'review' | 'timeline' | 'cost' | 'sign' | 'done';

export function FinalizeFlow({ open, onClose }: FinalizeFlowProps) {
  const [step, setStep] = useState<Step>('review');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [snapshot, setSnapshot] = useState<PlanSnapshot | null>(null);
  const [notify, setNotify] = useState<NotifyResult | null>(null);

  const selectedOrder = useStore((s) => s.selectedOrder);
  const deferrals = useStore((s) => s.deferrals);
  const priorities = useStore((s) => s.priorities);
  const assumptions = useStore((s) => s.assumptions);
  const finalize = useStore((s) => s.finalize);

  const { byId } = useMemo(() => buildDependencyIndex(ALL_MODULES), []);
  const selectedSet = useMemo(() => new Set(selectedOrder), [selectedOrder]);

  const selected = useMemo(
    () => selectedOrder.map((id) => ALL_MODULES.find((m) => m.id === id)).filter(Boolean) as typeof ALL_MODULES,
    [selectedOrder]
  );

  const deferralMap = useMemo(() => new Map(Object.entries(deferrals)), [deferrals]);
  const summary = useMemo(
    () => computeSummary(selected, deferralMap, assumptions),
    [selected, deferralMap, assumptions]
  );

  const orderedForSchedule = useMemo(() => {
    return [...selectedOrder].sort((a, b) => {
      const pa = priorities[a] ?? Infinity;
      const pb = priorities[b] ?? Infinity;
      if (pa !== pb) return pa - pb;
      return selectedOrder.indexOf(a) - selectedOrder.indexOf(b);
    });
  }, [selectedOrder, priorities]);

  const schedule = useMemo(
    () => buildSchedule(orderedForSchedule, byId, deferralMap, 2),
    [orderedForSchedule, byId, deferralMap]
  );
  const totalWeeks = totalSpanWeeks(schedule);

  const unmet = useMemo(() => {
    const out: { module: typeof selected[number]; missing: typeof selected }[] = [];
    for (const m of selected) {
      const miss = missingDependencies(m, selectedSet, byId);
      if (miss.length) out.push({ module: m, missing: miss });
    }
    return out;
  }, [selected, selectedSet, byId]);

  useEffect(() => {
    if (open) {
      setStep('review');
      setSnapshot(null);
      setName('');
      setNote('');
      setNotify(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const canFinalize = name.trim().length >= 2;

  const commitFinalize = async () => {
    const snap = finalize({
      finalizedBy: name.trim(),
      note: note.trim(),
      totals: {
        modules: selected.length,
        billableROM: summary.billableROM,
        hoursSavedPerYear: summary.totalHoursSaved,
        annualSavedInternal: summary.annualSavedInternal,
        quartersOfRetainerBuild: summary.retainerQuartersNeeded,
      },
    });
    setSnapshot(snap);
    setStep('done');
    track('reset', { kind: 'finalize', by: name.trim() });

    // Fire webhook in the background. UI proceeds regardless; failures are
    // surfaced as a small status note on the Done step, not as a blocker.
    const sharePayload = encodePlan({
      selected: snap.selectedOrder,
      deferrals: snap.deferrals,
      priorities: snap.priorities,
      title: `Finalized ${snap.finalizedAt}`,
    });
    const shareURL = buildShareURL(sharePayload);
    fireWebhook(snap, shareURL).then(setNotify);
  };

  const STEPS: { key: Step; label: string; sub: string }[] = [
    { key: 'review',   label: 'review',   sub: 'what you picked' },
    { key: 'timeline', label: 'timeline', sub: 'when it lands' },
    { key: 'cost',     label: 'cost',     sub: 'what it nets' },
    { key: 'sign',     label: 'sign',     sub: 'commit' },
  ];

  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const isDone = step === 'done';

  const next = () => {
    const idx = STEPS.findIndex((s) => s.key === step);
    if (idx >= 0 && idx < STEPS.length - 1) setStep(STEPS[idx + 1].key);
  };
  const back = () => {
    const idx = STEPS.findIndex((s) => s.key === step);
    if (idx > 0) setStep(STEPS[idx - 1].key);
  };

  return (
    <div className="fixed inset-0 z-50 bg-pearl overflow-y-auto">
      <div className="min-h-full flex flex-col">
        {/* Header rail */}
        <header className="sticky top-0 z-10 bg-pearl/95 backdrop-blur-sm border-b border-midnight/15">
          <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-4 flex items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <EsoMark size={22} />
              <p className="eyebrow !tracking-[0.28em]">finalize your plan</p>
            </div>

            {!isDone && (
              <div className="hidden md:flex items-center gap-1">
                {STEPS.map((s, idx) => {
                  const isActive = s.key === step;
                  const isPast = idx < stepIndex;
                  return (
                    <div key={s.key} className="flex items-center">
                      <button
                        type="button"
                        onClick={() => (isPast || isActive) && setStep(s.key)}
                        disabled={!isPast && !isActive}
                        className={cn(
                          'flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs tracking-tight transition-colors',
                          isActive ? 'bg-midnight text-pearl' : isPast ? 'text-midnight hover:bg-bone/50' : 'text-clay'
                        )}
                      >
                        <span className={cn(
                          'flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-medium tabular-nums',
                          isActive ? 'bg-laser text-midnight' : isPast ? 'bg-midnight/15 text-midnight' : 'bg-midnight/8 text-clay'
                        )}>
                          {isPast ? <Check size={10} strokeWidth={2.5} /> : idx + 1}
                        </span>
                        <span>{s.label}</span>
                      </button>
                      {idx < STEPS.length - 1 && <span className="w-3 h-px bg-midnight/15" />}
                    </div>
                  );
                })}
              </div>
            )}

            <button onClick={onClose} className="p-2 text-burnt hover:text-midnight transition-colors" aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Body */}
        <main className="grow max-w-[1200px] w-full mx-auto px-6 md:px-10 py-10 md:py-16">
          {step === 'review' && (
            <ReviewStep
              selected={selected}
              unmet={unmet}
              priorities={priorities}
              deferrals={deferrals}
            />
          )}
          {step === 'timeline' && (
            <TimelineStep
              totalWeeks={totalWeeks}
              schedule={schedule}
            />
          )}
          {step === 'cost' && (
            <CostStep
              summary={summary}
              assumptions={assumptions}
              modulesCount={selected.length}
            />
          )}
          {step === 'sign' && (
            <SignStep
              name={name}
              setName={setName}
              note={note}
              setNote={setNote}
              selected={selected}
              summary={summary}
            />
          )}
          {step === 'done' && snapshot && (
            <DoneStep
              snapshot={snapshot}
              selected={selected}
              summary={summary}
              notify={notify}
              onEdit={() => onClose()}
            />
          )}
        </main>

        {/* Footer rail */}
        {!isDone && (
          <footer className="sticky bottom-0 bg-pearl/95 backdrop-blur-sm border-t border-midnight/15">
            <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={back}
                disabled={stepIndex === 0}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 text-sm transition-colors',
                  stepIndex === 0 ? 'text-clay/50 cursor-not-allowed' : 'text-burnt hover:text-midnight'
                )}
              >
                <ArrowLeft size={14} /> back
              </button>

              <p className="hidden md:block text-xs text-clay">
                {step === 'review' && 'sanity-check the modules you picked. dependencies and gaps surface here.'}
                {step === 'timeline' && 'see when each phase lands. reorder back in the gantt if anything looks off.'}
                {step === 'cost' && 'what this nets ĒSO in hours and dollars. stress-test the numbers.'}
                {step === 'sign' && 'add your name. that\'s your sign-off — fsc reads this and starts building.'}
              </p>

              {step === 'sign' ? (
                <button
                  type="button"
                  onClick={commitFinalize}
                  disabled={!canFinalize}
                  className={cn(
                    'flex items-center gap-2 px-5 py-2.5 rounded-sm text-sm transition-colors',
                    canFinalize ? 'bg-midnight text-pearl hover:bg-ink' : 'bg-midnight/30 text-pearl/60 cursor-not-allowed'
                  )}
                >
                  <Check size={14} strokeWidth={2.5} /> finalize plan
                </button>
              ) : (
                <button
                  type="button"
                  onClick={next}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-sm bg-midnight text-pearl text-sm hover:bg-ink transition-colors"
                >
                  next <ArrowRight size={14} />
                </button>
              )}
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}

// ---------------- Step 1: review ----------------------------------------------------

function ReviewStep({
  selected, unmet, priorities, deferrals,
}: {
  selected: typeof ALL_MODULES;
  unmet: { module: typeof ALL_MODULES[number]; missing: typeof ALL_MODULES }[];
  priorities: Record<string, number>;
  deferrals: Record<string, number>;
}) {
  const bySection = useMemo(() => {
    const m = new Map<string, typeof selected>();
    for (const s of selected) {
      const arr = m.get(s.sectionKey) ?? [];
      arr.push(s);
      m.set(s.sectionKey, arr);
    }
    return m;
  }, [selected]);

  return (
    <div>
      <p className="eyebrow">step 1 · review</p>
      <h2 className="font-display text-display-lg text-midnight mt-2 leading-tight">
        let's check what<br />
        <span className="italic font-light text-burnt">made it into the plan.</span>
      </h2>
      <p className="text-burnt mt-4 max-w-xl leading-relaxed">
        these are the {selected.length} modules you've selected, grouped by pontis section. dependencies
        and any gaps show up here before you commit.
      </p>

      {unmet.length > 0 && (
        <div className="mt-8 p-4 bg-laser/30 border-l-2 border-midnight">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-midnight mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-midnight">
                {unmet.length} module{unmet.length === 1 ? '' : 's'} {unmet.length === 1 ? 'has' : 'have'} unmet prerequisites.
              </p>
              <p className="text-xs text-burnt mt-0.5">
                you can still finalize, but ĒSO will get a plan that includes things pontis can't build until their dependencies land. close this and use the "add prerequisites" banner on the plan page to fix.
              </p>
              <ul className="mt-3 space-y-1">
                {unmet.map((u) => (
                  <li key={u.module.id} className="text-xs text-midnight">
                    <span className="font-mono tabular-nums">{u.module.id}</span>
                    <span className="text-clay"> needs </span>
                    <span className="font-mono">{u.missing.map((d) => d.id).join(', ')}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="mt-10 space-y-8">
        {Array.from(bySection.entries()).map(([key, mods]) => {
          const section = SECTION_BY_KEY.get(key);
          return (
            <section key={key}>
              <header className="flex items-baseline justify-between gap-4 mb-3 pb-2 border-b border-midnight/15">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-clay text-sm tabular-nums">§ {key}</span>
                  <h3 className="font-display text-lg text-midnight lowercase">{section?.name}</h3>
                </div>
                <p className="text-[11px] text-clay tabular-nums">{mods.length} module{mods.length === 1 ? '' : 's'}</p>
              </header>
              <ul className="divide-y divide-midnight/8">
                {mods.map((m) => {
                  const p = priorities[m.id];
                  const def = deferrals[m.id];
                  return (
                    <li key={m.id} className="py-2 grid grid-cols-12 gap-3 items-baseline">
                      <span className="col-span-2 md:col-span-1 font-mono text-[11px] tabular-nums text-burnt">{m.id}</span>
                      <span className="col-span-10 md:col-span-7 text-sm text-midnight">
                        {m.name.toLowerCase()}
                        {p != null && (
                          <span className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full bg-laser text-midnight text-[10px] font-medium tabular-nums">{p}</span>
                        )}
                        {def && def > 0 && (
                          <span className="ml-2 text-[10px] text-burnt tracking-widish uppercase">+{def}w</span>
                        )}
                      </span>
                      <span className="hidden md:block col-span-2 text-[11px] text-clay text-right tabular-nums">
                        {m.timeLabel.replace(/\s*\([^)]*\)/, '')}
                      </span>
                      <span className="hidden md:block col-span-2 text-[11px] text-burnt text-right">
                        {m.retainerCovered ? 'retainer' : compactCurrency(m.rom)}
                        {m.hoursSavedPerYear != null && (
                          <span className="block text-clay">{m.hoursSavedPerYear} hrs/yr</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ---------------- Step 2: timeline --------------------------------------------------

function TimelineStep({
  totalWeeks, schedule,
}: {
  totalWeeks: number;
  schedule: ReturnType<typeof buildSchedule>;
}) {
  // Bucket the schedule into roadmap phases the same way the roadmap section does.
  const buckets = useMemo(() => {
    const phaseFor = (week: number) => {
      if (week < 4) return 'weeks 1–4 · foundation';
      if (week < 10) return 'weeks 5–10 · first mvp + bd';
      if (week < 16) return 'weeks 11–16 · project + portal + comms';
      if (week < 26) return 'months 4–5 · cutover';
      if (week < 39) return 'quarter 3+ · compound';
      return 'quarter 4+ · marketplace';
    };
    const map = new Map<string, typeof schedule>();
    for (const item of schedule) {
      const k = phaseFor(item.startWeek);
      const arr = map.get(k) ?? [];
      arr.push(item);
      map.set(k, arr);
    }
    return Array.from(map.entries());
  }, [schedule]);

  const quartersOfWork = Math.max(1, Math.ceil(totalWeeks / 13));

  return (
    <div>
      <p className="eyebrow">step 2 · timeline</p>
      <h2 className="font-display text-display-lg text-midnight mt-2 leading-tight">
        approximately <span className="tabular-nums">{totalWeeks}</span> weeks.<br />
        <span className="italic font-light text-burnt">that's ≈ {quartersOfWork} quarter{quartersOfWork === 1 ? '' : 's'} of build.</span>
      </h2>

      <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-4 border border-midnight/15 rounded-sm bg-pearl">
          <Clock size={14} className="text-burnt" />
          <p className="font-display text-2xl tabular-nums text-midnight mt-2">{totalWeeks}w</p>
          <p className="text-xs text-clay mt-1">end-to-end span</p>
        </div>
        <div className="p-4 border border-midnight/15 rounded-sm bg-pearl">
          <Calendar size={14} className="text-burnt" />
          <p className="font-display text-2xl tabular-nums text-midnight mt-2">{quartersOfWork}</p>
          <p className="text-xs text-clay mt-1">retainer quarter{quartersOfWork === 1 ? '' : 's'} of fsc effort</p>
        </div>
        <div className="p-4 border border-midnight/15 rounded-sm bg-pearl">
          <Sparkles size={14} className="text-burnt" />
          <p className="font-display text-2xl tabular-nums text-midnight mt-2">{schedule.filter((i) => i.isDeferred).length}</p>
          <p className="text-xs text-clay mt-1">deferred to later windows</p>
        </div>
      </div>

      <div className="mt-12 space-y-7">
        {buckets.map(([phase, items]) => (
          <section key={phase}>
            <header className="flex items-baseline justify-between gap-4 mb-3 pb-2 border-b border-midnight/15">
              <h3 className="font-display text-lg text-midnight lowercase">{phase}</h3>
              <p className="text-[11px] text-clay tabular-nums">{items.length} module{items.length === 1 ? '' : 's'}</p>
            </header>
            <ul className="divide-y divide-midnight/8">
              {items.map((it) => (
                <li key={it.module.id} className="py-2 flex items-baseline gap-3 text-sm">
                  <span className="font-mono text-[11px] tabular-nums text-burnt w-14 shrink-0">{it.module.id}</span>
                  <span className="text-midnight flex-1 truncate" title={it.module.name}>{it.module.name.toLowerCase()}</span>
                  <span className="text-[11px] text-clay tabular-nums shrink-0">
                    w{Math.round(it.startWeek)}–w{Math.round(it.endWeek)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

// ---------------- Step 3: cost ------------------------------------------------------

function CostStep({
  summary, assumptions, modulesCount,
}: {
  summary: ReturnType<typeof computeSummary>;
  assumptions: { internalRate: number; principalRate: number; adoptionRate: number; workingWeeks: number; retainerPerQuarter: number };
  modulesCount: number;
}) {
  return (
    <div>
      <p className="eyebrow">step 3 · cost + savings</p>
      <h2 className="font-display text-display-lg text-midnight mt-2 leading-tight">
        what this nets you.<br />
        <span className="italic font-light text-burnt">in hours and dollars.</span>
      </h2>

      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="space-y-5">
          <p className="eyebrow !text-burnt">what you spend</p>

          <div className="space-y-3">
            <KV label="COA 1 + 2 billable hours" sub="$100/hr to FSC" value={`${summary.billableHours} hrs`} />
            <KV label="COA 1 + 2 ROM" sub="billable subtotal" value={compactCurrency(summary.billableROM)} />
            <KV label="Pontis (COA 3) modules" sub="retainer-covered" value={modulesCount.toString()} />
            <KV label="quarters of retainer build" sub={`@ ${currency(assumptions.retainerPerQuarter, 0)} / quarter (already paid)`} value={`≈ ${summary.retainerQuartersNeeded}`} highlight />
          </div>
        </div>

        <div className="space-y-5">
          <p className="eyebrow !text-burnt">what you save</p>

          <div className="space-y-3">
            <KV label="annual hours saved" sub={`adoption ${Math.round(assumptions.adoptionRate * 100)}% · firm-wide`} value={`${compactNumber(summary.totalHoursSaved)} hrs / yr`} highlight />
            <KV label={`@ $${assumptions.internalRate}/hr`} sub="internal blended rate" value={compactCurrency(summary.annualSavedInternal)} />
            <KV label={`@ $${assumptions.principalRate}/hr`} sub="maggie's principal rate (displaced value)" value={compactCurrency(summary.annualSavedPrincipal)} />
            <KV label="5-year cumulative" sub="internal rate · compounds" value={compactCurrency(summary.fiveYearInternal)} />
          </div>
        </div>
      </div>

      {summary.byPhase.length > 0 && (
        <div className="mt-12 pt-8 border-t border-midnight/15">
          <p className="eyebrow !text-burnt mb-3">by lifecycle phase · what each one nets</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-2">
            {summary.byPhase.map((p) => (
              <div key={p.phase} className="flex items-baseline justify-between gap-3 py-1.5 border-b border-midnight/8">
                <span className="text-sm text-burnt">{p.phase.toLowerCase()}</span>
                <span className="text-sm tabular-nums text-midnight">
                  {p.hoursSaved > 0
                    ? <>{Math.round(p.hoursSaved).toLocaleString()} hrs <span className="text-clay/80">· {compactCurrency(p.internalDollars)}/yr</span></>
                    : <span className="text-clay">—</span>
                  }
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KV({ label, sub, value, highlight }: { label: string; sub?: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3', highlight && 'pt-3 border-t border-midnight/15')}>
      <div>
        <p className={cn('text-sm', highlight ? 'text-midnight font-medium' : 'text-burnt')}>{label}</p>
        {sub && <p className="text-[10px] text-clay tracking-widish mt-0.5">{sub}</p>}
      </div>
      <p className={cn('tabular-nums font-display', highlight ? 'text-2xl text-midnight' : 'text-base text-midnight')}>
        {value}
      </p>
    </div>
  );
}

// ---------------- Step 4: sign ------------------------------------------------------

function SignStep({
  name, setName, note, setNote, selected, summary,
}: {
  name: string; setName: (n: string) => void;
  note: string; setNote: (n: string) => void;
  selected: typeof ALL_MODULES;
  summary: ReturnType<typeof computeSummary>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  return (
    <div className="max-w-2xl mx-auto">
      <p className="eyebrow">step 4 · sign</p>
      <h2 className="font-display text-display-lg text-midnight mt-2 leading-tight">
        this is your<br />
        <span className="italic font-light text-burnt">sign-off.</span>
      </h2>
      <p className="text-burnt mt-4 leading-relaxed">
        nothing publishes anywhere when you finalize. atelier snapshots your plan with your name + a
        timestamp, and you get an ĒSO-branded artifact you can email or print. fsc reads the artifact
        and starts building.
      </p>

      <div className="mt-10 p-6 md:p-8 border border-midnight rounded-sm bg-bone/50">
        <p className="eyebrow !text-burnt">summary at sign-off</p>
        <div className="grid grid-cols-3 gap-4 mt-4">
          <Stat label="modules" value={selected.length.toString()} />
          <Stat label="hours saved / yr" value={compactNumber(summary.totalHoursSaved)} />
          <Stat label="annual $ saved" value={compactCurrency(summary.annualSavedInternal)} />
        </div>

        <div className="mt-7">
          <label className="block">
            <span className="eyebrow !text-burnt">your name</span>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Maggie Wylie"
              className="mt-1 w-full px-0 py-2 bg-transparent border-b-2 border-midnight/30 focus:border-midnight focus:outline-none text-lg text-midnight font-display tracking-tight"
            />
          </label>
          <label className="mt-5 block">
            <span className="eyebrow !text-burnt">a note for the team (optional)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="anything FSC should know going into the build…"
              rows={2}
              className="mt-1 w-full px-3 py-2 bg-pearl/50 border border-midnight/15 focus:border-midnight focus:outline-none text-sm text-midnight rounded-sm resize-none"
            />
          </label>
          <p className="mt-3 text-[11px] text-clay italic">
            sign with a typed name. atelier preserves your plan as a snapshot; you can come back and finalize again later if anything changes.
          </p>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-display text-3xl text-midnight tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-widish text-clay mt-1">{label}</p>
    </div>
  );
}

// ---------------- Step 5: done ------------------------------------------------------

function DoneStep({
  snapshot, selected, summary, notify, onEdit,
}: {
  snapshot: PlanSnapshot;
  selected: typeof ALL_MODULES;
  summary: ReturnType<typeof computeSummary>;
  notify: NotifyResult | null;
  onEdit: () => void;
}) {
  const shareURL = useMemo(
    () => buildShareURL(encodePlan({
      selected: snapshot.selectedOrder,
      deferrals: snapshot.deferrals,
      priorities: snapshot.priorities,
      title: `Finalized ${formatTime(snapshot.finalizedAt)}`,
    })),
    [snapshot]
  );

  const mailtoURL = useMemo(() => buildMailto(snapshot, shareURL), [snapshot, shareURL]);

  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareURL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <div className="max-w-3xl mx-auto text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-laser mb-6">
        <Check size={28} strokeWidth={2.5} className="text-midnight" />
      </div>
      <p className="eyebrow">finalized</p>
      <h2 className="font-display text-display-lg text-midnight mt-2 leading-tight">
        signed by <span className="italic font-light">{snapshot.finalizedBy.toLowerCase()}.</span>
      </h2>
      <p className="text-burnt mt-3 italic">
        {new Date(snapshot.finalizedAt).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}
      </p>

      {snapshot.note && (
        <blockquote className="mt-6 p-4 border-l-2 border-midnight max-w-xl mx-auto text-left text-sm text-burnt italic">
          "{snapshot.note}"
        </blockquote>
      )}

      <div className="mt-10 grid grid-cols-3 gap-4">
        <Stat label="modules" value={snapshot.totals.modules.toString()} />
        <Stat label="hours saved / yr" value={compactNumber(snapshot.totals.hoursSavedPerYear)} />
        <Stat label="annual $ saved" value={compactCurrency(snapshot.totals.annualSavedInternal)} />
      </div>

      {/* Primary CTA: tell FSC */}
      <div className="mt-12">
        <p className="eyebrow !text-burnt mb-3">tell fsc</p>
        <div className="flex flex-col sm:flex-row items-stretch justify-center gap-3 max-w-2xl mx-auto">
          <a
            href={mailtoURL}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-sm bg-midnight text-pearl hover:bg-ink transition-colors"
            onClick={() => track('share-open', { channel: 'mailto' })}
          >
            <Mail size={14} /> email this plan to fsc
          </a>
          <button
            type="button"
            onClick={copy}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-sm transition-colors',
              copied ? 'bg-laser text-midnight' : 'border border-midnight/30 text-midnight hover:bg-midnight hover:text-pearl'
            )}
          >
            <Link2 size={14} /> {copied ? 'link copied' : 'copy share link'}
          </button>
        </div>
        <NotificationStatus notify={notify} to={notifyEnv.notifyEmail} />
      </div>

      {/* Secondary: keep a copy */}
      <div className="mt-10 pt-6 border-t border-midnight/10">
        <p className="eyebrow !text-burnt mb-3">keep a copy</p>
        <div className="flex flex-col sm:flex-row items-stretch justify-center gap-3 max-w-md mx-auto">
          <button
            type="button"
            onClick={() => { exportPDF(); track('export-pdf'); }}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-sm border border-midnight/30 text-midnight hover:bg-midnight hover:text-pearl transition-colors"
          >
            <Printer size={14} /> print / save as pdf
          </button>
          <button
            type="button"
            onClick={() => { downloadCSV(selected); track('export-csv'); }}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-sm border border-midnight/30 text-midnight hover:bg-midnight hover:text-pearl transition-colors"
          >
            <Download size={14} /> csv
          </button>
        </div>
      </div>

      <p className="mt-12 text-sm text-burnt">
        your plan stays editable. come back any time to revise or finalize again.
      </p>
      <button
        type="button"
        onClick={onEdit}
        className="mt-2 text-sm text-midnight underline underline-offset-4 decoration-laser decoration-2 hover:decoration-midnight"
      >
        back to my plan →
      </button>
    </div>
  );
}

function NotificationStatus({ notify, to }: { notify: NotifyResult | null; to: string }) {
  if (!notify) {
    // Still firing
    return (
      <p className="mt-3 text-[11px] text-clay italic">
        opening this button drafts an email to <span className="font-mono">{to}</span>.
      </p>
    );
  }
  if (notify.webhookSent) {
    return (
      <p className="mt-3 text-[11px] text-midnight italic flex items-center justify-center gap-1.5">
        <Check size={11} /> a notification has also been sent to fsc automatically.
      </p>
    );
  }
  if (notify.webhookConfigured && !notify.webhookSent) {
    return (
      <p className="mt-3 text-[11px] text-burnt italic">
        the auto-notification couldn't deliver{notify.webhookError ? ` (${notify.webhookError})` : ''}. please send the email above.
      </p>
    );
  }
  return (
    <p className="mt-3 text-[11px] text-clay italic">
      sends to <span className="font-mono">{to}</span>. opens in your email client — review and hit send.
    </p>
  );
}
