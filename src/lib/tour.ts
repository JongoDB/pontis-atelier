// Walkthrough configs.
//
// Each tour is a sequential array of steps. The Tour component finds each
// anchor element via `document.querySelector('[data-tour="..."]')` and draws
// a ring + caption near it. Steps with no anchor render a centered card
// (used for intros / outros).

export type TourId = 'browse' | 'ask';

export interface TourStep {
  /** data-tour attribute value to highlight, or null for a centered card. */
  anchor: string | null;
  /** Short headline shown in the caption card. */
  title: string;
  /** Body text. */
  body: string;
  /** Optional preferred caption side. Auto-flips if it doesn't fit. */
  side?: 'top' | 'bottom';
  /** When the step appears, run this hook (auto-scroll, open a modal, etc.). */
  onEnter?: 'open-hey-pontis' | 'close-hey-pontis';
}

export const TOURS: Record<TourId, { name: string; steps: TourStep[] }> = {
  browse: {
    name: 'browse the modules',
    steps: [
      {
        anchor: 'browse-headline',
        title: 'this is the catalog.',
        body: '101 modules across 14 sections of how ĒSO works today. browse it like a menu — every card pitches one piece of pontis.',
        side: 'bottom',
      },
      {
        anchor: 'search-input',
        title: 'search by anything.',
        body: 'try a phrase like "closeout," "voice," or "rfp." the search reads each module\'s name, description, desired outcome, and what it replaces today.',
        side: 'bottom',
      },
      {
        anchor: 'coa-filter',
        title: 'filter by tier.',
        body: 'coa 3 = pontis builds, the heavy lifts. coa 1+2 = quick wins fsc can ship now (cancellations, advisory, training). use these to see what\'s buildable next quarter vs what\'s on the platform.',
        side: 'bottom',
      },
      {
        anchor: 'lifecycle-filter',
        title: 'filter by phase of the work.',
        body: 'inquiry → proposal → design/docs/permitting → construction admin → closeout. or cross-cutting for modules that touch every phase.',
        side: 'bottom',
      },
      {
        anchor: 'module-card',
        title: 'every module is a card.',
        body: 'name on top. a quote of the desired outcome in italic — ĒSO\'s voice, what the module accomplishes. then three numbers below.',
        side: 'top',
      },
      {
        anchor: 'card-stats',
        title: 'the three numbers that matter.',
        body: 'time to deliver. cost (rom in dollars, or "retainer" if it\'s already covered under coa 3). saves — hours back to the firm per year at ≥70% adoption.',
        side: 'top',
      },
      {
        anchor: 'deep-dive-btn',
        title: 'click the sparkle for the full pitch.',
        body: 'opens a deep-dive: today vs with pontis, dependencies (what it needs first, what it unblocks), business value at your internal + principal rates, 5-year cumulative.',
        side: 'top',
      },
      {
        anchor: 'add-to-plan-btn',
        title: 'add the modules you want.',
        body: 'this drops the module into "my plan." nothing\'s committed — you can remove it, defer it, or change your mind right up until you sign off.',
        side: 'top',
      },
      {
        anchor: 'nav-plan',
        title: 'check "my plan" any time.',
        body: 'the plan page draws the gantt, calculates rom + savings, and shows the change log. it redraws every time you tweak the catalog selection.',
        side: 'bottom',
      },
      {
        anchor: 'nav-fsc',
        title: 'or start from "fsc recommends".',
        body: 'a curated plan we\'d ship if we were you: foundation pieces, high-leverage hubs, and the top roi module per phase of your business.',
        side: 'bottom',
      },
      {
        anchor: 'request-cta',
        title: 'missing something?',
        body: 'tell us. "request a custom module" sends a feature request to fsc — describe what you want in the same shape as the existing modules and we review every one.',
        side: 'top',
      },
      {
        anchor: null,
        title: "you're set.",
        body: 'start picking what you want pontis to be. cost and gantt redraw live. ask your pontis assistant any time with the green dot in the top right.',
      },
    ],
  },
  ask: {
    name: 'ask your pontis assistant',
    steps: [
      {
        anchor: 'hey-modal',
        title: 'this is your pontis assistant.',
        body: 'tell it what you want in plain english. it reads the full 101-module catalog and your current selection, picks a slice, and writes back a starting plan in ĒSO\'s voice.',
        onEnter: 'open-hey-pontis',
        side: 'bottom',
      },
      {
        anchor: 'hey-input',
        title: 'describe the plan you want.',
        body: 'examples it understands: "focus on closeout pain first." "under $1,500 of billable rom." "max 5 modules." "voice flows + the pipeline they need." "fastest material savings — quick wins only."',
        side: 'bottom',
      },
      {
        anchor: 'hey-starters',
        title: 'or use a starter.',
        body: 'these are common asks. click any to fire it. the assistant returns its result in a few seconds — a list of picks, an estimate of total hours saved, billable rom, and the rationale for what it chose.',
        side: 'top',
      },
      {
        anchor: 'hey-submit',
        title: 'send when you\'re ready.',
        body: 'pontis calls claude on the backend with the full module catalog as context. if the backend is unreachable, a built-in rule-based planner takes over so you can keep working.',
        side: 'top',
      },
      {
        anchor: null,
        title: 'when the result lands, you can apply it.',
        body: 'an "add to my plan" button drops the recommended picks into your tray. you can keep iterating — describe what to change ("focus more on bd," "drop anything over 8 weeks") and the assistant redraws.',
      },
    ],
  },
};
