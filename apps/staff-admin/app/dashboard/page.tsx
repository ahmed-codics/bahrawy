'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, CreditCard, Headphones, Plus, Users } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  PageHeader,
  PageIntro,
  PageSkeleton,
  StatCard,
  ErrorState,
} from '@bahrawy/ui';
import { fetchApi } from '../../lib/api';
import type { AdminApiResponse } from '@bahrawy/types';

type DashboardData = {
  activeStudents?: number;
  pendingPayments?: number;
  liveCourses?: number;
  openTickets?: number;
};

export default function StaffDashboard() {
  const [stats, setStats] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  useEffect(() => {
    fetchApi<AdminApiResponse<DashboardData>>('/admin/v1/dashboard')
      .then((response) => setStats(response.data))
      .catch((requestError) =>
        setError(
          requestError instanceof Error ? requestError.message : 'تعذر تحميل مؤشرات لوحة التحكم',
        ),
      )
      .finally(() => setLoading(false));
  }, [router]);
  if (loading) return <PageSkeleton cards={4} />;
  if (error) {
    return (
      <ErrorState
        title="تعذر تحميل لوحة التحكم"
        description={error}
        onRetry={() => window.location.reload()}
      />
    );
  }
  const data = stats || {};

  return (
    <PageIntro className="space-y-8">
      <PageHeader
        eyebrow="مركز العمليات"
        title="نظرة عامة"
        description="الأرقام التي تحتاج انتباهك الآن، مع وصول سريع لأهم الإجراءات."
        actions={
          <Button
            leadingIcon={<Plus className="size-4" />}
            onClick={() => router.push('/dashboard/courses/new')}
          >
            إنشاء كورس
          </Button>
        }
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="إجمالي الطلاب"
          value={data.activeStudents || 0}
          hint="حسابات الطلاب"
          icon={<Users className="size-6" />}
          tone="blue"
        />
        <StatCard
          label="مدفوعات للمراجعة"
          value={data.pendingPayments || 0}
          hint="تحتاج قراراً"
          icon={<CreditCard className="size-6" />}
          tone="amber"
        />
        <StatCard
          label="كورسات نشطة"
          value={data.liveCourses || 0}
          hint="محتوى منشور"
          icon={<BookOpen className="size-6" />}
          tone="cyan"
        />
        <StatCard
          label="تذاكر مفتوحة"
          value={data.openTickets || 0}
          hint="بانتظار رد الفريق"
          icon={<Headphones className="size-6" />}
          tone="coral"
        />
      </section>
      <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardContent className="pt-5 sm:pt-6">
            <h2 className="font-heading text-xl font-black">قائمة الأولويات</h2>
            <p className="mt-1 text-sm text-text-muted">
              ابدأ بالبنود التي تؤثر مباشرة على وصول الطالب للمحتوى.
            </p>
            <div className="mt-5 space-y-3">
              {[
                {
                  title: 'مراجعة إيصالات الدفع',
                  text: `${data.pendingPayments || 0} طلبات تنتظر المراجعة`,
                  href: '/dashboard/payments',
                  icon: <CreditCard className="size-5" />,
                  tone: 'bg-amber-50 text-amber-700',
                },
                {
                  title: 'الرد على الدعم الفني',
                  text: `${data.openTickets || 0} تذاكر مفتوحة`,
                  href: '/dashboard/support',
                  icon: <Headphones className="size-5" />,
                  tone: 'bg-coral-50 text-coral-700',
                },
                {
                  title: 'مراجعة المحتوى المنشور',
                  text: `${data.liveCourses || 0} كورسات متاحة`,
                  href: '/dashboard/courses',
                  icon: <BookOpen className="size-5" />,
                  tone: 'bg-brand-50 text-brand-700',
                },
              ].map((item) => (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className="group flex min-h-16 w-full items-center gap-4 rounded-xl border border-border-default p-3 text-start transition hover:border-brand-300 hover:bg-surface-soft"
                >
                  <span
                    className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${item.tone}`}
                  >
                    {item.icon}
                  </span>
                  <span className="flex-1">
                    <span className="block font-bold">{item.title}</span>
                    <span className="block text-xs text-text-muted">{item.text}</span>
                  </span>
                  <ArrowLeft className="size-4 text-text-muted transition group-hover:-translate-x-1" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card tone="blue">
          <CardContent className="pt-5 sm:pt-6">
            <h2 className="font-heading text-xl font-black">إجراءات سريعة</h2>
            <div className="mt-5 grid gap-3">
              <Button
                className="w-full justify-start"
                leadingIcon={<Plus className="size-4" />}
                onClick={() => router.push('/dashboard/courses/new')}
              >
                إضافة كورس أو محتوى
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                leadingIcon={<Plus className="size-4" />}
                onClick={() => router.push('/dashboard/products?create=1')}
              >
                إنشاء باقة وسعر
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                leadingIcon={<Plus className="size-4" />}
                onClick={() => router.push('/dashboard/questions')}
              >
                إضافة سؤال
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </PageIntro>
  );
}
