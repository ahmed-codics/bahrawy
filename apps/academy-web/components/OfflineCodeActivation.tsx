'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { KeyRound, Loader2, PartyPopper, X } from 'lucide-react';
import { Button, Input } from '@bahrawy/ui';
import { fetchApi } from '../lib/api';

type ActivationResult = {
  courseId: string;
  productId: string;
};

export function OfflineCodeActivation({
  onActivated,
}: {
  onActivated: (courseId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<ActivationResult | null>(null);

  const submit = async () => {
    if (!code.trim() || saving) return;
    setSaving(true);
    setError('');
    try {
      const response = (await fetchApi('/student/offline-codes/activate', {
        method: 'POST',
        body: JSON.stringify({ code: code.trim() }),
      })) as { status: string; data: ActivationResult };
      setSuccess(response.data);
      onActivated(response.data.courseId);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'تعذر تفعيل الكود، حاول مرة أخرى',
      );
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setSuccess(null);
          setError('');
          setCode('');
          setOpen(true);
        }}
        className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-dashed border-brand-300/60 bg-brand-50/50 px-5 py-4 text-start transition-colors hover:border-brand-400 hover:bg-brand-50 dark:border-brand-800 dark:bg-brand-950/40 dark:hover:border-brand-700"
      >
        <span className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-600/10 text-brand-700 dark:text-brand-300">
            <KeyRound className="size-5" />
          </span>
          <span>
            <span className="block text-sm font-black text-brand-700 dark:text-brand-300">
              لديك كود تفعيل؟
            </span>
            <span className="block text-xs text-text-muted">
              فعّل كود كورس أوفلاين للحصول على كورسك فوراً
            </span>
          </span>
        </span>
        <span className="text-xs font-bold text-brand-600 dark:text-brand-400">
          تفعيل
        </span>
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border-default bg-surface/90 p-5 shadow-sm"
    >
      {success ? (
        <div className="text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-success/15 text-success">
            <PartyPopper className="size-7" />
          </span>
          <h3 className="mt-3 text-lg font-black text-ink">تم تفعيل الكورس بنجاح 🎉</h3>
          <p className="mt-1 text-sm text-text-muted">
            يمكنك الآن متابعة الكورس من صفحة الكورسات.
          </p>
          <Button className="mt-4 w-full" onClick={() => setOpen(false)}>
            رائع
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-ink">تفعيل كود أوفلاين</h3>
              <p className="mt-0.5 text-xs text-text-muted">
                أدخل الكود الذي حصلت عليه من الأكاديمية
              </p>
            </div>
            <button
              type="button"
              aria-label="إغلاق"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-3"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="mt-4 space-y-3">
            <Input
              dir="ltr"
              placeholder="BHW-XXXX-XXXX"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void submit();
              }}
            />
            {error && (
              <p role="alert" className="text-xs font-bold text-danger">
                {error}
              </p>
            )}
            <Button className="w-full" onClick={submit} disabled={!code.trim() || saving}>
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  جارٍ التفعيل...
                </>
              ) : (
                'تفعيل الكود'
              )}
            </Button>
          </div>
        </>
      )}
    </motion.div>
  );
}