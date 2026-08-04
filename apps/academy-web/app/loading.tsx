import { PageSkeleton } from '@bahrawy/ui';

export default function Loading() {
  return (
    <main className="academy-container py-8 sm:py-12" aria-busy="true" aria-label="جاري التحميل">
      <PageSkeleton cards={4} />
    </main>
  );
}
