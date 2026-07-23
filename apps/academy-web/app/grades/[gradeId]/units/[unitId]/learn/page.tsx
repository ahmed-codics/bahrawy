'use client';

import { FormEvent, use, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, FileText, Lock, PlayCircle } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  PageHeader,
  PageIntro,
  PageSkeleton,
  ProviderVideoPlayer,
  VideoPlayback,
} from '@bahrawy/ui';
import { fetchApi } from '../../../../../../lib/api';

type ContentItem = {
  type: string;
  lessonId?: string;
  assessmentId?: string;
  titleAr: string;
  contentUrl?: string;
  attachedPdfUrl?: string;
  homeworkPdfUrl?: string;
  durationSeconds?: number;
  completedAt?: string | null;
  available: boolean;
  questionCount?: number;
};
type UnitPayload = {
  unit: { id: string; titleAr: string };
  contentItems: ContentItem[];
  hasAccess: boolean;
  access?: {
    reason?: string;
    prerequisite?: { id: string; titleAr: string; type: string };
  };
};
type AttemptPayload = {
  id: string;
  autosavedAnswers?: Record<string, string>;
  assessment: {
    questions: {
      questionId: string;
      question: {
        id: string;
        titleAr: string;
        options: unknown;
        points: number;
      };
    }[];
  };
};
type QuestionOption = { id: string; text: string };
type AssessmentResult = {
  score?: number;
  attempt?: { score?: number };
};

