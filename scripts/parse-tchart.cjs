// scripts/parse-tchart.cjs
// Re-runnable parser: T-chart workbook → typed JSON the React app consumes.
//
// Reads sheets 2 (Master), 4 (Pontis rack-stack), 5 (Business value), 6 (Roadmap timing).
// Cross-stitches into a single normalized data file that captures every module's
// description, COA, time-to-delivery, hours-saved, dependencies, lifecycle phase,
// current-tool-replaced, and roadmap window.

const XLSX = require('xlsx');
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, '..', '_src', 'tchart.xlsx');
const OUT = path.join(__dirname, '..', 'src', 'data', 'modules.json');

// --- Section + phase metadata (sentence-fragment descriptors, ĒSO voice) -------------

const SECTIONS = [
  { key: 'A', name: 'Foundation',                  descriptor: 'Single + Visible',           accent: 'The place ĒSO lives. One login. One interface.' },
  { key: 'B', name: 'BD / CRM / Lead Pipeline',    descriptor: 'Pipeline + Memory',          accent: 'Maggie’s pipeline + referrals stop dying in inboxes.' },
  { key: 'C', name: 'Project Management',          descriptor: 'Bend to ĒSO’s Shape',   accent: 'The system of record bends to ĒSO. Monograph retires.' },
  { key: 'D', name: 'Proposals + Contracts',       descriptor: 'Edit, Don’t Write',     accent: 'Hours of writing-from-scratch → minutes of editing.' },
  { key: 'E', name: 'Financial + Billing',         descriptor: 'Money That Remembers',       accent: 'Money tracking that doesn’t depend on people remembering.' },
  { key: 'F', name: 'Reporting + Visibility',      descriptor: 'Truth from State',           accent: 'Reports tell the truth because the system, not humans, generated them.' },
  { key: 'G', name: 'Knowledge + RAG',             descriptor: 'Searchable + Native',        accent: 'Firm knowledge becomes searchable in plain English.' },
  { key: 'H', name: 'Communications + Comm Log',   descriptor: 'One Thread, One Place',      accent: 'What was said to whom, when, lives in one searchable place.' },
  { key: 'I', name: 'Client-Facing Portal',        descriptor: 'Bigger Than We Are',         accent: 'Differentiator. Clients feel taken care of without taking Maggie’s time.' },
  { key: 'J', name: 'Design-Tool Reach',           descriptor: 'AI Sees Into Archicad',      accent: 'AI starts seeing into Archicad + Bluebeam, not just around them.' },
  { key: 'K', name: 'Voice-First Capture',         descriptor: 'Voice In, Data Out',         accent: 'Friction goes to zero. The capture mechanism Maggie + Moshe already prefer becomes first-class.' },
  { key: 'L', name: 'Brand + Templates',           descriptor: 'Looks Like ĒSO',             accent: 'Every artifact looks like ĒSO. Every time.' },
  { key: 'M', name: 'Adoption + Training',         descriptor: 'Sticks Because They Know',   accent: 'Pontis sticks because the team knows how to use it.' },
  { key: 'N', name: 'Community / Industry',        descriptor: 'Cost Center → Revenue', accent: 'Pontis becomes a revenue line for ĒSO, not just a cost center.' },
];

const QUICK_WIN = {
  key: 'Q',
  name: 'Quick Wins (COA 1 + 2)',
  descriptor: 'Billable + Now',
  accent: 'The Microsoft + Claude bolt-ons that pay off immediately. Billed at $100/hr.',
};

// --- Helpers ------------------------------------------------------------------------

const blankRow = (r) => r.every((c) => c === '' || c == null);
const num = (v) => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

// "2–4 weeks" / "1 week" / "2 weeks (after C3-K1)" → weeks numeric range [low, high]
function parseTimeToDelivery(raw) {
  if (!raw) return { label: '—', weeksLow: 0, weeksHigh: 0 };
  const label = String(raw).trim();
  if (/already done/i.test(label)) return { label, weeksLow: 0, weeksHigh: 0 };
  if (/iterative/i.test(label) && !/\d/.test(label)) return { label, weeksLow: 4, weeksHigh: 8 };
  if (/ongoing/i.test(label)) return { label, weeksLow: 2, weeksHigh: 6 };
  if (/q3\+/i.test(label)) return { label, weeksLow: 26, weeksHigh: 39 };
  if (/q4\+/i.test(label)) return { label, weeksLow: 39, weeksHigh: 52 };
  if (/throughout/i.test(label)) return { label, weeksLow: 4, weeksHigh: 16 };
  if (/quarterly/i.test(label)) return { label, weeksLow: 1, weeksHigh: 13 };
  if (/may 15/i.test(label)) return { label, weeksLow: 0, weeksHigh: 1 };

  const monthMatch = label.match(/(\d+)\s*[–-]\s*(\d+)\s*months?/i);
  if (monthMatch) {
    return {
      label,
      weeksLow: Number(monthMatch[1]) * 4,
      weeksHigh: Number(monthMatch[2]) * 4,
    };
  }
  const rangeMatch = label.match(/(\d+)\s*[–-]\s*(\d+)\s*weeks?/i);
  if (rangeMatch) {
    return { label, weeksLow: Number(rangeMatch[1]), weeksHigh: Number(rangeMatch[2]) };
  }
  const singleMatch = label.match(/(\d+)\s*weeks?/i);
  if (singleMatch) {
    return { label, weeksLow: Number(singleMatch[1]), weeksHigh: Number(singleMatch[1]) };
  }
  return { label, weeksLow: 2, weeksHigh: 4 };
}

