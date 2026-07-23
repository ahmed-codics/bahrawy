'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardCheck, FileText, LockKeyhole, PlayCircle, ShieldCheck, ShoppingBag, Sparkles } from 'lucide-react';
import { Badge, Button, EmptyState, PageSkeleton } from '@bahrawy/ui';
import { API_BASE, fetchApi } from '../../../../../../lib/api';

type Product = { id: string; titleAr: string; coverImageUrl?: string | null; prices?: { amount: number | string; currency?: string }[] };
type ContentItem = {
  type: string;
  lessonId?: string;
  assessmentId?: string;
  titleAr: string;
  durationSeconds?: number;
  questionCount?: number;
  completedAt?: string | null;
  available?: boolean;
};
type UnitDetail = {
  unit: { id: string; titleAr: string; chapter: { titleAr: string; course: { id: string; titleAr: string } }; prerequisiteAssessment?: { titleAr: string } | null };
  lessonProduct?: Product | null;
  contentItems: ContentItem[];
  hasAccess: boolean;
  access?: { reason?: string; prerequisite?: { titleAr: string } };
};

export default function LessonPage({ params }: { params: Promise<{ id: string; unitId: string }> }) {
  const { id, unitId } = use(params);
  const router = useRouter();
  const [detail, setDetail] = useState<UnitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchApi(`/catalog/units/${unitId}`)
      .then((response) => setDetail(response.data))
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'تعذر تحميل الدرس.'))
      .finally(() => setLoading(false));
  }, [unitId]);

  if (loading) return <PageSkeleton cards={4} />;
  if (!detail) return <EmptyState title="تعذر فتح الدرس" description={error || 'حاول مرة أخرى.'} actionLabel="العودة للكورس" onAction={() => router.push(`/student/courses/${id}`)} />;

  const { unit, contentItems, lessonProduct, hasAccess } = detail;
  const price = lessonProduct?.prices?.[0];
  const priceText = price ? `${Number(price.amount).toLocaleString('ar-EG')} ${price.currency || 'EGP'}` : null;

  const openItem = (item: ContentItem) => {
    if (item.type === 'ASSESSMENT' && item.assessmentId) router.push(`/student/assessments/${item.assessmentId}`);
    else if (item.lessonId) router.push(`/student/courses/${id}/lesson/${item.lessonId}`);
  };

  return <div className="mx-auto max-w-6xl space-y-7 pb-10">
    <button type="button" onClick={() => router.push(`/student/courses/${id}`)} className="ba-focus inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-black text-text-muted hover:bg-surface-soft hover:text-ink"><ArrowRight className="size-4" /> العودة إلى دروس الكورس</button>

    <section className="student-hero student-entrance overflow-hidden">
      <div className="grid min-h-[22rem] lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col justify-center px-6 py-9 sm:px-10 lg:px-12"><span className="student-kicker"><Sparkles className="size-4" /> {unit.chapter.titleAr}</span><h1 className="ba-heading mt-5 text-4xl leading-[1.2] sm:text-5xl">{unit.titleAr}</h1><p className="mt-4 max-w-xl text-base leading-8 text-cyan-50/75">صفحة مستقلة للدرس: الفيديو والملفات والواجب في مكان واحد، وتقدمك محفوظ تلقائياً.</p><div className="mt-6 flex flex-wrap gap-2"><Badge tone={hasAccess ? 'success' : 'neutral'}>{hasAccess ? <><CheckCircle2 className="size-4" /> الدرس مفتوح</> : <><LockKeyhole className="size-4" /> يحتاج شراء</>}</Badge><Badge tone="cyan">{contentItems.length} مواد تعليمية</Badge></div></div>
        <div className="student-cover relative min-h-60 border-t border-white/10 lg:border-r lg:border-t-0">{lessonProduct?.coverImageUrl ? <img src={`${API_BASE}${lessonProduct.coverImageUrl}`} alt={unit.titleAr} className="absolute inset-0 size-full object-cover" /> : <div className="flex h-full items-center justify-center"><PlayCircle className="size-24 text-cyan-200/40" /></div>}</div>
      </div>
    </section>

    {!hasAccess && <section className="student-panel grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center"><div><p className="text-sm font-black text-brand-700 dark:text-brand-300">شراء الدرس منفرداً</p><h2 className="ba-heading mt-2 text-3xl">افتح {unit.titleAr}</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-text-muted">بعد رفع إيصال الدفع والرقم المرجعي، تراجع الإدارة الطلب. عند الموافقة سيفتح هذا الدرس فقط.</p>{detail.access?.reason === 'PREREQUISITE' && <p className="mt-3 text-sm font-bold text-warning">أكمل {detail.access.prerequisite?.titleAr || unit.prerequisiteAssessment?.titleAr} أولاً.</p>}</div><div className="min-w-56 rounded-2xl border border-brand-200 bg-brand-50 p-5 text-center dark:border-brand-900 dark:bg-brand-950/25"><p className="text-xs font-bold text-text-muted">سعر الدرس</p><p className="ba-number mt-2 text-3xl font-black">{priceText || 'غير محدد بعد'}</p>{lessonProduct && priceText && <Button className="mt-5 w-full" variant="accent" leadingIcon={<ShoppingBag className="size-4" />} onClick={() => router.push(`/student/checkout/${lessonProduct.id}`)}>اشترِ الدرس الآن</Button>}</div></section>}

    <section><div className="mb-5"><p className="text-sm font-black text-brand-700 dark:text-brand-300">داخل الدرس</p><h2 className="ba-heading mt-1 text-3xl">محتوى {unit.titleAr}</h2></div>{!contentItems.length ? <EmptyState title="لا يوجد محتوى منشور بعد" description="سيظهر الفيديو والملفات هنا بعد نشرها." /> : <div className="grid gap-4 md:grid-cols-2">{contentItems.map((item, index) => <ContentCard key={item.lessonId || item.assessmentId || `${item.type}-${index}`} item={item} index={index + 1} hasAccess={hasAccess} onOpen={() => openItem(item)} />)}</div>}</section>

    <div className="flex gap-3 rounded-2xl border border-brand-200/60 bg-brand-50/60 p-4 text-sm text-brand-900 dark:border-brand-900 dark:bg-brand-950/20 dark:text-brand-100"><ShieldCheck className="size-5 shrink-0" /><p className="font-bold">المحتوى محمي بحسابك، والوصول لا ينتقل إلى أي درس آخر إلا بشرائه أو امتلاك الكورس أو الباقة.</p></div>
  </div>;
}

