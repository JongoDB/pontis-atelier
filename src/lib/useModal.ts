import { useEffect, useId, useRef } from 'react';

// Modal plumbing every dialog in atelier needs:
//   1. Esc closes it
//   2. Background scroll is locked while it's open (otherwise the page scrolls
//      under the modal on mobile/trackpad)
//   3. A stable id for aria-labelledby wiring
//   4. Focus returns to whatever was focused when it opened (so keyboard users
//      don't lose their place in the page)
export function useModal(open: boolean, onClose: () => void) {
  const labelId = useId();
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.classList.add('modal-open');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('modal-open');
      // Return focus to the element that opened the modal, if it still exists.
      const opener = openerRef.current as HTMLElement | null;
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) {
        opener.focus();
      }
    };
  }, [open, onClose]);

  return { labelId };
}