// Pull explicit "after C3-X#" or "depends on K1" deps from sequence + time fields.
function extractDependencies(...sources) {
  const text = sources.filter(Boolean).join(' ');
  const deps = new Set();
  const explicit = text.match(/(?:after|depends on)\s+(?:C3-)?([A-N]\d+(?:-\w+)?)/gi);
  if (explicit) {
    for (const m of explicit) {
      const id = m.replace(/.*?(?:C3-)?([A-N]\d+).*/i, 'C3-$1').toUpperCase();
      deps.add(id);
    }
  }
  return Array.from(deps);
}

// Pontis bucket from section letter on the ID.
function sectionForId(id) {
  if (id.startsWith('C1-') || id.startsWith('C2-')) return 'Q';
  const m = id.match(/^C3-([A-N])/);
  return m ? m[1] : 'Q';
}

// --- Read sheets --------------------------------------------------------------------

const wb = XLSX.readFile(SRC);
const masterRows = XLSX.utils.sheet_to_json(wb.Sheets['2. Master T-chart'], { header: 1, defval: '' });
const rackRows = XLSX.utils.sheet_to_json(wb.Sheets['4. COA 3 — Pontis rack-stack'], { header: 1, defval: '' });
const valueRows = XLSX.utils.sheet_to_json(wb.Sheets['5. Business value'], { header: 1, defval: '' });
const roadmapRows = XLSX.utils.sheet_to_json(wb.Sheets['6. Roadmap timing'], { header: 1, defval: '' });

// --- Index rack-stack by ID (richest source) -----------------------------------------

const rackById = new Map();
let rackHeader = null;
for (const r of rackRows) {
  if (blankRow(r)) continue;
  if (r[0] === 'ID') { rackHeader = r; continue; }
  const id = String(r[0] || '').trim();
  if (!/^C3-/.test(id)) continue;

  // Description column in sheet 4 contains "Name — description"
  const combined = String(r[1] || '').trim();
  const split = combined.split(/\s+—\s+/);
  const name = split[0].trim();
  const description = split.slice(1).join(' — ').trim() || name;

  rackById.set(id, {
    id,
    name,
    description,
    fscSequence: String(r[4] || '').trim(),
    matrixRef: String(r[5] || '').trim().replace(/^—$/, ''),
    lifecyclePhase: String(r[6] || '').trim(),
    currentTool: String(r[7] || '').trim(),
    hoursSavedRaw: r[8],
    desiredOutcome: String(r[9] || '').trim(),
  });
}

// --- Walk Master T-chart for full module list ---------------------------------------

const modules = [];
for (const r of masterRows) {
  if (blankRow(r)) continue;
  const id = String(r[0] || '').trim();
  if (!/^(C1-|C2-|C3-)/.test(id)) continue;

  const name = String(r[1] || '').trim();
  const description = String(r[2] || '').trim();
  const coa = String(r[3] || '').trim();
  const timeStr = String(r[4] || '').trim();
  const billableHrs = num(r[5]);
  const rom = num(r[6]);
  const desiredOutcome = String(r[7] || '').trim();

  const time = parseTimeToDelivery(timeStr);
  const sectionKey = sectionForId(id);
  const rackInfo = rackById.get(id);

  // Hours saved: rack-stack column; "—" means non-quantified foundation module.
  let hoursSaved = null;
  if (rackInfo && rackInfo.hoursSavedRaw !== '' && rackInfo.hoursSavedRaw !== '—') {
    hoursSaved = num(rackInfo.hoursSavedRaw);
  }

  // Build dependency list from sheet 4 "FSC suggested sequence" + sheet 2 timing string.
  let dependencies = extractDependencies(rackInfo?.fscSequence, timeStr);
  // K2..K5 explicitly reuse the K1 voice pipeline; encode that.
  if (/^C3-K[2-5]$/.test(id) && !dependencies.includes('C3-K1')) dependencies.push('C3-K1');
  // A2 needs A1 foundation.
  if (id === 'C3-A2' && !dependencies.includes('C3-A1')) dependencies.push('C3-A1');
  // B3 voice flow needs K1.
  if (id === 'C3-B3' && !dependencies.includes('C3-K1')) dependencies.push('C3-K1');
  // D5 auto-fee needs D4 history.
  if (id === 'C3-D5' && !dependencies.includes('C3-D4')) dependencies.push('C3-D4');
  // D7 voice program brief needs K1.
  if (id === 'C3-D7' && !dependencies.includes('C3-K1')) dependencies.push('C3-K1');

  // Anything explicit in rack-stack with "after C3-X" beyond the inferred ones
  // (already captured by extractDependencies).

  // FSC suggested numeric sequence (if any).
  let sequenceNum = null;
  const seqMatch = (rackInfo?.fscSequence || '').match(/^(\d+)\s*[—-]/);
  if (seqMatch) sequenceNum = Number(seqMatch[1]);

  modules.push({
    id,
    name,
    description,
    coa, // "COA 1" | "COA 2" | "COA 3"
    sectionKey,
    timeLabel: time.label,
    weeksLow: time.weeksLow,
    weeksHigh: time.weeksHigh,
    billableHours: coa === 'COA 3' ? null : (billableHrs ?? 0),
    rom: coa === 'COA 3' ? 0 : (rom ?? 0),
    retainerCovered: coa === 'COA 3',
    hoursSavedPerYear: hoursSaved,
    currentTool: rackInfo?.currentTool || '',
    desiredOutcome: desiredOutcome || rackInfo?.desiredOutcome || '',
    lifecyclePhase: rackInfo?.lifecyclePhase || '',
    matrixRef: rackInfo?.matrixRef || '',
    dependencies,
    fscSequence: sequenceNum,
  });
}

