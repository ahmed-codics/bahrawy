'use client';

import { FormEvent, use, useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  Ban,
  BookOpen,
  CheckCircle2,
  CircleDashed,
  Clock3,
  KeyRound,
  LockKeyhole,
  Mail,
  MapPin,
  Monitor,
  Phone,
  Play,
  Plus,
  Pencil,
  RotateCcw,
  School,
  Trash2,
  Trophy,
  UserRound,
  XCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  Badge,
  Button,
  DataTable,
  Drawer,
  ErrorState,
  Input,
  PageHeader,
  PageSkeleton,
  Select,
} from '@bahrawy/ui';
import { fetchApi } from '../../../../lib/api';
import { LifecycleDialog } from '../../_components/LifecycleDialog';
import { ReasonActionDialog } from '../../_components/ReasonActionDialog';

type Product = { id: string; titleAr: string; code: string; status?: string };
type Entitlement = {
  id: string;
  status: string;
  grantedAt: string;
  expiresAt?: string | null;
  product: Product;
};
type Device = {
  id: string;
  label?: string | null;
  deviceFingerprint: string;
  createdAt: string;
  lastUsedAt: string;
};
type Session = {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  revokedAt?: string | null;
  revokedReason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};
type Payment = {
  id: string;
  status: string;
  amountRequested: number | string;
  currency: string;
  proofObjectId?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
  createdAt: string;
  ledgerEntries: {
    id: string;
    type: string;
    amountEgp: number | string;
    description: string;
    createdAt: string;
  }[];
};
type Student = {
  id: string;
  studentNumber: number;
  displayName: string;
  firstName?: string | null;
  secondName?: string | null;
  thirdName?: string | null;
  lastName?: string | null;
  phone: string;
  parentPhone?: string;
  email?: string;
  schoolName?: string | null;
  gender?: string | null;
  city?: string | null;
  grade?: { id: string; nameAr: string } | null;
  account: {
    id: string;
    status: string;
    version: number;
    createdAt: string;
    devices: Device[];
    authSessions: Session[];
    entitlements: Entitlement[];
  };
  payments: Payment[];
};

type Tab = 'entitlements' | 'payments' | 'security' | 'progress';
type Grade = { id: string; nameAr: string; status: string };

type LessonStatus =
  | 'LOCKED'
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'QUIZ_PENDING'
  | 'FAILED'
  | 'PASSED';

type ProgressLesson = {
  id: string;
  titleAr: string;
  contentType: string;
  durationSeconds: number;
  status: LessonStatus;
  watchedSeconds: number;
  completedAt: string | null;
  quiz: {
    assessmentId: string;
    requiredScore: number | null;
    lastScore: number | null;
    passed: boolean;
  } | null;
  gate: {
    requiredAssessmentId: string;
    requiredScore: number | null;
    lessonId: string;
  } | null;
};

type ProgressUnit = {
  id: string;
  titleAr: string;
  lessons: ProgressLesson[];
};

type ProgressChapter = {
  id: string;
  titleAr: string;
  units: ProgressUnit[];
};

type ProgressCourse = {
  id: string;
  titleAr: string;
  chapters: ProgressChapter[];
};

type StudentProgress = {
  student: {
    id: string;
    displayName: string | null;
    studentNumber: number | null;
    grade: { id: string; nameAr: string } | null;
  };
  courses: ProgressCourse[];
  summary: {
    totalLessons: number;
    notStarted: number;
    inProgress: number;
    quizPending: number;
    failed: number;
    passed: number;
    locked: number;
  };
};

const STATUS_META: Record<
  LessonStatus,
  {
    label: string;
    tone: 'success' | 'neutral' | 'amber' | 'violet' | 'danger' | 'coral';
  }
> = {
  PASSED: { label: 'ناجح', tone: 'success' },
  FAILED: { label: 'راسب', tone: 'danger' },
  QUIZ_PENDING: { label: 'بانتظار الاختبار', tone: 'amber' },
  IN_PROGRESS: { label: 'قيد الدراسة', tone: 'violet' },
  NOT_STARTED: { label: 'لم يبدأ', tone: 'neutral' },
  LOCKED: { label: 'مقفل', tone: 'coral' },
};
type SensitiveAction = {
  title: string;
  description: string;
  confirmLabel: string;
  run: (reason: string) => Promise<void>;
};

