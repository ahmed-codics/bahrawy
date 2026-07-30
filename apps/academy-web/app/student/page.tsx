'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock3,
  Compass,
  Play,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import { Badge, Button, EmptyState, PageSkeleton, ProgressBar } from '@bahrawy/ui';
import { API_BASE, fetchApi } from '../../lib/api';

type Course = {
  id: string;
  titleAr: string;
  coverImageUrl?: string | null;
  completedLessons?: number;
  totalLessons?: number;
  progressPercentage?: number;
};
type Notification = {
  id: string;
  title?: string;
  message?: string;
  titleAr?: string;
  bodyAr?: string;
  createdAt?: string;
};
type PaymentOrder = {
  id: string;
  status: string;
  amountRequested: number;
  createdAt: string;
  product: { titleAr: string };
};
type ActiveAssessment = {
  id: string;
  assessmentId: string;
  startedAt: string;
  assessment: { titleAr: string };
};
type DashboardData = {
  profile?: { displayName?: string };
  enrolledCourses?: Course[];
  recentNotifications?: Notification[];
  recentOrders?: PaymentOrder[];
  activeAssessments?: ActiveAssessment[];
};

const number = new Intl.NumberFormat('ar-EG');

export default function StudentDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi('/dashboard/student')
      .then((response) => setData(response.data))
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  const courses = useMemo(() => data?.enrolledCourses || [], [data]);
  const completed = courses.reduce((total, course) => total + (course.completedLessons || 0), 0);
  const lessons = courses.reduce((total, course) => total + (course.totalLessons || 0), 0);
  const activeCourse =
    courses.find((course) => (course.progressPercentage || 0) < 100) || courses[0];
  const overall = lessons ? Math.round((completed / lessons) * 100) : 0;
  const firstName = data?.profile?.displayName?.trim().split(/\s+/)[0] || 'يا بطل';

  if (loading) return <PageSkeleton cards={5} />;

  return (
    <div className="space-y-8">
      <section className="student-hero student-entrance px-4 py-6 sm:px-9 sm:py-10 lg:px-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-center">
          <div>
            <span className="student-kicker">
              <Sparkles className="size-4" /> جاهز لحصة جديدة؟
            </span>
            <h1 className="ba-heading mt-4 max-w-3xl text-3xl leading-[1.2] sm:mt-5 sm:text-5xl">
              أهلاً يا {firstName}،<br />
              <span className="text-brand-700">يلا نكمّل من مكانك.</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-text-muted sm:mt-4 sm:text-base sm:leading-8">
              كل درس تخلصه بيقرّبك من هدفك. افتح آخر كورس، راجع تقدمك، وخلي المذاكرة ماشية بخطوات
              واضحة.
            </p>
            <div className="mt-5 grid gap-2 sm:mt-7 sm:flex sm:flex-wrap sm:gap-3">
              <Button
                className="w-full sm:w-auto"
                variant="accent"
                leadingIcon={<Play className="size-4 fill-current" />}
                onClick={() =>
                  router.push(
                    activeCourse ? `/student/courses/${activeCourse.id}` : '/student/courses',
                  )
                }
              >
                {activeCourse ? 'كمّل مذاكرتك' : 'استكشف الكورسات'}
              </Button>
              <Button
                className="w-full sm:w-auto"
                variant="outline"
                onClick={() => router.push('/student/products')}
              >
                شوف الباقات
              </Button>
            </div>
          </div>
          <div className="student-entrance-late rounded-[1.6rem] border border-border-default bg-white/85 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-text-muted">تقدمك الكلي</p>
                <p className="ba-number mt-1 text-4xl font-black">{number.format(overall)}%</p>
              </div>
              <div
                className="relative flex size-20 items-center justify-center rounded-full"
                style={{
                  background: `conic-gradient(#25a9c0 ${overall * 3.6}deg, rgba(25,110,130,.12) 0)`,
                }}
              >
                <div className="flex size-14 items-center justify-center rounded-full bg-white">
                  <Target className="size-6 text-brand-600" />
                </div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border-default pt-4">
              <div>
                <p className="ba-number text-xl font-black">{number.format(completed)}</p>
                <p className="text-xs text-text-muted">درس مكتمل</p>
              </div>
              <div>
                <p className="ba-number text-xl font-black">{number.format(courses.length)}</p>
                <p className="text-xs text-text-muted">كورس في حسابك</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {data?.activeAssessments && data.activeAssessments.length > 0 && (
        <section className="rounded-[1.6rem] border border-warning/20 bg-warning/5 p-6 sm:p-8">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-warning/20 text-warning-800 dark:bg-warning/10 dark:text-warning-300">
              <Clock3 className="size-5" />
            </span>
            <div>
              <h2 className="ba-heading text-2xl text-warning-900 dark:text-warning-100">
                اختبارات قيد الإجراء
              </h2>
              <p className="text-sm text-warning-800/80 dark:text-warning-300/80">
                لديك اختبارات لم يتم إرسالها بعد.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.activeAssessments.map((attempt) => (
              <article
                key={attempt.id}
                className="flex flex-col justify-between rounded-xl border border-warning/10 bg-surface p-5 shadow-sm"
              >
                <div>
                  <p className="text-sm font-black text-warning-700 dark:text-warning-400">تنبيه</p>
                  <h3 className="ba-heading mt-2 text-xl">{attempt.assessment.titleAr}</h3>
                  <p className="mt-2 text-xs text-text-muted">
                    بدأ في: {new Date(attempt.startedAt).toLocaleString('ar-EG')}
                  </p>
                </div>
                <Button
                  className="mt-5 w-full bg-warning text-warning-950 hover:bg-warning-600 dark:hover:bg-warning-500"
                  onClick={() => router.push(`/student/assessments/${attempt.assessmentId}`)}
                >
                  متابعة الاختبار
                </Button>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <Metric
          icon={<BookOpen className="size-5" />}
          label="كورساتك"
          value={number.format(courses.length)}
          accent="cyan"
        />
        <Metric
          icon={<CheckCircle2 className="size-5" />}
          label="دروس خلصتها"
          value={number.format(completed)}
          accent="green"
        />
        <Metric
          icon={<Clock3 className="size-5" />}
          label="الخطوة الجاية"
          value={activeCourse ? 'كمّل' : 'ابدأ'}
          accent="amber"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          <div className="mb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-sm font-black text-brand-700 dark:text-brand-300">مسارك الحالي</p>
              <h2 className="ba-heading mt-1 text-3xl">كمّل من مكانك</h2>
            </div>
            {courses.length > 1 && (
              <Button
                variant="ghost"
                className="w-full sm:w-auto"
                onClick={() => router.push('/student/courses')}
              >
                كل الكورسات
              </Button>
            )}
          </div>
          {activeCourse ? (
            <ContinueCard
              course={activeCourse}
              onOpen={() => router.push(`/student/courses/${activeCourse.id}`)}
            />
          ) : (
            <EmptyState
              icon={<Compass className="size-7" />}
              title="رحلتك جاهزة تبدأ"
              description="استعرض الكورسات والباقات، وشوف تفاصيل كل درس قبل الاشتراك."
              actionLabel="استكشف المحتوى"
              onAction={() => router.push('/student/courses')}
            />
          )}

          {data?.recentOrders && data.recentOrders.length > 0 && (
            <div className="mt-10">
              <h3 className="ba-heading mb-4 text-xl">طلبات الشراء</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {data.recentOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onReload={() => window.location.reload()}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        <aside className="student-panel p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-brand-700 dark:text-brand-300">آخر التحديثات</p>
              <h2 className="ba-heading mt-1 text-2xl">مهم ليك</h2>
            </div>
            <span className="flex size-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <Sparkles className="size-5" />
            </span>
          </div>
          <div className="mt-5 space-y-3">
            {data?.recentNotifications?.length ? (
              data.recentNotifications.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-border-default bg-surface-soft p-3"
                >
                  <p className="text-sm font-bold">{item.titleAr || item.title || 'تحديث جديد'}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-6 text-text-muted">
                    {item.bodyAr || item.message || 'راجع حسابك لمعرفة التفاصيل.'}
                  </p>
                </div>
              ))
            ) : (
              <>
                <QuickNote text="اختار الدرس اللي هتبدأ به قبل ما تذاكر." />
                <QuickNote text="تقدمك بيتحفظ تلقائياً بعد كل مشاهدة." />
                <QuickNote text="راجع مرحلتك الدراسية من حسابك عشان يظهر لك المحتوى المناسب." />
              </>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: 'cyan' | 'green' | 'amber';
}) {
  const color =
    accent === 'green'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-300'
      : accent === 'amber'
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/35 dark:text-amber-300'
        : 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/35 dark:text-cyan-300';
  return (
    <div className="student-panel flex min-h-28 items-center gap-4 p-5">
      <span className={`flex size-11 items-center justify-center rounded-xl ${color}`}>{icon}</span>
      <div>
        <p className="text-sm font-bold text-text-muted">{label}</p>
        <p className="ba-number mt-1 text-2xl font-black">{value}</p>
      </div>
    </div>
  );
}

function ContinueCard({ course, onOpen }: { course: Course; onOpen: () => void }) {
  const progress = Math.round(course.progressPercentage || 0);
  return (
    <article className="student-course-card grid overflow-hidden md:min-h-72 md:grid-cols-[minmax(16rem,40%)_1fr]">
      <div className="student-cover student-continue-cover relative aspect-video w-full overflow-hidden md:aspect-auto md:min-h-72">
        {course.coverImageUrl ? (
          <Image
            src={`${API_BASE}${course.coverImageUrl}`}
            alt={course.titleAr}
            fill
            sizes="(max-width: 767px) 100vw, 40vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <BookOpen className="size-16 text-cyan-300/70" />
          </div>
        )}
        <Badge className="absolute right-4 top-4" tone="cyan">
          جاري التعلم
        </Badge>
      </div>
      <div className="flex flex-col justify-center p-6 sm:p-8">
        <p className="text-sm font-black text-brand-700 dark:text-brand-300">الكورس الحالي</p>
        <h3 className="ba-heading mt-2 text-3xl">{course.titleAr}</h3>
        <p className="mt-3 text-sm text-text-muted">
          أنجزت {number.format(course.completedLessons || 0)} من{' '}
          {number.format(course.totalLessons || 0)} درس
        </p>
        <ProgressBar className="mt-4" value={progress} />
        <Button
          className="mt-6 w-full sm:w-fit"
          trailingIcon={<ArrowLeft className="size-4" />}
          onClick={onOpen}
        >
          افتح الكورس
        </Button>
      </div>
    </article>
  );
}

function QuickNote({ text }: { text: string }) {
  return (
    <div className="flex gap-3 rounded-xl bg-surface-soft p-3">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-600" />
      <p className="text-sm leading-6 text-text-muted">{text}</p>
    </div>
  );
}

function OrderCard({ order, onReload }: { order: PaymentOrder; onReload?: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const isPending = order.status === 'PENDING_REVIEW';
  const tone = isPending ? 'amber' : 'danger';
  const label = isPending ? 'قيد المراجعة' : 'مرفوض';

  const removeOrder = async () => {
    try {
      setDeleting(true);
      await fetchApi(`/payment/orders/${order.id}`, { method: 'DELETE' });
      if (onReload) onReload();
      else router.refresh();
    } catch (error) {
      console.error('Failed to delete order:', error);
      alert('Failed to delete the order. Please check the console for details.');
      setDeleting(false);
    }
  };

  return (
    <article className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border-default bg-surface p-4 shadow-sm hover:shadow-md transition-shadow">
      <div>
        <p className="text-sm font-bold text-text">{order.product?.titleAr || 'عنصر غير معروف'}</p>
        <p className="mt-1 text-xs text-text-muted">
          {new Date(order.createdAt).toLocaleDateString('ar-EG')}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge tone={tone} className="w-fit">
          {label}
        </Badge>
        {order.status === 'REJECTED' && (
          <button
            type="button"
            onClick={removeOrder}
            disabled={deleting}
            className="flex size-7 items-center justify-center rounded-full bg-surface-soft hover:bg-danger/10 hover:text-danger text-text-muted transition-colors"
            title="حذف الطلب"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </article>
  );
}
