import type { PontisModule } from '../types';
import { expandPrerequisites } from './dependencies';

export interface PlannerRequest {
  prompt: string;
  modules: PontisModule[];
  byId: Map<string, PontisModule>;
}

export interface PlannerResult {
  picks: string[];           // module IDs in suggested order, prereqs expanded
  rationale: string;         // one-paragraph explanation in ĒSO voice
  matchedIntents: string[];  // what the parser thought Maggie meant
  estimates: {
    billableROM: number;
    hoursSaved: number;
    moduleCount: number;
  };
}

// Keyword vocab — surfaced as a const so the planner stays inspectable and tunable.
// "What does 'closeout pain' mean to pontis?" is answerable by looking at this map.
const SECTION_KEYWORDS: Record<string, string[]> = {
  A: ['foundation', 'mvp', 'dashboard', 'mobile', 'admin', 'home', 'integration'],
  B: ['bd', 'business development', 'lead', 'crm', 'pipeline', 'referral', 'rfp', 'rfq', 'prospect'],
  C: ['project', 'pm', 'staffing', 'pace', 'delegation', 'task', 'burn', 'site visit', 'rfi', 'submittal', 'rollup'],
  D: ['proposal', 'contract', 'fee', 'programming brief', 'feasibility', 'pricing', 'quote'],
  E: ['time tracking', 'invoice', 'billing', 'qbo', 'quickbooks', 'bill.com', 'ap', 'p&l', 'overrun', 'financial'],
  F: ['report', 'monday', 'rollup', 'dashboard', 'telemetry', 'health score', 'vendor', 'snapshot'],
  G: ['rag', 'knowledge', 'handbook', 'permitting', 'lessons learned', 'search', 'silvana'],
  H: ['comm', 'communication', 'sms', 'whatsapp', 'imessage', 'scope creep', 'timeline', 'thread'],
  I: ['portal', 'client', 'stripe', 'calendar', 'pinterest', 'drawing viewer', 'self-service', 'onboarding'],
  J: ['archicad', 'bluebeam', 'adobe', 'redline', 'design tool', 'twin motion', 'archsynth', 'maket'],
  K: ['voice', 'whisper', 'shortcut', 'capture', 'tear-line', 'site walk', 'closeout dictation'],
  L: ['brand', 'template', 'pdf', 'archive', 'marketing', 'case study'],
  M: ['training', 'adoption', 'mentorship', 'policy', 'ce', 'ceu'],
  N: ['marketplace', 'community', 'cross-firm', 'industry', 'public api', 'thought leadership'],
};

const PAIN_KEYWORDS: Record<string, string[]> = {
  closeout: ['C3-C7', 'C3-K3', 'C3-D8', 'C3-L3', 'C3-L6'],
  closeoutpain: ['C3-C7', 'C3-K3', 'C3-D8', 'C3-L3', 'C3-L6'],
  delegation: ['C3-C4', 'C3-C3', 'C3-C10'],
  monograph: ['C3-C1', 'C3-E1', 'C3-E2', 'C3-E3', 'C3-E5'],
  pipeline: ['C3-B1', 'C3-B2', 'C3-B5', 'C3-B6'],
  bd: ['C3-B1', 'C3-B2', 'C3-B4', 'C3-B5', 'C3-B6'],
  voice: ['C3-K1', 'C3-K2', 'C3-K3', 'C3-K6', 'C3-K7'],
  brand: ['C3-L1', 'C3-G3', 'C3-L4', 'C3-L5'],
  proposal: ['C3-D1', 'C3-D2', 'C3-D3', 'C3-D4', 'C3-D5'],
  portal: ['C3-I1', 'C3-I2', 'C3-I4', 'C3-I5'],
  reporting: ['C3-F1', 'C3-F2', 'C3-F3', 'C3-F4'],
};

