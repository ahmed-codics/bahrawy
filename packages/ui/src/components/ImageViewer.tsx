'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Minimal full-screen image lightbox. Rendered through a portal so it sits
 * above drawers and other layers, closes via the button, Escape, or clicking
 * outside the image, and restores focus on close. No heavy animation.
 */
export function ImageViewer({
  src,
  alt = '',
  onClose,
}: {
  src: string | null;
  alt?: string;
  onClose: () => void;
}) {
  const isOpen = Boolean(src);
  const onCloseRef = useRef(onClose);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previouslyFocused?.focus();
    };
  }, [isOpen]);

  if (typeof document === 'undefined' || !src) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/90 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={alt || 'عرض الصورة'}
      onClick={onClose}
    >
      <button
        ref={closeRef}
        type="button"
        aria-label="إغلاق"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        className="absolute end-4 top-4 flex size-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors duration-150 hover:bg-white/20"
      >
        <X className="size-5" aria-hidden="true" />
      </button>
      <img
        src={src}
        alt={alt}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[calc(100dvh-3rem)] max-w-full rounded-lg object-contain shadow-2xl"
      />
    </div>,
    document.body,
  );
}