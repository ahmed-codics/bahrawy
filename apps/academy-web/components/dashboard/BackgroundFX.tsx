'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';
import { HOLO_OBJECTS } from '../../lib/holograms';

const DEPTHS = [5, 10, 18, 28];
const LIGHT_SIZE = 680;

type CardPose = { h: number; rx: number; ry: number };
type MagPose = { x: number; y: number };

export function BackgroundFX({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const lightRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<Array<HTMLDivElement | null>>([]);
  const smoothRef = useRef({
    mx: 0,
    my: 0,
    tx: 0,
    ty: 0,
    lx: 0,
    ly: 0,
    ltx: 0,
    lty: 0,
  });

  useEffect(() => {
    if (reduceMotion) return;

    const s = smoothRef.current;
    const cardCur = new Map<HTMLElement, CardPose>();
    const cardTgt = new Map<HTMLElement, CardPose>();
    const magCur = new Map<HTMLElement, MagPose>();
    const magTgt = new Map<HTMLElement, MagPose>();
    let hoveredCard: HTMLElement | null = null;
    let hoveredMag: HTMLElement | null = null;

    const onMove = (e: PointerEvent) => {
      const { clientX, clientY } = e;
      s.tx = (clientX / window.innerWidth) * 2 - 1;
      s.ty = (clientY / window.innerHeight) * 2 - 1;
      s.ltx = clientX;
      s.lty = clientY;
      if (lightRef.current) lightRef.current.style.opacity = '1';

      const target = e.target as HTMLElement | null;
      const card = (target?.closest?.('.living-card') as HTMLElement | null) ?? null;
      if (card !== hoveredCard) {
        if (hoveredCard) {
          const t = cardTgt.get(hoveredCard);
          if (t) t.h = 0;
        }
        hoveredCard = card;
      }
      if (card) {
        const r = card.getBoundingClientRect();
        const px = (clientX - r.left) / r.width;
        const py = (clientY - r.top) / r.height;
        card.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
        card.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
        if (!cardCur.has(card)) cardCur.set(card, { h: 0, rx: 0, ry: 0 });
        cardTgt.set(card, { h: 1, rx: -((py - 0.5) * 6), ry: (px - 0.5) * 6 });
      }

      const mag = (target?.closest?.('.magnetic-btn') as HTMLElement | null) ?? null;
      if (mag !== hoveredMag) {
        if (hoveredMag) {
          const t = magTgt.get(hoveredMag);
          if (t) {
            t.x = 0;
            t.y = 0;
          }
          hoveredMag.classList.remove('is-near');
        }
        hoveredMag = mag;
      }
      if (mag) {
        const r = mag.getBoundingClientRect();
        const dx = clientX - (r.left + r.width / 2);
        const dy = clientY - (r.top + r.height / 2);
        const dist = Math.hypot(dx, dy);
        const cx = (dx / r.width) * 100;
        const cy = (dy / r.height) * 100;
        mag.style.setProperty('--mx', `${50 + cx}%`);
        mag.style.setProperty('--my', `${50 + cy}%`);
        if (dist < 120) {
          const f = (1 - dist / 120) * 8;
          const u = dist || 1;
          if (!magCur.has(mag)) magCur.set(mag, { x: 0, y: 0 });
          magTgt.set(mag, { x: (dx / u) * f, y: (dy / u) * f });
          mag.classList.add('is-near');
        } else {
          magTgt.set(mag, { x: 0, y: 0 });
          mag.classList.remove('is-near');
        }
      }
    };

    const onLeave = () => {
      s.tx = 0;
      s.ty = 0;
      if (hoveredCard) {
        const t = cardTgt.get(hoveredCard);
        if (t) t.h = 0;
        hoveredCard = null;
      }
      if (hoveredMag) {
        const t = magTgt.get(hoveredMag);
        if (t) {
          t.x = 0;
          t.y = 0;
        }
        hoveredMag.classList.remove('is-near');
        hoveredMag = null;
      }
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', onLeave);

    let raf = 0;
    const tick = () => {
      s.mx += (s.tx - s.mx) * 0.07;
      s.my += (s.ty - s.my) * 0.07;
      s.lx += (s.ltx - s.lx) * 0.11;
      s.ly += (s.lty - s.ly) * 0.11;

      if (lightRef.current) {
        lightRef.current.style.transform = `translate3d(${s.lx - LIGHT_SIZE / 2}px, ${
          s.ly - LIGHT_SIZE / 2
        }px, 0)`;
      }

      layersRef.current.forEach((layer, i) => {
        if (!layer) return;
        layer.style.transform = `translate3d(${(-s.mx * DEPTHS[i]).toFixed(2)}px, ${(
          -s.my *
          DEPTHS[i] *
          0.6
        ).toFixed(2)}px, 0)`;
      });

      cardCur.forEach((cur, el) => {
        const t = cardTgt.get(el);
        const th = t?.h ?? 0;
        const trx = t?.rx ?? 0;
        const tryy = t?.ry ?? 0;
        cur.h += (th - cur.h) * 0.18;
        cur.rx += (trx - cur.rx) * 0.18;
        cur.ry += (tryy - cur.ry) * 0.18;
        el.style.transform = `perspective(1200px) translateY(${(-6 * cur.h).toFixed(2)}px) scale(${(
          1 +
          0.02 * cur.h
        ).toFixed(4)}) rotateX(${cur.rx.toFixed(2)}deg) rotateY(${cur.ry.toFixed(2)}deg)`;
        if (
          cur.h < 0.02 &&
          Math.abs(cur.rx) < 0.06 &&
          Math.abs(cur.ry) < 0.06 &&
          el !== hoveredCard
        ) {
          cardCur.delete(el);
          cardTgt.delete(el);
          el.style.transform = '';
        }
      });

      magCur.forEach((cur, el) => {
        const t = magTgt.get(el);
        const tx = t?.x ?? 0;
        const ty = t?.y ?? 0;
        cur.x += (tx - cur.x) * 0.16;
        cur.y += (ty - cur.y) * 0.16;
        el.style.transform = `translate3d(${cur.x.toFixed(2)}px, ${cur.y.toFixed(2)}px, 0)`;
        if (Math.abs(cur.x) < 0.05 && Math.abs(cur.y) < 0.05 && el !== hoveredMag) {
          magCur.delete(el);
          magTgt.delete(el);
          el.style.transform = '';
        }
      });

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      cancelAnimationFrame(raf);
      cardCur.forEach((_, el) => {
        el.style.transform = '';
      });
      magCur.forEach((_, el) => {
        el.style.transform = '';
        el.classList.remove('is-near');
      });
    };
  }, [reduceMotion]);

  return (
    <>
      <div className="holo-field" aria-hidden="true">
        {[0, 1, 2, 3].map((depth) => (
          <div
            key={depth}
            ref={(el) => {
              layersRef.current[depth] = el;
            }}
            className="holo-layer"
          >
            {HOLO_OBJECTS.filter((o) => o.depth === depth + 1).map((o) => (
              <span
                key={o.id}
                className="holo-object"
                style={
                  {
                    left: `${o.x}%`,
                    top: `${o.y}%`,
                    fontSize: `${o.size}px`,
                    '--holo-rot': `${o.rotate}deg`,
                    animationDuration: `${o.duration}s`,
                    animationDelay: `${o.delay}s`,
                  } as React.CSSProperties
                }
              >
                {o.glyph}
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className="ambient-field" aria-hidden="true" />
      <div ref={lightRef} className="mouse-light" aria-hidden="true" />
      {children}
    </>
  );
}
