'use client';

import { useState } from 'react';
import { Button, Card, CardHeader, CardTitle, CardContent } from '@bahrawy/ui';
import { fetchApi } from '../../../../lib/api';

export default function PasswordRecoveryPage() {
  const [accountId, setAccountId] = useState('');
  const [reason, setReason] = useState('');
  const [identityVerified, setIdentityVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState<{ caseId: string; resetCode: string } | null>(
    null,
  );

  const handleGenerateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identityVerified) {
      setError('يجب تأكيد التحقق من هوية الطالب أولاً.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await fetchApi('/auth/staff/recovery-case', {
        method: 'POST',
        body: JSON.stringify({
          targetAccountId: accountId,
          reason,
          checklist: { identityVerified },
        }),
      });
      setSuccessData(res);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'فشل إنشاء طلب استعادة كلمة المرور');
      } else {
        setError('فشل إنشاء طلب استعادة كلمة المرور');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <header>
          <h1 className="text-3xl font-heading font-bold text-primary">استعادة كلمة المرور</h1>
          <p className="text-text-muted mt-2">إنشاء رمز مؤقت لاستعادة حساب الطالب</p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>بيانات طلب الاستعادة</CardTitle>
          </CardHeader>
          <CardContent>
            {successData ? (
              <div className="bg-success/10 border border-success/30 rounded-xl p-6 text-center space-y-4">
                <h3 className="text-xl font-bold text-success">تم إنشاء الرمز بنجاح</h3>
                <p className="text-text-muted">
                  قم بإعطاء هذا الرمز للطالب لاستخدامه في تسجيل الدخول ككلمة مرور مؤقتة:
                </p>
                <div className="text-4xl font-mono font-black tracking-widest text-interactive py-4">
                  {successData.resetCode}
                </div>
                <p className="text-sm text-danger">
                  ملاحظة: هذا الرمز صالح للاستخدام مرة واحدة فقط ولمدة محدودة.
                </p>
                <Button onClick={() => setSuccessData(null)} variant="outline">
                  إنشاء رمز آخر
                </Button>
              </div>
            ) : (
              <form onSubmit={handleGenerateCode} className="space-y-6">
                {error && (
                  <div className="text-danger text-sm p-3 bg-danger/10 border border-danger/20 rounded-lg">
                    {error}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-sm font-bold text-text-primary">
                    معرف حساب الطالب (Account ID)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full p-3 border border-border-default rounded-xl focus:ring-2 focus:ring-interactive focus:border-interactive bg-surface/50 font-sans shadow-sm"
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-bold text-text-primary">
                    سبب طلب الاستعادة
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full p-3 border border-border-default rounded-xl focus:ring-2 focus:ring-interactive focus:border-interactive bg-surface/50 font-sans shadow-sm"
                    placeholder="مثال: الطالب فقد هاتفه ويريد الدخول من هاتف جديد..."
                    required
                    disabled={loading}
                  />
                </div>

                <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl">
                  <input
                    type="checkbox"
                    id="identityVerified"
                    checked={identityVerified}
                    onChange={(e) => setIdentityVerified(e.target.checked)}
                    className="w-5 h-5 accent-interactive"
                    disabled={loading}
                  />
                  <label
                    htmlFor="identityVerified"
                    className="text-sm font-bold text-amber-900 dark:text-amber-500 cursor-pointer"
                  >
                    أقر بأني قمت بالتحقق من هوية الطالب وأن هذا الطلب شرعي
                  </label>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full py-3"
                  disabled={loading || !identityVerified}
                >
                  {loading ? 'جاري الإنشاء...' : 'إنشاء رمز الاستعادة'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
