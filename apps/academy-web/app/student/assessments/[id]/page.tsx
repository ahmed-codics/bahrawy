'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Clock3, Save, Trophy, XCircle } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  ErrorState,
  PageHeader,
  PageIntro,
  PageSkeleton,
  ProgressBar,
} from '@bahrawy/ui';
import { fetchApi } from '../../../../lib/api';

type Option = { id: string; text: string };
type AssessmentQuestion = {
  questionId: string;
  sort: number;
  question: { id: string; titleAr: string; options: unknown; points: number };
};
type Attempt = {
  id: string;
  expiresAt: string | null;
  submittedAt?: string | null;
  score?: number | string | null;
  resultsReleased?: boolean;
  passed?: boolean | null;
  attemptsUsed?: number;
  attemptsRemaining?: number | null;
  autosavedAnswers?: Record<string, string>;
  assessment: {
    titleAr: string;
    passingScore: number | null;
    maxAttempts: number | null;
    questions: AssessmentQuestion[];
  };
};
type Result = {
  score?: number | string | null;
  resultsReleased?: boolean;
  submittedAt?: string | null;
  passingScore?: number | null;
  maxAttempts?: number | null;
  passed?: boolean | null;
  attemptsUsed?: number;
  attemptsRemaining?: number | null;
};

function normalizeOptions(options: unknown): Option[] {
  if (Array.isArray(options)) {
    return options.flatMap((option, index) => {
      if (typeof option === 'string') {
        return [{ id: String(index + 1), text: option }];
      }
      if (!option || typeof option !== 'object') return [];

      const item = option as Record<string, unknown>;
      const text = item.text ?? item.textAr ?? item.titleAr ?? item.label ?? item.value;
      if (typeof text !== 'string') return [];

      return [
        {
          id: typeof item.id === 'string' ? item.id : String(index + 1),
          text,
        },
      ];
    });
  }

  if (options && typeof options === 'object') {
    return Object.entries(options as Record<string, unknown>).flatMap(([id, text]) =>
      typeof text === 'string' ? [{ id, text }] : [],
    );
  }

  return [];
}

