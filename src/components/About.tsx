import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/cn';
import { EsoMark } from './Wordmark';

interface AboutProps {
  open: boolean;
  onClose: () => void;
}

export function About({ open, onClose }: AboutProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className={cn('fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8')}>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute inset-0 bg-midnight/40 backdrop-blur-sm animate-fade"
      />
      <article className="relative w-full max-w-2xl bg-pearl rounded-sm shadow-2xl shadow-midnight/30 animate-riseIn">
        <header className="flex items-start justify-between px-8 md:px-12 pt-10 pb-2 border-b border-midnight/10">
          <div className="flex items-center gap-3">
            <EsoMark size={28} />
            <p className="eyebrow !tracking-[0.28em]">pontis atelier</p>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 text-burnt hover:text-midnight transition-colors" aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="px-8 md:px-12 py-10 md:py-12">
          <h2 className="font-display text-3xl md:text-4xl tracking-tight leading-[1.05] text-midnight">
            where pontis takes shape.
          </h2>

          <div className="mt-9 space-y-7 text-[15px] leading-relaxed text-burnt">
            <p>
              <span className="font-medium text-midnight">pontis</span>
              <span className="text-clay"> · latin · </span>
              of the bridge. pontis bridges the disconnected pieces of ĒSO's day-to-day — monograph,
              hubspot, scattered word templates, lost comm threads, voice memos that disappear — into
              a single, coherent place.
            </p>
            <p>
              <span className="font-medium text-midnight">atelier</span>
              <span className="text-clay"> · french · </span>
              the workshop. in architecture, the room where a practice's identity and decisions take
              shape. atelier is the workspace where ĒSO decides what pontis becomes.
            </p>
            <p className="text-midnight">
              think of it as your drafting table for the platform itself. select what you want,
              defer what can wait, reorder the build, and watch the cost and timeline redraw as
              you sketch. nothing commits until you say so.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-3 gap-6 pt-7 border-t border-midnight/10">
            <div>
              <p className="eyebrow mb-2">browse</p>
              <p className="text-sm text-burnt">101 modules across 14 pontis sections. each one a decision.</p>
            </div>
            <div>
              <p className="eyebrow mb-2">decide</p>
              <p className="text-sm text-burnt">select, defer, reorder. cost + timeline recalculate live.</p>
            </div>
            <div>
              <p className="eyebrow mb-2">share</p>
              <p className="text-sm text-burnt">export a one-page plan for carli, jerry, the team.</p>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