function parseInt32(re: RegExp, text: string): number | null {
  const m = text.match(re);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function parseCurrency(re: RegExp, text: string): number | null {
  const m = text.match(re);
  if (!m) return null;
  let raw = m[1];
  let multiplier = 1;
  if (/k\b/i.test(raw)) multiplier = 1000;
  if (/m\b/i.test(raw)) multiplier = 1_000_000;
  raw = raw.replace(/[^\d.]/g, '');
  const n = Number(raw);
  return Number.isFinite(n) ? n * multiplier : null;
}

// Default scoring function. Hours saved is the strongest signal — but Maggie has
// the option to override the weights via the UI's "tone" buttons (cost-first / speed-first).
function scoreModule(m: PontisModule, options: { tone: 'value' | 'cost' | 'speed' }): number {
  const hours = m.hoursSavedPerYear ?? 0;
  const weeks = (m.weeksLow + m.weeksHigh) / 2 || 4;
  const rom = m.rom || 0;

  switch (options.tone) {
    case 'cost':
      // Prioritize high-saved-hours per dollar billable; retainer modules
      // get a neutral baseline.
      if (m.retainerCovered) return hours;
      return rom > 0 ? hours / (rom / 100) : hours * 0.5;
    case 'speed':
      // Prioritize fast-shippable items with material savings
      return hours / weeks;
    case 'value':
    default:
      // Pure hours-saved-per-year, with a tiny tilt towards foundational modules
      const foundationBoost = m.sectionKey === 'A' ? 30 : 0;
      return hours + foundationBoost;
  }
}

// The core rules: parse the prompt, build picks.
export function plan(req: PlannerRequest): PlannerResult {
  const text = req.prompt.toLowerCase();
  const intents: string[] = [];

  // 1. Find pain-keyword anchors
  const seededIds = new Set<string>();
  for (const [keyword, ids] of Object.entries(PAIN_KEYWORDS)) {
    if (text.includes(keyword)) {
      intents.push(`focus: ${keyword}`);
      ids.forEach((id) => seededIds.add(id));
    }
  }

  // 2. Detect section emphasis
  const emphasizedSections = new Set<string>();
  for (const [sectionKey, kws] of Object.entries(SECTION_KEYWORDS)) {
    if (kws.some((kw) => text.includes(kw))) {
      emphasizedSections.add(sectionKey);
    }
  }
  if (emphasizedSections.size > 0) {
    intents.push(`sections: ${Array.from(emphasizedSections).join('+')}`);
  }

  // 3. Detect tone / strategy
  let tone: 'value' | 'cost' | 'speed' = 'value';
  if (/quick|fast|short|next week|this week|sprint/.test(text)) {
    tone = 'speed';
    intents.push('tone: ship fast');
  } else if (/under \$|budget|cheap|low cost|cost cap|rom cap/.test(text)) {
    tone = 'cost';
    intents.push('tone: cost-first');
  } else if (/value|hours|save|savings|highest/.test(text)) {
    tone = 'value';
    intents.push('tone: value-first');
  }

  // 4. Caps
  const moduleCap = parseInt32(/(\d+)\s*modules?/, text) ?? parseInt32(/only\s+(\d+)/, text);
  const romCap = parseCurrency(/(?:under|below|cap|limit)\s*\$?\s*([0-9.,]+\s*[km]?)/i, text);

  // "next quarter" / "this quarter" implies items deliverable in ≤ 13 weeks.
  const nextQuarterScope = /(?:next|this|first|coming)\s+quarter/.test(text)
    || /(?:by|in)\s+(?:q1|q2|q3|q4)/.test(text)
    || /first 13 weeks|first three months|q1\b/.test(text);
  if (nextQuarterScope) intents.push('scope: this quarter');

  // 5. Score + filter
  const wantPontisOnly = /pontis only|retainer only/.test(text);
  const wantQuickOnly = /quick win|coa\s*1|coa\s*2|billable only/.test(text);
  // "ROM under $X" alone implies the user cares about billable picks specifically,
  // since ROM only applies to COA 1/2. Treat that as quick-only too.
  const wantQuickFromRomCap = romCap != null && !wantPontisOnly;

  const candidates = req.modules
    .filter((m) => {
      if (wantPontisOnly) return m.retainerCovered;
      if (wantQuickOnly || wantQuickFromRomCap) return !m.retainerCovered;
      return true;
    })
    .map((m) => ({
      m,
      // Seed-boost: if the user named a pain, push those IDs to the top.
      // Cost tie-breaker: cheaper items rank above pricier items at same score
      // so cost-cap queries don't burn budget on the most expensive option first.
      // Quarter-scope penalty: items that can't deliver in 13 weeks fall down the list.
      score:
        scoreModule(m, { tone }) +
        (seededIds.has(m.id) ? 1000 : 0) +
        (emphasizedSections.has(m.sectionKey) ? 80 : 0) -
        (tone === 'cost' ? (m.rom || 0) * 0.001 : 0) -
        (nextQuarterScope && m.weeksHigh > 13 ? 500 : 0),
    }))
    .sort((a, b) => b.score - a.score);

  // 6. Greedy pick under caps. With caps in place the score=0 skip-rule from the
  // earlier draft is unnecessary; the cap naturally limits picks and lets us pick
  // a portfolio of zero-scored cost items (COA 1/2 modules don't have hours-saved data).
  // Quarter-scope filter: when Maggie says "next quarter," hard-exclude items that
  // can't deliver in 13 weeks unless they're seeded prerequisites.
  const picked: PontisModule[] = [];
  let runningROM = 0;
  let runningCount = 0;
  const cap = moduleCap ?? (intents.length > 0 ? 8 : 5);
  for (const c of candidates) {
    if (runningCount >= cap) break;
    if (romCap != null && !c.m.retainerCovered && runningROM + c.m.rom > romCap) continue;
    if (nextQuarterScope && c.m.weeksHigh > 13 && !seededIds.has(c.m.id)) continue;
    picked.push(c.m);
    if (!c.m.retainerCovered) runningROM += c.m.rom;
    runningCount += 1;
  }

  // 7. Expand prerequisites — Maggie shouldn't get a plan with missing foundations
  const finalIds: string[] = [];
  const seen = new Set<string>();
  for (const m of picked) {
    for (const prereq of expandPrerequisites(m.id, req.byId)) {
      if (!seen.has(prereq)) {
        seen.add(prereq);
        finalIds.push(prereq);
      }
    }
    if (!seen.has(m.id)) {
      seen.add(m.id);
      finalIds.push(m.id);
    }
  }

  // 8. Compute estimate
  const finalModules = finalIds.map((id) => req.byId.get(id)).filter(Boolean) as PontisModule[];
  const billableROM = finalModules.reduce((s, m) => s + (m.retainerCovered ? 0 : m.rom), 0);
  const hoursSaved = finalModules.reduce((s, m) => s + (m.hoursSavedPerYear ?? 0), 0);

  const rationale = buildRationale({
    text, picked, finalIds, tone, intents, moduleCap, romCap, billableROM, hoursSaved, byId: req.byId,
  });

  return {
    picks: finalIds,
    rationale,
    matchedIntents: intents,
    estimates: { billableROM, hoursSaved, moduleCount: finalIds.length },
  };
}

function buildRationale(input: {
  text: string;
  picked: PontisModule[];
  finalIds: string[];
  tone: 'value' | 'cost' | 'speed';
  intents: string[];
  moduleCap: number | null;
  romCap: number | null;
  billableROM: number;
  hoursSaved: number;
  byId: Map<string, PontisModule>;
}): string {
  const { picked, finalIds, tone, romCap, billableROM, hoursSaved, intents, byId } = input;

  if (picked.length === 0) {
    return `i couldn't pin down what you meant. try something like "highest hours-saved next quarter, max 5 modules" or "focus on closeout pain first" — i'll work from there.`;
  }

  const headline = (() => {
    switch (tone) {
      case 'cost': return `here's a cost-conscious slice`;
      case 'speed': return `here's the fastest material slice`;
      default:     return `here's the highest-value slice`;
    }
  })();

  const focus = picked.slice(0, 3).map((m) => m.name.toLowerCase()).join(' · ');
  const addedPrereqs = finalIds.length - picked.length;

  const parts = [
    `${headline} — ${picked.length} core ${picked.length === 1 ? 'module' : 'modules'}: ${focus}${picked.length > 3 ? ' …' : ''}.`,
  ];
  if (addedPrereqs > 0) parts.push(`i pulled in ${addedPrereqs} ${addedPrereqs === 1 ? 'prerequisite' : 'prerequisites'} so nothing's hanging.`);
  if (hoursSaved > 0) parts.push(`roughly ${Math.round(hoursSaved).toLocaleString()} hours saved per year if adoption sticks.`);
  if (billableROM > 0) parts.push(`COA 1/2 ROM lands near $${Math.round(billableROM).toLocaleString()}.`);
  if (romCap != null) parts.push(`kept under your $${Math.round(romCap).toLocaleString()} cap.`);
  if (intents.length === 0) parts.push(`(no specific intents detected — try naming a pain, a section, or a cap.)`);
  parts.push(`edit before you commit. nothing's been added yet.`);
  return parts.join(' ');
}
