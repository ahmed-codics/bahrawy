'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  ImageIcon,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button, ErrorState, Input, PageSkeleton } from '@bahrawy/ui';
import { API_BASE, fetchApi } from '../../../../../../lib/api';
import { QuestionBankDrawer } from './QuestionBankDrawer';

type AssessmentType = 'HOMEWORK' | 'QUIZ';
type AssessmentStatus = 'DRAFT' | 'PUBLISHED';
type ResultReleaseRule = 'IMMEDIATE' | 'MANUAL' | 'AFTER_DUE';

type QuestionOption = {
  id: string;
  text: string;
};

type QuestionRecord = {
  id: string;
  titleAr: string;
  options: QuestionOption[];
  correctOptionId: string;
  explanation?: string | null;
  imageUrl?: string | null;
  points: number;
  version: number;
};

type AssessmentQuestion = {
  sort: number;
  question: QuestionRecord;
};

type AssessmentDetail = {
  id: string;
  titleAr: string;
  type: AssessmentType;
  durationMinutes: number;
  passingScore: number | null;
  maxAttempts: number | null;
  shuffleQuestions: boolean;
  status: AssessmentStatus;
  resultReleaseRule: ResultReleaseRule;
  questions: AssessmentQuestion[];
  version: number;
};

type AssessmentResponse = {
  data: AssessmentDetail;
};

type UploadResponse = {
  data: {
    storedObjectId: string;
  };
};

type QuestionFormState = {
  titleAr: string;
  explanation: string;
  points: number;
  options: string[];
  correctIndex: number | null;
  imageUrl: string | null;
};

const OPTION_LABELS = ['أ', 'ب', 'ج', 'د'];

function normalizeOptions(options: unknown): QuestionOption[] {
  if (!Array.isArray(options)) return [];
  return options
    .filter((option): option is QuestionOption => {
      if (!option || typeof option !== 'object') return false;
      const item = option as Partial<QuestionOption>;
      return typeof item.id === 'string' && typeof item.text === 'string';
    })
    .slice(0, 4);
}

function buildInitialQuestionState(question?: QuestionRecord): QuestionFormState {
  const options = normalizeOptions(question?.options);
  const filledOptions = [...options.map((option) => option.text)];
  while (filledOptions.length < 4) filledOptions.push('');

  const correctIndex = question
    ? options.findIndex((option) => option.id === question.correctOptionId)
    : -1;

  return {
    titleAr: question?.titleAr ?? '',
    explanation: question?.explanation ?? '',
    points: question?.points ?? 1,
    options: filledOptions,
    correctIndex: correctIndex >= 0 ? correctIndex : null,
    imageUrl: question?.imageUrl ?? null,
  };
}

function TypeButton<TValue extends string>({
  value,
  label,
  selected,
  onClick,
}: {
  value: TValue;
  label: string;
  selected: TValue;
  onClick: (value: TValue) => void;
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

function QuestionImagePicker({
  imagePreview,
  imageUrl,
  onPick,
  onRemove,
}: {
  imagePreview: string | null;
  imageUrl: string | null;
  onPick: (file: File) => void;
  onRemove: () => void;
}) {
  const visibleImage = imagePreview || (imageUrl ? `${API_BASE}/storage/${imageUrl}` : null);

  return (
    <div>
      <label className="mb-2 block text-sm font-bold">صورة السؤال (اختياري)</label>
      {visibleImage ? (
        <div className="relative inline-block">
          <img
            src={visibleImage}
            alt="صورة السؤال"
            className="max-h-40 rounded-lg border border-border-default object-contain"
          />
          <button
            type="button"
            onClick={onRemove}
            className="absolute -left-2 -top-2 flex size-6 items-center justify-center rounded-full bg-danger text-xs text-white transition-colors hover:bg-danger/80"
            aria-label="حذف صورة السؤال"
          >
            ×
          </button>
        </div>
      ) : (
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border-default px-4 py-2 text-sm text-text-muted transition-colors hover:border-interactive hover:text-interactive">
          <ImageIcon className="size-4" />
          رفع صورة
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) onPick(file);
            }}
          />
        </label>
      )}
    </div>
  );
}

