'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, ChevronRight, Edit3 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Drawer, Input, Select } from '@bahrawy/ui';
import { API_BASE, fetchApi } from '../../../../../lib/api';
import type { CourseWithContent } from './types';
import { LifecycleDialog } from '../../../_components/LifecycleDialog';

type CourseHeaderProps = {
  course: CourseWithContent;
  onReload: () => Promise<void>;
};

function toLocalDateTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function CourseHeader({ course, onReload }: CourseHeaderProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lifecycleOpen, setLifecycleOpen] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [isFree, setIsFree] = useState(
    Number(course.courseProduct?.prices?.[0]?.amount ?? -1) === 0,
  );

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setSaving(true);
    try {
      let coverImageUrl = course.coverImageUrl;
      if (coverFile) {
        const upload = new FormData();
        upload.append('file', coverFile);
        const uploaded = await fetchApi('/storage/upload', {
          method: 'POST',
          body: upload,
          timeoutMs: 60_000,
        });
        coverImageUrl = `/storage/${uploaded.data.storedObjectId}`;
      }
      await fetchApi(`/admin/v1/courses/${course.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          titleAr: values.titleAr,
          titleEn: values.titleEn || undefined,
          descriptionAr: values.descriptionAr || undefined,
          coverImageUrl,
          status: values.status,
          publishAt: values.publishAt ? new Date(String(values.publishAt)).toISOString() : null,
          unpublishAt: values.unpublishAt
            ? new Date(String(values.unpublishAt)).toISOString()
            : null,
          version: course.version,
        }),
      });
      if (isFree || String(values.priceAmount || '').trim()) {
        await fetchApi(`/admin/v1/products/course/${course.id}/commerce`, {
          method: 'POST',
          body: JSON.stringify({
            titleAr: values.titleAr,
            titleEn: values.titleEn || undefined,
            descriptionAr: values.descriptionAr || undefined,
            coverImageUrl,
            priceAmount: isFree ? 0 : Number(values.priceAmount),
            version: course.courseProduct?.version,
          }),
        });
      }
      toast.success('تم تحديث الكورس');
      setOpen(false);
      setCoverFile(null);
      if (values.status === 'ARCHIVED') {
        router.push('/dashboard/courses');
        return;
      }
      await onReload();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : 'تعذر تحديث الكورس');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <header className="flex flex-col items-start justify-between gap-4 border-y border-border py-5 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/dashboard/courses')}
            aria-label="العودة إلى الكورسات"
          >
            <ChevronRight className="size-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-ink">{course.titleAr}</h1>
            <span className="font-mono text-xs text-ink-3" dir="ltr">
              {course.code}
            </span>
          </div>
          <span
            className={`border px-2 py-1 text-xs font-bold ${
              course.status === 'PUBLISHED'
                ? 'border-success/30 bg-success/10 text-success'
                : course.status === 'ARCHIVED'
                  ? 'border-border text-ink-3'
                  : 'border-amber-300 bg-amber-50 text-amber-800'
            }`}
          >
            {course.status === 'PUBLISHED'
              ? 'منشور'
              : course.status === 'ARCHIVED'
                ? 'مؤرشف'
                : 'مسودة'}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setOpen(true)}>
            <Edit3 className="size-4" />
            إعدادات الكورس
          </Button>
          <Button variant="ghost" onClick={() => setLifecycleOpen(true)}>
            <Archive className="size-4" />
            {course.status === 'ARCHIVED'
              ? 'استعادة أو حذف الكورس'
              : 'أرشفة أو حذف الكورس'}
          </Button>
        </div>
      </header>
      <Drawer
        isOpen={open}
        onClose={() => setOpen(false)}
        title="إعدادات الكورس والنشر"
        footer={
          <Button className="w-full" form="course-settings" type="submit" loading={saving}>
            حفظ
          </Button>
        }
      >
        <form id="course-settings" className="space-y-4" onSubmit={save}>
          <Input name="titleAr" label="اسم الكورس" defaultValue={course.titleAr} required />
          <Input
            name="titleEn"
            label="الاسم بالإنجليزية"
            defaultValue={course.titleEn ?? ''}
            directionMode="ltr"
          />
          <Input name="descriptionAr" label="الوصف" defaultValue={course.descriptionAr ?? ''} />
          <Input
            name="priceAmount"
            type="number"
            min="0"
            step="1"
            label="سعر شراء الكورس كاملاً (EGP)"
            defaultValue={String(course.courseProduct?.prices?.[0]?.amount ?? '')}
            placeholder="مثال: 500"
            disabled={isFree}
          />
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-brand-200 bg-brand-50/60 p-3 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              checked={isFree}
              onChange={(event) => setIsFree(event.target.checked)}
              className="size-4 accent-brand-600"
            />
            <span>هذا الكورس مجاني</span>
          </label>
          <Select name="status" label="الحالة" defaultValue={course.status}>
            <option value="DRAFT">مسودة</option>
            <option value="PUBLISHED">منشور</option>
          </Select>
          <label className="block space-y-2 text-sm font-bold text-ink">
            صورة الكورس
            {course.coverImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`${API_BASE}${course.coverImageUrl}`}
                alt={course.titleAr}
                className="aspect-video w-full border border-border object-cover"
              />
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)}
              className="block w-full border border-border bg-surface-1 p-3 text-sm"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Input
              name="publishAt"
              type="datetime-local"
              label="موعد النشر"
              defaultValue={toLocalDateTime(course.publishAt)}
            />
            <Input
              name="unpublishAt"
              type="datetime-local"
              label="موعد إيقاف النشر"
              defaultValue={toLocalDateTime(course.unpublishAt)}
            />
          </div>
          <p className="border-t border-border pt-4 text-sm text-ink-3">
            تغيير حالة الكورس لا يغير حالات الدروس تلقائياً.
          </p>
        </form>
      </Drawer>
      <LifecycleDialog
        open={lifecycleOpen}
        endpoint={`/admin/v1/courses/${course.id}`}
        version={course.version}
        onClose={() => setLifecycleOpen(false)}
        onComplete={async (action) => {
          toast.success(
            action === 'RESTORE'
              ? 'تمت استعادة الكورس كمسودة'
              : action === 'PERMANENT_DELETE'
                ? 'تم حذف مسودة الكورس نهائياً'
                : 'تمت أرشفة الكورس',
          );
          if (action !== 'RESTORE') {
            router.push('/dashboard/courses');
            return;
          }
          await onReload();
        }}
      />
    </>
  );
}
