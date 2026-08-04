'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Eye,
  Layers3,
  LockKeyhole,
  PlayCircle,
  Search,
  Sparkles,
} from 'lucide-react';
import { Badge, Button, EmptyState, PageSkeleton, ProgressBar } from '@bahrawy/ui';
import { API_BASE, fetchApi } from '../../../lib/api';

type Course = {
  id: string;
  titleAr: string;
  titleEn?: string;
  descriptionAr?: string;
  coverImageUrl?: string | null;
  chapters?: { units?: { lessons?: { id: string }[] }[] }[];
  products?: {
    product: {
      id: string;
      type: string;
      prices?: { amount: number | string; currency?: string }[];
    };
  }[];
};
type OwnedCourse = { id: string; progressPercentage?: number };

export default function StudentCoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [owned, setOwned] = useState<OwnedCourse[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'owned' | 'preview'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchApi('/catalog/courses'), fetchApi('/dashboard/student')])
      .then(([catalog, dashboard]) => {
        setCourses(catalog.data || []);
        setOwned(dashboard.data?.enrolledCourses || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const ownedMap = useMemo(() => new Map(owned.map((course) => [course.id, course])), [owned]);
  const visible = courses.filter((course) => {
    const isOwned = ownedMap.has(course.id);
    const matchesFilter = filter === 'all' || (filter === 'owned' ? isOwned : !isOwned);
    const matchesQuery = `${course.titleAr} ${course.titleEn || ''}`
      .toLowerCase()
      .includes(query.trim().toLowerCase());
    return matchesFilter && matchesQuery;
  });

  if (loading) return <PageSkeleton cards={6} />;

  return (
    <div className="space-y-7">
      <section className="student-hero student-entrance px-4 py-6 sm:px-9 sm:py-8 lg:px-11">
        <div className="flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <span className="student-kicker">
              <Sparkles className="size-4" /> مكتبة الإنجليزي
            </span>
            <h1 className="ba-heading mt-4 text-3xl leading-[1.2] sm:mt-5 sm:text-5xl">
              كل كورس واضح
              <br />
              <span className="text-brand-700">قبل ما تبدأه.</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-text-muted sm:mt-4 sm:text-base sm:leading-8">
              تصفّح الفصول والدروس مجاناً، واعرف شكل المسار قبل الاشتراك. الكورسات المفتوحة في حسابك
              هتلاقي تقدمك محفوظ فيها.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MiniStat value={owned.length} label="في حسابك" />
            <MiniStat value={courses.length} label="متاح للتصفح" />
          </div>
        </div>
      </section>

      <section className="student-panel flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {(['all', 'owned', 'preview'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`ba-focus min-h-11 rounded-xl px-4 text-sm font-black transition ${filter === value ? 'bg-brand-700 text-white shadow-md' : 'bg-surface-soft text-text-muted hover:text-ink'}`}
            >
              {value === 'all'
                ? 'كل الكورسات'
                : value === 'owned'
                  ? 'مفتوحة عندي'
                  : 'متاحة للمعاينة'}
            </button>
          ))}
        </div>
        <label className="relative block w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <span className="sr-only">ابحث عن كورس</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ابحث باسم الكورس"
            className="ba-focus min-h-11 w-full rounded-xl border border-border-default bg-surface pr-11 pl-4 text-sm outline-none"
          />
        </label>
      </section>

      {visible.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="size-7" />}
          title="مفيش كورسات مطابقة"
          description="غيّر البحث أو اعرض كل الكورسات المتاحة."
          actionLabel="عرض الكل"
          onAction={() => {
            setQuery('');
            setFilter('all');
          }}
        />
      ) : (
        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              owned={ownedMap.get(course.id)}
              onOpen={() => router.push(`/student/courses/${course.id}`)}
              onBuy={(productId) => {
                const product = course.products?.map((entry) => entry.product).find((item) => item.id === productId);
                router.push(Number(product?.prices?.[0]?.amount) === 0 ? `/student/courses/${course.id}` : `/student/checkout/${productId}`);
              }}
            />
          ))}
        </section>
      )}
    </div>
  );
}

