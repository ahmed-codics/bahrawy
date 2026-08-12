'use client';

import { LockKeyhole, MonitorSmartphone, RotateCcw, UnlockKeyhole } from 'lucide-react';
import { Button, Drawer } from '@bahrawy/ui';

export type DeviceLockTarget = {
  accountId: string;
  studentName: string;
  studentCode: number | null;
  primaryDevice: string;
  attemptedDevice: string;
};

export function UnlockDeviceDialog({
  open,
  target,
  saving,
  onClose,
  onConfirm,
}: {
  open: boolean;
  target: DeviceLockTarget | null;
  saving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Drawer
      isOpen={open}
      onClose={saving ? () => undefined : onClose}
      title="فتح حساب الطالب"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" onClick={onClose} disabled={saving} className="sm:flex-1">
            إلغاء
          </Button>
          <Button variant="primary" onClick={() => void onConfirm()} loading={saving} className="sm:flex-1">
            نعم، فتح الحساب
          </Button>
        </div>
      }
    >
      <div className="space-y-5" dir="rtl">
        <div className="flex gap-3 rounded-xl bg-surface-2 p-4">
          <UnlockKeyhole className="mt-0.5 size-5 shrink-0 text-success" />
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
              <span className="font-bold">الجهاز الأساسي: </span>
              {target?.primaryDevice || '—'}
            </p>
          </div>
        </div>
        <div role="alert" className="flex gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4">
          <p className="text-sm leading-7 text-ink-2">
            سيتم إعادة تفعيل الحساب مباشرة دون تغيير الجهاز الأساسي. يستطيع الطالب
            تسجيل الدخول من جهازه الأساسي الحالي فقط.
          </p>
        </div>
      </div>
    </Drawer>
  );
}

export function AllowDeviceDialog({
  open,
  target,
  saving,
  onClose,
  onConfirm,
}: {
  open: boolean;
  target: DeviceLockTarget | null;
  saving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Drawer
      isOpen={open}
      onClose={saving ? () => undefined : onClose}
      title="السماح بالجهاز الحالي"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" onClick={onClose} disabled={saving} className="sm:flex-1">
            إلغاء
          </Button>
          <Button variant="primary" onClick={() => void onConfirm()} loading={saving} className="sm:flex-1">
            نعم، السماح بهذا الجهاز
          </Button>
        </div>
      }
    >
      <div className="space-y-5" dir="rtl">
        <div className="flex gap-3 rounded-xl bg-surface-2 p-4">
          <MonitorSmartphone className="mt-0.5 size-5 shrink-0 text-primary" />
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
              <span className="font-bold">الجهاز المرفوض: </span>
              <span className="font-mono" dir="ltr">
                {target?.attemptedDevice || '—'}
              </span>
            </p>
          </div>
        </div>
        <div role="alert" className="flex gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4">
          <p className="text-sm leading-7 text-ink-2">
            سيتم اعتماد الجهاز المرفوض كجهاز أساسي جديد للطالب، وإعادة تفعيل الحساب،
            حتى يتمكن الطالب من تسجيل الدخول منه مباشرة.
          </p>
        </div>
      </div>
    </Drawer>
  );
}

export function ResetPrimaryDeviceDialog({
  open,
  target,
  saving,
  onClose,
  onConfirm,
}: {
  open: boolean;
  target: DeviceLockTarget | null;
  saving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Drawer
      isOpen={open}
      onClose={saving ? () => undefined : onClose}
      title="إعادة تعيين الجهاز الأساسي"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" onClick={onClose} disabled={saving} className="sm:flex-1">
            إلغاء
          </Button>
          <Button variant="primary" onClick={() => void onConfirm()} loading={saving} className="sm:flex-1">
            نعم، إعادة التعيين
          </Button>
        </div>
      }
    >
      <div className="space-y-5" dir="rtl">
        <div className="flex gap-3 rounded-xl bg-surface-2 p-4">
          <RotateCcw className="mt-0.5 size-5 shrink-0 text-violet-500" />
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
          </div>
        </div>
        <div role="alert" className="flex gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4">
          <p className="text-sm leading-7 text-ink-2">
            سيتم حذف جميع الأجهزة المسجلة للطالب وإعادة تفعيل الحساب. يمكن للطالب
            تسجيل الدخول من أي جهاز، وسيُسجّل جهاز أول دخول ناجح كجهاز أساسي جديد.
          </p>
        </div>
      </div>
    </Drawer>
  );
}

export function BlockedBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-danger/20 bg-[var(--color-danger-bg)] px-2.5 py-1 text-xs font-medium text-danger dark:bg-danger/10">
      <LockKeyhole className="size-3" aria-hidden="true" />
      {label}
    </span>
  );
}