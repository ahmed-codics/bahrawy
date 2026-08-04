import Link from 'next/link';
import { WifiOff } from 'lucide-react';
import { AcademyBrand } from '../../components/AcademyBrand';

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10 text-center">
      <section className="w-full max-w-md rounded-[1.5rem] border border-border bg-surface p-6 shadow-lg sm:p-8">
        <div className="mb-8 flex justify-center">
          <AcademyBrand />
        </div>
        <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-200">
          <WifiOff className="size-8" />
        </span>
        <h1 className="mt-5 font-heading text-2xl font-black">مفيش اتصال بالإنترنت</h1>
        <p className="mt-3 leading-7 text-ink-3">
          الدروس والاختبارات والدفع محتاجين اتصال آمن. راجع الشبكة وحاول تاني.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand-600 px-5 font-bold text-white"
        >
          العودة للرئيسية
        </Link>
      </section>
    </main>
  );
}
