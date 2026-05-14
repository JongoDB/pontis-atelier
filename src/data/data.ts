import raw from './modules.json';
import type { ModulesData, PontisModule, PontisSection } from '../types';

const data = raw as ModulesData;

export const ALL_MODULES: PontisModule[] = data.modules;
export const SECTIONS: PontisSection[] = data.sections;
export const ROADMAP = data.roadmap;
export const BUSINESS_VALUE_DEFAULTS = data.businessValue;
export const COUNTS = data.counts;
export const GENERATED_AT = data.generatedAt;

export const MODULE_BY_ID = new Map(ALL_MODULES.map((m) => [m.id, m] as const));
export const SECTION_BY_KEY = new Map(SECTIONS.map((s) => [s.key, s] as const));

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
