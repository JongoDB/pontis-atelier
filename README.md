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

- **Browse 109 modules** across 14 Pontis sections (the post-readout T-chart)
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

**Frontend** (Vite, single-page app)
- React + TypeScript
- Tailwind v3 (ĒSO palette + Mabry Pro fallback via Inter)
- Zustand for state, with localStorage persistence
- lucide-react for icons

**Backend** (Node, single Express server)
- `@anthropic-ai/sdk` for the Claude-backed "Hey Pontis" planner
- `better-sqlite3` for snapshot storage — embedded, zero external deps
- `tsx` for TypeScript-direct execution (no build step for the server)

**One-shot data**
- `xlsx` for the one-time T-chart parser script (Node, .cjs)

## Setup

```bash
# 1. Install (Node 20+ recommended)
npm install

# 2. Configure env vars
cp .env.example .env
# Then edit .env:
#   ADMIN_SECRET=<long random string>
#   CLAUDE_CODE_OAUTH_TOKEN=<from `claude setup-token`>

# 3. Build the frontend
npm run build

# 4. Start the server (serves the frontend AND the /api/* routes)
npm start
# → http://localhost:3000
# → http://localhost:3000/admin   (FSC admin view, password-gated)

# (Optional) Re-parse the T-chart workbook if a fresh version drops
npm run parse

# Development: runs vite + express in parallel, with /api proxy
npm run dev
# → http://localhost:5173   (frontend, with HMR)
# → http://localhost:3000   (backend, watches server/ for changes)
```

## Architecture

```
       ┌──────────────────────────────────────────────────┐
       │  Express server (server/index.ts)                │
       │  ──────────────────────────────────────────────  │
       │  GET  /              → SPA (Vite-built dist/)    │
       │  GET  /admin         → SPA (password-gated)      │
       │  POST /api/finalize  → SQLite snapshots          │
       │  POST /api/plan      → Claude (OAuth setup-token)│
       │  GET  /api/admin/snapshots[/:id]                 │
       │  GET  /api/health                                │
       └─┬─────────────────┬──────────────────────────┬─┘
         │                 │                          │
   data/atelier.db   Claude API                  Maggie's plan
   (snapshots,       (Hey Pontis)                (localStorage,
    embedded                                      survives close)
    SQLite)
```

**The frontend is the same React SPA whether you're Maggie or FSC.** The `/admin`
path renders a password-gated table view that talks to `/api/admin/snapshots`
to show every finalized plan in chronological order, with full detail on click.

**The Claude planner uses your subscription, not paid API credits.** Generate an
OAuth token with `claude setup-token` (the Claude Code CLI command), put it in
`.env` as `CLAUDE_CODE_OAUTH_TOKEN`, and `/api/plan` routes calls through your
Claude Max quota. If the token isn't set, "Hey Pontis" silently falls back to
the rule-based planner — Atelier stays usable offline.

## Deploy (LXC, VPS, or any host with Node 20+)

```bash
# On the host:
git clone https://github.com/JongoDB/pontis-atelier.git
cd pontis-atelier
npm install
npm run build

# Configure env:
cp .env.example .env
$EDITOR .env
# Minimum to set:
#   PORT=3000
#   ADMIN_SECRET=<openssl rand -hex 24>
#   CLAUDE_CODE_OAUTH_TOKEN=<claude setup-token output>

# Run it as a systemd service (or in screen/tmux for a quick start)
npm start
```

The server defaults to `0.0.0.0:3000` and writes its SQLite db to `./data/atelier.db`.
Front it with nginx or Caddy if you want HTTPS + a real hostname; it's a plain
HTTP service otherwise.

**Systemd service template** (drop in `/etc/systemd/system/pontis-atelier.service`):

