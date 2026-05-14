import raw from './modules.json';
import type { ModulesData, PontisModule, PontisSection } from '../types';
import { buildDependencyIndex } from '../lib/dependencies';

const data = raw as ModulesData;

export const ALL_MODULES: PontisModule[] = data.modules;
export const SECTIONS: PontisSection[] = data.sections;
export const ROADMAP = data.roadmap;
export const BUSINESS_VALUE_DEFAULTS = data.businessValue;
export const COUNTS = data.counts;
export const GENERATED_AT = data.generatedAt;

export const MODULE_BY_ID = new Map(ALL_MODULES.map((m) => [m.id, m] as const));
export const SECTION_BY_KEY = new Map(SECTIONS.map((s) => [s.key, s] as const));

// Shared dependency index. The catalog never changes at runtime, so each
// component re-running `buildDependencyIndex(ALL_MODULES)` inside its own
// `useMemo` was duplicating the same Maps in memory and burning cycles on
// every mount. One singleton, imported everywhere.
export const DEP_INDEX = buildDependencyIndex(ALL_MODULES);

// Grouped by section, in section order. Within a section, FSC suggested sequence first.
export const MODULES_BY_SECTION = (() => {
  const groups = new Map<string, PontisModule[]>();
  for (const s of SECTIONS) groups.set(s.key, []);
  for (const m of ALL_MODULES) {
    const list = groups.get(m.sectionKey);
    if (list) list.push(m);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => {
      const aSeq = a.fscSequence ?? 999;
      const bSeq = b.fscSequence ?? 999;
      if (aSeq !== bSeq) return aSeq - bSeq;
      return a.id.localeCompare(b.id);
    });
  }
  return groups;
})();
