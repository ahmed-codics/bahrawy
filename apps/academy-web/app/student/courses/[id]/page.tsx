'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BookOpen,
  Check,
  Clock3,
  Crown,
  Eye,
  FileText,
  LockKeyhole,
  PlayCircle,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import { Badge, Button, EmptyState, PageSkeleton } from '@bahrawy/ui';
import { API_BASE, fetchApi } from '../../../../lib/api';

type Price = { amount: number | string; currency?: string };
type Product = {
  id: string;
  titleAr: string;
  type: string;
  coverImageUrl?: string | null;
  prices?: Price[];
};
type Lesson = {
  id: string;
  titleAr: string;
  available?: boolean;
  access?: { hasAccess: boolean; hasEntitlement?: boolean; reason?: string };
  lessons?: { id: string; titleAr: string; contentType: string; durationSeconds?: number }[];
  purchaseProduct?: Product | null;
  prerequisiteAssessment?: { titleAr: string } | null;
};
type Chapter = { id: string; titleAr: string; units?: Lesson[] };
type Course = {
  id: string;
  titleAr: string;
  titleEn?: string;
  descriptionAr?: string;
  chapters?: Chapter[];
};

function money(product?: Product | null) {
  const price = product?.prices?.[0];
  return price
    ? `${Number(price.amount).toLocaleString('ar-EG')} ${price.currency || 'EGP'}`
    : null;
}

