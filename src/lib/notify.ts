// Finalize notifications — two paths, neither requires a backend in v1.
//
//  1. WEBHOOK (silent, automatic).
//     Set VITE_FINALIZE_WEBHOOK_URL to any URL that accepts a JSON POST and
//     atelier fires the snapshot at it on every finalize. Works with Formspree,
//     Web3Forms, Zapier catch-hooks, Slack incoming webhooks, Discord webhooks,
//     n8n, or a one-line Vercel function. No backend code lives here.
//
//  2. EMAIL (manual, transparent).
//     Always available. The Done step renders a `mailto:` link with the plan
//     summary prefilled in the body. Maggie reviews and hits send. Jon's
//     inbox gets a structured email that's parseable by eye or by automation.

import type { PlanSnapshot } from '../types';
import { MODULE_BY_ID } from '../data/data';
import { compactCurrency, compactNumber } from './format';

const WEBHOOK_URL: string | undefined =
  (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string> }).env?.VITE_FINALIZE_WEBHOOK_URL) || undefined;

const FSC_NOTIFY_EMAIL: string =
  (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string> }).env?.VITE_FINALIZE_NOTIFY_EMAIL) ||
  'fightingsmartcyber@gmail.com';

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
  webhookSent: boolean;
  webhookError?: string;
  webhookConfigured: boolean;
}

// Best-effort: never throw, always return a result. Telemetry-only failure.
export async function fireWebhook(snapshot: PlanSnapshot, shareURL: string): Promise<NotifyResult> {
  if (!WEBHOOK_URL) {
    return { webhookSent: false, webhookConfigured: false };
  }
  try {
    const payload = {
      kind: 'pontis-atelier:finalize',
      version: 1,
      at: snapshot.finalizedAt,
      finalizedBy: snapshot.finalizedBy,
      note: snapshot.note,
      totals: snapshot.totals,
      selected: snapshot.selectedOrder,
      deferrals: snapshot.deferrals,
      priorities: snapshot.priorities,
      shareURL,
    };
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      // Many free webhook receivers (Slack incoming, Formspree, n8n catch) accept
      // either application/json or form-encoded. JSON is most flexible.
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      // No-cors is too strict for actual delivery confirmation; we rely on the
      // service responding 2xx if it accepts. Most webhook receivers do CORS *.
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

export const notifyEnv = {
  webhookConfigured: !!WEBHOOK_URL,
  notifyEmail: FSC_NOTIFY_EMAIL,
};
