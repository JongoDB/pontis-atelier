# Pontis Atelier

**Where Pontis takes shape.** An interactive web portal for Maggie Wylie
(Principal, ĒSO Architecture + Design) to make value-and-cost-based decisions
about which Pontis modules ĒSO wants — and when.

Built by Fighting Smart Cyber for ĒSO under COA 3 of the May 12, 2026 readout.

> **pontis** · latin · _of the bridge_ — the platform FSC is building to bridge
> ĒSO's day (Monograph, HubSpot, scattered Word templates, voice memos that
> disappear) into a single, coherent place.
>
> **atelier** · french · _the workshop_ — in architecture, the room where a
> practice's identity and decisions take shape. Atelier is the workspace
> where ĒSO decides what Pontis becomes.

---

## What it does

- **Browse 101 modules** across 14 Pontis sections (the post-readout T-chart)
- **Side-by-side _today vs. with Pontis_** on every card (flip a card to see)
- **Live cost + savings calculation** — COA 1/2 ROM at $100/hr, COA 3 quarters
  of retainer build, annual hours saved (mid post-adoption), $ saved at
  internal + principal rates, 5-year cumulative, **per-lifecycle-phase rollup**
- **Auto-generated Gantt** respecting module dependencies, with drag-and-drop
  reordering, **defer-by-N-weeks slider**, and ghost-bar visualization showing
  where deferred items would have landed
- **Per-module rack/stack priority** (1/2/3) — Maggie can override FSC's suggested
  sequence; priorities surface on browse cards and reorder the Gantt
- **Dependency risk indicators** — modules whose prerequisites aren't selected
  show a flag; one click pulls the prereqs in
- **"Hey Pontis…" natural-language planner** — describe what you want in
  plain English, get a recommended selection back. Understands pain keywords
  (closeout, voice, BD), section emphasis, cost caps ("under $400"), module
  caps ("max 5 modules"), and time scope ("next quarter")
- **Guided _Finalize_ flow** — 4-step commit (review → timeline → cost → sign).
  Captures a signed snapshot. Multiple snapshots kept; "finalize again" any time.
- **Notify FSC on finalize** — opens a mailto with the plan body prefilled, and
  fires an optional webhook for silent notifications (see Notifications below)
- **Auto-saving change log** with per-change undo
- **PDF + CSV export** — fully-branded one-page plan with inline SVG Gantt
  thumbnail, etymology line, and signature panel
- **Shareable read-only plan URL** — encodes the plan in the URL hash; recipient
  can preview or "make this mine" to overwrite their state
- **Adoption telemetry** — recursive eat-our-own-dogfood preview of C3-F6,
  tracking which Atelier capabilities the user actually touches
- **localStorage persistence** with a clean adapter abstraction (`storage.ts`)
  ready to swap for a Pontis backend in one file
- **Tenant config** (`src/tenant.config.ts`) abstracts ĒSO-specific copy +
  palette so Atelier can be deployed for another A&E firm by editing one file
- **Mobile responsive** — site-walk friendly

## Stack

- Vite + React + TypeScript
- Tailwind v3 (ĒSO palette + Mabry Pro fallback via Inter)
- Zustand for state, with localStorage persistence
- lucide-react for icons
- xlsx for the one-time parser script

## Setup

```bash
# Install (Node 20+ recommended)
npm install

# (Optional) Re-parse the T-chart workbook if a fresh version drops
# Source workbook lives at _src/tchart.xlsx
npm run parse

# Dev server (http://localhost:5173)
npm run dev

# Production build
npm run build

# Preview the production build locally
npm run preview
```

## Notifications when Maggie finalizes

The Finalize flow ends with two paths to tell FSC:

1. **Email button** (always available, requires Maggie to hit send).
   Renders a `mailto:` link with the full plan summary prefilled in the body.
   Recipient defaults to `fightingsmartcyber@gmail.com`. Override with the
   `VITE_FINALIZE_NOTIFY_EMAIL` env var.