```ini
[Unit]
Description=Pontis Atelier
After=network.target

[Service]
Type=simple
User=atelier
WorkingDirectory=/opt/pontis-atelier
EnvironmentFile=/opt/pontis-atelier/.env
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Then: `sudo systemctl enable --now pontis-atelier`.

## Notifications when Maggie finalizes

The Finalize flow ends with two paths to tell FSC:

1. **Email button** (always available, requires Maggie to hit send).
   Renders a `mailto:` link with the full plan summary prefilled in the body.
   Recipient defaults to `team@fightingsmartcyber.com`. Override with the
   `VITE_FINALIZE_NOTIFY_EMAIL` env var.

2. **Atelier backend** (`/api/finalize`, default).
   The same finalize click also POSTs the snapshot to the server, which writes
   it to SQLite. FSC sees every finalized plan in `/admin` immediately. This is
   the primary "view what Maggie finalized" path now.

3. **Optional 3rd-party webhook** (fans-out to Slack/Discord/Zapier/etc.).
   Set `VITE_FINALIZE_WEBHOOK_URL` to any URL that accepts a JSON POST. Useful
   if you also want Slack pings or to pipe to an automation platform. Payload:
   `{ kind: 'pontis-atelier:finalize', version, id, at, finalizedBy, note, totals, selected, deferrals, priorities, shareURL }`.

The Done step surfaces both delivery statuses — "your plan is now visible to FSC
in their admin view" + (optionally) "webhook delivered" — so Maggie knows what
landed where.

## Project layout

```
pontis-atelier/
├── _src/                          # Private build inputs (gitignored; see _src/README.md)
├── scripts/
│   └── parse-tchart.cjs           # Excel → JSON (re-runnable)
├── server/                        # Express backend
│   ├── index.ts                   # Entry: serves /api/* + the SPA
│   ├── lib/
│   │   ├── db.ts                  # SQLite setup + schema
│   │   ├── auth.ts                # admin-secret check
│   │   └── planner-prompt.ts      # Claude system prompt + tool schema
│   └── routes/
│       ├── finalize.ts            # POST /api/finalize
│       ├── admin.ts               # GET  /api/admin/snapshots[/:id]
│       ├── plan.ts                # POST /api/plan (Claude-backed)
│       └── health.ts              # GET  /api/health
├── src/                           # React frontend
│   ├── data/
│   │   ├── data.ts                # Typed accessors
│   │   └── modules.json           # Generated by parser
│   ├── components/                # React UI
│   ├── lib/
│   │   ├── cost.ts                # Cost / ROI math
│   │   ├── schedule.ts            # Gantt scheduling + dependencies
│   │   ├── dependencies.ts        # Dep graph helpers
│   │   ├── planner.ts             # Local rule-based planner (fallback)
│   │   ├── planner-client.ts      # POSTs to /api/plan, falls back to rules
│   │   ├── notify.ts              # Backend POST + mailto + webhook
│   │   ├── share.ts               # URL-hash encoded plan sharing
│   │   ├── storage.ts             # localStorage adapter
│   │   └── export.ts              # CSV + PDF (browser print)
│   ├── store.ts                   # Zustand store + persistence
│   ├── types.ts
│   ├── App.tsx
│   └── main.tsx
├── data/                          # SQLite db (gitignored)
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

**How the backend planner works:** the client POSTs the prompt to `/api/plan`.
The Express server prepends a frozen system prompt (`server/lib/planner-prompt.ts`)
containing the entire module catalog (~30KB), defines a single `submit_plan`
tool, calls Claude (`tool_choice: {type: 'tool', name: 'submit_plan'}`), and
returns the tool-call arguments verbatim as the structured plan. Prompt caching
on the catalog means every request after the first reads from cache at ~0.1×.

If `/api/plan` returns 404 (no server) or 503 (no token), the client silently
falls back to `src/lib/planner.ts` — the rule-based planner Atelier shipped with.

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
- **Maggie's draft state stays in localStorage** — only the *finalized* snapshot
  is sent to the backend. If Maggie wants Carli to edit her draft, she sends the
  share-URL (encoded in `#plan=...`). Multi-user concurrent editing of a single
  draft is intentionally not supported in v1. `src/lib/storage.ts` has
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
