'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LearnerShell } from '@bahrawy/ui';
import { useStudentNavigation } from '../../../../../../hooks/use-student-navigation';
import { clearCsrfToken, fetchApi } from '../../../../../../lib/api';

export default function LegacyLearnLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const navigation = useStudentNavigation();
  const [name, setName] = useState('طالب البحراوي');

  useEffect(() => {
    fetchApi('/dashboard/student')
      .then((response) => setName(response.data?.profile?.displayName || 'طالب البحراوي'))
      .catch(() => undefined);
  }, []);

  const logout = async () => {
    try {
      await fetchApi('/auth/logout', { method: 'POST' });
    } finally {
      clearCsrfToken();
      navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_PRIVATE_CACHES' });
      router.push('/login');
    }
  };

  return (
    <LearnerShell
      user={{ name, role: 'طالب' }}
      navigation={navigation}
      onNavigate={(href) => router.push(href)}
      onLogout={logout}
    >
      {children}
    </LearnerShell>
  );
}
