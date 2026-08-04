'use client';

import { use, useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';
import { ErrorState, PageSkeleton } from '@bahrawy/ui';
import { fetchApi } from '../../../../../lib/api';
import { ChapterSection } from '../components/ChapterSection';
import { InlineForm } from '../components/InlineForm';
import type { CourseWithContent } from '../components/types';

export default function CourseCurriculumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [course, setCourse] = useState<CourseWithContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingChapter, setAddingChapter] = useState(false);
  const [error, setError] = useState('');

  const loadCourse = useCallback(async () => {
    setError('');
    try {
      const response = await fetchApi(`/admin/v1/courses/${id}`);
      const loadedCourse = response.data as CourseWithContent;
      setCourse(loadedCourse);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'فشل تحميل الكورس');
      toast.error('فشل تحميل الكورس');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadCourse();
  }, [loadCourse]);

  const reload = async () => {
    const courseId = course?.id ?? id;
    const response = await fetchApi(`/admin/v1/courses/${courseId}`);
    setCourse(response.data as CourseWithContent);
  };

  const addChapter = async (title: string) => {
    const courseId = course?.id ?? id;
    await fetchApi(`/admin/v1/courses/${courseId}/chapters`, {
      method: 'POST',
      body: JSON.stringify({ titleAr: title }),
    });
    toast.success('تمت إضافة الفصل');
    setAddingChapter(false);
    await reload();
  };

  if (loading) return <PageSkeleton cards={5} />;

  if (!course) {
    return (
      <div className="mx-auto max-w-3xl">
        <ErrorState
          title="تعذر فتح محرر الكورس"
          description={error || 'تحقق من الاتصال بالخادم ثم حاول مرة أخرى.'}
          onRetry={() => {
            setLoading(true);
            void loadCourse();
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-20">
      <header className="rounded-2xl border border-border bg-surface p-5">
        <p className="text-xs font-bold text-brand-600">بناء المنهج</p>
        <h1 className="mt-1 text-2xl font-black text-ink">{course.titleAr}</h1>
        <p className="mt-2 text-sm text-ink-3">
          نظّم الفصول والوحدات أولاً، ثم افتح كل وحدة لإضافة دروسها ومحتواها.
        </p>
      </header>

      {course.chapters.map((chapter) => (
        <ChapterSection
          key={chapter.id}
          chapter={chapter}
          courseId={course.id}
          onReload={reload}
        />
      ))}

      {course.chapters.length === 0 && !addingChapter && (
        <div className="rounded-xl border border-dashed border-border-default bg-surface p-8 text-center text-sm text-text-muted">
          لا توجد فصول بعد — أضف أول فصل ثم أضف الدروس داخله.
        </div>
      )}

      {addingChapter ? (
        <InlineForm
          label="اسم الفصل الجديد"
          placeholder="مثال: الفصل الأول — المقدمة"
          onSave={addChapter}
          onCancel={() => setAddingChapter(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAddingChapter(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border-default p-4 text-text-muted transition-colors hover:border-brand-400 hover:text-brand-700"
        >
          <Plus className="size-4" />
          إضافة فصل جديد
        </button>
      )}
    </div>
  );
}
