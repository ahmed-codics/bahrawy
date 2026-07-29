'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  GraduationCap,
  KeyRound,
  Phone,
  School,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  UserRound,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  DataSaverToggle,
  ErrorState,
  Input,
  PageHeader,
  PageIntro,
  PageSkeleton,
  Select,
  ThemeSelector,
} from '@bahrawy/ui';
import { fetchApi } from '../../../lib/api';

type Profile = {
  displayName: string;
  gradeId?: string | null;
  schoolName?: string | null;
  city?: string | null;
  gender?: 'MALE' | 'FEMALE' | null;
  phoneMasked?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

type Grade = { id: string; nameAr: string };
type AcademicForm = {
  gradeId: string;
  schoolName: string;
  city: string;
  gender: string;
};

const emptyForm: AcademicForm = {
  gradeId: '',
  schoolName: '',
  city: '',
  gender: '',
};

function formFromProfile(profile: Profile): AcademicForm {
  return {
    gradeId: profile.gradeId || '',
    schoolName: profile.schoolName || '',
    city: profile.city || '',
    gender: profile.gender || '',
  };
}

async function fetchProfileData() {
  const [student, gradeList] = await Promise.all([
    fetchApi('/dashboard/student/profile'),
    fetchApi('/catalog/grades'),
  ]);
  return {
    profile: student.data?.profile as Profile,
    grades: (gradeList.data || []) as Grade[],
  };
}

export default function StudentProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [form, setForm] = useState<AcademicForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await fetchProfileData();
      setProfile(data.profile);
      setForm(formFromProfile(data.profile));
      setGrades(data.grades);
    } catch {
      setLoadError('تعذر تحميل بيانات الحساب. تحقق من اتصالك وحاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchProfileData()
      .then((data) => {
        if (!active) return;
        setProfile(data.profile);
        setForm(formFromProfile(data.profile));
        setGrades(data.grades);
      })
      .catch(() => {
        if (active) {
          setLoadError('تعذر تحميل بيانات الحساب. تحقق من اتصالك وحاول مرة أخرى.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const hasChanges = useMemo(() => {
    if (!profile) return false;
    return JSON.stringify(form) !== JSON.stringify(formFromProfile(profile));
  }, [form, profile]);

  const selectedGrade = grades.find((grade) => grade.id === profile?.gradeId);
  const memberSince = profile?.createdAt
    ? new Intl.DateTimeFormat('ar-EG', {
        year: 'numeric',
        month: 'long',
      }).format(new Date(profile.createdAt))
    : 'غير متاح';

  const save = async () => {
    if (!form.gradeId || !hasChanges) return;
    setSaving(true);
    setMessage('');
    setSaveError('');
    try {
      const response = await fetchApi('/dashboard/student/profile', {
        method: 'PUT',
        body: JSON.stringify({
          gradeId: form.gradeId,
          schoolName: form.schoolName || null,
          city: form.city || null,
          gender: form.gender || null,
        }),
      });
      const updated = response.data?.profile as Profile;
      setProfile(updated);
      setForm(formFromProfile(updated));
      setMessage('تم حفظ بياناتك الدراسية بنجاح.');
    } catch {
      setSaveError('تعذر حفظ التغييرات الآن. بياناتك لم تتغير، حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSkeleton cards={4} />;
  if (!profile || loadError) {
    return (
      <ErrorState
        title="تعذر فتح حسابك"
        description={loadError}
        onRetry={() => void load()}
      />
    );
  }

  return (
    <PageIntro className="min-w-0 space-y-5 sm:space-y-7">
      <PageHeader
        eyebrow="مركز حسابك"
        title="حسابي"
        description="بيانات الدخول، مرحلتك الدراسية، الأمان وتفضيلات التطبيق في مكان واحد."
        actions={
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            trailingIcon={<ChevronLeft className="size-4" />}
            onClick={() => router.push('/student/courses')}
          >
            كورساتي
          </Button>
        }
      />

      <Card tone="blue" className="overflow-hidden">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <span className="flex size-20 shrink-0 items-center justify-center rounded-[1.5rem] bg-brand-500 text-white shadow-lg shadow-brand-500/15 dark:bg-brand-400 dark:text-brand-950">
              <UserRound className="size-9" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="break-words font-heading text-2xl font-black sm:text-3xl">
                  {profile.displayName || 'طالب البحراوي'}
                </h2>
                <Badge tone={profile.status === 'ACTIVE' ? 'success' : 'amber'}>
                  {profile.status === 'ACTIVE' ? 'حساب نشط' : 'راجع حالة الحساب'}
                </Badge>
              </div>
              <p className="mt-2 text-sm leading-7 text-text-muted">
                حساب طالب في أكاديمية السيد البحراوي
              </p>
            </div>
          </div>

          <dl className="mt-6 grid gap-3 sm:grid-cols-3">
            <AccountFact
              icon={<Phone className="size-5" />}
              label="رقم تسجيل الدخول"
              value={profile.phoneMasked || 'غير متاح'}
              ltr
            />
            <AccountFact
              icon={<GraduationCap className="size-5" />}
              label="المرحلة الحالية"
              value={selectedGrade?.nameAr || 'لم تحدد بعد'}
            />
            <AccountFact
              icon={<CalendarDays className="size-5" />}
              label="عضو منذ"
              value={memberSince}
            />
          </dl>
        </CardContent>
      </Card>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <SectionTitle
              icon={<School className="size-5" />}
              title="بياناتك الدراسية"
              description="نستخدمها لترتيب المحتوى وإظهار الكورسات والباقات المناسبة لك."
            />

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-black">المرحلة الدراسية *</span>
                <Select
                  value={form.gradeId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, gradeId: event.target.value }))
                  }
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
              </label>

              <label className="space-y-2">
                <span className="text-sm font-black">المدرسة</span>
                <Input
                  value={form.schoolName}
                  maxLength={120}
                  placeholder="اسم المدرسة"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, schoolName: event.target.value }))
                  }
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-black">المحافظة أو المدينة</span>
                <Input
                  value={form.city}
                  maxLength={80}
                  placeholder="مثال: الإسكندرية"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, city: event.target.value }))
                  }
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-black">النوع</span>
                <Select
                  value={form.gender}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, gender: event.target.value }))
                  }
                >
                  <option value="">غير محدد</option>
                  <option value="MALE">طالب</option>
                  <option value="FEMALE">طالبة</option>
                </Select>
              </label>
            </div>

            {saveError && (
              <p role="alert" className="mt-4 rounded-xl bg-danger/10 p-3 text-sm font-bold text-danger">
                {saveError}
              </p>
            )}
            {message && (
              <p role="status" className="mt-4 flex items-center gap-2 text-sm font-bold text-success">
                <CheckCircle2 className="size-4" aria-hidden="true" />
                {message}
              </p>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              {hasChanges && (
                <Button
                  variant="ghost"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    setForm(formFromProfile(profile));
                    setSaveError('');
                    setMessage('');
                  }}
                >
                  إلغاء التغييرات
                </Button>
              )}
              <Button
                className="w-full sm:w-auto"
                onClick={() => void save()}
                loading={saving}
                loadingText="جاري الحفظ..."
                disabled={!form.gradeId || !hasChanges}
              >
                حفظ بياناتي
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardContent className="p-4 sm:p-5">
              <SectionTitle
                icon={<ShieldCheck className="size-5" />}
                title="الأمان"
                description="حافظ على كلمة مرور قوية ولا تشاركها مع أي شخص."
              />
              <Button
                variant="outline"
                className="mt-5 w-full justify-between"
                leadingIcon={<KeyRound className="size-4" />}
                trailingIcon={<ChevronLeft className="size-4" />}
                onClick={() => router.push('/change-password')}
              >
                تغيير كلمة المرور
              </Button>
              <p className="mt-3 text-xs leading-6 text-text-muted">
                رقم الدخول لا يمكن تغييره من التطبيق لحماية حسابك.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-5">
              <SectionTitle
                icon={<Settings2 className="size-5" />}
                title="تفضيلات التطبيق"
                description="الإعدادات تحفظ على هذا الجهاز."
              />
              <div className="mt-5 space-y-3">
                <PreferenceRow label="المظهر" description="فاتح أو داكن">
                  <ThemeSelector />
                </PreferenceRow>
                <PreferenceRow label="توفير البيانات" description="صور وفيديو أخف">
                  <DataSaverToggle />
                </PreferenceRow>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-5">
              <SectionTitle
                icon={<BookOpen className="size-5" />}
                title="وصول سريع"
                description="ارجع لمحتواك من غير خطوات إضافية."
              />
              <div className="mt-5 grid gap-3">
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  leadingIcon={<BookOpen className="size-4" />}
                  trailingIcon={<ChevronLeft className="size-4" />}
                  onClick={() => router.push('/student/courses')}
                >
                  كورساتي
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  leadingIcon={<ShoppingBag className="size-4" />}
                  trailingIcon={<ChevronLeft className="size-4" />}
                  onClick={() => router.push('/student/products')}
                >
                  الباقات المتاحة
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageIntro>
  );
}

function SectionTitle({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-200">
        {icon}
      </span>
      <div className="min-w-0">
        <h2 className="font-heading text-lg font-black sm:text-xl">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-text-muted">{description}</p>
      </div>
    </div>
  );
}

function AccountFact({
  icon,
  label,
  value,
  ltr = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  ltr?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-border-default bg-surface-soft p-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-200">
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-text-muted">{label}</dt>
        <dd className="mt-1 truncate text-sm font-black" dir={ltr ? 'ltr' : undefined}>
          {value}
        </dd>
      </div>
    </div>
  );
}

function PreferenceRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-border-default bg-surface-soft px-3 py-2">
      <div>
        <p className="text-sm font-black">{label}</p>
        <p className="mt-0.5 text-xs text-text-muted">{description}</p>
      </div>
      {children}
    </div>
  );
}
