import { useEffect, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { Wordmark } from './Wordmark';
import { cn } from '../lib/cn';
import { COUNTS, GENERATED_AT } from '../data/data';
import { TENANT } from '../tenant.config';

export type Section = 'browse' | 'plan' | 'about';

interface ChromeProps {
  active: Section;
  onNavigate: (s: Section) => void;
  selectedCount: number;
  onOpenPlanner: () => void;
}

const NAV: { key: Section; label: string; sub: string }[] = [
  { key: 'browse',  label: 'modules',      sub: String(COUNTS.total) },
  { key: 'plan',    label: 'my plan',      sub: '·' },
  { key: 'about',   label: 'about',        sub: '·' },
];

export function Chrome({ active, onNavigate, selectedCount, onOpenPlanner }: ChromeProps) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 backdrop-blur-sm bg-pearl/85 transition-shadow no-print',
        scrolled && 'shadow-[0_1px_0_rgba(33,65,68,0.08)]'
      )}
    >
      <div className="mx-auto max-w-[1600px] flex items-center justify-between gap-6 px-6 md:px-10 py-4 md:py-5">
        <div className="flex items-center gap-8">
          <button
            type="button"
            onClick={() => onNavigate('browse')}
            className="cursor-pointer focus:outline-none"
            aria-label="Pontis Atelier home"
          >
            <Wordmark />
          </button>
          <div className="hidden md:flex items-baseline gap-1.5 ml-2 pl-6 border-l border-midnight/15">
            <span className="eyebrow !text-burnt/80">where pontis takes shape</span>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((item) => {
            const isActive = item.key === active;
            const cnt = item.key === 'plan' ? selectedCount.toString() : item.sub;
            return (
              <button
                key={item.key}
                onClick={() => onNavigate(item.key)}
                className={cn(
                  'group relative px-4 py-2 text-sm font-medium tracking-tight transition-colors',
                  isActive ? 'text-midnight' : 'text-burnt hover:text-midnight'
                )}
              >
                <span>{item.label}</span>
                <span className={cn(
                  'ml-1.5 text-[0.625rem] tabular-nums',
                  isActive ? 'text-midnight/70' : 'text-clay/60'
                )}>
                  {cnt}
                </span>
                {isActive && (
                  <span className="absolute left-3 right-3 -bottom-1 h-px bg-midnight animate-sweep" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('atelier:restart-walkthrough'))}
            className="hidden md:flex items-center justify-center w-9 h-9 rounded-full text-burnt hover:text-midnight hover:bg-bone/50 transition-colors"
            title="show me the walkthrough again"
            aria-label="Restart walkthrough"
          >
            <HelpCircle size={15} />
          </button>
          <button
            type="button"
            onClick={onOpenPlanner}
            className="group flex items-center gap-2 rounded-full bg-midnight text-pearl px-4 py-2 text-sm font-medium tracking-tight transition-all hover:bg-ink hover:pl-3 hover:pr-5"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-laser animate-pulseDot" />
            <span className="hidden sm:inline">hey pontis…</span>
            <span className="sm:hidden">ask</span>
          </button>
        </div>
      </div>
      <div className="mx-auto max-w-[1600px] px-6 md:px-10">
        <div className="hairline" />
      </div>
    </header>
  );
}

// Mobile bottom nav — rendered outside the sticky header so the bg-backdrop-filter
// stacking context on the header doesn't fight with `position: fixed`.
export function MobileNav({
  active, onNavigate, selectedCount,
}: { active: Section; onNavigate: (s: Section) => void; selectedCount: number }) {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-pearl border-t border-midnight/15 flex items-stretch no-print">
      {NAV.map((item) => {
        const isActive = item.key === active;
        const cnt = item.key === 'plan' ? selectedCount.toString() : item.sub;
        return (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            className={cn(
              'relative flex-1 flex flex-col items-center justify-center py-2.5 px-1 transition-colors',
              isActive ? 'text-midnight' : 'text-burnt'
            )}
          >
            <span className="text-[12px] tracking-tight">{item.label}</span>
            <span className={cn(
              'text-[9px] tabular-nums mt-0.5',
              isActive ? 'text-midnight/70' : 'text-clay/60'
            )}>
              {cnt}
            </span>
            {isActive && <span className="absolute bottom-0 h-0.5 w-8 bg-midnight" />}
          </button>
        );
      })}
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="mt-20 mb-14 md:mb-0 border-t border-midnight/15 bg-pearl no-print">
      <div className="mx-auto max-w-[1600px] px-6 md:px-10 py-10 md:py-14 grid gap-8 md:grid-cols-12">
        <div className="md:col-span-5">
          <Wordmark />
          <p className="mt-5 text-sm leading-relaxed text-burnt max-w-md font-light italic">
            pontis <span className="not-italic text-clay">·</span> latin: of the bridge.&nbsp;&nbsp;
            atelier <span className="not-italic text-clay">·</span> french: the workshop.
            <br />ĒSO's drafting table for what pontis becomes.
          </p>
        </div>
        <div className="md:col-span-3">
          <p className="eyebrow mb-3">{TENANT.footer.humanLabel}</p>
          <a
            href={`mailto:${TENANT.footer.humanValue}`}
            className="text-sm text-midnight hover:underline underline-offset-4 decoration-laser decoration-2"
          >
            {TENANT.footer.humanValue}
          </a>
        </div>
        <div className="md:col-span-2">
          <p className="eyebrow mb-3">{TENANT.footer.builtByLabel}</p>
          <p className="text-sm text-midnight">{TENANT.footer.builtByName}</p>
          <p className="text-xs text-clay mt-1">{TENANT.footer.builtByFor}</p>
        </div>
        <div className="md:col-span-2 text-right">
          <p className="eyebrow mb-3">version</p>
          <p className="text-sm text-midnight tabular-nums">v1 · {new Date(GENERATED_AT).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
          <p className="text-xs text-clay mt-1 tabular-nums">{COUNTS.total} modules · {COUNTS.sections} sections</p>
        </div>
      </div>
      <div className="border-t border-midnight/10">
        <div className="mx-auto max-w-[1600px] px-6 md:px-10 py-5 flex flex-wrap items-center justify-between gap-3 text-xs text-clay">
          <span>
            want to bring pontis to another A+E firm you respect?  <a href={`mailto:${TENANT.contactEmail}?subject=Pontis%20Marketplace`} className="text-midnight hover:underline underline-offset-4">tell us about them</a>.
            <span className="text-clay/50 mx-2">·</span>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('atelier:restart-walkthrough'))}
              className="text-burnt hover:text-midnight underline underline-offset-4 decoration-clay/40"
            >
              show me the walkthrough again
            </button>
          </span>
          <span className="font-mono tracking-tight">© 2026 FSC</span>
        </div>
      </div>
    </footer>
  );
}
