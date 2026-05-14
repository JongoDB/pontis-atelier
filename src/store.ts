import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ChangeLogEntry, PlanSnapshot } from './types';
import { DEFAULT_ASSUMPTIONS, type CostAssumptions } from './lib/cost';
import { localStorageAdapter } from './lib/storage';

const STORAGE_KEY = 'pontis-atelier-state-v1';
const LOG_CAP = 60; // keep the last 60 entries — change log is a sidebar, not a database

interface State {
  // Selection: ordered list of module IDs Maggie has selected
  selectedOrder: string[];
  // Per-module deferral in weeks (0 = no defer; 13 = "next quarter")
  deferrals: Record<string, number>;
  // Per-module priority Maggie's rack/stack — 1=do first, 2=do next, 3=later.
  // null/undefined = fall back to FSC suggested sequence.
  priorities: Record<string, number>;
  // Cost assumptions (sliders, editable)
  assumptions: CostAssumptions;
  // Change log
  log: ChangeLogEntry[];
  // First-run welcome dismissed
  hasOpenedBefore: boolean;
  // Hey Pontis recent prompt
  lastPlannerPrompt: string;
  // Committed plan snapshots, newest first
  snapshots: PlanSnapshot[];
}

interface Actions {
  isSelected: (id: string) => boolean;
  toggle: (id: string, opts?: { silent?: boolean; label?: string }) => void;
  selectMany: (ids: string[], label: string) => void;
  reorder: (sourceId: string, targetId: string) => void;
  defer: (id: string, weeks: number) => void;
  setPriority: (id: string, priority: number | null) => void;
  setAssumption: <K extends keyof CostAssumptions>(key: K, value: CostAssumptions[K]) => void;
  undo: (entryId: string) => void;
  reset: () => void;
  dismissWelcome: () => void;
  setLastPlannerPrompt: (p: string) => void;
  applyShared: (input: { selected: string[]; deferrals: Record<string, number>; priorities: Record<string, number> }) => void;
  finalize: (input: Omit<PlanSnapshot, 'id' | 'finalizedAt' | 'selectedOrder' | 'deferrals' | 'priorities'>) => PlanSnapshot;
  removeSnapshot: (id: string) => void;
}

export type AtelierStore = State & Actions;

const initialState: State = {
  selectedOrder: [],
  deferrals: {},
  priorities: {},
  assumptions: { ...DEFAULT_ASSUMPTIONS },
  log: [],
  hasOpenedBefore: false,
  lastPlannerPrompt: '',
  snapshots: [],
};

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const pushLog = (log: ChangeLogEntry[], entry: ChangeLogEntry) => {
  const next = [entry, ...log];
  return next.slice(0, LOG_CAP);
};

