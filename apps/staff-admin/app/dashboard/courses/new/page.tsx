'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import type { AdminApiResponse } from '@bahrawy/types';
import {
  Button,
  Card,
  CardContent,
  Input,
  PageHeader,
  PageSkeleton,
  Select,
  Textarea,
} from '@bahrawy/ui';
import { fetchApi } from '../../../../lib/api';

type Academic = {
  grades: Array<{ id: string; nameAr: string }>;
  subjects: Array<{ id: string; nameAr: string }>;
  cohorts: Array<{ terms: Array<{ id: string; titleAr: string }> }>;
};

export default function NewCoursePage() {
  const router = useRouter();
  const [academic, setAcademic] = useState<Academic | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [isFree, setIsFree] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetchApi<AdminApiResponse<Academic>>('/admin/v1/academic', {
      signal: controller.signal,
    }).then((response) => setAcademic(response.data));
    return () => controller.abort();
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setSaving(true);
    try {
      let coverImageUrl: string | undefined;
      if (coverFile) {
        const upload = new FormData();
        upload.append('file', coverFile);
        const response = await fetchApi('/storage/upload', {
          method: 'POST',
          body: upload,
          timeoutMs: 60_000,
        });
        coverImageUrl = `/storage/${response.data.storedObjectId}`;
      }
      const response = await fetchApi('/admin/v1/courses', {
        method: 'POST',
        body: JSON.stringify({
          code: String(values.code).trim(),
          titleAr: String(values.titleAr).trim(),
          titleEn: String(values.titleEn || '').trim() || undefined,
          descriptionAr:
            String(values.descriptionAr || '').trim() || undefined,
          gradeId: values.gradeId || undefined,
          subjectId: values.subjectId || undefined,
          termId: values.termId || undefined,
          coverImageUrl,
        }),
      });
      const courseId = response.data.id as string;
      const priceText = String(values.priceAmount || '').trim();
      if (isFree || priceText) {
        await fetchApi(`/admin/v1/products/course/${courseId}/commerce`, {
          method: 'POST',
          body: JSON.stringify({
            titleAr: String(values.titleAr).trim(),
            titleEn: String(values.titleEn || '').trim() || undefined,
            descriptionAr:
              String(values.descriptionAr || '').trim() || undefined,
            coverImageUrl,
            priceAmount: isFree ? 0 : Number(priceText),
            currency: 'EGP',
          }),
        });
      }
      toast.success('تم إنشاء الكورس كمسودة');
      router.push(`/dashboard/courses/${courseId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر إنشاء الكورس');
    } finally {
      setSaving(false);
    }
  };

  if (!academic) return <PageSkeleton cards={4} />;

  return (
    <div className="mx-auto max-w-4xl space-y-6" dir="rtl">
      <PageHeader
        eyebrow="المحتوى الأكاديمي"
        title="إنشاء كورس جديد"
        description="أنشئ الهوية والتصنيف والسعر أولاً. سيبدأ الكورس كمسودة آمنة."
        actions={
          <Button variant="ghost" onClick={() => router.push('/dashboard/courses')}>
            <ArrowRight className="size-4" />
            العودة
          </Button>
        }
      />

      <form className="space-y-5" onSubmit={submit}>
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div>
              <p className="text-xs font-bold text-brand-600">1. الهوية</p>
              <h2 className="mt-1 text-xl font-black">بيانات الكورس الأساسية</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input name="titleAr" label="الاسم بالعربية" required />
              <Input
                name="titleEn"
                label="الاسم بالإنجليزية"
                directionMode="ltr"
              />
              <Input
                name="code"
                label="الكود الثابت"
                directionMode="ltr"
                required
                hint="لا تستخدم مسافات. مثال: eng-g3-t1"
              />
            </div>
            <Textarea name="descriptionAr" label="الوصف المختصر" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 pt-6">
            <div>
              <p className="text-xs font-bold text-brand-600">2. التصنيف</p>
              <h2 className="mt-1 text-xl font-black">السياق الأكاديمي</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Select name="gradeId" label="المرحلة">
                <option value="">كل المراحل</option>
                {academic.grades.map((grade) => (
                  <option key={grade.id} value={grade.id}>
                    {grade.nameAr}
                  </option>
                ))}
              </Select>
              <Select name="subjectId" label="المادة">
                <option value="">بدون مادة</option>
                {academic.subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.nameAr}
                  </option>
                ))}
              </Select>
              <Select name="termId" label="الفصل الدراسي">
                <option value="">بدون فصل</option>
                {academic.cohorts.flatMap((cohort) =>
                  cohort.terms.map((term) => (
                    <option key={term.id} value={term.id}>
                      {term.titleAr}
                    </option>
                  )),
                )}
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 pt-6">
            <div>
              <p className="text-xs font-bold text-brand-600">3. العرض والوصول</p>
              <h2 className="mt-1 text-xl font-black">الغلاف والسعر الأولي</h2>
            </div>
            <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface-2 p-5 text-center">
              <ImageIcon className="size-7 text-brand-600" />
              <strong>{coverFile ? coverFile.name : 'اختر صورة غلاف'}</strong>
              <span className="text-xs text-ink-3">JPEG أو PNG أو WebP</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                name="priceAmount"
                type="number"
                min="0"
                step="1"
                label="السعر بالجنيه"
                disabled={isFree}
              />
              <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-border px-4 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={isFree}
                  onChange={(event) => setIsFree(event.target.checked)}
                />
                هذا الكورس مجاني
              </label>
            </div>
          </CardContent>
        </Card>

        <div className="sticky bottom-3 z-10 flex justify-end rounded-2xl border border-border bg-surface/95 p-3 shadow-lg backdrop-blur">
          <Button type="submit" loading={saving} size="lg">
            إنشاء الكورس كمسودة
          </Button>
        </div>
      </form>
    </div>
  );
}