function CourseCard({
  course,
  owned,
  onOpen,
  onBuy,
}: {
  course: Course;
  owned?: OwnedCourse;
  onOpen: () => void;
  onBuy: (productId: string) => void;
}) {
  const units = course.chapters?.flatMap((chapter) => chapter.units || []).length || 0;
  const lessons =
    course.chapters?.flatMap((chapter) => chapter.units || []).flatMap((unit) => unit.lessons || [])
      .length || 0;
  const progress = Math.round(owned?.progressPercentage || 0);
  const courseProduct = course.products
    ?.map((entry) => entry.product)
    .find((product) => product.type === 'COURSE');
  const price = courseProduct?.prices?.[0];
  return (
    <article className="student-course-card flex h-full flex-col">
      <div className="student-cover relative aspect-[16/9] overflow-hidden">
        {course.coverImageUrl ? (
          <Image
            src={`${API_BASE}${course.coverImageUrl}`}
            alt={course.titleAr}
            fill
            sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw"
            className="object-cover transition duration-300 hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <BookOpen className="size-14 text-brand-200/60" />
          </div>
        )}
        <Badge className="absolute right-4 top-4" tone={owned ? 'success' : 'cyan'}>
          {owned ? (
            <>
              <CheckCircle2 className="size-3.5" /> مفتوح عندك
            </>
          ) : (
            <>
              <Eye className="size-3.5" /> معاينة متاحة
            </>
          )}
        </Badge>
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[.16em] text-brand-700 dark:text-brand-300">
          {course.titleEn || 'ENGLISH COURSE'}
        </p>
        <h2 className="ba-heading mt-2 text-2xl">{course.titleAr}</h2>
        <p className="mt-2 line-clamp-2 text-sm leading-7 text-text-muted">
          {course.descriptionAr || 'شرح وتطبيق ومراجعة في مسار مرتب، درس بخطوة.'}
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-text-muted">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-soft px-3 py-1.5">
            <Layers3 className="size-3.5" /> {units} دروس
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-soft px-3 py-1.5">
            <PlayCircle className="size-3.5" /> {lessons} مواد تعليمية
          </span>
        </div>
        {owned ? (
          <div className="mt-6">
            <div className="mb-2 flex justify-between text-xs font-bold">
              <span className="text-text-muted">نسبة الإنجاز</span>
              <span>{progress}%</span>
            </div>
            <ProgressBar value={progress} />
          </div>
        ) : (
          <div className="mt-6 flex items-end justify-between border-t border-border-default pt-4">
            <div>
              <p className="text-xs font-bold text-text-muted">يبدأ من</p>
              <p className="ba-number mt-1 text-xl font-black">
                {price && Number(price.amount) === 0
                  ? 'مجاني'
                  : price
                    ? `${Number(price.amount).toLocaleString('ar-EG')} ${price.currency || 'EGP'}`
                  : 'شاهد الخيارات'}
              </p>
            </div>
            <LockKeyhole className="size-5 text-text-muted" />
          </div>
        )}
        <div className="mt-5 grid gap-2">
          {!owned && courseProduct && (
            <Button className="w-full" variant="accent" onClick={() => onBuy(courseProduct.id)}>
              {Number(price?.amount) === 0 ? 'ابدأ التعلم مجاناً' : 'شراء الكورس'}
            </Button>
          )}
          <Button
            className="w-full"
            variant={owned ? 'primary' : 'outline'}
            trailingIcon={<ArrowLeft className="size-4" />}
            onClick={onOpen}
          >
            {owned ? 'كمّل الكورس' : 'شاهد المحتوى والأسعار'}
          </Button>
        </div>
      </div>
    </article>
  );
}

function MiniStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-32 rounded-2xl border border-border-default bg-surface/85 p-4 shadow-sm">
      <p className="ba-number text-3xl font-black">{value.toLocaleString('ar-EG')}</p>
      <p className="mt-1 text-xs font-bold text-text-muted">{label}</p>
    </div>
  );
}