export default function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [hasCourseAccess, setHasCourseAccess] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchApi(`/catalog/courses/${id}`)
      .then((response) => {
        setCourse(response.data.course);
        setHasCourseAccess(Boolean(response.data.hasAccess));
        setProducts(response.data.purchaseOptions || []);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'تعذر تحميل الكورس.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <PageSkeleton cards={5} />;
  if (!course)
    return (
      <EmptyState
        icon={<BookOpen className="size-7" />}
        title="تعذر فتح الكورس"
        description={error || 'حاول مرة أخرى.'}
        actionLabel="كل الكورسات"
        onAction={() => router.push('/student/courses')}
      />
    );

  const allLessons = course.chapters?.flatMap((chapter) => chapter.units || []) || [];
  const courseProduct = products.find((product) => product.type === 'COURSE');
  const bundle = products.find((product) => product.type === 'BUNDLE');

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-10">
      <section className="student-hero student-entrance px-4 py-6 sm:px-9 sm:py-10 lg:px-12">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-end">
          <div className="max-w-3xl">
            <span className="student-kicker">
              <Sparkles className="size-4" />{' '}
              {hasCourseAccess ? 'الكورس مفتوح عندك' : 'اختار طريقة الشراء المناسبة'}
            </span>
            <h1 className="ba-heading mt-4 text-3xl leading-[1.2] sm:mt-5 sm:text-5xl">
              {course.titleAr}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-cyan-50/75 sm:mt-4 sm:text-base sm:leading-8">
              {course.descriptionAr ||
                'كل درس له صفحته وسعره ومحتواه. تقدر تشتري درساً واحداً، الكورس كاملاً، أو الباقة الأشمل.'}
            </p>
            <Button
              className="mt-5 w-full border-white/20 bg-white/5 text-white hover:bg-white/10 sm:mt-6 sm:w-auto"
              variant="outline"
              onClick={() => router.push('/student/courses')}
            >
              كل الكورسات
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <Metric value={allLessons.length} label="دروس منفصلة" />
            <Metric value={course.chapters?.length || 0} label="فصول" />
          </div>
        </div>
      </section>

      {!hasCourseAccess && (courseProduct || bundle) && (
        <section className="grid gap-4 lg:grid-cols-2">
          {courseProduct && (
            <PurchaseChoice
              title="شراء الكورس"
              description="كل دروس هذا الكورس مرة واحدة."
              icon={<ShoppingBag className="size-5" />}
              product={courseProduct}
              onBuy={() => router.push(`/student/checkout/${courseProduct.id}`)}
            />
          )}
          {bundle && (
            <PurchaseChoice
              title="شراء الباقة"
              description="الكورس مع باقي كورسات الباقة."
              icon={<Crown className="size-5" />}
              product={bundle}
              featured
              onBuy={() => router.push(`/student/checkout/${bundle.id}`)}
            />
          )}
        </section>
      )}

      <section>
        <div className="mb-6">
          <p className="text-sm font-black text-brand-700 dark:text-brand-300">اختار درسك</p>
          <h2 className="ba-heading mt-1 text-3xl">دروس الكورس</h2>
          <p className="mt-2 text-sm leading-7 text-text-muted">
            كل بطاقة تفتح صفحة درس مستقلة—مش هتلاقي كل الدروس محطوطة في صفحة واحدة.
          </p>
        </div>
        {!allLessons.length ? (
          <EmptyState
            title="لا توجد دروس منشورة بعد"
            description="ستظهر الدروس هنا فور نشرها من الإدارة."
          />
        ) : (
          <div className="space-y-8">
            {course.chapters?.map((chapter, chapterIndex) => (
              <section key={chapter.id}>
                <div className="mb-4 flex items-center gap-3">
                  <span className="ba-number flex size-9 items-center justify-center rounded-xl bg-brand-700 text-sm font-black text-white">
                    {chapterIndex + 1}
                  </span>
                  <div>
                    <h3 className="ba-heading text-xl">{chapter.titleAr}</h3>
                    <p className="text-xs text-text-muted">{chapter.units?.length || 0} دروس</p>
                  </div>
                </div>
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {chapter.units?.map((lesson, index) => (
                    <LessonCard
                      key={lesson.id}
                      lesson={lesson}
                      index={index + 1}
                      courseAccess={hasCourseAccess}
                      onOpen={() =>
                        router.push(`/student/courses/${course.id}/lessons/${lesson.id}`)
                      }
                      onBuy={(productId) => router.push(`/student/checkout/${productId}`)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function LessonCard({
  lesson,
  index,
  courseAccess,
  onOpen,
  onBuy,
}: {
  lesson: Lesson;
  index: number;
  courseAccess: boolean;
  onOpen: () => void;
  onBuy: (id: string) => void;
}) {
  const owned =
    courseAccess || Boolean(lesson.access?.hasAccess) || Boolean(lesson.access?.hasEntitlement);
  const price = money(lesson.purchaseProduct);
  const duration =
    lesson.lessons?.reduce((total, material) => total + (material.durationSeconds || 0), 0) || 0;
  return (
    <article className="student-course-card flex h-full flex-col">
      <button
        type="button"
        onClick={onOpen}
        className="student-cover relative aspect-[16/9] overflow-hidden text-right"
      >
        {lesson.purchaseProduct?.coverImageUrl ? (
          <img
            src={`${API_BASE}${lesson.purchaseProduct.coverImageUrl}`}
            alt={lesson.titleAr}
            className="size-full object-cover transition duration-300 hover:scale-[1.025]"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <PlayCircle className="size-16 text-cyan-200/55" />
          </div>
        )}
        <span className="ba-number absolute right-4 top-4 flex size-9 items-center justify-center rounded-xl bg-black/35 text-sm font-black text-white backdrop-blur-sm">
          {index}
        </span>
        <Badge className="absolute left-4 top-4" tone={owned ? 'success' : 'neutral'}>
          {owned ? (
            <>
              <Check className="size-3.5" /> مفتوح
            </>
          ) : (
            <>
              <LockKeyhole className="size-3.5" /> مقفول
            </>
          )}
        </Badge>
      </button>
      <div className="flex flex-1 flex-col p-5">
        <h4 className="ba-heading text-2xl">{lesson.titleAr}</h4>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-text-muted">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-soft px-3 py-1.5">
            <FileText className="size-3.5" /> {lesson.lessons?.length || 0} مواد
          </span>
          {duration > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-soft px-3 py-1.5">
              <Clock3 className="size-3.5" /> {Math.ceil(duration / 60)} دقيقة
            </span>
          )}
        </div>
        {lesson.available === false && (
          <p className="mt-3 text-xs font-bold text-warning">
            أكمل {lesson.prerequisiteAssessment?.titleAr} أولاً
          </p>
        )}
        <div className="mt-auto border-t border-border-default pt-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-text-muted">
                {owned ? 'حالة الوصول' : 'سعر الدرس'}
              </p>
              <p className="ba-number mt-1 text-xl font-black">
                {owned ? 'مفتوح في حسابك' : price || 'غير محدد بعد'}
              </p>
            </div>
            {owned ? (
              <Eye className="size-5 text-success" />
            ) : (
              <LockKeyhole className="size-5 text-text-muted" />
            )}
          </div>
          <div className="mt-4 grid gap-2">
            {!owned && lesson.purchaseProduct && price && (
              <Button variant="accent" onClick={() => onBuy(lesson.purchaseProduct!.id)}>
                شراء الدرس
              </Button>
            )}
            <Button
              variant={owned ? 'primary' : 'outline'}
              trailingIcon={<ArrowLeft className="size-4" />}
              onClick={onOpen}
            >
              {owned ? 'افتح الدرس' : 'شاهد تفاصيل الدرس'}
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

function PurchaseChoice({
  title,
  description,
  icon,
  product,
  featured,
  onBuy,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  product: Product;
  featured?: boolean;
  onBuy: () => void;
}) {
  return (
    <div
      className={`student-panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center ${featured ? 'ring-2 ring-amber-300/60' : ''}`}
    >
      <span
        className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${featured ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' : 'bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-200'}`}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="ba-heading text-xl">{title}</h3>
        <p className="mt-1 text-sm text-text-muted">{description}</p>
      </div>
      <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
        <strong className="ba-number whitespace-nowrap text-xl">{money(product) || '—'}</strong>
        <Button variant={featured ? 'accent' : 'primary'} onClick={onBuy}>
          اشترِ الآن
        </Button>
      </div>
    </div>
  );
}
function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl border border-white/12 bg-white/8 p-4 backdrop-blur-sm">
      <p className="ba-number text-3xl font-black">{value.toLocaleString('ar-EG')}</p>
      <p className="mt-1 text-xs font-bold text-cyan-50/65">{label}</p>
    </div>
  );
}
