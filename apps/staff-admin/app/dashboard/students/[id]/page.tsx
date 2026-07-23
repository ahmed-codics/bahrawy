'use client';

import { FormEvent, use, useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  Ban,
  BriefcaseBusiness,
  KeyRound,
  MapPin,
  Monitor,
  Phone,
  Plus,
  RotateCcw,
  School,
  Trash2,
  UserRound,
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
  displayName: string;
  firstName?: string | null;
  secondName?: string | null;
  thirdName?: string | null;
  lastName?: string | null;
  phone: string;
  fatherPhone?: string;
  motherPhone?: string;
  schoolName?: string | null;
  guardianOccupation?: string | null;
  gender?: string | null;
  city?: string | null;
  grade?: { nameAr: string } | null;
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

type Tab = 'entitlements' | 'payments' | 'security';

function requireReason(message: string) {
  const reason = window.prompt(message)?.trim();
  if (!reason || reason.length < 3) {
    toast.error('اكتب سبباً واضحاً لا يقل عن 3 أحرف');
    return null;
  }
  return reason;
}

export default function StudentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('entitlements');
  const [grantOpen, setGrantOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [studentResponse, productResponse] = await Promise.all([
        fetchApi(`/admin/v1/students/${id}`),
        fetchApi('/admin/v1/products'),
      ]);
      setStudent(studentResponse.data as Student);
      setProducts(
        (productResponse.data as Product[]).filter((product) => product.status !== 'ARCHIVED'),
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
    const reason = requireReason(
      nextStatus === 'SUSPENDED' ? 'سبب إيقاف حساب الطالب:' : 'سبب إعادة تفعيل الحساب:',
    );
    if (!reason) return;
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
  };

  const revokeSessions = async () => {
    const reason = requireReason('سبب تسجيل الخروج من كل الجلسات:');
    if (!reason) return;
    await fetchApi(`/admin/v1/students/${id}/sessions/revoke`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    toast.success('تم إلغاء كل الجلسات النشطة');
    await load();
  };

  const revokeDevice = async (device: Device) => {
    const reason = requireReason(`سبب حذف الجهاز "${device.label || 'بدون اسم'}":`);
    if (!reason) return;
    await fetchApi(`/admin/v1/students/${id}/devices/${device.id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    });
    toast.success('تم حذف الجهاز');
    await load();
  };

  const changeEntitlement = async (entitlement: Entitlement, status: string) => {
    const reason = requireReason('سبب تغيير حالة الاشتراك:');
    if (!reason) return;
    await fetchApi(`/admin/v1/students/entitlements/${entitlement.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason }),
    });
    toast.success('تم تحديث الاشتراك');
    await load();
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
        description={`${student.phone} · انضم ${new Date(student.account.createdAt).toLocaleDateString('ar-EG')}`}
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
          </div>
        }
      />
      <div className="flex items-center gap-3 border-b border-border pb-3">
        {student.account.status === 'ACTIVE' ? (
          <Badge tone="success">الحساب نشط</Badge>
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
        </div>
        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ProfileItem icon={<UserRound />} label="الاسم الرباعي" value={student.displayName} />
          <ProfileItem icon={<Phone />} label="هاتف الطالب" value={student.phone} ltr />
          <ProfileItem
            icon={<Phone />}
            label="هاتف الأب"
            value={student.fatherPhone || 'غير مسجل'}
            ltr
          />
          <ProfileItem
            icon={<Phone />}
            label="هاتف الأم"
            value={student.motherPhone || 'غير مسجل'}
            ltr
          />
          <ProfileItem
            icon={<School />}
            label="المدرسة"
            value={student.schoolName || 'غير مسجلة'}
          />
          <ProfileItem
            icon={<BriefcaseBusiness />}
            label="مهنة ولي الأمر"
            value={student.guardianOccupation || 'غير مسجلة'}
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
