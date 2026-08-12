'use client';

import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Medal, School, TrendingUp, Users } from 'lucide-react';
import {
  DataTable,
  ErrorState,
  FilterBar,
  PageHeader,
  PageSkeleton,
  Select,
  StatCard,
} from '@bahrawy/ui';
import { fetchApi } from '../../../lib/api';

type Grade = { id: string; nameAr: string };
type Exam = { id: string; titleAr: string; course: { titleAr: string } | null };
type ResultRow = {
  rank: number;
  attemptId: string;
  student: { id: string; name: string; code: number } | null;
  grade: { id: string; nameAr: string } | null;
  exam: { id: string; titleAr: string; course: { id: string; titleAr: string } | null };
  score: number;
  earnedPoints: number;
  totalPoints: number;
  percentage: number;
  passed: boolean | null;
  submittedAt: string;
  resultsReleased: boolean;
};

type ExamResultsResponse = {
  data: {
    items: ResultRow[];
    meta: { page: number; pageSize: number; total: number; pageCount: number };
    summary: { examined: number; highest: number; average: number; passed: number };
    grades: Grade[];
    exams: Exam[];
  };
};

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex size-7 items-center justify-center rounded-full bg-amber-100 font-bold tabular-nums text-amber-800 ring-1 ring-amber-300">
        {rank}
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex size-7 items-center justify-center rounded-full bg-slate-200 font-bold tabular-nums text-slate-700 ring-1 ring-slate-300">
        {rank}
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex size-7 items-center justify-center rounded-full bg-orange-100 font-bold tabular-nums text-orange-700 ring-1 ring-orange-300">
        {rank}
      </span>
    );
  }
  return <span className="font-medium tabular-nums text-ink-3">{rank}</span>;
}

export default function ExamResultsPage() {
  const [items, setItems] = useState<ResultRow[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [summary, setSummary] = useState({ examined: 0, highest: 0, average: 0, passed: 0 });
  const [search, setSearch] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [assessmentId, setAssessmentId] = useState('');
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams();
      query.set('page', String(page));
      query.set('pageSize', '25');
      if (search.trim()) query.set('search', search.trim());
      if (gradeId) query.set('gradeId', gradeId);
      if (assessmentId) query.set('assessmentId', assessmentId);
      const response = await fetchApi<ExamResultsResponse>(`/admin/v1/exam-results?${query}`);
      const data = response.data;
      setItems(data.items);
      setPageCount(data.meta.pageCount);
      setTotal(data.meta.total);
      setSummary(data.summary);
      setGrades(data.grades);
      setExams(data.exams);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'تعذر تحميل نتائج الامتحانات',
      );
    } finally {
      setLoading(false);
    }
  }, [assessmentId, gradeId, page, search]);

  useEffect(() => {
    setPage(1);
  }, [assessmentId, gradeId, search]);

  useEffect(() => {
    const timeout = setTimeout(() => void load(), 250);
    return () => clearTimeout(timeout);
  }, [load]);

  if (loading && !items.length && !error) return <PageSkeleton cards={4} />;
  if (error && !items.length) {
    return <ErrorState title="تعذر تحميل نتائج الامتحانات" description={error} onRetry={load} />;
  }

  const filtered = Boolean(search.trim() || gradeId || assessmentId);

  return (
    <div className="space-y-5" dir="rtl">
      <PageHeader
        eyebrow="التقارير الأكاديمية"
        title="درجات الطلاب"
        description={`نتائج الطلاب الممتحنين داخل المؤسسة مرتبة حسب الدرجة، مع إمكانية التصفية بالصف الدراسي والامتحان والبحث بالاسم أو الكود.`}
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="عدد الطلاب الممتحنين"
          value={summary.examined}
          hint="طالب ممتحن"
          icon={<Users className="size-6" />}
          tone="blue"
        />
        <StatCard
          label="أعلى درجة"
          value={`${summary.highest}%`}
          hint="أفضل نتيجة"
          icon={<BarChart3 className="size-6" />}
          tone="cyan"
        />
        <StatCard
          label="متوسط الدرجات"
          value={`${summary.average}%`}
          hint="المتوسط العام"
          icon={<TrendingUp className="size-6" />}
          tone="violet"
        />
        <StatCard
          label="عدد الطلاب الناجحين"
          value={summary.passed}
          hint="اجتازوا عتبة النجاح"
          icon={<Medal className="size-6" />}
          tone="amber"
        />
      </section>
      <FilterBar
        value={search}
        onSearch={setSearch}
        searchPlaceholder="ابحث باسم الطالب أو كود الطالب"
        filters={
          <>
            <Select
              aria-label="تصفية بالصف الدراسي"
              value={gradeId}
              onChange={(event) => setGradeId(event.target.value)}
            >
              <option value="">كل الصفوف</option>
              {grades.map((grade) => (
                <option key={grade.id} value={grade.id}>
                  {grade.nameAr}
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
          </>
        }
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <DataTable
        loading={loading}
        emptyMessage={
          filtered
            ? 'لا توجد نتائج مطابقة للبحث'
            : 'لا توجد نتائج امتحانات حتى الآن'
        }
        data={items}
        keyExtractor={(row) => row.attemptId}
        page={page}
        pageCount={pageCount}
        onPageChange={setPage}
        columns={[
          {
            id: 'rank',
            header: 'ترتيب الطالب',
            align: 'center',
            cell: (row: ResultRow) => <RankBadge rank={row.rank} />,
          },
          {
            id: 'student',
            header: 'اسم الطالب',
            cell: (row: ResultRow) => (
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
            cell: (row: ResultRow) => (
              <span className="font-mono text-xs tabular-nums" dir="ltr">
                {row.student ? `#${row.student.code}` : '—'}
              </span>
            ),
          },
          {
            id: 'grade',
            header: 'الصف الدراسي',
            cell: (row: ResultRow) => (
              <div className="flex min-w-32 items-center gap-2 text-ink-2">
                <School className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
                {row.grade?.nameAr ?? 'بدون مرحلة'}
              </div>
            ),
          },
          {
            id: 'exam',
            header: 'اسم الامتحان',
            cell: (row: ResultRow) => (
              <div className="min-w-44">
                <span className="font-medium">{row.exam.titleAr}</span>
                {row.exam.course?.titleAr && (
                  <p className="text-xs text-ink-3">{row.exam.course.titleAr}</p>
                )}
              </div>
            ),
          },
          {
            id: 'score',
            header: 'الدرجة',
            align: 'center',
            cell: (row: ResultRow) => (
              <span className="font-semibold tabular-nums">{row.earnedPoints}</span>
            ),
          },
          {
            id: 'totalPoints',
            header: 'الدرجة الكلية',
            align: 'center',
            cell: (row: ResultRow) => (
              <span className="text-ink-3 tabular-nums">{row.totalPoints}</span>
            ),
          },
          {
            id: 'percentage',
            header: 'النسبة المئوية',
            align: 'center',
            cell: (row: ResultRow) => (
              <span
                className={`font-bold tabular-nums ${
                  row.passed === true
                    ? 'text-success'
                    : row.passed === false
                      ? 'text-danger'
                      : 'text-ink'
                }`}
              >
                {row.percentage}%
              </span>
            ),
          },
          {
            id: 'submittedAt',
            header: 'تاريخ الامتحان',
            cell: (row: ResultRow) =>
              new Date(row.submittedAt).toLocaleDateString('ar-EG', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              }),
          },
        ]}
      />
      <p className="text-xs text-ink-3">
        إجمالي النتائج: {total.toLocaleString('ar-EG')} · الصفحة {page} من {pageCount}
      </p>
    </div>
  );
}