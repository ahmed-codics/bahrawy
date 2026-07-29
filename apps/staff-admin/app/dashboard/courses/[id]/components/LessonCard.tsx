'use client';

import { KeyboardEvent, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Archive, ImageIcon, LoaderCircle, LockKeyhole, Pencil, Save } from 'lucide-react';
import { Badge, Button } from '@bahrawy/ui';
import { fetchApi } from '../../../../../lib/api';
import { HomeworkSection } from './HomeworkSection';
import { PdfUploadArea } from './PdfUploadArea';
import { VideoUploadArea } from './VideoUploadArea';
import type { AssessmentPrerequisiteOption, AssessmentRecord, UnitRecord } from './types';

type LessonCardProps = {
  unit: UnitRecord;
  index: number;
  courseId: string;
  assessmentByLessonId?: Record<string, AssessmentRecord>;
  prerequisiteOptions: AssessmentPrerequisiteOption[];
  unitPosition: number;
  onReload: () => Promise<void>;
};

export function LessonCard({
  unit,
  index,
  courseId,
  assessmentByLessonId,
  prerequisiteOptions,
  unitPosition,
  onReload,
}: LessonCardProps) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(unit.titleAr);
  const [selectedPrerequisite, setSelectedPrerequisite] = useState(
    unit.prerequisiteAssessmentId ?? '',
  );
  const [savingPrerequisite, setSavingPrerequisite] = useState(false);
  const [priceAmount, setPriceAmount] = useState(
    String(unit.lessonProduct?.prices?.[0]?.amount ?? ''),
  );
  const [isFree, setIsFree] = useState(
    Number(unit.lessonProduct?.prices?.[0]?.amount ?? -1) === 0,
  );
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);

  useEffect(() => {
    setSelectedPrerequisite(unit.prerequisiteAssessmentId ?? '');
  }, [unit.prerequisiteAssessmentId]);

  useEffect(() => {
    setPriceAmount(String(unit.lessonProduct?.prices?.[0]?.amount ?? ''));
    setIsFree(Number(unit.lessonProduct?.prices?.[0]?.amount ?? -1) === 0);
  }, [unit.lessonProduct]);

  const saveProduct = async () => {
    const parsedPrice = isFree ? 0 : Number(priceAmount);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      toast.error('اكتب سعر صحيح للدرس');
      return;
    }
    setSavingProduct(true);
    try {
      let coverImageUrl = unit.lessonProduct?.coverImageUrl;
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
      await fetchApi(`/admin/v1/products/unit/${unit.id}/commerce`, {
        method: 'POST',
        body: JSON.stringify({
          titleAr: unit.titleAr,
          priceAmount: parsedPrice,
          coverImageUrl,
          version: unit.lessonProduct?.version,
        }),
      });
      toast.success('تم حفظ سعر وصورة الدرس');
      setCoverFile(null);
      await onReload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'فشل حفظ بيانات شراء الدرس');
    } finally {
      setSavingProduct(false);
    }
  };

  const videoItem = useMemo(
    () => unit.lessons.find((lesson) => lesson.contentType === 'VIDEO') ?? null,
    [unit.lessons],
  );
  const pdfItem = useMemo(
    () => unit.lessons.find((lesson) => lesson.contentType === 'PDF') ?? null,
    [unit.lessons],
  );
  const homework =
    unit.assessments[0] ?? (videoItem ? (assessmentByLessonId?.[videoItem.id] ?? null) : null);
  const eligiblePrerequisites = prerequisiteOptions.filter(
    (option) => option.position < unitPosition,
  );

  const changePrerequisite = async (prerequisiteAssessmentId: string) => {
    const previous = selectedPrerequisite;
    setSelectedPrerequisite(prerequisiteAssessmentId);
    setSavingPrerequisite(true);
    try {
      await fetchApi(`/admin/v1/courses/unit/${unit.id}/content`, {
        method: 'PATCH',
        body: JSON.stringify({
          prerequisiteAssessmentId: prerequisiteAssessmentId || null,
          version: unit.version,
        }),
      });
      toast.success(prerequisiteAssessmentId ? 'تم حفظ المتطلب السابق' : 'تم إلغاء المتطلب السابق');
      await onReload();
    } catch (error) {
      setSelectedPrerequisite(previous);
      toast.error(error instanceof Error ? error.message : 'فشل حفظ المتطلب السابق');
    } finally {
      setSavingPrerequisite(false);
    }
  };

  const rename = async () => {
    const trimmed = editTitle.trim();
    if (!trimmed || trimmed === unit.titleAr) {
      setEditing(false);
      setEditTitle(unit.titleAr);
      return;
    }
    try {
      await fetchApi(`/admin/v1/courses/unit/${unit.id}/content`, {
        method: 'PATCH',
        body: JSON.stringify({ titleAr: trimmed, version: unit.version }),
      });
      toast.success('تم تعديل اسم الدرس');
      setEditing(false);
      await onReload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'فشل تعديل الدرس');
    }
  };

  const changeLifecycle = async (status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED') => {
    setChangingStatus(true);
    try {
      await fetchApi(`/admin/v1/courses/units/${unit.id}/lifecycle`, {
        method: 'PATCH',
        body: JSON.stringify({ status, version: unit.version }),
      });
      toast.success(
        status === 'PUBLISHED'
          ? 'تم نشر الدرس ومحتواه'
          : status === 'ARCHIVED'
            ? 'تمت أرشفة الدرس'
            : 'تم تحويل الدرس إلى مسودة',
      );
      await onReload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'فشل تغيير حالة الدرس');
    } finally {
      setChangingStatus(false);
    }
  };

  const handleTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') void rename();
    if (event.key === 'Escape') {
      setEditing(false);
      setEditTitle(unit.titleAr);
    }
  };

  return (
    <div className="space-y-5 bg-canvas/30 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-1 items-center gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">
            {index}
          </span>
          {editing ? (
            <input
              autoFocus
              value={editTitle}
              onChange={(event) => setEditTitle(event.target.value)}
              onBlur={() => void rename()}
              onKeyDown={handleTitleKeyDown}
              className="flex-1 border-b border-brand-500 bg-transparent text-base font-semibold outline-none"
            />
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold text-primary">{unit.titleAr}</span>
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
                  ? 'منشور'
                  : unit.status === 'ARCHIVED'
                    ? 'مؤرشف'
                    : 'مسودة'}
              </Badge>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <select
            aria-label={`حالة الدرس ${unit.titleAr}`}
            value={unit.status}
            disabled={changingStatus}
            onChange={(event) =>
              void changeLifecycle(event.target.value as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED')
            }
            className="h-9 rounded-lg border border-border-default bg-surface px-2 text-xs font-bold text-primary disabled:opacity-60"
          >
            <option value="DRAFT">مسودة</option>
            <option value="PUBLISHED">منشور</option>
            <option value="ARCHIVED">مؤرشف</option>
          </select>
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setEditTitle(unit.titleAr);
            }}
            className="rounded p-1.5 text-text-muted transition-colors hover:bg-canvas hover:text-primary"
            aria-label="تعديل اسم الدرس"
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => void changeLifecycle('ARCHIVED')}
            disabled={changingStatus || unit.status === 'ARCHIVED'}
            className="rounded p-1.5 text-text-muted transition-colors hover:bg-danger/10 hover:text-danger"
            aria-label="أرشفة الدرس"
          >
            <Archive className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-y border-border-default/50 bg-surface-soft/60 px-4 py-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <LockKeyhole className="size-4" />
          </span>
          <div className="min-w-0">
            <label
              htmlFor={`prerequisite-${unit.id}`}
              className="block text-sm font-bold text-primary"
            >
              المتطلب السابق
            </label>
            <p className="truncate text-xs text-text-muted">
              يفتح هذا الدرس بعد تسليم الواجب أو الاختبار المحدد
            </p>
          </div>
        </div>
        <div className="relative w-full sm:w-80">
          <select
            id={`prerequisite-${unit.id}`}
            value={selectedPrerequisite}
            disabled={savingPrerequisite}
            onChange={(event) => void changePrerequisite(event.target.value)}
            className="h-10 w-full appearance-none rounded-lg border border-border-default bg-surface px-3 pe-10 text-sm font-semibold text-primary outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 disabled:cursor-wait disabled:opacity-60"
          >
            <option value="">بدون متطلب سابق</option>
            {eligiblePrerequisites.map((option) => (
              <option key={option.id} value={option.id}>
                {option.unitTitleAr} - {option.titleAr}
              </option>
            ))}
          </select>
          {savingPrerequisite && (
            <LoaderCircle className="pointer-events-none absolute end-3 top-3 size-4 animate-spin text-brand-600" />
          )}
        </div>
      </div>

      <div className="grid gap-4 rounded-xl border border-brand-200/70 bg-brand-50/50 p-4 dark:border-brand-900 dark:bg-brand-950/20 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-primary">سعر شراء الدرس منفرداً</span>
          <div className="relative">
            <input
              type="number"
              min="0"
              step="1"
              value={priceAmount}
              onChange={(event) => setPriceAmount(event.target.value)}
              placeholder="مثال: 100"
              disabled={isFree}
              className="h-11 w-full rounded-lg border border-border-default bg-surface px-3 pl-14 text-sm font-semibold outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
            />
            <span className="absolute left-3 top-3 text-xs font-bold text-text-muted">EGP</span>
          </div>
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-brand-200 bg-brand-50/60 px-3 text-sm font-semibold text-primary">
          <input
            type="checkbox"
            checked={isFree}
            onChange={(event) => setIsFree(event.target.checked)}
            className="size-4 accent-brand-600"
          />
          <span>هذا الدرس مجاني</span>
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-primary">صورة غلاف الدرس</span>
          <span className="flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border-default bg-surface px-3 text-sm font-semibold text-text-muted hover:border-brand-400 hover:text-brand-700">
            <ImageIcon className="size-4" />
            <span className="truncate">
              {coverFile?.name ||
                (unit.lessonProduct?.coverImageUrl ? 'تغيير الصورة الحالية' : 'اختر صورة')}
            </span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)}
            />
          </span>
        </label>
        <Button
          disabled={savingProduct}
          leadingIcon={
            savingProduct ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )
          }
          onClick={() => void saveProduct()}
        >
          {unit.lessonProduct ? 'حفظ التعديلات' : 'تفعيل شراء الدرس'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <VideoUploadArea videoItem={videoItem} onReload={onReload} />
        <PdfUploadArea pdfItem={pdfItem} unitId={unit.id} onReload={onReload} />
        <HomeworkSection
          homework={homework}
          videoItemId={videoItem?.id ?? null}
          unitTitleAr={unit.titleAr}
          courseId={courseId}
        />
      </div>
    </div>
  );
}
