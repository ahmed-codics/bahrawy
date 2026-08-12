'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  History,
  LockKeyhole,
  RotateCcw,
  ShieldAlert,
  UnlockKeyhole,
} from 'lucide-react';
import {
  Badge,
  Button,
  DataTable,
  ErrorState,
  FilterBar,
  PageHeader,
  PageSkeleton,
  Select,
  StatCard,
  type SortDirection,
} from '@bahrawy/ui';
import { fetchApi } from '../../../lib/api';
import {
  ReopenExamDialog,
  type ReopenExamTarget,
} from '../_components/ReopenExamDialog';
import {
  UnlockExamDialog,
  type UnlockExamTarget,
} from '../_components/UnlockExamDialog';

type Course = { id: string; titleAr: string };
type Grade = { id: string; nameAr: string };
type StatusOption = { status: string; label: string };

type ViolationRow = {
  caseType: 'SUSPENDED' | 'FAILED';
  reason: string;
  sessionId: string | null;
  accountId: string;
  assessmentId: string;
  status: 'LOCKED' | 'ACTIVE' | 'EXPIRED' | 'SUBMITTED' | null;
  student: { id: string; name: string; code: number } | null;
  grade: { id: string; nameAr: string } | null;
  course: { id: string; titleAr: string };
  lesson: { id: string; titleAr: string } | null;
  exam: { id: string; titleAr: string };
  score: number | null;
  passingScore: number | null;
  attemptsCount: number;
  openCount: number;
  lastAttemptAt: string | null;
  startedAt: string | null;
  expiresAt: string | null;
  lastActivityAt: string | null;
  endedAt: string | null;
  lockedAt: string | null;
  lockReason: string | null;
  violationCount: number;
  reopenedAt: string | null;
  reopenedBy: string | null;
  attemptCount: number;
};

type ViolationsResponse = {
  data: {
    items: ViolationRow[];
    meta: { page: number; pageSize: number; total: number; pageCount: number };
    caseTypes: { caseType: string; label: string }[];
    statuses: StatusOption[];
    courses: Course[];
    exams: { id: string; titleAr: string }[];
    grades: Grade[];
  };
};

type SessionEvent = {
  id: string;
  eventType: string;
  timestamp: string;
  actor: string | null;
  metadata: Record<string, unknown> | null;
};

const STATUS_LABELS: Record<string, string> = {
  LOCKED: 'موقوف',
  ACTIVE: 'نشط',
  EXPIRED: 'منتهي الوقت',
  SUBMITTED: 'تم التسليم',
};

