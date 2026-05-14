import type { PontisModule } from '../types';

export interface ScheduledModule {
  module: PontisModule;
  startWeek: number;
  endWeek: number;
  durationWeeks: number;
  isDeferred: boolean;
  lagWeeks: number;        // explicit per-module defer applied (0 if none)
  blockedBy: string[];     // unmet dependencies in current selection
}

const midpoint = (m: PontisModule) => Math.max(1, (m.weeksLow + m.weeksHigh) / 2);

// Build a schedule that:
//   1. Respects ordering in `orderedIds`.
//   2. Honors dependencies (a module starts after the *latest end* of its deps).
//   3. Applies the per-module deferral as an extra lag in weeks.
//   4. Limits parallelism to `concurrency` lanes — modules find the earliest open
//      lane after their dependency floor.
export function buildSchedule(
  orderedIds: string[],
  byId: Map<string, PontisModule>,
  deferrals: Map<string, number>,
  concurrency = 2
): ScheduledModule[] {
  const scheduledById = new Map<string, ScheduledModule>();
  const lanes: number[] = new Array(concurrency).fill(0);
  const result: ScheduledModule[] = [];

  for (const id of orderedIds) {
    const m = byId.get(id);
    if (!m) continue;

    // Floor based on deps within current selection
    let depFloor = 0;
    const blockedBy: string[] = [];
    for (const dep of m.dependencies) {
      const sched = scheduledById.get(dep);
      if (sched) {
        depFloor = Math.max(depFloor, sched.endWeek);
      } else if (byId.has(dep)) {
        // Dep exists in catalog but not in current plan — informational
        blockedBy.push(dep);
      }
    }

    const lagWeeks = deferrals.get(id) ?? 0;
    const earliest = depFloor + lagWeeks;

    // Find earliest free lane >= earliest
    let bestLane = 0;
    let bestStart = Math.max(earliest, lanes[0]);
    for (let i = 1; i < lanes.length; i++) {
      const cand = Math.max(earliest, lanes[i]);
      if (cand < bestStart) {
        bestStart = cand;
        bestLane = i;
      }
    }

    const duration = Math.max(1, Math.round(midpoint(m)));
    const start = bestStart;
    const end = start + duration;
    lanes[bestLane] = end;

    const item: ScheduledModule = {
      module: m,
      startWeek: start,
      endWeek: end,
      durationWeeks: duration,
      isDeferred: lagWeeks > 0,
      lagWeeks,
      blockedBy,
    };
    scheduledById.set(id, item);
    result.push(item);
  }
  return result;
}

export function totalSpanWeeks(items: ScheduledModule[]): number {
  return items.reduce((max, i) => Math.max(max, i.endWeek), 0);
}

// Group weeks into rough quarters for the time axis
export function quarterLabel(week: number): string {
  if (week < 4) return 'phase 1';
  if (week < 10) return 'phase 2';
  if (week < 16) return 'phase 3';
  if (week < 26) return 'phase 4';
  if (week < 39) return 'q3';
  return 'q4+';
}
