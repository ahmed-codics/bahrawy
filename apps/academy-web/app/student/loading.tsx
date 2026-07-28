import { PageSkeleton } from '@bahrawy/ui';

export default function StudentLoading() {
  return (
    <div aria-busy="true" aria-label="جاري تحميل بيانات حسابك">
      <PageSkeleton cards={4} />
    </div>
  );
}
