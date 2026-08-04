'use client';

import { FormEvent, use, useCallback, useEffect, useState } from 'react';
import { Archive, BookOpen, Coins, Save, UsersRound } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Input,
  PageHeader,
  PageSkeleton,
  Select,
  Textarea,
} from '@bahrawy/ui';
import { fetchApi } from '../../../../lib/api';
import { LifecycleDialog } from '../../_components/LifecycleDialog';

type Product = {
  id: string;
  code: string;
  titleAr: string;
  titleEn?: string | null;
  descriptionAr?: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  version: number;
  grade?: { nameAr: string } | null;
  courses: { course: { id: string; titleAr: string; code: string; status: string } }[];
  unitEntries: { unit: { id: string; titleAr: string; chapter: { course: { titleAr: string } } } }[];
  prices: {
    id: string;
    amount: number | string;
    currency: string;
    status: string;
    createdAt: string;
  }[];
  _count: { entitlements: number };
};

export default function ProductDetailsPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = use(params);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lifecycleOpen, setLifecycleOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetchApi(`/admin/v1/products/${productId}`);
      setProduct(response.data as Product);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'تعذر تحميل الباقة',
      );
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveIdentity = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!product) return;
    setSaving(true);
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget));
      await fetchApi(`/admin/v1/products/${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...values, version: product.version }),
      });
      toast.success('تم حفظ بيانات الباقة');
      await load();
    } finally {
      setSaving(false);
    }
  };

  if (loading && !product) return <PageSkeleton cards={6} />;
  if (!product) {
    return <ErrorState title="تعذر فتح الباقة" description={error} onRetry={load} />;
  }

  const activePrice = product.prices.find((price) => price.status === 'ACTIVE');
  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        eyebrow={product.grade?.nameAr ?? 'كل المراحل'}
        title={product.titleAr}
        description={product.code}
        actions={
          <Button variant="outline" onClick={() => setLifecycleOpen(true)}>
            <Archive className="size-4" />
            {product.status === 'ARCHIVED'
              ? 'استعادة أو حذف الباقة'
              : 'أرشفة أو حذف الباقة'}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<BookOpen />} label="الكورسات" value={product.courses.length} />
        <Metric icon={<BookOpen />} label="الوحدات" value={product.unitEntries.length} />
        <Metric icon={<UsersRound />} label="الاشتراكات" value={product._count.entitlements} />
        <Metric
          icon={<Coins />}
          label="السعر الحالي"
          value={
            activePrice
              ? Number(activePrice.amount) === 0
                ? 'مجاني'
                : `${activePrice.amount} ${activePrice.currency}`
              : 'غير محدد'
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,.75fr)]">
        <Card>
          <form className="space-y-4" onSubmit={saveIdentity}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black">هوية الباقة</h2>
              <Badge
                tone={
                  product.status === 'PUBLISHED'
                    ? 'success'
                    : product.status === 'ARCHIVED'
                      ? 'neutral'
                      : 'amber'
                }
              >
                {product.status}
              </Badge>
            </div>
            <Input name="titleAr" label="الاسم بالعربية" defaultValue={product.titleAr} required />
            <Input
              name="titleEn"
              label="الاسم بالإنجليزية"
              defaultValue={product.titleEn ?? ''}
              directionMode="ltr"
            />
            <Textarea
              name="descriptionAr"
              label="الوصف"
              defaultValue={product.descriptionAr ?? ''}
              rows={5}
            />
            <Select name="status" label="حالة النشر" defaultValue={product.status}>
              <option value="DRAFT">مسودة</option>
              <option value="PUBLISHED">منشورة</option>
            </Select>
            <Button type="submit" loading={saving}>
              <Save className="size-4" />
              حفظ الهوية
            </Button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 text-lg font-black">المحتوى المشمول</h2>
            <div className="space-y-3">
              {product.courses.map(({ course }) => (
                <div key={course.id} className="rounded-xl border border-border bg-surface-2 p-3">
                  <strong>{course.titleAr}</strong>
                  <p className="mt-1 text-xs text-ink-3" dir="ltr">{course.code}</p>
                </div>
              ))}
              {product.unitEntries.map(({ unit }) => (
                <div key={unit.id} className="rounded-xl border border-border bg-surface-2 p-3">
                  <strong>{unit.titleAr}</strong>
                  <p className="mt-1 text-xs text-ink-3">{unit.chapter.course.titleAr}</p>
                </div>
              ))}
              {!product.courses.length && !product.unitEntries.length && (
                <p className="text-sm text-ink-3">لم يُضف محتوى إلى الباقة بعد.</p>
              )}
            </div>
          </Card>
          <Card>
            <h2 className="mb-4 text-lg font-black">سجل الأسعار</h2>
            <div className="space-y-3">
              {product.prices.map((price) => (
                <div key={price.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>{price.amount} {price.currency}</span>
                  <Badge tone={price.status === 'ACTIVE' ? 'success' : 'neutral'}>
                    {price.status === 'ACTIVE' ? 'حالي' : 'متقاعد'}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <LifecycleDialog
        open={lifecycleOpen}
        endpoint={`/admin/v1/products/${product.id}`}
        version={product.version}
        onClose={() => setLifecycleOpen(false)}
        onComplete={async () => {
          setLifecycleOpen(false);
          await load();
        }}
      />
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Card className="flex items-center gap-3">
      <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-700 [&_svg]:size-5">
        {icon}
      </span>
      <div>
        <p className="text-xs text-ink-3">{label}</p>
        <strong className="mt-1 block text-lg">{value}</strong>
      </div>
    </Card>
  );
}