2. **Silent webhook** (optional, fires automatically on every finalize).
   Set `VITE_FINALIZE_WEBHOOK_URL` to any URL that accepts a JSON POST. Works with:
   - Formspree / Web3Forms (free, sends email)
   - Zapier or Make catch-hooks (free tier, route anywhere)
   - Slack incoming webhooks
   - Discord webhooks
   - A 5-line Vercel function that forwards to Resend / SendGrid
   - Any HTTPS endpoint with permissive CORS

   The payload is `{ kind: 'pontis-atelier:finalize', version, at, finalizedBy, note, totals, selected, deferrals, priorities, shareURL }`.

Quickstart with Formspree (zero code):

```bash
# Get a form URL from formspree.io, then:
echo 'VITE_FINALIZE_WEBHOOK_URL=https://formspree.io/f/YOUR-ID' > .env
npm run dev
# Or for production:
echo 'VITE_FINALIZE_WEBHOOK_URL=https://formspree.io/f/YOUR-ID' > .env.production
npm run build
```

The Done step surfaces the webhook delivery status with a small text line —
"a notification has also been sent to fsc automatically" or "the auto-notification
couldn't deliver" — so Maggie knows whether to also use the email button.

## Project layout

```
pontis-atelier/
├── _src/                          # Private build inputs (Excel + brand guide)
│   ├── tchart.xlsx
│   ├── matrix.xlsx
│   └── brand_guide.pdf
├── scripts/
│   └── parse-tchart.cjs           # Excel → JSON (re-runnable)
├── src/
│   ├── data/
│   │   ├── data.ts                # Typed accessors
│   │   └── modules.json           # Generated by parse script
│   ├── components/                # React UI
│   ├── lib/
│   │   ├── cost.ts                # Cost / ROI math
│   │   ├── schedule.ts            # Gantt scheduling + dependencies
│   │   ├── dependencies.ts        # Dep graph helpers
│   │   ├── planner.ts             # "Hey Pontis" rule-based logic
│   │   └── export.ts              # CSV + PDF (browser print)
│   ├── store.ts                   # Zustand store + persistence
│   ├── types.ts
│   ├── App.tsx
│   └── main.tsx
└── public/favicon.svg
```

## How the parser works

`scripts/parse-tchart.cjs` reads four sheets of the T-chart workbook:

- **Sheet 2 (Master T-chart)** — every deliverable with COA, time-to-delivery,
  billable hours, ROM, desired outcome
- **Sheet 4 (Pontis rack-stack)** — FSC suggested sequence, Matrix OPP refs,
  lifecycle phase, current tool replaced, hours saved/yr (mid)
- **Sheet 5 (Business value)** — default assumptions (rates, adoption, weeks)
- **Sheet 6 (Roadmap timing)** — phase windows and which modules land when

It writes `src/data/modules.json` which the React app consumes. The script also
infers dependencies from "FSC suggested sequence" cells (e.g. "after C3-K1") plus
explicit hard-codes for the obvious foundational links (K2-K5 ⊃ K1, A2 ⊃ A1,
B3 ⊃ K1, D5 ⊃ D4, D7 ⊃ K1).

If FSC ships an updated T-chart, drop it at `_src/tchart.xlsx` and run
`npm run parse`. Commit the regenerated `modules.json`.

## "Hey Pontis…" planner

The natural-language planner (`src/lib/planner.ts`) parses prompts like:

- "highest hours-saved next quarter, max 5 modules"
- "focus on closeout pain first, then BD"
- "keep COA 1+2 ROM under $1,500"
- "voice flows + the pipeline they need"

…and builds a recommended selection. It:

1. Detects **pain keywords** (closeout, pipeline, voice, brand, …) and seeds
   the corresponding module IDs
2. Detects **section emphasis** via per-section vocab (BD / project / proposal
   / etc.) and boosts modules in those sections
