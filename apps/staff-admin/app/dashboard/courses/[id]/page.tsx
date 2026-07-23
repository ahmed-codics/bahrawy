'use client';

import { use, useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';
import { ErrorState, PageSkeleton } from '@bahrawy/ui';
import { fetchApi } from '../../../../lib/api';
import { ChapterSection } from './components/ChapterSection';
import { CourseHeader } from './components/CourseHeader';
import { InlineForm } from './components/InlineForm';
import type { AssessmentPrerequisiteOption, CourseWithContent } from './components/types';

export default function CourseEditorPage({ params }: { params: Promise<{ id: string }> }) {
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

  const prerequisiteOptions: AssessmentPrerequisiteOption[] = [];
  const unitPositions: Record<string, number> = {};
  let unitPosition = 0;
  for (const chapter of course.chapters) {
    for (const unit of chapter.units) {
      unitPositions[unit.id] = unitPosition;
      const videoItem = unit.lessons.find((lesson) => lesson.contentType === 'VIDEO');
      const assessment =
        unit.assessments[0] ??
        (videoItem ? (course.assessmentByLessonId?.[videoItem.id] ?? null) : null);
      if (assessment) {
        prerequisiteOptions.push({
          id: assessment.id,
          titleAr: assessment.titleAr,
          type: assessment.type,
          unitId: unit.id,
          unitTitleAr: unit.titleAr,
          position: unitPosition,
        });
      }
      unitPosition += 1;
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-20">
      <CourseHeader course={course} onReload={reload} />

      {course.chapters.map((chapter) => (
        <ChapterSection
          key={chapter.id}
          chapter={chapter}
          courseId={course.id}
          assessmentByLessonId={course.assessmentByLessonId}
          prerequisiteOptions={prerequisiteOptions}
          unitPositions={unitPositions}
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
