'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, GraduationCap, KeyRound, UserRound } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  PageHeader,
  PageIntro,
  PageSkeleton,
  Select,
} from '@bahrawy/ui';
import { fetchApi } from '../../../lib/api';

type Profile = { displayName?: string; gradeId?: string };
type Grade = { id: string; nameAr: string };

export default function StudentProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [selectedGradeId, setSelectedGradeId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    Promise.all([fetchApi('/dashboard/student'), fetchApi('/catalog/grades')])
      .then(([student, gradeList]) => {
        setProfile(student.data.profile);
        setSelectedGradeId(student.data.profile.gradeId || '');
        setGrades(gradeList.data || []);
      })
      .catch(() => setError('تعذر تحميل بيانات الحساب. حاول مرة أخرى.'))
      .finally(() => setLoading(false));
  }, []);
  const save = async () => {
    if (!selectedGradeId) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await fetchApi('/dashboard/student/profile', {
        method: 'PUT',
        body: JSON.stringify({ gradeId: selectedGradeId }),
      });
      setProfile((current) => (current ? { ...current, gradeId: selectedGradeId } : current));
      setMessage('تم حفظ المرحلة الدراسية.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذر حفظ المرحلة الدراسية. حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSkeleton cards={2} />;
  return (
    <PageIntro className="min-w-0 space-y-6 sm:space-y-8">
      <PageHeader
        eyebrow="إعدادات حسابك"
        title="حسابي"
        description="راجع بياناتك وحدد المرحلة الصحيحة حتى تظهر لك الباقات المناسبة."
      />
      {error && (
        <div role="alert" className="rounded-2xl border border-danger/20 bg-danger/10 p-4 text-sm font-bold text-danger">
          {error}
        </div>
      )}
      <div className="grid min-w-0 gap-4 sm:gap-6 lg:grid-cols-[0.7fr_1.3fr]">
        <Card tone="blue">
          <CardContent className="px-4 pt-5 text-center sm:px-6 sm:pt-6">
            <span className="mx-auto flex size-20 items-center justify-center rounded-[1.5rem] bg-brand-500 text-white dark:bg-brand-400 dark:text-brand-950">
              <UserRound className="size-9" />
            </span>
            <h2 className="mt-5 font-heading text-2xl font-black">
              {profile?.displayName || 'طالب البحراوي'}
            </h2>
            <p className="mt-2 text-sm text-text-muted">حساب طالب نشط</p>
          </CardContent>
        </Card>
        <div className="space-y-5">
          <Card>
            <CardContent className="pt-5 sm:pt-6">
              <div className="flex gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-200">
                  <GraduationCap className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-heading text-xl font-black">المرحلة الدراسية</h2>
                  <p className="mt-1 text-sm text-text-muted">
                    تغيير المرحلة يؤثر على الباقات التي تظهر لك.
                  </p>
                  <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    <Select
                      className="flex-1"
                      value={selectedGradeId}
                      onChange={(event) => setSelectedGradeId(event.target.value)}
                    >
                      <option value="" disabled>
                        اختر المرحلة...
                      </option>
                      {grades.map((grade) => (
                        <option key={grade.id} value={grade.id}>
                          {grade.nameAr}
                        </option>
                      ))}
                    </Select>
                    <Button
                      className="w-full sm:w-auto"
                      onClick={save}
                      loading={saving}
                      loadingText="جاري الحفظ..."
                      disabled={!selectedGradeId || selectedGradeId === profile?.gradeId}
                    >
                      حفظ التغيير
                    </Button>
                  </div>
                  {message && (
                    <p
                      role="status"
                      className="mt-3 flex items-center gap-2 text-sm font-bold text-success"
                    >
                      <CheckCircle2 className="size-4" />
                      {message}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between sm:pt-6">
              <div className="flex gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-200">
                  <KeyRound className="size-5" />
                </span>
                <div>
                  <h2 className="font-heading text-xl font-black">كلمة المرور</h2>
                  <p className="mt-1 text-sm text-text-muted">
                    استخدم كلمة مرور قوية لا تشاركها مع أحد.
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={() => router.push('/change-password')}>
                تغيير كلمة المرور
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageIntro>
  );
}
