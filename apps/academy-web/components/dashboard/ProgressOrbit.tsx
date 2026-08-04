'use client';

import { useEffect, useRef } from 'react';

const RADIUS = 44;
const DOTS_A = [0, 72, 144, 216, 288];
const DOTS_B = [36, 108, 180, 252, 324];

export function ProgressOrbit() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.add('burst');
    const timer = setTimeout(() => el.classList.remove('burst'), 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div ref={ref} className="progress-orbit" aria-hidden="true">
      <span className="po-layer po-a">
        {DOTS_A.map((angle) => (
          <span
            key={angle}
            className="po-dot"
            style={{ transform: `translate(-50%, -50%) rotate(${angle}deg) translateX(${RADIUS}px)` }}
          />
        ))}
      </span>
      <span className="po-layer po-b">
        {DOTS_B.map((angle) => (
          <span
            key={angle}
            className="po-dot po-dot-sm"
            style={{ transform: `translate(-50%, -50%) rotate(${angle}deg) translateX(${RADIUS}px)` }}
          />
        ))}
      </span>
    </div>
  );
}
