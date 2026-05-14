export type COA = 'COA 1' | 'COA 2' | 'COA 3';

export interface PontisModule {
  id: string;
  name: string;
  description: string;
  coa: COA;
  sectionKey: string;
  timeLabel: string;
  weeksLow: number;
  weeksHigh: number;
  billableHours: number | null;
  rom: number;
  retainerCovered: boolean;
  hoursSavedPerYear: number | null;
  currentTool: string;
  desiredOutcome: string;
  lifecyclePhase: string;
  matrixRef: string;
  dependencies: string[];
  fscSequence: number | null;
}

export interface PontisSection {
  key: string;
  name: string;
  descriptor: string;
  accent: string;
}

export interface RoadmapWindow {
  window: string;
  phase: string;
  modules: string[];
  outcome: string;
}

export interface BusinessValueDefaults {
  hoursSavedTotalDefault: number;
  internalRateDefault: number;
  principalRateDefault: number;
  adoptionFloorDefault: number;
  workingWeeksDefault: number;
}

export interface ModulesData {
  generatedAt: string;
  sourceWorkbook: string;
  sections: PontisSection[];
  modules: PontisModule[];
  roadmap: RoadmapWindow[];
  businessValue: BusinessValueDefaults;
  counts: { total: number; coa1: number; coa2: number; coa3: number; sections: number };
}

export interface ChangeLogEntry {
  id: string;
  at: number;            // epoch ms
  kind: 'select' | 'deselect' | 'defer' | 'undefer' | 'reorder' | 'plan-apply' | 'reset' | 'assumption' | 'finalize' | 'reopen';
  moduleId?: string;
  label: string;
  reversible: boolean;
  payload?: unknown;     // small JSON blob used by the undo path
}

// A committed plan snapshot. Maggie can produce many of these over time —
// each one a moment she said "yes, this is what I want."
export interface PlanSnapshot {
  id: string;
  finalizedAt: number;
  finalizedBy: string;       // Maggie types her name
  note: string;              // optional accompanying note
  selectedOrder: string[];
  deferrals: Record<string, number>;
  priorities: Record<string, number>;
  totals: {
    modules: number;
    billableROM: number;
    hoursSavedPerYear: number;
    annualSavedInternal: number;
    quartersOfRetainerBuild: number;
  };
}
