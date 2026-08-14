'use client';

import { useEffect, useState } from 'react';

/**
 * Roving, variable-opacity watermark overlay.
 *
 * Purpose: a static badge in one corner can be cropped out of a single
 * captured frame. Moving it around the frame and varying its opacity means
 * most screen recordings / screenshots still contain an account-bound
 * identifier somewhere on screen, which is what makes a leak traceable.
 *
 * Deterrence only — a determined user can always crop it. It is intentionally
 * non-interactive (pointer-events-none, select-none) and never blocks the
 * player's own controls, so accessibility (keyboard, screen readers) is
 * preserved.
 */
const WAYPOINTS = [
  { top: '6%', left: '5%', opacity: 0.35 },
  { top: '8%', left: '70%', opacity: 0.6 },
  { top: '55%', left: '80%', opacity: 0.3 },
  { top: '58%', left: '12%', opacity: 0.55 },
  { top: '30%', left: '45%', opacity: 0.45 },
] as const;

const STEP_MS = 1400;

export function AnimatedWatermark({ text }: { text: string }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % WAYPOINTS.length);
    }, STEP_MS);
    return () => clearInterval(timer);
  }, []);

  const waypoint = WAYPOINTS[index];

  return (
    <span
      dir="ltr"
      aria-hidden="true"
      className="pointer-events-none absolute z-10 select-none rounded-md bg-black/35 px-2 py-0.5 text-[11px] font-bold tracking-wider text-white/70 backdrop-blur-sm transition-[left,top,opacity] duration-700 ease-in-out"
      style={{
        left: waypoint.left,
        top: waypoint.top,
        opacity: waypoint.opacity,
      }}
    >
      {text}
    </span>
  );
}