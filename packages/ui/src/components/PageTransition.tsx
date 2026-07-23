'use client';

import { AnimatePresence, domAnimation, LazyMotion, m, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

const pageVariants = {
  initial: { opacity: 0, y: 6, scale: 0.99 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 6, scale: 0.99 },
};

const pageTransitionConfig = {
  duration: 0.25,
  ease: 'easeOut' as const,
};

export function PageTransition({
  children,
  pathname,
}: {
  children: ReactNode;
  pathname: string;
}) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <>{children}</>;
  }

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence mode="wait">
        <m.div
          key={pathname}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={pageTransitionConfig}
        >
          {children}
        </m.div>
      </AnimatePresence>
    </LazyMotion>
  );
}

export function PageEnter({ children }: { children: ReactNode }) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <>{children}</>;
  }

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        initial={{ opacity: 0, y: 6, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={pageTransitionConfig}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}