export default function AssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(0);

  const loadAttempt = useCallback(
    async (newAttempt = false) => {
      setLoading(true);
      setError('');
      try {
        const start = await fetchApi(`/assessments/${id}/start`, {
          method: 'POST',
          body: JSON.stringify({ newAttempt }),
        });
        const response = await fetchApi(`/assessments/attempt/${start.data.id}`);
        const data = response.data as Attempt;
        setAttempt(data);
        setAnswers(data.autosavedAnswers || {});
        if (data.submittedAt) {
          setResult({
            ...data,
            passingScore: data.assessment.passingScore,
            maxAttempts: data.assessment.maxAttempts,
          });
        } else {
          setResult(null);
        }
      } catch (caught) {
        setAttempt(null);
        setError(caught instanceof Error ? caught.message : 'تعذر بدء الاختبار.');
      } finally {
        setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    void loadAttempt();
  }, [loadAttempt]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const questions = useMemo(
    () => [...(attempt?.assessment.questions || [])].sort((a, b) => a.sort - b.sort),
    [attempt],
  );
  const hasTimeLimit = Boolean(attempt?.expiresAt);
  const remainingSeconds = attempt?.expiresAt
    ? Math.max(0, Math.floor((new Date(attempt.expiresAt).getTime() - now) / 1000))
    : 0;
  const answeredCount = questions.filter((question) => answers[question.questionId]).length;

  const chooseAnswer = async (questionId: string, optionId: string) => {
    if (!attempt) return;
    const next = { ...answers, [questionId]: optionId };
    setAnswers(next);
    setSaveState('saving');
    try {
      await fetchApi(`/assessments/attempt/${attempt.id}/autosave`, {
        method: 'POST',
        body: JSON.stringify({ answers: next }),
      });
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  };

  const submit = async () => {
    if (!attempt) return;
    if (
      answeredCount < questions.length &&
      !window.confirm('ما زالت هناك أسئلة بدون إجابة. هل تريد الإرسال الآن؟')
    )
      return;
    setSubmitting(true);
    setError('');
    try {
      await fetchApi(`/assessments/attempt/${attempt.id}/autosave`, {
        method: 'POST',
        body: JSON.stringify({ answers }),
      });
      const response = await fetchApi(`/assessments/attempt/${attempt.id}/submit`, {
        method: 'POST',
      });
      setResult({
        ...response.data,
        passingScore: attempt.assessment.passingScore,
        maxAttempts: attempt.assessment.maxAttempts,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'فشل إرسال الاختبار.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <PageSkeleton cards={4} />;
  if (error && !attempt)
    return (
      <ErrorState
        title="تعذر فتح الاختبار"
        description={error}
        onRetry={() => window.location.reload()}
      />
    );

  if (result) {
    const score = Number(result.score || 0);
    const resultsReleased = Boolean(result.resultsReleased);
    const hasPassingScore = result.passingScore !== null && result.passingScore !== undefined;
    const passed = result.passed ?? (hasPassingScore ? score >= Number(result.passingScore) : null);
    const successful = !resultsReleased || passed !== false;
    const canRetry = resultsReleased && result.attemptsRemaining !== 0;
    return (
      <PageIntro className="mx-auto max-w-2xl">
        <Card tone={successful ? 'cyan' : 'coral'}>
          <CardContent className="py-10 text-center sm:py-14">
            <span
              className={`mx-auto flex size-20 items-center justify-center rounded-[1.5rem] ${successful ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}
            >
              {passed === true ? (
                <Trophy className="size-10" />
              ) : passed === false && resultsReleased ? (
                <XCircle className="size-10" />
              ) : (
                <CheckCircle2 className="size-10" />
              )}
            </span>
            <Badge className="mt-6" tone={successful ? 'success' : 'danger'}>
              {!resultsReleased
                ? 'تم التسليم'
                : !hasPassingScore
                  ? 'تم التصحيح'
                  : passed
                    ? 'تم الاجتياز'
                    : 'لم يتم الاجتياز'}
            </Badge>
            <h1 className="mt-4 font-heading text-3xl font-black">تم تسليم الاختبار</h1>
            {resultsReleased ? (
              <>
                <p className="ba-number mt-5 text-6xl font-black">{score.toFixed(0)}%</p>
                {hasPassingScore && (
                  <p className="mt-3 text-text-muted">درجة الاجتياز: {result.passingScore}%</p>
                )}
              </>
            ) : (
              <p className="mt-5 text-text-muted">تم حفظ إجاباتك، وستظهر النتيجة بعد اعتمادها.</p>
            )}
            {result.maxAttempts !== null && result.maxAttempts !== undefined && (
              <p className="mt-3 text-sm text-text-muted">
                استخدمت {result.attemptsUsed ?? 1} من {result.maxAttempts} محاولة
              </p>
            )}
            {resultsReleased && passed === false && result.attemptsRemaining === 0 && (
              <p className="mt-5 font-bold text-danger">
                تم استهلاك جميع المحاولات. تواصل مع خدمة العملاء للمساعدة.
              </p>
            )}
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {canRetry && (
                <Button onClick={() => void loadAttempt(true)}>
                  {passed === true ? 'إعادة الاختبار' : 'بدء محاولة جديدة'}
                </Button>
              )}
              {resultsReleased && passed === false && result.attemptsRemaining === 0 && (
                <Button onClick={() => router.push('/student/support')}>
                  التواصل مع خدمة العملاء
                </Button>
              )}
              <Button variant="outline" onClick={() => router.push('/student/courses')}>
                العودة إلى الكورسات
              </Button>
            </div>
          </CardContent>
        </Card>
      </PageIntro>
    );
  }

  return (
    <PageIntro className="mx-auto max-w-4xl space-y-7">
      <PageHeader
        eyebrow="اختبار إلكتروني"
        title={attempt?.assessment.titleAr || 'الاختبار'}
        description="يتم حفظ إجابتك تلقائياً بعد كل اختيار."
        actions={
          <Button variant="outline" onClick={() => router.back()}>
            خروج
          </Button>
        }
      />
      <div className="sticky top-20 z-20 grid gap-3 rounded-2xl border border-border-default bg-surface/95 p-4 shadow-sm backdrop-blur sm:grid-cols-[1fr_auto_auto] sm:items-center">
        <ProgressBar
          value={questions.length ? (answeredCount / questions.length) * 100 : 0}
          label={`${answeredCount} من ${questions.length} سؤال`}
          tone="violet"
        />
        <Badge
          tone={hasTimeLimit && remainingSeconds < 300 ? 'coral' : 'blue'}
          className="justify-center"
        >
          <Clock3 className="size-4" />
          {hasTimeLimit ? (
            <span className="ba-number">
              {String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:
              {String(remainingSeconds % 60).padStart(2, '0')}
            </span>
          ) : (
            <span>بدون حد زمني</span>
          )}
        </Badge>
        <span
          className={`flex items-center gap-1.5 text-xs font-bold ${saveState === 'error' ? 'text-danger' : 'text-text-muted'}`}
        >
          <Save className="size-4" />
          {saveState === 'saving'
            ? 'جاري الحفظ'
            : saveState === 'error'
              ? 'تعذر الحفظ'
              : 'محفوظ تلقائياً'}
        </span>
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-danger/20 bg-danger/10 p-4 font-bold text-danger"
        >
          {error}
        </div>
      )}
      <div className="space-y-5">
        {questions.map((entry, index) => (
          <Card key={entry.questionId}>
            <CardContent className="pt-5 sm:pt-6">
              <div className="flex items-start gap-4">
                <span className="ba-number flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 font-black text-brand-700 dark:bg-brand-950/30 dark:text-brand-200">
                  {index + 1}
                </span>
                <div className="flex-1">
                  <h2
                    dir="auto"
                    className="text-start font-heading text-lg font-black leading-8 [unicode-bidi:plaintext]"
                  >
                    {entry.question.titleAr}
                  </h2>
                  <div className="mt-5 grid gap-3">
                    {normalizeOptions(entry.question.options).map((option) => {
                      const selected = answers[entry.questionId] === option.id;
                      return (
                        <label
                          key={option.id}
                          className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${selected ? 'border-violet-500 bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-200' : 'border-border-default hover:border-violet-300 hover:bg-surface-soft'}`}
                        >
                          <input
                            type="radio"
                            className="size-5 accent-violet-600"
                            name={entry.questionId}
                            value={option.id}
                            checked={selected}
                            onChange={() => chooseAnswer(entry.questionId, option.id)}
                          />
                          <span
                            dir="auto"
                            className="flex-1 text-start font-bold [unicode-bidi:plaintext]"
                          >
                            {option.text}
                          </span>
                          {selected && <CheckCircle2 className="ms-auto size-5" />}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex justify-end border-t border-border-default pt-6">
        <Button size="lg" loading={submitting} loadingText="جاري التسليم..." onClick={submit}>
          إنهاء وتسليم الاختبار
        </Button>
      </div>
    </PageIntro>
  );
}
