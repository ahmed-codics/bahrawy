'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import type { MotivationMessage } from '../lib/motivation/messages';
import { pickMotivationMessage } from '../lib/motivation/pick';

export function MotivationBanner() {
  const [message, setMessage] = useState<MotivationMessage | null>(null);

  useEffect(() => {
    // Random pick + localStorage must run client-side only: running it during SSR
    // render would produce a different message than the client (hydration mismatch),
    // so we deliberately set state in the effect after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessage(pickMotivationMessage());
  }, []);

  const Icon = message?.icon;

  return (
    <motion.section
      role="status"
      aria-label="رسالة تحفيزية"
      initial={{ opacity: 0, y: 10 }}
      animate={message ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="motivation-card group"
    >
      <div className="flex items-center gap-4 p-4 sm:gap-5 sm:p-5">
        <span className="motivation-icon" aria-hidden="true">
          {Icon && <Icon className="size-5" />}
        </span>
        <div className="min-w-0">
          <p className="text-base font-extrabold text-brand-700 dark:text-brand-300 sm:text-lg">
            {message?.title}
          </p>
          <p className="mt-1 text-sm text-text-muted">
            {message?.description}
          </p>
        </div>
      </div>
    </motion.section>
  );
}
