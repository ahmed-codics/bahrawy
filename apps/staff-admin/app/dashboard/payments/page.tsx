'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ExternalLink, Eye, X } from 'lucide-react';
import toast from 'react-hot-toast';
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
} from '@bahrawy/ui';
import { API_BASE, fetchApi } from '../../../lib/api';

type LedgerEntry = {
  id: string;
  type: string;
  amountEgp: number | string;
  description: string;
  createdAt: string;
  entitlementId?: string | null;
};
type Order = {
  id: string;
  status: string;
  amountRequested: number | string;
  currency: string;
  proofObjectId?: string | null;
  referenceNumber?: string | null;
  reviewNote?: string | null;
  reviewedAt?: string | null;
  version: number;
  createdAt: string;
  student?: { id: string; displayName: string } | null;
  product?: { id: string; code: string; titleAr: string } | null;
  reviewer?: { displayName: string } | null;
  proof?: {
    originalName: string;
    mimeType: string;
    scanStatus: string;
    status: string;
  } | null;
  ledgerEntries: LedgerEntry[];
};

function paymentBadge(status: string) {
  if (status === 'APPROVED') return <Badge tone="success">مقبولة</Badge>;
  if (status === 'REJECTED') return <Badge tone="danger">مرفوضة</Badge>;
  return <Badge tone="amber">بانتظار المراجعة</Badge>;
}

