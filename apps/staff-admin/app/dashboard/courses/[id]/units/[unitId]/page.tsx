'use client';

import { FormEvent, use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ClipboardCheck, FileText, Plus, Video } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Drawer,
  ErrorState,
  Input,
  PageSkeleton,
  Select,
} from '@bahrawy/ui';
import { fetchApi } from '../../../../../../lib/api';
import type { ContentItem, UnitRecord } from '../../components/types';

type UnitDetail = UnitRecord & {
  chapter: {
    id: string;
    titleAr: string;
    course: { id: string; titleAr: string };
  };
};

export default function UnitEditorPage({
  params,
}: {
  params: Promise<{ id: string; unitId: string }>;
}) {
  const { id: courseId, unitId } = use(params);
  const router = useRouter();
  const [unit, setUnit] = useState<UnitDetail | null>(null);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await fetchApi(`/admin/v1/courses/units/${unitId}`);
      setUnit(response.data as UnitDetail);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذر تحميل الوحدة');
    }
  }, [unitId]);

  useEffect(() => {
    void load();
  }, [load]);

  const createLesson = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setSaving(true);
    try {
      const contentType = String(values.contentType || 'VIDEO');
      const response = await fetchApi(`/admin/v1/courses/units/${unitId}/lessons`, {
        method: 'POST',
        body: JSON.stringify({
          titleAr: String(values.titleAr).trim(),
          titleEn: String(values.titleEn || '').trim() || undefined,
          contentType,
          requiresPreviousLessonPass: Boolean(values.requiresPreviousLessonPass),
        }),
      });
      const lessonId = response.data.id;
      if (contentType === 'EXAM') {
        const assessmentResponse = await fetchApi(`/admin/v1/assessments/lessons/${lessonId}`, {
          method: 'POST',
          body: JSON.stringify({
            titleAr: String(values.titleAr).trim() || 'امتحان',
            type: 'QUIZ',
            durationMinutes: 30,
            shuffleQuestions: true,
            resultReleaseRule: 'MANUAL',
          }),
        });
        setCreateOpen(false);
        router.push(`/dashboard/courses/${courseId}/assessments/${assessmentResponse.data.id}`);
        return;
      }
      toast.success('تم إنشاء الدرس كمسودة');
      setCreateOpen(false);
      router.push(`/dashboard/courses/${courseId}/units/${unitId}/lessons/${lessonId}`);
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : 'تعذر إنشاء الدرس');
    } finally {
      setSaving(false);
    }
  };

  if (error && !unit) {
    return <ErrorState title="تعذر تحميل الوحدة" description={error} onRetry={load} />;
  }
  if (!unit) return <PageSkeleton cards={4} />;

  return (
    <div className="mx-auto max-w-5xl space-y-6" dir="rtl">
      <header className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold text-brand-600">
            {unit.chapter.course.titleAr} · {unit.chapter.titleAr}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-black">{unit.titleAr}</h1>
            <Badge
              tone={
                unit.status === 'PUBLISHED'
                  ? 'success'
                  : unit.status === 'ARCHIVED'
                    ? 'neutral'
                    : 'amber'
              }
            >
              {unit.status === 'PUBLISHED'
                ? 'منشورة'
                : unit.status === 'ARCHIVED'
                  ? 'مؤرشفة'
                  : 'مسودة'}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-ink-3">
            إدارة الدروس والمتطلبات والتقييمات الخاصة بهذه الوحدة فقط.
          </p>
        </div>
        <Button leadingIcon={<Plus className="size-4" />} onClick={() => setCreateOpen(true)}>
          درس جديد
        </Button>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <Metric label="الدروس" value={unit.lessons.length} />
        <Metric label="الاختبارات" value={unit.assessments.length} />
        <Metric label="المتطلب السابق" value={unit.prerequisiteAssessment ? 'محدد' : 'غير محدد'} />
      </section>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-brand-600">محتوى الوحدة</p>
              <h2 className="mt-1 text-xl font-black">الدروس</h2>
            </div>
          </div>

          {unit.lessons.length ? (
            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
              {unit.lessons.map((lesson, index) => (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  index={index + 1}
                  onOpen={() =>
                    lesson.contentType === 'EXAM' && lesson.assessments?.[0]?.id
                      ? router.push(
                          `/dashboard/courses/${courseId}/assessments/${lesson.assessments[0].id}`,
                        )
                      : router.push(
                          `/dashboard/courses/${courseId}/units/${unitId}/lessons/${lesson.id}`,
                        )
                  }
                />
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="flex min-h-40 w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border text-ink-3 hover:border-brand-400 hover:text-brand-700"
            >
              <Plus className="size-7" />
              <strong>أضف أول درس داخل الوحدة</strong>
            </button>
          )}
        </CardContent>
      </Card>

      <Drawer
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="إنشاء درس داخل الوحدة"
        footer={
          <Button type="submit" form="create-unit-lesson" loading={saving}>
            إنشاء وفتح الدرس
          </Button>
        }
      >
        <form id="create-unit-lesson" className="space-y-4" onSubmit={createLesson}>
          <Input name="titleAr" label="اسم الدرس بالعربية" required />
          <Input name="titleEn" label="اسم الدرس بالإنجليزية" directionMode="ltr" />
          <Select name="contentType" label="نوع المحتوى" defaultValue="VIDEO">
            <option value="VIDEO">فيديو</option>
            <option value="PDF">ملف PDF</option>
            <option value="TEXT">محتوى نصي</option>
            <option value="EXAM">امتحان</option>
          </Select>
          <div className="space-y-3 rounded-2xl border border-border bg-canvas/50 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-interactive"
                name="requiresPreviousLessonPass"
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
          <p className="rounded-xl bg-surface-2 p-3 text-sm text-ink-3">
            يبدأ الدرس كمسودة. ستضيف الملف أو رابط الفيديو في شاشة الدرس التالية. عند اختيار
            «امتحان» ستفتح لوحة الامتحان مباشرة لإضافة الموقت والأسئلة.
          </p>
        </form>
      </Drawer>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs text-ink-3">{label}</p>
      <strong className="mt-1 block text-xl">{value}</strong>
    </div>
  );
}

function LessonRow({
  lesson,
  index,
  onOpen,
}: {
  lesson: ContentItem;
  index: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex min-h-20 w-full items-center gap-4 bg-surface p-4 text-start hover:bg-surface-2"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 font-black text-brand-700">
        {index}
      </span>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-3 text-ink-3">
        {lesson.contentType === 'VIDEO' ? (
          <Video className="size-5" />
        ) : lesson.contentType === 'EXAM' ? (
          <ClipboardCheck className="size-5" />
        ) : (
          <FileText className="size-5" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block truncate">{lesson.titleAr}</strong>
        <span className="mt-1 block text-xs text-ink-3">
          {lesson.contentType === 'EXAM' ? 'امتحان' : lesson.contentType} · {lesson.status}
        </span>
      </span>
      <ArrowLeft className="size-5 text-ink-3 transition group-hover:-translate-x-1" />
    </button>
  );
}
