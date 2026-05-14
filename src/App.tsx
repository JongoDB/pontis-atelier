import { Suspense, lazy, useEffect, useState } from 'react';
import { Chrome, Footer, MobileNav } from './components/Chrome';
import { ModuleBrowser } from './components/ModuleBrowser';
import { useStore } from './store';
import { SharedPlanBanner } from './components/Share';
import { track } from './lib/telemetry';
import { draftSync } from './lib/sync';

// Lazy-load the routes and modals that aren't on the critical path. The
// initial bundle then only carries Chrome + ModuleBrowser + ModuleCard, which
// is what a first-time visitor actually sees while the rest streams in.
const PlanPage = lazy(() =>
  import('./components/PlanSummary').then((m) => ({ default: m.PlanPage }))
);
const HeyPontis = lazy(() =>
  import('./components/HeyPontis').then((m) => ({ default: m.HeyPontis }))
);
const About = lazy(() =>
  import('./components/About').then((m) => ({ default: m.About }))
);
const Splash = lazy(() =>
  import('./components/Splash').then((m) => ({ default: m.Splash }))
);
const AdminPage = lazy(() =>
  import('./components/Admin').then((m) => ({ default: m.AdminPage }))
);
const FscRecommended = lazy(() =>
  import('./components/FscRecommended').then((m) => ({ default: m.FscRecommended }))
);

type Page = 'browse' | 'fsc' | 'plan' | 'about';

export function App() {
  // Pathname-based routing for the admin surface. /admin renders a different
  // top-level component entirely (its own chrome, password gate, snapshot
  // list). Anything else is the regular Atelier app.
  const isAdminRoute =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');

  if (isAdminRoute) {
    return (
      <Suspense fallback={null}>
        <AdminPage />
      </Suspense>
    );
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

  // Boot draft sync — pulls the current canonical draft from the server, then
  // keeps the store in sync with debounced PUTs. Falls back to localStorage-only
  // if the backend is unreachable.
  useEffect(() => {
    draftSync.boot();
    // Best-effort flush right before tab close
    const onUnload = () => { void draftSync.flush(); };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);

  return (
    <div className="min-h-full bg-pearl bg-drafting flex flex-col">
      <Suspense fallback={null}>
        {splashOpen && (
          <Splash
            onChoose={handleSplashChoice}
            onSkip={() => {
              dismissWelcome();
              setSplashOpen(false);
            }}
          />
        )}
      </Suspense>

      <SharedPlanBanner />

      <Chrome
        active={page}
        onNavigate={handleNavigate}
        selectedCount={selectedOrder.length}
        onOpenPlanner={() => setAskOpen(true)}
      />

      <main id="main-content" className="grow" tabIndex={-1}>
        {page === 'browse' && <ModuleBrowser />}
        {page === 'fsc' && (
          <Suspense fallback={<PageFallback />}>
            <FscRecommended onGoToPlan={() => setPage('plan')} />
          </Suspense>
        )}
        {page === 'plan' && (
          <Suspense fallback={<PageFallback />}>
            <PlanPage />
          </Suspense>
        )}
      </main>

      <Footer />

      <MobileNav active={page} onNavigate={handleNavigate} selectedCount={selectedOrder.length} />
      <Suspense fallback={null}>
        <HeyPontis open={askOpen} onClose={() => setAskOpen(false)} />
        <About open={aboutOpen} onClose={() => setAboutOpen(false)} />
      </Suspense>
    </div>
  );
}

// Soft loading state for lazy-loaded pages. Whitespace, not a spinner — chunks
// arrive in tens of milliseconds on a warm cache; a spinner would just flicker.
function PageFallback() {
  return (
    <div className="px-6 md:px-10 py-20 max-w-3xl mx-auto text-center">
      <p className="eyebrow !text-clay/70">loading…</p>
    </div>
  );
}

// The Gantt now lives inside the Plan page (with the cost panel beside it).
// No standalone Gantt route — it's the same data, one fewer click.
