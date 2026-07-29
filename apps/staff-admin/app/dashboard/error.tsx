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
  }, [error]);

  return (
    <ErrorState
      title="تعذر فتح هذه الصفحة"
      description="لم تُفقد أي تعديلات محفوظة. أعد المحاولة، وإذا استمرت المشكلة شارك رقم التتبع مع مسؤول النظام."
      onRetry={reset}
    />
  );
}
