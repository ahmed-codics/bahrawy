'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, CornerDownLeft, Eye, MessageCircleQuestion, Mic, Send, UserRound } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Badge,
  Button,
  DataTable,
  Drawer,
  ErrorState,
  FilterBar,
  ImagePicker,
  ImageViewer,
  PageHeader,
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

type Message = {
  id: string;
  senderType: 'STUDENT' | 'STAFF';
  message: string;
  createdAt: string;
  attachments?: Attachment[];
  senderAccount?: {
    id: string;
    studentProfile?: { displayName: string } | null;
    staffProfile?: { displayName: string } | null;
  } | null;
};

type StudentContext = {
  id: string;
  studentProfile?: {
    id: string;
    displayName: string;
    gradeId?: string | null;
    grade?: { id: string; nameAr: string } | null;
  } | null;
};

type Question = {
  id: string;
  status: QuestionStatus;
  createdAt: string;
  course?: { id: string; titleAr: string } | null;
  lesson?: { id: string; titleAr: string } | null;
  account?: StudentContext;
  messages?: Message[];
  _count?: { messages: number };
};

type ListResponse = {
  items: Question[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
};

const STATUS_META: Record<QuestionStatus, { label: string; tone: 'neutral' | 'success' | 'danger' }> = {
  PENDING_REVIEW: { label: 'قيد المراجعة', tone: 'neutral' },
  ANSWERED: { label: 'تم الرد', tone: 'success' },
  CLOSED: { label: 'مغلق', tone: 'danger' },
};

function statusLabel(status: string) {
  return STATUS_META[status as QuestionStatus]?.label ?? status;
}

function contextLabel(question: Question) {
  if (question.lesson?.titleAr) return question.lesson.titleAr;
  if (question.course?.titleAr) return question.course.titleAr;
  return 'سؤال عام';
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

export default function StudentQuestionsAdminPage() {
  const [items, setItems] = useState<Question[]>([]);
  const [meta, setMeta] = useState<{ page: number; pageSize: number; total: number; pageCount: number }>({
    page: 1,
    pageSize: 25,
    total: 0,
    pageCount: 0,
  });
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Question | null>(null);
  const [saving, setSaving] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyImages, setReplyImages] = useState<File[]>([]);
  const [replyVoice, setReplyVoice] = useState<PendingVoice | null>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);

  const fullImageUrl = useCallback((url: string) => {
    return url.startsWith('http') ? url : `${API_BASE}${url}`;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      query.set('page', String(page));
      query.set('pageSize', '25');
      if (status) query.set('status', status);
      if (search.trim()) query.set('search', search.trim());
      const response = await fetchApi<{ data: ListResponse }>(`/admin/v1/student-questions?${query.toString()}`);
      setItems(response.data?.items || []);
      setMeta(response.data?.meta || { page: 1, pageSize: 25, total: 0, pageCount: 0 });
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذر تحميل أسئلة الطلبة');
    } finally {
      setLoading(false);
    }
  }, [page, status, search]);

  useEffect(() => {
    const timeout = setTimeout(() => void load(), 250);
    return () => clearTimeout(timeout);
  }, [load]);

  const openQuestion = async (question: Question) => {
    const response = await fetchApi<{ data: Question }>(`/admin/v1/student-questions/${question.id}`);
    setSelected(response.data);
  };

  const reloadSelected = async () => {
    if (!selected) return;
    const response = await fetchApi<{ data: Question }>(`/admin/v1/student-questions/${selected.id}`);
    setSelected(response.data);
    await load();
  };

  const reply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    const body = replyText.trim();
    if (!body) return;
    setSaving(true);
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
      await fetchApi(`/admin/v1/student-questions/${selected.id}/replies`, {
        method: 'POST',
        body: JSON.stringify({
          message: body,
          ...(attachmentIds.length > 0 ? { attachmentIds } : {}),
          ...(voiceDurations ? { voiceDurations } : {}),
        }),
      });
      setReplyText('');
      setReplyImages([]);
      setReplyVoice(null);
      toast.success('تم إرسال الرد للطالب');
      await reloadSelected();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'تعذر إرسال الرد');
    } finally {
      setUploadingImages(false);
      setSaving(false);
    }
  };

  const uploadImageFiles = async (files: File[]): Promise<string[]> => {
    const ids: string[] = [];
    for (const file of files) {
      const form = new FormData();
      form.append('file', file);
      const response = await fetchApi<{ data: { storedObjectId: string } }>(
        '/admin/v1/student-questions/uploads',
        { method: 'POST', body: form },
      );
      ids.push(response.data.storedObjectId);
    }
    return ids;
  };

  const uploadVoiceFile = async (voice: PendingVoice): Promise<string> => {
    const form = new FormData();
    form.append('file', voice.file);
    const response = await fetchApi<{ data: { storedObjectId: string } }>(
      '/admin/v1/student-questions/uploads/voice',
      { method: 'POST', body: form },
    );
    return response.data.storedObjectId;
  };

  const changeStatus = async (nextStatus: QuestionStatus) => {
    if (!selected) return;
    setSaving(true);
    try {
      await fetchApi(`/admin/v1/student-questions/${selected.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      toast.success('تم تحديث حالة السؤال');
      await reloadSelected();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'تعذر تحديث الحالة');
    } finally {
      setSaving(false);
    }
  };

  const pendingCount = useMemo(
    () => items.filter((item) => item.status === 'PENDING_REVIEW').length,
    [items],
  );

  if (loading && !items.length) return <PageSkeleton cards={5} />;
  if (error && !items.length) {
    return <ErrorState title="تعذر تحميل أسئلة الطلبة" description={error} onRetry={load} />;
  }

  return (
    <div className="space-y-5" dir="rtl">
      <PageHeader
        eyebrow="خدمة الطلاب"
        title="أسئلة الطلبة"
        description={`${pendingCount} سؤال بانتظار المراجعة ضمن النتائج الحالية.`}
      />

      <FilterBar
        value={search}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="ابحث بالطالب أو الكورس أو الدرس"
        filters={
          <>
            <Select
              aria-label="تصفية بالحالة"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="w-40"
            >
              <option value="">كل الحالات</option>
              <option value="PENDING_REVIEW">قيد المراجعة</option>
              <option value="ANSWERED">تم الرد</option>
              <option value="CLOSED">مغلق</option>
            </Select>
          </>
        }
      />

      <DataTable<Question>
        columns={[
          {
            id: 'student',
            header: 'الطالب',
            cell: (question) => (
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-surface-3 text-text-muted">
                  <UserRound className="size-4" />
                </span>
                <span className="font-bold">
                  {question.account?.studentProfile?.displayName || 'طالب'}
                </span>
              </div>
            ),
          },
          {
            id: 'grade',
            header: 'المرحلة',
            cell: (question) => (
              <span className="text-sm text-text-muted">
                {question.account?.studentProfile?.grade?.nameAr || '—'}
              </span>
            ),
          },
          {
            id: 'context',
            header: 'السياق',
            cell: (question) => (
              <span className="inline-flex items-center gap-1.5 text-sm">
                <BookOpen className="size-4 text-text-muted" />
                {contextLabel(question)}
              </span>
            ),
          },
          {
            id: 'lastMessage',
            header: 'آخر رسالة',
            cell: (question) => (
              <span className="block max-w-56 truncate text-sm text-text-muted">
                {question.messages?.[0]?.message || '—'}
              </span>
            ),
          },
          {
            id: 'status',
            header: 'الحالة',
            cell: (question) => {
              const meta = STATUS_META[question.status];
              return <Badge tone={meta.tone}>{meta.label}</Badge>;
            },
          },
          {
            id: 'createdAt',
            header: 'التاريخ',
            cell: (question) => (
              <span className="text-sm text-text-muted">
                {new Date(question.createdAt).toLocaleDateString('ar-EG')}
              </span>
            ),
          },
          {
            id: 'messages',
            header: 'الرسائل',
            cell: (question) => (
              <span className="text-sm text-text-muted">{question._count?.messages || 0}</span>
            ),
          },
        ]}
        data={items}
        keyExtractor={(question) => question.id}
        loading={loading}
        error={error || undefined}
        emptyMessage="لا توجد أسئلة مطابقة"
        page={meta.page}
        pageCount={meta.pageCount}
        onPageChange={setPage}
        rowActions={(question) => (
          <Button
            variant="ghost"
            size="icon"
            aria-label="عرض السؤال"
            onClick={() => void openQuestion(question)}
          >
            <Eye className="size-4" />
          </Button>
        )}
      />

      <Drawer
        isOpen={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="تفاصيل السؤال"
        footer={
          selected ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-text-muted">الحالة:</span>
                <Select
                  aria-label="تغيير الحالة"
                  value={selected.status}
                  onChange={(event) => void changeStatus(event.target.value as QuestionStatus)}
                  disabled={saving}
                  className="w-44"
                >
                  <option value="PENDING_REVIEW">قيد المراجعة</option>
                  <option value="ANSWERED">تم الرد</option>
                  <option value="CLOSED">مغلق</option>
                </Select>
              </div>
              <Badge tone={STATUS_META[selected.status].tone}>
                {statusLabel(selected.status)}
              </Badge>
            </div>
          ) : null
        }
      >
        {selected ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-surface-2 p-3">
                <p className="text-xs font-bold text-text-muted">الطالب</p>
                <p className="mt-1 font-black">
                  {selected.account?.studentProfile?.displayName || 'طالب'}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-surface-2 p-3">
                <p className="text-xs font-bold text-text-muted">المرحلة</p>
                <p className="mt-1 font-black">
                  {selected.account?.studentProfile?.grade?.nameAr || 'غير محددة'}
                </p>
              </div>
              {selected.course && (
                <div className="rounded-xl border border-border bg-surface-2 p-3">
                  <p className="text-xs font-bold text-text-muted">الكورس</p>
                  <p className="mt-1 font-black">{selected.course.titleAr}</p>
                </div>
              )}
              {selected.lesson && (
                <div className="rounded-xl border border-border bg-surface-2 p-3">
                  <p className="text-xs font-bold text-text-muted">الدرس</p>
                  <p className="mt-1 font-black">{selected.lesson.titleAr}</p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {(selected.messages || []).map((message) => {
                const isStudent = message.senderType === 'STUDENT';
                const name = isStudent
                  ? message.senderAccount?.studentProfile?.displayName || 'الطالب'
                  : message.senderAccount?.staffProfile?.displayName || 'فريق الأكاديمية';
                return (
                  <div key={message.id} className={`flex ${isStudent ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl border px-4 py-3 ${
                        isStudent
                          ? 'border-brand-200 bg-brand-50 dark:border-brand-900 dark:bg-brand-950/40'
                          : 'border-border bg-surface'
                      }`}
                    >
                      <p className="flex items-center gap-1.5 text-xs font-black text-brand-700 dark:text-brand-300">
                        {isStudent ? <UserRound className="size-3.5" /> : <CornerDownLeft className="size-3.5" />}
                        {name}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-7">{message.message}</p>
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
                                      onClick={() => setViewerSrc(fullImageUrl(attachment.url))}
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

            {selected.status === 'CLOSED' ? (
              <p className="rounded-xl border border-border bg-surface-2 p-3 text-center text-sm text-text-muted">
                هذا السؤال مغلق. لفتح المحادثة مرة أخرى اختر «قيد المراجعة» من القائمة بالأعلى.
              </p>
            ) : (
              <form onSubmit={reply} className="space-y-3">
                <Textarea
                  name="message"
                  label="الرد على الطالب"
                  required
                  placeholder="اكتب رد فريق الأكاديمية هنا..."
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  maxLength={2000}
                />
                <ImagePicker
                  files={replyImages}
                  onFilesChange={setReplyImages}
                  disabled={saving}
                  onPreview={setViewerSrc}
                />
                {(() => {
                  const threadHasVoice = (selected.messages || []).some((m) =>
                    m.attachments?.some((a) => a.type === 'VOICE'),
                  );
                  return (
                    <VoiceRecorder
                      onRecording={(file, durationSeconds) =>
                        setReplyVoice({ file, durationSeconds })
                      }
                      disabled={saving || uploadingImages || threadHasVoice}
                      error={
                        threadHasVoice
                          ? 'يُسمح بإرفاق تسجيل صوتي واحد كحد أقصى لكل سؤال.'
                          : undefined
                      }
                    />
                  );
                })()}
                {replyVoice && (
                  <PendingVoiceChip
                    voice={replyVoice}
                    onRemove={() => setReplyVoice(null)}
                    disabled={saving}
                  />
                )}
                <Button
                  type="submit"
                  disabled={saving || uploadingImages || !replyText.trim()}
                  trailingIcon={<Send className="size-4" />}
                >
                  {saving || uploadingImages ? 'جاري الإرسال...' : 'إرسال الرد'}
                </Button>
              </form>
            )}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-text-muted">
            <MessageCircleQuestion className="mx-auto mb-2 size-8" />
            اختر سؤالاً لعرض التفاصيل
          </p>
        )}
      </Drawer>

      <ImageViewer src={viewerSrc} onClose={() => setViewerSrc(null)} />
    </div>
  );
}