function normalizeQuestionOptions(options: unknown): QuestionOption[] {
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

export default function LearnPage({
  params,
}: {
  params: Promise<{ gradeId: string; unitId: string }>;
}) {
  const { gradeId, unitId } = use(params);
  const router = useRouter();
  const [payload, setPayload] = useState<UnitPayload | null>(null);
  const [videoPlaybacks, setVideoPlaybacks] = useState<Record<string, VideoPlayback>>({});
  const [assessment, setAssessment] = useState<AttemptPayload | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const lastProgressReport = useRef<Record<string, number>>({});

  const load = async () => {
    const response = await fetchApi(`/catalog/units/${unitId}`);
    const data = response.data as UnitPayload;
    if (!data.hasAccess && data.access?.reason !== 'PREREQUISITE') {
      router.replace(`/grades/${gradeId}/units/${unitId}/buy`);
      return;
    }
    setPayload(data);
    if (!data.hasAccess) return;
    const videos = data.contentItems.filter(
      (item) => item.type === 'VIDEO' && item.lessonId && item.available,
    );
    const signedEntries = await Promise.all(
      videos.map(async (item) => {
        const video = await fetchApi(`/video/${item.lessonId}/hls`);
        return [
          item.lessonId!,
          video.data ?? {
            provider: video.provider ?? 'LOCAL',
            url: video.signedUrl,
            videoId: video.videoId,
          },
        ] as const;
      }),
    );
    setVideoPlaybacks(Object.fromEntries(signedEntries));
  };

  useEffect(() => {
    load()
      .catch(() => router.replace('/login'))
      .finally(() => setLoading(false));
  }, [gradeId, unitId, router]);

  const homework = useMemo(
    () => payload?.contentItems.find((item) => item.type === 'ASSESSMENT'),
    [payload],
  );

  const startHomework = async (assessmentId: string) => {
    const response = await fetchApi(`/assessment/${assessmentId}`);
    setAssessment(response.data);
    setAnswers(response.data.autosavedAnswers || {});
  };

  const submitHomework = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!homework?.assessmentId) return;
    const response = await fetchApi(`/assessment/${homework.assessmentId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    });
    setResult(response.data);
  };

  const reportProgress = (lessonId: string, currentTime = 1, duration = 1) => {
    const bucket = Math.floor((currentTime / Math.max(1, duration)) * 10);
    if (bucket <= (lastProgressReport.current[lessonId] ?? 0)) return;
    lastProgressReport.current[lessonId] = bucket;

    return fetchApi(`/video/${lessonId}/progress`, {
      method: 'POST',
      body: JSON.stringify({
        watchedSeconds: Math.floor(currentTime),
        durationSeconds: Math.max(1, Math.floor(duration)),
      }),
    }).catch(() => undefined);
  };

  if (loading) return <PageSkeleton cards={3} />;
  if (!payload) return <EmptyState title="تعذر فتح الدرس" />;

  return (
    <PageIntro className="space-y-7">
      <PageHeader
        eyebrow="التعلم"
        title={payload.unit.titleAr}
        description="شاهد الشرح، راجع الملفات، ثم حل الواجب عندما يصبح متاحًا."
      />

      <div className="space-y-5">
        {payload.contentItems.map((item) => {
          if (item.type === 'VIDEO' && item.lessonId) {
            return (
              <Card key={item.lessonId}>
                <CardContent className="space-y-4 pt-6">
                  <SectionTitle
                    icon={<PlayCircle className="size-5" />}
                    title={item.titleAr}
                    available={item.available}
                    done={!!item.completedAt}
                  />
                  {item.available && videoPlaybacks[item.lessonId] ? (
                    <ProviderVideoPlayer
                      playback={videoPlaybacks[item.lessonId]}
                      className="aspect-video overflow-hidden rounded-xl"
                      onProgress={(ratio, currentTime, duration) => {
                        if (ratio > 0.9) void reportProgress(item.lessonId!, currentTime, duration);
                      }}
                      onEnded={() => void reportProgress(item.lessonId!)}
                    />
                  ) : (
                    <LockedMessage />
                  )}
                </CardContent>
              </Card>
            );
          }

          if (item.type === 'PDF') {
            const pdfUrl = item.attachedPdfUrl || item.contentUrl;
            return (
              <Card key={item.lessonId}>
                <CardContent className="space-y-4 pt-6">
                  <SectionTitle
                    icon={<FileText className="size-5" />}
                    title={item.titleAr}
                    available={item.available}
                    done={!!item.completedAt}
                  />
                  {item.available && pdfUrl ? (
                    <div className="space-y-3">
                      <iframe
                        src={pdfUrl}
                        className="h-[520px] w-full rounded-xl border border-border-default bg-white"
                        title={item.titleAr}
                      />
                      <Button variant="outline" onClick={() => window.open(pdfUrl, '_blank')}>
                        فتح الملف في تبويب جديد
                      </Button>
                    </div>
                  ) : (
                    <LockedMessage />
                  )}
                </CardContent>
              </Card>
            );
          }

          if (item.type === 'ASSESSMENT') {
            return (
              <Card key={item.assessmentId}>
                <CardContent className="space-y-4 pt-6">
                  <SectionTitle
                    icon={<CheckCircle2 className="size-5" />}
                    title={item.titleAr}
                    available={item.available}
                    done={!!item.completedAt}
                  />
                  {item.homeworkPdfUrl && (
                    <Button
                      variant="outline"
                      onClick={() => window.open(item.homeworkPdfUrl, '_blank')}
                    >
                      فتح ملف الواجب
                    </Button>
                  )}
                  {!item.available ? (
                    <LockedMessage />
                  ) : !assessment ? (
                    <Button
                      onClick={() => item.assessmentId && void startHomework(item.assessmentId)}
                    >
                      ابدأ الواجب
                    </Button>
                  ) : (
                    <form onSubmit={submitHomework} className="space-y-5">
                      {assessment.assessment.questions.map((entry, index) => {
                        const options = normalizeQuestionOptions(entry.question.options);
                        return (
                          <div
                            key={entry.questionId}
                            className="rounded-xl border border-border-default bg-surface-soft p-4"
                          >
                            <p dir="auto" className="text-start font-bold [unicode-bidi:plaintext]">
                              {index + 1}. {entry.question.titleAr}
                            </p>
                            <div className="mt-3 grid gap-2">
                              {options.map((option) => (
                                <label
                                  key={option.id}
                                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border-default bg-surface p-3"
                                >
                                  <input
                                    type="radio"
                                    name={entry.questionId}
                                    checked={answers[entry.questionId] === option.id}
                                    onChange={() =>
                                      setAnswers((current) => ({
                                        ...current,
                                        [entry.questionId]: option.id,
                                      }))
                                    }
                                  />
                                  <span
                                    dir="auto"
                                    className="flex-1 text-start [unicode-bidi:plaintext]"
                                  >
                                    {option.text}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      <Button type="submit">تسليم الواجب</Button>
                      {result && (
                        <div className="rounded-xl border border-success/20 bg-success/10 p-4 text-success">
                          <p className="font-black">
                            درجتك: {result.score ?? result.attempt?.score ?? 0}%
                          </p>
                          <Button
                            className="mt-3"
                            variant="outline"
                            trailingIcon={<ArrowLeft className="size-4" />}
                            onClick={() => router.push(`/grades/${gradeId}`)}
                          >
                            الدرس التالي
                          </Button>
                        </div>
                      )}
                    </form>
                  )}
                </CardContent>
              </Card>
            );
          }

          return null;
        })}
      </div>
    </PageIntro>
  );
}

function SectionTitle({
  icon,
  title,
  available,
  done,
}: {
  icon: React.ReactNode;
  title: string;
  available: boolean;
  done?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          {icon}
        </span>
        <h2 className="font-heading text-xl font-black">{title}</h2>
      </div>
      <Badge tone={!available ? 'danger' : done ? 'success' : 'blue'}>
        {!available ? 'مغلق' : done ? 'مكتمل' : 'متاح'}
      </Badge>
    </div>
  );
}

function LockedMessage() {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-danger/20 bg-danger/5 p-4 text-sm font-bold text-danger">
      <Lock className="size-4" />
      هذا الجزء سيفتح بعد استكمال الخطوة السابقة.
    </div>
  );
}
