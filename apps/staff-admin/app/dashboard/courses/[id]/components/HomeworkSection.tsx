'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ClipboardList, FileCheck2, Shuffle, Timer } from 'lucide-react';
import { Button, Input } from '@bahrawy/ui';
import { fetchApi } from '../../../../../lib/api';
import type { AssessmentRecord } from './types';

type AssessmentType = 'HOMEWORK' | 'QUIZ';

type HomeworkSectionProps = {
  homework: AssessmentRecord | null;
  videoItemId: string | null;
  unitTitleAr: string;
  courseId: string;
};

function TypeChoice({
  value,
  label,
  selected,
  onClick,
}: {
  value: AssessmentType;
  label: string;
  selected: AssessmentType;
  onClick: (value: AssessmentType) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
        selected === value
          ? 'border-interactive bg-interactive text-white'
          : 'border-border-default bg-surface text-text-muted hover:border-interactive/50'
      }`}
    >
      {label}
    </button>
  );
}

export function HomeworkSection({
  homework,
  videoItemId,
  unitTitleAr,
  courseId,
}: HomeworkSectionProps) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createType, setCreateType] = useState<AssessmentType>('HOMEWORK');
  const [creating, setCreating] = useState(false);

  const handleCreateAssessment = async () => {
    if (!videoItemId) {
      toast.error('ارفع أو أنشئ محتوى فيديو أولا');
      return;
    }

    setCreating(true);
    try {
      const response = await fetchApi(`/admin/v1/assessments/lessons/${videoItemId}`, {
        method: 'POST',
        body: JSON.stringify({
          titleAr: createTitle.trim() || `واجب ${unitTitleAr}`,
          type: createType,
          durationMinutes: createType === 'QUIZ' ? 30 : 0,
          shuffleQuestions: createType === 'QUIZ',
          resultReleaseRule: createType === 'HOMEWORK' ? 'IMMEDIATE' : 'MANUAL',
          status: 'DRAFT',
        }),
      });
      const assessmentId = response.data.id;
      router.push(`/dashboard/courses/${courseId}/assessments/${assessmentId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'فشل إنشاء التقييم');
      setCreating(false);
    }
  };

  if (!homework) {
    return (
      <div className="rounded-lg border border-dashed border-border-default bg-surface p-4">
        {!showCreate ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <ClipboardList className="size-6 text-text-muted" />
            <span className="text-sm text-text-muted">لا يوجد واجب أو اختبار</span>
            <Button
              size="sm"
              variant="outline"
              disabled={!videoItemId}
              onClick={() => setShowCreate(true)}
            >
              إضافة تقييم
            </Button>
          </div>
        ) : (
          <div className="space-y-3 text-start">
            <Input
              label="عنوان التقييم"
              value={createTitle}
              onChange={(event) => setCreateTitle(event.target.value)}
              placeholder={`واجب ${unitTitleAr}`}
            />
            <div className="flex gap-2">
              <TypeChoice
                value="HOMEWORK"
                label="واجب"
                selected={createType}
                onClick={setCreateType}
              />
              <TypeChoice
                value="QUIZ"
                label="اختبار"
                selected={createType}
                onClick={setCreateType}
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowCreate(false)}
                className="flex-1"
              >
                إلغاء
              </Button>
              <Button
                size="sm"
                onClick={() => void handleCreateAssessment()}
                loading={creating}
                className="flex-1"
              >
                إنشاء والانتقال
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const questionCount = homework._count?.questions ?? homework.questions?.length ?? 0;
  const isQuiz = homework.type === 'QUIZ';

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-default bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ClipboardList className="size-4 text-warning" />
          <span>{isQuiz ? 'اختبار' : 'واجب'}</span>
        </div>
        <span className="text-xs text-text-muted">{questionCount} سؤال</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span
          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${
            isQuiz ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {isQuiz ? <Shuffle className="size-3" /> : <FileCheck2 className="size-3" />}
          {isQuiz ? 'عشوائي' : 'ثابت'}
        </span>
        <span className="inline-flex items-center gap-1 rounded border border-border-default bg-surface px-2 py-0.5 text-xs text-text-muted">
          <Timer className="size-3" />
          {homework.durationMinutes > 0 ? `${homework.durationMinutes} دقيقة` : 'بدون حد زمني'}
        </span>
        {homework.passingScore !== null && homework.passingScore !== undefined && (
          <span className="rounded border border-border-default bg-surface px-2 py-0.5 text-xs text-text-muted">
            النجاح من {homework.passingScore}%
          </span>
        )}
        {homework.maxAttempts !== null && homework.maxAttempts !== undefined && (
          <span className="rounded border border-border-default bg-surface px-2 py-0.5 text-xs text-text-muted">
            {homework.maxAttempts} محاولات
          </span>
        )}
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            homework.status === 'PUBLISHED'
              ? 'bg-success/15 text-success'
              : 'bg-amber-100 text-amber-700'
          }`}
        >
          {homework.status === 'PUBLISHED' ? 'منشور' : 'مسودة'}
        </span>
      </div>

      <Button
        size="sm"
        variant="outline"
        onClick={() => router.push(`/dashboard/courses/${courseId}/assessments/${homework.id}`)}
        className="w-full"
      >
        إدارة الأسئلة
      </Button>
    </div>
  );
}
