'use client';

import { KeyboardEvent, useState } from 'react';
import toast from 'react-hot-toast';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@bahrawy/ui';
import { fetchApi } from '../../../../../lib/api';
import { InlineForm } from './InlineForm';
import { LessonCard } from './LessonCard';
import type {
  AssessmentPrerequisiteOption,
  AssessmentRecord,
  ChapterRecord,
} from './types';

type ChapterSectionProps = {
  chapter: ChapterRecord;
  courseId: string;
  assessmentByLessonId?: Record<string, AssessmentRecord>;
  prerequisiteOptions: AssessmentPrerequisiteOption[];
  unitPositions: Record<string, number>;
  onReload: () => Promise<void>;
};

export function ChapterSection({
  chapter,
  courseId,
  assessmentByLessonId,
  prerequisiteOptions,
  unitPositions,
  onReload,
}: ChapterSectionProps) {
  const [editing, setEditing] = useState(false);
  const [addingLesson, setAddingLesson] = useState(false);
  const [editTitle, setEditTitle] = useState(chapter.titleAr);

  const rename = async () => {
    const trimmed = editTitle.trim();
    if (!trimmed || trimmed === chapter.titleAr) {
      setEditing(false);
      setEditTitle(chapter.titleAr);
      return;
    }
    try {
      await fetchApi(`/admin/v1/courses/chapter/${chapter.id}/content`, {
        method: 'PATCH',
        body: JSON.stringify({ titleAr: trimmed, version: chapter.version }),
      });
      toast.success('تم تعديل اسم الفصل');
      setEditing(false);
      await onReload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'فشل تعديل الفصل');
    }
  };

  const deleteChapter = async () => {
    if (
      !confirm(
        `هل أنت متأكد من حذف الفصل "${chapter.titleAr}"؟ سيتم حذف كل الدروس داخله.`,
      )
    ) {
      return;
    }
    try {
      await fetchApi(`/admin/v1/courses/chapter/${chapter.id}/content`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'ARCHIVED', version: chapter.version }),
      });
      toast.success('تم حذف الفصل');
      await onReload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'فشل حذف الفصل');
    }
  };

  const addLesson = async (title: string) => {
    const unitResponse = await fetchApi(
      `/admin/v1/courses/chapters/${chapter.id}/units`,
      {
        method: 'POST',
        body: JSON.stringify({ titleAr: title }),
      },
    );
    const unitId = unitResponse.data.id as string;
    await fetchApi(`/admin/v1/courses/units/${unitId}/lessons`, {
      method: 'POST',
      body: JSON.stringify({ titleAr: title, contentType: 'VIDEO' }),
    });
    toast.success('تمت إضافة الدرس');
    setAddingLesson(false);
    await onReload();
  };

  const handleTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') void rename();
    if (event.key === 'Escape') {
      setEditing(false);
      setEditTitle(chapter.titleAr);
    }
  };

  return (
    <section className="overflow-hidden rounded-xl border border-border-default">
      <div className="flex items-center justify-between gap-4 border-b border-border-default bg-surface px-5 py-4">
        {editing ? (
          <input
            autoFocus
            value={editTitle}
            onChange={(event) => setEditTitle(event.target.value)}
            onBlur={() => void rename()}
            onKeyDown={handleTitleKeyDown}
            className="me-4 flex-1 border-b border-brand-500 bg-transparent text-lg font-bold outline-none"
          />
        ) : (
          <h3 className="flex-1 text-lg font-bold text-primary">{chapter.titleAr}</h3>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setEditTitle(chapter.titleAr);
            }}
            className="rounded px-2 py-1 text-sm text-text-muted transition-colors hover:bg-canvas hover:text-primary"
            aria-label="تعديل اسم الفصل"
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => void deleteChapter()}
            className="rounded px-2 py-1 text-sm text-danger transition-colors hover:bg-danger/10"
            aria-label="حذف الفصل"
          >
            <Trash2 className="size-4" />
          </button>
          <Button size="sm" variant="outline" onClick={() => setAddingLesson(true)}>
            <Plus className="ms-1 size-4" />
            درس
          </Button>
        </div>
      </div>

      <div className="divide-y divide-border-default/30">
        {chapter.units.map((unit, index) => (
          <LessonCard
            key={unit.id}
            unit={unit}
            index={index + 1}
            chapterId={chapter.id}
            courseId={courseId}
            assessmentByLessonId={assessmentByLessonId}
            prerequisiteOptions={prerequisiteOptions}
            unitPosition={unitPositions[unit.id] ?? 0}
            onReload={onReload}
          />
        ))}

        {chapter.units.length === 0 && !addingLesson && (
          <div className="p-6 text-center text-sm text-text-muted">
            لا يوجد دروس في هذا الفصل — أضف أول درس
          </div>
        )}

        {addingLesson && (
          <div className="p-4">
            <InlineForm
              label="اسم الدرس"
              placeholder="مثال: الدوال وأنواعها"
              onSave={addLesson}
              onCancel={() => setAddingLesson(false)}
            />
          </div>
        )}
      </div>
    </section>
  );
}
