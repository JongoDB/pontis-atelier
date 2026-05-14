import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, RefreshCw, AlertTriangle, Eye,
  Calendar, User, Clock, DollarSign, ListChecks, Plus, ChevronDown, ChevronRight,
} from 'lucide-react';
import { cn } from '../lib/cn';
import { ALL_MODULES, MODULE_BY_ID, SECTION_BY_KEY } from '../data/data';
import { EsoMark } from './Wordmark';
import { compactCurrency, compactNumber } from '../lib/format';

interface SnapshotListItem {
  id: string;
  finalizedAt: string;
  finalizedBy: string;
  note: string;
  modules: number;
  billableROM: number;
  hoursSavedPerYear: number;
  annualSavedInternal: number;
  quartersOfRetainerBuild: number;
  shareURL: string;
  receivedAt: string;
}

interface SnapshotDetail extends SnapshotListItem {
  selectedOrder: string[];
  deferrals: Record<string, number>;
  priorities: Record<string, number>;
  ua: string;
  ip: string;
}

interface ModuleRequestItem {
  id: string;
  createdAt: string;
  requestedBy: string;
  name: string;
  desiredOutcome: string;
  description: string;
  currentTool: string;
  sectionKey: string;
  lifecyclePhase: string;
  hoursSavedPerYear: number | null;
  dependencies: string[];
  notes: string;
  status: string;
}

export function AdminPage() {
  // HTTP Basic Auth happens at the server before the SPA is served — by the
  // time this component mounts, the browser has already prompted and stored
  // the credentials. Subsequent fetch() calls to /api/admin/* automatically
  // carry the Authorization header (same origin + same realm).
  const [snapshots, setSnapshots] = useState<SnapshotListItem[]>([]);
  const [requests, setRequests] = useState<ModuleRequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadList() {
    setLoading(true);
    setError(null);
    try {
      const [snapsRes, reqsRes] = await Promise.all([
        fetch('/api/admin/snapshots?limit=200', { credentials: 'include' }),
        fetch('/api/admin/module-requests', { credentials: 'include' }),
      ]);
      if (snapsRes.status === 401 || reqsRes.status === 401) {
        setError('not authenticated — refresh the page to retry');
        return;
      }
      if (!snapsRes.ok) {
        const text = await snapsRes.text();
        throw new Error(`HTTP ${snapsRes.status} — ${text.slice(0, 120)}`);
      }
      const snapsData = await snapsRes.json();
      setSnapshots(snapsData.snapshots ?? []);
      if (reqsRes.ok) {
        const reqsData = await reqsRes.json();
        setRequests(reqsData.requests ?? []);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-pearl bg-drafting">
      <header className="sticky top-0 z-30 bg-pearl border-b border-midnight/15">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-4 flex items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <a href="/" className="flex items-center gap-3 text-midnight">
              <EsoMark size={22} />
              <span className="font-display text-[1.05rem] font-medium tracking-tight">pontis / atelier</span>
            </a>
            <span className="hidden md:inline border-l border-midnight/15 pl-6 eyebrow !text-burnt">admin · finalized plans</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => loadList()}
              disabled={loading}
              className="flex items-center gap-1.5 text-sm text-burnt hover:text-midnight transition-colors"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>{loading ? 'refreshing…' : 'refresh'}</span>
            </button>
            <span
              title="HTTP Basic Auth credentials are cached by the browser. Close the tab (or all browser windows on some browsers) to sign out."
              className="text-xs text-clay hover:text-midnight cursor-help"
            >
              close tab to sign out
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 md:px-10 py-10 md:py-14">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
          <div className="md:col-span-7">
            <p className="eyebrow">admin · what they finalized</p>
            <h1 className="font-display text-display-lg text-midnight mt-2 leading-tight">
              every plan signed off,<br />
              <span className="italic font-light text-burnt">in order.</span>
            </h1>
          </div>
          <div className="md:col-span-5 md:text-right">
            <p className="text-burnt text-[14px] leading-relaxed max-w-md md:ml-auto">
              {snapshots.length === 0
                ? 'no snapshots yet. the moment maggie hits "finalize plan," her commit shows up here.'
                : `${snapshots.length} snapshot${snapshots.length === 1 ? '' : 's'} on record · newest first.`}
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-8 p-4 bg-laser/30 border-l-2 border-midnight">
            <p className="text-sm font-medium text-midnight">
              <AlertTriangle size={14} className="inline mr-2" />
              {error}
            </p>
          </div>
        )}

        {snapshots.length === 0 && !error && !loading && (
          <div className="mt-12 py-20 text-center text-burnt">
            <p className="font-display text-2xl italic mb-2">nothing's been finalized yet.</p>
            <p className="text-sm text-clay">
              when a plan is signed off in atelier, the snapshot lands here within a second.
            </p>
          </div>
        )}

        {snapshots.length > 0 && (
          <ul className="mt-10 divide-y divide-midnight/10 border-t border-b border-midnight/10">
            {snapshots.map((s) => (
              <SnapshotRow key={s.id} snap={s} onOpen={() => setOpenId(s.id)} />
            ))}
          </ul>
        )}

        {openId && (
          <SnapshotDetailModal
            id={openId}
            onClose={() => setOpenId(null)}
          />
        )}

        <ModuleRequestsSection requests={requests} />
      </main>

      <footer className="border-t border-midnight/15 mt-20">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-6 text-xs text-clay flex items-center justify-between gap-3 flex-wrap">
          <span>pontis · latin: of the bridge. atelier · french: the workshop.</span>
          <span>fsc admin · v1</span>
        </div>
      </footer>
    </div>
  );
}

