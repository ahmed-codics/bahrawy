import Link from 'next/link';
import { EmptyState } from '@bahrawy/ui';

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas p-5" dir="rtl">
      <div className="space-y-4 text-center">
        <EmptyState
          title="الصفحة غير موجودة"
          description="ربما نُقل السجل أو لم تعد لديك صلاحية الوصول إليه."
        />
        <Link
          href="/dashboard"
          className="ba-focus inline-flex min-h-11 items-center rounded-xl bg-brand-600 px-5 font-bold text-white"
        >
          العودة إلى لوحة العمليات
        </Link>
      </div>
    </main>
  );
}
