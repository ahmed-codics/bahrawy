'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, CheckCircle2, Clock3, Compass, Play, Sparkles, Target } from 'lucide-react';
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
type Notification = { id: string; title?: string; message?: string; titleAr?: string; bodyAr?: string; createdAt?: string };
type DashboardData = {
  profile?: { displayName?: string };
  enrolledCourses?: Course[];
  recentNotifications?: Notification[];
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
  const activeCourse = courses.find((course) => (course.progressPercentage || 0) < 100) || courses[0];
  const overall = lessons ? Math.round((completed / lessons) * 100) : 0;
  const firstName = data?.profile?.displayName?.trim().split(/\s+/)[0] || 'يا بطل';

  if (loading) return <PageSkeleton cards={5} />;

  return <div className="space-y-8">
    <section className="student-hero student-entrance px-6 py-8 sm:px-9 sm:py-10 lg:px-12">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-center">
        <div>
          <span className="student-kicker"><Sparkles className="size-4" /> جاهز لحصة جديدة؟</span>
          <h1 className="ba-heading mt-5 max-w-3xl text-4xl leading-[1.22] sm:text-5xl">أهلاً يا {firstName}،<br /><span className="text-[#69ddeb]">يلا نكمّل من مكانك.</span></h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-cyan-50/75">كل درس تخلصه بيقرّبك من هدفك. افتح آخر كورس، راجع تقدمك، وخلي المذاكرة ماشية بخطوات واضحة.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button variant="accent" leadingIcon={<Play className="size-4 fill-current" />} onClick={() => router.push(activeCourse ? `/student/courses/${activeCourse.id}` : '/student/courses')}>{activeCourse ? 'كمّل مذاكرتك' : 'استكشف الكورسات'}</Button>
            <Button variant="outline" className="border-white/25 bg-white/5 text-white hover:bg-white/10" onClick={() => router.push('/student/products')}>شوف الباقات</Button>
          </div>
        </div>
        <div className="student-entrance-late rounded-[1.6rem] border border-white/12 bg-white/8 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between"><div><p className="text-sm font-bold text-cyan-100/70">تقدمك الكلي</p><p className="ba-number mt-1 text-4xl font-black">{number.format(overall)}%</p></div><div className="relative flex size-20 items-center justify-center rounded-full" style={{ background: `conic-gradient(#66deeb ${overall * 3.6}deg, rgba(255,255,255,.12) 0)` }}><div className="flex size-14 items-center justify-center rounded-full bg-[#073247]"><Target className="size-6 text-[#69ddeb]" /></div></div></div>
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4"><div><p className="ba-number text-xl font-black">{number.format(completed)}</p><p className="text-xs text-cyan-50/60">درس مكتمل</p></div><div><p className="ba-number text-xl font-black">{number.format(courses.length)}</p><p className="text-xs text-cyan-50/60">كورس في حسابك</p></div></div>
        </div>
      </div>
    </section>

    <section className="grid gap-4 sm:grid-cols-3">
      <Metric icon={<BookOpen className="size-5" />} label="كورساتك" value={number.format(courses.length)} accent="cyan" />
      <Metric icon={<CheckCircle2 className="size-5" />} label="دروس خلصتها" value={number.format(completed)} accent="green" />
      <Metric icon={<Clock3 className="size-5" />} label="الخطوة الجاية" value={activeCourse ? 'كمّل' : 'ابدأ'} accent="amber" />
    </section>

    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div>
        <div className="mb-4 flex items-end justify-between gap-4"><div><p className="text-sm font-black text-brand-700 dark:text-brand-300">مسارك الحالي</p><h2 className="ba-heading mt-1 text-3xl">كمّل من مكانك</h2></div>{courses.length > 1 && <Button variant="ghost" onClick={() => router.push('/student/courses')}>كل الكورسات</Button>}</div>
        {activeCourse ? <ContinueCard course={activeCourse} onOpen={() => router.push(`/student/courses/${activeCourse.id}`)} /> : <EmptyState icon={<Compass className="size-7" />} title="رحلتك جاهزة تبدأ" description="استعرض الكورسات والباقات، وشوف تفاصيل كل درس قبل الاشتراك." actionLabel="استكشف المحتوى" onAction={() => router.push('/student/courses')} />}
      </div>
      <aside className="student-panel p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-black text-brand-700 dark:text-brand-300">آخر التحديثات</p><h2 className="ba-heading mt-1 text-2xl">مهم ليك</h2></div><span className="flex size-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"><Sparkles className="size-5" /></span></div>
        <div className="mt-5 space-y-3">{data?.recentNotifications?.length ? data.recentNotifications.slice(0, 3).map((item) => <div key={item.id} className="rounded-xl border border-border-default bg-surface-soft p-3"><p className="text-sm font-bold">{item.titleAr || item.title || 'تحديث جديد'}</p><p className="mt-1 line-clamp-2 text-xs leading-6 text-text-muted">{item.bodyAr || item.message || 'راجع حسابك لمعرفة التفاصيل.'}</p></div>) : <><QuickNote text="اختار الدرس اللي هتبدأ به قبل ما تذاكر." /><QuickNote text="تقدمك بيتحفظ تلقائياً بعد كل مشاهدة." /><QuickNote text="محتاج مساعدة؟ فريق الدعم موجود من القائمة." /></>}</div>
      </aside>
    </section>
  </div>;
}

function Metric({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: 'cyan' | 'green' | 'amber' }) {
  const color = accent === 'green' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-300' : accent === 'amber' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/35 dark:text-amber-300' : 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/35 dark:text-cyan-300';
  return <div className="student-panel flex min-h-28 items-center gap-4 p-5"><span className={`flex size-11 items-center justify-center rounded-xl ${color}`}>{icon}</span><div><p className="text-sm font-bold text-text-muted">{label}</p><p className="ba-number mt-1 text-2xl font-black">{value}</p></div></div>;
}

function ContinueCard({ course, onOpen }: { course: Course; onOpen: () => void }) {
  const progress = Math.round(course.progressPercentage || 0);
  return <article className="student-course-card grid min-h-72 md:grid-cols-[minmax(16rem,40%)_1fr]">
    <div className="student-cover relative min-h-52 overflow-hidden">{course.coverImageUrl ? <img src={`${API_BASE}${course.coverImageUrl}`} alt={course.titleAr} className="absolute inset-0 size-full object-cover" /> : <div className="flex h-full items-center justify-center"><BookOpen className="size-16 text-cyan-300/70" /></div>}<Badge className="absolute right-4 top-4" tone="cyan">جاري التعلم</Badge></div>
    <div className="flex flex-col justify-center p-6 sm:p-8"><p className="text-sm font-black text-brand-700 dark:text-brand-300">الكورس الحالي</p><h3 className="ba-heading mt-2 text-3xl">{course.titleAr}</h3><p className="mt-3 text-sm text-text-muted">أنجزت {number.format(course.completedLessons || 0)} من {number.format(course.totalLessons || 0)} درس</p><ProgressBar className="mt-4" value={progress} /><Button className="mt-6 w-full sm:w-fit" trailingIcon={<ArrowLeft className="size-4" />} onClick={onOpen}>افتح الكورس</Button></div>
  </article>;
}

function QuickNote({ text }: { text: string }) {
  return <div className="flex gap-3 rounded-xl bg-surface-soft p-3"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-600" /><p className="text-sm leading-6 text-text-muted">{text}</p></div>;
}
