'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Ban,
  CheckCircle2,
  Download,
  KeyRound,
  PackagePlus,
  Printer,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import {
  Badge,
  Button,
  DataTable,
  Drawer,
  ErrorState,
  FilterBar,
  Input,
  PageHeader,
  PageSkeleton,
  Select,
  StatCard,
} from '@bahrawy/ui';
import { fetchApi } from '../../../lib/api';

type Course = {
  id: string;
  titleAr: string;
  titleEn?: string | null;
};
type Grade = { id: string; nameAr: string; nameEn?: string | null };
type Batch = {
  id: string;
  quantity: number;
  usedCount: number;
  maxUses: number;
  expiresAt: string | null;
  createdAt: string;
  course: { id: string; titleAr: string } | null;
  grade: { id: string; nameAr: string } | null;
};
type CodeRow = {
  id: string;
  code: string;
  status: string;
  courseId: string;
  gradeId: string | null;
  batchId: string;
  maxUses: number;
  useCount: number;
  expiresAt: string | null;
  activatedAt: string | null;
  createdAt: string;
  student: { id: string; displayName: string; accountId: string } | null;
  course?: { id: string; titleAr: string } | null;
  grade?: { id: string; nameAr: string } | null;
};

type CodesResponse = {
  data: {
    items: CodeRow[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
};
type BatchesResponse = {
  data: {
    items: Batch[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
};
type ExportResponse = {
  data: {
    batchId: string;
    course: { titleAr: string } | null;
    grade: { nameAr: string } | null;
    createdAt: string;
    codes: { id: string; code: string; status: string; accountId: string | null }[];
  };
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'نشط',
  DISABLED: 'معطل',
  USED: 'مستخدم',
  EXPIRED: 'منتهي',
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

const BATCH_VIEW = 'batches';

export default function OfflineCodesPage() {
  const [items, setItems] = useState<CodeRow[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [view, setView] = useState<'codes' | 'batches'>('codes');
  const [search, setSearch] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [status, setStatus] = useState('');
  const [used, setUsed] = useState('');
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actioning, setActioning] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [exportData, setExportData] = useState<ExportResponse['data'] | null>(null);
  const [exporting, setExporting] = useState(false);

  const [genOpen, setGenOpen] = useState(false);
  const [genForm, setGenForm] = useState({
    quantity: '10',
    courseId: '',
    gradeId: '',
    expiresAt: '',
    maxUses: '1',
  });
  const [generated, setGenerated] = useState<{ codes: { id: string; code: string }[] } | null>(null);
  const [genSaving, setGenSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (view === 'codes') {
        const query = new URLSearchParams();
        query.set('page', String(page));
        query.set('pageSize', '25');
        if (search.trim()) query.set('search', search.trim());
        if (gradeId) query.set('gradeId', gradeId);
        if (courseId) query.set('courseId', courseId);
        if (status) query.set('status', status);
        if (used) query.set('used', used);
        const [codeResponse, courseResponse, academicResponse] = await Promise.all([
          fetchApi<CodesResponse>(`/admin/v1/offline-codes?${query}`),
          fetchApi(`/admin/v1/courses?pageSize=100`),
          fetchApi('/admin/v1/academic'),
        ]);
        setItems(codeResponse.data.items);
        setPageCount(Number(codeResponse.data.totalPages) || 1);
        setTotal(codeResponse.data.total);
        setCourses(courseResponse.data.items as Course[]);
        setGrades(academicResponse.data.grades as Grade[]);
      } else {
        const query = new URLSearchParams();
        query.set('page', String(page));
        query.set('pageSize', '25');
        if (courseId) query.set('courseId', courseId);
        if (gradeId) query.set('gradeId', gradeId);
        const [batchResponse, courseResponse, academicResponse] = await Promise.all([
          fetchApi<BatchesResponse>(`/admin/v1/offline-codes/batches/list?${query}`),
          fetchApi(`/admin/v1/courses?pageSize=100`),
          fetchApi('/admin/v1/academic'),
        ]);
        setBatches(batchResponse.data.items);
        setPageCount(Number(batchResponse.data.totalPages) || 1);
        setTotal(batchResponse.data.total);
        setCourses(courseResponse.data.items as Course[]);
        setGrades(academicResponse.data.grades as Grade[]);
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'تعذر تحميل أكواد الأوفلاين',
      );
    } finally {
      setLoading(false);
    }
  }, [courseId, gradeId, page, search, status, used, view]);

  useEffect(() => {
    setPage(1);
  }, [courseId, gradeId, search, status, used, view]);

  useEffect(() => {
    const timeout = setTimeout(() => void load(), 250);
    return () => clearTimeout(timeout);
  }, [load]);

  const switchView = (next: 'codes' | 'batches') => {
    setView(next);
    setPage(1);
    setSelectedIds([]);
  };

  const refresh = () => void load();

  const toggleSelect = (id: string) =>
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );

  const runBulkStatus = async (nextStatus: 'ACTIVE' | 'DISABLED') => {
    if (!selectedIds.length || actioning) return;
    setActioning(true);
    try {
      await fetchApi('/admin/v1/offline-codes/bulk/status', {
        method: 'POST',
        body: JSON.stringify({ ids: selectedIds, status: nextStatus }),
      });
      toast.success(
        nextStatus === 'ACTIVE' ? 'تم تفعيل الأكواد المحددة' : 'تم تعطيل الأكواد المحددة',
      );
      setSelectedIds([]);
      void load();
    } catch (requestError) {
      toast.error(
        requestError instanceof Error ? requestError.message : 'تعذر تحديث الأكواد',
      );
    } finally {
      setActioning(false);
    }
  };

  const runBulkDelete = async () => {
    if (!selectedIds.length || actioning) return;
    setActioning(true);
    try {
      await fetchApi('/admin/v1/offline-codes/bulk/delete', {
        method: 'POST',
        body: JSON.stringify({ ids: selectedIds }),
      });
      toast.success('تم حذف الأكواد غير المستخدمة المحددة');
      setSelectedIds([]);
      void load();
    } catch (requestError) {
      toast.error(
        requestError instanceof Error ? requestError.message : 'تعذر حذف الأكواد',
      );
    } finally {
      setActioning(false);
    }
  };

  const openGenerate = () => {
    setGenForm({ quantity: '10', courseId: '', gradeId: '', expiresAt: '', maxUses: '1' });
    setGenerated(null);
    setGenOpen(true);
  };

  const runGenerate = async () => {
    if (genSaving) return;
    setGenSaving(true);
    try {
      const body: Record<string, string | number> = {
        quantity: Number(genForm.quantity),
        courseId: genForm.courseId,
        maxUses: Number(genForm.maxUses || 1),
      };
      if (genForm.gradeId) body.gradeId = genForm.gradeId;
      if (genForm.expiresAt) body.expiresAt = new Date(genForm.expiresAt).toISOString();
      const response = await fetchApi<{ data: { codes: { id: string; code: string }[] } }>(
        '/admin/v1/offline-codes/generate',
        { method: 'POST', body: JSON.stringify(body) },
      );
      setGenerated(response.data);
      toast.success(`تم إنشاء ${response.data.codes.length} كود بنجاح`);
      void load();
    } catch (requestError) {
      toast.error(
        requestError instanceof Error ? requestError.message : 'تعذر إنشاء الأكواد',
      );
    } finally {
      setGenSaving(false);
    }
  };

  const exportBatch = async (batchId: string) => {
    setExporting(true);
    try {
      const response = await fetchApi<ExportResponse>(
        `/admin/v1/offline-codes/batches/${batchId}/export`,
      );
      setExportData(response.data);
    } catch (requestError) {
      toast.error(
        requestError instanceof Error ? requestError.message : 'تعذر تصدير الأكواد',
      );
    } finally {
      setExporting(false);
    }
  };

  const printExport = () => {
    if (!exportData) return;
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;
    const rows = exportData.codes
      .map(
        (code) =>
          `<tr><td dir="ltr" style="font-family:monospace">${code.code}</td><td>${STATUS_LABELS[code.status] ?? code.status}</td></tr>`,
      )
      .join('');
    printWindow.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>أكواد الأوفلاين</title></head><body style="font-family:Arial,sans-serif;padding:24px"><h2>أكواد الأوفلاين — ${exportData.course?.titleAr ?? ''}</h2><table border="1" cellpadding="8" cellspacing="0" style="width:100%;border-collapse:collapse">${rows}</table></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const filtered = Boolean(
    search.trim() || gradeId || courseId || status || used,
  );
  const activeCount = items.filter((item) => item.status === 'ACTIVE').length;
  const usedCount = items.filter((item) => item.status === 'USED').length;
  const generatedCodes = generated?.codes ?? [];

  const copyAll = () => {
    if (!generatedCodes.length) return;
    void navigator.clipboard.writeText(generatedCodes.map((item) => item.code).join('\n'));
    toast.success('تم نسخ جميع الأكواد');
  };

  if (loading && !items.length && !batches.length && !error) {
    return <PageSkeleton cards={4} />;
  }
  if (error && !items.length && !batches.length) {
    return (
      <ErrorState
        title="تعذر تحميل أكواد الأوفلاين"
        description={error}
        onRetry={load}
      />
    );
  }

  const codesTab = (
    <>
      <FilterBar
        value={search}
        onSearch={setSearch}
        searchPlaceholder="ابحث برمز الكود أو اسم الطالب أو رقم الهاتف"
        filters={
          <>
            <Select
              aria-label="تصفية بالحالة"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">كل الحالات</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select
              aria-label="تصفية بالاستخدام"
              value={used}
              onChange={(event) => setUsed(event.target.value)}
            >
              <option value="">الكل</option>
              <option value="true">مستخدم</option>
              <option value="false">غير مستخدم</option>
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
          </>
        }
      />
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-[var(--color-primary-bg)] p-3">
          <span className="text-sm font-bold text-ink">
            تم تحديد {selectedIds.length.toLocaleString('ar-EG')} كود
          </span>
          <Button size="sm" variant="outline" onClick={() => runBulkStatus('ACTIVE')} disabled={actioning}>
            <CheckCircle2 className="size-4" />
            تفعيل
          </Button>
          <Button size="sm" variant="outline" onClick={() => runBulkStatus('DISABLED')} disabled={actioning}>
            <Ban className="size-4" />
            تعطيل
          </Button>
          <Button size="sm" variant="outline" onClick={runBulkDelete} disabled={actioning}>
            <Trash2 className="size-4" />
            حذف غير المستخدم
          </Button>
        </div>
      )}
      <DataTable
        loading={loading}
        emptyMessage={
          filtered ? 'لا توجد أكواد مطابقة للبحث' : 'لا توجد أكواد أوفلاين بعد'
        }
        data={items}
        keyExtractor={(row) => row.id}
        page={page}
        pageCount={pageCount}
        onPageChange={setPage}
        columns={[
          {
            id: 'select',
            header: (
              <input
                type="checkbox"
                aria-label="تحديد الكل"
                checked={items.length > 0 && selectedIds.length === items.length}
                onChange={(event) =>
                  setSelectedIds(event.target.checked ? items.map((item) => item.id) : [])
                }
              />
            ),
            align: 'center',
            cell: (row: CodeRow) => (
              <input
                type="checkbox"
                aria-label={`تحديد كود ${row.code}`}
                checked={selectedIds.includes(row.id)}
                onChange={() => toggleSelect(row.id)}
              />
            ),
          },
          {
            id: 'code',
            header: 'الكود',
            cell: (row: CodeRow) => (
              <span className="font-mono text-sm font-bold tabular-nums" dir="ltr">
                {row.code}
              </span>
            ),
          },
          {
            id: 'status',
            header: 'الحالة',
            align: 'center',
            cell: (row: CodeRow) => (
              <Badge tone={row.status === 'ACTIVE' ? 'success' : row.status === 'USED' ? 'blue' : row.status === 'EXPIRED' ? 'neutral' : 'danger'}>
                {STATUS_LABELS[row.status] ?? row.status}
              </Badge>
            ),
          },
          {
            id: 'course',
            header: 'الكورس',
            cell: (row: CodeRow) => (
              <span className="whitespace-nowrap text-xs text-ink-2">
                {row.course?.titleAr ?? '—'}
              </span>
            ),
          },
          {
            id: 'grade',
            header: 'الصف',
            cell: (row: CodeRow) => (
              <span className="whitespace-nowrap text-xs text-ink-2">
                {row.grade?.nameAr ?? '—'}
              </span>
            ),
          },
          {
            id: 'student',
            header: 'الطالب',
            cell: (row: CodeRow) => (
              <span className="whitespace-nowrap text-xs text-ink-2">
                {row.student?.displayName ?? '—'}
              </span>
            ),
          },
          {
            id: 'uses',
            header: 'الاستخدام',
            align: 'center',
            cell: (row: CodeRow) => (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink-2">
                {row.useCount.toLocaleString('ar-EG')} / {row.maxUses.toLocaleString('ar-EG')}
              </span>
            ),
          },
          {
            id: 'expires',
            header: 'الانتهاء',
            cell: (row: CodeRow) => (
              <span className="whitespace-nowrap text-xs text-ink-2">
                {formatDateTime(row.expiresAt)}
              </span>
            ),
          },
          {
            id: 'activatedAt',
            header: 'وقت التفعيل',
            cell: (row: CodeRow) => (
              <span className="whitespace-nowrap text-xs text-ink-2">
                {formatDateTime(row.activatedAt)}
              </span>
            ),
          },
        ]}
      />
      <p className="text-xs text-ink-3">
        إجمالي الأكواد: {total.toLocaleString('ar-EG')} · الصفحة {page} من{' '}
        {pageCount}
      </p>
    </>
  );

  const batchesTab = (
    <>
      <FilterBar
        value=""
        onSearch={() => undefined}
        searchPlaceholder=""
        filters={
          <>
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
          </>
        }
      />
      <DataTable
        loading={loading}
        emptyMessage="لا توجد دفعات بعد"
        data={batches}
        keyExtractor={(row) => row.id}
        page={page}
        pageCount={pageCount}
        onPageChange={setPage}
        columns={[
          {
            id: 'course',
            header: 'الكورس',
            cell: (row: Batch) => (
              <span className="whitespace-nowrap text-sm font-medium text-ink">
                {row.course?.titleAr ?? '—'}
              </span>
            ),
          },
          {
            id: 'grade',
            header: 'الصف',
            cell: (row: Batch) => (
              <span className="whitespace-nowrap text-xs text-ink-2">
                {row.grade?.nameAr ?? '—'}
              </span>
            ),
          },
          {
            id: 'quantity',
            header: 'العدد',
            align: 'center',
            cell: (row: Batch) => (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink-2">
                {row.quantity.toLocaleString('ar-EG')}
              </span>
            ),
          },
          {
            id: 'used',
            header: 'المستخدم',
            align: 'center',
            cell: (row: Batch) => (
              <Badge tone={row.usedCount === row.quantity ? 'blue' : 'success'}>
                {row.usedCount.toLocaleString('ar-EG')} / {row.quantity.toLocaleString('ar-EG')}
              </Badge>
            ),
          },
          {
            id: 'expires',
            header: 'الانتهاء',
            cell: (row: Batch) => (
              <span className="whitespace-nowrap text-xs text-ink-2">
                {formatDateTime(row.expiresAt)}
              </span>
            ),
          },
          {
            id: 'createdAt',
            header: 'تاريخ الإنشاء',
            cell: (row: Batch) => (
              <span className="whitespace-nowrap text-xs text-ink-2">
                {formatDateTime(row.createdAt)}
              </span>
            ),
          },
        ]}
        rowActions={(row: Batch) => (
          <Button key="export" size="sm" variant="outline" onClick={() => exportBatch(row.id)} disabled={exporting}>
            <Download className="size-4" />
            تصدير الأكواد
          </Button>
        )}
        actionsLabel="إجراءات"
      />
      <p className="text-xs text-ink-3">
        إجمالي الدفعات: {total.toLocaleString('ar-EG')} · الصفحة {page} من{' '}
        {pageCount}
      </p>
    </>
  );

  return (
    <div className="space-y-5" dir="rtl">
      <PageHeader
        eyebrow="إدارة الوصول بدون إنترنت"
        title="أكواد الأوفلاين"
        description="أنشئ أكواد وصول للكورسات لتسليمها للطلاب بشكل يدوي أو خارجي، وتابع حالة كل كود ودفعة الإنشاء الخاصة به."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={view === 'codes' ? 'primary' : 'outline'}
              onClick={() => switchView('codes')}
            >
              <KeyRound className="size-4" />
              الأكواد
            </Button>
            <Button
              variant={view === 'batches' ? 'primary' : 'outline'}
              onClick={() => switchView(BATCH_VIEW as 'codes')}
            >
              <PackagePlus className="size-4" />
              الدفعات
            </Button>
            <Button onClick={openGenerate}>
              <PackagePlus className="size-4" />
              إنشاء أكواد
            </Button>
            <Button variant="outline" onClick={refresh}>
              <RefreshCw className="size-4" />
              تحديث
            </Button>
          </div>
        }
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label={view === 'codes' ? 'إجمالي الأكواد' : 'إجمالي الدفعات'}
          value={total}
          hint="في النتائج الحالية"
          icon={<KeyRound className="size-6" />}
          tone="cyan"
        />
        <StatCard
          label="نشطة"
          value={view === 'codes' ? activeCount : batches.filter((batch) => batch.usedCount < batch.quantity).length}
          hint="لم تُستهلك بعد"
          icon={<CheckCircle2 className="size-6" />}
          tone="blue"
        />
        <StatCard
          label="مستهلكة"
          value={view === 'codes' ? usedCount : batches.filter((batch) => batch.usedCount === batch.quantity).length}
          hint="تم استخدامها بالكامل"
          icon={<Ban className="size-6" />}
          tone="amber"
        />
      </section>

      {view === 'codes' ? codesTab : batchesTab}

      <Drawer isOpen={genOpen} onClose={() => setGenOpen(false)} title="إنشاء أكواد أوفلاين">
        <div className="space-y-4">
          {!generated ? (
            <>
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-ink">الكورس</span>
                <Select
                  value={genForm.courseId}
                  onChange={(event) => setGenForm((form) => ({ ...form, courseId: event.target.value }))}
                >
                  <option value="">اختر الكورس</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.titleAr}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-ink">الصف (اختياري)</span>
                <Select
                  value={genForm.gradeId}
                  onChange={(event) => setGenForm((form) => ({ ...form, gradeId: event.target.value }))}
                >
                  <option value="">بدون تحديد</option>
                  {grades.map((grade) => (
                    <option key={grade.id} value={grade.id}>
                      {grade.nameAr}
                    </option>
                  ))}
                </Select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold text-ink">العدد</span>
                  <Input
                    type="number"
                    min={1}
                    max={500}
                    value={genForm.quantity}
                    onChange={(event) => setGenForm((form) => ({ ...form, quantity: event.target.value }))}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold text-ink">أقصى استخدام</span>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={genForm.maxUses}
                    onChange={(event) => setGenForm((form) => ({ ...form, maxUses: event.target.value }))}
                  />
                </label>
              </div>
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-ink">تاريخ الانتهاء (اختياري)</span>
                <Input
                  type="date"
                  value={genForm.expiresAt}
                  onChange={(event) => setGenForm((form) => ({ ...form, expiresAt: event.target.value }))}
                />
              </label>
              <Button className="w-full" onClick={runGenerate} disabled={genSaving || !genForm.courseId || !Number(genForm.quantity)}>
                {genSaving ? 'جارٍ الإنشاء...' : 'إنشاء الأكواد'}
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-success/20 bg-success/10 p-4 text-sm font-semibold text-success">
                تم إنشاء {generatedCodes.length.toLocaleString('ar-EG')} كود بنجاح. احفظها الآن؛ لن تُعرض بالكامل مرة أخرى.
              </div>
              <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-xl border border-border bg-surface-1 p-3">
                {generatedCodes.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2">
                    <span className="font-mono text-sm font-bold tabular-nums" dir="ltr">
                      {item.code}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={copyAll}>
                  نسخ الكل
                </Button>
                <Button onClick={() => setGenOpen(false)}>إغلاق</Button>
              </div>
            </div>
          )}
        </div>
      </Drawer>

      <Drawer
        isOpen={Boolean(exportData)}
        onClose={() => setExportData(null)}
        title="تصدير أكواد الدفعة"
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-2">
            {exportData?.course?.titleAr ?? ''} — {exportData?.codes.length.toLocaleString('ar-EG')} كود
          </p>
          <div className="max-h-80 space-y-1.5 overflow-y-auto rounded-xl border border-border bg-surface-1 p-3">
            {(exportData?.codes ?? []).map((code) => (
              <div key={code.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2">
                <span className="font-mono text-sm font-bold tabular-nums" dir="ltr">
                  {code.code}
                </span>
                <Badge tone={code.status === 'ACTIVE' ? 'success' : code.status === 'USED' ? 'blue' : 'neutral'}>
                  {STATUS_LABELS[code.status] ?? code.status}
                </Badge>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={printExport}>
              <Printer className="size-4" />
              طباعة
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                exportData &&
                void navigator.clipboard.writeText(
                  exportData.codes.map((code) => code.code).join('\n'),
                )
              }
            >
              نسخ الكل
            </Button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}