// FSC's curated recommended plan.
//
// Three tiers of picks, computed from the catalog at module load:
//
//   1. Foundation — COA 1 + COA 2 items (Copilot cancel, Claude rollout,
//      training) and the platform plumbing (C3-A1/A4/A5). These don't save
//      hours on their own; they make every later module possible.
//   2. Hubs — COA 3 modules with two or more downstream dependents. Building
//      them unblocks the rest of the catalog.
//   3. Phase leaders — per lifecycle phase, the COA 3 module with the highest
//      `hoursSavedPerYear`. Spreads ROI across Maggie's full business ops
//      (inquiry → proposal → design → CA → closeout) instead of clustering
//      in one phase.
//
// All transitive prerequisites of picks are pulled in automatically so the
// resulting plan is dependency-valid.

import type { PontisModule } from '../types';

export interface FscPlanTier {
  key: 'foundation' | 'hubs' | 'phase';
  label: string;
  hook: string;            // one-line "why this tier" framing
  modules: { id: string; rationale: string }[];
}

export interface FscPlan {
  tiers: FscPlanTier[];
  /** All recommended IDs, in apply-order, including transitive prerequisites. */
  allIds: string[];
  /** Direct picks before prereq expansion (for counts on the page). */
  directIds: string[];
}

function expandPrereqs(rootIds: string[], byId: Map<string, PontisModule>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const visit = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const m = byId.get(id);
    if (!m) return;
    for (const dep of m.dependencies) visit(dep);
    out.push(id);
  };
  for (const id of rootIds) visit(id);
  return out;
}

export function computeFscPlan(modules: PontisModule[]): FscPlan {
  const byId = new Map(modules.map((m) => [m.id, m] as const));

  // Tally downstream dependents for hub detection.
  const dependents = new Map<string, number>();
  for (const m of modules) {
    for (const dep of m.dependencies) {
      dependents.set(dep, (dependents.get(dep) ?? 0) + 1);
    }
  }

  // ── Tier 1: Foundation ─────────────────────────────────────────────────────
  // All COA 1 + COA 2 modules, plus the COA 3 platform foundation pieces.
  const foundationCoa12 = modules
    .filter((m) => m.coa === 'COA 1' || m.coa === 'COA 2')
    .sort((a, b) => a.id.localeCompare(b.id));
  const foundationPlatform = modules.filter((m) =>
    ['C3-A1', 'C3-A4', 'C3-A5'].includes(m.id)
  );
  const foundationMods = [...foundationCoa12, ...foundationPlatform];

  // ── Tier 2: Hubs (everything-else depends on these) ────────────────────────
  const hubMods = modules
    .filter((m) => m.coa === 'COA 3' && (dependents.get(m.id) ?? 0) >= 2)
    .sort((a, b) => (dependents.get(b.id) ?? 0) - (dependents.get(a.id) ?? 0));

  // ── Tier 3: Phase leaders (top retainer module per lifecycle phase) ────────
  // Skip modules already in foundation/hubs so we don't double-list.
  const claimed = new Set([
    ...foundationMods.map((m) => m.id),
    ...hubMods.map((m) => m.id),
  ]);
  const byPhase = new Map<string, PontisModule>();
  for (const m of modules) {
    if (m.coa !== 'COA 3') continue;
    if (!m.hoursSavedPerYear) continue;
    if (claimed.has(m.id)) continue;
    const phase = (m.lifecyclePhase || 'Cross-cutting').trim();
    const cur = byPhase.get(phase);
    if (!cur || (m.hoursSavedPerYear ?? 0) > (cur.hoursSavedPerYear ?? 0)) {
      byPhase.set(phase, m);
    }
  }
  // Order phases canonically — Inquiry → Closeout, then Cross-cutting.
  const phaseOrder = [
    '1. Inquiry / RFP',
    '2. Proposal',
    '3. Design / Docs / Permitting',
    '4. Construction Admin',
    '5. Closeout',
    'Cross-cutting',
    '6. Cross-cutting',
  ];
  const phaseLeaderMods = Array.from(byPhase.entries())
    .sort(([a], [b]) => {
      const ai = phaseOrder.indexOf(a);
      const bi = phaseOrder.indexOf(b);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    })
    .map(([, m]) => m);

  const tiers: FscPlanTier[] = [
    {
      key: 'foundation',
      label: 'foundation',
      hook: 'cancel what isn\'t earning its keep, get the team on claude, stand up the pontis spine. these don\'t save hours yet — they make every later module possible.',
      modules: foundationMods.map((m) => ({
        id: m.id,
        rationale:
          m.coa === 'COA 1'
            ? 'immediate cost reclaim — frees budget that funds the rest of the plan.'
            : m.coa === 'COA 2'
              ? 'team capability lift; pontis without claude fluency is half-built.'
              : 'platform layer; nothing downstream lands without this in place.',
      })),
    },
    {
      key: 'hubs',
      label: 'hubs · most-leveraged modules',
      hook: 'each of these has multiple modules waiting downstream. ship them early and the rest of the plan accelerates.',
      modules: hubMods.map((m) => ({
        id: m.id,
        rationale: `${dependents.get(m.id) ?? 0} downstream module${(dependents.get(m.id) ?? 0) === 1 ? '' : 's'} depend on this — building it unlocks them.`,
      })),
    },
    {
      key: 'phase',
      label: 'phase leaders · highest roi across the lifecycle',
      hook: 'one big-hours module per phase of the work — so pontis doesn\'t just speed up one moment of the day, it lifts the whole arc from inquiry to closeout.',
      modules: phaseLeaderMods.map((m) => {
        const phase = (m.lifecyclePhase || 'Cross-cutting').replace(/^\d+\.\s+/, '');
        return {
          id: m.id,
          rationale: `top retainer-covered roi in ${phase.toLowerCase()} — ${m.hoursSavedPerYear} hrs/yr.`,
        };
      }),
    },
  ];

  const directIds = tiers.flatMap((t) => t.modules.map((m) => m.id));
  const allIds = expandPrereqs(directIds, byId);

  return { tiers, allIds, directIds };
}
