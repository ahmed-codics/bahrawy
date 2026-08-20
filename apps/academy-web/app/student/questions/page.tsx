'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  ChevronDown,
  CircleDashed,
  Clock3,
  CornerDownLeft,
  Lock,
  MessageCircleQuestion,
  MessageSquareText,
  Mic,
  Send,
  UserRound,
} from 'lucide-react';
import {
  Badge,
  Button,
  EmptyState,
  ImagePicker,
  ImageViewer,
  PageSkeleton,
  Select,
  Textarea,
  VoicePlayer,
  VoiceRecorder,
} from '@bahrawy/ui';
import { API_BASE, fetchApi } from '../../../lib/api';

type QuestionStatus = 'PENDING_REVIEW' | 'ANSWERED' | 'CLOSED';

type Attachment = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  type: 'IMAGE' | 'VOICE';
  durationSeconds?: number | null;
  url: string;
};

type PendingVoice = { file: File; durationSeconds: number };

type Question = {
  id: string;
  status: QuestionStatus;
  createdAt: string;
  course?: { id: string; titleAr: string } | null;
  lesson?: { id: string; titleAr: string } | null;
  _count?: { messages: number };
  messages?: Message[];
};

type Message = {
  id: string;
  senderType: 'STUDENT' | 'STAFF';
  message: string;
  createdAt: string;
  attachments?: Attachment[];
  senderAccount?: {
    studentProfile?: { displayName?: string | null };
    staffProfile?: { displayName?: string | null };
  } | null;
};

type EnrolledCourse = { id: string; titleAr: string };

type Lesson = { id: string; titleAr: string };

const STATUS_META: Record<
  QuestionStatus,
  { label: string; tone: 'neutral' | 'success' | 'danger' }
> = {
  PENDING_REVIEW: { label: 'قيد المراجعة', tone: 'neutral' },
  ANSWERED: { label: 'تم الرد', tone: 'success' },
  CLOSED: { label: 'مغلق', tone: 'danger' },
};

