import type { PontisModule } from '../types';

export interface CostAssumptions {
  internalRate: number;     // $/hr blended (default 80)
  principalRate: number;    // $/hr Maggie's rate (default 200)
  adoptionRate: number;     // 0..1, default 0.7
  workingWeeks: number;     // default 50
  retainerPerQuarter: number; // default 1500
}

export const DEFAULT_ASSUMPTIONS: CostAssumptions = {
  internalRate: 80,
  principalRate: 200,
  adoptionRate: 0.7,
  workingWeeks: 50,
  retainerPerQuarter: 1500,
};

export interface CostSummary {
  billableHours: number;
  billableROM: number;
  retainerModules: number;
  retainerQuartersNeeded: number;
  totalHoursSaved: number;
  annualSavedInternal: number;
  annualSavedPrincipal: number;
  fiveYearInternal: number;
  fiveYearPrincipal: number;
  costPerRecoveredHour: number; // ROM / hoursSaved (lower = better)
  byPhase: PhaseRollup[];       // per-lifecycle-phase breakdown
}

export interface PhaseRollup {
  phase: string;                // canonical name (Inquiry / Proposal / etc.)
  modules: number;
  hoursSaved: number;
  internalDollars: number;
  principalDollars: number;
}

// Canonical phase order matching ĒSO's lifecycle. Modules with a non-matching
// `lifecyclePhase` get bucketed into 'Cross-cutting'.
const PHASE_ORDER = [
  '1. Inquiry / RFP',
  '2. Proposal',
  '3. Design / Docs / Permitting',
  '4. Construction Admin',
  '5. Closeout',
  '6. Cross-cutting',
  'Cross-cutting',
] as const;

function normalizePhase(raw: string): string {
  if (!raw) return 'Cross-cutting';
  const trimmed = raw.trim();
  if (trimmed === 'Cross-cutting') return 'Cross-cutting';
  const match = PHASE_ORDER.find((p) => p === trimmed);
  if (match) return match.replace(/^\d+\.\s+/, '');
  // Fallback: strip numbering prefix
  return trimmed.replace(/^\d+\.\s+/, '') || 'Cross-cutting';
}

export function computeSummary(
  modules: PontisModule[],
  deferralWeeks: Map<string, number>,
  assumptions: CostAssumptions
): CostSummary {
  let billableHours = 0;
  let billableROM = 0;
  let retainerModules = 0;
  let weeksOfWork = 0;
  let totalHoursSaved = 0;

  // Phase rollups: accumulate post-adoption-prorated hours by phase
  const phaseMap = new Map<string, { modules: number; hoursSaved: number }>();
  const adoptionScalar = assumptions.adoptionRate / 0.7;

  for (const m of modules) {
    if (m.retainerCovered) {
      retainerModules += 1;
      // Approximate effort cost on FSC's side via weeks-of-work; used to size retainer
      // quarters needed. Use the midpoint of the time-to-delivery range.
      weeksOfWork += (m.weeksLow + m.weeksHigh) / 2;
    } else {
      billableHours += m.billableHours ?? 0;
      billableROM += m.rom;
    }

    const phase = normalizePhase(m.lifecyclePhase);
    const bucket = phaseMap.get(phase) ?? { modules: 0, hoursSaved: 0 };
    bucket.modules += 1;

    if (m.hoursSavedPerYear != null) {
      // Defer the realisation of savings — a module deferred by N weeks loses
      // a proportional share of its first-year savings.
      const deferWeeks = deferralWeeks.get(m.id) ?? 0;
      const proration = Math.max(0, 1 - deferWeeks / assumptions.workingWeeks);
      const prorated = m.hoursSavedPerYear * proration * adoptionScalar;
      totalHoursSaved += prorated;
      bucket.hoursSaved += prorated;
    }
    phaseMap.set(phase, bucket);
  }

  // Retainer planning: ≈ 8 FSC-weeks fit in one $1,500 quarter (FSC's COA 3 rule of
  // thumb under the existing retainer cadence). The exact number is informational —
  // Maggie reads "how many quarters of build will this take" out of this.
  const FSC_WEEKS_PER_QUARTER = 8;
  const retainerQuartersNeeded =
    weeksOfWork > 0 ? Math.max(1, Math.ceil(weeksOfWork / FSC_WEEKS_PER_QUARTER)) : 0;

  const annualSavedInternal = totalHoursSaved * assumptions.internalRate;
  const annualSavedPrincipal = totalHoursSaved * assumptions.principalRate;

  // Sort phases canonically (Inquiry → Closeout, then Cross-cutting last)
  const phaseSortOrder = ['Inquiry / RFP', 'Proposal', 'Design / Docs / Permitting', 'Construction Admin', 'Closeout', 'Cross-cutting'];
  const byPhase: PhaseRollup[] = Array.from(phaseMap.entries())
    .map(([phase, v]) => ({
      phase,
      modules: v.modules,
      hoursSaved: v.hoursSaved,
      internalDollars: v.hoursSaved * assumptions.internalRate,
      principalDollars: v.hoursSaved * assumptions.principalRate,
    }))
    .sort((a, b) => {
      const ai = phaseSortOrder.indexOf(a.phase);
      const bi = phaseSortOrder.indexOf(b.phase);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    });

  return {
    billableHours,
    billableROM,
    retainerModules,
    retainerQuartersNeeded,
    totalHoursSaved,
    annualSavedInternal,
    annualSavedPrincipal,
    fiveYearInternal: annualSavedInternal * 5,
    fiveYearPrincipal: annualSavedPrincipal * 5,
    costPerRecoveredHour: totalHoursSaved > 0 ? billableROM / totalHoursSaved : 0,
    byPhase,
  };
}
