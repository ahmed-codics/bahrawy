'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { AnimatePresence, domAnimation, LazyMotion, m, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../utils';

export function MobileSheet({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';

    const sheet = sheetRef.current;
    const focusable = sheet?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusable?.[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, [onClose, open]);

  return (
    <AnimatePresence>
      {open && (
        <LazyMotion features={domAnimation}>
          <m.div
            className="fixed inset-0 z-[70]"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
          >
            <button
              type="button"
              className="absolute inset-0 size-full bg-black/55"
              aria-label="إغلاق النافذة"
              onClick={onClose}
            />
            <m.div
              ref={sheetRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={description ? descriptionId : undefined}
              className={cn(
                'absolute inset-x-0 bottom-0 max-h-[min(88dvh,44rem)] overflow-y-auto rounded-t-[1.75rem] border border-b-0 border-border bg-surface px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-[var(--shadow-xl)] sm:inset-x-auto sm:bottom-4 sm:left-1/2 sm:w-[min(32rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:rounded-[1.75rem] sm:border',
                className,
              )}
              initial={reduceMotion ? false : { y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-border-2 sm:hidden" />
              <div className="sticky top-0 z-10 flex items-start justify-between gap-4 bg-surface pb-4">
                <div className="min-w-0">
                  <h2 id={titleId} className="font-heading text-xl font-black text-ink">
                    {title}
                  </h2>
                  {description && (
                    <p id={descriptionId} className="mt-1 text-sm text-ink-3">
                      {description}
                    </p>
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} aria-label="إغلاق">
                  <X className="size-5" />
                </Button>
              </div>
              {children}
            </m.div>
          </m.div>
        </LazyMotion>
      )}
    </AnimatePresence>
  );
}