export default function StudentQuestionsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [threads, setThreads] = useState<Record<string, Question>>({});

  const [message, setMessage] = useState('');
  const [courseId, setCourseId] = useState('');
  const [lessonId, setLessonId] = useState('');
  const [courses, setCourses] = useState<EnrolledCourse[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [composeImages, setComposeImages] = useState<File[]>([]);
  const [replyImages, setReplyImages] = useState<File[]>([]);
  const [composeVoice, setComposeVoice] = useState<PendingVoice | null>(null);
  const [replyVoice, setReplyVoice] = useState<PendingVoice | null>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);

  const fullImageUrl = useCallback((url: string) => {
    return url.startsWith('http') ? url : `${API_BASE}${url}`;
  }, []);

  const uploadImageFiles = useCallback(async (files: File[]): Promise<string[]> => {
    const ids: string[] = [];
    for (const file of files) {
      const form = new FormData();
      form.append('file', file);
      const response = await fetchApi('/student/questions/uploads', {
        method: 'POST',
        body: form,
      });
      ids.push(response.data?.storedObjectId as string);
    }
    return ids;
  }, []);

  const uploadVoiceFile = useCallback(
    async (voice: PendingVoice): Promise<string> => {
      const form = new FormData();
      form.append('file', voice.file);
      const response = await fetchApi('/student/questions/uploads/voice', {
        method: 'POST',
        body: form,
      });
      return response.data?.storedObjectId as string;
    },
    [],
  );

  const loadQuestions = useCallback(async () => {
    const response = await fetchApi('/student/questions');
    setQuestions(response.data?.items || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchApi('/dashboard/student')
      .then((response) => setCourses(response.data?.enrolledCourses || []))
      .catch(() => router.push('/login'))
      .finally(() => void loadQuestions());
  }, [router, loadQuestions]);

  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;
    fetchApi(`/catalog/courses/${courseId}`)
      .then((response) => {
        if (cancelled) return;
        const units =
          response.data?.course?.chapters?.flatMap(
            (chapter: { units?: Lesson[] }) => chapter.units || [],
          ) || [];
        setLessons(units);
      })
      .catch(() => {
        if (!cancelled) setLessons([]);
      })
      .finally(() => {
        if (!cancelled) setLessonsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const handleCourseChange = (value: string) => {
    setCourseId(value);
    setLessonId('');
    setLessons([]);
    setLessonsLoading(Boolean(value));
  };

  const selected = selectedId ? (threads[selectedId] ?? questions.find((q) => q.id === selectedId)) : null;
  const selectedThread = selectedId ? threads[selectedId] : null;

  const openThread = useCallback(
    async (id: string) => {
      setSelectedId(id);
      if (!threads[id]) {
        const response = await fetchApi(`/student/questions/${id}`);
        setThreads((prev) => ({ ...prev, [id]: response.data }));
      }
    },
    [threads],
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      let attachmentIds: string[] = [];
      let voiceDurations: Record<string, number> | undefined;
      if (composeImages.length > 0) {
        setUploadingImages(true);
        attachmentIds = await uploadImageFiles(composeImages);
      }
      if (composeVoice) {
        setUploadingImages(true);
        const voiceId = await uploadVoiceFile(composeVoice);
        attachmentIds.push(voiceId);
        voiceDurations = { [voiceId]: composeVoice.durationSeconds };
      }
      const body: Record<string, unknown> = { message: message.trim() };
      if (courseId) body.courseId = courseId;
      if (lessonId) body.lessonId = lessonId;
      if (attachmentIds.length > 0) body.attachmentIds = attachmentIds;
      if (voiceDurations) body.voiceDurations = voiceDurations;
      await fetchApi('/student/questions', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setMessage('');
      setCourseId('');
      setLessonId('');
      setLessons([]);
      setComposeImages([]);
      setComposeVoice(null);
      await loadQuestions();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'تعذر إرسال السؤال.');
    } finally {
      setUploadingImages(false);
      setSubmitting(false);
    }
  };

  const handleReply = async (id: string) => {
    if (!replyText.trim()) return;
    setReplyingId(id);
    try {
      let attachmentIds: string[] = [];
      let voiceDurations: Record<string, number> | undefined;
      if (replyImages.length > 0) {
        setUploadingImages(true);
        attachmentIds = await uploadImageFiles(replyImages);
      }
      if (replyVoice) {
        setUploadingImages(true);
        const voiceId = await uploadVoiceFile(replyVoice);
        attachmentIds.push(voiceId);
        voiceDurations = { [voiceId]: replyVoice.durationSeconds };
      }
      const body: Record<string, unknown> = { message: replyText.trim() };
      if (attachmentIds.length > 0) body.attachmentIds = attachmentIds;
      if (voiceDurations) body.voiceDurations = voiceDurations;
      await fetchApi(`/student/questions/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setReplyText('');
      setReplyImages([]);
      setReplyVoice(null);
      const response = await fetchApi(`/student/questions/${id}`);
      setThreads((prev) => ({ ...prev, [id]: response.data }));
      await loadQuestions();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'تعذر إرسال الرد.');
    } finally {
      setUploadingImages(false);
      setReplyingId(null);
    }
  };

  const summary = useMemo(() => {
    const counts = { PENDING_REVIEW: 0, ANSWERED: 0, CLOSED: 0 };
    for (const q of questions) counts[q.status] += 1;
    return counts;
  }, [questions]);

  if (loading) return <PageSkeleton cards={4} />;

  return (
    <div className="space-y-8">
      <section className="student-hero student-entrance px-4 py-6 sm:px-9 sm:py-8 lg:px-11">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-3xl">
            <span className="student-kicker">
              <MessageCircleQuestion className="size-4" /> أسئلة الطلبة
            </span>
            <h1 className="ba-heading mt-4 text-3xl leading-[1.2] sm:mt-5 sm:text-5xl">
              قول سؤالك،
              <br />
              <span className="text-brand-700">وخد إجابتك من فريق الأكاديمية.</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-text-muted sm:mt-4 sm:text-base sm:leading-8">
              اسأل عن أي درس أو كورس أو نقطة مش فاهمها. فريقنا بيرد عليك بسرعة على صفحتك دي.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">
              <CircleDashed className="size-3.5" /> {summary.PENDING_REVIEW} قيد المراجعة
            </Badge>
            <Badge tone="success">
              <MessageSquareText className="size-3.5" /> {summary.ANSWERED} تم الرد
            </Badge>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section>
          <div className="mb-4">
            <p className="text-sm font-black text-brand-700 dark:text-brand-300">محادثاتك</p>
            <h2 className="ba-heading mt-1 text-3xl">أسئلتك وإجاباتها</h2>
          </div>

          {questions.length === 0 ? (
            <EmptyState
              icon={<MessageCircleQuestion className="size-7" />}
              title="مفيش أسئلة لسه"
              description="اكتب سؤالك الأول في خانة «اسأل سؤال جديد» وهنرد عليك في أقرب وقت."
            />
          ) : (
            <div className="space-y-3">
              {questions.map((question) => {
                const meta = STATUS_META[question.status];
                const isOpen = selectedId === question.id;
                return (
                  <article
                    key={question.id}
                    className="student-course-card overflow-hidden"
                  >
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 p-4 text-start transition hover:bg-surface-soft sm:p-5"
                      onClick={() => void openThread(question.id)}
                    >
                      <span
                        className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                          question.status === 'ANSWERED'
                            ? 'bg-success/10 text-success'
                            : question.status === 'CLOSED'
                              ? 'bg-surface-3 text-text-muted'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                        }`}
                      >
                        <MessageSquareText className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                          {question.lesson ? (
                            <span className="text-xs font-bold text-text-muted">
                              {question.lesson.titleAr}
                            </span>
                          ) : question.course ? (
                            <span className="text-xs font-bold text-text-muted">
                              {question.course.titleAr}
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-1 block truncate text-sm text-text">
                          {question.messages?.[0]?.message || ''}
                        </span>
                        <span className="mt-1 flex items-center gap-3 text-xs text-text-muted">
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="size-3.5" />
                            {new Date(question.createdAt).toLocaleDateString('ar-EG')}
                          </span>
                          <span>{question._count?.messages || 0} رسائل</span>
                        </span>
                      </span>
                      <ChevronDown
                        className={`size-5 shrink-0 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {isOpen && (
                      <div className="border-t border-border-default bg-surface-soft/60 p-4 sm:p-5">
                        <Thread
                          thread={selectedThread || selected}
                          replyingId={replyingId}
                          replyText={replyText}
                          onReplyText={setReplyText}
                          replyImages={replyImages}
                          onReplyImages={setReplyImages}
                          replyVoice={replyVoice}
                          onReplyVoice={setReplyVoice}
                          uploadingImages={uploadingImages}
                          onReply={() => void handleReply(question.id)}
                          onPreview={setViewerSrc}
                          fullImageUrl={fullImageUrl}
                        />
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside>
          <form
            onSubmit={handleSubmit}
            className="student-panel sticky top-24 p-5 sm:p-6"
          >
            <span className="flex size-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-200">
              <MessageCircleQuestion className="size-5" />
            </span>
            <h2 className="ba-heading mt-3 text-2xl">اسأل سؤال جديد</h2>
            <p className="mt-1 text-sm text-text-muted">
              اكتب سؤالك بالتفصيل عشان نساعدك بدقة.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text">
                  الكورس <span className="text-text-muted">(اختياري)</span>
                </label>
                <Select value={courseId} onChange={(e) => handleCourseChange(e.target.value)}>
                  <option value="">دون تحديد الكورس</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.titleAr}
                    </option>
                  ))}
                </Select>
              </div>

              {courseId && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text">
                    الدرس <span className="text-text-muted">(اختياري)</span>
                  </label>
                  <Select
                    value={lessonId}
                    onChange={(e) => setLessonId(e.target.value)}
                    disabled={lessonsLoading}
                  >
                    <option value="">{lessonsLoading ? 'جاري التحميل...' : 'دون تحديد الدرس'}</option>
                    {lessons.map((lesson) => (
                      <option key={lesson.id} value={lesson.id}>
                        {lesson.titleAr}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              <Textarea
                label="سؤالك"
                required
                placeholder="اكتب سؤالك هنا..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={2000}
              />

              <ImagePicker
                files={composeImages}
                onFilesChange={setComposeImages}
                onPreview={setViewerSrc}
              />

              <VoiceRecorder
                onRecording={(file, durationSeconds) =>
                  setComposeVoice({ file, durationSeconds })
                }
                disabled={submitting || uploadingImages}
              />
              {composeVoice && (
                <PendingVoiceChip
                  voice={composeVoice}
                  onRemove={() => setComposeVoice(null)}
                  disabled={submitting || uploadingImages}
                />
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={submitting || uploadingImages || !message.trim()}
                trailingIcon={<Send className="size-4" />}
              >
                {submitting || uploadingImages ? 'جاري الإرسال...' : 'أرسل السؤال'}
              </Button>
            </div>
          </form>
        </aside>
      </div>

      <ImageViewer src={viewerSrc} onClose={() => setViewerSrc(null)} />
    </div>
  );
}

function PendingVoiceChip({
  voice,
  onRemove,
  disabled,
}: {
  voice: PendingVoice;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2">
      <Mic className="size-4 shrink-0 text-brand-600" aria-hidden="true" />
      <span className="min-w-0 flex-1 text-sm font-bold text-text">
        رسالة صوتية ({voice.durationSeconds} ث)
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={onRemove}
        className="shrink-0"
      >
        إزالة
      </Button>
    </div>
  );
}

function Thread({
  thread,
  replyingId,
  replyText,
  onReplyText,
  replyImages,
  onReplyImages,
  replyVoice,
  onReplyVoice,
  uploadingImages,
  onReply,
  onPreview,
  fullImageUrl,
}: {
  thread?: Question | null;
  replyingId: string | null;
  replyText: string;
  onReplyText: (value: string) => void;
  replyImages: File[];
  onReplyImages: (files: File[]) => void;
  replyVoice: PendingVoice | null;
  onReplyVoice: (voice: PendingVoice | null) => void;
  uploadingImages: boolean;
  onReply: () => void;
  onPreview: (src: string) => void;
  fullImageUrl: (url: string) => string;
}) {
  if (!thread) return <p className="py-6 text-center text-sm text-text-muted">جاري تحميل المحادثة...</p>;

  const isClosed = thread.status === 'CLOSED';
  const hasVoice = (thread.messages || []).some((message) =>
    message.attachments?.some((attachment) => attachment.type === 'VOICE'),
  );
  const contextBits: string[] = [];
  if (thread.course?.titleAr) contextBits.push(thread.course.titleAr);
  if (thread.lesson?.titleAr) contextBits.push(thread.lesson.titleAr);

  return (
    <div className="space-y-3">
      {contextBits.length > 0 && (
        <p className="flex items-center gap-2 text-xs font-bold text-text-muted">
          <BookOpen className="size-4" />
          {contextBits.join(' • ')}
        </p>
      )}
      <div className="space-y-3">
        {(thread.messages || []).map((message) => {
          const isStudent = message.senderType === 'STUDENT';
          const name = isStudent
            ? message.senderAccount?.studentProfile?.displayName || 'أنت'
            : message.senderAccount?.staffProfile?.displayName || 'فريق الأكاديمية';
          return (
            <div
              key={message.id}
              className={`flex ${isStudent ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl border px-4 py-3 ${
                  isStudent
                    ? 'border-brand-200 bg-brand-50 dark:border-brand-900 dark:bg-brand-950/40'
                    : 'border-border-default bg-surface'
                }`}
              >
                <p className="flex items-center gap-1.5 text-xs font-black text-brand-700 dark:text-brand-300">
                  {isStudent ? <UserRound className="size-3.5" /> : <CornerDownLeft className="size-3.5" />}
                  {name}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-7 text-text">{message.message}</p>
                {message.attachments && message.attachments.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {message.attachments.some((a) => a.type === 'VOICE') && (
                      <div className="space-y-1">
                        <p className="text-[11px] font-bold text-text-muted">رسالة صوتية</p>
                        {message.attachments
                          .filter((a) => a.type === 'VOICE')
                          .map((attachment) => (
                            <VoicePlayer
                              key={attachment.id}
                              src={fullImageUrl(attachment.url)}
                              durationSeconds={attachment.durationSeconds}
                              className="rounded-xl border border-border bg-surface-2 p-2"
                            />
                          ))}
                      </div>
                    )}
                    {message.attachments.some((a) => a.type === 'IMAGE') && (
                      <div className="space-y-1">
                        <p className="text-[11px] font-bold text-text-muted">صورة مرفقة</p>
                        <div className="flex flex-wrap gap-1.5">
                          {message.attachments
                            .filter((a) => a.type === 'IMAGE')
                            .map((attachment) => (
                              <button
                                key={attachment.id}
                                type="button"
                                onClick={() => onPreview(fullImageUrl(attachment.url))}
                                className="overflow-hidden rounded-lg border border-border bg-surface-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                                aria-label={`عرض ${attachment.originalName || 'الصورة المرفقة'}`}
                              >
                                <img
                                  src={fullImageUrl(attachment.url)}
                                  alt={attachment.originalName || 'صورة مرفقة'}
                                  loading="lazy"
                                  className="size-16 object-cover sm:size-20"
                                />
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <p className="mt-1 text-[11px] text-text-muted">
                  {new Date(message.createdAt).toLocaleString('ar-EG')}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {isClosed ? (
        <p className="flex items-center gap-2 rounded-xl border border-border-default bg-surface p-3 text-sm text-text-muted">
          <Lock className="size-4" /> هذا السؤال مغلق ولا يمكن إضافة ردود جديدة.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Textarea
              placeholder="اكتب ردك هنا..."
              value={replyText}
              onChange={(e) => onReplyText(e.target.value)}
              maxLength={2000}
              className="min-h-20"
            />
            <Button
              variant="outline"
              onClick={onReply}
              disabled={
                replyingId === thread.id ||
                uploadingImages ||
                !replyText.trim()
              }
              className="self-end shrink-0"
            >
              {replyingId === thread.id || uploadingImages
                ? 'جاري الإرسال...'
                : 'إرسال'}
            </Button>
          </div>
          <ImagePicker
            files={replyImages}
            onFilesChange={onReplyImages}
            disabled={replyingId === thread.id}
            onPreview={onPreview}
          />
          <VoiceRecorder
            onRecording={(file, durationSeconds) =>
              onReplyVoice({ file, durationSeconds })
            }
            disabled={
              replyingId === thread.id || uploadingImages || hasVoice
            }
            error={
              hasVoice
                ? 'يُسمح بإرفاق تسجيل صوتي واحد كحد أقصى لكل سؤال.'
                : undefined
            }
          />
          {replyVoice && (
            <PendingVoiceChip
              voice={replyVoice}
              onRemove={() => onReplyVoice(null)}
              disabled={replyingId === thread.id}
            />
          )}
        </div>
      )}
    </div>
  );
}