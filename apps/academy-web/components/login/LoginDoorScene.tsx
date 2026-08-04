'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';

export type DoorScenePhase = 'verifying' | 'success' | 'failure';

const RUN = -125;
const ENTER = -178;

const SUCCESS_MS = 900;
const FAILURE_MS = 720;

export function LoginDoorScene({
  phase,
  onComplete,
}: {
  phase: DoorScenePhase;
  onComplete?: (phase: 'success' | 'failure') => void;
}) {
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (phase === 'success') {
      const timer = setTimeout(() => onCompleteRef.current?.('success'), SUCCESS_MS);
      return () => clearTimeout(timer);
    }
    if (phase === 'failure') {
      const timer = setTimeout(() => onCompleteRef.current?.('failure'), FAILURE_MS);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  const verifying = phase === 'verifying';
  const success = phase === 'success';
  const failure = phase === 'failure';

  return (
    <svg
      viewBox="0 0 210 48"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="طالب يقف أمام باب المدرسة"
    >
      <defs>
        <linearGradient id="doorLight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FEF3C7" />
          <stop offset="1" stopColor="#FDE68A" />
        </linearGradient>
        <radialGradient id="doorGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#38BDF8" stopOpacity="0.9" />
          <stop offset="1" stopColor="#38BDF8" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ── door ground shadow ── */}
      <ellipse cx="40" cy="44" rx="32" ry="4" fill="#09233F" opacity="0.12" />

      {/* ── unlock glow ── */}
      <motion.rect
        initial={false}
        x="0"
        y="2"
        width="80"
        height="44"
        rx="24"
        fill="url(#doorGlow)"
        animate={
          success
            ? { opacity: [0, 0.65, 0.2, 0], scale: [0.9, 1.04, 1, 1] }
            : { opacity: 0, scale: 1 }
        }
        transition={
          success
            ? { duration: 0.55, times: [0, 0.14, 0.32, 0.5], ease: 'easeOut' }
            : { duration: 0.1 }
        }
      />

      {/* ── door frame ── */}
      <rect x="6" y="4" width="68" height="40" rx="16" fill="#1E40AF" />
      <rect x="10" y="8" width="60" height="36" rx="12" fill="#0F1D31" />

      {/* ── warm light from inside ── */}
      <motion.rect
        initial={false}
        x="12"
        y="10"
        width="56"
        height="32"
        rx="10"
        fill="url(#doorLight)"
        animate={
          success
            ? { opacity: [0, 0, 1, 1, 0.2, 0], scale: [0.85, 0.85, 1, 1, 1, 0.96] }
            : { opacity: 0, scale: 0.85 }
        }
        transition={
          success
            ? {
                duration: 0.9,
                times: [0, 0.15, 0.35, 0.72, 0.86, 1],
                ease: 'easeInOut',
              }
            : { duration: 0.1 }
        }
      />

      {/* ── door panel (hinged) ── */}
      <motion.g
        initial={false}
        style={{ transformBox: 'fill-box', transformOrigin: 'left center' }}
        animate={
          success
            ? { rotateY: [0, -85, -85, 0] }
            : failure
              ? { rotateY: [0, -3, 3, -2, 2, -1, 0] }
              : { rotateY: 0 }
        }
        transition={
          success
            ? {
                duration: 0.9,
                times: [0, 0.17, 0.78, 1],
                ease: ['easeInOut', 'linear', 'easeInOut'],
              }
            : failure
              ? { duration: 0.72, times: [0, 0.38, 0.5, 0.62, 0.72, 0.84, 1], ease: 'easeInOut' }
              : { duration: 0.1 }
        }
      >
        <rect x="12" y="10" width="56" height="32" rx="10" fill="#2563EB" />
        <rect x="17" y="15" width="46" height="22" rx="8" fill="#3B82F6" opacity="0.55" />
        <rect x="33" y="17" width="16" height="8" rx="4" fill="#7DD3FC" opacity="0.5" />
        {/* handle — turns on unlock */}
        <motion.g
          initial={false}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          animate={success ? { rotate: [0, -50, -50, 0] } : { rotate: 0 }}
          transition={
            success
              ? { duration: 0.9, times: [0, 0.2, 0.75, 1], ease: 'easeInOut' }
              : { duration: 0.1 }
          }
        >
          <circle cx="60" cy="26" r="2.6" fill="#F59E0B" />
          <rect x="58.6" y="22.5" width="1.8" height="4" rx="0.9" fill="#F59E0B" />
        </motion.g>
      </motion.g>

      {/* ── student ── */}
      <motion.g
        initial={false}
        animate={
          success
            ? { x: [0, 0, RUN, ENTER], opacity: [1, 1, 1, 0] }
            : failure
              ? { x: [0, -118, -84, -84], opacity: 1 }
              : { x: 0, opacity: 1 }
        }
        transition={
          success
            ? {
                duration: 0.9,
                times: [0, 0.32, 0.72, 0.94],
                ease: ['linear', [0.36, 0, 0.66, 0.35], 'easeIn'],
              }
            : failure
              ? { duration: 0.72, times: [0, 0.34, 0.6, 1], ease: ['easeIn', 'easeOut', 'linear'] }
              : { duration: 0.1 }
        }
      >
        <motion.g
          initial={false}
          animate={
            verifying
              ? { y: [0, -1.6, 0] }
              : success
                ? { y: [0, 0, -2.5, -1.5, -2.5, 0], rotate: [0, 0, -5, -2, -3, 0] }
                : failure
                  ? {
                      scaleY: [1, 1, 1.06, 1, 1],
                      scaleX: [1, 1, 0.94, 1, 1],
                      rotate: [0, 0, 0, 0, -5, 5, -3, 0],
                    }
                  : {}
          }
          transition={
            verifying
              ? { duration: 1.4, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }
              : success
                ? { duration: 0.9, times: [0, 0.34, 0.5, 0.66, 0.82, 1], ease: 'easeInOut' }
                : failure
                  ? {
                      duration: 0.72,
                      times: [0, 0.34, 0.46, 0.58, 0.68, 0.8, 0.9, 1],
                      ease: 'easeInOut',
                    }
                  : { duration: 0.1 }
          }
        >
          {/* shadow rides with the student */}
          <ellipse cx="165" cy="44" rx="22" ry="3.5" fill="#09233F" opacity="0.12" />

          {/* backpack (behind body, secondary motion) */}
          <motion.g
            initial={false}
            style={{ transformBox: 'fill-box', transformOrigin: 'top left' }}
            animate={
              success
                ? { rotate: [0, 0, -10, 6, -8, 0] }
                : failure
                  ? { rotate: [0, 0, -7, 0] }
                  : { rotate: [0, -1.5, 0] }
            }
            transition={
              success
                ? { duration: 0.9, times: [0, 0.34, 0.5, 0.66, 0.82, 1], ease: 'easeInOut' }
                : failure
                  ? { duration: 0.72, times: [0, 0.42, 0.6, 1], ease: 'easeInOut' }
                  : { duration: 1.4, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }
            }
          >
            <rect x="176" y="18" width="11" height="18" rx="5" fill="#38BDF8" />
            <rect x="176" y="24" width="11" height="3" rx="1.5" fill="#2563EB" opacity="0.4" />
          </motion.g>

          {/* legs + shoes */}
          <rect x="169" y="32" width="6" height="11" rx="3" fill="#172554" />
          <rect x="157" y="32" width="6" height="11" rx="3" fill="#1E40AF" />
          <rect x="170" y="40" width="9" height="4.5" rx="2.25" fill="#F59E0B" />
          <rect x="155" y="40" width="9" height="4.5" rx="2.25" fill="#F59E0B" />

          {/* body / shirt */}
          <rect x="148" y="16" width="28" height="24" rx="11" fill="#3B82F6" />
          <rect x="148" y="16" width="28" height="8" rx="4" fill="#2563EB" opacity="0.4" />

          {/* arm — swings while running, scratches head on failure */}
          <motion.g
            initial={false}
            style={{ transformBox: 'fill-box', transformOrigin: 'top center' }}
            animate={
              success
                ? { rotate: [0, 0, -40, -18, -40, -25, 0] }
                : failure
                  ? { rotate: [0, 0, 0, 38, 44, 38, 20] }
                  : { rotate: 0 }
            }
            transition={
              success
                ? {
                    duration: 0.9,
                    times: [0, 0.34, 0.46, 0.58, 0.7, 0.82, 1],
                    ease: 'easeInOut',
                  }
                : failure
                  ? {
                      duration: 0.72,
                      times: [0, 0.34, 0.5, 0.6, 0.72, 0.84, 1],
                      ease: 'easeInOut',
                    }
                  : { duration: 0.1 }
            }
          >
            <rect x="142.5" y="17" width="5" height="14" rx="2.5" fill="#2563EB" />
          </motion.g>

          {/* head */}
          <motion.g
            initial={false}
            style={{ transformBox: 'fill-box', transformOrigin: 'bottom center' }}
            animate={verifying ? { rotate: -4 } : { rotate: 0 }}
            transition={verifying ? { duration: 0.9, ease: 'easeInOut' } : { duration: 0.2 }}
          >
            <circle cx="162" cy="11" r="9" fill="#F1F5F9" />
            <rect x="153" y="3.5" width="18" height="7" rx="3.5" fill="#172554" />
            <circle cx="158.5" cy="11" r="1.4" fill="#09233F" />
            {/* smile — appears on success */}
            <motion.path
              initial={false}
              d="M156.5 14 q 3.5 3 7 0"
              stroke="#09233F"
              strokeWidth="1.4"
              strokeLinecap="round"
              fill="none"
              animate={{ opacity: success ? 1 : 0 }}
              transition={{ duration: 0.15, delay: success ? 0.3 : 0 }}
            />
          </motion.g>

          {/* sweat drop — failure cue */}
          <motion.g
            initial={false}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            animate={failure ? { opacity: [0, 0, 0, 1, 1, 0] } : { opacity: 0 }}
            transition={
              failure
                ? { duration: 0.72, times: [0, 0.42, 0.5, 0.58, 0.82, 1], ease: 'easeInOut' }
                : { duration: 0.1 }
            }
          >
            <path d="M171 0.5 q 2.4 3.6 0 6 q -2.4 -2.4 0 -6 Z" fill="#38BDF8" />
          </motion.g>
        </motion.g>
      </motion.g>
    </svg>
  );
}
