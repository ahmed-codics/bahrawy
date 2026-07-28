'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  ListChecks,
  Save,
  Trophy,
  XCircle,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  ErrorState,
  MobileSheet,
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
  question: {
    id: string;
    titleAr: string;
    options: unknown;
    points: number;
    correctOptionId?: string | null;
    explanation?: string | null;
  };
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
  autosavedAnswers?: Record<string, string>;
  assessment?: Attempt['assessment'];
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
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [navigatorOpen, setNavigatorOpen] = useState(false);

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
    const frame = window.requestAnimationFrame(() => {
      void loadAttempt();
    });
    return () => window.cancelAnimationFrame(frame);
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
  const activeQuestionIndex = Math.min(currentQuestion, Math.max(questions.length - 1, 0));
  const activeQuestion = questions[activeQuestionIndex];

  useEffect(() => {
    if (!attempt || result) return;
    window.dispatchEvent(new Event('bahrawy:critical-start'));
    return () => {
      window.dispatchEvent(new Event('bahrawy:critical-end'));
    };
  }, [attempt, result]);

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

  const renderQuestion = (entry: AssessmentQuestion, index: number) => (
    <Card key={entry.questionId} id={`question-${index}`}>
      <CardContent className="pt-5 sm:pt-6">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <span className="ba-number flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 font-black text-brand-700 dark:bg-brand-950/30 dark:text-brand-200">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <h2
              dir="auto"
              className="break-words text-start font-heading text-lg font-black leading-8 [unicode-bidi:plaintext]"
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
                      className="size-5 shrink-0 accent-violet-600"
                      name={entry.questionId}
                      value={option.id}
                      checked={selected}
                      onChange={() => void chooseAnswer(entry.questionId, option.id)}
                    />
                    <span
                      dir="auto"
                      className="min-w-0 flex-1 break-words text-start font-bold [unicode-bidi:plaintext]"
                    >
                      {option.text}
                    </span>
                    {selected && <CheckCircle2 className="ms-auto size-5 shrink-0" />}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

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
    const resultQuestions = result.assessment?.questions ?? [];
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
        {resultsReleased && resultQuestions.length > 0 && (
          <div className="mt-16 animate-fade-up" style={{ animationDelay: '100ms' }}>
            <h2 className="mb-8 text-center font-heading text-3xl font-black">تفاصيل الإجابات</h2>
            <div className="grid gap-6">
              {[...resultQuestions]
                .sort((a, b) => a.sort - b.sort)
                .map((aq, index) => {
                  const question = aq.question;
                  const options = normalizeOptions(question.options);
                  const studentAnswer = (result.autosavedAnswers || {})[question.id];
                  const isCorrect =
                    String(studentAnswer) === String(question.correctOptionId) ||
                    options.find((option) => option.id === studentAnswer)?.text ===
                      question.correctOptionId;
                  const correctOption = options.find(
                    (option) =>
                      String(option.id) === String(question.correctOptionId) ||
                      option.text === question.correctOptionId,
                  );
                  const studentOption = options.find(
                    (option) =>
                      String(option.id) === String(studentAnswer) || option.text === studentAnswer,
                  );

                  return (
                    <Card key={question.id} tone={isCorrect ? 'cyan' : 'coral'}>
                      <CardContent className="p-6 sm:p-8">
                        <div className="mb-6 flex items-start gap-4">
                          <div
                            className={`flex size-10 shrink-0 items-center justify-center rounded-xl font-black ${isCorrect ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}
                          >
                            {index + 1}
                          </div>
                          <div className="mt-1 flex-1">
                            <p className="font-bold text-lg leading-relaxed">{question.titleAr}</p>

                            <div className="mt-6 grid gap-4 sm:grid-cols-2">
                              <div
                                className={`flex items-start gap-3 rounded-xl p-4 border ${isCorrect ? 'bg-success/5 border-success/10 text-success' : 'bg-danger/5 border-danger/10 text-danger'}`}
                              >
                                {isCorrect ? (
                                  <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
                                ) : (
                                  <XCircle className="mt-0.5 size-5 shrink-0" />
                                )}
                                <div>
                                  <p className="font-bold">إجابتك:</p>
                                  {studentAnswer ? (
                                    <p className="mt-1 font-medium">
                                      {studentOption?.text || studentAnswer}
                                    </p>
                                  ) : (
                                    <p className="mt-1 font-medium">لم يتم الإجابة</p>
                                  )}
                                </div>
                              </div>

                              {!isCorrect && correctOption && (
                                <div className="flex items-start gap-3 rounded-xl bg-success/5 p-4 text-success border border-success/10">
                                  <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
                                  <div>
                                    <p className="font-bold">الإجابة الصحيحة:</p>
                                    <p className="mt-1 font-medium">{correctOption.text}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </div>
        )}
      </PageIntro>
    );
  }

  return (
    <PageIntro className="mx-auto max-w-[1200px] space-y-7">
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
      <div className="grid items-start gap-8 lg:grid-cols-[1fr_280px]">
        <div className="space-y-7">
          <div className="sticky top-[4.5rem] z-20 grid gap-3 rounded-2xl border border-border-default bg-surface/95 p-3 shadow-sm backdrop-blur sm:top-20 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:p-4">
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
          <div className="lg:hidden">
            {activeQuestion && renderQuestion(activeQuestion, activeQuestionIndex)}
          </div>
          <div className="hidden space-y-5 lg:block">
            {questions.map((entry, index) => renderQuestion(entry, index))}
          </div>
          <div className="hidden justify-end border-t border-border-default pt-6 lg:flex">
            <Button size="lg" loading={submitting} loadingText="جاري التسليم..." onClick={submit}>
              إنهاء وتسليم الاختبار
            </Button>
          </div>
          <div className="exam-mobile-actions lg:hidden">
            <Button
              variant="outline"
              size="icon"
              aria-label="السؤال السابق"
              disabled={activeQuestionIndex === 0}
              onClick={() => setCurrentQuestion((value) => Math.max(0, value - 1))}
            >
              <ArrowRight className="size-5" />
            </Button>
            <Button
              variant="ghost"
              className="min-w-0 flex-1"
              onClick={() => setNavigatorOpen(true)}
            >
              <ListChecks className="size-5" />
              <span className="ba-number">
                {activeQuestionIndex + 1} / {questions.length}
              </span>
            </Button>
            {activeQuestionIndex < questions.length - 1 ? (
              <Button
                size="icon"
                aria-label="السؤال التالي"
                onClick={() =>
                  setCurrentQuestion((value) => Math.min(questions.length - 1, value + 1))
                }
              >
                <ArrowLeft className="size-5" />
              </Button>
            ) : (
              <Button
                className="shrink-0 px-4"
                loading={submitting}
                loadingText="جارٍ..."
                onClick={() => void submit()}
              >
                تسليم
              </Button>
            )}
          </div>
        </div>

        {/* Right Sidebar Navigation Grid */}
        <div className="sticky top-20 z-10 hidden lg:block">
          <Card>
            <CardContent className="p-5">
              <h3 className="mb-4 font-bold text-lg">أرقام الأسئلة</h3>
              <div className="flex flex-wrap gap-2">
                {questions.map((entry, index) => {
                  const isAnswered = !!answers[entry.questionId];
                  return (
                    <button
                      key={entry.questionId}
                      type="button"
                      onClick={() => {
                        const el = document.getElementById(`question-${index}`);
                        if (el) {
                          const y = el.getBoundingClientRect().top + window.scrollY - 100;
                          window.scrollTo({ top: y, behavior: 'smooth' });
                        }
                      }}
                      className={`ba-number flex size-10 items-center justify-center rounded-xl font-bold transition hover:scale-105 ${isAnswered ? 'bg-violet-600 text-white shadow-md' : 'bg-surface-soft text-text-muted hover:bg-surface-hover hover:text-text'}`}
                      title={isAnswered ? 'تمت الإجابة' : 'لم يتم الإجابة'}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <MobileSheet
        open={navigatorOpen}
        onClose={() => setNavigatorOpen(false)}
        title="التنقل بين الأسئلة"
        description={`${answeredCount} من ${questions.length} سؤال تمت الإجابة عنه`}
      >
        <div className="grid grid-cols-5 gap-3 py-2">
          {questions.map((entry, index) => {
            const isAnswered = Boolean(answers[entry.questionId]);
            const isCurrent = index === activeQuestionIndex;
            return (
              <button
                key={entry.questionId}
                type="button"
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`السؤال ${index + 1}${isAnswered ? '، تمت الإجابة' : '، بدون إجابة'}`}
                onClick={() => {
                  setCurrentQuestion(index);
                  setNavigatorOpen(false);
                }}
                className={`ba-number flex aspect-square min-h-11 items-center justify-center rounded-xl border-2 font-black ${
                  isCurrent
                    ? 'border-violet-500 bg-violet-600 text-white'
                    : isAnswered
                      ? 'border-success/30 bg-success/10 text-success'
                      : 'border-border-default bg-surface-soft text-text-muted'
                }`}
              >
                {index + 1}
              </button>
            );
          })}
        </div>
        <Button
          variant="outline"
          className="mt-5 w-full"
          loading={submitting}
          loadingText="جارٍ التسليم..."
          onClick={() => void submit()}
        >
          إنهاء وتسليم الاختبار
        </Button>
      </MobileSheet>
    </PageIntro>
  );
}