export default function PaymentsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams();
      if (status) query.set('status', status);
      if (search.trim()) query.set('search', search.trim());
      const response = await fetchApi(`/admin/v1/payments?${query}`);
      setOrders(response.data as Order[]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذر تحميل المدفوعات');
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    const timeout = setTimeout(() => void load(), 250);
    return () => clearTimeout(timeout);
  }, [load]);

  const pendingCount = useMemo(
    () => orders.filter((order) => order.status === 'PENDING_REVIEW').length,
    [orders],
  );

  const openOrder = (order: Order) => {
    setSelected(order);
    setDecision(null);
    setNote('');
  };

  const review = async () => {
    if (!selected || !decision) return;
    setSaving(true);
    try {
      await fetchApi(`/admin/v1/payments/${selected.id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({
          decision,
          note: note.trim() || undefined,
          version: selected.version,
        }),
      });
      toast.success(decision === 'APPROVED' ? 'تم اعتماد الدفع ومنح الوصول' : 'تم رفض الدفع');
      setSelected(null);
      await load();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : 'تعذر مراجعة الدفع');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !orders.length) return <PageSkeleton cards={5} />;
  if (error && !orders.length) {
    return <ErrorState title="تعذر تحميل المدفوعات" description={error} onRetry={load} />;
  }

  return (
    <div className="space-y-5" dir="rtl">
      <PageHeader
        eyebrow="المراجعة المالية"
        title="المدفوعات"
        description={`${pendingCount} طلب بانتظار المراجعة ضمن النتائج الحالية. يعرض الجدول كل الطلبات السابقة وليس قائمة الانتظار فقط.`}
      />
      <FilterBar
        value={search}
        onSearch={setSearch}
        searchPlaceholder="ابحث باسم الطالب"
        filters={
          <Select
            aria-label="تصفية بالحالة"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">كل الحالات</option>
            <option value="PENDING_REVIEW">بانتظار المراجعة</option>
            <option value="APPROVED">مقبولة</option>
            <option value="REJECTED">مرفوضة</option>
          </Select>
        }
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <DataTable
        loading={loading}
        emptyMessage="لا توجد مدفوعات مطابقة"
        data={orders}
        keyExtractor={(order) => order.id}
        columns={[
          {
            id: 'student',
            header: 'الطالب',
            cell: (order: Order) => order.student?.displayName ?? 'حساب غير متاح',
          },
          {
            id: 'product',
            header: 'الباقة',
            cell: (order: Order) => (
              <div>
                <strong>{order.product?.titleAr ?? 'باقة غير متاحة'}</strong>
                {order.product && (
                  <p className="text-xs text-ink-3" dir="ltr">
                    {order.product.code}
                  </p>
                )}
              </div>
            ),
          },
          {
            id: 'amount',
            header: 'المبلغ',
            cell: (order: Order) => `${order.amountRequested} ${order.currency}`,
          },
          {
            id: 'reference',
            header: 'الرقم المرجعي',
            cell: (order: Order) => (
              <span className="font-mono text-xs" dir="ltr">
                {order.referenceNumber || '—'}
              </span>
            ),
          },
          { id: 'status', header: 'الحالة', cell: (order: Order) => paymentBadge(order.status) },
          {
            id: 'proof',
            header: 'الإيصال',
            cell: (order: Order) =>
              order.proof ? (
                <Badge tone={order.proof.scanStatus === 'CLEAN' ? 'success' : 'amber'}>
                  {order.proof.scanStatus === 'CLEAN' ? 'سليم' : order.proof.scanStatus}
                </Badge>
              ) : (
                'غير مرفق'
              ),
          },
          {
            id: 'date',
            header: 'التاريخ',
            cell: (order: Order) => new Date(order.createdAt).toLocaleString('ar-EG'),
          },
        ]}
        rowActions={(order) => (
          <Button
            variant="ghost"
            size="icon"
            aria-label="عرض عملية الدفع"
            onClick={() => openOrder(order)}
          >
            <Eye className="size-4" />
          </Button>
        )}
      />
      <Drawer
        isOpen={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="تفاصيل عملية الدفع"
        footer={
          selected?.status === 'PENDING_REVIEW' && decision ? (
            <Button
              variant={decision === 'REJECTED' ? 'danger' : 'primary'}
              onClick={() => void review()}
              loading={saving}
            >
              تأكيد {decision === 'APPROVED' ? 'الاعتماد' : 'الرفض'}
            </Button>
          ) : undefined
        }
      >
        {selected && (
          <div className="space-y-6" dir="rtl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-bold">{selected.student?.displayName ?? 'حساب غير متاح'}</h3>
                <p className="text-sm text-ink-3">{selected.product?.titleAr}</p>
              </div>
              {paymentBadge(selected.status)}
            </div>
            <div className="border-y border-border py-4">
              <strong className="text-2xl">
                {selected.amountRequested} {selected.currency}
              </strong>
              <p className="mt-1 text-xs text-ink-3" dir="ltr">
                #{selected.id}
              </p>
              <div className="mt-4 rounded-xl bg-surface-soft p-3">
                <p className="text-xs font-bold text-ink-3">الرقم المرجعي للتحويل</p>
                <p className="mt-1 font-mono text-base font-black" dir="ltr">
                  {selected.referenceNumber || 'غير مُدخل'}
                </p>
              </div>
            </div>
            {selected.proofObjectId ? (
              <Button
                variant="outline"
                onClick={() =>
                  window.open(
                    `${API_BASE}/storage/receipts/${selected.proofObjectId}`,
                    '_blank',
                    'noopener,noreferrer',
                  )
                }
              >
                <ExternalLink className="size-4" />
                فتح الإيصال
              </Button>
            ) : (
              <p className="text-sm text-danger">لم يرفق الطالب إيصالاً.</p>
            )}
            {selected.status === 'PENDING_REVIEW' && (
              <section className="space-y-3 border-t border-border pt-4">
                <h3 className="text-sm font-bold">قرار المراجعة</h3>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={decision === 'APPROVED' ? 'primary' : 'outline'}
                    onClick={() => setDecision('APPROVED')}
                  >
                    <Check className="size-4" />
                    اعتماد
                  </Button>
                  <Button
                    variant={decision === 'REJECTED' ? 'danger' : 'outline'}
                    onClick={() => setDecision('REJECTED')}
                  >
                    <X className="size-4" />
                    رفض
                  </Button>
                </div>
                <Input
                  label="ملاحظة المراجعة (اختياري)"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </section>
            )}
            {selected.reviewedAt && (
              <section className="space-y-1 border-t border-border pt-4 text-sm">
                <h3 className="font-bold">نتيجة المراجعة</h3>
                <p>{selected.reviewNote}</p>
                <p className="text-ink-3">
                  {selected.reviewer?.displayName ?? 'موظف غير متاح'} ·{' '}
                  {new Date(selected.reviewedAt).toLocaleString('ar-EG')}
                </p>
              </section>
            )}
            <section className="space-y-2 border-t border-border pt-4">
              <h3 className="text-sm font-bold">قيود الدفتر</h3>
              {!selected.ledgerEntries.length && (
                <p className="text-sm text-ink-3">لا توجد قيود مالية بعد.</p>
              )}
              {selected.ledgerEntries.map((entry) => (
                <div key={entry.id} className="flex justify-between gap-4 text-sm">
                  <span>
                    {entry.type} · {entry.description}
                  </span>
                  <strong>{entry.amountEgp} EGP</strong>
                </div>
              ))}
            </section>
          </div>
        )}
      </Drawer>
    </div>
  );
}
