import { useEffect, useLayoutEffect, useState } from 'react';
import { X, ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { cn } from '../lib/cn';
import { TOURS, type TourId, type TourStep } from '../lib/tour';

interface TourProps {
  id: TourId;
  onClose: () => void;
  /** Called when a step's onEnter hook fires; lets the parent open/close other UI. */
  onSideEffect?: (effect: NonNullable<TourStep['onEnter']>) => void;
}

interface AnchorRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const RING_PADDING = 6;     // px of breathing room around the anchor ring
const CAPTION_GAP = 12;     // gap between anchor and caption card
const CAPTION_W = 360;      // caption card width (px) — tight but readable

export function Tour({ id, onClose, onSideEffect }: TourProps) {
  const tour = TOURS[id];
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<AnchorRect | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  const total = tour.steps.length;
  const current = tour.steps[step];

  // Trigger side effects on step transitions (open / close hey pontis modal).
  useEffect(() => {
    if (current?.onEnter && onSideEffect) onSideEffect(current.onEnter);
  }, [step, current?.onEnter, onSideEffect]);

  // Recompute anchor rect on step change, scroll, resize, and via a brief
  // retry tick — the anchor element may mount a frame after the step changes
  // (lazy-loaded modals, etc.), so we re-query for ~500ms after step change.
  useLayoutEffect(() => {
    if (!current) return;
    if (current.anchor == null) {
      setRect(null);
      return;
    }

    const measure = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${current.anchor}"]`);
      if (!el) {
        setRect(null);
        return false;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      return true;
    };

    measure();

    // Retry loop for late-mounting anchors (e.g. modal-anchored steps that
    // open the modal on enter — the modal's children appear next tick).
    let cancelled = false;
    let tries = 0;
    const tick = () => {
      if (cancelled) return;
      tries += 1;
      const ok = measure();
      if (!ok && tries < 12) setTimeout(tick, 40);
    };
    setTimeout(tick, 40);

    return () => {
      cancelled = true;
    };
  }, [step, current, retryTick]);

  useEffect(() => {
    const onScroll = () => setRetryTick((t) => t + 1);
    const onResize = () => setRetryTick((t) => t + 1);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  // Auto-scroll anchored steps into view when the step changes.
  useEffect(() => {
    if (!current || current.anchor == null) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${current.anchor}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  }, [step, current]);

  // Keyboard: ←/→ to step, Esc to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  if (!current) return null;

  const goNext = () => {
    if (step + 1 >= total) {
      onClose();
    } else {
      setStep(step + 1);
    }
  };
  const goBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const captionPos = computeCaptionPos(rect, current.side ?? 'bottom');

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none" aria-live="polite">
      {/* Dimmed backdrop. Uses pointer-events: none so the user can still
          interact with the page — coachmarks shouldn't lock the UI. The
          caption card below re-enables pointer events on itself. */}
      <div className="absolute inset-0 bg-midnight/35" />

      {/* Anchor ring */}
      {rect && (
        <div
          aria-hidden="true"
          className="absolute rounded-sm ring-2 ring-laser shadow-[0_0_0_9999px_rgba(33,65,68,0.0)] animate-tourPulse"
          style={{
            top: rect.top - RING_PADDING,
            left: rect.left - RING_PADDING,
            width: rect.width + RING_PADDING * 2,
            height: rect.height + RING_PADDING * 2,
          }}
        />
      )}

      {/* Caption card */}
      <div
        role="dialog"
        aria-modal="false"
        aria-label={`walkthrough · step ${step + 1} of ${total}`}
        className="absolute pointer-events-auto bg-pearl border border-midnight rounded-sm shadow-2xl shadow-midnight/40"
        style={
          rect && captionPos
            ? { top: captionPos.top, left: captionPos.left, width: CAPTION_W, maxWidth: 'calc(100vw - 24px)' }
            : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: CAPTION_W, maxWidth: 'calc(100vw - 24px)' }
        }
      >
        <header className="flex items-center justify-between gap-3 px-4 pt-3 pb-2 border-b border-midnight/10">
          <div className="flex items-center gap-2">
            <Sparkles size={12} className="text-burnt" />
            <p className="eyebrow !tracking-[0.22em] !text-burnt">
              walkthrough · {tour.name}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Skip walkthrough"
            className="p-1 -mr-1 text-burnt hover:text-midnight transition-colors"
          >
            <X size={14} />
          </button>
        </header>
        <div className="px-4 pt-3 pb-4">
          <h3 className="font-display text-lg text-midnight leading-tight">
            {current.title}
          </h3>
          <p className="mt-2 text-[13px] text-burnt leading-relaxed">
            {current.body}
          </p>
        </div>
        <footer className="px-4 py-3 border-t border-midnight/10 flex items-center justify-between gap-2">
          <span className="text-[11px] text-clay tabular-nums">{step + 1} / {total}</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={goBack}
              disabled={step === 0}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[12px] text-burnt hover:text-midnight disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ArrowLeft size={12} /> back
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1.5 text-[12px] text-burnt hover:text-midnight"
            >
              skip
            </button>
            <button
              type="button"
              onClick={goNext}
              className={cn(
                'flex items-center gap-1 px-3 py-1.5 text-[12px] rounded-sm transition-colors',
                step + 1 >= total
                  ? 'bg-laser text-midnight hover:bg-laser/80'
                  : 'bg-midnight text-pearl hover:bg-ink'
              )}
            >
              {step + 1 >= total ? "i'm ready" : 'next'}
              <ArrowRight size={12} />
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function computeCaptionPos(
  rect: AnchorRect | null,
  preferredSide: 'top' | 'bottom'
): { top: number; left: number } | null {
  if (!rect) return null;
  if (typeof window === 'undefined') return null;

  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const CARD_H_ESTIMATE = 220;

  const spaceBelow = vh - (rect.top + rect.height);
  const spaceAbove = rect.top;

  let placeBelow: boolean;
  if (preferredSide === 'bottom') {
    placeBelow = spaceBelow >= CARD_H_ESTIMATE || spaceBelow >= spaceAbove;
  } else {
    placeBelow = spaceAbove < CARD_H_ESTIMATE && spaceBelow >= spaceAbove;
  }

  const top = placeBelow
    ? Math.min(rect.top + rect.height + CAPTION_GAP, vh - CARD_H_ESTIMATE - 12)
    : Math.max(12, rect.top - CARD_H_ESTIMATE - CAPTION_GAP);

  // Horizontal: align center of card with center of anchor, clamped to viewport.
  const idealLeft = rect.left + rect.width / 2 - CAPTION_W / 2;
  const left = Math.max(12, Math.min(idealLeft, vw - CAPTION_W - 12));

  return { top, left };
}
