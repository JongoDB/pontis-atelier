// Tenant configuration — Pontis Marketplace prep.
//
// Atelier was designed for ĒSO Architecture + Design as the anchor customer.
// To deploy it for another A&E firm, this is the file to edit. Everything that
// ties the app to ĒSO specifically lives here: palette overrides, etymology
// copy, section descriptors, voice prompts, the "real human" footer.
//
// The data model (modules, parser, store, schedule, planner) is generic.

export interface TenantPalette {
  pearl: string;
  bone: string;
  midnight: string;
  clay: string;
  burnt: string;
  laser: string;
}

export interface TenantConfig {
  /** Display name of the firm */
  firm: string;
  /** Their tagline / sub-headline */
  tagline: string;
  /** Email shown in footer / mailto */
  contactEmail: string;
  /** Optional: their public website */
  website?: string;
  /** Palette tokens (defaults to ĒSO Brand Guide colors) */
  palette: TenantPalette;
  /** First-run splash copy */
  splash: {
    headline: string;       // can include <br/> in the future via JSX wrapping
    italicEnd: string;      // the italic phrase that closes the headline
    body: string[];         // paragraphs in order
  };
  /** Product brand and etymology — the heart of Atelier's voice */
  product: {
    name: string;             // "Pontis Atelier"
    primaryWord: string;      // "pontis"
    primaryEtymology: string; // "latin · of the bridge"
    secondaryWord: string;    // "atelier"
    secondaryEtymology: string; // "french · the workshop where ĒSO decides what pontis becomes"
    aboutHeadline: string;
  };
  /** Footer human moment, à la "Call a real human · 512-568-9803" */
  footer: {
    humanLabel: string;
    humanValue: string;
    builtByLabel: string;
    builtByName: string;
    builtByFor: string;
  };
  /** Override section descriptors / accents — falls back to data/modules.json sections if not provided */
  sectionOverrides?: Record<string, { descriptor?: string; accent?: string }>;
}

// ---------------------------------------------------------------------------------
// ĒSO Architecture + Design — Winter 2026 Brand Guide
// ---------------------------------------------------------------------------------

export const ESO_CONFIG: TenantConfig = {
  firm: 'ĒSO Architecture + Design',
  tagline: 'where pontis takes shape',
  contactEmail: 'team@fightingsmartcyber.com',
  website: 'https://eso-arch.com',

  palette: {
    pearl:    '#f9f7f4',
    bone:     '#edeae2',
    midnight: '#214144',
    clay:     '#828279',
    burnt:    '#61655f',
    laser:    '#e9ff14',
  },

  splash: {
    headline: "let's pick what",
    italicEnd: 'pontis is to you.',
    body: [
      'pontis · latin · of the bridge. the platform fsc is building to bridge ĒSO\'s day — monograph, hubspot, scattered word templates, voice memos that disappear — into a single, coherent place.',
      'atelier · french · the workshop where ĒSO decides what pontis becomes.',
      '109 modules to choose from. select what you want, defer what can wait, reorder the build. the cost and gantt redraw as you sketch. nothing\'s committed until you say so.',
    ],
  },

  product: {
    name: 'Pontis Atelier',
    primaryWord: 'pontis',
    primaryEtymology: 'latin · of the bridge',
    secondaryWord: 'atelier',
    secondaryEtymology: 'french · the workshop where ĒSO decides what pontis becomes',
    aboutHeadline: 'where pontis takes shape.',
  },

  footer: {
    humanLabel: 'a real human',
    humanValue: 'team@fightingsmartcyber.com',
    builtByLabel: 'built by',
    builtByName: 'fighting smart cyber',
    builtByFor: 'for ĒSO Architecture + Design',
  },
};

// ---------------------------------------------------------------------------------
// Active tenant — switch this to deploy Atelier for another firm.
// Future: pick from an env var like VITE_TENANT=acme to support per-build tenancy.
// ---------------------------------------------------------------------------------

export const TENANT: TenantConfig = ESO_CONFIG;

// Re-export palette as a CSS-injectable string for runtime theming
export function paletteCSSVars(palette: TenantPalette): Record<string, string> {
  return {
    '--pearl': palette.pearl,
    '--bone': palette.bone,
    '--midnight': palette.midnight,
    '--clay': palette.clay,
    '--burnt': palette.burnt,
    '--laser': palette.laser,
  };
}
