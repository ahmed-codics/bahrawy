'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Badge,
  Button,
  DataTable,
  Drawer,
  ErrorState,
  FilterBar,
  PageHeader,
  PageSkeleton,
  Select,
} from '@bahrawy/ui';
import { fetchApi } from '../../../lib/api';

type Staff = { id: string; displayName: string };
type Message = {
  id: string;
  body: string;
  authorKind: string;
  isInternal: boolean;
  createdAt: string;
  authorAccount?: {
    studentProfile?: { displayName: string } | null;
    staffProfile?: { displayName: string } | null;
  } | null;
};
type Ticket = {
  id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string | null;
  account: { studentProfile?: { id: string; displayName: string } | null };
  assignedStaff?: Staff | null;
  messages?: Message[];
  _count?: { messages: number };
};

function ticketStatus(status: string) {
  const labels: Record<string, string> = {
    OPEN: 'مفتوحة',
    IN_PROGRESS: 'قيد العمل',
    WAITING_FOR_STUDENT: 'بانتظار الطالب',
    RESOLVED: 'محلولة',
    CLOSED: 'مغلقة',
  };
  return labels[status] ?? status;
}

function priorityBadge(priority: string) {
  const tone =
    priority === 'URGENT'
      ? 'danger'
      : priority === 'HIGH'
        ? 'amber'
        : priority === 'LOW'
          ? 'neutral'
          : 'blue';
  return <Badge tone={tone}>{priority}</Badge>;
}

