import { useMemo, useRef, useState, useEffect } from 'react';
import { AlertTriangle, GripVertical, RotateCcw, X, Sliders } from 'lucide-react';
import { cn } from '../lib/cn';
import { ALL_MODULES, SECTION_BY_KEY } from '../data/data';
import { useStore } from '../store';
import { buildDependencyIndex } from '../lib/dependencies';
import { buildSchedule, totalSpanWeeks, quarterLabel, QUARTER_DIVIDERS, type ScheduledModule } from '../lib/schedule';
import { track } from '../lib/telemetry';

export function Gantt() {
  const selectedOrder = useStore((s) => s.selectedOrder);
  const deferrals = useStore((s) => s.deferrals);
  const priorities = useStore((s) => s.priorities);
  const reorder = useStore((s) => s.reorder);
  const defer = useStore((s) => s.defer);
  const toggle = useStore((s) => s.toggle);
  const { byId } = useMemo(() => buildDependencyIndex(ALL_MODULES), []);

  // Apply Maggie's rack/stack: items with explicit priority float to the top
  // (lower priority number = sooner). Within same priority, fall back to the
  // user's existing manual order from selectedOrder.
  const orderedIds = useMemo(() => {
    const indexed = selectedOrder.map((id, idx) => ({
      id,
      priority: priorities[id] ?? Infinity,
      idx,
    }));
    indexed.sort((a, b) => (a.priority - b.priority) || (a.idx - b.idx));
    return indexed.map((x) => x.id);
  }, [selectedOrder, priorities]);

  const items = useMemo(() => {
    const map = new Map(Object.entries(deferrals));
    return buildSchedule(orderedIds, byId, map, 2);
  }, [orderedIds, deferrals, byId]);

  const spanWeeks = Math.max(16, totalSpanWeeks(items) + 2);

  // Refs avoid React state batching during fast drag sequences
  const draggingIdRef = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  if (selectedOrder.length === 0) {
    return (
      <div className="text-center py-24 text-burnt">
        <p className="font-display text-2xl italic mb-2">no modules in your plan yet.</p>
        <p className="text-sm text-clay">browse and add modules to draft a schedule.</p>
      </div>
    );
  }

  const deferredCount = items.filter((i) => i.isDeferred).length;
  const quartersOfWork = Math.max(1, Math.ceil(spanWeeks / 13));

  return (
    <div className="bg-pearl border border-midnight/15 rounded-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-midnight/15 flex-wrap">
        <div>
          <p className="eyebrow">live gantt · drag to reorder · hover for defer slider</p>
          <h2 className="font-display text-xl text-midnight mt-1 lowercase">
            ≈ {quartersOfWork} quarter{quartersOfWork === 1 ? '' : 's'} <span className="text-clay">·</span> {spanWeeks} weeks
            <span className="text-burnt text-base font-light italic"> · {items.length} modules · {deferredCount} deferred</span>
          </h2>
        </div>
      </div>

      {/* Time axis */}
      <TimeAxis spanWeeks={spanWeeks} />

      {/* Bars */}
      <div className="px-2 md:px-4 py-2 overflow-x-auto thin-scroll">
        <div className="relative" style={{ minWidth: `${Math.max(800, spanWeeks * 28)}px` }}>
          {items.map((item, idx) => (
            <GanttRow
              key={item.module.id}
              item={item}
              idx={idx}
              spanWeeks={spanWeeks}
              isDragging={draggingId === item.module.id}
              isDragOver={dragOverId === item.module.id}
              onDragStart={() => {
                draggingIdRef.current = item.module.id;
                setDraggingId(item.module.id);
              }}
              onDragEnd={() => {
                draggingIdRef.current = null;
                setDraggingId(null);
                setDragOverId(null);
              }}
              onDragOver={() => setDragOverId(item.module.id)}
              onDrop={() => {
                const srcId = draggingIdRef.current;
                if (srcId && srcId !== item.module.id) {
                  reorder(srcId, item.module.id);
                }
              }}
              onDefer={(weeks) => { defer(item.module.id, weeks); track('defer', { id: item.module.id, weeks }); }}
              onRemove={() => toggle(item.module.id, { label: `removed ${item.module.id} from plan` })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TimeAxis({ spanWeeks }: { spanWeeks: number }) {
  // Mark the start of each quarter on the axis. Drop any divider within ~8%
  // of the right edge so the "week N" tail-label has its own breathing room.
  const dividers = QUARTER_DIVIDERS.filter(
    (w) => w < spanWeeks && w / spanWeeks < 0.92
  );
  return (
    <div className="px-2 md:px-4 py-3 border-b border-midnight/10 overflow-x-auto thin-scroll">
      <div className="relative h-7" style={{ minWidth: `${Math.max(800, spanWeeks * 28)}px` }}>
        {dividers.map((w) => (
          <div key={w} className="absolute top-0 h-full" style={{ left: `calc(${(w / spanWeeks) * 100}% - 1px)` }}>
            <span className="absolute top-0 -translate-x-1/2 eyebrow !text-clay !text-[0.55rem] whitespace-nowrap">
              {quarterLabel(w)}
            </span>
          </div>
        ))}
        <div className="absolute right-0 top-0 eyebrow !text-clay !text-[0.55rem]">week {spanWeeks}</div>
        <div className="absolute left-0 top-0 eyebrow !text-clay !text-[0.55rem]">q1 · today</div>
      </div>
    </div>
  );
}

function GanttRow({
  item, idx, spanWeeks,
  isDragging, isDragOver, onDragStart, onDragEnd, onDragOver, onDrop,
  onDefer, onRemove,
}: {
  item: ScheduledModule;
  idx: number;
  spanWeeks: number;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  onDefer: (weeks: number) => void;
  onRemove: () => void;
}) {
  const m = item.module;
  const section = SECTION_BY_KEY.get(m.sectionKey);
  const priority = useStore((s) => s.priorities[m.id]) ?? null;
  const [deferOpen, setDeferOpen] = useState(false);
  const sliderRef = useRef<HTMLInputElement>(null);

  const startPct = (item.startWeek / spanWeeks) * 100;
  const widthPct = (item.durationWeeks / spanWeeks) * 100;

  // Ghost bar position: where the module would have started without its own deferral
  const ghostStart = Math.max(0, item.startWeek - item.lagWeeks);
  const ghostStartPct = (ghostStart / spanWeeks) * 100;
  const ghostEndPct = ghostStartPct + widthPct;

  const isPontis = m.coa === 'COA 3';
  const isBlocked = item.blockedBy.length > 0;

  // Close defer popover when clicking outside
  useEffect(() => {
    if (!deferOpen) return;
    const close = (e: MouseEvent) => {
      if (sliderRef.current && !sliderRef.current.contains(e.target as Node)) {
        // Only close if click is well outside the popover
        const pop = (e.target as HTMLElement).closest('[data-defer-popover]');
        if (!pop) setDeferOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [deferOpen]);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onDragOver();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      className={cn(
        'group relative flex items-center gap-3 py-2 transition-all',
        isDragging && 'opacity-40',
        isDragOver && 'bg-bone/60'
      )}
    >
      {/* Label gutter */}
      <div className="w-[200px] md:w-[280px] shrink-0 flex items-center gap-2 pr-3 border-r border-midnight/8">
        <GripVertical size={12} className="text-clay/60 cursor-grab active:cursor-grabbing group-hover:text-burnt transition-colors" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[0.6875rem] tabular-nums text-burnt">{m.id}</span>
            {priority != null && (
              <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-laser text-midnight text-[9px] font-medium tabular-nums" title={`priority ${priority}`}>
                {priority}
              </span>
            )}
            {item.isDeferred && (
              <span className="px-1 py-0.5 text-[0.55rem] tracking-widish uppercase bg-laser/40 text-midnight rounded-sm">
                +{item.lagWeeks}w
              </span>
            )}
          </div>
          <p className="text-[12px] text-midnight truncate leading-tight mt-0.5 lowercase" title={m.name}>
            {m.name}
          </p>
          <p className="text-[10px] text-clay/80 truncate">
            {section?.name}
          </p>
        </div>
        <div className={cn(
          'flex items-center gap-0.5 transition-opacity',
          deferOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        )}>
          <button
            type="button"
            onClick={() => setDeferOpen((v) => !v)}
            className={cn(
              'relative p-1.5 text-[10px] transition-colors',
              item.isDeferred ? 'text-midnight' : 'text-burnt hover:text-midnight'
            )}
            title="defer this module by N weeks"
            aria-label="Defer slider"
          >
            <Sliders size={12} />
            {deferOpen && (
              <span
                data-defer-popover
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-full mt-1 z-30 bg-midnight text-pearl p-3 rounded-sm shadow-xl w-56 cursor-default"
              >
                <p className="eyebrow !text-pearl/70 !text-[0.55rem] mb-2">defer by</p>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="font-display text-lg tabular-nums">{item.lagWeeks}w</span>
                  <span className="text-[10px] text-pearl/60">{item.lagWeeks === 0 ? 'now' : item.lagWeeks <= 13 ? 'this quarter' : item.lagWeeks <= 26 ? 'next quarter' : 'later'}</span>
                </div>
                <input
                  ref={sliderRef}
                  type="range"
                  min={0}
                  max={52}
                  step={1}
                  value={item.lagWeeks}
                  onChange={(e) => onDefer(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex items-center justify-between mt-2 text-[10px] text-pearl/50 tabular-nums">
                  <span>0w</span>
                  <span>13w · q2</span>
                  <span>52w</span>
                </div>
                {item.lagWeeks > 0 && (
                  <button
                    type="button"
                    onClick={() => onDefer(0)}
                    className="mt-2 flex items-center gap-1 text-[10px] text-laser hover:underline"
                  >
                    <RotateCcw size={9} /> restore to now
                  </button>
                )}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 text-burnt hover:text-midnight transition-colors"
            title="remove from plan"
            aria-label="Remove"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Bar */}
      <div className="relative h-9 flex-1">
        {/* Lane line */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-midnight/8" />

        {/* Ghost bar: where this would have landed without the per-module defer */}
        {item.isDeferred && (
          <>
            <div
              className={cn(
                'absolute top-1/2 -translate-y-1/2 h-7 rounded-sm border border-dashed pointer-events-none',
                isPontis ? 'border-midnight/40' : 'border-burnt/40'
              )}
              style={{
                left: `${ghostStartPct}%`,
                width: `${Math.max(widthPct, 2)}%`,
              }}
              title={`original (without defer): w${Math.round(ghostStart)}–w${Math.round(ghostStart + item.durationWeeks)}`}
            />
            {/* Dotted connector: from ghost-end to actual-start, only if there's daylight */}
            {startPct > ghostEndPct && (
              <div
                className="absolute top-1/2 -translate-y-1/2 h-px pointer-events-none"
                style={{
                  left: `${ghostEndPct}%`,
                  width: `${Math.max(0, startPct - ghostEndPct)}%`,
                  borderTop: '1px dotted rgba(33,65,68,0.45)',
                }}
              />
            )}
          </>
        )}

        {/* Actual bar */}
        <div
          className={cn(
            'absolute top-1/2 -translate-y-1/2 flex items-center justify-between px-2 h-7 rounded-sm transition-all',
            isPontis ? 'bg-midnight text-pearl' : 'bg-burnt text-pearl',
            isBlocked && 'ring-1 ring-laser',
          )}
          style={{
            left: `${startPct}%`,
            width: `${Math.max(widthPct, 2)}%`,
            animation: `riseIn 600ms cubic-bezier(0.16,1,0.3,1) ${idx * 30}ms both`,
          }}
          title={`${m.id} · ${m.timeLabel} · weeks ${Math.round(item.startWeek)}–${Math.round(item.endWeek)}`}
        >
          <span className="text-[10px] tabular-nums">
            w{Math.round(item.startWeek)}–w{Math.round(item.endWeek)}
          </span>
          {isBlocked && (
            <span className="flex items-center gap-1 text-[9px] text-laser">
              <AlertTriangle size={9} strokeWidth={2.5} /> needs {item.blockedBy.map((id) => id.replace('C3-', '')).join(', ')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
