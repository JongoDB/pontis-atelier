import { useEffect, useState } from 'react';
import { Chrome, Footer, MobileNav } from './components/Chrome';
import { ModuleBrowser } from './components/ModuleBrowser';
import { PlanPage } from './components/PlanSummary';
import { HeyPontis } from './components/HeyPontis';
import { About } from './components/About';
import { Splash } from './components/Splash';
import { useStore } from './store';
import { SharedPlanBanner } from './components/Share';
import { AdminPage } from './components/Admin';
import { track } from './lib/telemetry';

type Page = 'browse' | 'plan' | 'about';

export function App() {
  // Pathname-based routing for the admin surface. /admin renders a different
  // top-level component entirely (its own chrome, password gate, snapshot
  // list). Anything else is the regular Atelier app.
  const isAdminRoute =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');

  if (isAdminRoute) {
    return <AdminPage />;
  }

  return <AtelierApp />;
}

function AtelierApp() {
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

  const handleSplashChoice = (target: 'browse' | 'plan' | 'ask') => {
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
    if (s === 'about') {
      setAboutOpen(true);
      return;
    }
    setPage(s);
  };

  // Listen for the global "show me around again" event fired from About + Footer
  useEffect(() => {
    const onRestart = () => setSplashOpen(true);
    window.addEventListener('atelier:restart-walkthrough', onRestart);
    return () => window.removeEventListener('atelier:restart-walkthrough', onRestart);
  }, []);

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
      </main>

      <Footer />

      <MobileNav active={page} onNavigate={handleNavigate} selectedCount={selectedOrder.length} />
      <HeyPontis open={askOpen} onClose={() => setAskOpen(false)} />
      <About open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  );
}

// The Gantt now lives inside the Plan page (with the cost panel beside it).
// No standalone Gantt route — it's the same data, one fewer click.
