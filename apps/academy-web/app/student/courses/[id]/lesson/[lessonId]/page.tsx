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
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
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
  const [preview, setPreview] = useState<Preview | null>(null);
  const [playback, setPlayback] = useState<VideoPlayback | null>(null);
  const [loading, setLoading] = useState(true);
  const lastReported = useRef(0);

  useEffect(() => {
    fetchApi(`/catalog/lessons/${lessonId}`)
      .then(async (response) => {
        const current = response.data.lesson as Lesson;
        setLesson(current);
        if (current.contentType === 'VIDEO') {
          const video = await fetchApi(`/video/${lessonId}/hls`);
          setPlayback(
            video.data ?? {
              provider: video.provider ?? 'LOCAL',
              url: video.signedUrl,
              videoId: video.videoId,
            },
          );
        }
      })
      .catch(async () => {
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
    const bucket = Math.floor(ratio * 10);
    if (bucket <= lastReported.current) return;
    lastReported.current = bucket;
    fetchApi(`/video/${lessonId}/progress`, {
      method: 'POST',
      body: JSON.stringify({
        watchedSeconds: Math.floor(currentTime),
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
            <section className="overflow-hidden rounded-[1.5rem] bg-[#04151f] p-2 shadow-2xl sm:p-3">
              {playback ? (
                <ProviderVideoPlayer
                  playback={playback}
                  className="aspect-video"
                  onProgress={reportProgress}
                  onEnded={() => reportProgress(1, 1, 1)}
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
                      className="h-[70dvh] min-h-[32rem] w-full rounded-2xl border border-border-default bg-white"
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
        </>
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
    <section className="relative overflow-hidden rounded-[2rem] border border-brand-200 bg-[radial-gradient(circle_at_85%_10%,rgba(76,201,240,.25),transparent_21rem),linear-gradient(135deg,#f8fdff,#eaf8fb)] p-7 text-center dark:border-brand-900 dark:bg-[linear-gradient(135deg,#061f2b,#092f40)] sm:p-11">
      <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-brand-700 text-white shadow-lg">
        <LockKeyhole className="size-7" />
      </div>
      <p className="mt-6 text-sm font-bold text-brand-700 dark:text-brand-200">
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
