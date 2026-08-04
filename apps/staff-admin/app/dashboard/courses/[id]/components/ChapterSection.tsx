'use client';

import { KeyboardEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Archive, ArrowLeft, Pencil, Plus } from 'lucide-react';
import { Badge, Button } from '@bahrawy/ui';
import { fetchApi } from '../../../../../lib/api';
import { InlineForm } from './InlineForm';
import type { ChapterRecord } from './types';
import { ReasonActionDialog } from '../../../_components/ReasonActionDialog';

type ChapterSectionProps = {
  chapter: ChapterRecord;
  courseId: string;
  onReload: () => Promise<void>;
};

export function ChapterSection({
  chapter,
  courseId,
  onReload,
}: ChapterSectionProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [addingUnit, setAddingUnit] = useState(false);
  const [editTitle, setEditTitle] = useState(chapter.titleAr);
  const [archiveOpen, setArchiveOpen] = useState(false);

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

  const archiveChapter = async (reason: string) => {
    await fetchApi(`/admin/v1/courses/chapter/${chapter.id}/content`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'ARCHIVED',
        version: chapter.version,
        reason,
      }),
    });
    toast.success('تمت أرشفة الفصل مع الاحتفاظ بمحتواه');
    await onReload();
  };

  const addUnit = async (title: string) => {
    const unitResponse = await fetchApi(
      `/admin/v1/courses/chapters/${chapter.id}/units`,
      {
        method: 'POST',
        body: JSON.stringify({ titleAr: title }),
      },
    );
    const unitId = unitResponse.data.id as string;
    toast.success('تمت إضافة الوحدة كمسودة');
    setAddingUnit(false);
    router.push(`/dashboard/courses/${courseId}/units/${unitId}`);
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
            onClick={() => setArchiveOpen(true)}
            className="rounded px-2 py-1 text-sm text-danger transition-colors hover:bg-danger/10"
            aria-label="أرشفة الفصل"
          >
            <Archive className="size-4" />
          </button>
          <Button size="sm" variant="outline" onClick={() => setAddingUnit(true)}>
            <Plus className="ms-1 size-4" />
            وحدة
          </Button>
        </div>
      </div>

      <div className="divide-y divide-border-default/30">
        {chapter.units.map((unit, index) => (
          <button
            key={unit.id}
            type="button"
            onClick={() => router.push(`/dashboard/courses/${courseId}/units/${unit.id}`)}
            className="group flex min-h-20 w-full items-center gap-4 bg-canvas/30 p-4 text-start transition hover:bg-surface-2"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 font-black text-brand-700">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <strong className="text-base text-ink">{unit.titleAr}</strong>
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
              </span>
              <span className="mt-1 block text-xs text-ink-3">
                {unit.lessons.length} درس · {unit.assessments.length} اختبار
              </span>
            </span>
            <ArrowLeft className="size-5 shrink-0 text-ink-3 transition group-hover:-translate-x-1 group-hover:text-brand-600" />
          </button>
        ))}

        {chapter.units.length === 0 && !addingUnit && (
          <div className="p-6 text-center text-sm text-text-muted">
            لا توجد وحدات في هذا الفصل — أضف أول وحدة
          </div>
        )}

        {addingUnit && (
          <div className="p-4">
            <InlineForm
              label="اسم الوحدة"
              placeholder="مثال: الوحدة الأولى — أساسيات اللغة"
              onSave={addUnit}
              onCancel={() => setAddingUnit(false)}
            />
          </div>
        )}
      </div>
      <ReasonActionDialog
        open={archiveOpen}
        title="أرشفة الفصل"
        description={`سيختفي الفصل "${chapter.titleAr}" ومحتواه من العمل اليومي، مع الاحتفاظ بكل البيانات وإمكانية الاستعادة لاحقاً.`}
        confirmLabel="أرشفة الفصل"
        onClose={() => setArchiveOpen(false)}
        onConfirm={archiveChapter}
      />
    </section>
  );
}