export default function StaffSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams();
      if (search.trim()) query.set('search', search.trim());
      if (status) query.set('status', status);
      if (priority) query.set('priority', priority);
      query.set('page', String(page));
      query.set('pageSize', '25');
      const [ticketResponse, staffResponse] = await Promise.all([
        fetchApi(`/admin/v1/support?${query}`),
        fetchApi('/admin/v1/support/staff'),
      ]);
      setTickets((ticketResponse.data.items ?? ticketResponse.data) as Ticket[]);
      setPageCount(ticketResponse.data.meta?.pageCount ?? 1);
      setStaff(staffResponse.data as Staff[]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذر تحميل تذاكر الدعم');
    } finally {
      setLoading(false);
    }
  }, [page, priority, search, status]);

  useEffect(() => {
    const timeout = setTimeout(() => void load(), 250);
    return () => clearTimeout(timeout);
  }, [load]);

  const openTicket = async (ticket: Ticket) => {
    const response = await fetchApi(`/admin/v1/support/${ticket.id}`);
    setSelected(response.data as Ticket);
  };

  const reloadSelected = async () => {
    if (!selected) return;
    const response = await fetchApi(`/admin/v1/support/${selected.id}`);
    setSelected(response.data as Ticket);
    await load();
  };

  const updateTicket = async (values: Record<string, unknown>) => {
    if (!selected) return;
    setSaving(true);
    try {
      await fetchApi(`/admin/v1/support/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...values, version: selected.version }),
      });
      await reloadSelected();
    } finally {
      setSaving(false);
    }
  };

  const reply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const body = String(values.get('body') ?? '').trim();
    if (!body) return;
    setSaving(true);
    try {
      await fetchApi(`/admin/v1/support/${selected.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          body,
          isInternal: values.get('isInternal') === 'on',
        }),
      });
      form.reset();
      toast.success(values.get('isInternal') === 'on' ? 'تمت إضافة الملاحظة' : 'تم إرسال الرد');
      await reloadSelected();
    } finally {
      setSaving(false);
    }
  };

  const openCount = useMemo(
    () => tickets.filter((ticket) => !['RESOLVED', 'CLOSED'].includes(ticket.status)).length,
    [tickets],
  );

  if (loading && !tickets.length) return <PageSkeleton cards={5} />;
  if (error && !tickets.length) {
    return <ErrorState title="تعذر تحميل الدعم" description={error} onRetry={load} />;
  }

  return (
    <div className="space-y-5" dir="rtl">
      <PageHeader
        eyebrow="خدمة الطلاب"
        title="تذاكر الدعم"
        description={`${openCount} تذكرة تحتاج متابعة ضمن النتائج الحالية.`}
      />
      <FilterBar
        value={search}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="ابحث بالطالب أو عنوان التذكرة"
        filters={
          <>
            <Select
              aria-label="تصفية بالحالة"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">كل الحالات</option>
              <option value="OPEN">مفتوحة</option>
              <option value="IN_PROGRESS">قيد العمل</option>
              <option value="WAITING_FOR_STUDENT">بانتظار الطالب</option>
              <option value="RESOLVED">محلولة</option>
              <option value="CLOSED">مغلقة</option>
            </Select>
            <Select
              aria-label="تصفية بالأولوية"
              value={priority}
              onChange={(event) => {
                setPriority(event.target.value);
                setPage(1);
              }}
            >
              <option value="">كل الأولويات</option>
              <option value="URGENT">عاجلة</option>
              <option value="HIGH">مرتفعة</option>
              <option value="NORMAL">عادية</option>
              <option value="LOW">منخفضة</option>
            </Select>
          </>
        }
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <DataTable
        loading={loading}
        emptyMessage="لا توجد تذاكر مطابقة"
        data={tickets}
        keyExtractor={(ticket) => ticket.id}
        page={page}
        pageCount={pageCount}
        onPageChange={setPage}
        columns={[
          {
            id: 'subject',
            header: 'التذكرة',
            cell: (ticket: Ticket) => (
              <div className="min-w-64">
                <strong className="line-clamp-1">{ticket.subject}</strong>
                <p className="text-xs text-ink-3">
                  {ticket.account.studentProfile?.displayName ?? 'حساب غير متاح'}
                </p>
              </div>
            ),
          },
          {
            id: 'status',
            header: 'الحالة',
            cell: (ticket: Ticket) => <Badge tone="neutral">{ticketStatus(ticket.status)}</Badge>,
          },
          {
            id: 'priority',
            header: 'الأولوية',
            cell: (ticket: Ticket) => priorityBadge(ticket.priority),
          },
          {
            id: 'assigned',
            header: 'المسؤول',
            cell: (ticket: Ticket) => ticket.assignedStaff?.displayName ?? 'غير مسندة',
          },
          {
            id: 'messages',
            header: 'الرسائل',
            cell: (ticket: Ticket) => ticket._count?.messages ?? 0,
            align: 'center',
          },
          {
            id: 'updated',
            header: 'آخر تحديث',
            cell: (ticket: Ticket) =>
              new Date(ticket.lastMessageAt ?? ticket.updatedAt).toLocaleString('ar-EG'),
          },
        ]}
        rowActions={(ticket) => (
          <Button
            variant="ghost"
            size="icon"
            aria-label="فتح التذكرة"
            onClick={() => void openTicket(ticket)}
          >
            <Eye className="size-4" />
          </Button>
        )}
      />
      <Drawer
        isOpen={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.subject ?? 'تذكرة دعم'}
      >
        {selected && (
          <div className="space-y-5" dir="rtl">
            <div className="grid grid-cols-3 gap-2">
              <Select
                label="الحالة"
                value={selected.status}
                disabled={saving}
                onChange={(event) => void updateTicket({ status: event.target.value })}
              >
                <option value="OPEN">مفتوحة</option>
                <option value="IN_PROGRESS">قيد العمل</option>
                <option value="WAITING_FOR_STUDENT">بانتظار الطالب</option>
                <option value="RESOLVED">محلولة</option>
                <option value="CLOSED">مغلقة</option>
              </Select>
              <Select
                label="الأولوية"
                value={selected.priority}
                disabled={saving}
                onChange={(event) => void updateTicket({ priority: event.target.value })}
              >
                <option value="LOW">منخفضة</option>
                <option value="NORMAL">عادية</option>
                <option value="HIGH">مرتفعة</option>
                <option value="URGENT">عاجلة</option>
              </Select>
              <Select
                label="المسؤول"
                value={selected.assignedStaff?.id ?? ''}
                disabled={saving}
                onChange={(event) => void updateTicket({ assignedStaffId: event.target.value })}
              >
                <option value="">غير مسندة</option>
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.displayName}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-3 border-y border-border py-5">
              <article className="bg-surface-2 p-4">
                <div className="mb-2 flex justify-between gap-3 text-xs text-ink-3">
                  <strong>{selected.account.studentProfile?.displayName ?? 'الطالب'}</strong>
                  <span>{new Date(selected.createdAt).toLocaleString('ar-EG')}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm">{selected.description}</p>
              </article>
              {selected.messages?.map((message) => {
                const author =
                  message.authorAccount?.staffProfile?.displayName ??
                  message.authorAccount?.studentProfile?.displayName ??
                  message.authorKind;
                return (
                  <article
                    key={message.id}
                    className={`p-4 ${
                      message.isInternal
                        ? 'border border-amber-300 bg-amber-50 text-amber-950'
                        : message.authorKind === 'STAFF'
                          ? 'bg-brand-50'
                          : 'bg-surface-2'
                    }`}
                  >
                    <div className="mb-2 flex justify-between gap-3 text-xs">
                      <strong>
                        {author}
                        {message.isInternal ? ' · ملاحظة داخلية' : ''}
                      </strong>
                      <span>{new Date(message.createdAt).toLocaleString('ar-EG')}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm">{message.body}</p>
                  </article>
                );
              })}
            </div>
            <form className="space-y-3" onSubmit={reply}>
              <label className="block text-sm font-bold" htmlFor="support-reply">
                الرد
              </label>
              <textarea
                id="support-reply"
                name="body"
                rows={4}
                required
                className="w-full resize-y border border-border bg-surface p-3 text-sm outline-none focus:border-brand-500"
              />
              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input name="isInternal" type="checkbox" className="size-4 accent-brand-600" />
                  ملاحظة داخلية لا يراها الطالب
                </label>
                <Button type="submit" loading={saving}>
                  <Send className="size-4" />
                  إرسال
                </Button>
              </div>
            </form>
          </div>
        )}
      </Drawer>
    </div>
  );
}
