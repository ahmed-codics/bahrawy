'use client';

import { FormEvent, use, useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Badge, Button, Card, CardContent, ErrorState, Input, PageSkeleton } from '@bahrawy/ui';
import { fetchApi } from '../../../../../lib/api';
import type { CourseWithContent } from '../components/types';

export default function CourseCommercePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [course, setCourse] = useState<CourseWithContent | null>(null);
  const [isFree, setIsFree] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await fetchApi(`/admin/v1/courses/${id}`);
      const value = response.data as CourseWithContent;
      setCourse(value);
      setIsFree(Number(value.courseProduct?.prices?.[0]?.amount ?? -1) === 0);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'تعذر تحميل بيانات السعر',
      );
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!course) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setSaving(true);
    try {
      await fetchApi(`/admin/v1/products/course/${course.id}/commerce`, {
        method: 'POST',
        body: JSON.stringify({
          titleAr: course.titleAr,
          titleEn: course.titleEn || undefined,
          descriptionAr: course.descriptionAr || undefined,
          coverImageUrl: course.coverImageUrl || undefined,
          priceAmount: isFree ? 0 : Number(values.priceAmount),
          currency: 'EGP',
          version: course.courseProduct?.version,
        }),
      });
      toast.success('تم حفظ سعر الوصول وإنشاء سجل سعر جديد');
      await load();
    } catch (requestError) {
      toast.error(
        requestError instanceof Error ? requestError.message : 'تعذر حفظ السعر',
      );
    } finally {
      setSaving(false);
    }
  };

  if (error && !course) {
    return <ErrorState title="تعذر تحميل بيانات السعر" description={error} onRetry={load} />;
  }
  if (!course) return <PageSkeleton cards={3} />;
  const activePrice = course.courseProduct?.prices?.[0];

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <p className="text-xs font-bold text-brand-600">الوصول والتجارة</p>
        <h1 className="mt-1 text-2xl font-black">{course.titleAr}</h1>
        <p className="mt-2 text-sm text-ink-3">
          تغيير السعر لا يكتب فوق التاريخ؛ يتم تقاعد السعر القديم وإنشاء سعر جديد.
        </p>
      </header>

      <Card>
        <CardContent className="space-y-5 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-ink-3">السعر الحالي</p>
              <p className="mt-1 text-3xl font-black">
                {activePrice
                  ? Number(activePrice.amount) === 0
                    ? 'مجاني'
                    : `${Number(activePrice.amount).toLocaleString('ar-EG')} جنيه`
                  : 'غير محدد'}
              </p>
            </div>
            <Badge tone={activePrice ? 'success' : 'amber'}>
              {activePrice ? 'سعر نشط' : 'يحتاج إعداد'}
            </Badge>
          </div>

          <form className="space-y-4 border-t border-border pt-5" onSubmit={save}>
            <Input
              name="priceAmount"
              type="number"
              min="0"
              step="1"
              label="السعر الجديد بالجنيه"
              defaultValue={String(activePrice?.amount ?? '')}
              disabled={isFree}
              required={!isFree}
            />
            <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-border px-4 text-sm font-bold">
              <input
                type="checkbox"
                checked={isFree}
                onChange={(event) => setIsFree(event.target.checked)}
              />
              إتاحة الكورس مجاناً
            </label>
            <Button type="submit" loading={saving}>
              حفظ سعر جديد
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
