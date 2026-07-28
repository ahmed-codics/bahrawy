'use client';

import { useEffect } from 'react';
import { ErrorState } from '@bahrawy/ui';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="academy-container flex min-h-[70dvh] items-center justify-center py-10">
      <ErrorState
        title="حصلت مشكلة غير متوقعة"
        description="بياناتك محفوظة. حاول تحميل الصفحة مرة أخرى، وإذا استمرت المشكلة تواصل مع الدعم."
        onRetry={reset}
      />
    </main>
  );
}
