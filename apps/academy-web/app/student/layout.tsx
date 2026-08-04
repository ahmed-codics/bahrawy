'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import { LearnerShell, PageTransition } from '@bahrawy/ui';
import { fetchApi, fetchCsrfToken, clearCsrfToken } from '../../lib/api';
import { useStudentNavigation } from '../../hooks/use-student-navigation';
import { ThemeProvider } from 'next-themes';
type ActiveAssessment = {
  assessmentId: string;
  assessment: { titleAr: string };
};

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const navigation = useStudentNavigation();
  const [profile, setProfile] = useState<{ displayName?: string } | null>(null);
  const [activeAssessments, setActiveAssessments] = useState<ActiveAssessment[]>([]);

  useEffect(() => {
    fetchApi('/dashboard/student')
      .then((res) => {
        setProfile(res.data?.profile);
        setActiveAssessments(res.data?.activeAssessments || []);
        fetchCsrfToken();
      })
      .catch(() => {
        // Will be handled by pages if unauthorized
      });
  }, []);

  const handleLogout = async () => {
    try {
      await fetchApi('/auth/logout', { method: 'POST' });
      clearCsrfToken();
      navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_PRIVATE_CACHES' });
      router.push('/login');
    } catch {
      clearCsrfToken();
      router.push('/login');
    }
  };

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <LearnerShell
      user={{
        name: profile?.displayName || 'طالب البحراوي',
        role: 'طالب',
      }}
      navigation={navigation}
      onNavigate={(href) => router.push(href)}
      onLogout={handleLogout}
      focusedMode={pathname.startsWith('/student/assessments/')}
    >
      {!pathname.startsWith('/student/assessments/') && activeAssessments.length > 0 && (
        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-3.5 text-amber-800 dark:border-warning/20 dark:text-amber-300 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-warning/15">
              <Clock className="size-5 text-warning" />
            </span>
            <div>
              <p className="line-clamp-2 text-sm font-black">
                اختبار قيد الإجراء: {activeAssessments[0].assessment.titleAr}
              </p>
              <p className="mt-0.5 text-xs opacity-90">إجاباتك محفوظة—ارجع كمّل الاختبار.</p>
            </div>
          </div>
          <Link
            href={`/student/assessments/${activeAssessments[0].assessmentId}`}
            className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-xl bg-warning px-4 text-sm font-black text-warning-950 transition-colors hover:bg-warning-600 dark:hover:bg-warning-500 sm:w-auto"
          >
            متابعة الاختبار
          </Link>
        </div>
      )}
      <PageTransition pathname={pathname}>{children}</PageTransition>
    </LearnerShell>
    </ThemeProvider>
  );
}