export const useStore = create<AtelierStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      isSelected: (id) => get().selectedOrder.includes(id),

      toggle: (id, opts) => {
        const { selectedOrder, deferrals, log } = get();
        const isCurrentlySelected = selectedOrder.includes(id);
        if (isCurrentlySelected) {
          const nextSelected = selectedOrder.filter((x) => x !== id);
          const nextDeferrals = { ...deferrals };
          delete nextDeferrals[id];
          const entry: ChangeLogEntry = {
            id: newId(),
            at: Date.now(),
            kind: 'deselect',
            moduleId: id,
            label: opts?.label ?? `removed ${id}`,
            reversible: true,
            payload: { restoreIndex: selectedOrder.indexOf(id) },
          };
          set({
            selectedOrder: nextSelected,
            deferrals: nextDeferrals,
            log: opts?.silent ? log : pushLog(log, entry),
          });
        } else {
          const entry: ChangeLogEntry = {
            id: newId(),
            at: Date.now(),
            kind: 'select',
            moduleId: id,
            label: opts?.label ?? `selected ${id}`,
            reversible: true,
          };
          set({
            selectedOrder: [...selectedOrder, id],
            log: opts?.silent ? log : pushLog(log, entry),
          });
        }
      },

      selectMany: (ids, label) => {
        const { selectedOrder, log } = get();
        const fresh = ids.filter((id) => !selectedOrder.includes(id));
        if (fresh.length === 0) return;
        const entry: ChangeLogEntry = {
          id: newId(),
          at: Date.now(),
          kind: 'plan-apply',
          label,
          reversible: true,
          payload: { addedIds: fresh },
        };
        set({
          selectedOrder: [...selectedOrder, ...fresh],
          log: pushLog(log, entry),
        });
      },

      reorder: (sourceId, targetId) => {
        const { selectedOrder, log } = get();
        const from = selectedOrder.indexOf(sourceId);
        const to = selectedOrder.indexOf(targetId);
        if (from === -1 || to === -1 || from === to) return;
        const next = [...selectedOrder];
        next.splice(from, 1);
        next.splice(to, 0, sourceId);
        const entry: ChangeLogEntry = {
          id: newId(),
          at: Date.now(),
          kind: 'reorder',
          moduleId: sourceId,
          label: `reordered ${sourceId}`,
          reversible: true,
          payload: { from, to },
        };
        set({ selectedOrder: next, log: pushLog(log, entry) });
      },

      setPriority: (id, priority) => {
        const { priorities, log } = get();
        const prev = priorities[id] ?? null;
        if (prev === priority) return;
        const next = { ...priorities };
        if (priority == null) delete next[id];
        else next[id] = priority;
        const entry: ChangeLogEntry = {
          id: newId(),
          at: Date.now(),
          kind: 'assumption', // reuse "assumption" kind — it's a non-selection state edit
          moduleId: id,
          label: priority == null ? `cleared priority on ${id}` : `set priority ${priority} on ${id}`,
          reversible: true,
          payload: { key: 'priorities', priorityFor: id, prev },
        };
        set({ priorities: next, log: pushLog(log, entry) });
      },

      defer: (id, weeks) => {
        const { deferrals, log } = get();
        const prev = deferrals[id] ?? 0;
        if (prev === weeks) return;
        const nextDeferrals = { ...deferrals };
        if (weeks > 0) nextDeferrals[id] = weeks;
        else delete nextDeferrals[id];
        const entry: ChangeLogEntry = {
          id: newId(),
          at: Date.now(),
          kind: weeks > prev ? 'defer' : 'undefer',
          moduleId: id,
          label: weeks > 0 ? `deferred ${id} by ${weeks}w` : `restored ${id}`,
          reversible: true,
          payload: { prev },
        };
        set({ deferrals: nextDeferrals, log: pushLog(log, entry) });
      },

      setAssumption: (key, value) => {
        const { assumptions, log } = get();
        if (assumptions[key] === value) return;
        const prev = assumptions[key];
        const entry: ChangeLogEntry = {
          id: newId(),
          at: Date.now(),
          kind: 'assumption',
          label: `set ${String(key)} = ${value}`,
          reversible: true,
          payload: { key, prev },
        };
        set({
          assumptions: { ...assumptions, [key]: value },
          log: pushLog(log, entry),
        });
      },

      undo: (entryId) => {
        const { log, selectedOrder, deferrals, assumptions } = get();
        const entry = log.find((e) => e.id === entryId);
        if (!entry || !entry.reversible) return;
        switch (entry.kind) {
          case 'select': {
            if (!entry.moduleId) return;
            set({
              selectedOrder: selectedOrder.filter((x) => x !== entry.moduleId),
              log: log.filter((e) => e.id !== entryId),
            });
            break;
          }
          case 'deselect': {
            if (!entry.moduleId) return;
            const idx = (entry.payload as { restoreIndex?: number } | undefined)?.restoreIndex ?? selectedOrder.length;
            const next = [...selectedOrder];
            next.splice(Math.min(idx, next.length), 0, entry.moduleId);
            set({ selectedOrder: next, log: log.filter((e) => e.id !== entryId) });
            break;
          }
          case 'plan-apply': {
            const added = (entry.payload as { addedIds?: string[] } | undefined)?.addedIds ?? [];
            set({
              selectedOrder: selectedOrder.filter((x) => !added.includes(x)),
              log: log.filter((e) => e.id !== entryId),
            });
            break;
          }
          case 'reorder': {
            if (!entry.moduleId) return;
            const from = (entry.payload as { from: number; to: number }).from;
            const to = (entry.payload as { from: number; to: number }).to;
            const next = [...selectedOrder];
            const cur = next.indexOf(entry.moduleId);
            if (cur === -1) return;
            next.splice(cur, 1);
            next.splice(from, 0, entry.moduleId);
            void to;
            set({ selectedOrder: next, log: log.filter((e) => e.id !== entryId) });
            break;
          }
          case 'defer':
          case 'undefer': {
            if (!entry.moduleId) return;
            const prev = (entry.payload as { prev?: number } | undefined)?.prev ?? 0;
            const nextDeferrals = { ...deferrals };
            if (prev > 0) nextDeferrals[entry.moduleId] = prev;
            else delete nextDeferrals[entry.moduleId];
            set({ deferrals: nextDeferrals, log: log.filter((e) => e.id !== entryId) });
            break;
          }
          case 'assumption': {
            const payload = entry.payload as { key?: string; prev?: unknown; priorityFor?: string } | undefined;
            if (!payload?.key) return;
            // Priority changes piggyback on 'assumption' kind so undo handles both
            if (payload.key === 'priorities' && payload.priorityFor) {
              const id = payload.priorityFor;
              const prev = payload.prev as number | null;
              const { priorities } = get();
              const next = { ...priorities };
              if (prev == null) delete next[id];
              else next[id] = prev;
              set({ priorities: next, log: log.filter((e) => e.id !== entryId) });
            } else {
              set({
                assumptions: { ...assumptions, [payload.key as keyof CostAssumptions]: payload.prev as never },
                log: log.filter((e) => e.id !== entryId),
              });
            }
            break;
          }
          case 'reset':
            // Reset is one-way for now.
            break;
        }
      },

      reset: () => {
        set({
          ...initialState,
          hasOpenedBefore: get().hasOpenedBefore,
          log: [{ id: newId(), at: Date.now(), kind: 'reset', label: 'cleared plan', reversible: false }],
        });
      },

      dismissWelcome: () => set({ hasOpenedBefore: true }),
      setLastPlannerPrompt: (p) => set({ lastPlannerPrompt: p }),

      finalize: (input) => {
        const { selectedOrder, deferrals, priorities, snapshots, log } = get();
        const snapshot: PlanSnapshot = {
          id: newId(),
          finalizedAt: Date.now(),
          finalizedBy: input.finalizedBy,
          note: input.note,
          selectedOrder: [...selectedOrder],
          deferrals: { ...deferrals },
          priorities: { ...priorities },
          totals: input.totals,
        };
        const entry: ChangeLogEntry = {
          id: newId(),
          at: Date.now(),
          kind: 'finalize',
          label: `finalized · ${input.finalizedBy} · ${selectedOrder.length} modules`,
          reversible: false,
          payload: { snapshotId: snapshot.id },
        };
        set({
          snapshots: [snapshot, ...snapshots].slice(0, 20),
          log: pushLog(log, entry),
        });
        return snapshot;
      },

      removeSnapshot: (id) => {
        const { snapshots } = get();
        set({ snapshots: snapshots.filter((s) => s.id !== id) });
      },

      applyShared: (input) => {
        const entry: ChangeLogEntry = {
          id: newId(),
          at: Date.now(),
          kind: 'plan-apply',
          label: `imported shared plan · ${input.selected.length} modules`,
          reversible: false,
          payload: { addedIds: input.selected },
        };
        set({
          selectedOrder: input.selected,
          deferrals: input.deferrals,
          priorities: input.priorities,
          log: pushLog(get().log, entry),
        });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorageAdapter()),
      partialize: (s) => ({
        selectedOrder: s.selectedOrder,
        deferrals: s.deferrals,
        priorities: s.priorities,
        assumptions: s.assumptions,
        log: s.log,
        hasOpenedBefore: s.hasOpenedBefore,
        lastPlannerPrompt: s.lastPlannerPrompt,
        snapshots: s.snapshots,
      }),
      version: 1,
    }
  )
);
