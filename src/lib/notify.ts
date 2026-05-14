// Finalize notifications — three paths, all best-effort.
//
//  1. ATELIER BACKEND (default in production).
//     POSTs the snapshot to /api/finalize on every commit. The Vercel function
//     stores it in Postgres so FSC's admin view (/admin) can see what Maggie
//     finalized. Disabled automatically when /api/finalize 404s (e.g. in
//     `npm run dev` without `vercel dev`).
//
//  2. WEBHOOK (optional, in addition to the backend).
//     Set VITE_FINALIZE_WEBHOOK_URL to fan-out the same payload to a third
//     party — Slack, Formspree, Zapier, Discord, n8n, etc.
//
//  3. EMAIL (manual, always available).
//     The Done step renders a `mailto:` link with the plan summary prefilled.
//     Maggie reviews and hits send; FSC's inbox gets a parseable email.

import type { PlanSnapshot } from '../types';
import { MODULE_BY_ID } from '../data/data';
import { compactCurrency, compactNumber } from './format';

const WEBHOOK_URL: string | undefined =
  (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string> }).env?.VITE_FINALIZE_WEBHOOK_URL) || undefined;

const FSC_NOTIFY_EMAIL: string =
  (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string> }).env?.VITE_FINALIZE_NOTIFY_EMAIL) ||
  'team@fightingsmartycber.com';

// Same-origin backend endpoint. Always tried; gracefully handles 404s.
const ATELIER_ENDPOINT = '/api/finalize';

// Compact, parseable plain-text email body that survives every email client.
export function buildEmailBody(snapshot: PlanSnapshot, shareURL: string): string {
  const lines: string[] = [];
  lines.push('Hi Fighting Smart Cyber team —');
  lines.push('');
  lines.push(`This is my finalized Pontis plan, signed off by ${snapshot.finalizedBy} on ${new Date(snapshot.finalizedAt).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}.`);
  if (snapshot.note) {
    lines.push('');
    lines.push('Note for FSC:');
    lines.push(`  ${snapshot.note}`);
  }
  lines.push('');
  lines.push('Totals:');
  lines.push(`  Modules:                 ${snapshot.totals.modules}`);
  lines.push(`  COA 1 + 2 ROM:           ${compactCurrency(snapshot.totals.billableROM)}`);
  lines.push(`  Retainer quarters:       ≈ ${snapshot.totals.quartersOfRetainerBuild}`);
  lines.push(`  Annual hours saved:      ${compactNumber(snapshot.totals.hoursSavedPerYear)}`);
  lines.push(`  Annual $ saved (internal): ${compactCurrency(snapshot.totals.annualSavedInternal)}`);
  lines.push('');
  lines.push('Modules selected (in order):');
  for (const id of snapshot.selectedOrder) {
    const m = MODULE_BY_ID.get(id);
    if (!m) continue;
    const def = snapshot.deferrals[id];
    const pri = snapshot.priorities[id];
    let suffix = '';
    if (pri != null) suffix += ` [P${pri}]`;
    if (def && def > 0) suffix += ` [+${def}w]`;
    lines.push(`  ${m.id}  ${m.name}${suffix}`);
  }
  lines.push('');
  lines.push('Open the same plan in atelier:');
  lines.push(`  ${shareURL}`);
  lines.push('');
  lines.push('— Sent automatically by Pontis Atelier');
  return lines.join('\n');
}

export function buildMailto(snapshot: PlanSnapshot, shareURL: string): string {
  const subject = `Pontis Atelier — finalized plan from ${snapshot.finalizedBy} (${snapshot.totals.modules} modules)`;
  const body = buildEmailBody(snapshot, shareURL);
  // Some email clients have body length limits; mailto: works for ~2KB+ on most.
  return `mailto:${encodeURIComponent(FSC_NOTIFY_EMAIL)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export interface NotifyResult {
  backendSent: boolean;
  backendError?: string;
  webhookSent: boolean;
  webhookError?: string;
  webhookConfigured: boolean;
}

function buildPayload(snapshot: PlanSnapshot, shareURL: string) {
  return {
    kind: 'pontis-atelier:finalize',
    version: 1,
    id: snapshot.id,
    at: snapshot.finalizedAt,
    finalizedBy: snapshot.finalizedBy,
    note: snapshot.note,
    totals: snapshot.totals,
    selected: snapshot.selectedOrder,
    deferrals: snapshot.deferrals,
    priorities: snapshot.priorities,
    shareURL,
  };
}

// Best-effort: never throws. Tries both paths in parallel and reports each.
export async function fireNotifications(snapshot: PlanSnapshot, shareURL: string): Promise<NotifyResult> {
  const payload = buildPayload(snapshot, shareURL);
  const body = JSON.stringify(payload);

  const [backend, webhook] = await Promise.all([
    fireBackend(body),
    fireWebhookFanout(body),
  ]);

  return { ...backend, ...webhook };
}

async function fireBackend(body: string): Promise<Pick<NotifyResult, 'backendSent' | 'backendError'>> {
  try {
    const res = await fetch(ATELIER_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    });
    if (!res.ok) {
      // 404 in local Vite dev (no API) — treat as "not configured" silently;
      // 5xx is a real failure worth surfacing.
      const isMissing = res.status === 404 || res.status === 405;
      return {
        backendSent: false,
        backendError: isMissing ? undefined : `HTTP ${res.status}`,
      };
    }
    return { backendSent: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { backendSent: false, backendError: msg };
  }
}

async function fireWebhookFanout(body: string): Promise<Pick<NotifyResult, 'webhookSent' | 'webhookError' | 'webhookConfigured'>> {
  if (!WEBHOOK_URL) {
    return { webhookSent: false, webhookConfigured: false };
  }
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      mode: 'cors',
    });
    if (!res.ok) {
      return { webhookSent: false, webhookConfigured: true, webhookError: `HTTP ${res.status}` };
    }
    return { webhookSent: true, webhookConfigured: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { webhookSent: false, webhookConfigured: true, webhookError: msg };
  }
}

// Back-compat export (Finalize.tsx still imports `fireWebhook`).
export const fireWebhook = fireNotifications;

export const notifyEnv = {
  webhookConfigured: !!WEBHOOK_URL,
  notifyEmail: FSC_NOTIFY_EMAIL,
};
