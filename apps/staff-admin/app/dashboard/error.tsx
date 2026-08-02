'use client';

import { useEffect } from 'react';
import { ErrorState } from '@bahrawy/ui';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Staff Admin route error', error);

    const signature = error.digest || `${error.name}:${error.message}`;
    const recoveryKey = 'bahrawy-admin-chunk-recovery';
    const isStaleDeploymentChunk =
      /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
        `${error.name} ${error.message}`,
      );

    if (isStaleDeploymentChunk && window.sessionStorage.getItem(recoveryKey) !== signature) {
      window.sessionStorage.setItem(recoveryKey, signature);
      window.location.reload();
    }
  }, [error]);

  return (
    <ErrorState
      title="تعذر فتح هذه الصفحة"
      description={`لم تُفقد أي تعديلات محفوظة. أعد المحاولة، وإذا استمرت المشكلة شارك رقم التتبع مع مسؤول النظام.${
        error.digest ? ` رقم التتبع: ${error.digest}` : ''
      }`}
      onRetry={reset}
    />
  );
}
