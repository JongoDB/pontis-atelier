import { useEffect, useState } from 'react';
import { Chrome, Footer, MobileNav } from './components/Chrome';
import { ModuleBrowser } from './components/ModuleBrowser';
import { PlanPage } from './components/PlanSummary';
import { Gantt } from './components/Gantt';
import { HeyPontis } from './components/HeyPontis';
import { About } from './components/About';
import { Splash } from './components/Splash';
import { useStore } from './store';
import { CostPanel } from './components/CostPanel';
import { SharedPlanBanner } from './components/Share';
import { track } from './lib/telemetry';

type Page = 'browse' | 'plan' | 'gantt' | 'about';

export function App() {
  const hasOpenedBefore = useStore((s) => s.hasOpenedBefore);
  const dismissWelcome = useStore((s) => s.dismissWelcome);
  const selectedOrder = useStore((s) => s.selectedOrder);

  const [page, setPage] = useState<Page>('browse');
  const [askOpen, setAskOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [splashOpen, setSplashOpen] = useState(!hasOpenedBefore);

  useEffect(() => {
    // Page transition: scroll to top
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    track('page-view', { page });
  }, [page]);

  const handleSplashChoice = (target: 'browse' | 'plan' | 'gantt' | 'ask') => {
    dismissWelcome();
    setSplashOpen(false);
    if (target === 'ask') {
      setPage('browse');
      setAskOpen(true);
    } else {
      setPage(target);
    }
  };

  const handleNavigate = (s: Page) => {
    setPage(s);
    if (s === 'about') {
      setAboutOpen(true);
      setPage('browse'); // keep underlying view stable
    }
  };

  return (
    <div className="min-h-full bg-pearl bg-drafting flex flex-col">
      {splashOpen && (
        <Splash
          onChoose={handleSplashChoice}
          onSkip={() => {
            dismissWelcome();
            setSplashOpen(false);
          }}
        />
      )}

      <SharedPlanBanner />

      <Chrome
        active={page}
        onNavigate={handleNavigate}
        selectedCount={selectedOrder.length}
        onOpenPlanner={() => setAskOpen(true)}
      />

      <main className="grow">
        {page === 'browse' && <ModuleBrowser />}
        {page === 'plan' && <PlanPage />}
        {page === 'gantt' && <GanttPage />}
      </main>

      <Footer />

      <MobileNav active={page} onNavigate={handleNavigate} selectedCount={selectedOrder.length} />
      <HeyPontis open={askOpen} onClose={() => setAskOpen(false)} />
      <About open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  );
}

function GanttPage() {
  return (
    <div className="px-6 md:px-10 py-10 md:py-14 max-w-[1600px] mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
        <div className="md:col-span-7">
          <p className="eyebrow">gantt · the build, drawn</p>
          <h1 className="font-display text-display-lg text-midnight mt-2">
            what lands when.<br />
            <span className="italic font-light text-burnt">drag · defer · sketch.</span>
          </h1>
        </div>
        <div className="md:col-span-5 text-burnt text-[15px] leading-relaxed max-w-md md:justify-self-end">
          fsc's suggested sequence honors dependencies — voice flows need their pipeline, dashboards need their foundation.
          drag a row to reorder. click the defer icon to push it to next quarter and watch the gantt redraw.
        </div>
      </div>

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8">
          <Gantt />
        </div>
        <aside className="lg:col-span-4 border border-midnight/15 rounded-sm bg-pearl">
          <CostPanel />
        </aside>
      </div>
    </div>
  );
}
