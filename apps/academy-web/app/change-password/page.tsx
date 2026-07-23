'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, KeyRound, ShieldCheck } from 'lucide-react';
import { BrandMark, Button, Card, CardContent, Input } from '@bahrawy/ui';
import { fetchApi } from '../../lib/api';

export default function ChangePasswordPage() {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (newPassword.length < 8)
      return setError('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.');
    if (newPassword !== confirmPassword) return setError('تأكيد كلمة المرور غير مطابق.');
    setLoading(true);
    try {
      await fetchApi('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ oldPasswordAr: oldPassword, newPasswordAr: newPassword }),
      });
      router.push('/login');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'فشل تغيير كلمة المرور.');
    } finally {
      setLoading(false);
    }
  };
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md ba-page">
        <div className="mb-8 flex justify-center">
          <BrandMark />
        </div>
        <Card>
          <CardContent className="pt-6">
            <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-200">
              <ShieldCheck className="size-7" />
            </span>
            <h1 className="mt-5 text-center font-heading text-3xl font-black">
              أنشئ كلمة مرور جديدة
            </h1>
            <p className="mt-2 text-center text-sm text-text-muted">
              استخدم 8 أحرف على الأقل ولا تشاركها مع أي شخص.
            </p>
            <form onSubmit={submit} className="mt-7 space-y-5">
              {error && (
                <div
                  role="alert"
                  className="flex gap-3 rounded-xl border border-danger/20 bg-danger/10 p-4 text-sm font-bold text-danger"
                >
                  <AlertCircle className="size-5 shrink-0" />
                  {error}
                </div>
              )}
              <Input
                label="كلمة المرور الحالية"
                type="password"
                value={oldPassword}
                onChange={(event) => setOldPassword(event.target.value)}
                required
                disabled={loading}
                directionMode="ltr"
                leadingIcon={<KeyRound className="size-5" />}
              />
              <Input
                label="كلمة المرور الجديدة"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                minLength={8}
                required
                disabled={loading}
                directionMode="ltr"
                hint="8 أحرف على الأقل"
              />
              <Input
                label="تأكيد كلمة المرور"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={8}
                required
                disabled={loading}
                directionMode="ltr"
              />
              <Button
                type="submit"
                size="lg"
                className="w-full"
                loading={loading}
                loadingText="جاري الحفظ..."
              >
                حفظ كلمة المرور
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