function ContentCard({ item, index, hasAccess, onOpen }: { item: ContentItem; index: number; hasAccess: boolean; onOpen: () => void }) {
  const allowed = hasAccess && item.available !== false;
  const Icon = item.type === 'VIDEO' ? PlayCircle : item.type === 'ASSESSMENT' ? ClipboardCheck : FileText;
  return <article className={`student-course-card p-5 ${!allowed ? 'opacity-90' : ''}`}><div className="flex items-start gap-4"><span className="ba-number flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-soft text-sm font-black">{index}</span><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-200"><Icon className="size-5" /></span><div className="min-w-0 flex-1"><p className="text-xs font-black text-brand-700 dark:text-brand-300">{item.type === 'VIDEO' ? 'فيديو' : item.type === 'ASSESSMENT' ? 'واجب أو اختبار' : 'ملف ومذاكرة'}</p><h3 className="ba-heading mt-1 text-xl">{item.titleAr}</h3>{item.durationSeconds ? <p className="mt-1 text-xs text-text-muted">{Math.ceil(item.durationSeconds / 60)} دقيقة</p> : item.questionCount ? <p className="mt-1 text-xs text-text-muted">{item.questionCount} أسئلة</p> : null}</div></div><Button className="mt-5 w-full" variant={allowed ? 'primary' : 'outline'} disabled={!allowed} trailingIcon={allowed ? <ArrowLeft className="size-4" /> : <LockKeyhole className="size-4" />} onClick={onOpen}>{allowed ? (item.completedAt ? 'راجع المحتوى' : 'افتح المحتوى') : 'مقفل حتى فتح الدرس'}</Button></article>;
}
