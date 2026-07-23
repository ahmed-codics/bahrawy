'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, Lock, PackageOpen } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  PageHeader,
  PageIntro,
  PageSkeleton,
} from '@bahrawy/ui';
import { API_BASE, fetchApi } from '../../../lib/api';

type Product = {
  id: string;
  titleAr: string;
  type: string;
  descriptionAr?: string;
  coverImageUrl?: string;
  lessonCount?: number;
  prices?: { amount: string | number; currency: string }[];
};
type Unit = {
  id: string;
  titleAr: string;
  productEntries?: { product: Product }[];
};

export default function GradePage({
  params,
}: {
  params: Promise<{ gradeId: string }>;
}) {
  const { gradeId } = use(params);
  const router = useRouter();
  const [bundles, setBundles] = useState<Product[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchApi(`/catalog/grades/${gradeId}/bundles`),
      fetchApi(`/catalog/grades/${gradeId}/units`),
    ])
      .then(([bundleResponse, unitResponse]) => {
        setBundles(bundleResponse.data || []);
        setUnits(unitResponse.data || []);
      })
      .finally(() => setLoading(false));
  }, [gradeId]);

  if (loading) return <PageSkeleton cards={6} />;

  return (
    <PageIntro className="space-y-8">
      <PageHeader
        eyebrow="باقات المرحلة"
        title="اختر طريقة التعلم المناسبة"
        description="اشترِ الباقة الكاملة للوصول لكل الدروس، أو اختر درسًا منفردًا عند الحاجة."
      />

      {bundles.length === 0 ? (
        <EmptyState title="لا توجد باقات لهذه المرحلة حاليًا" />
      ) : (
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {bundles.map((bundle) => {
            const price = bundle.prices?.[0];
            return (
              <Card key={bundle.id} interactive className="h-full overflow-hidden p-0">
                <div className="flex aspect-video items-center justify-center bg-brand-50 text-brand-700 dark:bg-brand-950/30">
                  {bundle.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`${API_BASE}${bundle.coverImageUrl}`}
                      alt={bundle.titleAr}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <PackageOpen className="size-12" />
                  )}
                </div>
                <CardContent className="flex h-full flex-col gap-4 pt-5">
                  <Badge tone="blue">باقة كاملة</Badge>
                  <div>
                    <h2 className="font-heading text-2xl font-black">{bundle.titleAr}</h2>
                    {bundle.descriptionAr && (
                      <p className="mt-2 line-clamp-3 text-sm leading-7 text-text-muted">
                        {bundle.descriptionAr}
                      </p>
                    )}
                  </div>
                  <div className="mt-auto grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl border border-border-default p-3">
                      <p className="text-text-muted">عدد الدروس</p>
                      <p className="ba-number text-xl font-black">{bundle.lessonCount || 0}</p>
                    </div>
                    <div className="rounded-xl border border-border-default p-3">
                      <p className="text-text-muted">السعر</p>
                      <p className="ba-number text-xl font-black">
                        {price?.amount ?? '—'} {price?.currency || 'EGP'}
                      </p>
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    trailingIcon={<ArrowLeft className="size-4" />}
                    onClick={() => router.push(`/grades/${gradeId}/bundles/${bundle.id}`)}
                  >
                    عرض تفاصيل الباقة
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() =>
                      document.getElementById('individual-lessons')?.scrollIntoView({
                        behavior: 'smooth',
                      })
                    }
                  >
                    أو اشترِ درسًا منفردًا
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}

      <section id="individual-lessons" className="space-y-4">
        <PageHeader
          title="شراء درس منفرد"
          description="الدروس التالية يمكن شراؤها بشكل مستقل عند توفر سعر منفرد لها."
        />
        {units.length === 0 ? (
          <EmptyState title="لا توجد دروس منشورة بعد" />
        ) : (
          <div className="grid gap-3">
            {units.map((unit) => {
              const product = unit.productEntries?.find(
                (entry) => entry.product.type === 'LESSON',
              )?.product;
              return (
                <Card key={unit.id}>
                  <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex size-11 items-center justify-center rounded-xl bg-surface-soft text-brand-700">
                        {product ? <BookOpen className="size-5" /> : <Lock className="size-5" />}
                      </span>
                      <div>
                        <h3 className="font-bold">{unit.titleAr}</h3>
                        <p className="text-sm text-text-muted">
                          {product
                            ? `${product.prices?.[0]?.amount ?? '—'} EGP`
                            : 'غير متاح للشراء منفردًا'}
                        </p>
                      </div>
                    </div>
                    <Button
                      disabled={!product}
                      onClick={() => router.push(`/grades/${gradeId}/units/${unit.id}/buy`)}
                    >
                      اشترِ الدرس
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </PageIntro>
  );
}