export default function StudentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('entitlements');
  const [grantOpen, setGrantOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [lifecycleOpen, setLifecycleOpen] = useState(false);
  const [sensitiveAction, setSensitiveAction] = useState<SensitiveAction | null>(null);
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressError, setProgressError] = useState('');

  useEffect(() => {
    if (tab !== 'progress' || progress !== null) return;
    let cancelled = false;
    setProgressLoading(true);
    setProgressError('');
    fetchApi(`/admin/v1/students/${id}/progress`)
      .then((response) => {
        if (!cancelled) setProgress(response.data as StudentProgress);
      })
      .catch((requestError) => {
        if (!cancelled)
          setProgressError(
            requestError instanceof Error ? requestError.message : 'تعذر تحميل التقدم',
          );
      })
      .finally(() => {
        if (!cancelled) setProgressLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, id, progress]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [studentResponse, productResponse, academicResponse] = await Promise.all([
        fetchApi(`/admin/v1/students/${id}`),
        fetchApi('/admin/v1/products?pageSize=100'),
        fetchApi('/admin/v1/academic'),
      ]);
      setStudent(studentResponse.data as Student);
      setProducts(
        ((productResponse.data.items ?? productResponse.data) as Product[]).filter(
          (product) => product.status !== 'ARCHIVED',
        ),
      );
      setGrades(
        (academicResponse.data.grades as Grade[]).filter((grade) => grade.status !== 'ARCHIVED'),
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذر تحميل ملف الطالب');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const setAccountStatus = async () => {
    if (!student) return;
    const nextStatus = student.account.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setSensitiveAction({
      title: nextStatus === 'SUSPENDED' ? 'إيقاف حساب الطالب' : 'إعادة تفعيل الحساب',
      description:
        nextStatus === 'SUSPENDED'
          ? 'سيُمنع الطالب من تسجيل الدخول وستُلغى جلساته النشطة. تظل بيانات التعلم والمدفوعات محفوظة.'
          : 'سيتمكن الطالب من تسجيل الدخول من جديد. لن تُعاد الجلسات القديمة.',
      confirmLabel: nextStatus === 'SUSPENDED' ? 'إيقاف الحساب' : 'إعادة التفعيل',
      run: async (reason) => {
        await fetchApi(`/admin/v1/students/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: nextStatus,
            reason,
            version: student.account.version,
          }),
        });
        toast.success(nextStatus === 'ACTIVE' ? 'تم تفعيل الطالب' : 'تم إيقاف الطالب');
        await load();
      },
    });
  };

  const revokeSessions = async () => {
    setSensitiveAction({
      title: 'تسجيل الخروج من كل الأجهزة',
      description: 'ستنتهي جميع جلسات الطالب الحالية وسيحتاج إلى تسجيل الدخول مرة أخرى.',
      confirmLabel: 'إلغاء كل الجلسات',
      run: async (reason) => {
        await fetchApi(`/admin/v1/students/${id}/sessions/revoke`, {
          method: 'POST',
          body: JSON.stringify({ reason }),
        });
        toast.success('تم إلغاء كل الجلسات النشطة');
        await load();
      },
    });
  };

  const revokeDevice = async (device: Device) => {
    setSensitiveAction({
      title: 'إلغاء جهاز الطالب',
      description: `سيُلغى الجهاز "${device.label || 'بدون اسم'}" وكل الجلسات النشطة لحماية الحساب.`,
      confirmLabel: 'إلغاء الجهاز',
      run: async (reason) => {
        await fetchApi(`/admin/v1/students/${id}/devices/${device.id}`, {
          method: 'DELETE',
          body: JSON.stringify({ reason }),
        });
        toast.success('تم إلغاء الجهاز');
        await load();
      },
    });
  };

  const changeEntitlement = async (entitlement: Entitlement, status: string) => {
    setSensitiveAction({
      title: 'تغيير حالة الاشتراك',
      description: `ستتغير حالة اشتراك "${entitlement.product.titleAr}" من ${entitlement.status} إلى ${status}.`,
      confirmLabel: 'تأكيد التغيير',
      run: async (reason) => {
        await fetchApi(`/admin/v1/students/entitlements/${entitlement.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status, reason }),
        });
        toast.success('تم تحديث الاشتراك');
        await load();
      },
    });
  };

  const updateProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!student) return;
    setSaving(true);
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget));
      await fetchApi(`/admin/v1/students/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...values,
          version: student.account.version,
        }),
      });
      toast.success('تم تحديث بيانات الطالب');
      setProfileOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const grant = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget));
      const payload = {
        productId: values.productId,
        reason: values.reason,
        ...(values.expiresAt
          ? { expiresAt: new Date(String(values.expiresAt)).toISOString() }
          : {}),
      };
      await fetchApi(`/admin/v1/students/${id}/entitlements`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      toast.success('تم منح الاشتراك');
      setGrantOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  if (loading && !student) return <PageSkeleton cards={5} />;
  if (!student) {
    return <ErrorState title="تعذر فتح ملف الطالب" description={error} onRetry={load} />;
  }

  return (
    <div className="space-y-5" dir="rtl">
      <PageHeader
        eyebrow={student.grade?.nameAr ?? 'بدون مرحلة'}
        title={student.displayName}
        description={`رقم الطالب #${student.studentNumber} · ${student.phone} · انضم ${new Date(student.account.createdAt).toLocaleDateString('ar-EG')}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => router.push('/dashboard/students')}>
              <ArrowRight className="size-4" />
              العودة
            </Button>
            <Button
              variant={student.account.status === 'ACTIVE' ? 'outline' : 'primary'}
              onClick={() => void setAccountStatus()}
            >
              {student.account.status === 'ACTIVE' ? (
                <>
                  <Ban className="size-4" />
                  إيقاف الحساب
                </>
              ) : (
                <>
                  <RotateCcw className="size-4" />
                  إعادة التفعيل
                </>
              )}
            </Button>
            <Button variant="outline" onClick={() => setLifecycleOpen(true)}>
              {student.account.status === 'ARCHIVED' ? (
                <RotateCcw className="size-4" />
              ) : (
                <Trash2 className="size-4" />
              )}
              {student.account.status === 'ARCHIVED' ? 'استعادة الطالب' : 'أرشفة الطالب'}
            </Button>
          </div>
        }
      />
      <div className="flex items-center gap-3 border-b border-border pb-3">
        {student.account.status === 'ACTIVE' ? (
          <Badge tone="success">الحساب نشط</Badge>
        ) : student.account.status === 'ARCHIVED' ? (
          <Badge tone="neutral">الحساب مؤرشف</Badge>
        ) : (
          <Badge tone="amber">الحساب موقوف</Badge>
        )}
        <span className="text-sm text-ink-3">
          {student.account.entitlements.length} اشتراك · {student.account.devices.length} جهاز ·{' '}
          {student.payments.length} عملية دفع
        </span>
      </div>
      <section className="rounded-2xl border border-border bg-surface-1 p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-brand-600">بيانات التسجيل</p>
            <h2 className="mt-1 text-lg font-bold">الملف الشخصي والتواصل</h2>
          </div>
          <Badge tone="neutral">
            {student.gender === 'FEMALE' ? 'أنثى' : student.gender === 'MALE' ? 'ذكر' : 'غير محدد'}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => setProfileOpen(true)}>
            <Pencil className="size-4" />
            تعديل البيانات
          </Button>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ProfileItem
            icon={<KeyRound />}
            label="رقم الطالب"
            value={`#${student.studentNumber}`}
            ltr
          />
          <ProfileItem icon={<UserRound />} label="الاسم الرباعي" value={student.displayName} />
          <ProfileItem icon={<Phone />} label="هاتف الطالب" value={student.phone} ltr />
          <ProfileItem
            icon={<Phone />}
            label="هاتف ولي الأمر"
            value={student.parentPhone || 'غير مسجل'}
            ltr
          />
          <ProfileItem
            icon={<Mail />}
            label="البريد الإلكتروني"
            value={student.email || 'غير مضاف'}
            ltr
          />
          <ProfileItem
            icon={<School />}
            label="المدرسة"
            value={student.schoolName || 'غير مسجلة'}
          />
          <ProfileItem
            icon={<MapPin />}
            label="المدينة / المحافظة"
            value={student.city || 'غير مسجلة'}
          />
          <ProfileItem
            icon={<School />}
            label="المرحلة"
            value={student.grade?.nameAr ?? 'بدون مرحلة'}
          />
        </dl>
      </section>
      <div className="flex gap-1 border-b border-border" role="tablist">
        {[
          ['entitlements', 'الاشتراكات'],
          ['payments', 'المدفوعات'],
          ['security', 'الأجهزة والجلسات'],
          ['progress', 'التقدم في الدروس'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value as Tab)}
            className={`border-b-2 px-4 py-3 text-sm font-bold ${
              tab === value ? 'border-brand-600 text-brand-600' : 'border-transparent text-ink-3'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'entitlements' && (
        <section className="space-y-4">
          <div className="flex justify-between gap-4">
            <h2 className="text-lg font-bold">اشتراكات الطالب</h2>
            <Button leadingIcon={<Plus className="size-4" />} onClick={() => setGrantOpen(true)}>
              منح اشتراك
            </Button>
          </div>
          <DataTable
            emptyMessage="لا توجد اشتراكات"
            data={student.account.entitlements}
            keyExtractor={(item) => item.id}
            columns={[
              {
                id: 'product',
                header: 'الباقة',
                cell: (item: Entitlement) => (
                  <div>
                    <strong>{item.product.titleAr}</strong>
                    <p className="text-xs text-ink-3" dir="ltr">
                      {item.product.code}
                    </p>
                  </div>
                ),
              },
              {
                id: 'status',
                header: 'الحالة',
                cell: (item: Entitlement) => (
                  <Badge tone={item.status === 'ACTIVE' ? 'success' : 'neutral'}>
                    {item.status}
                  </Badge>
                ),
              },
              {
                id: 'granted',
                header: 'تاريخ المنح',
                cell: (item: Entitlement) => new Date(item.grantedAt).toLocaleDateString('ar-EG'),
              },
              {
                id: 'expires',
                header: 'ينتهي',
                cell: (item: Entitlement) =>
                  item.expiresAt
                    ? new Date(item.expiresAt).toLocaleDateString('ar-EG')
                    : 'بدون انتهاء',
              },
            ]}
            rowActions={(item) => (
              <Select
                aria-label="تغيير حالة الاشتراك"
                value={item.status}
                onChange={(event) => void changeEntitlement(item, event.target.value)}
              >
                <option value="ACTIVE">نشط</option>
                <option value="SUSPENDED">موقوف</option>
                <option value="REVOKED">ملغى</option>
                <option value="EXPIRED">منتهي</option>
              </Select>
            )}
          />
        </section>
      )}

      {tab === 'payments' && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold">كل المدفوعات السابقة</h2>
          <DataTable
            emptyMessage="لا توجد مدفوعات"
            data={student.payments}
            keyExtractor={(payment) => payment.id}
            columns={[
              {
                id: 'date',
                header: 'التاريخ',
                cell: (payment: Payment) => new Date(payment.createdAt).toLocaleString('ar-EG'),
              },
              {
                id: 'amount',
                header: 'المبلغ',
                cell: (payment: Payment) => `${payment.amountRequested} ${payment.currency}`,
              },
              {
                id: 'status',
                header: 'الحالة',
                cell: (payment: Payment) => <Badge tone="neutral">{payment.status}</Badge>,
              },
              {
                id: 'review',
                header: 'المراجعة',
                cell: (payment: Payment) => payment.reviewNote ?? 'لم تراجع بعد',
              },
              {
                id: 'ledger',
                header: 'قيود الدفتر',
                cell: (payment: Payment) => payment.ledgerEntries.length,
                align: 'center',
              },
            ]}
          />
        </section>
      )}

      {tab === 'security' && (
        <section className="space-y-7">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">الأجهزة المسجلة</h2>
              <p className="text-sm text-ink-3">حذف جهاز يلغي الجلسات النشطة أيضاً.</p>
            </div>
            <Button variant="outline" onClick={() => void revokeSessions()}>
              <KeyRound className="size-4" />
              تسجيل الخروج من الكل
            </Button>
          </div>
          <DataTable
            emptyMessage="لا توجد أجهزة مسجلة"
            data={student.account.devices}
            keyExtractor={(device) => device.id}
            columns={[
              {
                id: 'device',
                header: 'الجهاز',
                cell: (device: Device) => (
                  <span className="flex items-center gap-2">
                    <Monitor className="size-4 text-ink-3" />
                    {device.label || 'جهاز بدون اسم'}
                  </span>
                ),
              },
              {
                id: 'fingerprint',
                header: 'البصمة',
                cell: (device: Device) => (
                  <span className="font-mono text-xs" dir="ltr">
                    {device.deviceFingerprint.slice(0, 16)}...
                  </span>
                ),
              },
              {
                id: 'last',
                header: 'آخر استخدام',
                cell: (device: Device) => new Date(device.lastUsedAt).toLocaleString('ar-EG'),
              },
            ]}
            rowActions={(device) => (
              <Button
                variant="ghost"
                size="icon"
                aria-label="حذف الجهاز"
                onClick={() => void revokeDevice(device)}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          />
          <div>
            <h2 className="mb-3 text-lg font-bold">سجل الجلسات</h2>
            <DataTable
              emptyMessage="لا توجد جلسات"
              data={student.account.authSessions}
              keyExtractor={(session) => session.id}
              columns={[
                {
                  id: 'seen',
                  header: 'آخر نشاط',
                  cell: (session: Session) => new Date(session.lastSeenAt).toLocaleString('ar-EG'),
                },
                {
                  id: 'ip',
                  header: 'عنوان IP',
                  cell: (session: Session) => session.ipAddress ?? 'غير متاح',
                },
                {
                  id: 'state',
                  header: 'الحالة',
                  cell: (session: Session) =>
                    session.revokedAt ? (
                      <Badge tone="neutral">ملغاة</Badge>
                    ) : (
                      <Badge tone="success">نشطة</Badge>
                    ),
                },
                {
                  id: 'reason',
                  header: 'سبب الإلغاء',
                  cell: (session: Session) => session.revokedReason ?? '—',
                },
              ]}
            />
          </div>
        </section>
      )}

      {tab === 'progress' && (
        <section className="space-y-7">
          {progressLoading ? (
            <PageSkeleton cards={3} />
          ) : progressError ? (
            <ErrorState title="تعذر تحميل التقدم" description={progressError} />
          ) : progress ? (
            <ProgressView progress={progress} />
          ) : (
            <p className="text-sm text-ink-3">لا توجد بيانات تقدم.</p>
          )}
        </section>
      )}

      <Drawer
        isOpen={grantOpen}
        onClose={() => setGrantOpen(false)}
        title="منح اشتراك"
        footer={
          <Button form="grant-entitlement" type="submit" loading={saving}>
            منح الاشتراك
          </Button>
        }
      >
        <form id="grant-entitlement" className="space-y-4" onSubmit={grant}>
          <Select name="productId" label="الباقة" required>
            <option value="">اختر باقة</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.titleAr}
              </option>
            ))}
          </Select>
          <Input name="expiresAt" type="datetime-local" label="تاريخ الانتهاء (اختياري)" />
          <Input name="reason" label="سبب المنح" required minLength={3} />
        </form>
      </Drawer>
      <Drawer
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        title="تعديل بيانات الطالب"
        footer={
          <Button type="submit" form="student-profile-form" loading={saving}>
            حفظ التعديلات
          </Button>
        }
      >
        <form id="student-profile-form" className="space-y-4" onSubmit={updateProfile}>
          <Input
            name="displayName"
            label="اسم الطالب"
            defaultValue={student.displayName}
            required
          />
          <Input
            name="phone"
            label="رقم هاتف الطالب"
            defaultValue={student.phone}
            directionMode="ltr"
            required
          />
          <Select name="gradeId" label="المرحلة الدراسية" defaultValue={student.grade?.id ?? ''}>
            <option value="">بدون مرحلة</option>
            {grades.map((grade) => (
              <option key={grade.id} value={grade.id}>
                {grade.nameAr}
              </option>
            ))}
          </Select>
          <Input name="schoolName" label="المدرسة" defaultValue={student.schoolName ?? ''} />
          <Input name="city" label="المدينة / المحافظة" defaultValue={student.city ?? ''} />
          <Input
            name="parentPhone"
            label="رقم هاتف ولي الأمر"
            defaultValue={student.parentPhone ?? ''}
            directionMode="ltr"
          />
          <Input
            name="email"
            label="البريد الإلكتروني"
            defaultValue={student.email ?? ''}
            directionMode="ltr"
            type="email"
          />
          <Input
            name="reason"
            label="سبب التعديل"
            placeholder="مثال: تحديث بيانات الطالب بطلب ولي الأمر"
            minLength={3}
            required
          />
        </form>
      </Drawer>
      {sensitiveAction && (
        <ReasonActionDialog
          open
          title={sensitiveAction.title}
          description={sensitiveAction.description}
          confirmLabel={sensitiveAction.confirmLabel}
          onClose={() => setSensitiveAction(null)}
          onConfirm={sensitiveAction.run}
        />
      )}
      <LifecycleDialog
        open={lifecycleOpen}
        endpoint={`/admin/v1/students/${id}`}
        version={student.account.version}
        onClose={() => setLifecycleOpen(false)}
        onComplete={async () => {
          setLifecycleOpen(false);
          await load();
        }}
      />
    </div>
  );
}

function ProfileItem({
  icon,
  label,
  value,
  ltr = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  ltr?: boolean;
}) {
  return (
    <div className="flex min-h-20 items-start gap-3 rounded-xl border border-border bg-surface-2 p-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 [&_svg]:size-4">
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-ink-3">{label}</dt>
        <dd className="mt-1 break-words text-sm font-bold text-ink" dir={ltr ? 'ltr' : 'rtl'}>
          {value}
        </dd>
      </div>
    </div>
  );
}

function ProgressView({ progress }: { progress: StudentProgress }) {
  const summaryItems: { label: string; value: number; icon: React.ReactNode; tone: string }[] = [
    { label: 'إجمالي الدروس', value: progress.summary.totalLessons, icon: <BookOpen className="size-4" />, tone: 'text-ink' },
    { label: 'ناجح', value: progress.summary.passed, icon: <Trophy className="size-4" />, tone: 'text-emerald-600' },
    { label: 'راسب', value: progress.summary.failed, icon: <XCircle className="size-4" />, tone: 'text-rose-600' },
    { label: 'قيد الدراسة', value: progress.summary.inProgress, icon: <Play className="size-4" />, tone: 'text-violet-600' },
    { label: 'بانتظار الاختبار', value: progress.summary.quizPending, icon: <Clock3 className="size-4" />, tone: 'text-amber-600' },
    { label: 'مقفل', value: progress.summary.locked, icon: <LockKeyhole className="size-4" />, tone: 'text-ink-3' },
    { label: 'لم يبدأ', value: progress.summary.notStarted, icon: <CircleDashed className="size-4" />, tone: 'text-ink-3' },
  ];

  return (
    <div className="space-y-7">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        {summaryItems.map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-surface-2 p-4">
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${item.tone}`}>
              {item.icon}
              {item.label}
            </span>
            <p className="mt-2 text-2xl font-black text-ink">{item.value}</p>
          </div>
        ))}
      </div>

      {progress.courses.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface-2 p-6 text-center text-sm text-ink-3">
          لا توجد كورسات منشورة بعد.
        </p>
      ) : (
        progress.courses.map((course) => (
          <section key={course.id} className="space-y-4">
            <div className="flex items-center gap-2">
              <BookOpen className="size-4 text-brand-600" />
              <h3 className="text-base font-black text-ink">{course.titleAr}</h3>
            </div>
            {course.chapters.map((chapter) => (
              <div key={chapter.id} className="rounded-xl border border-border bg-surface-2">
                <div className="border-b border-border px-4 py-3 text-sm font-bold text-ink">
                  {chapter.titleAr}
                </div>
                {chapter.units.map((unit) => (
                  <div key={unit.id} className="border-b border-border/60 last:border-b-0">
                    <div className="px-4 py-2 text-xs font-bold text-ink-3">{unit.titleAr}</div>
                    <div className="divide-y divide-border/60">
                      {unit.lessons.map((lesson) => {
                        const meta = STATUS_META[lesson.status];
                        const StatusIcon =
                          lesson.status === 'LOCKED'
                            ? LockKeyhole
                            : lesson.status === 'PASSED'
                              ? CheckCircle2
                              : lesson.status === 'FAILED'
                                ? XCircle
                                : CircleDashed;
                        return (
                          <div
                            key={lesson.id}
                            className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap"
                          >
                            <StatusIcon className="size-4 shrink-0 text-ink-3" />
                            <span className="min-w-0 flex-1 text-sm font-bold text-ink">
                              {lesson.titleAr}
                            </span>
                            {lesson.watchedSeconds > 0 && (
                              <span className="text-xs text-ink-3">
                                {Math.floor(lesson.watchedSeconds / 60)} دقيقة مشاهدة
                              </span>
                            )}
                            {lesson.quiz?.lastScore != null && (
                              <span className="text-xs text-ink-3">
                                الاختبار: {lesson.quiz.lastScore}/{lesson.quiz.requiredScore ?? 0}
                              </span>
                            )}
                            <Badge tone={meta.tone}>{meta.label}</Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </section>
        ))
      )}
    </div>
  );
}
