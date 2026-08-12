'use client';

import { FormEvent, use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ClipboardCheck, Save } from 'lucide-react';
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
      setError(requestError instanceof Error ? requestError.message : 'تعذر تحميل الدرس');
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
          requiresPreviousLessonPass: Boolean(values.requiresPreviousLessonPass),
          version: lesson.version,
        }),
      });
      toast.success('تم حفظ بيانات الدرس');
      await load();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : 'تعذر حفظ الدرس');
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
          onClick={() => router.push(`/dashboard/courses/${courseId}/units/${unitId}`)}
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
              <Input name="titleAr" label="اسم الدرس" defaultValue={lesson.titleAr} required />
              <Input
                name="titleEn"
                label="الاسم بالإنجليزية"
                directionMode="ltr"
                defaultValue={lesson.titleEn ?? ''}
              />
              <Select name="contentType" label="نوع المحتوى" defaultValue={lesson.contentType}>
                <option value="VIDEO">فيديو</option>
                <option value="PDF">ملف PDF</option>
                <option value="TEXT">محتوى نصي</option>
                <option value="EXAM">امتحان</option>
              </Select>
              <Select name="status" label="حالة النشر" defaultValue={lesson.status}>
                <option value="DRAFT">مسودة</option>
                <option value="PUBLISHED">منشور</option>
                <option value="ARCHIVED">مؤرشف</option>
              </Select>
              <div className="space-y-3 rounded-2xl border border-border bg-canvas/50 p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-interactive"
                    name="requiresPreviousLessonPass"
                    defaultChecked={Boolean(lesson.requiresPreviousLessonPass)}
                  />
                  <span className="text-sm font-semibold">
                    قفل الدرس حتى اجتياز اختبار الدرس السابق
                  </span>
                </label>
                <p className="text-xs leading-6 text-ink-3">
                  عند التفعيل لن يستطيع الطالب فتح هذا الدرس إلا بعد اجتياز اختبار الدرس السابق. عند
                  إيقاف التفعيل يُفتح الدرس للطالب بشكل طبيعي.
                </p>
              </div>
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
                    : lesson.contentType === 'EXAM'
                      ? 'لوحة الامتحان'
                      : 'المحتوى النصي'}
              </h2>
            </div>
            {lesson.contentType === 'VIDEO' ? (
              <VideoUploadArea videoItem={lesson} onReload={load} />
            ) : lesson.contentType === 'PDF' ? (
              <PdfUploadArea pdfItem={lesson} unitId={unitId} onReload={load} />
            ) : lesson.contentType === 'EXAM' ? (
              <div className="flex flex-col items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50/60 p-5 dark:border-brand-900 dark:bg-brand-950/20">
                <p className="text-sm leading-7 text-ink-3">
                  هذا الدرس امتحان يُدار من لوحة الامتحان (المؤقت، الأسئلة، درجة النجاح). افتح
                  اللوحة لإضافة الأسئلة وتفعيل مؤقت الامتحان.
                </p>
                <Button
                  leadingIcon={<ClipboardCheck className="size-4" />}
                  onClick={() => {
                    const assessmentId = lesson.assessments?.[0]?.id;
                    if (assessmentId) {
                      router.push(`/dashboard/courses/${courseId}/assessments/${assessmentId}`);
                    }
                  }}
                >
                  فتح لوحة الامتحان
                </Button>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-6 text-sm leading-7 text-ink-3">
                المحتوى النصي سيُحفظ من محرر النصوص في الإصدار التالي. يمكنك الآن حفظ بيانات الدرس
                كمسودة دون نشره.
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
