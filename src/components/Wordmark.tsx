import { cn } from '../lib/cn';

interface WordmarkProps {
  className?: string;
  showEtymology?: boolean;
}

// ĒSO mark — bifurcated circle. Represents Balance, Completeness, Pragmatism + Creativity.
// Stripped to its essentials per the Brand Guide.
export function EsoMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="11" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 1.5 V 22.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="6.4" cy="12" r="2.4" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({ className, showEtymology = true }: WordmarkProps) {
  return (
    <div className={cn('flex items-center gap-3 text-midnight', className)}>
      <EsoMark size={22} />
      <div className="flex items-baseline gap-2 leading-none">
        <span
          className="etymology-trigger relative font-display text-[1.05rem] font-medium tracking-tight"
          tabIndex={showEtymology ? 0 : -1}
        >
          pontis
          {showEtymology && (
            <span className="etymology-tip">latin · of the bridge</span>
          )}
        </span>
        <span className="text-clay opacity-70 text-xs">/</span>
        <span
          className="etymology-trigger relative font-display text-[1.05rem] font-medium tracking-tight text-burnt"
          tabIndex={showEtymology ? 0 : -1}
        >
          atelier
          {showEtymology && (
            <span className="etymology-tip">french · the workshop where ĒSO decides what pontis becomes</span>
          )}
        </span>
      </div>
    </div>
  );
}
