'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  BookOpen,
  CreditCard,
  Database,
  GraduationCap,
  LayoutDashboard,
  LifeBuoy,
  ScrollText,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Users,
} from 'lucide-react';
import { Button, ErrorState, PageSkeleton, PageTransition, StaffShell } from '@bahrawy/ui';
import { ApiRequestError, fetchApi, fetchCsrfToken, clearCsrfToken } from '../../lib/api';

function DashboardContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <PageTransition pathname={pathname}>{children}</PageTransition>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authState, setAuthState] = useState<
    | { status: 'loading' }
    | {
        status: 'ready';
        user: { name: string; role: string };
        permissions: string[];
      }
    | { status: 'error'; message: string }
  >({ status: 'loading' });

  const loadSession = useCallback(
    () =>
      fetchApi('/auth/me', { timeoutMs: 10_000 })
        .then((response) => {
          if (response.data?.kind !== 'STAFF') {
            router.replace('/login');
            return;
          }
          setAuthState({
            status: 'ready',
            user: {
              name: response.data.name || 'مدير الأكاديمية',
              role:
                Array.isArray(response.data.roles) && response.data.roles.length
                  ? response.data.roles.join(' · ')
                  : 'فريق الإدارة',
            },
            permissions: response.data.permissions || [],
          });
          fetchCsrfToken();
        })
        .catch((error: unknown) => {
          if (error instanceof ApiRequestError && error.status === 401) {
            router.replace('/login');
            return;
          }
          setAuthState({
            status: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'تعذر الاتصال بالخادم. تأكد أن خدمة الـ API تعمل على المنفذ 3000.',
          });
        }),
    [router],
  );

  const checkSession = useCallback(() => {
    setAuthState({ status: 'loading' });
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const handleLogout = async () => {
    try {
      await fetchApi('/auth/logout', { method: 'POST' });
    } finally {
      clearCsrfToken();
      router.replace('/login');
    }
  };

  const navigation = [
    {
      label: 'الهيكل الأكاديمي',
      href: '/dashboard/academic',
      isActive: pathname.startsWith('/dashboard/academic'),
      icon: <GraduationCap className="size-5" />,
      permission: 'CATALOG_MANAGE',
    },
    {
      label: 'نظرة عامة',
      href: '/dashboard',
      isActive: pathname === '/dashboard',
      icon: <LayoutDashboard className="size-5" />,
    },
    {
      label: 'الطلاب',
      href: '/dashboard/students',
      isActive: pathname.startsWith('/dashboard/students'),
      icon: <Users className="size-5" />,
      permission: 'STUDENT_MANAGE',
    },
    {
      label: 'الكورسات والمحتوى',
      href: '/dashboard/courses',
      isActive: pathname.startsWith('/dashboard/courses'),
      icon: <BookOpen className="size-5" />,
      permission: 'CATALOG_MANAGE',
    },
    {
      label: 'الباقات والأسعار',
      href: '/dashboard/products',
      isActive: pathname.startsWith('/dashboard/products'),
      icon: <ShoppingBag className="size-5" />,
      permission: 'PRODUCT_MANAGE',
    },
    {
      label: 'بنك الأسئلة',
      href: '/dashboard/questions',
      isActive: pathname.startsWith('/dashboard/questions'),
      icon: <Database className="size-5" />,
      permission: 'ASSESSMENT_MANAGE',
    },
    {
      label: 'المدفوعات',
      href: '/dashboard/payments',
      isActive: pathname.startsWith('/dashboard/payments'),
      icon: <CreditCard className="size-5" />,
      permission: 'PAYMENT_MANAGE',
    },
    {
      label: 'الدعم الفني',
      href: '/dashboard/support',
      isActive: pathname.startsWith('/dashboard/support'),
      icon: <LifeBuoy className="size-5" />,
      permission: 'SUPPORT_MANAGE',
    },
    {
      label: 'فريق العمل',
      href: '/dashboard/staff',
      isActive: pathname.startsWith('/dashboard/staff'),
      icon: <ShieldCheck className="size-5" />,
      permission: 'STAFF_MANAGE',
    },
    {
      label: 'سجل التدقيق',
      href: '/dashboard/audit',
      isActive: pathname.startsWith('/dashboard/audit'),
      icon: <ScrollText className="size-5" />,
      permission: 'STAFF_MANAGE',
    },
    {
      label: 'الإعدادات',
      href: '/dashboard/settings',
      isActive: pathname.startsWith('/dashboard/settings'),
      icon: <Settings className="size-5" />,
      permission: 'STAFF_MANAGE',
    },
  ];
  const visibleNavigation = navigation.filter(
    (item) =>
      !item.permission ||
      (authState.status === 'ready' && authState.permissions.includes(item.permission)),
  );

  if (authState.status === 'loading')
    return (
      <div className="min-h-dvh bg-canvas p-8">
        <PageSkeleton cards={4} />
      </div>
    );

  if (authState.status === 'error') {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-canvas p-4">
        <div className="w-full max-w-xl space-y-4">
          <ErrorState
            title="تعذر فتح مركز الإدارة"
            description={authState.message}
            onRetry={checkSession}
          />
          <Button variant="ghost" className="w-full" onClick={() => router.replace('/login')}>
            العودة إلى تسجيل الدخول
          </Button>
        </div>
      </main>
    );
  }

  return (
    <StaffShell
      user={authState.user}
      navigation={visibleNavigation}
      onNavigate={router.push}
      onLogout={handleLogout}
    >
      <DashboardContent>{children}</DashboardContent>
    </StaffShell>
  );
}
