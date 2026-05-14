import { useMemo, useState } from 'react';
import { Search, Filter, ListFilter, X } from 'lucide-react';
import { cn } from '../lib/cn';
import { ALL_MODULES, SECTIONS, MODULES_BY_SECTION, COUNTS } from '../data/data';
import { ModuleCard } from './ModuleCard';
import { ModuleDeepDive } from './ModuleDeepDive';
import { useStore } from '../store';
import { compactNumber } from '../lib/format';
import type { PontisModule } from '../types';

const COA_FILTERS = [
  { key: 'all',    label: 'all',         test: () => true },
  { key: 'pontis', label: 'pontis only', test: (coa: string) => coa === 'COA 3' },
  { key: 'quick',  label: 'quick wins',  test: (coa: string) => coa === 'COA 1' || coa === 'COA 2' },
] as const;

const LIFECYCLE_OPTIONS = [
  'all',
  'Inquiry / RFP',
  'Proposal',
  'Design / Docs / Permitting',
  'Construction Admin',
  'Closeout',
  'Cross-cutting',
] as const;

export function ModuleBrowser() {
  const [query, setQuery] = useState('');
  const [coaFilter, setCoaFilter] = useState<(typeof COA_FILTERS)[number]['key']>('all');
  const [lifecycle, setLifecycle] = useState<typeof LIFECYCLE_OPTIONS[number]>('all');
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [deepDive, setDeepDive] = useState<PontisModule | null>(null);
  const selectedOrder = useStore((s) => s.selectedOrder);
  const selectedSet = useMemo(() => new Set(selectedOrder), [selectedOrder]);

  const matchesFilters = (m: (typeof ALL_MODULES)[number]) => {
    if (!COA_FILTERS.find((f) => f.key === coaFilter)!.test(m.coa)) return false;
    if (lifecycle !== 'all' && !m.lifecyclePhase.includes(lifecycle)) return false;
    if (showSelectedOnly && !selectedSet.has(m.id)) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      if (!(
        m.id.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.desiredOutcome.toLowerCase().includes(q) ||
        m.currentTool.toLowerCase().includes(q)
      )) return false;
    }
    return true;
  };

  const visibleBySection = useMemo(() => {
    const result = new Map<string, typeof ALL_MODULES>();
    for (const [key, mods] of MODULES_BY_SECTION) {
      const list = mods.filter(matchesFilters);
      if (list.length) result.set(key, list);
    }
    return result;
  }, [query, coaFilter, lifecycle, showSelectedOnly, selectedSet]);

  const totalVisible = Array.from(visibleBySection.values()).reduce((s, l) => s + l.length, 0);
  const totalSelectedHours = ALL_MODULES
    .filter((m) => selectedSet.has(m.id) && m.hoursSavedPerYear != null)
    .reduce((s, m) => s + (m.hoursSavedPerYear ?? 0), 0);

  return (
    <div className="px-6 md:px-10 py-10 md:py-14">
      {/* Section eyebrow + headline */}
      <div className="max-w-[1600px] mx-auto">
        <p className="eyebrow">browse · 14 sections · 101 modules</p>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-10 items-end">
          <h1 className="md:col-span-7 font-display text-display-lg text-midnight">
            what would you like<br />
            <span className="italic font-light text-burnt">pontis to bridge</span> first?
          </h1>
          <div className="md:col-span-5 text-burnt text-[15px] leading-relaxed max-w-md md:justify-self-end">
            every module replaces a piece of how ĒSO works today. click <em>compare</em> on any card to see
            what the day looks like before pontis lands it — and after.
          </div>
        </div>

        {/* Filter bar */}
        <div className="mt-10 flex flex-col md:flex-row md:items-center gap-4 pb-4 border-b border-midnight/15">
          <div className="flex items-center gap-2 grow max-w-md">
            <Search size={15} className="text-burnt shrink-0" />
            <input
              type="search"
              placeholder="search modules — name, description, outcome, what it replaces…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full py-2 bg-transparent text-sm placeholder-clay/70 focus:outline-none text-midnight"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-burnt hover:text-midnight" aria-label="Clear">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="hairline-v hidden md:block" />
          <div className="flex items-center gap-1">
            {COA_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setCoaFilter(f.key)}
                className={cn(
                  'px-3 py-1.5 text-xs tracking-tight rounded-full transition-colors',
                  coaFilter === f.key
                    ? 'bg-midnight text-pearl'
                    : 'text-burnt hover:text-midnight'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="hairline-v hidden md:block" />
          <div className="flex items-center gap-2">
            <ListFilter size={13} className="text-burnt shrink-0" />
            <select
              value={lifecycle}
              onChange={(e) => setLifecycle(e.target.value as typeof lifecycle)}
              className="bg-transparent text-xs text-burnt hover:text-midnight focus:outline-none cursor-pointer"
            >
              {LIFECYCLE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt === 'all' ? 'all phases' : opt.toLowerCase()}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setShowSelectedOnly((s) => !s)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs tracking-tight rounded-full transition-colors',
              showSelectedOnly ? 'bg-laser text-midnight' : 'border border-midnight/20 text-burnt hover:text-midnight'
            )}
          >
            <Filter size={11} />
            <span>in my plan ({selectedOrder.length})</span>
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-clay">
          <span className="tabular-nums">
            {totalVisible} of {COUNTS.total} modules visible
          </span>
          {selectedOrder.length > 0 && (
            <span className="tabular-nums">
              {selectedOrder.length} selected
              {totalSelectedHours > 0 && <span className="text-burnt"> · ≈{compactNumber(totalSelectedHours)} hrs/yr saved</span>}
            </span>
          )}
        </div>
      </div>

      {/* Sections + asymmetric grids */}
      <div className="max-w-[1600px] mx-auto mt-14 space-y-20">
        {SECTIONS.filter((s) => visibleBySection.has(s.key)).map((section, sectionIdx) => {
          const list = visibleBySection.get(section.key) ?? [];
          // Asymmetric: alternate left-/right-heavy headers
          const headerSide = sectionIdx % 2 === 0 ? 'left' : 'right';
          return (
            <section key={section.key} className="relative">
              <header
                className={cn(
                  'grid grid-cols-12 gap-6 mb-7',
                  headerSide === 'right' && 'md:[direction:rtl]'
                )}
              >
                <div className="col-span-12 md:col-span-7 lg:col-span-6 [direction:ltr]">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-clay text-sm tabular-nums">§ {section.key}</span>
                    <p className="eyebrow !text-burnt">{section.descriptor}</p>
                  </div>
                  <h2 className="font-display text-display tracking-tight text-midnight mt-2 lowercase">
                    {section.name}
                  </h2>
                  <p className="text-burnt mt-3 max-w-lg leading-relaxed text-[15px]">
                    {section.accent}
                  </p>
                </div>
                <div className="hidden md:block col-span-1 [direction:ltr]" />
                <div className="col-span-12 md:col-span-4 lg:col-span-5 [direction:ltr] md:self-end text-xs text-clay tabular-nums">
                  <div className="flex flex-wrap gap-x-5 gap-y-1">
                    <span>{list.length} module{list.length === 1 ? '' : 's'}</span>
                    {list.some((m) => m.hoursSavedPerYear != null) && (
                      <span>
                        ≈{compactNumber(list.reduce((s, m) => s + (m.hoursSavedPerYear ?? 0), 0))} hrs/yr · firm-wide
                      </span>
                    )}
                  </div>
                </div>
              </header>

              <div
                className={cn(
                  'grid gap-5',
                  // Asymmetric: vary card span depth in lg by section index
                  'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                )}
              >
                {list.map((m, idx) => {
                  // Subtle asymmetry: every 5th card in a section is taller
                  return (
                    <ModuleCard
                      key={m.id}
                      module={m}
                      onOpenDeepDive={setDeepDive}
                      className={cn(
                        idx % 7 === 3 && 'lg:col-span-2'
                      )}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}

        {totalVisible === 0 && (
          <div className="py-32 text-center text-burnt">
            <p className="font-display text-2xl italic mb-2">nothing matches that yet.</p>
            <p className="text-sm">try a different phrase, or relax the filters.</p>
          </div>
        )}
      </div>

      <ModuleDeepDive module={deepDive} onClose={() => setDeepDive(null)} />
    </div>
  );
}
