'use client';

import { UnlockKeyhole } from 'lucide-react';
import { Button, Drawer } from '@bahrawy/ui';

export type UnlockExamTarget = {
  accountId: string;
  assessmentId: string;
  studentName: string;
  studentCode: number | null;
  examTitle: string;
};

export function UnlockExamDialog({
  open,
  target,
  saving,
  onClose,
  onConfirm,
}: {
  open: boolean;
  target: UnlockExamTarget | null;
  saving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Drawer
      isOpen={open}
      onClose={saving ? () => undefined : onClose}
      title="فتح الامتحان للطالب"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
            className="sm:flex-1"
          >
            إلغاء
          </Button>
          <Button
            variant="primary"
            onClick={() => void onConfirm()}
            loading={saving}
            className="sm:flex-1"
          >
            نعم، فتح الامتحان للطالب
          </Button>
        </div>
      }
    >
      <div className="space-y-5" dir="rtl">
        <div className="flex gap-3 rounded-xl bg-surface-2 p-4">
          <UnlockKeyhole className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="text-sm">
            <p>
              <span className="font-bold">الطالب: </span>
              {target?.studentName ?? '—'}
            </p>
            {target?.studentCode != null && (
              <p className="mt-1">
                <span className="font-bold">كود الطالب: </span>
                <span className="font-mono tabular-nums" dir="ltr">
                  #{target.studentCode}
                </span>
              </p>
            )}
            <p className="mt-1">
              <span className="font-bold">الامتحان: </span>
              {target?.examTitle ?? '—'}
            </p>
          </div>
        </div>
        <div
          role="alert"
          className="flex gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4"
        >
          <p className="text-sm leading-7 text-ink-2">
            سيتم منح الطالب محاولة جديدة كاملة لهذا الاختبار (بعد حد المحاولات
            الأقصى). تبقى محاولاته السابقة كما هي في السجل بدون حذف، ويعود
            الطالب إلى الظهور في هذه القائمة فقط إذا فشل في المحاولة الجديدة
            أيضاً.
          </p>
        </div>
      </div>
    </Drawer>
  );
}