const SORT_LABELS: Record<string, string> = {
  lastAttemptAt: 'آخر محاولة',
  score: 'الدرجة',
  attemptsCount: 'عدد المحاولات',
  openCount: 'عدد الفتحات',
};

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ExamViolationsPage() {
  const [items, setItems] = useState<ViolationRow[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [exams, setExams] = useState<{ id: string; titleAr: string }[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [search, setSearch] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [assessmentId, setAssessmentId] = useState('');
  const [caseType, setCaseType] = useState('');
  const [sortBy, setSortBy] = useState('lastAttemptAt');
  const [direction, setDirection] = useState<SortDirection>('desc');
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [suspendedTotal, setSuspendedTotal] = useState(0);
  const [failedTotal, setFailedTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingReopen, setPendingReopen] = useState<ReopenExamTarget | null>(
    null,
  );
  const [pendingUnlock, setPendingUnlock] = useState<UnlockExamTarget | null>(
    null,
  );
  const [actioning, setActioning] = useState(false);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [eventsSessionId, setEventsSessionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams();
      query.set('page', String(page));
      query.set('pageSize', '25');
      if (search.trim()) query.set('search', search.trim());
      if (gradeId) query.set('gradeId', gradeId);
      if (courseId) query.set('courseId', courseId);
      if (assessmentId) query.set('assessmentId', assessmentId);
      if (caseType) query.set('caseType', caseType);
      query.set('sortBy', sortBy);
      query.set('direction', direction);
      const response = await fetchApi<ViolationsResponse>(
        `/admin/v1/exam-violations?${query}`,
      );
      const data = response.data;
      setItems(data.items);
      setPageCount(data.meta.pageCount);
      setTotal(data.meta.total);
      setCourses(data.courses);
      setExams(data.exams);
      setGrades(data.grades);
      setSuspendedTotal(
        data.items.filter((item) => item.caseType === 'SUSPENDED').length,
      );
      setFailedTotal(
        data.items.filter((item) => item.caseType === 'FAILED').length,
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'تعذر تحميل الموقوفين في الامتحانات',
      );
    } finally {
      setLoading(false);
    }
  }, [assessmentId, caseType, courseId, direction, gradeId, page, search, sortBy]);

  useEffect(() => {
    setPage(1);
  }, [assessmentId, caseType, courseId, direction, gradeId, search, sortBy]);

  useEffect(() => {
    const timeout = setTimeout(() => void load(), 250);
    return () => clearTimeout(timeout);
  }, [load]);

  const loadEvents = useCallback(async (sessionId: string) => {
    try {
      const response = await fetchApi<{ data: SessionEvent[] }>(
        `/admin/v1/exam-violations/${sessionId}/events`,
      );
      setEvents(response.data);
      setEventsSessionId(sessionId);
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : 'تعذر تحميل سجل المخالفات',
      );
    }
  }, []);

  const closeEvents = useCallback(() => {
    setEvents([]);
    setEventsSessionId(null);
  }, []);

  const confirmReopen = useCallback(async () => {
    if (!pendingReopen || actioning) return;
    setActioning(true);
    setActionError('');
    try {
      await fetchApi<{ data: ViolationRow }>(
        `/admin/v1/exam-violations/${pendingReopen.sessionId}/reopen`,
        { method: 'POST' },
      );
      toast.success('تم إعادة فتح الاختبار للطالب');
      setPendingReopen(null);
      void load();
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : 'تعذر إعادة فتح الامتحان',
      );
    } finally {
      setActioning(false);
    }
  }, [actioning, load, pendingReopen]);

  const confirmUnlock = useCallback(async () => {
    if (!pendingUnlock || actioning) return;
    setActioning(true);
    setActionError('');
    try {
      await fetchApi<{ data: { unlocked: boolean } }>(
        `/admin/v1/exam-violations/assessments/${pendingUnlock.assessmentId}/students/${pendingUnlock.accountId}/unlock`,
        { method: 'POST' },
      );
      toast.success('تم فتح الامتحان للطالب');
      setPendingUnlock(null);
      void load();
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : 'تعذر فتح الامتحان للطالب',
      );
    } finally {
      setActioning(false);
    }
  }, [actioning, load, pendingUnlock]);

  const cancelAction = useCallback(() => {
    if (actioning) return;
    setPendingReopen(null);
    setPendingUnlock(null);
  }, [actioning]);

  const onSortChange = useCallback(
    (columnId: string, nextDirection: SortDirection) => {
      if (sortBy === columnId) {
        setDirection(nextDirection);
      } else {
        setSortBy(columnId);
        setDirection(nextDirection);
      }
    },
    [sortBy],
  );

  if (loading && !items.length && !error) return <PageSkeleton cards={4} />;
  if (error && !items.length) {
    return (
      <ErrorState
        title="تعذر تحميل الموقوفين"
        description={error}
        onRetry={load}
      />
    );
  }

  const filtered = Boolean(
    search.trim() || gradeId || courseId || assessmentId || caseType,
  );

  return (
    <div className="space-y-5" dir="rtl">
      <PageHeader
        eyebrow="مراقبة الامتحانات"
        title="الطلاب الموقوفون في الامتحانات"
        description="إشراف موحد على الطلاب الموقوفين بسبب المخالفات والطلاب الراسبين في اختبارات نهاية الدرس، مع إعادة فتح الجلسات أو منح محاولة جديدة بعد انتهاء سبب الإيقاف."
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="موقوفون"
          value={suspendedTotal}
          hint="جلسة موقوفة في هذه الصفحة"
          icon={<LockKeyhole className="size-6" />}
          tone="coral"
        />
        <StatCard
          label="راسبون"
          value={failedTotal}
          hint="فشل في اختبار نهاية الدرس"
          icon={<ShieldAlert className="size-6" />}
          tone="violet"
        />
        <StatCard
          label="الإجمالي"
          value={total}
          hint="حالة مفتوحة حالياً"
          icon={<History className="size-6" />}
          tone="blue"
        />
      </section>

      <FilterBar
        value={search}
        onSearch={setSearch}
        searchPlaceholder="ابحث باسم الطالب أو كود الطالب"
        filters={
          <>
            <Select
              aria-label="تصفية بالحالة"
              value={caseType}
              onChange={(event) => setCaseType(event.target.value)}
            >
              <option value="">الكل (موقوف + راسب)</option>
              <option value="SUSPENDED">موقوفون</option>
              <option value="FAILED">راسبون</option>
            </Select>
            <Select
              aria-label="تصفية بالمرحلة الدراسية"
              value={gradeId}
              onChange={(event) => setGradeId(event.target.value)}
            >
              <option value="">كل المراحل</option>
              {grades.map((grade) => (
                <option key={grade.id} value={grade.id}>
                  {grade.nameAr}
                </option>
              ))}
            </Select>
            <Select
              aria-label="تصفية بالكورس"
              value={courseId}
              onChange={(event) => setCourseId(event.target.value)}
            >
              <option value="">كل الكورسات</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.titleAr}
                </option>
              ))}
            </Select>
            <Select
              aria-label="تصفية بالامتحان"
              value={assessmentId}
              onChange={(event) => setAssessmentId(event.target.value)}
            >
              <option value="">كل الامتحانات</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.titleAr}
                </option>
              ))}
            </Select>
            <Select
              aria-label="الترتيب حسب"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
            >
              {Object.entries(SORT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  ترتيب: {label}
                </option>
              ))}
            </Select>
          </>
        }
      />
      {actionError && (
        <p
          role="alert"
          className="rounded-xl border border-danger/20 bg-danger/10 p-3 text-sm font-bold text-danger"
        >
          {actionError}
        </p>
      )}

      {eventsSessionId && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-bold text-lg">سجل الجلسة</h2>
            <Button variant="ghost" size="sm" onClick={closeEvents}>
              إغلاق
            </Button>
          </div>
          <ol className="space-y-2">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex items-start gap-3 rounded-xl bg-surface-2 px-4 py-3 text-sm"
              >
                <Badge tone="violet">{event.eventType}</Badge>
                <span className="flex-1 text-ink-2">
                  {event.eventType}
                  {event.actor ? ` — بواسطة: ${event.actor}` : ''}
                </span>
                <time className="text-xs tabular-nums text-ink-3" dir="ltr">
                  {formatDateTime(event.timestamp)}
                </time>
              </li>
            ))}
          </ol>
        </section>
      )}

      <DataTable
        loading={loading}
        emptyMessage={
          filtered
            ? 'لا توجد حالات مطابقة للبحث'
            : 'لا توجد حالات موقوفة أو راسبة مسجلة'
        }
        data={items}
        keyExtractor={(row) =>
          `${row.caseType}-${row.accountId}-${row.assessmentId}`
        }
        sort={{ columnId: sortBy, direction }}
        onSortChange={onSortChange}
        page={page}
        pageCount={pageCount}
        onPageChange={setPage}
        columns={[
          {
            id: 'caseType',
            header: 'النوع',
            align: 'center',
            cell: (row: ViolationRow) => (
              <Badge tone={row.caseType === 'FAILED' ? 'violet' : 'danger'}>
                {row.caseType === 'FAILED' ? 'راسب' : 'موقوف'}
              </Badge>
            ),
          },
          {
            id: 'student',
            header: 'اسم الطالب',
            cell: (row: ViolationRow) => (
              <div className="min-w-40">
                <strong>{row.student?.name ?? '—'}</strong>
                {row.grade?.nameAr && (
                  <p className="text-xs text-ink-3">{row.grade.nameAr}</p>
                )}
              </div>
            ),
          },
          {
            id: 'code',
            header: 'كود الطالب',
            cell: (row: ViolationRow) => (
              <span className="font-mono text-xs tabular-nums" dir="ltr">
                {row.student ? `#${row.student.code}` : '—'}
              </span>
            ),
          },
          {
            id: 'exam',
            header: 'الامتحان',
            cell: (row: ViolationRow) => (
              <div className="min-w-44">
                <span className="font-medium">{row.exam.titleAr}</span>
                {row.course?.titleAr && (
                  <p className="text-xs text-ink-3">{row.course.titleAr}</p>
                )}
                {row.lesson?.titleAr && (
                  <p className="text-xs text-ink-3">
                    الدرس: {row.lesson.titleAr}
                  </p>
                )}
              </div>
            ),
          },
          {
            id: 'score',
            header: 'الدرجة / النجاح',
            align: 'center',
            sortable: true,
            cell: (row: ViolationRow) =>
              row.score === null ? (
                <span className="text-xs text-ink-3">—</span>
              ) : (
                <span
                  className={`font-bold tabular-nums ${
                    row.passingScore !== null && row.score < row.passingScore
                      ? 'text-danger'
                      : ''
                  }`}
                >
                  {row.score}
                  {row.passingScore !== null ? ` / ${row.passingScore}` : ''}
                </span>
              ),
          },
          {
            id: 'attemptsCount',
            header: 'المحاولات',
            align: 'center',
            sortable: true,
            cell: (row: ViolationRow) => (
              <span className="font-bold tabular-nums">
                {row.attemptsCount}
              </span>
            ),
          },
          {
            id: 'openCount',
            header: 'عدد الفتحات',
            align: 'center',
            sortable: true,
            cell: (row: ViolationRow) => (
              <span className="font-semibold tabular-nums">{row.openCount}</span>
            ),
          },
          {
            id: 'reason',
            header: 'السبب',
            cell: (row: ViolationRow) => (
              <span className="min-w-56 text-xs text-ink-2">
                {row.reason ?? '—'}
              </span>
            ),
          },
          {
            id: 'status',
            header: 'حالة الامتحان',
            align: 'center',
            cell: (row: ViolationRow) =>
              row.status ? (
                <Badge
                  tone={
                    row.status === 'LOCKED' ||
                    row.status === 'EXPIRED'
                      ? 'danger'
                      : 'neutral'
                  }
                  className="justify-center"
                >
                  {STATUS_LABELS[row.status] ?? row.status}
                </Badge>
              ) : (
                <span className="text-xs text-ink-3">—</span>
              ),
          },
          {
            id: 'lastAttemptAt',
            header: 'آخر محاولة',
            sortable: true,
            cell: (row: ViolationRow) => (
              <span className="whitespace-nowrap text-xs text-ink-2" dir="ltr">
                {row.lastAttemptAt ? formatDateTime(row.lastAttemptAt) : '—'}
              </span>
            ),
          },
        ]}
        rowActions={(row: ViolationRow) => {
          const reopenStatus =
            row.caseType === 'SUSPENDED' &&
            (row.status === 'LOCKED' || row.status === 'EXPIRED')
              ? row.status
              : null;
          return (
            <>
              {reopenStatus && row.sessionId ? (
                <Button
                  key="reopen"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setPendingReopen({
                      sessionId: row.sessionId!,
                      status: reopenStatus,
                      studentName: row.student?.name ?? '—',
                      studentCode: row.student?.code ?? null,
                      examTitle: row.exam.titleAr,
                    })
                  }
                >
                  <RotateCcw className="size-4" />
                  إعادة فتح الاختبار
                </Button>
              ) : row.caseType === 'FAILED' ? (
                <Button
                  key="unlock"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setPendingUnlock({
                      accountId: row.accountId,
                      assessmentId: row.assessmentId,
                      studentName: row.student?.name ?? '—',
                      studentCode: row.student?.code ?? null,
                      examTitle: row.exam.titleAr,
                    })
                  }
                >
                  <UnlockKeyhole className="size-4" />
                  فتح الامتحان للطالب
                </Button>
              ) : (
                <Button key="active" size="sm" variant="ghost" disabled>
                  <LockKeyhole className="size-4" />
                  فعال
                </Button>
              )}
              {row.sessionId ? (
                <Button
                  key="events-trigger"
                  size="sm"
                  variant="ghost"
                  onClick={() => void loadEvents(row.sessionId!)}
                >
                  <History className="size-4" />
                  السجل
                </Button>
              ) : null}
            </>
          );
        }}
        actionsLabel="إجراءات"
      />
      <p className="text-xs text-ink-3">
        إجمالي الحالات: {total.toLocaleString('ar-EG')} · الصفحة {page} من{' '}
        {pageCount}
      </p>
      <ReopenExamDialog
        open={pendingReopen !== null}
        target={pendingReopen}
        saving={actioning}
        onClose={cancelAction}
        onConfirm={confirmReopen}
      />
      <UnlockExamDialog
        open={pendingUnlock !== null}
        target={pendingUnlock}
        saving={actioning}
        onClose={cancelAction}
        onConfirm={confirmUnlock}
      />
    </div>
  );
}