3. Detects **tone** (cost-first, speed-first, value-first) and picks a
   scoring function accordingly
4. Honors caps on module count (`max 5 modules`) and ROM (`under $1,500`)
5. **Expands all prerequisites** so nothing's hanging when Maggie hits "add"
6. Returns a one-paragraph rationale in ĒSO voice

**Upgrade path:** if a `VITE_ANTHROPIC_API_KEY` is set, we can route the
parsing through Claude for better fuzzy intent detection. The rule-based path
stays as the fallback so the app works without credentials in dev.

## ĒSO Brand fidelity

Palette (from the Winter 2026 Brand Guide):

| Token        | Hex       | Use                                |
|--------------|-----------|------------------------------------|
| `pearl`      | `#f9f7f4` | Warm background (dominant surface) |
| `bone`       | `#edeae2` | Subtle panels                      |
| `midnight`   | `#214144` | Headers, CTAs, primary text        |
| `clay`       | `#828279` | Secondary text                     |
| `burnt`      | `#61655f` | Accent text                        |
| `laser`      | `#e9ff14` | Single callout / selected-state    |

Typography — Mabry Pro is the licensed ĒSO typeface. The build references it
first; if not present on the host, falls back to Inter Display / Inter (loaded
via `https://rsms.me/inter/inter.css` for now). To go fully licensed:

1. Get the Mabry Pro `.woff2` files from ĒSO's brand designer (Karl Hebert,
   Gold Lunchbox — credit on page 33 of the Brand Guide)
2. Drop them in `public/fonts/`
3. Add `@font-face` declarations in `src/index.css` referencing
   `/fonts/MabryPro-{Regular,Medium,Italic,Bold,…}.woff2`

## Deploying for another A&E firm (Pontis Marketplace)

Atelier was built for ĒSO as the anchor customer, but the data model is generic.
To deploy for another firm:

1. **Edit `src/tenant.config.ts`** — palette, splash copy, etymology, footer, contact email.
2. **Drop their T-chart** at `_src/tchart.xlsx` (same sheet structure: Master / Pontis rack-stack / Business value / Roadmap timing).
3. **Run `npm run parse`** to regenerate `src/data/modules.json`.
4. **Build + deploy.**

Everything that ties Atelier to "ĒSO" specifically routes through `tenant.config.ts`.
Sections, sequences, hours-saved estimates, and module IDs are data — the parser
emits them; the UI doesn't care what firm they come from.

## Known issues / future work

- **Mabry Pro not licensed in this build** — Inter is the fallback. The visual
  language is preserved but ĒSO's exact letterforms are not. Plug the licensed
  font in via `public/fonts/` to upgrade.
- **PDF export uses the browser's native print** — keeps the bundle tiny. If
  you want a programmatic PDF for emailing, swap in `pdfmake` or `@react-pdf/renderer`.
- **No backend** — selections persist in localStorage. `src/lib/storage.ts` has
  the adapter interface and a stub `pontisBackendAdapter()` factory; swapping
  is one line in `src/store.ts`.
- **The dependency map is inferred + hard-coded** — see `parse-tchart.cjs`. If
  Steve refines the explicit-dependency list, edit the inference rules there.
- **Console favicon 404** — fixed; `public/favicon.svg` ships with the build.

## Deployment

Static SPA. Drop `dist/` on Vercel / Netlify / Cloudflare Pages and you're done.
No server, no environment variables required for v1.

```bash
npm run build      # produces dist/
npx vercel dist    # or: netlify deploy --prod -d dist
```

## Credit

- Strategy + voice — Libby Anderson (Peel Strategy)
- Design — Karl Hebert (Gold Lunchbox)
- Copy — Chris Barnard (Prize Fight)
- Pontis platform + this atelier — Fighting Smart Cyber

For ĒSO Architecture + Design · Austin, TX · eso-arch.com
