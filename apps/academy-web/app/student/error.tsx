'use client';

import { ErrorState } from '@bahrawy/ui';

export default function StudentError({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <ErrorState
        title="تعذر تحميل هذه الصفحة"
        description="تحقق من اتصال الإنترنت ثم حاول مرة أخرى. لن تفقد تقدمك المحفوظ."
        onRetry={reset}
      />
    </div>
  );
}