// --- Merge in net-new modules from extra-modules.json --------------------------------
//
// Modules added after a re-audit of FSC's pre-readout source materials (Gemini
// transcripts, findings deck, Phase 2 roadmap, opportunity matrix) but not
// captured in the canonical T-chart workbook yet. See scripts/extra-modules.json
// for the citation-backed audit and the gap analysis.

const extrasPath = path.join(__dirname, 'extra-modules.json');
if (fs.existsSync(extrasPath)) {
  const extras = JSON.parse(fs.readFileSync(extrasPath, 'utf8'));
  const existingIds = new Set(modules.map((m) => m.id));
  let added = 0;
  for (const m of extras.modules || []) {
    if (existingIds.has(m.id)) {
      console.warn(`[extras] id ${m.id} already exists in T-chart; skipping`);
      continue;
    }
    modules.push(m);
    added += 1;
  }
  if (added) console.log(`Merged ${added} extras from scripts/extra-modules.json`);
}

// --- Roadmap windows ----------------------------------------------------------------

const roadmap = [];
for (const r of roadmapRows) {
  if (blankRow(r)) continue;
  const window = String(r[0] || '').trim();
  if (!window || window === 'Window') continue;
  const phase = String(r[1] || '').trim();
  const modulesList = String(r[2] || '').split(',').map((s) => s.trim()).filter(Boolean);
  const outcome = String(r[3] || '').trim();
  roadmap.push({ window, phase, modules: modulesList, outcome });
}

// --- Business value reference numbers (informational) -------------------------------

const businessValue = {
  hoursSavedTotalDefault: 3073,
  internalRateDefault: 80,
  principalRateDefault: 200,
  adoptionFloorDefault: 0.7,
  workingWeeksDefault: 50,
};
for (const r of valueRows) {
  if (blankRow(r)) continue;
  const k = String(r[0] || '').toLowerCase();
  if (k.includes('annual hours saved across all'))   businessValue.hoursSavedTotalDefault = num(r[1]) || businessValue.hoursSavedTotalDefault;
  if (k.includes('internal blended rate'))           businessValue.internalRateDefault = num(r[1]) || businessValue.internalRateDefault;
  if (k.includes('principal rate midpoint'))         businessValue.principalRateDefault = num(r[1]) || businessValue.principalRateDefault;
  if (k.includes('adoption stick rate'))             businessValue.adoptionFloorDefault = num(r[1]) || businessValue.adoptionFloorDefault;
  if (k.includes('working weeks per year'))          businessValue.workingWeeksDefault = num(r[1]) || businessValue.workingWeeksDefault;
}

// --- Compile ------------------------------------------------------------------------

const sections = [
  QUICK_WIN,
  ...SECTIONS.map((s) => ({ ...s, key: s.key })),
];

const output = {
  generatedAt: new Date().toISOString(),
  sourceWorkbook: 'FSC_ESO_Post_Readout_Deliverables_TChart_v1.xlsx',
  sections,
  modules,
  roadmap,
  businessValue,
  counts: {
    total: modules.length,
    coa1: modules.filter((m) => m.coa === 'COA 1').length,
    coa2: modules.filter((m) => m.coa === 'COA 2').length,
    coa3: modules.filter((m) => m.coa === 'COA 3').length,
    sections: SECTIONS.length,
  },
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(output, null, 2));

console.log(
  `Wrote ${modules.length} modules (${output.counts.coa1} COA1 / ${output.counts.coa2} COA2 / ${output.counts.coa3} COA3) → ${path.relative(process.cwd(), OUT)}`
);