function QuestionForm({
  assessmentId,
  question,
  questionNumber,
  onSaved,
  onCancel,
}: {
  assessmentId: string;
  question?: QuestionRecord;
  questionNumber?: number;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [state, setState] = useState<QuestionFormState>(() => buildInitialQuestionState(question));
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isEditing = Boolean(question);

  const updateOption = (index: number, value: string) => {
    setState((current) => {
      const options = [...current.options];
      options[index] = value;
      return { ...current, options };
    });
  };

  const handleImagePick = (file: File) => {
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setState((current) => ({ ...current, imageUrl: null }));
  };

  const handleSave = async () => {
    if (!state.titleAr.trim()) {
      toast.error('أدخل نص السؤال');
      return;
    }
    if (state.options.some((option) => !option.trim())) {
      toast.error('أكمل جميع الخيارات الأربعة');
      return;
    }
    if (state.correctIndex === null) {
      toast.error('حدد الإجابة الصحيحة');
      return;
    }

    setSaving(true);
    try {
      let imageUrl = state.imageUrl || undefined;
      if (imageFile) {
        const formData = new FormData();
        formData.append('file', imageFile);
        const uploadResponse = (await fetchApi('/storage/upload', {
          method: 'POST',
          body: formData,
        })) as UploadResponse;
        imageUrl = uploadResponse.data.storedObjectId;
      }

      const builtOptions = state.options.map((text, index) => ({
        id: question?.options[index]?.id ?? `opt_${index}_${Date.now()}`,
        text: text.trim(),
      }));

      const payload = {
        titleAr: state.titleAr.trim(),
        options: builtOptions,
        correctOptionId: builtOptions[state.correctIndex].id,
        explanation: state.explanation.trim() || undefined,
        imageUrl,
        points: state.points,
      };

      if (isEditing && question) {
        await fetchApi(`/admin/v1/questions/${question.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ ...payload, version: question.version }),
        });
      } else {
        const response = await fetchApi('/admin/v1/questions', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        await fetchApi(`/admin/v1/questions/assessments/${assessmentId}/assign`, {
          method: 'POST',
          body: JSON.stringify({ questionIds: [response.data.id] }),
        });
      }

      toast.success(isEditing ? 'تم حفظ السؤال' : 'تم إضافة السؤال');
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'فشل حفظ السؤال');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 rounded-xl border-2 border-interactive/30 bg-surface p-6">
      <h3 className="text-lg font-bold text-primary">
        {isEditing ? 'تعديل السؤال' : `سؤال جديد${questionNumber ? ` رقم ${questionNumber}` : ''}`}
      </h3>

      <QuestionImagePicker
        imagePreview={imagePreview}
        imageUrl={state.imageUrl}
        onPick={handleImagePick}
        onRemove={handleRemoveImage}
      />

      <div>
        <label className="mb-1.5 block text-sm font-bold">نص السؤال *</label>
        <textarea
          value={state.titleAr}
          onChange={(event) => setState((current) => ({ ...current, titleAr: event.target.value }))}
          placeholder="اكتب السؤال هنا..."
          rows={3}
          dir="auto"
          className="w-full resize-none rounded-xl border border-border-default bg-canvas p-3 text-sm outline-none transition-colors focus:border-interactive"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-bold">
          الخيارات * (حدد الإجابة الصحيحة من الدائرة)
        </label>
        <div className="space-y-2">
          {state.options.map((option, index) => (
            <div key={OPTION_LABELS[index]} className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setState((current) => ({ ...current, correctIndex: index }))}
                className={`size-8 shrink-0 rounded-full border-2 text-sm font-bold transition-colors ${
                  state.correctIndex === index
                    ? 'border-success bg-success text-white'
                    : 'border-border-default text-text-muted hover:border-interactive'
                }`}
              >
                {OPTION_LABELS[index]}
              </button>
              <input
                value={option}
                dir="auto"
                onChange={(event) => updateOption(index, event.target.value)}
                placeholder={`الخيار ${OPTION_LABELS[index]}`}
                className="flex-1 rounded-lg border border-border-default bg-canvas p-2.5 text-sm outline-none transition-colors focus:border-interactive"
              />
            </div>
          ))}
        </div>
        {state.correctIndex !== null && (
          <p className="mt-2 flex items-center gap-1 text-xs text-success">
            <CheckCircle2 className="size-3.5" />
            الإجابة الصحيحة: الخيار {OPTION_LABELS[state.correctIndex]}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-bold">الدرجة</label>
          <input
            type="number"
            min={1}
            value={state.points}
            onChange={(event) =>
              setState((current) => ({ ...current, points: Number(event.target.value) }))
            }
            className="w-full rounded-lg border border-border-default bg-canvas p-2.5 text-sm outline-none transition-colors focus:border-interactive"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-bold">
            الشرح (اختياري، يظهر بعد التصحيح)
          </label>
          <input
            value={state.explanation}
            onChange={(event) =>
              setState((current) => ({ ...current, explanation: event.target.value }))
            }
            placeholder="لماذا هذه الإجابة صحيحة؟"
            className="w-full rounded-lg border border-border-default bg-canvas p-2.5 text-sm outline-none transition-colors focus:border-interactive"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} className="flex-1">
            إلغاء
          </Button>
        )}
        <Button onClick={() => void handleSave()} loading={saving} className="flex-1">
          {isEditing ? 'حفظ السؤال' : 'إضافة السؤال'}
        </Button>
      </div>
    </div>
  );
}

function QuestionCard({
  index,
  assessmentId,
  assessmentQuestion,
  onReload,
}: {
  index: number;
  assessmentId: string;
  assessmentQuestion: AssessmentQuestion;
  onReload: () => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const question = assessmentQuestion.question;
  const options = normalizeOptions(question.options);

  const handleDelete = async () => {
    if (!confirm(`هل تريد حذف السؤال ${index}؟`)) return;
    setDeleting(true);
    try {
      await fetchApi(`/admin/v1/questions/assessments/${assessmentId}/${question.id}`, {
        method: 'DELETE',
      });
      toast.success('تم حذف السؤال');
      await onReload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'فشل حذف السؤال');
      setDeleting(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border-default bg-surface">
      <div
        className="flex cursor-pointer items-start gap-3 p-4 transition-colors hover:bg-canvas/50"
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-interactive/10 text-sm font-bold text-interactive">
          {index}
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold text-primary">{question.titleAr}</p>
          <p className="mt-1 text-xs text-text-muted">
            {options.length} خيارات · {question.points} نقطة
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void handleDelete();
            }}
            disabled={deleting}
            className="rounded p-1.5 text-text-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
            aria-label="حذف السؤال"
          >
            <Trash2 className="size-4" />
          </button>
          <ChevronDown
            className={`size-4 text-text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border-default/50 p-4">
          <QuestionForm
            assessmentId={assessmentId}
            question={question}
            onSaved={() => {
              setExpanded(false);
              void onReload();
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function AssessmentEditorPage({
  params,
}: {
  params: Promise<{ id: string; assessmentId: string }>;
}) {
  const { id: courseId, assessmentId } = use(params);
  const router = useRouter();
  const [assessment, setAssessment] = useState<AssessmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [questionCountInput, setQuestionCountInput] = useState('1');
  const [questionsRemaining, setQuestionsRemaining] = useState(0);
  const [showQuestionBank, setShowQuestionBank] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [type, setType] = useState<AssessmentType>('HOMEWORK');
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [passingScore, setPassingScore] = useState<number | null>(null);
  const [maxAttempts, setMaxAttempts] = useState<number | null>(null);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [status, setStatus] = useState<AssessmentStatus>('DRAFT');
  const [resultReleaseRule, setResultReleaseRule] = useState<ResultReleaseRule>('IMMEDIATE');

  const reloadAssessment = useCallback(async () => {
    setError('');
    try {
      const response = (await fetchApi(
        `/admin/v1/assessments/${assessmentId}`,
      )) as AssessmentResponse;
      const data = response.data;
      setAssessment(data);
      setTitle(data.titleAr);
      setType(data.type);
      setDurationMinutes(data.durationMinutes ?? 0);
      setPassingScore(data.passingScore ?? null);
      setMaxAttempts(data.maxAttempts ?? null);
      setShuffleQuestions(data.shuffleQuestions ?? false);
      setStatus(data.status);
      setResultReleaseRule(data.resultReleaseRule);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'فشل تحميل التقييم');
      toast.error('فشل تحميل التقييم');
    } finally {
      setLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => {
    void reloadAssessment();
  }, [reloadAssessment]);

  const questions = useMemo(() => assessment?.questions ?? [], [assessment?.questions]);

  const startAddingQuestions = () => {
    const count = Math.max(1, Math.floor(Number(questionCountInput) || 0));
    setQuestionsRemaining(count);
    setShowAddQuestion(true);
  };

  const handleSaveSettings = async () => {
    if (!assessment) return;
    setSaving(true);
    try {
      await fetchApi(`/admin/v1/assessments/${assessmentId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          titleAr: title,
          type,
          durationMinutes,
          passingScore,
          maxAttempts,
          shuffleQuestions,
          status,
          resultReleaseRule,
          version: assessment.version,
        }),
      });
      toast.success('تم حفظ الإعدادات');
      await reloadAssessment();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'فشل الحفظ');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSkeleton cards={4} />;

  if (!assessment) {
    return (
      <div className="mx-auto max-w-3xl">
        <ErrorState
          title="تعذر فتح محرر التقييم"
          description={error || 'تحقق من الاتصال بالخادم ثم حاول مرة أخرى.'}
          onRetry={() => {
            setLoading(true);
            void reloadAssessment();
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-20" dir="rtl">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => router.push(`/dashboard/courses/${courseId}`)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-text-muted transition-colors hover:text-primary"
        >
          <ArrowRight className="size-4" />
          العودة إلى الكورس
        </button>
        <span className="rounded-full border border-border-default bg-surface px-3 py-1 text-xs text-text-muted">
          {assessment.type === 'QUIZ' ? 'اختبار' : 'واجب'}
        </span>
      </div>

      <section className="space-y-5 rounded-xl border border-border-default bg-surface p-6">
        <h1 className="text-xl font-bold text-primary">إعدادات التقييم</h1>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <Input
              label="العنوان"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-bold">النوع</label>
            <div className="flex gap-2">
              <TypeButton value="HOMEWORK" label="واجب" selected={type} onClick={setType} />
              <TypeButton value="QUIZ" label="اختبار" selected={type} onClick={setType} />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-bold">المدة الزمنية</label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="number"
                min="0"
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(Number(event.target.value))}
                className="w-28"
              />
              <span className="text-sm text-text-muted">دقيقة</span>
              <span className="text-xs text-text-muted">(0 = بدون حد زمني)</span>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border-default bg-canvas/50 p-3">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="size-4 accent-interactive"
                checked={passingScore !== null}
                onChange={(event) => setPassingScore(event.target.checked ? 50 : null)}
              />
              <span className="text-sm font-semibold">تحديد درجة نجاح</span>
            </label>
            {passingScore !== null && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={passingScore}
                  onChange={(event) =>
                    setPassingScore(Math.min(100, Math.max(0, Number(event.target.value))))
                  }
                  className="w-28"
                />
                <span className="text-sm text-text-muted">%</span>
              </div>
            )}
            <p className="text-xs text-text-muted">
              عند تفعيلها يجب أن يصل الطالب لهذه النسبة لاجتياز التقييم.
            </p>
          </div>

          <div className="space-y-3 rounded-lg border border-border-default bg-canvas/50 p-3">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="size-4 accent-interactive"
                checked={maxAttempts !== null}
                onChange={(event) => setMaxAttempts(event.target.checked ? 3 : null)}
              />
              <span className="text-sm font-semibold">تحديد عدد المحاولات</span>
            </label>
            {maxAttempts !== null && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  value={maxAttempts}
                  onChange={(event) => setMaxAttempts(Math.max(1, Number(event.target.value)))}
                  className="w-28"
                />
                <span className="text-sm text-text-muted">محاولة</span>
              </div>
            )}
            <p className="text-xs text-text-muted">
              بعد استهلاك المحاولات يجب على الطالب التواصل مع خدمة العملاء.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-border-default bg-canvas/50 p-3">
            <button
              type="button"
              role="switch"
              aria-checked={shuffleQuestions}
              onClick={() => setShuffleQuestions((value) => !value)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                shuffleQuestions ? 'bg-interactive' : 'bg-border-default'
              }`}
            >
              <span
                className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${
                  shuffleQuestions ? 'translate-x-5' : 'translate-x-0'
                } right-0.5`}
              />
            </button>
            <div>
              <div className="text-sm font-semibold">ترتيب عشوائي للأسئلة</div>
              <div className="text-xs text-text-muted">
                {shuffleQuestions ? 'كل طالب سيحصل على ترتيب مختلف' : 'نفس الترتيب لجميع الطلاب'}
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-bold">ظهور النتيجة للطالب</label>
            <select
              value={resultReleaseRule}
              onChange={(event) => setResultReleaseRule(event.target.value as ResultReleaseRule)}
              className="w-full rounded-xl border border-border-default bg-surface p-2 text-sm outline-none transition-colors focus:border-interactive"
            >
              <option value="IMMEDIATE">فور التسليم</option>
              <option value="MANUAL">يدويا من الأدمن</option>
              <option value="AFTER_DUE">بعد انتهاء المدة</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-bold">الحالة</label>
            <div className="flex gap-2">
              <TypeButton value="DRAFT" label="مسودة" selected={status} onClick={setStatus} />
              <TypeButton value="PUBLISHED" label="منشور" selected={status} onClick={setStatus} />
            </div>
          </div>
        </div>

        <Button onClick={() => void handleSaveSettings()} loading={saving}>
          حفظ الإعدادات
        </Button>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-primary">
            الأسئلة{' '}
            <span className="text-base font-normal text-text-muted">({questions.length})</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setShowQuestionBank(true)}>
              اختيار من البنك
            </Button>
            <Button
              onClick={() => {
                setQuestionCountInput('1');
                setQuestionsRemaining(1);
                setShowAddQuestion(true);
              }}
              leadingIcon={<Plus className="size-4" />}
            >
              سؤال جديد
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-interactive/20 bg-interactive/5 p-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold text-primary">إضافة عدة أسئلة دفعة واحدة</p>
            <p className="mt-1 text-xs text-text-muted">حدد العدد ثم املأ الأسئلة واحداً تلو الآخر.</p>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <label className="flex-1 sm:w-36">
              <span className="sr-only">عدد الأسئلة</span>
              <input
                type="number"
                min="1"
                step="1"
                value={questionCountInput}
                onChange={(event) => setQuestionCountInput(event.target.value)}
                className="h-11 w-full rounded-lg border border-border-default bg-surface px-3 text-sm font-semibold outline-none focus:border-interactive"
                aria-label="عدد الأسئلة التي تريد إضافتها"
              />
            </label>
            <Button variant="outline" onClick={startAddingQuestions}>
              تطبيق
            </Button>
          </div>
        </div>

        {questions.length === 0 && !showAddQuestion && (
          <div className="rounded-xl border-2 border-dashed border-border-default p-12 text-center">
            <ClipboardList className="mx-auto mb-3 size-10 text-text-muted" />
            <p className="text-text-muted">لم يتم إضافة أسئلة بعد</p>
            <Button variant="outline" className="mt-4" onClick={() => { setQuestionsRemaining(1); setShowAddQuestion(true); }}>
              أضف أول سؤال
            </Button>
          </div>
        )}

        <div className="space-y-3">
          {questions.map((assessmentQuestion, index) => (
            <QuestionCard
              key={assessmentQuestion.question.id}
              index={index + 1}
              assessmentId={assessmentId}
              assessmentQuestion={assessmentQuestion}
              onReload={reloadAssessment}
            />
          ))}
        </div>

        {showAddQuestion && (
          <div className="space-y-3">
            {questionsRemaining > 0 && (
              <div className="rounded-lg border border-success/20 bg-success/5 px-4 py-3 text-sm font-bold text-success">
                متبقي لإضافته: {questionsRemaining} سؤال
              </div>
            )}
            <QuestionForm
              key={`new-question-${questionsRemaining}`}
              assessmentId={assessmentId}
              questionNumber={questions.length + 1}
              onSaved={() => {
                if (questionsRemaining > 1) {
                  setQuestionsRemaining((count) => count - 1);
                } else {
                  setQuestionsRemaining(0);
                  setShowAddQuestion(false);
                }
                void reloadAssessment();
              }}
              onCancel={() => {
                setQuestionsRemaining(0);
                setShowAddQuestion(false);
              }}
            />
          </div>
        )}
      </section>
      <QuestionBankDrawer
        assessmentId={assessmentId}
        assignedQuestionIds={questions.map((item) => item.question.id)}
        isOpen={showQuestionBank}
        onClose={() => setShowQuestionBank(false)}
        onAssigned={reloadAssessment}
      />
    </div>
  );
}
