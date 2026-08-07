'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ArrowDown,
  ArrowUp,
  Plus,
  Save,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  Input,
  PageSkeleton,
  Textarea,
} from '@bahrawy/ui';
import { fetchApi } from '../../../../../../../../lib/api';
import type { AdminApiResponse } from '@bahrawy/types';

type Option = { id: string; text: string };
type QuizQuestion = {
  questionId?: string;
  titleAr: string;
  options: Option[];
  correctOptionId: string;
  explanation?: string;
  points: number;
};
type QuizConfig = {
  lessonId: string;
  enabled: boolean;
  assessmentId: string | null;
  titleAr?: string | null;
  passingScore?: number | null;
  questions: QuizQuestion[];
};

function newQuestion(index: number, offset: number): QuizQuestion {
  const options = [1, 2, 3, 4].map((n) => ({
    id: `local-${offset}-${n}`,
    text: '',
  }));
  return {
    options,
    correctOptionId: options[0].id,
    points: 1,
    titleAr: '',
  };
}

export function LessonQuizSection({ lessonId }: { lessonId: string }) {
  const [config, setConfig] = useState<QuizConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [questionErrors, setQuestionErrors] = useState<Record<number, string>>(
    {},
  );
  const [passingError, setPassingError] = useState('');

  useEffect(() => {
    fetchApi<AdminApiResponse<QuizConfig>>(
      `/admin/v1/lessons/${lessonId}/lesson-quiz`,
    )
      .then((response) =>
        setConfig({
          ...response.data,
          enabled: !!response.data.enabled,
          questions: response.data.questions ?? [],
        }),
      )
      .catch(() => {
        toast.error('تعذر تحميل إعدادات اختبار نهاية الدرس.');
      })
      .finally(() => setLoading(false));
  }, [lessonId]);

  if (loading) return <PageSkeleton cards={1} />;
  if (!config) return null;

  const totalPoints = config.questions.reduce(
    (sum, question) => sum + (question.points || 0),
    0,
  );

  const update = (patch: Partial<QuizConfig>) =>
    setConfig((current) => (current ? { ...current, ...patch } : current));

  const setQuestion = (index: number, patch: Partial<QuizQuestion>) => {
    setConfig((current) =>
      current
        ? {
            ...current,
            questions: current.questions.map((question, i) =>
              i === index ? { ...question, ...patch } : question,
            ),
            enabled: true,
          }
        : current,
    );
    setQuestionErrors((errors) => ({ ...errors, [index]: '' }));
  };

  const addQuestion = () => {
    const index = config.questions.length;
    setConfig((current) =>
      current
        ? {
            ...current,
            enabled: true,
            questions: [
              ...current.questions,
              newQuestion(index, Date.now() % 1000),
            ],
          }
        : current,
    );
  };

  const removeQuestion = (index: number) => {
    setConfig((current) =>
      current
        ? {
            ...current,
            questions: current.questions.filter((_, i) => i !== index),
          }
        : current,
    );
    setQuestionErrors((errors) => {
      const next: Record<number, string> = {};
      for (const [key, value] of Object.entries(errors)) {
        const k = Number(key);
        if (k < index) next[k] = value;
        if (k > index) next[k - 1] = value;
      }
      return next;
    });
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= config.questions.length) return;
    setConfig((current) => {
      if (!current) return current;
      const questions = [...current.questions];
      const [moved] = questions.splice(index, 1);
      questions.splice(target, 0, moved);
      return { ...current, questions };
    });
  };

  const save = async () => {
    if (!config) return;

    // Frontend validation (backend re-validates authoritatively)
    const errors: Record<number, string> = {};
    let invalid = false;

    if (config.enabled && config.questions.length === 0) {
      toast.error('لم تتم إضافة أسئلة بعد. أضف سؤالاً أولاً.');
      return;
    }

    if (config.enabled) {
      const passing = Number(config.passingScore ?? 0);
      if (passing > totalPoints) {
        setPassingError(
          `درجة النجاح (${passing}) أكبر من إجمالي الدرجات (${totalPoints}).`,
        );
        invalid = true;
      } else {
        setPassingError('');
      }

      config.questions.forEach((question, index) => {
        let message = '';
        if (!question.titleAr.trim()) message = 'أدخل نص السؤال';
        const filledOptions = question.options.filter((option) =>
          option.text.trim(),
        );
        if (!message && filledOptions.length < 2) {
          message = 'أضف اختيارين على الأقل واملأ نصوصهما';
        } else if (
          !message &&
          !question.options.some((option) => option.id === question.correctOptionId)
        ) {
          message = 'حدد إجابة صحيحة واحدة من الاختيارات';
        }
        if (!message && (question.points || 0) <= 0) {
          message = 'يجب أن تكون الدرجة أكبر من 0';
        }
        if (message) {
          errors[index] = message;
          invalid = true;
        }
      });
    }

    if (invalid) {
      setQuestionErrors(errors);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        enabled: config.enabled,
        titleAr: config.titleAr ?? 'اختبار نهاية الدرس',
        passingScore: config.passingScore ?? 0,
        questions: config.questions.map((question) => ({
          questionId: question.questionId,
          titleAr: question.titleAr.trim(),
          options: question.options.map((option) => ({
            id: option.id,
            text: option.text.trim(),
          })),
          correctOptionId: question.correctOptionId,
          explanation:
            question.explanation && question.explanation.trim() !== ''
              ? question.explanation.trim()
              : undefined,
          points: question.points || 1,
        })),
      };
      const response = await fetchApi<AdminApiResponse<QuizConfig>>(
        `/admin/v1/lessons/${lessonId}/lesson-quiz`,
        {
          method: 'PUT',
          body: JSON.stringify(payload),
        },
      );
      setConfig({
        ...response.data,
        enabled: !!response.data.enabled,
        questions: response.data.questions ?? [],
      });
      setQuestionErrors({});
      setPassingError('');
      toast.success(
        config.enabled ? 'تم حفظ اختبار نهاية الدرس' : 'تم إيقاف اختبار نهاية الدرس',
      );
    } catch (requestError) {
      toast.error(
        requestError instanceof Error
          ? requestError.message
          : 'تعذر حفظ اختبار نهاية الدرس',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <div>
          <p className="text-xs font-bold text-brand-600">نهاية الدرس</p>
          <h2 className="mt-1 text-xl font-black">اختبار نهاية الدرس</h2>
          <p className="mt-1 text-sm leading-6 text-ink-3">
            عّّل لتُطلب من الطالب اجتياز الاختبار لفتح الدرس التالي.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-border bg-surface-muted px-4 py-3">
          <div>
            <p className="text-sm font-bold">
              {config.enabled ? 'الاختبار مفعل' : 'تفعيل الاختبار'}
            </p>
            <p className="text-xs text-ink-muted">
              {config.enabled
                ? 'الطالب يتوقف عند هذا الدرس حتى يحقق درجة النجاح عند فتح الدرس التالي.'
                : 'عند التفعيل سيتطلب اجتياز الاختبار للانتقال للدرس التالي.'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={config.enabled}
            onClick={() => update({ enabled: !config.enabled })}
            className={`relative h-7 w-12 rounded-full transition-colors ${
              config.enabled ? 'bg-brand-600' : 'bg-ink-disabled'
            }`}
          >
            <span
              className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${
                config.enabled ? 'left-0.5' : 'left-[1.4rem]'
              }`}
            />
          </button>
        </div>

        {config.enabled && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                label="درجة النجاح"
                type="number"
                min={0}
                error={passingError || undefined}
                value={Number(config.passingScore ?? 0)}
                onChange={(event) => update({ passingScore: Number(event.target.value) })}
              />
            </div>

            <div className="rounded-2xl border border-border bg-surface-muted/50 px-4 py-3 text-sm">
              عدد الأسئلة: <span className="font-black">{config.questions.length}</span>
              <span className="mx-2 text-line">·</span>
              إجمالي الدرجات:{' '}
              <span className="font-bold text-brand-600">{totalPoints}</span>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-black">أسئلة الاختبار</p>
                <Button
                  variant="outline"
                  size="sm"
                  leadingIcon={<Plus className="size-4" />}
                  onClick={addQuestion}
                >
                  إضافة سؤال
                </Button>
              </div>

              {config.questions.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-surface-muted/40 px-6 py-10 text-center">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <Plus className="size-5" />
                  </div>
                  <p className="text-sm font-bold text-ink-muted">
                    لم تتم إضافة أسئلة بعد
                  </p>
                  <Button variant="outline" size="sm" onClick={addQuestion}>
                    + إضافة سؤال
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {config.questions.map((question, index) => (
                    <QuestionEditor
                      key={question.questionId ?? `new-${index}`}
                      question={question}
                      index={index}
                      total={config.questions.length}
                      error={questionErrors[index] ?? ''}
                      onChange={(patch) => setQuestion(index, patch)}
                      onMoveUp={() => move(index, -1)}
                      onMoveDown={() => move(index, 1)}
                      onRemove={() => removeQuestion(index)}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                loading={saving}
                leadingIcon={<Save className="size-4" />}
                onClick={() => void save()}
              >
                حفظ اختبار نهاية الدرس
              </Button>
              <Button variant="ghost" onClick={() => update({ enabled: false })}>
                إيقاف الاختبار
              </Button>
            </div>
          </div>
        )}

        {!config.enabled && (
          <p className="rounded-xl border border-border bg-canvas px-4 py-3 text-sm text-ink-muted">
            الاختبار معطل حالياً. فعّله لحفظ سؤالاته وإظهارها هنا.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function QuestionEditor({
  question,
  index,
  total,
  error,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  question: QuizQuestion;
  index: number;
  total: number;
  error?: string;
  onChange: (patch: Partial<QuizQuestion>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-black text-brand-600">السؤال {index + 1}</p>
          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-ink-muted">
            الترتيب: {index + 1}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <IconButton onClick={onMoveUp} disabled={index === 0}>
            <ArrowUp className="size-4" />
          </IconButton>
          <IconButton onClick={onMoveDown} disabled={index === total - 1}>
            <ArrowDown className="size-4" />
          </IconButton>
          <IconButton onClick={onRemove} danger title="حذف السؤال">
            <Trash2 className="size-4" />
          </IconButton>
        </div>
      </div>

      <Textarea
        className="mt-3"
        label="نص السؤال"
        value={question.titleAr}
        onChange={(e) => onChange({ titleAr: e.target.value })}
        required
      />

      <div className="mt-4">
        <p className="mb-2 text-xs font-bold text-ink-muted">الاختيارات</p>
        <div className="space-y-2">
          {question.options.map((option, optionIndex) => {
            const isCorrect = question.correctOptionId === option.id;
            return (
              <div key={option.id} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`correct-${index}`}
                  aria-label={`الإجابة الصحيحة للاختيار ${optionIndex + 1}`}
                  checked={isCorrect}
                  onChange={() => onChange({ correctOptionId: option.id })}
                  className="accent-brand-600"
                />
                <Input
                  className="flex-1"
                  placeholder={`اختيار ${optionIndex + 1}`}
                  value={option.text}
                  onChange={(e) =>
                    onChange({
                      options: question.options.map((o) =>
                        o.id === option.id ? { ...o, text: e.target.value } : o,
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  title="حذف الاختيار"
                  onClick={() => {
                    const remaining = question.options.filter(
                      (o) => o.id !== option.id,
                    );
                    onChange({
                      options: remaining,
                      correctOptionId:
                        isCorrect && remaining.length > 0
                          ? remaining[0].id
                          : isCorrect
                            ? ''
                            : question.correctOptionId,
                    });
                  }}
                  disabled={question.options.length <= 2}
                  className="text-ink-muted hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() =>
            onChange({
              options: [
                ...question.options,
                { id: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text: '' },
              ],
            })
          }
          className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-700"
        >
          <Plus className="size-3.5" /> إضافة اختيار
        </button>
      </div>

      {error ? (
        <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-danger/8 px-3 py-2 text-xs font-semibold text-danger">
          <TriangleAlert className="size-3.5" />
          {error}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_5rem]">
        <Textarea
          label="الشرح بعد الإجابة (اختياري)"
          value={question.explanation ?? ''}
          onChange={(e) => onChange({ explanation: e.target.value })}
        />
        <Input
          label="درجة السؤال"
          type="number"
          min={1}
          value={question.points || 0}
          onChange={(e) => onChange({ points: Number(e.target.value) || 0 })}
        />
      </div>
    </div>
  );
}

function IconButton({
  children,
  onClick,
  disabled,
  danger,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`flex size-8 items-center justify-center rounded-lg border transition ${
        danger
          ? 'border-danger/20 text-danger hover:bg-danger/5'
          : 'border-border text-ink-muted hover:bg-surface hover:text-ink'
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {children}
    </button>
  );
}