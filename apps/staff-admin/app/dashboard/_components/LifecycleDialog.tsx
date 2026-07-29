'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Archive, RotateCcw, Trash2 } from 'lucide-react';
import type {
  AdminApiResponse,
  AdminDeletionImpact,
  AdminLifecycleAction,
} from '@bahrawy/types';
import { Badge, Button, Drawer, Input } from '@bahrawy/ui';
import { fetchApi } from '../../../lib/api';

type LifecycleDialogProps = {
  open: boolean;
  endpoint: string;
  version: number;
  onClose: () => void;
  onComplete: (action: AdminLifecycleAction) => Promise<void> | void;
};

const actionLabels: Record<AdminLifecycleAction, string> = {
  ARCHIVE: 'أرشفة',
  RESTORE: 'استعادة',
  PERMANENT_DELETE: 'حذف نهائي',
};

export function LifecycleDialog({
  open,
  endpoint,
  version,
  onClose,
  onComplete,
}: LifecycleDialogProps) {
  const [impact, setImpact] = useState<AdminDeletionImpact | null>(null);
  const [action, setAction] = useState<AdminLifecycleAction | null>(null);
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setImpact(null);
    setReason('');
    setConfirmation('');
    void fetchApi<AdminApiResponse<AdminDeletionImpact>>(
      `${endpoint}/deletion-impact`,
      { signal: controller.signal },
    )
      .then((response) => {
        setImpact(response.data);
        setAction(response.data.actions[0] ?? null);
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'تعذر فحص الارتباطات الحالية',
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [endpoint, open]);

  const submit = async () => {
    if (!impact || !action || reason.trim().length < 3) return;
    if (
      action === 'PERMANENT_DELETE' &&
      confirmation.trim() !== impact.label.trim()
    ) {
      setError('اكتب الاسم كما هو لتأكيد الحذف النهائي.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const suffix =
        action === 'ARCHIVE'
          ? '/archive'
          : action === 'RESTORE'
            ? '/restore'
            : '';
      await fetchApi(`${endpoint}${suffix}`, {
        method: action === 'PERMANENT_DELETE' ? 'DELETE' : 'POST',
        body: JSON.stringify({
          version,
          reason: reason.trim(),
          ...(action === 'PERMANENT_DELETE'
            ? { confirmation: confirmation.trim() }
            : {}),
        }),
      });
      await onComplete(action);
      onClose();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'تعذر تنفيذ الإجراء',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title="إدارة دورة حياة السجل"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            إلغاء
          </Button>
          <Button
            variant={action === 'PERMANENT_DELETE' ? 'danger' : 'primary'}
            loading={saving}
            disabled={
              loading ||
              !impact ||
              !action ||
              reason.trim().length < 3 ||
              (action === 'PERMANENT_DELETE' &&
                confirmation.trim() !== impact.label.trim())
            }
            onClick={() => void submit()}
          >
            {action ? actionLabels[action] : 'متابعة'}
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className="space-y-3" aria-label="جارٍ فحص الارتباطات">
          <div className="h-20 animate-pulse rounded-xl bg-surface-2" />
          <div className="h-12 animate-pulse rounded-xl bg-surface-2" />
          <div className="h-12 animate-pulse rounded-xl bg-surface-2" />
        </div>
      ) : error && !impact ? (
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-danger">
          {error}
        </div>
      ) : impact ? (
        <div className="space-y-5" dir="rtl">
          <div className="rounded-xl border border-border bg-surface-2 p-4">
            <p className="text-xs font-bold text-ink-3">السجل</p>
            <p className="mt-1 text-lg font-black text-ink">{impact.label}</p>
            <Badge tone={impact.currentStatus === 'ARCHIVED' ? 'neutral' : 'blue'}>
              {impact.currentStatus}
            </Badge>
          </div>

          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-black text-ink">الإجراء المطلوب</legend>
            {impact.actions.map((availableAction) => (
              <label
                key={availableAction}
                className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-3 ${
                  action === availableAction
                    ? 'border-brand-500 bg-brand-50/70'
                    : 'border-border bg-surface'
                }`}
              >
                <input
                  type="radio"
                  name="lifecycle-action"
                  value={availableAction}
                  checked={action === availableAction}
                  onChange={() => setAction(availableAction)}
                />
                {availableAction === 'ARCHIVE' ? (
                  <Archive className="size-5" />
                ) : availableAction === 'RESTORE' ? (
                  <RotateCcw className="size-5" />
                ) : (
                  <Trash2 className="size-5 text-danger" />
                )}
                <span className="font-bold">{actionLabels[availableAction]}</span>
              </label>
            ))}
          </fieldset>

          {impact.blockers.length > 0 && (
            <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
              <div className="flex items-center gap-2 font-black">
                <AlertTriangle className="size-5" />
                لماذا لا يتاح الحذف النهائي؟
              </div>
              <ul className="mt-3 space-y-2 text-sm">
                {impact.blockers.map((blocker) => (
                  <li key={blocker.code} className="flex justify-between gap-4">
                    <span>{blocker.label}</span>
                    <strong>{blocker.count}</strong>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {impact.affectedChildren.length > 0 && (
            <section>
              <h3 className="text-sm font-black text-ink">السجلات التابعة المتأثرة</h3>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {impact.affectedChildren.map((child) => (
                  <div
                    key={child.type}
                    className="rounded-xl border border-border bg-surface-2 p-3"
                  >
                    <strong className="block text-lg">{child.count}</strong>
                    <span className="text-xs text-ink-3">{child.label}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <Input
            label="سبب الإجراء"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="اكتب سبباً واضحاً يظهر في سجل التدقيق"
            required
          />

          {action === 'PERMANENT_DELETE' && (
            <Input
              label={`اكتب "${impact.label}" للتأكيد`}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              required
            />
          )}

          {error && (
            <p role="alert" className="text-sm font-bold text-danger">
              {error}
            </p>
          )}
        </div>
      ) : null}
    </Drawer>
  );
}
