import Link from 'next/link';
import { EmptyState } from '@bahrawy/ui';

export default function NotFound() {
  return (
    <main className="academy-container flex min-h-[70dvh] items-center justify-center py-10">
      <div className="w-full">
        <EmptyState
          title="الصفحة غير موجودة"
          description="يمكن أن يكون الرابط قديمًا أو تم نقل المحتوى إلى مكان آخر."
        />
        <Link
          href="/"
          className="ba-focus mx-auto mt-5 flex min-h-11 w-full max-w-sm items-center justify-center rounded-xl bg-brand-500 px-4 font-bold text-white"
        >
          العودة للرئيسية
        </Link>
      </div>
    </main>
  );
}
