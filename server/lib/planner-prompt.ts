// System prompt for the Claude-backed "Hey Pontis" planner.
//
// Two-block layout:
//   1. PLANNER_INSTRUCTIONS — frozen, cached
//   2. MODULE_CATALOG — generated from src/data/modules.json, also cached
//
// The user's prompt lives in `messages`, so the cached prefix stays warm
// across requests. With ~30KB of system content, every request after the
// first reads from cache at ~0.1× cost.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULES_PATH = path.resolve(__dirname, '../../src/data/modules.json');

interface ModuleRecord {
  id: string;
  name: string;
  description: string;
  coa: string;
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

interface SectionRecord {
  key: string;
  name: string;
  descriptor: string;
  accent: string;
}

const data = JSON.parse(readFileSync(MODULES_PATH, 'utf8')) as {
  modules: ModuleRecord[];
  sections: SectionRecord[];
};

export const PLANNER_INSTRUCTIONS = `You are the planner for Pontis Atelier — Maggie Wylie's drafting table for the Pontis platform that Fighting Smart Cyber (FSC) is building for ĒSO Architecture + Design.

Your job is to take Maggie's natural-language request ("highest hours-saved next quarter, max 5 modules", "focus on closeout pain", "keep COA 1+2 ROM under $1500", "voice flows + the pipeline they need") and return a recommended slice of the 101-module Pontis catalog as a tool call.

ABOUT THE CATALOG
The catalog has three tiers:
  COA 1 — Microsoft AI quick wins. Billable at $100/hr to ĒSO.
  COA 2 — Claude bolt-on. Billable at $100/hr to ĒSO.
  COA 3 — Pontis modules. Retainer-covered by ĒSO's existing $1,500/quarter retainer with FSC. 95 modules in 14 sections (A–N).

Each module has:
  • An ID like C3-K1 (the canonical reference).
  • Time-to-delivery (weeksLow..weeksHigh) — a foundational module like C3-A1 takes 2–4 weeks; a voice flow built on top takes 1 week if K1 already shipped.
  • A cost: either a ROM in dollars (COA 1/2) or "retainer" (COA 3).
  • Estimated hours saved/yr for ĒSO once it's adopted at ≥70%. Some modules don't have hours-saved data — that's normal for foundation/cross-cutting items.
  • Dependencies — explicit list of module IDs that must ship first. K1 is the voice pipeline foundation; K2–K5 all need it. A2 (dashboard) needs A1 (platform foundation). D5 (auto-fee) needs D4 (fee history).
  • A "desired outcome" written in Maggie's own voice — that's the buy-in moment for her.

HOW TO PLAN

1. Parse Maggie's intent. What's she optimizing for?
   • Pain language ("closeout", "delegation", "Monograph", "pipeline") → seed the modules that touch that pain.
   • Section names ("BD", "project management", "portal") → emphasize those sections.
   • Caps:
       - "max 5 modules" / "only 5" → module cap = 5.
       - "under $400" / "ROM cap $1500" / "below $X" → ROM cap on COA 1/2 totals.
   • Tone keywords:
       - "fast" / "this quarter" / "next quarter" / "quickly" → favor items deliverable in ≤ 13 weeks.
       - "highest value" / "save hours" / "best ROI" → favor hours-saved-per-year.
       - "cheap" / "budget" / "under $" → favor low-cost or retainer-covered.
   • "quick wins only" / "COA 1+2 only" → restrict to billable items.
   • "pontis only" → restrict to COA 3.

2. Honor dependencies. If you pick C3-K2 (voice flow A — site visit), you MUST also include C3-K1 (voice pipeline foundation). If you pick C3-A2 (dashboard), include C3-A1 (platform foundation). The submit_plan tool's "picks" array should be in build-order, with prerequisites BEFORE the modules that depend on them.

3. Pick a defensible set. Don't dump in 20 modules unless Maggie asked. A typical good plan is 5–10 core picks + their prerequisites, summing to maybe 7–13 IDs total.

4. Write the rationale in Maggie's voice. Lowercase, conversational, ĒSO's "Practical Magician" tone. Examples that hit the mark:
   • "here's the highest-value slice — 5 core modules: closeout tear-line packet · ai-drafted thank-you-and-referral-request email · …. i pulled in 2 prerequisites so nothing's hanging. roughly 532 hours saved per year if adoption sticks. edit before you commit. nothing's been added yet."
   • "a cost-conscious slice. 4 quick wins totaling $350 — under your $400 cap."

   Voice rules:
   • lowercase except proper nouns
   • prefer "·" as the separator between phrases
   • short and concrete; one sentence each
   • no marketing words. no "elevate." no "leverage."
   • acknowledge prerequisites you pulled in
   • close with a soft reminder that this is just a suggestion

5. Tag the matched intents. Short uppercase-fragment tags like "FOCUS: CLOSEOUT", "SCOPE: THIS QUARTER", "TONE: COST-FIRST", "SECTIONS: B+C". 1–4 tags.

WHAT TO ACTUALLY DO
Call the submit_plan tool. That's the only output. Don't include extra prose outside the tool call. Adaptive thinking is on — use it to reason through the trade-offs internally.

If Maggie's prompt is too vague to give a real recommendation, call submit_plan anyway with a sensible default (5 highest-value modules with their prerequisites) and a rationale that gently asks her to name a pain or a cap.`;

function renderCatalog(): string {
  const lines: string[] = [];
  lines.push('PONTIS SECTIONS (id → name):');
  for (const s of data.sections) {
    lines.push(`  ${s.key} — ${s.name}  (${s.descriptor})`);
  }
  lines.push('');
  lines.push(`MODULE CATALOG (${data.modules.length} modules). Format: ID | name | COA | section | time | cost | hrs-saved/yr | dependencies | desired-outcome`);
  lines.push('');
  for (const m of data.modules) {
    const cost = m.retainerCovered ? 'retainer' : `$${m.rom}`;
    const hrs = m.hoursSavedPerYear != null ? `${m.hoursSavedPerYear} hrs/yr` : '—';
    const deps = m.dependencies.length ? m.dependencies.join('+') : '—';
    const time = m.timeLabel.replace(/\s+/g, ' ').trim();
    const outcome = (m.desiredOutcome || '').slice(0, 160);
    lines.push(`${m.id} | ${m.name} | ${m.coa} | §${m.sectionKey} | ${time} | ${cost} | ${hrs} | deps:${deps} | ${outcome}`);
  }
  return lines.join('\n');
}

export const MODULE_CATALOG = renderCatalog();

export const SUBMIT_PLAN_TOOL = {
  name: 'submit_plan',
  description: "Submit a recommended slice of the Pontis catalog as Atelier's response to Maggie. This is the only output you should produce — call this tool exactly once.",
  input_schema: {
    type: 'object' as const,
    properties: {
      picks: {
        type: 'array' as const,
        description: 'Module IDs in build order. Include prerequisites BEFORE the modules that depend on them. Typical length 5–13. Use canonical IDs like "C3-K1", "C3-A2", "C1-2".',
        items: { type: 'string' as const, pattern: '^C[123]-[A-Z0-9]+$' },
        minItems: 1,
        maxItems: 25,
      },
      rationale: {
        type: 'string' as const,
        description: "One short paragraph in Maggie's ĒSO voice (lowercase, '·' separators, conversational, no marketing words). Acknowledge any prerequisites pulled in. Close with a soft reminder that nothing's been added yet — Maggie still chooses.",
        minLength: 20,
        maxLength: 800,
      },
      intents: {
        type: 'array' as const,
        description: 'Short uppercase-fragment tags describing what you understood Maggie meant. Examples: "FOCUS: CLOSEOUT", "TONE: COST-FIRST", "SCOPE: THIS QUARTER", "SECTIONS: B+C". 1–4 items.',
        items: { type: 'string' as const, maxLength: 60 },
        minItems: 0,
        maxItems: 6,
      },
    },
    required: ['picks', 'rationale', 'intents'],
  },
};
