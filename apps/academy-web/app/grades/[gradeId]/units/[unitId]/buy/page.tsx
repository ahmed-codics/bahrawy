'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, PackageOpen } from 'lucide-react';
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
import { fetchApi } from '../../../../../../lib/api';

type Product = {
  id: string;
  titleAr: string;
  type: string;
  prices?: { amount: string | number; currency: string }[];
};
type Unit = {
  id: string;
  titleAr: string;
  productEntries?: { product: Product }[];
};

export default function UnitBuyPage({
  params,
}: {
  params: Promise<{ gradeId: string; unitId: string }>;
}) {
  const { gradeId, unitId } = use(params);
  const router = useRouter();
  const [unit, setUnit] = useState<Unit | null>(null);
  const [bundles, setBundles] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchApi(`/catalog/units/${unitId}`),
      fetchApi(`/catalog/grades/${gradeId}/bundles`),
    ])
      .then(([unitResponse, bundleResponse]) => {
        setUnit(unitResponse.data.unit);
        setBundles(bundleResponse.data || []);
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, [gradeId, unitId, router]);

  const lessonProduct = useMemo(
    () => unit?.productEntries?.find((entry) => entry.product.type === 'LESSON')?.product,
    [unit],
  );
  const firstBundle = bundles[0];

  if (loading) return <PageSkeleton cards={2} />;
  if (!unit) return <EmptyState title="تعذر فتح الدرس" />;

  return (
    <PageIntro className="mx-auto max-w-4xl space-y-7">
      <PageHeader
        eyebrow="شراء المحتوى"
        title={unit.titleAr}
        description="اختر بين شراء الباقة الكاملة أو هذا الدرس فقط، ثم ارفع إيصال الدفع من صفحة الدفع."
      />

      <div className="grid gap-5 md:grid-cols-2">
        <BuyCard
          icon={<PackageOpen className="size-6" />}
          badge="الأوفر"
          title={firstBundle?.titleAr || 'الباقة الكاملة'}
          price={firstBundle?.prices?.[0]}
          disabled={!firstBundle}
          buttonLabel="اشتري الباقة"
          onBuy={() => firstBundle && router.push(Number(firstBundle.prices?.[0]?.amount) === 0 ? `/login?next=/student/products` : `/student/checkout/${firstBundle.id}`)}
        />
        <BuyCard
          icon={<BookOpen className="size-6" />}
          badge="درس منفرد"
          title="هذا الدرس فقط"
          price={lessonProduct?.prices?.[0]}
          disabled={!lessonProduct}
          buttonLabel="اشتري الدرس"
          onBuy={() => lessonProduct && router.push(Number(lessonProduct.prices?.[0]?.amount) === 0 ? `/login?next=/student/courses` : `/student/checkout/${lessonProduct.id}`)}
        />
      </div>
    </PageIntro>
  );
}

function BuyCard({
  icon,
  badge,
  title,
  price,
  disabled,
  buttonLabel,
  onBuy,
}: {
  icon: React.ReactNode;
  badge: string;
  title: string;
  price?: { amount: string | number; currency: string };
  disabled?: boolean;
  buttonLabel: string;
  onBuy: () => void;
}) {
  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <div className="flex items-start justify-between gap-3">
          <span className="flex size-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            {icon}
          </span>
          <Badge tone={disabled ? 'neutral' : 'blue'}>{badge}</Badge>
        </div>
        <div>
          <h2 className="font-heading text-2xl font-black">{title}</h2>
          <p className="ba-number mt-3 text-3xl font-black">
            {price && Number(price.amount) === 0 ? 'مجاني' : price?.amount ?? '—'}{' '}
            {price && Number(price.amount) !== 0 && <span className="text-sm">{price.currency || 'EGP'}</span>}
          </p>
        </div>
        <Button
          className="w-full"
          disabled={disabled}
          trailingIcon={<ArrowLeft className="size-4" />}
          onClick={onBuy}
        >
          {price && Number(price.amount) === 0 ? 'ابدأ مجاناً' : buttonLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
