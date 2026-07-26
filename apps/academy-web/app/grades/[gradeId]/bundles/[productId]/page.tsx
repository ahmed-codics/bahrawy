'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ChevronDown,
  CheckCircle2,
  FileText,
  Lock,
  PlayCircle,
  ClipboardList,
  BookOpen,
  Layers3,
  PackageOpen,
  ShieldCheck,
} from 'lucide-react';
import { Badge, Button, Card, CardContent, EmptyState, PageSkeleton } from '@bahrawy/ui';
import { PublicShell } from '../../../../../components/PublicShell';
import { API_BASE, fetchApi } from '../../../../../lib/api';

type Lesson = { id: string; titleAr: string; contentType: string; durationSeconds?: number };
type Assessment = { id: string; titleAr: string; questions?: unknown[]; attempts?: unknown[] };
type Unit = {
  id: string;
  titleAr: string;
  lessons?: Lesson[];
  assessments?: Assessment[];
  access?: { hasAccess: boolean; reason: string };
};
type Course = {
  id: string;
  titleAr: string;
  descriptionAr?: string | null;
  coverImageUrl?: string | null;
  unitCount?: number;
};
type Product = {
  id: string;
  titleAr: string;
  descriptionAr?: string;
  coverImageUrl?: string | null;
  prices?: { amount: string | number; currency: string }[];
};

function publicCoverUrl(coverImageUrl?: string | null) {
  if (!coverImageUrl) return null;
  const match = coverImageUrl.match(/^\/storage\/([^/]+)$/);
  if (!match) return `${API_BASE}${coverImageUrl}`;
  return `${API_BASE}/storage/public/${encodeURIComponent(match[1])}`;
}

