import type { PontisModule } from '../types';

export function downloadCSV(selectedModules: PontisModule[], filename = 'pontis-atelier-plan.csv') {
  const header = [
    'id', 'name', 'coa', 'pontis_section', 'time_to_delivery',
    'weeks_low', 'weeks_high', 'billable_hours', 'rom_usd',
    'retainer_covered', 'annual_hours_saved', 'current_tool', 'desired_outcome', 'dependencies',
  ];
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const rows = selectedModules.map((m) => [
    m.id,
    m.name,
    m.coa,
    m.sectionKey,
    m.timeLabel,
    m.weeksLow,
    m.weeksHigh,
    m.billableHours ?? '',
    m.rom || '',
    m.retainerCovered,
    m.hoursSavedPerYear ?? '',
    m.currentTool,
    m.desiredOutcome,
    m.dependencies.join('; '),
  ].map(escape).join(','));

  const blob = new Blob([header.join(',') + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, filename);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// PDF export: print the dedicated "print view" page using the browser's native print.
// Keeps the file small (no PDF library) and renders the page with our own CSS, ĒSO-branded.
export function exportPDF() {
  window.print();
}
