'use client';

import { useEffect } from 'react';

export function PwaManager() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return;

    let criticalActivities = 0;
    let waitingWorker: ServiceWorker | null = null;

    const activateWhenSafe = () => {
      if (criticalActivities === 0 && waitingWorker) {
        waitingWorker.postMessage({ type: 'SKIP_WAITING' });
        waitingWorker = null;
      }
    };

    const onCriticalStart = () => {
      criticalActivities += 1;
    };
    const onCriticalEnd = () => {
      criticalActivities = Math.max(0, criticalActivities - 1);
      activateWhenSafe();
    };

    window.addEventListener('bahrawy:critical-start', onCriticalStart);
    window.addEventListener('bahrawy:critical-end', onCriticalEnd);

    void navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        if (registration.waiting) {
          waitingWorker = registration.waiting;
          activateWhenSafe();
        }
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              waitingWorker = worker;
              activateWhenSafe();
            }
          });
        });
      })
      .catch(() => {
        // PWA support is progressive enhancement; the browser experience remains available.
      });

    return () => {
      window.removeEventListener('bahrawy:critical-start', onCriticalStart);
      window.removeEventListener('bahrawy:critical-end', onCriticalEnd);
    };
  }, []);

  return null;
}
