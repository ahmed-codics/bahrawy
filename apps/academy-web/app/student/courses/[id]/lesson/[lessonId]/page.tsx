'use client';

import { use, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileText,
  LockKeyhole,
  PlayCircle,
  ShoppingBag,
  Trophy,
  XCircle,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  ErrorState,
  PageSkeleton,
  ProviderVideoPlayer,
  VideoPlayback,
} from '@bahrawy/ui';
import { API_BASE, fetchApi } from '../../../../../../lib/api';

type Product = {
  id: string;
  titleAr: string;
  prices?: { amount: number | string; currency?: string }[];
};
type Lesson = {
  id: string;
  titleAr: string;
  contentType: string;
  content?: string;
  contentUrl?: string | null;
  attachedPdfUrl?: string | null;
};
type EndOfLessonQuiz = {
  assessmentId: string | null;
  requiredScore: number | null;
  questionCount: number;
  passed: boolean;
  lastScore: number | null;
} | null;
type NextLesson = { id: string; titleAr: string; locked: boolean } | null;
type Preview = {
  titleAr: string;
  contentType: string;
  unitTitle: string;
  product?: Product | null;
};

export default function LessonDetailPage({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  const { id, lessonId } = use(params);
  const router = useRouter();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [quiz, setQuiz] = useState<EndOfLessonQuiz>(null);
  const [nextLesson, setNextLesson] = useState<NextLesson>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [playback, setPlayback] = useState<VideoPlayback | null>(null);
  const [resumePosition, setResumePosition] = useState(0);
  const [accessError, setAccessError] = useState('');
  const [locked, setLocked] = useState<{ titleAr?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const lastReported = useRef(0);

  useEffect(() => {
    fetchApi(`/catalog/lessons/${lessonId}`)
      .then(async (response) => {
        const current = response.data.lesson as Lesson;
        setLesson(current);
        setQuiz(response.data.endOfLessonQuiz ?? null);
        setNextLesson(response.data.nextLesson ?? null);
        if (current.contentType === 'VIDEO') {
          const [video, resume] = await Promise.all([
            fetchApi(`/video/${lessonId}/hls`),
            fetchApi(`/video/${lessonId}/resume`).catch(() => null),
          ]);
          const savedPosition = Number(resume?.data?.position ?? 0);
          setResumePosition(Number.isFinite(savedPosition) ? savedPosition : 0);
          lastReported.current = Number.isFinite(savedPosition)
            ? Math.floor(savedPosition)
            : 0;
          setPlayback(
            video.data ?? {
              provider: video.provider ?? 'LOCAL',
              url: video.signedUrl,
              videoId: video.videoId,
            },
          );
        }
      })
      .catch(async (requestError) => {
        const message =
          requestError instanceof Error ? requestError.message : '';
        if (/device|fingerprint|جهاز/i.test(message)) {
          setAccessError(
            'وصل هذا الحساب إلى الحد الأقصى للأجهزة. أعد تحميل الصفحة بعد إعادة ضبط الأجهزة من الإدارة.',
          );
          return;
        }
        if (/quiz|اختبار|LESSON_LOCKED/i.test(message)) {
          setLocked({});
          try {
            const response = await fetchApi(`/catalog/courses/${id}`);
            for (const chapter of response.data.course.chapters || []) {
              for (const unit of chapter.units || []) {
                const item = (unit.lessons || []).find(
                  (entry: Lesson) => entry.id === lessonId,
                );
                if (item) {
                  setLocked({ titleAr: item.titleAr });
                }
              }
            }
          } catch {
            /* keep generic locked state */
          }
          return;
        }
        try {
          const response = await fetchApi(`/catalog/courses/${id}`);
          for (const chapter of response.data.course.chapters || []) {
            for (const unit of chapter.units || []) {
              const item = (unit.lessons || []).find((entry: Lesson) => entry.id === lessonId);
              if (item) {
                setPreview({
                  titleAr: item.titleAr,
                  contentType: item.contentType,
                  unitTitle: unit.titleAr,
                  product: unit.purchaseProduct,
                });
                return;
              }
            }
          }
        } catch {
          /* show the unavailable state below */
        }
      })
      .finally(() => setLoading(false));
  }, [id, lessonId]);

  const reportProgress = (ratio: number, currentTime: number, duration: number) => {
    const watchedSeconds = Math.max(0, Math.floor(currentTime));
    const isComplete = ratio >= 0.9;
    if (!isComplete && Math.abs(watchedSeconds - lastReported.current) < 5) return;
    lastReported.current = watchedSeconds;
    fetchApi(`/video/${lessonId}/progress`, {
      method: 'POST',
      body: JSON.stringify({
        watchedSeconds,
        durationSeconds: Math.floor(duration),
      }),
    }).catch(() => undefined);
  };

  if (loading) return <PageSkeleton cards={2} />;
  const title = lesson?.titleAr || preview?.titleAr || 'الدرس غير متاح';
  const type = lesson?.contentType || preview?.contentType;

  const pdfSource = lesson?.attachedPdfUrl || lesson?.contentUrl;
  const pdfUrl = pdfSource
    ? /^https?:\/\//i.test(pdfSource)
      ? pdfSource
      : pdfSource.startsWith('/')
        ? `${API_BASE}${pdfSource}`
        : `${API_BASE}/storage/${pdfSource}`
    : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-8">
      <header className="flex flex-col gap-4 rounded-[1.75rem] border border-border-default bg-surface px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Badge tone={type === 'VIDEO' ? 'cyan' : 'violet'}>
            {type === 'VIDEO' ? (
              <>
                <PlayCircle className="size-4" /> فيديو الدرس
              </>
            ) : (
              <>
                <FileText className="size-4" /> محتوى الدرس
              </>
            )}
          </Badge>
          <h1 className="ba-heading mt-3 text-3xl sm:text-4xl">{title}</h1>
          {preview && <p className="mt-2 text-sm text-text-muted">ضمن درس {preview.unitTitle}</p>}
        </div>
        <Button
          variant="outline"
          leadingIcon={<ArrowRight className="size-4" />}
          onClick={() => router.push(`/student/courses/${id}`)}
        >
          العودة للكورس
        </Button>
      </header>

      {lesson ? (
        <>
          {lesson.contentType === 'VIDEO' ? (
            <section className="overflow-hidden rounded-[1.5rem] border border-border-default bg-surface shadow-sm">
              {playback ? (
                <ProviderVideoPlayer
                  playback={playback}
                  initialTime={resumePosition}
                  className="aspect-video rounded-none shadow-none"
                  onProgress={reportProgress}
                />
              ) : (
                <div className="flex aspect-video items-center justify-center text-white/65">
                  الفيديو غير متاح حالياً.
                </div>
              )}
            </section>
          ) : lesson.contentType === 'PDF' ? (
            <Card>
              <CardContent className="space-y-4 pt-6">
                {pdfUrl ? (
                  <>
                    <iframe
                      src={pdfUrl}
                      title={lesson.titleAr}
                      className="aspect-video h-auto min-h-0 w-full rounded-2xl border border-border-default bg-white sm:h-[70dvh] sm:min-h-[32rem]"
                    />
                    <Button
                      variant="outline"
                      leadingIcon={<FileText className="size-4" />}
                      onClick={() => window.open(pdfUrl, '_blank', 'noopener,noreferrer')}
                    >
                      فتح الملف في تبويب جديد
                    </Button>
                  </>
                ) : (
                  <div className="py-12 text-center text-text-muted">
                    ملف الـ PDF غير متاح حالياً.
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="prose prose-slate max-w-none whitespace-pre-wrap text-lg leading-9 dark:prose-invert">
                  {lesson.content || lesson.contentUrl || 'لا يوجد محتوى نصي لهذا الدرس.'}
                </div>
              </CardContent>
            </Card>
          )}
          <div className="flex gap-3 rounded-2xl border border-success/20 bg-success/5 p-4 text-sm text-success">
            <CheckCircle2 className="size-5 shrink-0" />
            <p className="font-bold">
              يُحفظ تقدمك تلقائياً أثناء المذاكرة، ويمكنك العودة للدرس في أي وقت.
            </p>
          </div>
          {quiz && quiz.assessmentId && (
            <EndOfLessonQuizSection
              quiz={
                quiz as unknown as NonNullable<EndOfLessonQuiz> & {
                  assessmentId: string;
                }
              }
              nextLesson={nextLesson}
              onStart={() => router.push(`/student/assessments/${quiz.assessmentId!}`)}
              onGoNext={() =>
                nextLesson && router.push(`/student/courses/${id}/lesson/${nextLesson.id}`)
              }
            />
          )}
        </>
      ) : accessError ? (
        <ErrorState
          title="تعذر فتح الدرس على هذا الجهاز"
          description={accessError}
          onRetry={() => window.location.reload()}
        />
      ) : locked ? (
        <QuizLockedLesson
          titleAr={locked.titleAr}
          onBack={() => router.push(`/student/courses/${id}`)}
        />
      ) : preview ? (
        <LockedLesson
          preview={preview}
          onBuy={() => preview.product && router.push(`/student/checkout/${preview.product.id}`)}
          onCourse={() => router.push(`/student/courses/${id}`)}
        />
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="mx-auto size-8 text-brand-600" />
            <h2 className="mt-4 font-heading text-2xl font-black">تعذر العثور على الدرس</h2>
            <Button className="mt-5" onClick={() => router.push(`/student/courses/${id}`)}>
              العودة للكورس
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LockedLesson({
  preview,
  onBuy,
  onCourse,
}: {
  preview: Preview;
  onBuy: () => void;
  onCourse: () => void;
}) {
  const cost = preview.product?.prices?.[0];
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-brand-200 bg-[radial-gradient(circle_at_85%_10%,rgba(56,189,248,.2),transparent_21rem),linear-gradient(135deg,#ffffff,#f1f5f9)] p-7 text-center shadow-[0_18px_55px_rgb(9_35_63/0.08)] sm:p-11">
      <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 shadow-sm">
        <LockKeyhole className="size-7" />
      </div>
      <p className="mt-6 text-sm font-bold text-brand-700">
        معاينة محتوى الدرس
      </p>
      <h2 className="ba-heading mt-2 text-3xl">هذا المحتوى جاهز لك عند فتح الدرس</h2>
      <p className="mx-auto mt-3 max-w-xl leading-8 text-text-muted">
        أنت الآن ترى مكان المحتوى داخل المنهج. اشترِ هذا الدرس لتشاهد كل مواده، أو ارجع للكورس
        لاختيار الكورس كاملاً أو الباقة.
      </p>
      <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
        {preview.product && (
          <Button
            variant="primary"
            leadingIcon={<ShoppingBag className="size-4" />}
            onClick={onBuy}
          >
            شراء هذا الدرس ·{' '}
            {cost
              ? `${Number(cost.amount).toLocaleString('ar-EG')} ${cost.currency || 'EGP'}`
              : 'اشترك الآن'}
          </Button>
        )}
        <Button variant="outline" onClick={onCourse}>
          خيارات الكورس والباقة
        </Button>
      </div>
    </section>
  );
}

function EndOfLessonQuizSection({
  quiz,
  nextLesson,
  onStart,
  onGoNext,
}: {
  quiz: { assessmentId: string; requiredScore: number | null; questionCount: number; passed: boolean; lastScore: number | null };
  nextLesson: NextLesson;
  onStart: () => void;
  onGoNext: () => void;
}) {
  const passed = quiz.passed;
  return (
    <section
      className={`relative overflow-hidden rounded-[1.75rem] border p-6 sm:p-8 ${
        passed
          ? 'border-success/30 bg-gradient-to-br from-success/10 to-transparent'
          : 'border-brand-200/70 bg-gradient-to-br from-brand-50/70 to-transparent'
      }`}
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span
            className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${
              passed ? 'bg-success/15 text-success' : 'bg-brand-100 text-brand-700'
            }`}
          >
            {passed ? <Trophy className="size-6" /> : <XCircle className="size-6" />}
          </span>
          <div>
            <p className="text-sm font-black text-brand-700 dark:text-brand-300">
              اختبار نهاية الدرس
            </p>
            <h3 className="ba-heading mt-1 text-2xl">
              {passed ? 'تم اجتياز الاختبار 🎉' : 'أكمل اختبار نهاية الدرس'}
            </h3>
            <p className="mt-1 text-sm leading-6 text-text-muted">
              {passed
                ? 'يمكنك الآن الانتقال للدرس التالي.'
                : `${quiz.questionCount} سؤال · مطلوب اجتياز ${quiz.requiredScore ?? 0} درجة للانتقال للدرس التالي.`}
            </p>
            {!passed && quiz.lastScore !== null && (
              <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-error/10 px-3 py-1 text-xs font-bold text-error">
                آخر نتيجة: {quiz.lastScore} — جرّب مرة أخرى لتحقيق درجة النجاح.
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:min-w-44">
          {passed ? (
            <>
              <Button
                variant="primary"
                onClick={onGoNext}
                disabled={!nextLesson || nextLesson.locked}
              >
                {nextLesson ? 'الانتقال للدرس التالي' : 'انتهت دروس هذه الوحدة'}
              </Button>
              <Button variant="outline" onClick={onStart}>
                راجع إجاباتك
              </Button>
            </>
          ) : (
            <Button variant="primary" leadingIcon={<PlayCircle className="size-4" />} onClick={onStart}>
              ابدأ الاختبار
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

function QuizLockedLesson({
  titleAr,
  onBack,
}: {
  titleAr?: string;
  onBack: () => void;
}) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-brand-200 bg-[radial-gradient(circle_at_85%_10%,rgba(56,189,248,.15),transparent_20rem),linear-gradient(135deg,#ffffff,#f1f5f9)] p-8 text-center shadow-[0_18px_55px_rgb(9_35_63/0.08)] sm:p-11">
      <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 shadow-sm">
        <LockKeyhole className="size-7" />
      </div>
      <p className="mt-6 text-sm font-bold text-brand-700">الدرس مقفل</p>
      <h2 className="ba-heading mt-2 text-3xl">
        أكمل اختبار نهاية الدرس السابق أولاً
      </h2>
      <p className="mx-auto mt-3 max-w-xl leading-8 text-text-muted">
        {titleAr ? `للوصول إلى " ${titleAr} "` : 'للوصول إلى هذا الدرس'}{' '}
        يجب أن تجتاز اختبار نهاية الدرس الذي يسبقه، وتحقق درجة النجاح لفتحه
        تلقائياً.
      </p>
      <Button className="mt-7" variant="primary" onClick={onBack}>
        العودة لدروس الكورس
      </Button>
    </section>
  );
}
