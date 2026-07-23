'use client';

import { useCallback, useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import {
  Button,
  DataTable,
  Drawer,
  ErrorState,
  FilterBar,
  PageHeader,
  PageSkeleton,
} from '@bahrawy/ui';
import { fetchApi } from '../../../lib/api';

type AuditEvent = {
  id: string;
  actorType: string;
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId: string;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
  traceId?: string | null;
  createdAt: string;
};

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<AuditEvent | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams();
      if (search.trim()) query.set('action', search.trim());
      const response = await fetchApi(`/admin/v1/management/audit?${query}`);
      setEvents(response.data as AuditEvent[]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذر تحميل سجل التدقيق');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timeout = setTimeout(() => void load(), 250);
    return () => clearTimeout(timeout);
  }, [load]);

  if (loading && !events.length) return <PageSkeleton cards={5} />;
  if (error && !events.length)
    return <ErrorState title="تعذر تحميل سجل التدقيق" description={error} onRetry={load} />;

  return (
    <div className="space-y-5" dir="rtl">
      <PageHeader
        eyebrow="المساءلة"
        title="سجل التدقيق"
        description="آخر 500 إجراء إداري حساس مع السبب والحالة قبل وبعد التنفيذ."
      />
      <FilterBar value={search} onSearch={setSearch} searchPlaceholder="ابحث باسم الإجراء" />
      <DataTable
        loading={loading}
        emptyMessage="لا توجد أحداث مطابقة"
        data={events}
        keyExtractor={(event) => event.id}
        columns={[
          {
            id: 'date',
            header: 'الوقت',
            cell: (event: AuditEvent) => new Date(event.createdAt).toLocaleString('ar-EG'),
          },
          {
            id: 'action',
            header: 'الإجراء',
            cell: (event: AuditEvent) => <strong dir="ltr">{event.action}</strong>,
          },
          {
            id: 'target',
            header: 'الهدف',
            cell: (event: AuditEvent) => (
              <span dir="ltr">
                {event.targetType} · {event.targetId.slice(0, 10)}
              </span>
            ),
          },
          {
            id: 'actor',
            header: 'المنفذ',
            cell: (event: AuditEvent) => event.actorId?.slice(0, 10) ?? event.actorType,
          },
          { id: 'reason', header: 'السبب', cell: (event: AuditEvent) => event.reason ?? '—' },
        ]}
        rowActions={(event) => (
          <Button
            variant="ghost"
            size="icon"
            aria-label="عرض الحدث"
            onClick={() => setSelected(event)}
          >
            <Eye className="size-4" />
          </Button>
        )}
      />
      <Drawer
        isOpen={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.action ?? 'تفاصيل الحدث'}
      >
        {selected && (
          <div className="space-y-5" dir="rtl">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <dt className="text-ink-3">الوقت</dt>
              <dd>{new Date(selected.createdAt).toLocaleString('ar-EG')}</dd>
              <dt className="text-ink-3">المنفذ</dt>
              <dd dir="ltr">{selected.actorId ?? selected.actorType}</dd>
              <dt className="text-ink-3">الهدف</dt>
              <dd dir="ltr">
                {selected.targetType} · {selected.targetId}
              </dd>
              <dt className="text-ink-3">السبب</dt>
              <dd>{selected.reason ?? 'غير مسجل'}</dd>
            </dl>
            {[
              ['قبل', selected.before],
              ['بعد', selected.after],
            ].map(([label, value]) => (
              <section key={label as string}>
                <h3 className="mb-2 text-sm font-bold">{label as string}</h3>
                <pre
                  className="max-h-72 overflow-auto border border-border bg-surface-2 p-3 text-xs"
                  dir="ltr"
                >
                  {JSON.stringify(value, null, 2) ?? 'null'}
                </pre>
              </section>
            ))}
          </div>
        )}
      </Drawer>
    </div>
  );
}
