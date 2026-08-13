'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Globe,
  MonitorSmartphone,
  RotateCcw,
  ShieldBan,
  UnlockKeyhole,
} from 'lucide-react';
import {
  Badge,
  Button,
  DataTable,
  ErrorState,
  FilterBar,
  Input,
  PageHeader,
  PageSkeleton,
  Select,
  StatCard,
} from '@bahrawy/ui';
import { fetchApi } from '../../../lib/api';
import {
  AllowDeviceDialog,
  ResetPrimaryDeviceDialog,
  UnlockDeviceDialog,
  type DeviceLockTarget,
} from '../_components/DeviceLockDialogs';

type Grade = { id: string; nameAr: string };

type DeviceLockRow = {
  accountId: string;
  studentNumber: number;
  displayName: string;
  gradeId: string | null;
  gradeName: string | null;
  accountStatus: string;
  version: number;
  createdAt: string;
  primaryDevice: {
    id: string;
    label: string | null;
    fingerprint: string;
    lastUsedAt: string;
  } | null;
  blockedAt: string | null;
  blockReason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  previousStatus: string | null;
  attemptCount: number;
  attemptedDevice: {
    fingerprint: string;
    reason: string;
    blockedAt: string;
  } | null;
};

type DeviceLocksResponse = {
  data: {
    items: DeviceLockRow[];
    meta: { page: number; pageSize: number; total: number; pageCount: number };
    grades: Grade[];
  };
};

const REASON_LABELS: Record<string, string> = {
  UNKNOWN_DEVICE: 'جهاز غير معروف',
  NON_PRIMARY_DEVICE: 'جهاز ثانوي قديم',
  SESSION_DEVICE_MISMATCH: 'تعارض الجهاز مع الجلسة',
};

