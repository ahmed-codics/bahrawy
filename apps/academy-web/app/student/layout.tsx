'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import { LearnerShell, PageTransition } from '@bahrawy/ui';
import { fetchApi, fetchCsrfToken, clearCsrfToken } from '../../lib/api';
import { useStudentNavigation } from '../../hooks/use-student-navigation';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const navigation = useStudentNavigation();
  const [profile, setProfile] = useState<{ displayName?: string } | null>(null);
  const [activeAssessments, setActiveAssessments] = useState<any[]>([]);

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
      router.push('/login');
    } catch {
      clearCsrfToken();
      router.push('/login');
    }
  };

  return (
    <LearnerShell
      user={{
        name: profile?.displayName || 'طالب البحراوي',
        role: 'طالب',
      }}
      navigation={navigation}
      onNavigate={(href) => router.push(href)}
      onLogout={handleLogout}
    >
      {!pathname.startsWith('/student/assessments/') && activeAssessments.length > 0 && (
        <div className="mb-6 flex flex-col items-start gap-4 rounded-xl border border-warning/30 bg-warning/10 p-4 text-warning-800 dark:border-warning/20 dark:text-warning-300 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Clock className="size-6 shrink-0 text-warning" />
            <div>
              <p className="font-bold">لديك اختبار قيد الإجراء: {activeAssessments[0].assessment.titleAr}</p>
              <p className="text-sm opacity-90">يرجى العودة لإنهاء الاختبار.</p>
            </div>
          </div>
          <Link
            href={`/student/assessments/${activeAssessments[0].assessmentId}`}
            className="shrink-0 rounded-lg bg-warning px-4 py-2 text-sm font-bold text-warning-950 transition-colors hover:bg-warning-600 dark:hover:bg-warning-500"
          >
            متابعة الاختبار
          </Link>
        </div>
      )}
      <PageTransition pathname={pathname}>{children}</PageTransition>
    </LearnerShell>
  );
}
