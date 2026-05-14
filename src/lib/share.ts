// Shareable read-only plan URL.
//
// Encodes the plan into the URL hash so anyone with the link sees the same
// selections, deferrals, and priorities — without a backend. URLs round-trip:
// open one in another browser, hit "make this mine," and the recipient's
// localStorage state is overwritten.
//
// The encoding is compact: we don't carry the assumption sliders or change log,
// just the three pieces that define the plan shape.

interface SharePayload {
  v: 1;
  s: string[];                       // selected order
  d?: Record<string, number>;        // deferrals (only items with non-zero)
  p?: Record<string, number>;        // priorities (only items with priority)
  t?: string;                        // optional title / note
}

export function encodePlan(input: {
  selected: string[];
  deferrals: Record<string, number>;
  priorities: Record<string, number>;
  title?: string;
}): string {
  const payload: SharePayload = { v: 1, s: input.selected };
  const ds = Object.entries(input.deferrals).filter(([, w]) => w > 0);
  if (ds.length) payload.d = Object.fromEntries(ds);
  const ps = Object.entries(input.priorities).filter(([, w]) => w != null);
  if (ps.length) payload.p = Object.fromEntries(ps);
  if (input.title) payload.t = input.title;

  // Use base64url over JSON. Plenty of room in a URL hash for a 100-module plan.
  const json = JSON.stringify(payload);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  const urlSafe = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return urlSafe;
}

export function decodePlan(encoded: string): SharePayload | null {
  try {
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    // Restore padding
    const padded = b64 + '==='.slice(0, (4 - (b64.length % 4)) % 4);
    const json = decodeURIComponent(escape(atob(padded)));
    const parsed = JSON.parse(json);
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.s)) return null;
    return parsed as SharePayload;
  } catch {
    return null;
  }
}

export function readSharedPlanFromHash(): SharePayload | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (!hash.startsWith('#plan=')) return null;
  const enc = hash.slice('#plan='.length);
  return decodePlan(enc);
}

export function buildShareURL(payload: ReturnType<typeof encodePlan>): string {
  if (typeof window === 'undefined') return '';
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#plan=${payload}`;
}

export function clearShareHash() {
  if (typeof window === 'undefined') return;
  if (window.location.hash.startsWith('#plan=')) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}
