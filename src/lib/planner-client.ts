// Client-side wrapper around the Hey Pontis planner.
//
//   1. First try the Claude-backed /api/plan endpoint (uses Claude Code OAuth
//      via setup-token on the server). This gives Maggie the real "talk to
//      Claude" experience, with intent parsing far richer than the rules.
//
//   2. If the endpoint is unavailable (404 in local Vite dev, 503 if no token
//      configured, any network failure), fall back to the local rule-based
//      planner in `planner.ts`. The fallback path keeps Atelier working
//      offline and in preview deploys without env vars.
//
//   3. Either way, normalize to a single PlannerResult shape with `source`
//      tagged so the UI can show whether it came from Claude or the rules.

import type { PontisModule } from '../types';
import { plan as rulesPlan, type PlannerResult as RulesResult } from './planner';
import { expandPrerequisites } from './dependencies';
import { MODULE_BY_ID } from '../data/data';

export type PlannerSource = 'claude' | 'rules';

export interface PlannerResult extends RulesResult {
  source: PlannerSource;
}

interface ServerPlanResponse {
  ok: boolean;
  source?: 'claude';
  picks?: string[];
  rationale?: string;
  intents?: string[];
  error?: string;
}

const SERVER_ENDPOINT = '/api/plan';

export async function runPlanner(input: {
  prompt: string;
  modules: PontisModule[];
  byId: Map<string, PontisModule>;
}): Promise<PlannerResult> {
  // Try the server-side Claude planner first
  try {
    const res = await fetch(SERVER_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: input.prompt }),
    });

    // 404 = no api route mounted (e.g. plain Vite dev without the API server)
    // 503 = backend present but no Claude token configured
    // 422 = Claude declined for safety
    // 502 = model returned a malformed plan
    // 2xx = server replied; use its plan
    // 4xx (400/401) = server rejected the prompt explicitly
    // All non-2xx responses fall back to the local rule-based planner so the
    // UI keeps moving. The rules path is open source and always available.
    if (!res.ok) {
      return runRulesFallback(input);
    }

    const data = (await res.json()) as ServerPlanResponse;
    if (!data.ok || !data.picks || !data.rationale) {
      return runRulesFallback(input);
    }

    // Re-expand prerequisites client-side as a safety net. Claude should
    // already include them, but we double-check so the plan is never broken.
    const expanded = ensurePrereqs(data.picks, input.byId);
    const validIds = expanded.filter((id) => MODULE_BY_ID.has(id));

    const estimates = estimateFromIds(validIds);

    return {
      picks: validIds,
      rationale: data.rationale,
      matchedIntents: data.intents ?? [],
      estimates,
      source: 'claude',
    };
  } catch {
    return runRulesFallback(input);
  }
}

function runRulesFallback(input: {
  prompt: string;
  modules: PontisModule[];
  byId: Map<string, PontisModule>;
}): PlannerResult {
  const r = rulesPlan(input);
  return { ...r, source: 'rules' };
}

function ensurePrereqs(picks: string[], byId: Map<string, PontisModule>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of picks) {
    for (const prereq of expandPrerequisites(id, byId)) {
      if (!seen.has(prereq)) {
        seen.add(prereq);
        out.push(prereq);
      }
    }
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

function estimateFromIds(ids: string[]) {
  let billableROM = 0;
  let hoursSaved = 0;
  for (const id of ids) {
    const m = MODULE_BY_ID.get(id);
    if (!m) continue;
    if (!m.retainerCovered) billableROM += m.rom;
    if (m.hoursSavedPerYear != null) hoursSaved += m.hoursSavedPerYear;
  }
  return { billableROM, hoursSaved, moduleCount: ids.length };
}
