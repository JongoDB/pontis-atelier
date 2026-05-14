import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Send, Check, AlertTriangle, Plus } from 'lucide-react';
import { cn } from '../lib/cn';
import { ALL_MODULES, SECTIONS } from '../data/data';
import { useStore } from '../store';
import { useModal } from '../lib/useModal';
import { track } from '../lib/telemetry';

interface Props {
  open: boolean;
  onClose: () => void;
}

const LIFECYCLE_OPTIONS = [
  '',
  '1. Inquiry / RFP',
  '2. Proposal',
  '3. Design / Docs / Permitting',
  '4. Construction Admin',
  '5. Closeout',
  'Cross-cutting',
];

interface FormState {
  name: string;
  desiredOutcome: string;
  description: string;
  currentTool: string;
  sectionKey: string;
  lifecyclePhase: string;
  hoursSavedPerYear: string;
  dependencies: string[];
  notes: string;
}

const EMPTY: FormState = {
  name: '',
  desiredOutcome: '',
  description: '',
  currentTool: '',
  sectionKey: '',
  lifecyclePhase: '',
  hoursSavedPerYear: '',
  dependencies: [],
  notes: '',
};

export function RequestModule({ open, onClose }: Props) {
  const { labelId } = useModal(open, onClose);
  const finalizedByDefault = useStore((s) => s.snapshots[0]?.finalizedBy ?? '');
  const [form, setForm] = useState<FormState>(EMPTY);
  const [requestedBy, setRequestedBy] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [depQuery, setDepQuery] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setForm(EMPTY);
      setError(null);
      setSubmittedId(null);
      setRequestedBy(finalizedByDefault);
      setTimeout(() => nameRef.current?.focus(), 80);
    }
  }, [open, finalizedByDefault]);

  const depSuggestions = useMemo(() => {
    const q = depQuery.trim().toLowerCase();
    if (!q) return [];
    return ALL_MODULES.filter((m) => {
      if (form.dependencies.includes(m.id)) return false;
      return (
        m.id.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q)
      );
    }).slice(0, 6);
  }, [depQuery, form.dependencies]);

  if (!open) return null;

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
  };

  const addDep = (id: string) => {
    set('dependencies', [...form.dependencies, id]);
    setDepQuery('');
  };
  const removeDep = (id: string) => {
    set('dependencies', form.dependencies.filter((x) => x !== id));
  };

  const submit = async () => {
    setError(null);
    if (!form.name.trim()) {
      setError('please give the module a name.');
      return;
    }
    if (!form.desiredOutcome.trim()) {
      setError('please describe the desired outcome — that\'s the load-bearing field.');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        ...form,
        requestedBy: requestedBy.trim(),
        hoursSavedPerYear: form.hoursSavedPerYear.trim() === '' ? null : Number(form.hoursSavedPerYear),
      };
      const res = await fetch('/api/module-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      track('module-request-submit', { id: data.id, name: form.name });
      setSubmittedId(data.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelId}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        tabIndex={-1}
        className="fixed inset-0 bg-midnight/40 backdrop-blur-sm animate-fade"
      />

      <article className="relative w-full max-w-3xl bg-pearl my-6 md:my-10 mx-4 mb-[max(env(safe-area-inset-bottom),24px)] rounded-sm shadow-2xl shadow-midnight/30 animate-riseIn">
        <header className="sticky top-0 z-10 bg-pearl border-b border-midnight/15">
          <div className="flex items-start justify-between gap-4 px-6 md:px-10 py-5">
            <div className="flex items-center gap-3 flex-wrap min-w-0">
              <span className="flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] tracking-tight border border-laser text-midnight">
                <Plus size={11} strokeWidth={2.5} />
                request a custom module
              </span>
              <span className="text-[11px] text-clay italic">
                a feature request — fsc reviews + scopes at intake.
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-2 -mr-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-burnt hover:text-midnight transition-colors"
              aria-label="Close request form"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </header>

        {submittedId ? (
          <SubmittedView id={submittedId} name={form.name} onClose={onClose} />
        ) : (
          <div className="px-6 md:px-10 py-8 md:py-10">
            <h2 id={labelId} className="font-display text-display-lg text-midnight leading-tight lowercase">
              the module you wish existed.
            </h2>
            <p className="mt-3 text-burnt text-[15px] leading-relaxed max-w-2xl">
              describe it the same way the existing modules describe themselves —
              what you want it to do, what you do today instead, where it fits in the
              lifecycle. fsc reviews every request and either folds it into a build
              window or comes back with a clarifying question.
            </p>

            {error && (
              <div className="mt-6 p-3 bg-laser/30 border-l-2 border-midnight flex items-start gap-2">
                <AlertTriangle size={14} className="text-midnight mt-0.5 shrink-0" />
                <p className="text-sm text-midnight">{error}</p>
              </div>
            )}

            <form
              onSubmit={(e) => { e.preventDefault(); submit(); }}
              className="mt-8 space-y-7"
            >
              <Field
                label="name *"
                hint="what you'd call this in conversation. concise + concrete."
              >
                <input
                  ref={nameRef}
                  type="text"
                  required
                  maxLength={240}
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="e.g. site-photo auto-tagger"
                  className={inputCls}
                />
              </Field>

              <Field
                label="desired outcome *"
                hint="one sentence, in ĒSO's voice. this is the load-bearing field — what the module accomplishes for the firm."
              >
                <textarea
                  required
                  rows={2}
                  maxLength={2000}
                  value={form.desiredOutcome}
                  onChange={(e) => set('desiredOutcome', e.target.value)}
                  placeholder="e.g. every site photo lands tagged with project, room, and date — never re-named by hand again."
                  className={cn(inputCls, 'resize-y leading-relaxed italic')}
                />
              </Field>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Field
                  label="today"
                  hint="what currently happens (or doesn't) — the pain pontis would replace."
                >
                  <textarea
                    rows={3}
                    maxLength={1000}
                    value={form.currentTool}
                    onChange={(e) => set('currentTool', e.target.value)}
                    placeholder="e.g. carli renames each photo manually after every site visit, sometimes days later."
                    className={cn(inputCls, 'resize-y leading-relaxed')}
                  />
                </Field>

                <Field
                  label="with pontis"
                  hint="what the module does — the version after pontis lands it."
                >
                  <textarea
                    rows={3}
                    maxLength={4000}
                    value={form.description}
                    onChange={(e) => set('description', e.target.value)}
                    placeholder="e.g. iOS shortcut sends each photo to pontis with gps; pontis matches the project, infers the room from EXIF + recent rfis, and writes the rename back."
                    className={cn(inputCls, 'resize-y leading-relaxed')}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Field label="section" hint="where in the catalog should it live?">
                  <select
                    value={form.sectionKey}
                    onChange={(e) => set('sectionKey', e.target.value)}
                    className={inputCls}
                  >
                    <option value="">— fsc decides —</option>
                    {SECTIONS.map((s) => (
                      <option key={s.key} value={s.key}>§{s.key} · {s.name.toLowerCase()}</option>
                    ))}
                  </select>
                </Field>

                <Field label="lifecycle phase" hint="when in the project arc does it apply?">
                  <select
                    value={form.lifecyclePhase}
                    onChange={(e) => set('lifecyclePhase', e.target.value)}
                    className={inputCls}
                  >
                    {LIFECYCLE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt === '' ? '— fsc decides —' : opt.toLowerCase()}</option>
                    ))}
                  </select>
                </Field>

                <Field label="estimated hrs / yr saved" hint="rough guess; fsc validates at intake.">
                  <input
                    type="number"
                    min="0"
                    max="2000"
                    step="1"
                    value={form.hoursSavedPerYear}
                    onChange={(e) => set('hoursSavedPerYear', e.target.value)}
                    placeholder="e.g. 40"
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field
                label="depends on (optional)"
                hint="existing modules that must ship before this one. type to search."
              >
                <div className="space-y-2">
                  {form.dependencies.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5">
                      {form.dependencies.map((id) => {
                        const m = ALL_MODULES.find((x) => x.id === id);
                        return (
                          <li key={id}>
                            <button
                              type="button"
                              onClick={() => removeDep(id)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-bone border border-midnight/15 rounded-full text-[11px] text-midnight hover:bg-laser/30 transition-colors"
                            >
                              <span className="font-mono">{id}</span>
                              {m && <span className="text-burnt">· {m.name.toLowerCase().slice(0, 32)}</span>}
                              <X size={10} className="text-clay" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <div className="relative">
                    <input
                      type="text"
                      value={depQuery}
                      onChange={(e) => setDepQuery(e.target.value)}
                      placeholder="search modules by id or name…"
                      className={inputCls}
                    />
                    {depSuggestions.length > 0 && (
                      <ul className="absolute z-10 mt-1 inset-x-0 bg-pearl border border-midnight/20 rounded-sm shadow-md max-h-56 overflow-y-auto thin-scroll">
                        {depSuggestions.map((m) => (
                          <li key={m.id}>
                            <button
                              type="button"
                              onClick={() => addDep(m.id)}
                              className="w-full text-left px-3 py-2 hover:bg-bone transition-colors flex items-baseline gap-2 text-sm"
                            >
                              <span className="font-mono text-[11px] text-burnt tabular-nums">{m.id}</span>
                              <span className="text-midnight truncate">{m.name.toLowerCase()}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </Field>

              <Field
                label="anything else fsc should know (optional)"
                hint="constraints, integrations, examples — anything that helps fsc scope this cleanly."
              >
                <textarea
                  rows={2}
                  maxLength={4000}
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  placeholder="e.g. needs to play nice with the existing teams photo channel; carli is the primary user."
                  className={cn(inputCls, 'resize-y leading-relaxed')}
                />
              </Field>

              <div className="pt-6 border-t border-midnight/10 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div className="md:col-span-7">
                  <p className="eyebrow !text-burnt mb-2">your name</p>
                  <input
                    type="text"
                    value={requestedBy}
                    onChange={(e) => setRequestedBy(e.target.value)}
                    placeholder="so fsc knows who to come back to"
                    className={inputCls}
                  />
                </div>
                <div className="md:col-span-5 flex items-center gap-2 md:justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 text-sm text-burnt hover:text-midnight min-h-[44px]"
                  >
                    cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-sm bg-midnight text-pearl text-sm hover:bg-ink transition-colors disabled:opacity-50 min-h-[44px]"
                  >
                    <Send size={14} />
                    {busy ? 'sending…' : 'send to fsc'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </article>
    </div>
  );
}

const inputCls =
  'w-full bg-bone border border-midnight/15 rounded-sm px-3 py-2 text-[14px] text-midnight placeholder:text-clay/70 focus:outline-none focus:border-midnight focus:bg-pearl transition-colors';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <p className="eyebrow !text-burnt">{label}</p>
      </div>
      {children}
      {hint && <p className="text-[11px] text-clay/90 italic mt-1.5 leading-relaxed">{hint}</p>}
    </div>
  );
}

function SubmittedView({ id, name, onClose }: { id: string; name: string; onClose: () => void }) {
  return (
    <div className="px-6 md:px-10 py-12 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-laser/40 text-midnight mx-auto mb-5">
        <Check size={20} strokeWidth={2.5} />
      </div>
      <h2 className="font-display text-2xl md:text-3xl text-midnight">
        sent. <span className="italic font-light text-burnt">fsc has it.</span>
      </h2>
      <p className="mt-3 text-burnt text-[14px] max-w-md mx-auto leading-relaxed">
        "{name.toLowerCase()}" — request <span className="font-mono text-[12px] text-clay">{id.slice(0, 8)}</span> —
        is queued for review. expect a clarifying note or a slotting decision back from fsc within the next build window.
      </p>
      <button
        onClick={onClose}
        className="mt-7 px-5 py-2.5 rounded-sm border border-midnight text-midnight hover:bg-midnight hover:text-pearl transition-colors text-sm"
      >
        back to atelier
      </button>
    </div>
  );
}
