import { useEffect } from 'react';
import { Compass, LayoutGrid, GanttChart, Sparkles } from 'lucide-react';
import { useStore } from '../store';
import { EsoMark } from './Wordmark';

interface SplashProps {
  onChoose: (target: 'browse' | 'plan' | 'gantt' | 'ask') => void;
  onSkip: () => void;
}

export function Splash({ onChoose, onSkip }: SplashProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onSkip();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSkip]);

  return (
    <div className="fixed inset-0 z-50 bg-pearl bg-drafting overflow-y-auto">
      <div className="min-h-full flex flex-col">
        <header className="flex items-center justify-between px-6 md:px-10 py-6">
          <div className="flex items-center gap-3">
            <EsoMark size={22} />
            <p className="eyebrow !tracking-[0.28em]">pontis atelier · welcome</p>
          </div>
          <button onClick={onSkip} className="text-xs text-burnt hover:text-midnight transition-colors">
            skip intro →
          </button>
        </header>

        <main className="grow flex items-center justify-center px-6 md:px-10 py-12">
          <div className="max-w-[1100px] w-full grid grid-cols-12 gap-6 md:gap-10">
            <div className="col-span-12 md:col-span-7">
              <p className="eyebrow !text-burnt mb-5 animate-fade">where pontis takes shape</p>
              <h1 className="font-display text-display-xl text-midnight tracking-tight leading-[0.95] animate-riseIn">
                let's pick what<br />
                <span className="italic font-light text-burnt">pontis is to you.</span>
              </h1>
              <div className="mt-9 space-y-4 max-w-xl text-burnt text-[15px] leading-relaxed animate-riseIn" style={{ animationDelay: '120ms' }}>
                <p>
                  <span className="font-medium text-midnight">pontis</span> <span className="text-clay">·</span> latin <span className="text-clay">·</span> of the bridge. the platform fsc is
                  building to bridge ĒSO's day — monograph, hubspot, scattered word templates, voice memos that disappear — into a single, coherent place.
                </p>
                <p>
                  <span className="font-medium text-midnight">atelier</span> <span className="text-clay">·</span> french <span className="text-clay">·</span> the workshop where ĒSO decides what pontis becomes.
                </p>
                <p className="text-midnight pt-2 border-t border-midnight/10">
                  101 modules to choose from. select what you want, defer what can wait, reorder the build.
                  the cost and gantt redraw as you sketch. nothing's committed until you say so.
                </p>
              </div>
            </div>
            <div className="col-span-12 md:col-span-5">
              <div className="flex flex-col gap-2 md:mt-16 animate-riseIn" style={{ animationDelay: '240ms' }}>
                <p className="eyebrow !text-clay mb-2">where would you like to start?</p>
                <SplashOption
                  icon={<LayoutGrid size={16} />}
                  title="browse the modules"
                  sub="all 101 · grouped by 14 pontis sections"
                  onClick={() => onChoose('browse')}
                />
                <SplashOption
                  icon={<Sparkles size={16} />}
                  title="ask hey pontis"
                  sub="describe what you want · we'll suggest a starting plan"
                  onClick={() => onChoose('ask')}
                  accent
                />
                <SplashOption
                  icon={<GanttChart size={16} />}
                  title="see the gantt"
                  sub="the timeline of everything if you said yes to it all"
                  onClick={() => onChoose('gantt')}
                />
                <SplashOption
                  icon={<Compass size={16} />}
                  title="open my saved plan"
                  sub="whatever's already in your tray"
                  onClick={() => onChoose('plan')}
                />
              </div>
            </div>
          </div>
        </main>

        <footer className="px-6 md:px-10 pb-6 text-[11px] text-clay italic">
          pontis · latin: of the bridge.  ·  atelier · french: the workshop.  ·  ĒSO's drafting table for what pontis becomes.
        </footer>
      </div>
    </div>
  );
}

function SplashOption({
  icon, title, sub, onClick, accent,
}: {
  icon: React.ReactNode; title: string; sub: string; onClick: () => void; accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group text-left flex items-center gap-4 p-4 border ${accent ? 'border-midnight bg-midnight text-pearl hover:bg-ink' : 'border-midnight/15 bg-pearl hover:border-midnight'} transition-all rounded-sm`}
    >
      <span className={`${accent ? 'text-laser' : 'text-burnt group-hover:text-midnight'} transition-colors`}>{icon}</span>
      <span className="flex-1 min-w-0">
        <span className={`block text-[14px] font-medium ${accent ? 'text-pearl' : 'text-midnight'}`}>{title.toLowerCase()}</span>
        <span className={`block text-[11px] mt-0.5 ${accent ? 'text-pearl/60' : 'text-clay'}`}>{sub}</span>
      </span>
      <span className={accent ? 'text-laser' : 'text-clay group-hover:text-midnight'}>→</span>
    </button>
  );
}
