'use client';

import { useRef } from 'react';
import { animate, useReducedMotion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';

const REST_SHADOW = '0 8px 22px color-mix(in srgb, var(--academy-navy) 18%, transparent)';
const PRESS_SHADOW = '0 14px 34px color-mix(in srgb, var(--academy-navy) 30%, transparent)';
const IDLE_FILTER = 'blur(0px) drop-shadow(0px 0px 0px rgba(56, 189, 248, 0))';
const FLIGHT_FILTER = 'blur(1px) drop-shadow(0px 0px 9px rgba(56, 189, 248, 0.55))';

export function PremiumCtaButton({
  href = '#levels',
  className = '',
  children,
}: {
  href?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const anchorRef = useRef<HTMLAnchorElement>(null);
  const pressRef = useRef<HTMLSpanElement>(null);
  const arrowRef = useRef<HTMLSpanElement>(null);
  const trailRef = useRef<HTMLSpanElement>(null);
  const busyRef = useRef(false);
  const reducedMotion = useReducedMotion();

  async function runLaunch() {
    const btn = anchorRef.current;
    const press = pressRef.current;
    const arrow = arrowRef.current;
    const trail = trailRef.current;
    if (!btn || !press || !arrow || !trail) return;

    const btnRect = btn.getBoundingClientRect();
    const arrowRect = arrow.getBoundingClientRect();
    const padRight = Number.parseFloat(getComputedStyle(btn).paddingRight) || 0;
    const travel = Math.max(btnRect.right - padRight - arrowRect.width - arrowRect.left, 6);
    const overshoot = Math.max(travel * 0.04, 3);

    await animate(press, { scale: 0.98, boxShadow: PRESS_SHADOW }, { duration: 0.1, ease: 'easeOut' });

    await animate(arrow, { x: travel }, { duration: 0 });
    await animate(trail, { opacity: 0, scaleX: 0 }, { duration: 0 });
    await animate(arrow, { filter: IDLE_FILTER }, { duration: 0 });

    await new Promise((resolve) => setTimeout(resolve, 80));

    await Promise.all([
      animate(arrow, { x: 0 }, { duration: 0.26, ease: [0.22, 1, 0.36, 1] }),
      animate(trail, { opacity: [0, 0.9, 0.9], scaleX: [0, 1, 1] }, { duration: 0.26, ease: 'easeOut' }),
      animate(arrow, { filter: FLIGHT_FILTER }, { duration: 0.12, ease: 'easeOut' }),
    ]);

    await Promise.all([
      animate(arrow, { x: [-overshoot, 0] }, { duration: 0.08, ease: 'easeOut' }),
      animate(trail, { opacity: 0, scaleX: 0 }, { duration: 0.14, ease: 'easeIn' }),
    ]);

    await animate(arrow, { filter: IDLE_FILTER }, { duration: 0 });
    await animate(press, { scale: 1, boxShadow: REST_SHADOW }, { duration: 0.12, ease: 'easeOut' });
  }

  function navigate() {
    if (href.startsWith('#')) {
      const target = document.getElementById(href.slice(1));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (window.location.hash !== href) history.replaceState(null, '', href);
      } else {
        window.location.hash = href;
      }
      return;
    }
    window.location.assign(href);
  }

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (reducedMotion) return;
    if (busyRef.current) return;
    e.preventDefault();
    busyRef.current = true;
    void runLaunch().finally(() => {
      busyRef.current = false;
      navigate();
    });
  }

  return (
    <a
      ref={anchorRef}
      href={href}
      onClick={handleClick}
      className={`academy-button academy-button-lg academy-cta-launch${className ? ` ${className}` : ''}`}
    >
      <span ref={pressRef} className="academy-cta-press" aria-hidden="true" />
      <span className="academy-cta-label">{children}</span>
      <span ref={arrowRef} className="academy-cta-arrow">
        <ArrowLeft aria-hidden="true" />
        <span ref={trailRef} className="academy-cta-trail" aria-hidden="true" />
      </span>
    </a>
  );
}
