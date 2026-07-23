'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LearnerShell, PageTransition } from '@bahrawy/ui';
import { fetchApi, fetchCsrfToken, clearCsrfToken } from '../../lib/api';
import { useStudentNavigation } from '../../hooks/use-student-navigation';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const navigation = useStudentNavigation();
  const [profile, setProfile] = useState<{ displayName?: string } | null>(null);

  useEffect(() => {
    fetchApi('/dashboard/student')
      .then((res) => {
        setProfile(res.data?.profile);
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
      <PageTransition pathname={pathname}>{children}</PageTransition>
    </LearnerShell>
  );
}