export default function BundleDetailPage({
  params,
}: {
  params: Promise<{ gradeId: string; productId: string }>;
}) {
  const { gradeId, productId } = use(params);
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [openUnitId, setOpenUnitId] = useState<string | null>(null);
  const [hasEntitlement, setHasEntitlement] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi(`/catalog/bundles/${productId}`)
      .then((response) => {
        setProduct(response.data.product);
        setCourses(response.data.courses || []);
        setUnits(response.data.units || []);
        setHasEntitlement(Boolean(response.data.hasEntitlement));
        setOpenUnitId(response.data.units?.[0]?.id ?? null);
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, [productId, router]);

  if (loading) {
    return (
      <PublicShell active="courses">
        <div className="academy-container py-12">
          <PageSkeleton cards={4} />
        </div>
      </PublicShell>
    );
  }

  if (!product) {
    return (
      <PublicShell active="courses">
        <div className="academy-container py-16">
          <EmptyState title="تعذر فتح الباقة" />
        </div>
      </PublicShell>
    );
  }

  const price = product.prices?.[0];
  const coverUrl = publicCoverUrl(product.coverImageUrl);
  const actionLabel = hasEntitlement ? 'اذهب إلى كورساتي' : 'اشترِ الباقة';
  const goToAction = () =>
    router.push(hasEntitlement ? '/student/courses' : `/student/checkout/${product.id}`);

  return (
    <PublicShell active="courses">
      <div className="academy-container pb-12 pt-5 sm:pb-16 sm:pt-10">
        <Link
          href={`/courses?gradeId=${encodeURIComponent(gradeId)}`}
          className="mb-4 inline-flex items-center gap-2 text-xs font-bold text-text-muted transition-colors hover:text-brand-600 sm:mb-5 sm:text-sm"
        >
          <ArrowLeft className="size-4 rotate-180" aria-hidden="true" />
          العودة إلى محتوى المرحلة
        </Link>

        <section className="overflow-hidden rounded-2xl border border-border-default bg-surface shadow-[0_18px_50px_rgba(2,20,30,0.10)] sm:rounded-[2rem] sm:shadow-[0_24px_70px_rgba(2,20,30,0.10)]">
          <div className="grid items-stretch lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
            <div className="flex flex-col justify-center p-5 sm:p-9 lg:p-12">
              <span className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-[11px] font-black text-brand-700 sm:mb-5 sm:px-3.5 sm:py-2 sm:text-xs dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-200">
                <PackageOpen className="size-4" aria-hidden="true" />
                تفاصيل الباقة
              </span>

              <h1 className="max-w-3xl font-heading text-[2rem] font-black leading-[1.18] text-text sm:text-4xl lg:text-5xl">
                {product.titleAr}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-text-muted sm:mt-5 sm:text-base sm:leading-8">
                {product.descriptionAr ||
                  'كل الدروس والكورسات المشمولة داخل هذه الباقة في مكان واحد.'}
              </p>

              <div className="mt-5 flex flex-wrap gap-2 sm:mt-7 sm:gap-3">
                <span className="inline-flex items-center gap-2 rounded-xl border border-border-default bg-surface-soft px-3 py-2.5 text-xs font-bold sm:px-4 sm:py-3 sm:text-sm">
                  <Layers3 className="size-5 text-brand-600" aria-hidden="true" />
                  {courses.length} {courses.length === 1 ? 'كورس' : 'كورسات'}
                </span>
                {hasEntitlement && (
                  <span className="inline-flex items-center gap-2 rounded-xl border border-success/20 bg-success/10 px-4 py-3 text-sm font-bold text-success">
                    <ShieldCheck className="size-5" aria-hidden="true" />
                    الباقة مضافة إلى حسابك
                  </span>
                )}
              </div>

              <div className="mt-6 flex flex-col gap-4 border-t border-border-default pt-5 sm:mt-8 sm:flex-row sm:items-center sm:justify-between sm:pt-7">
                <div>
                  <span className="block text-xs font-bold text-text-muted">سعر الباقة</span>
                  <strong className="mt-1 block font-heading text-2xl font-black text-text sm:text-3xl">
                    {price?.amount ?? '—'}{' '}
                    <span className="text-base text-text-muted">{price?.currency || 'EGP'}</span>
                  </strong>
                </div>
                <button
                  type="button"
                  className="academy-button w-full justify-center sm:w-auto sm:px-7 sm:py-4"
                  onClick={goToAction}
                >
                  {actionLabel}
                  <ArrowLeft className="size-5" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="relative order-first aspect-video overflow-hidden bg-brand-50 sm:aspect-[4/3] lg:order-none lg:m-5 lg:aspect-auto lg:min-h-72 lg:rounded-[1.5rem] dark:bg-brand-950/30">
              {coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverUrl}
                  alt={product.titleAr}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full min-h-72 items-center justify-center">
                  <PackageOpen className="size-16 text-brand-500" />
                </div>
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
            </div>
          </div>
        </section>

        <section className="mt-9 sm:mt-12">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="text-sm font-black text-brand-600">ابدأ التعلّم</span>
              <h2 className="mt-1 font-heading text-2xl font-black text-text sm:text-3xl">
                محتوى الباقة
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-text-muted">
              افتح كل درس لمعرفة الفيديوهات والاختبارات الموجودة بداخله.
            </p>
          </div>

          {courses.length === 0 && units.length === 0 ? (
            <EmptyState title="لا توجد كورسات أو دروس داخل هذه الباقة بعد" />
          ) : (
            <div className="space-y-8">
              {courses.length > 0 && (
                <div>
                  <h3 className="mb-3 font-heading text-lg font-black text-text sm:mb-4 sm:text-xl">
                    الكورسات المشمولة
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {courses.map((course) => {
                      const courseCover = publicCoverUrl(course.coverImageUrl);
                      return (
                        <article
                          key={course.id}
                          className="group overflow-hidden rounded-2xl border border-border-default bg-surface shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                        >
                          <div className="grid sm:min-h-44 sm:grid-cols-[160px_minmax(0,1fr)]">
                            <div className="relative aspect-[16/8] overflow-hidden bg-brand-50 sm:aspect-auto dark:bg-brand-950/30">
                              {courseCover ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={courseCover}
                                  alt={course.titleAr}
                                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center">
                                  <BookOpen className="size-10 text-brand-500" />
                                </div>
                              )}
                            </div>
                            <div className="flex min-w-0 flex-col justify-between p-5">
                              <div>
                                <span className="text-xs font-black text-brand-600">
                                  كورس داخل الباقة
                                </span>
                                <h4 className="mt-2 font-heading text-xl font-black leading-snug text-text sm:text-lg">
                                  {course.titleAr}
                                </h4>
                                {course.descriptionAr && (
                                  <p className="mt-2 line-clamp-2 text-xs leading-6 text-text-muted">
                                    {course.descriptionAr}
                                  </p>
                                )}
                              </div>
                              <div className="mt-5 flex flex-col gap-3 sm:mt-4 sm:flex-row sm:items-center sm:justify-between">
                                <span className="text-xs font-bold text-text-muted">
                                  {course.unitCount || 0} دروس منشورة
                                </span>
                                <Button
                                  size="sm"
                                  className="w-full justify-center sm:w-auto"
                                  onClick={() =>
                                    router.push(
                                      hasEntitlement
                                        ? `/student/courses/${course.id}`
                                        : `/student/checkout/${product.id}`,
                                    )
                                  }
                                >
                                  {hasEntitlement ? 'فتح الكورس' : 'اشترك للفتح'}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}

              {units.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-heading text-xl font-black text-text">الدروس المتاحة</h3>
                  {units.map((unit, index) => {
                    const unlocked = !!unit.access?.hasAccess;
                    const open = openUnitId === unit.id;
                    const itemCount = (unit.lessons?.length || 0) + (unit.assessments?.length || 0);

                    return (
                      <Card
                        key={unit.id}
                        className="overflow-hidden rounded-2xl transition-shadow hover:shadow-md"
                      >
                        <CardContent className="p-0">
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-4 p-5 text-start sm:p-6"
                            onClick={() => setOpenUnitId(open ? null : unit.id)}
                            aria-expanded={open}
                          >
                            <span className="flex min-w-0 items-center gap-4">
                              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 font-heading text-sm font-black text-brand-700 dark:bg-brand-950/40 dark:text-brand-200">
                                {index + 1}
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate font-heading text-lg font-black sm:text-xl">
                                  {unit.titleAr}
                                </span>
                                <span className="mt-1 block text-xs text-text-muted">
                                  {itemCount} محتوى تعليمي
                                </span>
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-3">
                              <Badge tone={unlocked ? 'success' : 'danger'}>
                                {unlocked ? 'مفتوح' : 'مغلق'}
                              </Badge>
                              <ChevronDown
                                className={`size-5 text-text-muted transition-transform ${
                                  open ? 'rotate-180' : ''
                                }`}
                                aria-hidden="true"
                              />
                            </span>
                          </button>

                          {open && (
                            <div className="space-y-3 border-t border-border-default bg-surface-soft/50 p-4 sm:p-6">
                              {!unlocked && (
                                <div className="flex flex-col gap-3 rounded-xl border border-danger/20 bg-danger/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                                  <p className="flex items-center gap-2 text-sm font-bold text-danger">
                                    <Lock className="size-4" />
                                    اشترِ الدرس أو الباقة لفتح المحتوى.
                                  </p>
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      router.push(`/grades/${gradeId}/units/${unit.id}/buy`)
                                    }
                                  >
                                    شراء الدرس
                                  </Button>
                                </div>
                              )}
                              {(unit.lessons || []).map((lesson) => (
                                <ContentRow
                                  key={lesson.id}
                                  icon={
                                    lesson.contentType === 'VIDEO' ? (
                                      <PlayCircle className="size-5" />
                                    ) : (
                                      <FileText className="size-5" />
                                    )
                                  }
                                  title={lesson.titleAr}
                                  meta={lesson.contentType}
                                  unlocked={unlocked}
                                  onClick={() =>
                                    unlocked &&
                                    router.push(`/grades/${gradeId}/units/${unit.id}/learn`)
                                  }
                                />
                              ))}
                              {(unit.assessments || []).map((assessment) => (
                                <ContentRow
                                  key={assessment.id}
                                  icon={<ClipboardList className="size-5" />}
                                  title={assessment.titleAr}
                                  meta={`${assessment.questions?.length || 0} أسئلة`}
                                  unlocked={unlocked}
                                  onClick={() =>
                                    unlocked &&
                                    router.push(`/grades/${gradeId}/units/${unit.id}/learn`)
                                  }
                                />
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </PublicShell>
  );
}

function ContentRow({
  icon,
  title,
  meta,
  unlocked,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  meta: string;
  unlocked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!unlocked}
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-border-default bg-surface-soft p-3 text-start disabled:opacity-65"
    >
      <span className="flex items-center gap-3">
        <span className="text-brand-700">{icon}</span>
        <span>
          <span className="block font-bold">{title}</span>
          <span className="text-xs text-text-muted">{meta}</span>
        </span>
      </span>
      {unlocked ? (
        <CheckCircle2 className="size-5 text-success" />
      ) : (
        <Lock className="size-5 text-danger" />
      )}
    </button>
  );
}
