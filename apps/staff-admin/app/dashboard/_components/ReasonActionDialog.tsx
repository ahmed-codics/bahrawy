'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, Drawer, Textarea } from '@bahrawy/ui';

export function ReasonActionDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = 'danger',
  reasonLabel = 'سبب الإجراء',
  requireReason = true,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  reasonLabel?: string;
  requireReason?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const valid = !requireReason || reason.trim().length >= 3;

  const confirm = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError('');
    try {
      await onConfirm(reason.trim());
      setReason('');
      onClose();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'تعذر تنفيذ الإجراء. حاول مرة أخرى.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      isOpen={open}
      onClose={saving ? () => undefined : onClose}
      title={title}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" onClick={onClose} disabled={saving} className="sm:flex-1">
            إلغاء
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={() => void confirm()}
            loading={saving}
            disabled={!valid}
            className="sm:flex-1"
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="space-y-5" dir="rtl">
        <div className="flex gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <p className="text-sm leading-7 text-ink-2">{description}</p>
        </div>
        {requireReason && (
          <Textarea
            label={reasonLabel}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="اكتب سبباً واضحاً ليظهر في سجل التدقيق…"
            rows={4}
            required
            error={
              reason.length > 0 && reason.trim().length < 3
                ? 'السبب يجب ألا يقل عن 3 أحرف'
                : undefined
            }
          />
        )}
        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </Drawer>
  );
}
