'use client';

import { RotateCcw } from 'lucide-react';
import { Button, Drawer } from '@bahrawy/ui';

export type ReopenExamTarget = {
  sessionId: string;
  status: 'LOCKED' | 'EXPIRED';
  studentName: string;
  studentCode: number | null;
  examTitle: string;
};

export function ReopenExamDialog({
  open,
  target,
  saving,
  onClose,
  onConfirm,
}: {
  open: boolean;
  target: ReopenExamTarget | null;
  saving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const isExpired = target?.status === 'EXPIRED';
  return (
    <Drawer
      isOpen={open}
      onClose={saving ? () => undefined : onClose}
      title="إعادة فتح الاختبار"
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
            نعم، إعادة فتح الاختبار
          </Button>
        </div>
      }
    >
      <div className="space-y-5" dir="rtl">
        <div className="flex gap-3 rounded-xl bg-surface-2 p-4">
          <RotateCcw className="mt-0.5 size-5 shrink-0 text-primary" />
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
            {isExpired
              ? 'الامتحان منتهي الوقت وفقاً للإعدادات الحالية. سيتم إعادة فتح الجلسة بمنح الطالب نافذة زمنية جديدة كاملة حسب مدة الامتحان.'
              : 'سيتم إعادة فتح الجلسة فوراً للطالب مع الحفاظ على نفس المحاولة والإجابات المحفوظة ووقت الامتحان المتبقي، وبدون أي تغيير في الدرجة أو المحاولات.'}
          </p>
        </div>
      </div>
    </Drawer>
  );
}