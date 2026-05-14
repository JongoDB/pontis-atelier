import type { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { PLANNER_INSTRUCTIONS, MODULE_CATALOG, SUBMIT_PLAN_TOOL } from '../lib/planner-prompt.js';

// POST /api/plan
//
// Claude-backed "Hey Pontis" planner.
//
// Auth: uses CLAUDE_CODE_OAUTH_TOKEN (generated with `claude setup-token`),
// which routes requests through the operator's Claude Max subscription instead
// of paid API credits. Falls back to ANTHROPIC_API_KEY if a regular API key is
// what's set.

const CLAUDE_OAUTH_TOKEN = process.env.CLAUDE_CODE_OAUTH_TOKEN || process.env.ANTHROPIC_OAUTH_TOKEN || '';
const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL_ID = process.env.ATELIER_PLANNER_MODEL || 'claude-opus-4-7';

function buildClient(): Anthropic | null {
  if (CLAUDE_OAUTH_TOKEN) {
    return new Anthropic({
      authToken: CLAUDE_OAUTH_TOKEN,
      // OAuth flow used by `claude setup-token` — routes through the Claude
      // Max subscription quota.
      defaultHeaders: { 'anthropic-beta': 'oauth-2025-04-20' },
    });
  }
  if (CLAUDE_API_KEY) {
    return new Anthropic({ apiKey: CLAUDE_API_KEY });
  }
  return null;
}

export async function planRoute(req: Request, res: Response) {
  const client = buildClient();
  if (!client) {
    return res.status(503).json({
      ok: false,
      error: 'claude auth not configured — set CLAUDE_CODE_OAUTH_TOKEN (preferred) or ANTHROPIC_API_KEY',
      fallback: 'rule-based',
    });
  }

  const body = (req.body ?? {}) as { prompt?: string };
  const prompt = String(body.prompt ?? '').trim();
  if (!prompt) return res.status(400).json({ ok: false, error: 'empty prompt' });
  if (prompt.length > 2000) {
    return res.status(400).json({ ok: false, error: 'prompt too long (max 2000 chars)' });
  }

  try {
    const message = await client.messages.create({
      model: MODEL_ID,
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      // Prompt-cache breakpoint at the end of the module catalog. ~30KB total,
      // unchanging across requests — every call after the first reads from cache.
      system: [
        { type: 'text', text: PLANNER_INSTRUCTIONS },
        {
          type: 'text',
          text: MODULE_CATALOG,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [SUBMIT_PLAN_TOOL],
      tool_choice: { type: 'tool', name: 'submit_plan' },
      messages: [
        { role: 'user', content: prompt },
      ],
    });

    // Handle refusal explicitly — Claude can decline for safety reasons. The
    // frontend treats anything non-200 as "fall back to local rules," but we
    // surface the reason so debugging is possible from the response body.
    if (message.stop_reason === 'refusal') {
      return res.status(422).json({
        ok: false,
        error: 'claude declined to plan this request',
        stopReason: 'refusal',
      });
    }

    const toolUse = message.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'submit_plan'
    );
    if (!toolUse) {
      return res.status(502).json({
        ok: false,
        error: 'planner did not call submit_plan',
        stopReason: message.stop_reason,
      });
    }

    const input = toolUse.input as { picks?: unknown; rationale?: unknown; intents?: unknown };
    const picks = Array.isArray(input.picks) ? input.picks.map(String) : [];
    const rationale = typeof input.rationale === 'string' ? input.rationale : '';
    const intents = Array.isArray(input.intents) ? input.intents.map(String) : [];

    if (picks.length === 0 || !rationale) {
      return res.status(502).json({ ok: false, error: 'malformed plan from model' });
    }

    return res.status(200).json({
      ok: true,
      source: 'claude',
      model: MODEL_ID,
      picks,
      rationale,
      intents,
      usage: {
        input: message.usage.input_tokens,
        output: message.usage.output_tokens,
        cacheRead: message.usage.cache_read_input_tokens ?? 0,
        cacheWrite: message.usage.cache_creation_input_tokens ?? 0,
      },
    });
  } catch (err: unknown) {
    if (err instanceof Anthropic.APIError) {
      // eslint-disable-next-line no-console
      console.error('[plan] anthropic api error', err.status, err.message);
      return res.status(err.status ?? 500).json({
        ok: false,
        error: `anthropic api error: ${err.message}`,
        status: err.status,
      });
    }
    const msg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error('[plan] error', msg);
    return res.status(500).json({ ok: false, error: msg });
  }
}