function SnapshotRow({ snap, onOpen }: { snap: SnapshotListItem; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left py-5 grid grid-cols-12 gap-3 md:gap-6 hover:bg-bone/40 transition-colors px-2"
      >
        <div className="col-span-12 md:col-span-3 flex items-center gap-3">
          <User size={14} className="text-burnt shrink-0" />
          <div>
            <p className="font-display text-base text-midnight leading-tight lowercase">{snap.finalizedBy}</p>
            <p className="text-[11px] text-clay tabular-nums">
              {new Date(snap.finalizedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>
        </div>

        <div className="col-span-4 md:col-span-2 flex flex-col items-start">
          <span className="text-[10px] uppercase tracking-widish text-clay">modules</span>
          <span className="font-display text-xl text-midnight tabular-nums">{snap.modules}</span>
        </div>

        <div className="col-span-4 md:col-span-2 flex flex-col items-start">
          <span className="text-[10px] uppercase tracking-widish text-clay">hrs / yr</span>
          <span className="font-display text-xl text-midnight tabular-nums">{compactNumber(snap.hoursSavedPerYear)}</span>
        </div>

        <div className="col-span-4 md:col-span-2 flex flex-col items-start">
          <span className="text-[10px] uppercase tracking-widish text-clay">$ / yr</span>
          <span className="font-display text-xl text-midnight tabular-nums">{compactCurrency(snap.annualSavedInternal)}</span>
        </div>

        <div className="col-span-12 md:col-span-3 flex items-center justify-between gap-3">
          {snap.note ? (
            <p className="text-[12px] italic text-burnt truncate">"{snap.note}"</p>
          ) : (
            <span className="text-[11px] text-clay/70">no note</span>
          )}
          <Eye size={14} className="text-burnt shrink-0" />
        </div>
      </button>
    </li>
  );
}

function SnapshotDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [detail, setDetail] = useState<SnapshotDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/snapshots/${encodeURIComponent(id)}`, { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => setDetail(data.snapshot))
      .catch((e) => setErr(e.message ?? String(e)));
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto">
      <button onClick={onClose} aria-label="Close" className="fixed inset-0 bg-midnight/40 backdrop-blur-sm animate-fade" />
      <div className="relative w-full max-w-4xl bg-pearl my-6 md:my-10 mx-4 rounded-sm shadow-2xl shadow-midnight/30 animate-riseIn">
        <header className="sticky top-0 bg-pearl border-b border-midnight/15 px-6 md:px-10 py-4 flex items-center justify-between gap-4 rounded-t-sm">
          <button onClick={onClose} className="flex items-center gap-1.5 text-burnt hover:text-midnight text-sm">
            <ArrowLeft size={14} /> all snapshots
          </button>
          {detail && (
            <p className="text-[11px] text-clay tabular-nums">
              snapshot {detail.id.slice(0, 8)}…
            </p>
          )}
        </header>

        {err && (
          <div className="p-8">
            <p className="text-sm text-burnt italic">{err}</p>
          </div>
        )}

        {!detail && !err && (
          <div className="p-12 text-center">
            <RefreshCw size={20} className="text-clay animate-spin mx-auto mb-3" />
            <p className="text-sm text-clay">loading snapshot…</p>
          </div>
        )}

        {detail && <DetailBody detail={detail} />}
      </div>
    </div>
  );
}

function DetailBody({ detail }: { detail: SnapshotDetail }) {
  const modules = detail.selectedOrder
    .map((id) => MODULE_BY_ID.get(id))
    .filter((m): m is (typeof ALL_MODULES)[number] => !!m);

  const bySection = useMemo(() => {
    const map = new Map<string, typeof modules>();
    for (const m of modules) {
      const list = map.get(m.sectionKey) ?? [];
      list.push(m);
      map.set(m.sectionKey, list);
    }
    return map;
  }, [modules]);

  return (
    <div className="px-6 md:px-10 py-10">
      <p className="eyebrow">finalized snapshot</p>
      <h2 className="font-display text-display-lg text-midnight mt-2 leading-tight">
        {detail.finalizedBy.toLowerCase()}<span className="italic font-light text-burnt"> · {detail.modules} modules</span>
      </h2>
      <p className="text-burnt mt-2 italic">
        {new Date(detail.finalizedAt).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}
      </p>

      {detail.note && (
        <blockquote className="mt-6 p-4 border-l-2 border-midnight max-w-2xl text-sm italic text-burnt">
          "{detail.note}"
        </blockquote>
      )}

      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat icon={<ListChecks size={12} />} label="modules" value={detail.modules.toString()} />
        <Stat icon={<DollarSign size={12} />} label="COA 1+2 ROM" value={compactCurrency(detail.billableROM)} />
        <Stat icon={<Clock size={12} />} label="hrs saved / yr" value={compactNumber(detail.hoursSavedPerYear)} />
        <Stat icon={<Calendar size={12} />} label="retainer quarters" value={`≈ ${detail.quartersOfRetainerBuild}`} />
      </div>

      <section className="mt-10">
        <p className="eyebrow !text-burnt mb-3">selected modules · ordered</p>
        <div className="space-y-7">
          {Array.from(bySection.entries()).map(([key, mods]) => {
            const section = SECTION_BY_KEY.get(key);
            return (
              <section key={key}>
                <header className="flex items-baseline justify-between gap-4 mb-2 pb-1 border-b border-midnight/15">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-clay text-sm tabular-nums">§ {key}</span>
                    <h3 className="font-display text-base text-midnight lowercase">{section?.name}</h3>
                  </div>
                  <p className="text-[11px] text-clay tabular-nums">{mods.length}</p>
                </header>
                <ul className="divide-y divide-midnight/8">
                  {mods.map((m) => {
                    const def = detail.deferrals?.[m.id];
                    const pri = detail.priorities?.[m.id];
                    return (
                      <li key={m.id} className="py-2 grid grid-cols-12 gap-2 text-sm">
                        <span className="col-span-2 md:col-span-1 font-mono text-[11px] tabular-nums text-burnt">{m.id}</span>
                        <span className="col-span-7 md:col-span-7 text-midnight">
                          {m.name.toLowerCase()}
                          {pri != null && <span className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full bg-laser text-midnight text-[10px] font-medium tabular-nums">{pri}</span>}
                          {def && def > 0 && <span className="ml-2 text-[10px] text-burnt uppercase tracking-widish">+{def}w</span>}
                        </span>
                        <span className="hidden md:block col-span-2 text-[11px] text-clay text-right tabular-nums">
                          {m.timeLabel.replace(/\s*\([^)]*\)/, '')}
                        </span>
                        <span className="col-span-3 md:col-span-2 text-[11px] text-burnt text-right">
                          {m.retainerCovered ? 'retainer' : compactCurrency(m.rom)}
                          {m.hoursSavedPerYear != null && <span className="block text-clay">{m.hoursSavedPerYear} hrs/yr</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </section>

      <section className="mt-10 pt-6 border-t border-midnight/10">
        <p className="eyebrow !text-burnt">metadata</p>
        <dl className="mt-3 grid grid-cols-12 gap-x-4 gap-y-2 text-[11px]">
          <dt className="col-span-3 text-clay">received at</dt>
          <dd className="col-span-9 text-midnight tabular-nums">{new Date(detail.receivedAt).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'medium' })}</dd>
          {detail.ua && (<><dt className="col-span-3 text-clay">user agent</dt><dd className="col-span-9 font-mono text-midnight break-all">{detail.ua}</dd></>)}
          {detail.ip && (<><dt className="col-span-3 text-clay">ip</dt><dd className="col-span-9 font-mono text-midnight">{detail.ip}</dd></>)}
          {detail.shareURL && (
            <>
              <dt className="col-span-3 text-clay">open in atelier</dt>
              <dd className="col-span-9">
                <a href={detail.shareURL} target="_blank" rel="noreferrer" className="text-midnight underline underline-offset-4 decoration-laser decoration-2 break-all hover:decoration-midnight">
                  {detail.shareURL}
                </a>
              </dd>
            </>
          )}
        </dl>
      </section>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="p-3 border border-midnight/15 rounded-sm bg-pearl">
      <div className="flex items-center gap-1.5 text-burnt">{icon}<span className="text-[10px] uppercase tracking-widish">{label}</span></div>
      <p className="font-display text-2xl text-midnight mt-1 tabular-nums">{value}</p>
    </div>
  );
}

function ModuleRequestsSection({ requests }: { requests: ModuleRequestItem[] }) {
  return (
    <section className="mt-20 pt-10 border-t border-midnight/15">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
        <div className="md:col-span-8">
          <p className="eyebrow">admin · feature requests</p>
          <h2 className="font-display text-display text-midnight mt-2 leading-tight">
            modules they wish existed.
          </h2>
        </div>
        <div className="md:col-span-4 md:text-right">
          <p className="text-burnt text-[14px] leading-relaxed max-w-md md:ml-auto">
            {requests.length === 0
              ? 'no custom-module requests yet.'
              : `${requests.length} request${requests.length === 1 ? '' : 's'} on record · newest first.`}
          </p>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="mt-10 py-16 text-center text-burnt">
          <p className="font-display text-xl italic mb-2">no requests yet.</p>
          <p className="text-sm text-clay">
            when someone submits the "request a custom module" form, it shows up here.
          </p>
        </div>
      ) : (
        <ul className="mt-10 space-y-3">
          {requests.map((r) => <ModuleRequestRow key={r.id} req={r} />)}
        </ul>
      )}
    </section>
  );
}

function ModuleRequestRow({ req }: { req: ModuleRequestItem }) {
  const [expanded, setExpanded] = useState(false);
  const section = req.sectionKey ? SECTION_BY_KEY.get(req.sectionKey) : undefined;
  return (
    <li className="border border-midnight/15 rounded-sm bg-pearl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-5 py-4 grid grid-cols-12 gap-4 hover:bg-bone/40 transition-colors"
      >
        <div className="col-span-12 md:col-span-5 flex items-start gap-3 min-w-0">
          <Plus size={14} className="text-midnight mt-1 shrink-0" />
          <div className="min-w-0">
            <p className="font-display text-base text-midnight leading-tight lowercase truncate">{req.name.toLowerCase()}</p>
            <p className="text-[11px] text-clay mt-0.5">
              {new Date(req.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
              {req.requestedBy && <span className="text-burnt"> · {req.requestedBy}</span>}
            </p>
          </div>
        </div>
        <div className="col-span-6 md:col-span-3 text-[12px] text-burnt italic clamp-2 leading-snug">
          {req.desiredOutcome ? `"${req.desiredOutcome}"` : <span className="text-clay/70">no outcome described</span>}
        </div>
        <div className="col-span-4 md:col-span-2 text-[11px] text-clay">
          {section ? <span>§{section.key} {section.name.toLowerCase()}</span> : <span className="italic">fsc to assign section</span>}
          {req.lifecyclePhase && (
            <span className="block mt-0.5 text-burnt">{req.lifecyclePhase.replace(/^\d+\.\s+/, '').toLowerCase()}</span>
          )}
        </div>
        <div className="col-span-2 md:col-span-2 flex items-center justify-end gap-2 text-[11px] text-burnt tabular-nums">
          {req.hoursSavedPerYear != null && <span>{req.hoursSavedPerYear} hrs/yr</span>}
          {expanded ? <ChevronDown size={14} className="text-clay" /> : <ChevronRight size={14} className="text-clay" />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 pt-1 border-t border-midnight/10 bg-bone/40">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <div>
              <p className="eyebrow !text-burnt mb-2">today</p>
              <p className="text-[13px] text-burnt leading-relaxed">
                {req.currentTool || <span className="italic text-clay">not described</span>}
              </p>
            </div>
            <div>
              <p className="eyebrow mb-2">with pontis</p>
              <p className="text-[13px] text-midnight leading-relaxed">
                {req.description || <span className="italic text-clay">not described</span>}
              </p>
            </div>
          </div>

          {req.dependencies.length > 0 && (
            <div className="mt-5">
              <p className="eyebrow !text-burnt mb-2">depends on</p>
              <ul className="flex flex-wrap gap-1.5">
                {req.dependencies.map((id) => {
                  const m = MODULE_BY_ID.get(id);
                  return (
                    <li key={id} className="px-2.5 py-1 bg-pearl border border-midnight/15 rounded-full text-[11px] text-midnight">
                      <span className="font-mono">{id}</span>
                      {m && <span className="text-burnt"> · {m.name.toLowerCase().slice(0, 40)}</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {req.notes && (
            <div className="mt-5">
              <p className="eyebrow !text-burnt mb-2">notes</p>
              <p className="text-[13px] text-burnt leading-relaxed whitespace-pre-line">{req.notes}</p>
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-midnight/10 text-[10px] text-clay font-mono">
            request id · {req.id}
          </div>
        </div>
      )}
    </li>
  );
}