const STATUS_LABELS: Record<string, string> = {
  DEVICE_BLOCKED: 'موقوف بسبب الجهاز',
  ACTIVE: 'نشط',
  SUSPENDED: 'موقوف',
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

export default function DeviceLocksPage() {
  const [items, setItems] = useState<DeviceLockRow[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [search, setSearch] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState('');
  const [blockedFrom, setBlockedFrom] = useState('');
  const [blockedTo, setBlockedTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actioning, setActioning] = useState(false);
  const [actionError, setActionError] = useState('');
  const [pending, setPending] = useState<null | {
    action: 'unlock' | 'allow-device' | 'reset-primary';
    target: DeviceLockTarget;
  }>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams();
      query.set('page', String(page));
      query.set('pageSize', '25');
      if (search.trim()) query.set('search', search.trim());
      if (gradeId) query.set('gradeId', gradeId);
      if (reason) query.set('reason', reason);
      if (status) query.set('status', status);
      if (blockedFrom) query.set('blockedFrom', blockedFrom);
      if (blockedTo) query.set('blockedTo', blockedTo);
      const response = await fetchApi<DeviceLocksResponse>(
        `/admin/v1/device-locks?${query}`,
      );
      const data = response.data;
      setItems(data.items);
      setPageCount(data.meta.pageCount);
      setTotal(data.meta.total);
      setGrades(data.grades);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'تعذر تحميل قائمة المحظورين',
      );
    } finally {
      setLoading(false);
    }
  }, [blockedFrom, blockedTo, gradeId, page, reason, search, status]);

  useEffect(() => {
    setPage(1);
  }, [blockedFrom, blockedTo, gradeId, reason, search, status]);

  useEffect(() => {
    const timeout = setTimeout(() => void load(), 250);
    return () => clearTimeout(timeout);
  }, [load]);

  const runAction = useCallback(async () => {
    if (!pending || actioning) return;
    setActioning(true);
    setActionError('');
    try {
      await fetchApi<{ data: { status: string } }>(
        `/admin/v1/device-locks/${pending.target.accountId}/${pending.action}`,
        { method: 'POST' },
      );
      toast.success(
        pending.action === 'unlock'
          ? 'تم فتح حساب الطالب'
          : pending.action === 'allow-device'
            ? 'تم السماح بالجهاز الحالي وإعادة تفعيل الحساب'
            : 'تمت إعادة تعيين الجهاز الأساسي وإعادة تفعيل الحساب',
      );
      setPending(null);
      void load();
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : 'تعذر تنفيذ الإجراء على الحساب',
      );
    } finally {
      setActioning(false);
    }
  }, [actioning, load, pending]);

  const cancelAction = useCallback(() => {
    if (actioning) return;
    setPending(null);
  }, [actioning]);

  if (loading && !items.length && !error) return <PageSkeleton cards={4} />;
  if (error && !items.length) {
    return (
      <ErrorState
        title="تعذر تحميل قائمة المحظورين"
        description={error}
        onRetry={load}
      />
    );
  }

  const filtered = Boolean(
    search.trim() || gradeId || reason || status || blockedFrom || blockedTo,
  );
  const withoutPrimary = items.filter((row) => !row.primaryDevice).length;

  const openAction = (
    action: 'unlock' | 'allow-device' | 'reset-primary',
    row: DeviceLockRow,
  ) =>
    setPending({
      action,
      target: {
        accountId: row.accountId,
        studentName: row.displayName,
        studentCode: row.studentNumber,
        primaryDevice: row.primaryDevice
          ? row.primaryDevice.label || row.primaryDevice.fingerprint
          : '—',
        attemptedDevice: row.attemptedDevice?.fingerprint ?? '—',
      },
    });

  const selectedAction = pending?.action ?? null;

  return (
    <div className="space-y-5" dir="rtl">
      <PageHeader
        eyebrow="إدارة الأجهزة"
        title="قائمة المحظورين"
        description="الطلاب الذين تم إيقاف حساباتهم تلقائياً بسبب تسجيل الدخول من جهاز غير معروف. يمكن فتح الحساب، السماح بالجهاز الحالي، أو إعادة تعيين الجهاز الأساسي بعد التحقق من هوية الطالب."
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="محظورون"
          value={total}
          hint="حساب موقوف بسبب الجهاز"
          icon={<ShieldBan className="size-6" />}
          tone="coral"
        />
        <StatCard
          label="بدون جهاز أساسي"
          value={withoutPrimary}
          hint="تحتاج إعادة تعيين أو فتح الحساب"
          icon={<MonitorSmartphone className="size-6" />}
          tone="amber"
        />
        <StatCard
          label="إجمالي الحسابات المفعلة"
          value={items.filter((row) => row.accountStatus === 'ACTIVE').length}
          hint="في هذه الصفحة"
          icon={<UnlockKeyhole className="size-6" />}
          tone="cyan"
        />
      </section>

      <FilterBar
        value={search}
        onSearch={setSearch}
        searchPlaceholder="ابحث باسم الطالب أو كود الطالب"
        filters={
          <>
            <Select
              aria-label="تصفية بالسبب"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            >
              <option value="">كل الأسباب</option>
              {Object.entries(REASON_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
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
            <Input
              type="date"
              aria-label="تاريخ الإيقاف من"
              value={blockedFrom}
              onChange={(event) => setBlockedFrom(event.target.value)}
            />
            <Input
              type="date"
              aria-label="تاريخ الإيقاف إلى"
              value={blockedTo}
              onChange={(event) => setBlockedTo(event.target.value)}
            />
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

      <DataTable
        loading={loading}
        emptyMessage={
          filtered
            ? 'لا توجد حالات مطابقة للبحث'
            : 'لا توجد حسابات موقوفة بسبب الجهاز حالياً'
        }
        data={items}
        keyExtractor={(row) => row.accountId}
        page={page}
        pageCount={pageCount}
        onPageChange={setPage}
        columns={[
          {
            id: 'student',
            header: 'اسم الطالب',
            cell: (row: DeviceLockRow) => (
              <div className="min-w-40">
                <strong>{row.displayName}</strong>
                <p className="font-mono text-xs tabular-nums" dir="ltr">
                  #{row.studentNumber}
                </p>
              </div>
            ),
          },
          {
            id: 'grade',
            header: 'الصف',
            cell: (row: DeviceLockRow) => (
              <span className="whitespace-nowrap text-xs text-ink-2">
                {row.gradeName ?? '—'}
              </span>
            ),
          },
          {
            id: 'status',
            header: 'حالة الحساب',
            align: 'center',
            cell: () => (
              <span className="inline-flex items-center gap-1 rounded-full border border-danger/20 bg-[var(--color-danger-bg)] px-2.5 py-1 text-xs font-medium text-danger dark:bg-danger/10">
                <ShieldBan className="size-3" aria-hidden="true" />
                موقوف
              </span>
            ),
          },
          {
            id: 'primaryDevice',
            header: 'الجهاز الأساسي',
            cell: (row: DeviceLockRow) =>
              row.primaryDevice ? (
                <div className="min-w-40 text-xs">
                  <p className="font-medium text-ink">
                    {row.primaryDevice.label || 'جهاز مسجل'}
                  </p>
                  <p className="font-mono tabular-nums text-ink-3" dir="ltr">
                    {row.primaryDevice.fingerprint}
                  </p>
                  <p className="text-ink-3">
                    آخر استخدام: {formatDateTime(row.primaryDevice.lastUsedAt)}
                  </p>
                </div>
              ) : (
                <span className="text-xs text-ink-3">—</span>
              ),
          },
          {
            id: 'attemptedDevice',
            header: 'الجهاز المرفوض',
            cell: (row: DeviceLockRow) =>
              row.attemptedDevice ? (
                <div className="min-w-40 text-xs">
                  <p className="font-mono tabular-nums text-ink" dir="ltr">
                    {row.attemptedDevice.fingerprint}
                  </p>
                  <p className="text-ink-3">
                    {formatDateTime(row.attemptedDevice.blockedAt)}
                  </p>
                </div>
              ) : (
                <span className="text-xs text-ink-3">—</span>
              ),
          },
          {
            id: 'ip',
            header: 'IP',
            cell: (row: DeviceLockRow) => (
              <span
                className="whitespace-nowrap font-mono text-xs text-ink-2"
                dir="ltr"
              >
                {row.ipAddress ?? '—'}
              </span>
            ),
          },
          {
            id: 'userAgent',
            header: 'المتصفح',
            cell: (row: DeviceLockRow) => (
              <span
                className="block max-w-52 truncate text-xs text-ink-2"
                title={row.userAgent ?? undefined}
              >
                {row.userAgent ?? '—'}
              </span>
            ),
          },
          {
            id: 'attempts',
            header: 'عدد المحاولات',
            align: 'center',
            cell: (row: DeviceLockRow) => (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink-2">
                <Globe className="size-3" aria-hidden="true" />
                {row.attemptCount}
              </span>
            ),
          },
          {
            id: 'reason',
            header: 'السبب',
            cell: (row: DeviceLockRow) => (
              <Badge tone="danger">
                {REASON_LABELS[row.blockReason ?? ''] ?? (row.blockReason ?? '—')}
              </Badge>
            ),
          },
          {
            id: 'blockedAt',
            header: 'وقت الإيقاف',
            cell: (row: DeviceLockRow) => (
              <span className="whitespace-nowrap text-xs text-ink-2" dir="ltr">
                {formatDateTime(row.blockedAt)}
              </span>
            ),
          },
        ]}
        rowActions={(row: DeviceLockRow) => (
          <>
            <Button
              key="unlock"
              size="sm"
              variant="outline"
              onClick={() => openAction('unlock', row)}
            >
              <UnlockKeyhole className="size-4" />
              فتح الحساب
            </Button>
            <Button
              key="allow"
              size="sm"
              variant="outline"
              onClick={() => openAction('allow-device', row)}
            >
              <MonitorSmartphone className="size-4" />
              السماح بالجهاز
            </Button>
            <Button
              key="reset"
              size="sm"
              variant="outline"
              onClick={() => openAction('reset-primary', row)}
            >
              <RotateCcw className="size-4" />
              إعادة تعيين الجهاز
            </Button>
          </>
        )}
        actionsLabel="إجراءات"
      />
      <p className="text-xs text-ink-3">
        إجمالي المحظورين: {total.toLocaleString('ar-EG')} · الصفحة {page} من{' '}
        {pageCount}
      </p>
      <UnlockDeviceDialog
        open={selectedAction === 'unlock'}
        target={pending?.action === 'unlock' ? pending.target : null}
        saving={actioning}
        onClose={cancelAction}
        onConfirm={runAction}
      />
      <AllowDeviceDialog
        open={selectedAction === 'allow-device'}
        target={pending?.action === 'allow-device' ? pending.target : null}
        saving={actioning}
        onClose={cancelAction}
        onConfirm={runAction}
      />
      <ResetPrimaryDeviceDialog
        open={selectedAction === 'reset-primary'}
        target={pending?.action === 'reset-primary' ? pending.target : null}
        saving={actioning}
        onClose={cancelAction}
        onConfirm={runAction}
      />
    </div>
  );
}