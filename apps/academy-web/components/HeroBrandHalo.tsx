'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react';

export function HeroBrandHalo({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const reducedMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, { stiffness: 120, damping: 20, mass: 0.4 });
  const y = useSpring(my, { stiffness: 120, damping: 20, mass: 0.4 });

  useEffect(() => {
    if (reducedMotion) return;
    const hero = rootRef.current?.closest('.academy-hero') as HTMLElement | null;
    if (!hero) return;

    const onMove = (e: PointerEvent) => {
      const rect = hero.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      mx.set(nx * 12);
      my.set(ny * 8);
    };

    const onLeave = () => {
      mx.set(0);
      my.set(0);
    };

    hero.addEventListener('pointermove', onMove);
    hero.addEventListener('pointerleave', onLeave);
    return () => {
      hero.removeEventListener('pointermove', onMove);
      hero.removeEventListener('pointerleave', onLeave);
    };
  }, [mx, my, reducedMotion]);

  return (
    <span
      ref={rootRef}
      className="academy-hero-line academy-hero-line-emphasis"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="academy-hero-brand-text">
        <motion.span
          aria-hidden="true"
          className="academy-hero-halo"
          style={{ x, y }}
          animate={
            reducedMotion || !hovered
              ? { scale: 1, filter: 'brightness(1)' }
              : { scale: 1.08, filter: 'brightness(1.1)' }
          }
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          <span className="academy-hero-halo-pulse">
            <span className="academy-hero-halo-glow" />
          </span>
        </motion.span>
        <span className="academy-hero-brand-glyph">{children}</span>
      </span>
    </span>
  );
}
