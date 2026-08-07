'use client';

import { FormEvent, use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Badge,
  Button,
  Card,
  CardContent,
  ErrorState,
  Input,
  PageSkeleton,
  Select,
} from '@bahrawy/ui';
import { fetchApi } from '../../../../../../../../lib/api';
import { PdfUploadArea } from '../../../../components/PdfUploadArea';
import { VideoUploadArea } from '../../../../components/VideoUploadArea';
import type { ContentItem } from '../../../../components/types';
import { LessonQuizSection } from './LessonQuizSection';

type LessonDetail = ContentItem & {
  unit: {
    id: string;
    titleAr: string;
    chapter: { course: { id: string; titleAr: string } };
  };
};

export default function LessonEditorPage({
  params,
}: {
  params: Promise<{ id: string; unitId: string; lessonId: string }>;
}) {
  const { id: courseId, unitId, lessonId } = use(params);
  const router = useRouter();
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await fetchApi(`/admin/v1/courses/lessons/${lessonId}`);
      setLesson(response.data as LessonDetail);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'تعذر تحميل الدرس',
      );
    }
  }, [lessonId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!lesson) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setSaving(true);
    try {
      await fetchApi(`/admin/v1/courses/lesson/${lesson.id}/content`, {
        method: 'PATCH',
        body: JSON.stringify({
          titleAr: String(values.titleAr).trim(),
          titleEn: String(values.titleEn || '').trim() || undefined,
          contentType: values.contentType,
          status: values.status,
          version: lesson.version,
        }),
      });
      toast.success('تم حفظ بيانات الدرس');
      await load();
    } catch (requestError) {
      toast.error(
        requestError instanceof Error ? requestError.message : 'تعذر حفظ الدرس',
      );
    } finally {
      setSaving(false);
    }
  };

  if (error && !lesson) {
    return <ErrorState title="تعذر تحميل الدرس" description={error} onRetry={load} />;
  }
  if (!lesson) return <PageSkeleton cards={4} />;

  return (
    <div className="mx-auto max-w-5xl space-y-6" dir="rtl">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold text-brand-600">
            {lesson.unit.chapter.course.titleAr} · {lesson.unit.titleAr}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-black">{lesson.titleAr}</h1>
            <Badge
              tone={
                lesson.status === 'PUBLISHED'
                  ? 'success'
                  : lesson.status === 'ARCHIVED'
                    ? 'neutral'
                    : 'amber'
              }
            >
              {lesson.status}
            </Badge>
          </div>
        </div>
        <Button
          variant="ghost"
          onClick={() =>
            router.push(`/dashboard/courses/${courseId}/units/${unitId}`)
          }
        >
          <ArrowRight className="size-4" />
          العودة للوحدة
        </Button>
      </header>

      <section className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardContent className="pt-6">
            <form className="space-y-4" onSubmit={save}>
              <div>
                <p className="text-xs font-bold text-brand-600">بيانات الدرس</p>
                <h2 className="mt-1 text-xl font-black">الهوية والنشر</h2>
              </div>
              <Input
                name="titleAr"
                label="اسم الدرس"
                defaultValue={lesson.titleAr}
                required
              />
              <Input
                name="titleEn"
                label="الاسم بالإنجليزية"
                directionMode="ltr"
                defaultValue={lesson.titleEn ?? ''}
              />
              <Select
                name="contentType"
                label="نوع المحتوى"
                defaultValue={lesson.contentType}
              >
                <option value="VIDEO">فيديو</option>
                <option value="PDF">ملف PDF</option>
                <option value="TEXT">محتوى نصي</option>
              </Select>
              <Select name="status" label="حالة النشر" defaultValue={lesson.status}>
                <option value="DRAFT">مسودة</option>
                <option value="PUBLISHED">منشور</option>
                <option value="ARCHIVED">مؤرشف</option>
              </Select>
              <Button type="submit" loading={saving} leadingIcon={<Save className="size-4" />}>
                حفظ الدرس
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 pt-6">
            <div>
              <p className="text-xs font-bold text-brand-600">المحتوى</p>
              <h2 className="mt-1 text-xl font-black">
                {lesson.contentType === 'VIDEO'
                  ? 'مصدر الفيديو'
                  : lesson.contentType === 'PDF'
                    ? 'ملف الدرس'
                    : 'المحتوى النصي'}
              </h2>
            </div>
            {lesson.contentType === 'VIDEO' ? (
              <VideoUploadArea videoItem={lesson} onReload={load} />
            ) : lesson.contentType === 'PDF' ? (
              <PdfUploadArea pdfItem={lesson} unitId={unitId} onReload={load} />
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-6 text-sm leading-7 text-ink-3">
                المحتوى النصي سيُحفظ من محرر النصوص في الإصدار التالي. يمكنك الآن
                حفظ بيانات الدرس كمسودة دون نشره.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <LessonQuizSection lessonId={lesson.id} />
      </section>
    </div>
  );
}
