'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Crown, PackageOpen, ShieldCheck, Sparkles } from 'lucide-react';
import { Badge, Button, EmptyState, PageSkeleton } from '@bahrawy/ui';
import type { ProductDTO } from '@bahrawy/types';
import { API_BASE, fetchApi } from '../../../lib/api';

export default function StudentProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [gradeId, setGradeId] = useState<string>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi('/dashboard/student')
      .then((response) => {
        const grade = response.data?.profile?.gradeId;
        setGradeId(grade);
        return fetchApi(`/catalog/my-products${grade ? `?gradeId=${grade}` : ''}`);
      })
      .then((response) => setProducts(response.data || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSkeleton cards={4} />;

  return (
    <div className="space-y-8">
      <section className="student-hero student-entrance px-4 py-6 sm:px-9 sm:py-8 lg:px-11">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-3xl">
            <span className="student-kicker">
              <Crown className="size-4" /> خطط الاشتراك
            </span>
            <h1 className="ba-heading mt-4 text-3xl leading-[1.2] sm:mt-5 sm:text-5xl">
              اختار اللي يناسب مذاكرتك،
              <br />
              <span className="text-[#69ddeb]">وافهم كل حاجة قبل الدفع.</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-cyan-50/75 sm:mt-4 sm:text-base sm:leading-8">
              الباقة تجمع لك أكتر من كورس بسعر واحد، وتقدر تشوف محتوى كل كورس ودروسه قبل ما تقرر.
            </p>
          </div>
          <div className="flex gap-3">
            <span className="inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-sm font-bold">
              <ShieldCheck className="size-5 text-[#69ddeb]" /> دفع ومراجعة آمنة
            </span>
          </div>
        </div>
      </section>

      {!gradeId && (
        <div className="student-panel flex flex-col gap-4 border-amber-300/50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-black">حدد مرحلتك الدراسية أولاً</p>
            <p className="mt-1 text-sm text-text-muted">
              عشان نعرض لك الباقات والكورسات المناسبة لمنهجك.
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push('/student/profile')}>
            حدد المرحلة
          </Button>
        </div>
      )}

      <section>
        <div className="mb-5">
          <p className="text-sm font-black text-brand-700 dark:text-brand-300">الباقات المتاحة</p>
          <h2 className="ba-heading mt-1 text-3xl">كل منهجك في مكان واحد</h2>
        </div>
        {products.length === 0 ? (
          <EmptyState
            icon={<PackageOpen className="size-7" />}
            title="لا توجد باقات منشورة حالياً"
            description="راجع مرحلتك الدراسية أو ارجع لاحقاً عند نشر باقات جديدة."
            actionLabel="راجع حسابك"
            onAction={() => router.push('/student/profile')}
          />
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product, index) => (
              <BundleCard
                key={product.id}
                product={product}
                featured={index === 0}
                onOpen={() =>
                  product.isEntitled
                    ? router.push('/student/courses')
                    : router.push(
                        gradeId
                          ? `/grades/${gradeId}/bundles/${product.id}`
                          : `/student/checkout/${product.id}`,
                      )
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function BundleCard({
  product,
  featured,
  onOpen,
}: {
  product: ProductDTO;
  featured: boolean;
  onOpen: () => void;
}) {
  const price = product.prices?.[0];
  return (
    <article
      className={`student-course-card flex h-full flex-col ${featured ? 'ring-2 ring-amber-300/70 dark:ring-amber-600/50' : ''}`}
    >
      <div className="student-cover relative aspect-[16/9] overflow-hidden">
        {product.coverImageUrl ? (
          <img
            src={`${API_BASE}${product.coverImageUrl}`}
            alt={product.titleAr}
            className="size-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <PackageOpen className="size-14 text-cyan-200/60" />
          </div>
        )}
        <Badge
          className="absolute right-4 top-4"
          tone={product.isEntitled ? 'success' : featured ? 'amber' : 'cyan'}
        >
          {product.isEntitled ? (
            'موجودة في حسابك'
          ) : featured ? (
            <>
              <Sparkles className="size-3.5" /> الاختيار الأشمل
            </>
          ) : (
            'متاحة الآن'
          )}
        </Badge>
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <p className="text-xs font-black text-brand-700 dark:text-brand-300">باقة المرحلة</p>
        <h2 className="ba-heading mt-2 text-2xl">{product.titleAr}</h2>
        {product.descriptionAr && (
          <p className="mt-2 line-clamp-2 text-sm leading-7 text-text-muted">
            {product.descriptionAr}
          </p>
        )}
        <ul className="mt-5 space-y-3">
          {product.courses?.slice(0, 4).map((entry) => (
            <li key={entry.course.id} className="flex gap-2 text-sm font-bold">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
              <span>{entry.course.titleAr}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 border-t border-border-default pt-5">
          <p className="text-xs font-bold text-text-muted">إجمالي الاشتراك</p>
          <p className="ba-number mt-1 text-3xl font-black">
            {price && Number(price.amount) === 0
              ? 'مجاني'
              : price
                ? `${Number(price.amount).toLocaleString('ar-EG')} ${price.currency || 'EGP'}`
                : '—'}
          </p>
        </div>
        <Button
          className="mt-5 w-full"
          variant={featured && !product.isEntitled ? 'accent' : 'primary'}
          trailingIcon={<ArrowLeft className="size-4" />}
          onClick={onOpen}
        >
          {product.isEntitled ? 'اذهب إلى كورساتك' : 'شاهد التفاصيل واشترك'}
        </Button>
      </div>
    </article>
  );
}
